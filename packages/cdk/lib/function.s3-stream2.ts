import { Writable, Readable } from "node:stream";
import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { filter } from "stream-json/filters/Filter";
import { stringer } from "stream-json/Stringer";

const client = new S3Client({});

declare var awslambda: {
  streamifyResponse: (
    streamHandler: (event: JSON, responseStream: Writable) => Promise<void>
  ) => Handler;
};

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
      filter({
        filter: (stack) => typeof stack[0] === "number" && stack[0] % 12 === 0,
      }),
      stringer(),
    ]).pipe(responseStream);
  }
);
