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
