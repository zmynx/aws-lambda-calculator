import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as logs from "aws-cdk-lib/aws-logs";

export interface AwsLambdaCalculatorStackProps extends cdk.StackProps {
  readonly imageUri: string;
  readonly imageTag: string;
}

export class AwsLambdaCalculatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AwsLambdaCalculatorStackProps) {
    super(scope, id, props);

    // Build Docker image and push to ECR
    const dockerAsset = new ecrAssets.DockerImageAsset(this, "AwsLambdaCalculatorImage", {
      directory: path.resolve(__dirname, "."),
      file: "Dockerfile",
      buildArgs: {
        IMAGE_URI: props?.imageUri || "",
        IMAGE_TAG: props?.imageTag || "latest",
      },
    });

    // Define the Lambda function using the Docker image from ECR
    const myLambda = new lambda.DockerImageFunction(this, "AwsLambdaCalculatorLambdaFunction", {
      code: lambda.DockerImageCode.fromEcr(dockerAsset.repository, {
        tagOrDigest: dockerAsset.assetHash,
      }),
    });

    const logGroup = new logs.LogGroup(this, "AwsLambdaCalculatorApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const api = new apigateway.RestApi(this, "AwsLambdaCalculatorApiGateway", {
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      }
    });

    const root = api.root;
    root.addMethod("GET", new apigateway.LambdaIntegration(myLambda), {
      methodResponses: [{ statusCode: "200" }],
    });

    new cdk.CfnOutput(this, "ApiGatewayUri", {
      value: api.url,
      description: "API Gateway endpoint URL",
    });
  }
}
