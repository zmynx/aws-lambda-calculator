import * as cxapi from '@aws-cdk/cx-api';
import { StackResourceSummary } from '@aws-sdk/client-cloudformation';
import { SuccessfulDeployStackResult } from '../../../lib/api';
import { HotswapMode, HotswapPropertyOverrides } from '../../../lib/api/hotswap/common';
import { Template } from '../../../lib/api/util/cloudformation';
import { TestStackArtifact } from '../../util';
import { MockSdkProvider } from '../../util/mock-sdk';
export declare const STACK_ID = "stackId";
export declare function setupHotswapTests(): HotswapMockSdkProvider;
export declare function setupHotswapNestedStackTests(rootStackName: string): HotswapMockSdkProvider;
export declare function cdkStackArtifactOf(testStackArtifact?: Partial<TestStackArtifact>): cxapi.CloudFormationStackArtifact;
export declare function pushStackResourceSummaries(...items: StackResourceSummary[]): void;
export declare function pushNestedStackResourceSummaries(stackName: string, ...items: StackResourceSummary[]): void;
export declare function setCurrentCfnStackTemplate(template: Template): void;
export declare function addTemplateToCloudFormationLookupMock(stackArtifact: cxapi.CloudFormationStackArtifact): void;
export declare function stackSummaryOf(logicalId: string, resourceType: string, physicalResourceId: string): StackResourceSummary;
export declare class HotswapMockSdkProvider extends MockSdkProvider {
    constructor(rootStackName?: string);
    tryHotswapDeployment(hotswapMode: HotswapMode, stackArtifact: cxapi.CloudFormationStackArtifact, assetParams?: {
        [key: string]: string;
    }, hotswapPropertyOverrides?: HotswapPropertyOverrides): Promise<SuccessfulDeployStackResult | undefined>;
}
