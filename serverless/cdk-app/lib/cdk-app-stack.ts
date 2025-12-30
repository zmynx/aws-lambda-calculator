import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

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
        IMAGE_TAG: props?.imageTag || "latest-lambda",
      },
      extraHash: props?.imageTag || "latest-lambda", // Force rebuild when imageTag changes
    });

    // Define the Lambda function using the Docker image from ECR
    const myLambda = new lambda.DockerImageFunction(this, "AwsLambdaCalculatorLambdaFunction", {
      code: lambda.DockerImageCode.fromEcr(dockerAsset.repository, {
        tagOrDigest: dockerAsset.assetHash,
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(45), // Prevent long-running requests
    });

    const logGroup = new logs.LogGroup(this, "AwsLambdaCalculatorApiGatewayAccessLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create API Gateway with throttling
    const api = new apigateway.RestApi(this, "AwsLambdaCalculatorApiGateway", {
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        // Global throttling limits
        throttlingRateLimit: 100, // requests per second
        throttlingBurstLimit: 200, // burst capacity
      },
      // Default CORS configuration for all resources
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'], // Only allow needed methods
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
      },
    });

    // Create Lambda integration with proxy enabled
    const lambdaIntegration = new apigateway.LambdaIntegration(myLambda, {
      proxy: true,
    });

    const root = api.root;

    // Add POST method (no API key required)
    const postMethod = root.addMethod("POST", lambdaIntegration);

    // Create WAF Web ACL for advanced protection
    const webAcl = new wafv2.CfnWebACL(this, 'CalculatorWebACL', {
      scope: 'REGIONAL', // For API Gateway
      defaultAction: { allow: {} },
      name: 'CalculatorWebACL',
      description: 'WAF rules for Calculator API protection',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CalculatorWebACL',
      },
      rules: [
        // Rate limiting rule - 100 requests per 5 minutes per IP
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
              evaluationWindowSec: 300, // 5 minutes
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // AWS Managed Rules - Common Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
        // Block requests with large payloads (prevent payload-based attacks)
        {
          name: 'LargePayloadRule',
          priority: 4,
          statement: {
            sizeConstraintStatement: {
              fieldToMatch: { body: {} },
              comparisonOperator: 'GT',
              size: 1024 * 10, // 10KB limit - adjust based on your needs
              textTransformations: [{
                priority: 0,
                type: 'NONE',
              }],
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'LargePayloadRule',
          },
        },
      ],
    });

    // Associate WAF with API Gateway
    const webAclAssociation = new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: webAcl.attrArn,
    });

    // Output the API Gateway URL and WAF info
    new cdk.CfnOutput(this, "ApiGatewayUri", {
      value: api.url,
      description: "API Gateway endpoint URL",
    });

    new cdk.CfnOutput(this, "WebACLArn", {
      value: webAcl.attrArn,
      description: "WAF Web ACL ARN",
    });
  }
}
