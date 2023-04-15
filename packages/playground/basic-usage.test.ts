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

type TransformFunction = (chunk: any, encoding?: string) => any;
type Stream = Readable | Writable | Duplex | Transform;
type StreamItem = Stream | TransformFunction;

/**
 * stream-json を使って、テストデータ ./data.json から
 * どのようにデータが取り出せるかを確認するplayground。
 */

describe("pick()", () => {
  test("filter: string", async () => {
    const result = await toString(pick({ filter: "items.0.id" }));
    expect(result).toEqual("0001");
  });

  test("filter: RegExp", async () => {
    const result = await toString(pick({ filter: /items\.\d+\.id/ }));
    // Only last one has be get when use Assembler.
    // when use Stringer, will be get '"0001" "0002" "0003"'
    expect(result).toEqual("0003");
  });

  test("filter: function", async () => {
    const result = await toString(
      pick({ filter: (stack) => stack[2] === "id" })
    );
    // Only last one has be get when use Assembler.
    // when use Stringer, will be get '"0001" "0002" "0003"'
    expect(result).toEqual("0003");
  });

  test("once:", async () => {
    const result = await toString(
      pick({ filter: /items\.\d+\.id/, once: true })
    );
    expect(result).toEqual("0001");
  });

  test("pathSeparator:", async () => {
    const result = await toString(
      pick({ filter: "itemsfoobar0foobarid", pathSeparator: "foobar" })
    );
    expect(result).toEqual("0001");
  });
});

// I can't understand behavior of this function...
test.skip("replace()", async () => {
  const result = await toString(
    replace({
      filter: /items\.\d+\.id/,
      replacement: (stack, token) => {
        // if (token.name !== "stringValue") {
        //   return token;
        // }
        return [{ name: "stringValue", value: "0000" }];
      },
      allowEmptyReplacement: true,
    }),
    pick({ filter: "items.0.id" })
  );
  expect(result).toEqual(
    '{"items":[{"id":"0000"},{"id":"0000"},{"id":"0000"}]}'
  );
});

test("ignore()", async () => {
  const result = await toString(
    // This conditions is little difficult to understand I think...
    ignore({ filter: /([^items\.\d+\.id])/ })
  );
  expect(result).toEqual({
    items: [{ id: "0001" }, { id: "0002" }, { id: "0003" }],
  });
});

describe("filter()", () => {
  test("filter: string", async () => {
    const result = await toString(
      filter({
        // understandable!!
        filter: "items.0.id",
      })
    );
    expect(result).toEqual({ items: [{ id: "0001" }] });
  });

  test("filter: RegExp", async () => {
    const result = await toString(
      filter({
        filter: /items\.\d+\.(id|type)/,
      })
    );
    expect(result).toEqual({
      items: [
        { id: "0001", type: "donut" },
        { id: "0002", type: "donut" },
        { id: "0003", type: "donut" },
      ],
    });
  });
});

test("streamValues()", async () => {
  const arr: { id: string; type: string }[] = [];
  await toString(
    pick({ filter: /items\.\d+.topping/ }),
    streamValues(),
    (data) => arr.push(data)
  );

  expect(arr).toEqual([
    {
      key: 0,
      value: [
        { id: "5001", type: "None" },
        { id: "5002", type: "Glazed" },
        { id: "5005", type: "Sugar" },
        { id: "5007", type: "Powdered Sugar" },
        { id: "5006", type: "Chocolate with Sprinkles" },
        { id: "5003", type: "Chocolate" },
        { id: "5004", type: "Maple" },
      ],
    },
    {
      key: 1,
      value: [
        { id: "5001", type: "None" },
        { id: "5002", type: "Glazed" },
        { id: "5005", type: "Sugar" },
        { id: "5003", type: "Chocolate" },
        { id: "5004", type: "Maple" },
      ],
    },
    {
      key: 2,
      value: [
        { id: "5001", type: "None" },
        { id: "5002", type: "Glazed" },
        { id: "5003", type: "Chocolate" },
        { id: "5004", type: "Maple" },
      ],
    },
  ]);
});

