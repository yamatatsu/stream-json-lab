import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { chain } from "stream-chain";
import { disassembler } from "stream-json/Disassembler";
import { stringer } from "stream-json/Stringer";

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2023-04-01T00:00Z").getTime();
const step = 60 * 1000;
const filePath = __dirname + "/../lib/bucket-resource/large-chart-data.json";

async function main() {
  const readable = new Readable({
    objectMode: true,
  });

  const pipeline = readable
    .pipe(disassembler())
    .pipe(stringer({ makeArray: true }))
    .pipe(createWriteStream(filePath, "utf-8"));

  let timestamp = from;
  while (timestamp < to) {
    const value = 10 + Math.round(Math.random() * 20 * 10) / 10;
    readable.push([timestamp, value]);
    timestamp += step;
  }
  readable.push(null);

  await new Promise((resolve, reject) => {
    pipeline.on("error", reject);
    pipeline.on("end", resolve);
  });
}

main()
  .then(() => {
    console.info("Done");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
