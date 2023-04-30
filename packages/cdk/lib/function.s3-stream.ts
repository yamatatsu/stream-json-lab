import { Writable, Readable } from "node:stream";
import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";
import { disassembler } from "stream-json/Disassembler";
import { stringer } from "stream-json/Stringer";

const client = new S3Client({});

declare var awslambda: {
  streamifyResponse: (
    streamHandler: (event: JSON, responseStream: Writable) => Promise<void>
  ) => Handler;
};

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2022-05-01T00:00Z").getTime();

export const handler: Handler = awslambda.streamifyResponse(
  async (event: JSON, responseStream: Writable) => {
    const output = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: "large-chart-data.json",
      })
    );

    chain([
      output.Body as Readable,
      parser(),
      streamArray(),
      ({ value }) => {
        if (from <= value[0] && value[0] <= to) {
          return [value];
        }
        return [];
      },
      disassembler(),
      stringer({ makeArray: true }),
    ]).pipe(responseStream);
  }
);
