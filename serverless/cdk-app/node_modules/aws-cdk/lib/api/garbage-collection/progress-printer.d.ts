import { GcAsset as GCAsset } from './garbage-collector';
export declare class ProgressPrinter {
    private totalAssets;
    private assetsScanned;
    private taggedAsset;
    private taggedAssetsSizeMb;
    private deletedAssets;
    private deletedAssetsSizeMb;
    private interval;
    private setInterval?;
    private isPaused;
    constructor(totalAssets: number, interval?: number);
    reportScannedAsset(amt: number): void;
    reportTaggedAsset(assets: GCAsset[]): void;
    reportDeletedAsset(assets: GCAsset[]): void;
    start(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    private print;
}
