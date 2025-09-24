import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
// import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as logs from "aws-cdk-lib/aws-logs";

export interface CdkAppStackProps extends cdk.StackProps {
  readonly env: string;
  readonly imageUri: string;
  readonly imageTag: string;
}

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkAppStackProps) {
    super(scope, id, props);

    const myLambda = new lambda.DockerImageFunction(this, "AwsLambdaCalculatorLambdaFunction", {
      code: lambda.DockerImageCode.fromImageUri(`${props?.imageUri}:${props?.imageTag || "latest"}`),
    });

    const logGroup = new logs.LogGroup(this, "AwsLambdaCalculatorApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
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
