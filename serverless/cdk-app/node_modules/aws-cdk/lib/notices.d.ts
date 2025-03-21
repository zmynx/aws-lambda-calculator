import type { Environment } from '@aws-cdk/cx-api';
import { SdkHttpOptions } from './api';
import { Context } from './settings';
export interface NoticesProps {
    /**
     * CDK context
     */
    readonly context: Context;
    /**
     * Include notices that have already been acknowledged.
     *
     * @default false
     */
    readonly includeAcknowledged?: boolean;
    /**
     * Global CLI option for output directory for synthesized cloud assembly
     *
     * @default 'cdk.out'
     */
    readonly output?: string;
    /**
     * Global CLI option for whether we show notices
     *
     * @default true
     */
    readonly shouldDisplay?: boolean;
    /**
     * Options for the HTTP request
     */
    readonly httpOptions?: SdkHttpOptions;
}
export interface NoticesPrintOptions {
    /**
     * Whether to append the total number of unacknowledged notices to the display.
     *
     * @default false
     */
    readonly showTotal?: boolean;
}
export interface NoticesRefreshOptions {
    /**
     * Whether to force a cache refresh regardless of expiration time.
     *
     * @default false
     */
    readonly force?: boolean;
    /**
     * Data source for fetch notices from.
     *
     * @default - WebsiteNoticeDataSource
     */
    readonly dataSource?: NoticeDataSource;
}
export interface NoticesFilterFilterOptions {
    readonly data: Notice[];
    readonly cliVersion: string;
    readonly outDir: string;
    readonly bootstrappedEnvironments: BootstrappedEnvironment[];
}
export declare class NoticesFilter {
    static filter(options: NoticesFilterFilterOptions): FilteredNotice[];
    private static findForCliVersion;
    private static findForFrameworkVersion;
    private static findForBootstrapVersion;
    private static resolveAliases;
}
/**
 * Information about a bootstrapped environment.
 */
export interface BootstrappedEnvironment {
    readonly bootstrapStackVersion: number;
    readonly environment: Environment;
}
/**
 * Provides access to notices the CLI can display.
 */
export declare class Notices {
    /**
     * Create an instance. Note that this replaces the singleton.
     */
    static create(props: NoticesProps): Notices;
    /**
     * Get the singleton instance. May return `undefined` if `create` has not been called.
     */
    static get(): Notices | undefined;
    private static _instance;
    private readonly context;
    private readonly output;
    private readonly shouldDisplay;
    private readonly acknowledgedIssueNumbers;
    private readonly includeAcknowlegded;
    private readonly httpOptions;
    private data;
    private readonly bootstrappedEnvironments;
    private constructor();
    /**
     * Add a bootstrap information to filter on. Can have multiple values
     * in case of multi-environment deployments.
     */
    addBootstrappedEnvironment(bootstrapped: BootstrappedEnvironment): void;
    /**
     * Refresh the list of notices this instance is aware of.
     * To make sure this never crashes the CLI process, all failures are caught and
     * slitently logged.
     *
     * If context is configured to not display notices, this will no-op.
     */
    refresh(options?: NoticesRefreshOptions): Promise<void>;
    /**
     * Display the relevant notices (unless context dictates we shouldn't).
     */
    display(options?: NoticesPrintOptions): void;
}
export interface Component {
    name: string;
    version: string;
}
export interface Notice {
    title: string;
    issueNumber: number;
    overview: string;
    components: Component[];
    schemaVersion: string;
    severity?: string;
}
/**
 * Notice after passing the filter. A filter can augment a notice with
 * dynamic values as it has access to the dynamic matching data.
 */
export declare class FilteredNotice {
    readonly notice: Notice;
    private readonly dynamicValues;
    constructor(notice: Notice);
    addDynamicValue(key: string, value: string): void;
    format(): string;
    private formatOverview;
    private resolveDynamicValues;
}
export interface NoticeDataSource {
    fetch(): Promise<Notice[]>;
}
export declare class WebsiteNoticeDataSource implements NoticeDataSource {
    private readonly options;
    constructor(options?: SdkHttpOptions);
    fetch(): Promise<Notice[]>;
}
export declare class CachedDataSource implements NoticeDataSource {
    private readonly fileName;
    private readonly dataSource;
    private readonly skipCache?;
    constructor(fileName: string, dataSource: NoticeDataSource, skipCache?: boolean | undefined);
    fetch(): Promise<Notice[]>;
    private fetchInner;
    private load;
    private save;
}
