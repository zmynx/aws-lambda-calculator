import { type AssetManifest, type AssetMetadataEntry, type AwsCloudFormationStackProperties, type MissingContext } from '@aws-cdk/cloud-assembly-schema';
import { type CloudAssembly, type CloudFormationStackArtifact, type StackMetadata } from '@aws-cdk/cx-api';
import { MockSdkProvider } from './util/mock-sdk';
import { CloudExecutable } from '../lib/api/cxapp/cloud-executable';
import { Configuration } from '../lib/settings';
export declare const DEFAULT_FAKE_TEMPLATE: {
    No: string;
};
export interface TestStackArtifact {
    stackName: string;
    template?: any;
    env?: string;
    depends?: string[];
    metadata?: StackMetadata;
    notificationArns?: string[];
    /** Old-style assets */
    assets?: AssetMetadataEntry[];
    properties?: Partial<AwsCloudFormationStackProperties>;
    terminationProtection?: boolean;
    displayName?: string;
    /** New-style assets */
    assetManifest?: AssetManifest;
}
export interface TestAssembly {
    stacks: TestStackArtifact[];
    missing?: MissingContext[];
    nestedAssemblies?: TestAssembly[];
    schemaVersion?: string;
}
export declare class MockCloudExecutable extends CloudExecutable {
    readonly configuration: Configuration;
    readonly sdkProvider: MockSdkProvider;
    constructor(assembly: TestAssembly, sdkProviderArg?: MockSdkProvider);
}
export declare function testAssembly(assembly: TestAssembly): CloudAssembly;
export declare function testStack(stack: TestStackArtifact): CloudFormationStackArtifact;
/**
 * Return a mocked instance of a class, given its constructor
 *
 * I don't understand why jest doesn't provide this by default,
 * but there you go.
 *
 * FIXME: Currently very limited. Doesn't support inheritance, getters or
 * automatic detection of properties (as those exist on instances, not
 * classes).
 */
export declare function instanceMockFrom<A>(ctr: new (...args: any[]) => A): jest.Mocked<A>;
export declare function withMocked<A extends object, K extends keyof A, B>(obj: A, key: K, block: (fn: jest.Mocked<A>[K]) => B): B;
export declare function sleep(ms: number): Promise<unknown>;
