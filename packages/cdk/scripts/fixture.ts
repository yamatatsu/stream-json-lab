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
  const asm = new Asm();

  let count = 0;
  let promise: Promise<any> = Promise.resolve();

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
      console.info("count:", ++count, item);

      promise = promise.then(() => {
        return doc.put({
          TableName: "stream-json-lab",
          Item: item,
        });
      });

      return token;
    },
    stringer(),
  ]);

  pipeline.on("data", () => {});
  await new Promise((resolve, reject) => {
    pipeline.on("error", reject);
    pipeline.on("end", resolve);
  });

  await promise;
}
