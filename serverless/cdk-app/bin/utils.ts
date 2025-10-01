#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { AwsLambdaCalculatorStackProps } from "../lib/cdk-app-stack";

export function loadConfig(env: string): AwsLambdaCalculatorStackProps {
  // `../` point to the cdk appplication root.
  const contextFilePath = path.join(
    __dirname,
    `../../configs/${env}.context.yaml`,
  );
  console.log(`contextFilePath: ${contextFilePath}`);
  if (!fs.existsSync(contextFilePath)) {
    throw new Error(`Context file not found`);
  }

  const fullContext = yaml.load(
    fs.readFileSync(contextFilePath, "utf-8"),
  ) as AwsLambdaCalculatorStackProps;
  const context: AwsLambdaCalculatorStackProps = fullContext;

  console.log("\n##############################################");
  console.log(`#                EnvProps:                   #`);
  console.log("##############################################");
  console.log(`${yaml.dump(context, { indent: 2 })}`);
  console.log("##############################################\n");

  return context;
}
