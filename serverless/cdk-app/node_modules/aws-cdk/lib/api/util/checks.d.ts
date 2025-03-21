import { SDK } from '../aws-auth/sdk';
export declare function determineAllowCrossAccountAssetPublishing(sdk: SDK, customStackName?: string): Promise<boolean>;
interface BootstrapStackInfo {
    hasStagingBucket: boolean;
    bootstrapVersion: number;
}
export declare function getBootstrapStackInfo(sdk: SDK, stackName: string): Promise<BootstrapStackInfo>;
export {};
