import { describe, test, expect, vi } from "vitest";
import { createReadStream } from "node:fs";
import { Readable, Writable, Duplex, Transform } from "node:stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { ignore } from "stream-json/filters/Ignore";
import { replace } from "stream-json/filters/Replace";
import { filter } from "stream-json/filters/Filter";
import { streamValues } from "stream-json/streamers/StreamValues";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import Asm from "stream-json/Assembler";
import { emitter } from "stream-json/Emitter";
import { stringer } from "stream-json/Stringer";
import { disassembler } from "stream-json/Disassembler";

test("Pick", async () => {
  const stream = createReadStream("./simple-array-data.json")
    .pipe(parser())
    .pipe(pick({ filter: /\d+\.timestamp/ }))
    .pipe(stringer({ makeArray: true }));

  const actual = await toString(stream);
  expect(actual).toBe(
    "[1682640000000,1682643600000,1682647200000,1682650800000,1682654400000,1682658000000,1682661600000,1682665200000,1682668800000,1682672400000]"
  );
});

test("Filter", async () => {
  const stream = createReadStream("./simple-array-data.json")
    .pipe(parser())
    .pipe(
      filter({
        filter: (stack) => typeof stack[0] === "number" && stack[0] % 5 === 0,
      })
    )
    .pipe(stringer());

  const actual = await toString(stream);
  expect(actual).toBe(
    '[{"timestamp":1682640000000,"temperature":22},{"timestamp":1682658000000,"temperature":27}]'
  );
});

test("StreamValues", async () => {
  const stream = chain([
    createReadStream("./simple-array-data.json"),
    parser(),
    pick({ filter: /\d+/ }),
    streamValues(),
    ({ value }) => {
      if (1682654400000 <= value.timestamp && value.timestamp < 1682661600000) {
        return [value];
      }
    },
    disassembler(),
    stringer({ makeArray: true }),
  ]);

  const actual = await toString(stream);

  expect(actual).toEqual(
    '[{"timestamp":1682654400000,"temperature":29},{"timestamp":1682658000000,"temperature":27}]'
  );
});

// =====================
// test-utils

async function toString(stream: Readable) {
  const chunks: Buffer[] = [];
  stream.on("data", (chunk) => chunks.push(chunk));

  await new Promise<string>((resolve) => stream.on("end", resolve));

  return chunks.map((c) => c.toString()).join("");
}
