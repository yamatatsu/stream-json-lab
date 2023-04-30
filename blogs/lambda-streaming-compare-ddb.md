[4/7 のアップデートで Lambda が stream レスポンスを返せるようになりました。](https://aws.amazon.com/jp/about-aws/whats-new/2023/04/aws-lambda-response-payload-streaming/)これにより、6MB よりも巨大なレスポンスを返すことができます。

前回調べた stream-json を用いることで、巨大な json を stream のまま編集することができます。stream のまま扱うことで展開する memory のサイズを抑えることができます。
lambda でこれを用いたときパフォーマンスにどのように影響するのかを調べるために、いくつかの実験をしてみました。

## 実験に使うデータ

実験に使うデータは以下の形式です。
1 分ごとの気温を記録した 1 年分のデータで、要素の数は 525,600 (365 \* 24 \* 60 ) 個です。

**S3 に置く JSON ファイル**

```json
[
  [1648771200000, 12.6],
  [1648771260000, 17.7],
  [1648771320000, 29.1],
  ...
]
```

一要素目はエポックミリ秒、二要素目は気温を模したランダムな数値です。

**DynamoDB**

| deviceId(PK) | timestamp(SK) | value |
| :----------- | :------------ | :---- |
| "001"        | 1648771200000 | 12.6  |
| "001"        | 1648771260000 | 17.7  |
| "001"        | 1648771320000 | 29.1  |
| ...          | ...           | ...   |

timestamp はエポックミリ秒、value は気温を模したランダムな数値です。
deviceId には"001"の固定値を仮り置きしています。

## 実験の内容

3 種類の lambda 関数をそれぞれメモリサイズ 128MB, 256MB, 512MB で実行し、レスポンス完了までにかかる時間を調べました。
すべての関数とも取得したデータを 1 ヶ月分だけに filter して返します。

**1. s3 のデータを返す（stream）**

```ts
import { Writable, Readable } from "node:stream";
import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import { disassembler } from "stream-json/Disassembler";
import { stringer } from "stream-json/Stringer";

const client = new S3Client({});

declare var awslambda: {
  streamifyResponse: (
    streamHandler: (event: JSON, responseStream: Writable) => Promise<void>
  ) => Handler;
};

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2022-05-01T00:00Z").getTime();

export const handler: Handler = awslambda.streamifyResponse(
  async (event: JSON, responseStream: Writable) => {
    const output = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: "large-chart-data.json",
      })
    );

    chain([
      output.Body as Readable,
      parser(),
      streamArray(),
      ({ value }) => {
        if (from <= value[0] && value[0] <= to) {
          return [value];
        }
        return [];
      },
      disassembler(),
      stringer({ makeArray: true }),
    ]).pipe(responseStream);
  }
);
```

**2. s3 のデータを返す（非 stream）**

```ts
import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({});

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2022-05-01T00:00Z").getTime();

export const handler: Handler = async () => {
  const output = await client.send(
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: "large-chart-data.json",
    })
  );
  const body = await output.Body?.transformToString();

  const data = JSON.parse(body ?? "");

  return data.filter(
    (item: [number, number]) => from <= item[0] && item[0] <= to
  );
};
```

**3. DynamoDB のデータを返す（非 stream）**

```ts
import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocument.from(new DynamoDBClient({}));

type TableItem = { type: string; timestamp: number; value: number };

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2022-05-01T00:00Z").getTime();

export const handler: Handler = async () => {
  const items: TableItem[] = await queryRecursively();

  return items.map(({ timestamp, value }) => [timestamp, value]);
};

async function queryRecursively(exclusiveStartKey?: any): Promise<any[]> {
  console.info({ exclusiveStartKey });

  const { Items: items = [], LastEvaluatedKey: lastEvaluatedKey } =
    await doc.query({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression:
        "deviceId = :deviceId AND #timestamp BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":deviceId": "001",
        ":from": from,
        ":to": to,
      },
      ExpressionAttributeNames: {
        "#timestamp": "timestamp",
      },
      ExclusiveStartKey: exclusiveStartKey,
    });
  return [
    ...items,
    ...(lastEvaluatedKey ? await queryRecursively(lastEvaluatedKey) : []),
  ];
}
```

## 実験結果

コールドスタートを除いて 5 回実行した平均を記録しました。
（簡易のため平均値のみを確認しました。）

| lambda         | memory(MB) | time(ms) | used memory(MB) |
| :------------- | ---------: | -------: | --------------: |
| s3 (stream)    |        128 |   81,524 |             120 |
| s3 (stream)    |        256 |   40,241 |             144 |
| s3 (stream)    |        512 |   18,050 |             174 |
| s3 (非 stream) |        128 |   33,847 |             128 |
| s3 (非 stream) |        256 |    3,892 |             256 |
| s3 (非 stream) |        512 |    1,733 |             319 |
| DynamoDB       |        128 |    6,779 |             128 |
| DynamoDB       |        256 |    3,402 |             163 |
| DynamoDB       |        512 |    2,139 |             191 |

## 考察

すべての応答を返すまでにかかる時間は、s3 の stream が最も遅かったです。

また、memory を 512 まで引き上げたケースでは、s3 の非 stream と DynamoDB はほぼ同じ結果となりました。

テーブルの item がより複雑なケースや、s3 に置いた json からどのような加工をするかで、これらの結果は変化する可能性が大きいです。
そのためそれぞれのユースケースで検証が必要であると言えます。

## まとめ

今回の調査で、Lambda の stream レスポンスを使用する場合は、パフォーマンス（特にすべてのレスポンスが完了するまでにかかる時間）は遅くなる可能性が高いことがわかりました。
[公式アナウンス](https://aws.amazon.com/jp/about-aws/whats-new/2023/04/aws-lambda-response-payload-streaming/)や[公式ブログ](https://aws.amazon.com/jp/blogs/news/introducing-aws-lambda-response-streaming/)にある通り、「6MB を超えるレスポンスが必要」や「レスポンスを順次表示することが重要」などのユースケースで有効な機能であると思います。

「レスポンスを順次表示することが重要」なユースケースではクライアントサイドでも stream-json によるパースは有効であると言えます。
また、応答に csv 形式を用いる場合は、同じ作者の [stream-csv-as-json](https://github.com/uhop/stream-csv-as-json) が有効になる場合があるかもしれません。
