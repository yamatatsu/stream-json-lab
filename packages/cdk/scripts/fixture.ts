import { createReadStream } from "node:fs";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocument.from(
  new DynamoDBClient({ region: "ap-northeast-1" })
);
const filePath = __dirname + "/../lib/bucket-resource/large-chart-data.json";

async function main() {
  const batchPutter = new BatchPutter();

  const pipeline = chain([
    createReadStream(filePath),
    parser(),
    streamArray(),
    ({ value }) => {
      const item = { deviceId: "001", timestamp: value[0], value: value[1] };
      batchPutter.addItem(item);
    },
  ]);

  pipeline.on("data", () => {});
  await new Promise((resolve, reject) => {
    pipeline.on("error", reject);
    pipeline.on("end", resolve);
  });

  await batchPutter.waitDone();
}

type Item = { deviceId: string; timestamp: number; value: number };
class BatchPutter {
  private count = 0;
  private items: Item[] = [];
  private promise: Promise<any> = Promise.resolve();

  addItem(item: Item): void {
    this.items.push(item);
    if (this.items.length < 25) return;
    this.batchPut();
  }

  async waitDone() {
    this.batchPut();
    await this.promise;
  }

  private batchPut() {
    const items = this.items.splice(0, 25);
    this.promise = this.promise.then(() => {
      if (items.length === 0) return;

      console.info("batchPut:", ++this.count, items[0].timestamp);

      return doc.batchWrite({
        RequestItems: {
          "stream-json-lab": items.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      });
    });
  }
}

main()
  .then(() => {
    console.info("Done");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
