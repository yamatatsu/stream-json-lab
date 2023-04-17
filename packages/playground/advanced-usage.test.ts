import { describe, test, expect, vi } from "vitest";
import { createReadStream } from "node:fs";
import { Readable, Writable, Duplex, Transform } from "node:stream";
import { chain } from "stream-chain";
// @ts-ignore
import { none } from "stream-chain";
import { defaultMaxListeners } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { ignore } from "stream-json/filters/Ignore";
import { replace } from "stream-json/filters/Replace";
import { filter } from "stream-json/filters/Filter";
import { streamValues } from "stream-json/streamers/StreamValues";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import Asm from "stream-json/Assembler";
import { disassembler } from "stream-json/Disassembler";
import { emitter } from "stream-json/Emitter";
import { stringer } from "stream-json/Stringer";

/**
 * This way stack each item of top-level array to memory.
 * So there is the problem about memory.
 *
 * @see https://github.com/uhop/stream-json/issues/77
 */
test("edit items of the top-level array", async () => {
  const asm = new Asm();

  const transformFn = (chunk: { name: string; value?: string | undefined }) => {
    asm.consume(chunk);

    // Only when the item of top-level array is completed,
    // it is pushed to the stream.
    if (asm.depth === 1 && asm.current.length) {
      return asm.current.pop();
    }

    // When depth is not 3, nothing is done.
    if (asm.depth !== 3) {
      return none;
    }

    // When depth is 3, the list items is filtered.

    const list = asm.current;

    if (!list.length) {
      return none;
    }

    const lastItem = list[list.length - 1];

    if (lastItem.item % 2 !== 0) {
      list.pop();
    }

    return none;
  };

  const pipeline = chain([
    createReadStream("./sample.json"),
    parser(),
    transformFn,
    disassembler(),
    stringer({ makeArray: true }),
  ]);

  const res = await getOutputAsString(pipeline);

  expect(JSON.parse(res)).toEqual([
    { other: "a", list: [{ item: 2 }, { item: 4 }] },
    { other: "b", list: [{ item: 2 }, { item: 4 }] },
    { other: "c", list: [{ item: 2 }, { item: 4 }] },
  ]);
});

test("filter items by the property of the item", async () => {
  const depthScaler = new Asm();
  let itemAsm: Asm;

  const transformFn = (token: { name: string; value?: string | undefined }) => {
    // TODO: reducer memory
    depthScaler.consume(token);

    if (depthScaler.depth < 3) {
      return token;
    }

    if (depthScaler.depth === 3 && token.name === "startArray") {
      return token;
    }

    if (depthScaler.depth === 4 && token.name === "startObject") {
      itemAsm = new Asm();
      itemAsm.consume(token);
      return none;
    }
    if (depthScaler.depth === 3 && token.name === "endObject") {
      itemAsm.consume(token);

      const { item } = itemAsm.current;

      if (item % 2 === 0) {
        // TODO: item to tokens
        return [
          { name: "startObject" },
          { name: "startKey" },
          { name: "stringChunk", value: "item" },
          { name: "endKey" },
          { name: "keyValue", value: "item" },
          { name: "startNumber" },
          { name: "numberChunk", value: item.toString() },
          { name: "endNumber" },
          { name: "numberValue", value: item.toString() },
          { name: "endObject" },
        ];
      } else {
        return none;
      }
    }

    itemAsm.consume(token);

    return none;
  };

  const pipeline = chain([
    createReadStream("./sample.json"),
    parser(),
    transformFn,
    stringer(),
  ]);

  const res = await getOutputAsString(pipeline);

  expect(JSON.parse(res)).toEqual([
    { other: "a", list: [{ item: 2 }, { item: 4 }] },
    { other: "b", list: [{ item: 2 }, { item: 4 }] },
    { other: "c", list: [{ item: 2 }, { item: 4 }] },
  ]);
});

// ======================
// test-util

function getOutputAsString(pipeline: Readable) {
  const chunks: Buffer[] = [];
  pipeline.on("data", (data) => chunks.push(data));
  return new Promise<string>((resolve) => {
    pipeline.on("end", () => {
      resolve(Buffer.concat(chunks).toString());
    });
  });
}
