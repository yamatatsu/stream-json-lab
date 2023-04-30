import { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({});

const from = new Date("2022-04-01T00:00Z").getTime();
const to = new Date("2022-05-01T00:00Z").getTime();

export const handler: Handler = async () => {
  const output = await client.send(
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: "large-chart-data.json",
    })
  );
  const body = await output.Body?.transformToString();

  const data = JSON.parse(body ?? "");

  return data.filter(
    (item: [number, number]) => from <= item[0] && item[0] <= to
  );
};
