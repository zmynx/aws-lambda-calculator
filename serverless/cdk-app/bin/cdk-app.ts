#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { CdkAppStack } from "../lib/cdk-app-stack";
import { loadConfig } from "./utils";

const app = new App();

// Load context dynamically based on environment
const env = app.node.tryGetContext("env") as string;
const context = loadConfig(env);

const stack = new AwsLambdaCalculatorStack(app, `${env}-AwsLambdaCalculatorStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  ...context, // Expand the context
});

Tags.of(app).add("owner", "lior.dux@develeap.com");
Tags.of(app).add("stage", "prod");
Tags.of(app).add("project", "aws-lambda-calculator");
Tags.of(app).add("start_date", "23/09/2025");
Tags.of(app).add("end_date", "23/09/2025");
Tags.of(app).add("managed_by", "gha-cdk");
Tags.of(app).add("email", "lior.dux@develeap.com");
Tags.of(app).add("objective", "api");
Tags.of(app).add("expiration", "false");

app.Synth();
