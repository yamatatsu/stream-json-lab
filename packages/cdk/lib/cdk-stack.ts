import { resolve } from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnUrl, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";

const path = (_path: string) => resolve(__dirname, _path);

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Setup DynamoDB table

    const table = new Table(this, "table", {
      tableName: "stream-json-lab",
      partitionKey: { name: "type", type: AttributeType.STRING },
      sortKey: { name: "timestamp", type: AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // writeCapacity: 100,
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
      environment: {
        TABLE_NAME: table.tableName,
      },
      cb: (fn) => {
        table.grantReadData(fn);
      },
    });

    // TODO: get s3 as string

    // ======================
    // get s3 as stream

    // https://3pmcrrme5lcmahtx6uuu3ux6540mxdjd.lambda-url.ap-northeast-1.on.aws/
    this.buildFunction("s3-stream-128", {
      stream: true,
      entry: path("function.s3-stream.ts"),
      memorySize: 128,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      cb: (fn) => {
        bucket.grantRead(fn);
      },
    });

    // https://3dbsou357ctkfo5gxdhfm65pli0vbndk.lambda-url.ap-northeast-1.on.aws/
    this.buildFunction("s3-stream-256", {
      stream: true,
      entry: path("function.s3-stream.ts"),
      memorySize: 256,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      cb: (fn) => {
        bucket.grantRead(fn);
      },
    });

    // https://2debwf4athb5pvoatsnlhohdqa0vllub.lambda-url.ap-northeast-1.on.aws/
    this.buildFunction("s3-stream-512", {
      stream: true,
      entry: path("function.s3-stream.ts"),
      memorySize: 512,
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      cb: (fn) => {
        bucket.grantRead(fn);
      },
    });
  }

  private buildFunction(
    id: string,
    props: NodejsFunctionProps & {
      stream?: boolean;
      cb?: (fn: NodejsFunction) => void;
    }
  ) {
    const fn = new NodejsFunction(this, id, {
      runtime: Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        sourceMap: true,
      },
      ...props,
    });
    const functionUrl = fn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    if (props.stream) {
      const cfnUrl = functionUrl.node.defaultChild as CfnUrl;
      cfnUrl.invokeMode = "RESPONSE_STREAM";
    }

    props.cb?.(fn);

    return fn;
  }
}
