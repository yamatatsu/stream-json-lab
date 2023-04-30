import { resolve } from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnUrl, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { AttributeType, ITable, Table } from "aws-cdk-lib/aws-dynamodb";

const path = (_path: string) => resolve(__dirname, _path);

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Setup DynamoDB table

    const table = new Table(this, "table", {
      tableName: "stream-json-lab",
      partitionKey: { name: "deviceId", type: AttributeType.STRING },
      sortKey: { name: "timestamp", type: AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // writeCapacity: 1000, // use for fixture
    });

    // Setup S3 bucket

    const bucket = new Bucket(this, "bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new BucketDeployment(this, "deploy", {
      sources: [Source.asset(path("bucket-resource"))],
      destinationBucket: bucket,
    });

    // Setup Lambda functions

    // get ddb

    this.buildFunction("ddb-128", {
      entry: path("function.ddb.ts"),
      memorySize: 128,
      table,
    });

    this.buildFunction("ddb-256", {
      entry: path("function.ddb.ts"),
      memorySize: 256,
      table,
    });

    this.buildFunction("ddb-512", {
      entry: path("function.ddb.ts"),
      memorySize: 512,
      table,
    });

    // get s3 as string

    this.buildFunction("s3-128", {
      entry: path("function.s3.ts"),
      memorySize: 128,
      bucket,
    });

    this.buildFunction("s3-256", {
      entry: path("function.s3.ts"),
      memorySize: 256,
      bucket,
    });

    this.buildFunction("s3-512", {
      entry: path("function.s3.ts"),
      memorySize: 512,
      bucket,
    });

    // ======================
    // get s3 as stream

    this.buildFunction("s3-stream-128", {
      entry: path("function.s3-stream.ts"),
      memorySize: 128,
      bucket,
      stream: true,
    });

    this.buildFunction("s3-stream-256", {
      entry: path("function.s3-stream.ts"),
      memorySize: 256,
      bucket,
      stream: true,
    });

    this.buildFunction("s3-stream-512", {
      entry: path("function.s3-stream.ts"),
      memorySize: 512,
      bucket,
      stream: true,
    });

    // ======================
    // get s3 as stream, part 2

    this.buildFunction("s3-stream2-128", {
      entry: path("function.s3-stream2.ts"),
      memorySize: 128,
      bucket,
      stream: true,
    });

    this.buildFunction("s3-stream2-256", {
      entry: path("function.s3-stream2.ts"),
      memorySize: 256,
      bucket,
      stream: true,
    });

    this.buildFunction("s3-stream2-512", {
      entry: path("function.s3-stream2.ts"),
      memorySize: 512,
      bucket,
      stream: true,
    });
  }

  private buildFunction(
    id: string,
    props: NodejsFunctionProps & {
      stream?: boolean;
      table?: ITable;
      bucket?: IBucket;
    }
  ) {
    const { stream, table, bucket } = props;

    const fn = new NodejsFunction(this, id, {
      runtime: Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(120),
      bundling: {
        sourceMap: true,
      },
      environment: {
        ...props.environment,
        ...(table && { TABLE_NAME: table.tableName }),
        ...(bucket && { BUCKET_NAME: bucket.bucketName }),
      },
      ...props,
    });
    const functionUrl = fn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    if (stream) {
      const cfnUrl = functionUrl.node.defaultChild as CfnUrl;
      cfnUrl.invokeMode = "RESPONSE_STREAM";
    }

    table?.grantReadData(fn);
    bucket?.grantRead(fn);

    new cdk.CfnOutput(this, `${id}-url`, { value: functionUrl.url });

    return fn;
  }
}
