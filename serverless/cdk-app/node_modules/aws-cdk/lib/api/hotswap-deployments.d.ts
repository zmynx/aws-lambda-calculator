import * as cxapi from '@aws-cdk/cx-api';
import type { SdkProvider } from './aws-auth';
import type { SuccessfulDeployStackResult } from './deploy-stack';
import { HotswapMode, HotswapPropertyOverrides } from './hotswap/common';
import { CloudFormationStack } from './util/cloudformation';
/**
 * Perform a hotswap deployment, short-circuiting CloudFormation if possible.
 * If it's not possible to short-circuit the deployment
 * (because the CDK Stack contains changes that cannot be deployed without CloudFormation),
 * returns `undefined`.
 */
export declare function tryHotswapDeployment(sdkProvider: SdkProvider, assetParams: {
    [key: string]: string;
}, cloudFormationStack: CloudFormationStack, stackArtifact: cxapi.CloudFormationStackArtifact, hotswapMode: HotswapMode, hotswapPropertyOverrides: HotswapPropertyOverrides): Promise<SuccessfulDeployStackResult | undefined>;
