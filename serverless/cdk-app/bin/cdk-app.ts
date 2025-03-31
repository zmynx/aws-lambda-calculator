#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { CdkAppStack } from "../lib/cdk-app-stack";
import { loadConfig } from "./utils";

const app = new App();

// Load context dynamically based on environment
const env = app.node.tryGetContext("env") as string;
const context = loadConfig(env);

new CdkAppStack(app, `${env}-CdkAppStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  ...context, // Expand the context
});

Tags.of(app).add("owner", "lior.dux@develeap.com");
Tags.of(app).add("stage", "test");
Tags.of(app).add("project", "env0-aws-lambda-calculator");
Tags.of(app).add("start_date", "18/03/2025");
Tags.of(app).add("end_date", "27/03/2025");
Tags.of(app).add("managed_by", "env0-cdk");
Tags.of(app).add("email", "lior.dux@develeap.com");
Tags.of(app).add("Objective", "env0");
Tags.of(app).add("Expiration", "true");

