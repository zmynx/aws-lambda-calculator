import { Tag } from '@aws-sdk/client-sts';
interface AssumedRole {
    readonly roleArn: string;
    readonly serialNumber: string;
    readonly tokenCode: string;
    readonly roleSessionName: string;
    readonly tags?: Tag[];
    readonly transitiveTagKeys?: string[];
}
/**
 * Class for mocking AWS HTTP Requests and pretending to be STS
 *
 * This is necessary for testing our authentication layer. Most other mocking
 * libraries don't consider as they mock functional methods which happen BEFORE
 * the SDK's HTTP/Authentication layer.
 *
 * Instead, we want to validate how we're setting up credentials for the
 * SDK, so we pretend to be the STS server and have an in-memory database
 * of users and roles.
 *
 * With the v3 upgrade, this is only now half way being used as
 */
export declare class FakeSts {
    readonly assumedRoles: AssumedRole[];
    private identities;
    private roles;
    constructor();
    /**
     * Begin mocking
     */
    begin(): void;
    /**
     * Restore everything to normal
     */
    restore(): void;
    /**
     * Register a user
     */
    registerUser(account: string, accessKey: string, options?: RegisterUserOptions): void;
    /**
     * Register an assumable role
     */
    registerRole(account: string, roleArn: string, options?: RegisterRoleOptions): void;
    private setSTSMocks;
    private handleRequest;
    private handleGetCallerIdentity;
    /**
     * Maps have a funky encoding to them when sent to STS.
     *
     * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
     */
    private decodeMapFromRequestBody;
    /**
     * Lists have a funky encoding when sent to STS.
     *
     * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
     */
    private decodeListKeysFromRequestBody;
    private handleAssumeRole;
    private checkForFailure;
    private identity;
    /**
     * Return the access key from a signed request
     */
    private accessKeyId;
}
export interface RegisterUserOptions {
    readonly name?: string;
    readonly partition?: string;
}
export interface RegisterRoleOptions {
    readonly allowedAccounts?: string[];
    readonly name?: string;
}
export interface STSMocksOptions {
    readonly accessKey?: string;
}
export {};
