import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const doc = DynamoDBDocument.from(new DynamoDBClient({}));

type TableItem = { type: string; timestamp: number; value: number };

export const handler: Handler = async () => {
  const items: TableItem[] = await queryRecursively();

  return items.map(({ timestamp, value }) => [timestamp, value]);
};

async function queryRecursively(exclusiveStartKey?: any): Promise<any[]> {
  const { Items: items = [], LastEvaluatedKey: lastEvaluatedKey } =
    await doc.query({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "#type = :type",
      ExpressionAttributeValues: { ":type": "data1" },
      ExpressionAttributeNames: { "#type": "type" },
      ExclusiveStartKey: exclusiveStartKey,
    });
  return [
    ...items,
    ...(lastEvaluatedKey ? await queryRecursively(lastEvaluatedKey) : []),
  ];
}
