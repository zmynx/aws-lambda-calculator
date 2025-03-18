#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Tags } from "aws-cdk-lib";
import { CdkAppStack } from "../lib/cdk-app-stack";

const app = new cdk.App();
new CdkAppStack(app, "CdkAppStack", {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },
  // env: { account: '123456789012', region: 'us-east-1' },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

Tags.of(app).add("Project", "CDK-App");
Tags.of(app).add("Project", "CDK-App");
Tags.of(app).add("Project", "CDK-App");
Tags.of(app).add("Project", "CDK-App");
Tags.of(app).add("Project", "CDK-App");
Tags.of(app).add("owner", "lior.dux@develeap.com");
Tags.of(app).add("stage ", "test");
Tags.of(app).add("project ", "env0-aws-lambda-calculator");
Tags.of(app).add("start_date ", "18/03/2025");
Tags.of(app).add("end_date ", "19/03/2025");
Tags.of(app).add("managed_by ", "env0-cdk");
Tags.of(app).add("email ", "lior.dux@develeap.com");
Tags.of(app).add("Objective ", "env0");
Tags.of(app).add("Expiration ", "true");

