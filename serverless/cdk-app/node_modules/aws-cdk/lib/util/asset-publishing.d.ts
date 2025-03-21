import { type Environment } from '@aws-cdk/cx-api';
import { type Account, type AssetManifest, ClientOptions, EventType, type IAws, type IECRClient, type IS3Client, type ISecretsManagerClient } from 'cdk-assets';
import type { SdkProvider } from '../api/aws-auth/sdk-provider';
export interface PublishAssetsOptions {
    /**
     * Print progress at 'debug' level
     */
    readonly quiet?: boolean;
    /**
     * Whether to build assets before publishing.
     *
     * @default true To remain backward compatible.
     */
    readonly buildAssets?: boolean;
    /**
     * Whether to build/publish assets in parallel
     *
     * @default true To remain backward compatible.
     */
    readonly parallel?: boolean;
    /**
     * Whether cdk-assets is allowed to do cross account publishing.
     */
    readonly allowCrossAccount: boolean;
}
/**
 * Use cdk-assets to publish all assets in the given manifest.
 */
export declare function publishAssets(manifest: AssetManifest, sdk: SdkProvider, targetEnv: Environment, options: PublishAssetsOptions): Promise<void>;
export interface BuildAssetsOptions {
    /**
     * Print progress at 'debug' level
     */
    readonly quiet?: boolean;
    /**
     * Build assets in parallel
     *
     * @default true
     */
    readonly parallel?: boolean;
}
/**
 * Use cdk-assets to build all assets in the given manifest.
 */
export declare function buildAssets(manifest: AssetManifest, sdk: SdkProvider, targetEnv: Environment, options?: BuildAssetsOptions): Promise<void>;
export declare class PublishingAws implements IAws {
    /**
     * The base SDK to work with
     */
    private readonly aws;
    /**
     * Environment where the stack we're deploying is going
     */
    private readonly targetEnv;
    private sdkCache;
    constructor(
    /**
     * The base SDK to work with
     */
    aws: SdkProvider, 
    /**
     * Environment where the stack we're deploying is going
     */
    targetEnv: Environment);
    discoverPartition(): Promise<string>;
    discoverDefaultRegion(): Promise<string>;
    discoverCurrentAccount(): Promise<Account>;
    discoverTargetAccount(options: ClientOptions): Promise<Account>;
    s3Client(options: ClientOptions): Promise<IS3Client>;
    ecrClient(options: ClientOptions): Promise<IECRClient>;
    secretsManagerClient(options: ClientOptions): Promise<ISecretsManagerClient>;
    /**
     * Get an SDK appropriate for the given client options
     */
    private sdk;
}
export declare const EVENT_TO_LOGGER: Record<EventType, (x: string) => void>;
