import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
// import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as logs from "aws-cdk-lib/aws-logs";

export interface CdkAppStackProps extends cdk.StackProps {
  readonly env: string;
  // readonly lambdaPythonVersion: string;
  readonly imageUri: string;
  readonly imageTag: string;
}

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkAppStackProps) {
    super(scope, id, props);

    // Build local docker image or use a pre-existing image from GHCR
    // const dockerImagePath = path.resolve(__dirname, "../../..");
    // const dockerAsset = new ecrAssets.DockerImageAsset(this, "MyLambdaImage", {
    //   directory: dockerImagePath,
    //   file: "Containerfile",
    //   target: "lambda_runtime",
    //   buildArgs: {
    //     LAMBDA_PYTHON_VERSION: props.pythonVersion,
    //   },
    // });

    // Lambda function
    const myLambda = new lambda.DockerImageFunction(this, "MyLambdaFunction", {
      // code: lambda.DockerImageCode.fromEcr(dockerAsset.repository),
      code: lambda.DockerImageCode.fromImageUri(`${props?.imageUri}:${props?.imageTag || "latest"}`),
    });

    // API Gateway with logging and caching
    const logGroup = new logs.LogGroup(this, "ApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const api = new apigateway.RestApi(this, "MyApiGateway", {
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(), // Standard JSON log format
      }
    });
    const root = api.root;
    root.addMethod("GET", new apigateway.LambdaIntegration(myLambda), {
      methodResponses: [{ statusCode: "200" }],
    });

    // Output the API Gateway URL
    new cdk.CfnOutput(this, "ApiGatewayUri", {
      value: api.url,
      description: "API Gateway endpoint URL",
    });
  }
}
