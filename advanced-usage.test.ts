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

test("with stream", async () => {
  const lastTimestampPipe = chain([
    createReadStream("./large-chart-data.json"),
    parser(),
    pick({ filter: /temperature\.\d+\.0/ }),
  ]);

  const asm = Asm.connectTo(lastTimestampPipe);

  await new Promise((resolve) => {
    lastTimestampPipe.on("end", resolve);
  });

  // 最後のtimestampを取得
  const baseDate = new Date(asm.current);
  // 12週前をrangeの始端とする
  const startOfRange = new Date(
    baseDate.getFullYear() + 1,
    baseDate.getMonth(),
    baseDate.getDate(),
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds()
  ).getTime();

  const pipe = chain([
    createReadStream("./large-chart-data.json"),
    parser(),
    ignore({
      filter: (stack, token) => {
        // console.log(stack[1]);
        if (
          stack.length === 1

          // stack[2] === undefined &&
          // !!token.value
          // (token.value as unknown as number[])[0] < startOfRange
        ) {
          console.log(stack);
          return true;
        }
        return false;
      },
    }),
    // stringer(),
  ]);

  const json = Asm.connectTo(pipe);

  // pipe.on("data", (res) => res);
  await new Promise((res) => pipe.on("end", res));

  // expect(json.current).toBe("");
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
