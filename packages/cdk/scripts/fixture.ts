import { createReadStream } from "node:fs";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import Asm from "stream-json/Assembler";
import { stringer } from "stream-json/stringer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocument.from(
  new DynamoDBClient({ region: "ap-northeast-1" })
);

main()
  .then(() => {
    console.info("Done");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

async function main() {
  const batchPutter = new BatchPutter();
  const asm = new Asm();

  const pipeline = chain([
    createReadStream(
      __dirname + "/../lib/bucket-resource/large-chart-data.json"
    ),
    parser(),
    (token) => {
      asm.consume(token);

      if (asm.depth !== 2) return token;
      if (asm.current.length === 0) return token;

      const [timestamp, value] = asm.current.pop();

      const item = { type: asm.path[0], timestamp, value };
      batchPutter.addItem(item);

      return token;
    },
    stringer(),
  ]);

  pipeline.on("data", () => {});
  await new Promise((resolve, reject) => {
    pipeline.on("error", reject);
    pipeline.on("end", resolve);
  });

  await batchPutter.waitDone();
}

type Item = { type: string; timestamp: number; value: number };
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
      console.info(
        "batchPut:",
        ++this.count,
        items[0].type,
        items[0].timestamp
      );
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
