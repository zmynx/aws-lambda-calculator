import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkAppQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // Lambda function
    const myLambda = new lambda.Function(this, "MyLambdaFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda"),
    });

    // API Gateway
    const api = new apigateway.LambdaRestApi(this, "MyApiGateway", {
      handler: myLambda,
      proxy: false,
    });

    const items = api.root.addResource("items");
    items.addMethod("GET"); // GET /items
    items.addMethod("POST"); // POST /items
  }
}
