import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as logs from "aws-cdk-lib/aws-logs";

export interface CdkAppStackProps extends cdk.StackProps {
  readonly env: string;
  readonly lambdaPythonVersion: string;
}

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkAppStackProps) {
    super(scope, id, props);

    // Lambda function
    const dockerImagePath = path.resolve(__dirname, "../../..");
    const dockerAsset = new ecrAssets.DockerImageAsset(this, "MyLambdaImage", {
      directory: dockerImagePath, // Absolute path to Dockerfile
      file: "Containerfile", // Specify the Containerfile (or Dockerfile) to use
      target: "build", // Specify the build stage if using multi-stage builds
      buildArgs: {
        // Add any build arguments here if needed
        // Example: MY_BUILD_ARG: "value"
        LAMBDA_PYTHON_VERSION: props.pythonVersion,
      },
    });
    const myLambda = new lambda.DockerImageFunction(this, "MyLambdaFunction", {
      code: lambda.DockerImageCode.fromEcr(dockerAsset.repository),
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
  }
}
