import "source-map-support/register";
import { Writable, Readable } from "node:stream";
import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { chain } from "stream-chain";
// @ts-ignore
import { none } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import Asm from "stream-json/Assembler";
import { disassembler } from "stream-json/Disassembler";
import { stringer } from "stream-json/Stringer";

const client = new S3Client({});

declare var awslambda: {
  streamifyResponse: (
    streamHandler: (event: JSON, responseStream: Writable) => Promise<void>
  ) => Handler;
};

const from = new Date("2022-11-24T00:00Z").getTime();
const to = new Date("2022-11-24T01:00Z").getTime();

export const handler: Handler = awslambda.streamifyResponse(
  async (event: JSON, responseStream: Writable) => {
    const output = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: "large-chart-data.json",
      })
    );

    const asm = new Asm();
    const transformFn = (token: {
      name: string;
      value?: string | undefined;
    }) => {
      asm.consume(token);

      if (asm.depth !== 1) {
        return none;
      }

      const items = asm.current;

      if (items.length === 0) {
        return none;
      }

      const item = items.pop();

      if (from <= item[0] && item[0] < to) {
        return [item];
      }

      return none;
    };

    chain([
      output.Body as Readable,
      parser(),
      pick({ filter: "data1" }),
      transformFn,
      disassembler(),
      stringer({ makeArray: true }),
    ]).pipe(responseStream);
  }
);