test("streamArray()", async () => {
  const arr: { id: string; type: string }[] = [];
  await toString(
    pick({ filter: /items\.\d\.topping/ }),
    streamArray(),
    (data) => arr.push(data)
  );

  expect(arr).toEqual([
    { key: 0, value: { id: "5001", type: "None" } },
    { key: 1, value: { id: "5002", type: "Glazed" } },
    { key: 2, value: { id: "5005", type: "Sugar" } },
    { key: 3, value: { id: "5007", type: "Powdered Sugar" } },
    { key: 4, value: { id: "5006", type: "Chocolate with Sprinkles" } },
    { key: 5, value: { id: "5003", type: "Chocolate" } },
    { key: 6, value: { id: "5004", type: "Maple" } },
    { key: 7, value: { id: "5001", type: "None" } },
    { key: 8, value: { id: "5002", type: "Glazed" } },
    { key: 9, value: { id: "5005", type: "Sugar" } },
    { key: 10, value: { id: "5003", type: "Chocolate" } },
    { key: 11, value: { id: "5004", type: "Maple" } },
    { key: 12, value: { id: "5001", type: "None" } },
    { key: 13, value: { id: "5002", type: "Glazed" } },
    { key: 14, value: { id: "5003", type: "Chocolate" } },
    { key: 15, value: { id: "5004", type: "Maple" } },
  ]);
});

test("streamObject()", async () => {
  const arr: { id: string; type: string }[] = [];
  await toString(
    pick({ filter: /items\.\d\.topping\.\d+/ }),
    streamObject(),
    (data) => {
      arr.push(data);
    }
  );

  expect(arr).toEqual([
    { key: "id", value: "5001" },
    { key: "type", value: "None" },
    { key: "id", value: "5002" },
    { key: "type", value: "Glazed" },
    { key: "id", value: "5005" },
    { key: "type", value: "Sugar" },
    { key: "id", value: "5007" },
    { key: "type", value: "Powdered Sugar" },
    { key: "id", value: "5006" },
    { key: "type", value: "Chocolate with Sprinkles" },
    { key: "id", value: "5003" },
    { key: "type", value: "Chocolate" },
    { key: "id", value: "5004" },
    { key: "type", value: "Maple" },
    { key: "id", value: "5001" },
    { key: "type", value: "None" },
    { key: "id", value: "5002" },
    { key: "type", value: "Glazed" },
    { key: "id", value: "5005" },
    { key: "type", value: "Sugar" },
    { key: "id", value: "5003" },
    { key: "type", value: "Chocolate" },
    { key: "id", value: "5004" },
    { key: "type", value: "Maple" },
    { key: "id", value: "5001" },
    { key: "type", value: "None" },
    { key: "id", value: "5002" },
    { key: "type", value: "Glazed" },
    { key: "id", value: "5003" },
    { key: "type", value: "Chocolate" },
    { key: "id", value: "5004" },
    { key: "type", value: "Maple" },
  ]);
});

test("stringer()", async () => {
  const pipeline = chain([
    createReadStream("./data.json"),
    parser(),
    filter({ filter: /items\.\d+\.id/ }),
    stringer(),
  ]);

  // stream to string
  const chunks: Buffer[] = [];
  pipeline.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const str = await new Promise((resolve) => {
    pipeline.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

  expect(str).toEqual('{"items":[{"id":"0001"},{"id":"0002"},{"id":"0003"}]}');
});

test("emitter()", async () => {
  const spy = vi.fn();

  const e = emitter();

  e.on("stringValue", spy);

  await toString(pick({ filter: /items\.\d\.id/ }), e);

  expect(spy).toBeCalledTimes(3);
  expect(spy).nthCalledWith(1, "0001");
  expect(spy).nthCalledWith(2, "0002");
  expect(spy).nthCalledWith(3, "0003");
});

// =====================
// test-utils

function toString(...streams: StreamItem[]) {
  const pipeline = chain([
    createReadStream("./data.json"),
    parser(),
    ...streams,
  ]);

  const asm = Asm.connectTo(pipeline);

  return new Promise<string>((resolve) => pipeline.on("end", resolve)).then(
    () => asm.current
  );
}
