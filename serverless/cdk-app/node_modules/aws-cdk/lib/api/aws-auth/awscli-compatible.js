"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsCliCompatible = void 0;
const credential_providers_1 = require("@aws-sdk/credential-providers");
const ec2_metadata_service_1 = require("@aws-sdk/ec2-metadata-service");
const shared_ini_file_loader_1 = require("@smithy/shared-ini-file-loader");
const promptly = require("promptly");
const proxy_agent_1 = require("proxy-agent");
const provider_caching_1 = require("./provider-caching");
const util_1 = require("./util");
const logging_1 = require("../../logging");
const error_1 = require("../../toolkit/error");
const DEFAULT_CONNECTION_TIMEOUT = 10000;
const DEFAULT_TIMEOUT = 300000;
/**
 * Behaviors to match AWS CLI
 *
 * See these links:
 *
 * https://docs.aws.amazon.com/cli/latest/topic/config-vars.html
 * https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
 */
class AwsCliCompatible {
    /**
     * Build an AWS CLI-compatible credential chain provider
     *
     * The credential chain returned by this function is always caching.
     */
    static async credentialChainBuilder(options = {}) {
        const clientConfig = {
            requestHandler: AwsCliCompatible.requestHandlerBuilder(options.httpOptions),
            customUserAgent: 'aws-cdk',
            logger: options.logger,
        };
        // Super hacky solution to https://github.com/aws/aws-cdk/issues/32510, proposed by the SDK team.
        //
        // Summary of the problem: we were reading the region from the config file and passing it to
        // the credential providers. However, in the case of SSO, this makes the credential provider
        // use that region to do the SSO flow, which is incorrect. The region that should be used for
        // that is the one set in the sso_session section of the config file.
        //
        // The idea here: the "clientConfig" is for configuring the inner auth client directly,
        // and has the highest priority, whereas "parentClientConfig" is the upper data client
        // and has lower priority than the sso_region but still higher priority than STS global region.
        const parentClientConfig = {
            region: await this.region(options.profile),
        };
        /**
         * The previous implementation matched AWS CLI behavior:
         *
         * If a profile is explicitly set using `--profile`,
         * we use that to the exclusion of everything else.
         *
         * Note: this does not apply to AWS_PROFILE,
         * environment credentials still take precedence over AWS_PROFILE
         */
        if (options.profile) {
            return (0, provider_caching_1.makeCachingProvider)((0, credential_providers_1.fromIni)({
                profile: options.profile,
                ignoreCache: true,
                mfaCodeProvider: tokenCodeFn,
                clientConfig,
                parentClientConfig,
                logger: options.logger,
            }));
        }
        const envProfile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE;
        /**
         * Env AWS - EnvironmentCredentials with string AWS
         * Env Amazon - EnvironmentCredentials with string AMAZON
         * Profile Credentials - PatchedSharedIniFileCredentials with implicit profile, credentials file, http options, and token fn
         *    SSO with implicit profile only
         *    SharedIniFileCredentials with implicit profile and preferStaticCredentials true (profile with source_profile)
         *    Shared Credential file that points to Environment Credentials with AWS prefix
         *    Shared Credential file that points to EC2 Metadata
         *    Shared Credential file that points to ECS Credentials
         * SSO Credentials - SsoCredentials with implicit profile and http options
         * ProcessCredentials with implicit profile
         * ECS Credentials - ECSCredentials with no input OR Web Identity - TokenFileWebIdentityCredentials with no input OR EC2 Metadata - EC2MetadataCredentials with no input
         *
         * These translate to:
         * fromEnv()
         * fromSSO()/fromIni()
         * fromProcess()
         * fromContainerMetadata()
         * fromTokenFile()
         * fromInstanceMetadata()
         *
         * The NodeProviderChain is already cached.
         */
        const nodeProviderChain = (0, credential_providers_1.fromNodeProviderChain)({
            profile: envProfile,
            clientConfig,
            parentClientConfig,
            logger: options.logger,
            mfaCodeProvider: tokenCodeFn,
            ignoreCache: true,
        });
        return shouldPrioritizeEnv()
            ? (0, credential_providers_1.createCredentialChain)((0, credential_providers_1.fromEnv)(), nodeProviderChain).expireAfter(60 * 60000)
            : nodeProviderChain;
    }
    static requestHandlerBuilder(options = {}) {
        const agent = this.proxyAgent(options);
        return {
            connectionTimeout: DEFAULT_CONNECTION_TIMEOUT,
            requestTimeout: DEFAULT_TIMEOUT,
            httpsAgent: agent,
            httpAgent: agent,
        };
    }
    static proxyAgent(options) {
        // Force it to use the proxy provided through the command line.
        // Otherwise, let the ProxyAgent auto-detect the proxy using environment variables.
        const getProxyForUrl = options.proxyAddress != null
            ? () => Promise.resolve(options.proxyAddress)
            : undefined;
        return new proxy_agent_1.ProxyAgent({
            ca: tryGetCACert(options.caBundlePath),
            getProxyForUrl,
        });
    }
    /**
     * Attempts to get the region from a number of sources and falls back to us-east-1 if no region can be found,
     * as is done in the AWS CLI.
     *
     * The order of priority is the following:
     *
     * 1. Environment variables specifying region, with both an AWS prefix and AMAZON prefix
     *    to maintain backwards compatibility, and without `DEFAULT` in the name because
     *    Lambda and CodeBuild set the $AWS_REGION variable.
     * 2. Regions listed in the Shared Ini Files - First checking for the profile provided
     *    and then checking for the default profile.
     * 3. IMDS instance identity region from the Metadata Service.
     * 4. us-east-1
     */
    static async region(maybeProfile) {
        const defaultRegion = 'us-east-1';
        const profile = maybeProfile || process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || 'default';
        const region = process.env.AWS_REGION ||
            process.env.AMAZON_REGION ||
            process.env.AWS_DEFAULT_REGION ||
            process.env.AMAZON_DEFAULT_REGION ||
            (await getRegionFromIni(profile)) ||
            (await regionFromMetadataService());
        if (!region) {
            const usedProfile = !profile ? '' : ` (profile: "${profile}")`;
            (0, logging_1.debug)(`Unable to determine AWS region from environment or AWS configuration${usedProfile}, defaulting to '${defaultRegion}'`);
            return defaultRegion;
        }
        return region;
    }
}
exports.AwsCliCompatible = AwsCliCompatible;
/**
 * Looks up the region of the provided profile. If no region is present,
 * it will attempt to lookup the default region.
 * @param profile The profile to use to lookup the region
 * @returns The region for the profile or default profile, if present. Otherwise returns undefined.
 */
async function getRegionFromIni(profile) {
    const sharedFiles = await (0, shared_ini_file_loader_1.loadSharedConfigFiles)({ ignoreCache: true });
    // Priority:
    //
    // credentials come before config because aws-cli v1 behaves like that.
    //
    // 1. profile-region-in-credentials
    // 2. profile-region-in-config
    // 3. default-region-in-credentials
    // 4. default-region-in-config
    return getRegionFromIniFile(profile, sharedFiles.credentialsFile)
        ?? getRegionFromIniFile(profile, sharedFiles.configFile)
        ?? getRegionFromIniFile('default', sharedFiles.credentialsFile)
        ?? getRegionFromIniFile('default', sharedFiles.configFile);
}
function getRegionFromIniFile(profile, data) {
    return data?.[profile]?.region;
}
function tryGetCACert(bundlePath) {
    const path = bundlePath || caBundlePathFromEnvironment();
    if (path) {
        (0, logging_1.debug)('Using CA bundle path: %s', path);
        return (0, util_1.readIfPossible)(path);
    }
    return undefined;
}
/**
 * Find and return a CA certificate bundle path to be passed into the SDK.
 */
function caBundlePathFromEnvironment() {
    if (process.env.aws_ca_bundle) {
        return process.env.aws_ca_bundle;
    }
    if (process.env.AWS_CA_BUNDLE) {
        return process.env.AWS_CA_BUNDLE;
    }
    return undefined;
}
/**
 * We used to support both AWS and AMAZON prefixes for these environment variables.
 *
 * Adding this for backward compatibility.
 */
function shouldPrioritizeEnv() {
    const id = process.env.AWS_ACCESS_KEY_ID || process.env.AMAZON_ACCESS_KEY_ID;
    const key = process.env.AWS_SECRET_ACCESS_KEY || process.env.AMAZON_SECRET_ACCESS_KEY;
    if (!!id && !!key) {
        process.env.AWS_ACCESS_KEY_ID = id;
        process.env.AWS_SECRET_ACCESS_KEY = key;
        const sessionToken = process.env.AWS_SESSION_TOKEN ?? process.env.AMAZON_SESSION_TOKEN;
        if (sessionToken) {
            process.env.AWS_SESSION_TOKEN = sessionToken;
        }
        return true;
    }
    return false;
}
/**
 * The MetadataService class will attempt to fetch the instance identity document from
 * IMDSv2 first, and then will attempt v1 as a fallback.
 *
 * If this fails, we will use us-east-1 as the region so no error should be thrown.
 * @returns The region for the instance identity
 */
async function regionFromMetadataService() {
    (0, logging_1.debug)('Looking up AWS region in the EC2 Instance Metadata Service (IMDS).');
    try {
        const metadataService = new ec2_metadata_service_1.MetadataService({
            httpOptions: {
                timeout: 1000,
            },
        });
        await metadataService.fetchMetadataToken();
        const document = await metadataService.request('/latest/dynamic/instance-identity/document', {});
        return JSON.parse(document).region;
    }
    catch (e) {
        (0, logging_1.debug)(`Unable to retrieve AWS region from IMDS: ${e}`);
    }
}
/**
 * Ask user for MFA token for given serial
 *
 * Result is send to callback function for SDK to authorize the request
 */
async function tokenCodeFn(serialArn) {
    (0, logging_1.debug)('Require MFA token for serial ARN', serialArn);
    try {
        const token = await promptly.prompt(`MFA token for ${serialArn}: `, {
            trim: true,
            default: '',
        });
        (0, logging_1.debug)('Successfully got MFA token from user');
        return token;
    }
    catch (err) {
        (0, logging_1.debug)('Failed to get MFA token', err);
        const e = new error_1.AuthenticationError(`Error fetching MFA token: ${err.message ?? err}`);
        e.name = 'SharedIniFileCredentialsProviderFailure';
        throw e;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzY2xpLWNvbXBhdGlibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhd3NjbGktY29tcGF0aWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3RUFBK0c7QUFDL0csd0VBQWdFO0FBRWhFLDJFQUF1RTtBQUV2RSxxQ0FBcUM7QUFDckMsNkNBQXlDO0FBQ3pDLHlEQUF5RDtBQUV6RCxpQ0FBd0M7QUFDeEMsMkNBQXNDO0FBQ3RDLCtDQUEwRDtBQUUxRCxNQUFNLDBCQUEwQixHQUFHLEtBQUssQ0FBQztBQUN6QyxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUM7QUFFL0I7Ozs7Ozs7R0FPRztBQUNILE1BQWEsZ0JBQWdCO0lBQzNCOzs7O09BSUc7SUFDSSxNQUFNLENBQUMsS0FBSyxDQUFDLHNCQUFzQixDQUN4QyxVQUFrQyxFQUFFO1FBRXBDLE1BQU0sWUFBWSxHQUFHO1lBQ25CLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQzNFLGVBQWUsRUFBRSxTQUFTO1lBQzFCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtTQUN2QixDQUFDO1FBRUYsaUdBQWlHO1FBQ2pHLEVBQUU7UUFDRiw0RkFBNEY7UUFDNUYsNEZBQTRGO1FBQzVGLDZGQUE2RjtRQUM3RixxRUFBcUU7UUFDckUsRUFBRTtRQUNGLHVGQUF1RjtRQUN2RixzRkFBc0Y7UUFDdEYsK0ZBQStGO1FBQy9GLE1BQU0sa0JBQWtCLEdBQUc7WUFDekIsTUFBTSxFQUFFLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1NBQzNDLENBQUM7UUFDRjs7Ozs7Ozs7V0FRRztRQUNILElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BCLE9BQU8sSUFBQSxzQ0FBbUIsRUFBQyxJQUFBLDhCQUFPLEVBQUM7Z0JBQ2pDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDeEIsV0FBVyxF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USxHQUFHLE1BQU0sZUFBZSxDQUFDLE9BQU8sQ0FBQyw0Q0FBNEMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3JDLENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1gsSUFBQSxlQUFLLEVBQUMsNENBQTRDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztBQUNILENBQUM7QUFRRDs7OztHQUlHO0FBQ0gsS0FBSyxVQUFVLFdBQVcsQ0FBQyxTQUFpQjtJQUMxQyxJQUFBLGVBQUssRUFBQyxrQ0FBa0MsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNyRCxJQUFJLENBQUM7UUFDSCxNQUFNLEtBQUssR0FBVyxNQUFNLFFBQVEsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLFNBQVMsSUFBSSxFQUFFO1lBQzFFLElBQUksRUFBRSxJQUFJO1lBQ1YsT0FBTyxFQUFFLEVBQUU7U0FDWixDQUFDLENBQUM7UUFDSCxJQUFBLGVBQUssRUFBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQzlDLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7UUFDbEIsSUFBQSxlQUFLLEVBQUMseUJBQXlCLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsTUFBTSxDQUFDLEdBQUcsSUFBSSwyQkFBbUIsQ0FBQyw2QkFBNkIsR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLENBQUMsQ0FBQyxJQUFJLEdBQUcseUNBQXlDLENBQUM7UUFDbkQsTUFBTSxDQUFDLENBQUM7SUFDVixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZUNyZWRlbnRpYWxDaGFpbiwgZnJvbUVudiwgZnJvbUluaSwgZnJvbU5vZGVQcm92aWRlckNoYWluIH0gZnJvbSAnQGF3cy1zZGsvY3JlZGVudGlhbC1wcm92aWRlcnMnO1xuaW1wb3J0IHsgTWV0YWRhdGFTZXJ2aWNlIH0gZnJvbSAnQGF3cy1zZGsvZWMyLW1ldGFkYXRhLXNlcnZpY2UnO1xuaW1wb3J0IHR5cGUgeyBOb2RlSHR0cEhhbmRsZXJPcHRpb25zIH0gZnJvbSAnQHNtaXRoeS9ub2RlLWh0dHAtaGFuZGxlcic7XG5pbXBvcnQgeyBsb2FkU2hhcmVkQ29uZmlnRmlsZXMgfSBmcm9tICdAc21pdGh5L3NoYXJlZC1pbmktZmlsZS1sb2FkZXInO1xuaW1wb3J0IHsgQXdzQ3JlZGVudGlhbElkZW50aXR5UHJvdmlkZXIsIExvZ2dlciB9IGZyb20gJ0BzbWl0aHkvdHlwZXMnO1xuaW1wb3J0ICogYXMgcHJvbXB0bHkgZnJvbSAncHJvbXB0bHknO1xuaW1wb3J0IHsgUHJveHlBZ2VudCB9IGZyb20gJ3Byb3h5LWFnZW50JztcbmltcG9ydCB7IG1ha2VDYWNoaW5nUHJvdmlkZXIgfSBmcm9tICcuL3Byb3ZpZGVyLWNhY2hpbmcnO1xuaW1wb3J0IHR5cGUgeyBTZGtIdHRwT3B0aW9ucyB9IGZyb20gJy4vc2RrLXByb3ZpZGVyJztcbmltcG9ydCB7IHJlYWRJZlBvc3NpYmxlIH0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vdG9vbGtpdC9lcnJvcic7XG5cbmNvbnN0IERFRkFVTFRfQ09OTkVDVElPTl9USU1FT1VUID0gMTAwMDA7XG5jb25zdCBERUZBVUxUX1RJTUVPVVQgPSAzMDAwMDA7XG5cbi8qKlxuICogQmVoYXZpb3JzIHRvIG1hdGNoIEFXUyBDTElcbiAqXG4gKiBTZWUgdGhlc2UgbGlua3M6XG4gKlxuICogaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2NsaS9sYXRlc3QvdG9waWMvY29uZmlnLXZhcnMuaHRtbFxuICogaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2NsaS9sYXRlc3QvdXNlcmd1aWRlL2NsaS1jb25maWd1cmUtZW52dmFycy5odG1sXG4gKi9cbmV4cG9ydCBjbGFzcyBBd3NDbGlDb21wYXRpYmxlIHtcbiAgLyoqXG4gICAqIEJ1aWxkIGFuIEFXUyBDTEktY29tcGF0aWJsZSBjcmVkZW50aWFsIGNoYWluIHByb3ZpZGVyXG4gICAqXG4gICAqIFRoZSBjcmVkZW50aWFsIGNoYWluIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24gaXMgYWx3YXlzIGNhY2hpbmcuXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGNyZWRlbnRpYWxDaGFpbkJ1aWxkZXIoXG4gICAgb3B0aW9uczogQ3JlZGVudGlhbENoYWluT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPEF3c0NyZWRlbnRpYWxJZGVudGl0eVByb3ZpZGVyPiB7XG4gICAgY29uc3QgY2xpZW50Q29uZmlnID0ge1xuICAgICAgcmVxdWVzdEhhbmRsZXI6IEF3c0NsaUNvbXBhdGlibGUucmVxdWVzdEhhbmRsZXJCdWlsZGVyKG9wdGlvbnMuaHR0cE9wdGlvbnMpLFxuICAgICAgY3VzdG9tVXNlckFnZW50OiAnYXdzLWNkaycsXG4gICAgICBsb2dnZXI6IG9wdGlvbnMubG9nZ2VyLFxuICAgIH07XG5cbiAgICAvLyBTdXBlciBoYWNreSBzb2x1dGlvbiB0byBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1jZGsvaXNzdWVzLzMyNTEwLCBwcm9wb3NlZCBieSB0aGUgU0RLIHRlYW0uXG4gICAgLy9cbiAgICAvLyBTdW1tYXJ5IG9mIHRoZSBwcm9ibGVtOiB3ZSB3ZXJlIHJlYWRpbmcgdGhlIHJlZ2lvbiBmcm9tIHRoZSBjb25maWcgZmlsZSBhbmQgcGFzc2luZyBpdCB0b1xuICAgIC8vIHRoZSBjcmVkZW50aWFsIHByb3ZpZGVycy4gSG93ZXZlciwgaW4gdGhlIGNhc2Ugb2YgU1NPLCB0aGlzIG1ha2VzIHRoZSBjcmVkZW50aWFsIHByb3ZpZGVyXG4gICAgLy8gdXNlIHRoYXQgcmVnaW9uIHRvIGRvIHRoZSBTU08gZmxvdywgd2hpY2ggaXMgaW5jb3JyZWN0LiBUaGUgcmVnaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgZm9yXG4gICAgLy8gdGhhdCBpcyB0aGUgb25lIHNldCBpbiB0aGUgc3NvX3Nlc3Npb24gc2VjdGlvbiBvZiB0aGUgY29uZmlnIGZpbGUuXG4gICAgLy9cbiAgICAvLyBUaGUgaWRlYSBoZXJlOiB0aGUgXCJjbGllbnRDb25maWdcIiBpcyBmb3IgY29uZmlndXJpbmcgdGhlIGlubmVyIGF1dGggY2xpZW50IGRpcmVjdGx5LFxuICAgIC8vIGFuZCBoYXMgdGhlIGhpZ2hlc3QgcHJpb3JpdHksIHdoZXJlYXMgXCJwYXJlbnRDbGllbnRDb25maWdcIiBpcyB0aGUgdXBwZXIgZGF0YSBjbGllbnRcbiAgICAvLyBhbmQgaGFzIGxvd2VyIHByaW9yaXR5IHRoYW4gdGhlIHNzb19yZWdpb24gYnV0IHN0aWxsIGhpZ2hlciBwcmlvcml0eSB0aGFuIFNUUyBnbG9iYWwgcmVnaW9uLlxuICAgIGNvbnN0IHBhcmVudENsaWVudENvbmZpZyA9IHtcbiAgICAgIHJlZ2lvbjogYXdhaXQgdGhpcy5yZWdpb24ob3B0aW9ucy5wcm9maWxlKSxcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFRoZSBwcmV2aW91cyBpbXBsZW1lbnRhdGlvbiBtYXRjaGVkIEFXUyBDTEkgYmVoYXZpb3I6XG4gICAgICpcbiAgICAgKiBJZiBhIHByb2ZpbGUgaXMgZXhwbGljaXRseSBzZXQgdXNpbmcgYC0tcHJvZmlsZWAsXG4gICAgICogd2UgdXNlIHRoYXQgdG8gdGhlIGV4Y2x1c2lvbiBvZiBldmVyeXRoaW5nIGVsc2UuXG4gICAgICpcbiAgICAgKiBOb3RlOiB0aGlzIGRvZXMgbm90IGFwcGx5IHRvIEFXU19QUk9GSUxFLFxuICAgICAqIGVudmlyb25tZW50IGNyZWRlbnRpYWxzIHN0aWxsIHRha2UgcHJlY2VkZW5jZSBvdmVyIEFXU19QUk9GSUxFXG4gICAgICovXG4gICAgaWYgKG9wdGlvbnMucHJvZmlsZSkge1xuICAgICAgcmV0dXJuIG1ha2VDYWNoaW5nUHJvdmlkZXIoZnJvbUluaSh7XG4gICAgICAgIHByb2ZpbGU6IG9wdGlvbnMucHJvZmlsZSxcbiAgICAgICAgaWdub3JlQ2FjaGU6IHRydWUsXG4gICAgICAgIG1mYUNvZGVQcm92aWRlcjogdG9rZW5Db2RlRm4sXG4gICAgICAgIGNsaWVudENvbmZpZyxcbiAgICAgICAgcGFyZW50Q2xpZW50Q29uZmlnLFxuICAgICAgICBsb2dnZXI6IG9wdGlvbnMubG9nZ2VyLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIGNvbnN0IGVudlByb2ZpbGUgPSBwcm9jZXNzLmVudi5BV1NfUFJPRklMRSB8fCBwcm9jZXNzLmVudi5BV1NfREVGQVVMVF9QUk9GSUxFO1xuXG4gICAgLyoqXG4gICAgICogRW52IEFXUyAtIEVudmlyb25tZW50Q3JlZGVudGlhbHMgd2l0aCBzdHJpbmcgQVdTXG4gICAgICogRW52IEFtYXpvbiAtIEVudmlyb25tZW50Q3JlZGVudGlhbHMgd2l0aCBzdHJpbmcgQU1BWk9OXG4gICAgICogUHJvZmlsZSBDcmVkZW50aWFscyAtIFBhdGNoZWRTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHMgd2l0aCBpbXBsaWNpdCBwcm9maWxlLCBjcmVkZW50aWFscyBmaWxlLCBodHRwIG9wdGlvbnMsIGFuZCB0b2tlbiBmblxuICAgICAqICAgIFNTTyB3aXRoIGltcGxpY2l0IHByb2ZpbGUgb25seVxuICAgICAqICAgIFNoYXJlZEluaUZpbGVDcmVkZW50aWFscyB3aXRoIGltcGxpY2l0IHByb2ZpbGUgYW5kIHByZWZlclN0YXRpY0NyZWRlbnRpYWxzIHRydWUgKHByb2ZpbGUgd2l0aCBzb3VyY2VfcHJvZmlsZSlcbiAgICAgKiAgICBTaGFyZWQgQ3JlZGVudGlhbCBmaWxlIHRoYXQgcG9pbnRzIHRvIEVudmlyb25tZW50IENyZWRlbnRpYWxzIHdpdGggQVdTIHByZWZpeFxuICAgICAqICAgIFNoYXJlZCBDcmVkZW50aWFsIGZpbGUgdGhhdCBwb2ludHMgdG8gRUMyIE1ldGFkYXRhXG4gICAgICogICAgU2hhcmVkIENyZWRlbnRpYWwgZmlsZSB0aGF0IHBvaW50cyB0byBFQ1MgQ3JlZGVudGlhbHNcbiAgICAgKiBTU08gQ3JlZGVudGlhbHMgLSBTc29DcmVkZW50aWFscyB3aXRoIGltcGxpY2l0IHByb2ZpbGUgYW5kIGh0dHAgb3B0aW9uc1xuICAgICAqIFByb2Nlc3NDcmVkZW50aWFscyB3aXRoIGltcGxpY2l0IHByb2ZpbGVcbiAgICAgKiBFQ1MgQ3JlZGVudGlhbHMgLSBFQ1NDcmVkZW50aWFscyB3aXRoIG5vIGlucHV0IE9SIFdlYiBJZGVudGl0eSAtIFRva2VuRmlsZVdlYklkZW50aXR5Q3JlZGVudGlhbHMgd2l0aCBubyBpbnB1dCBPUiBFQzIgTWV0YWRhdGEgLSBFQzJNZXRhZGF0YUNyZWRlbnRpYWxzIHdpdGggbm8gaW5wdXRcbiAgICAgKlxuICAgICAqIFRoZXNlIHRyYW5zbGF0ZSB0bzpcbiAgICAgKiBmcm9tRW52KClcbiAgICAgKiBmcm9tU1NPKCkvZnJvbUluaSgpXG4gICAgICogZnJvbVByb2Nlc3MoKVxuICAgICAqIGZyb21Db250YWluZXJNZXRhZGF0YSgpXG4gICAgICogZnJvbVRva2VuRmlsZSgpXG4gICAgICogZnJvbUluc3RhbmNlTWV0YWRhdGEoKVxuICAgICAqXG4gICAgICogVGhlIE5vZGVQcm92aWRlckNoYWluIGlzIGFscmVhZHkgY2FjaGVkLlxuICAgICAqL1xuICAgIGNvbnN0IG5vZGVQcm92aWRlckNoYWluID0gZnJvbU5vZGVQcm92aWRlckNoYWluKHtcbiAgICAgIHByb2ZpbGU6IGVudlByb2ZpbGUsXG4gICAgICBjbGllbnRDb25maWcsXG4gICAgICBwYXJlbnRDbGllbnRDb25maWcsXG4gICAgICBsb2dnZXI6IG9wdGlvbnMubG9nZ2VyLFxuICAgICAgbWZhQ29kZVByb3ZpZGVyOiB0b2tlbkNvZGVGbixcbiAgICAgIGlnbm9yZUNhY2hlOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNob3VsZFByaW9yaXRpemVFbnYoKVxuICAgICAgPyBjcmVhdGVDcmVkZW50aWFsQ2hhaW4oZnJvbUVudigpLCBub2RlUHJvdmlkZXJDaGFpbikuZXhwaXJlQWZ0ZXIoNjAgKiA2MF8wMDApXG4gICAgICA6IG5vZGVQcm92aWRlckNoYWluO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyByZXF1ZXN0SGFuZGxlckJ1aWxkZXIob3B0aW9uczogU2RrSHR0cE9wdGlvbnMgPSB7fSk6IE5vZGVIdHRwSGFuZGxlck9wdGlvbnMge1xuICAgIGNvbnN0IGFnZW50ID0gdGhpcy5wcm94eUFnZW50KG9wdGlvbnMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbm5lY3Rpb25UaW1lb3V0OiBERUZBVUxUX0NPTk5FQ1RJT05fVElNRU9VVCxcbiAgICAgIHJlcXVlc3RUaW1lb3V0OiBERUZBVUxUX1RJTUVPVVQsXG4gICAgICBodHRwc0FnZW50OiBhZ2VudCxcbiAgICAgIGh0dHBBZ2VudDogYWdlbnQsXG4gICAgfTtcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgcHJveHlBZ2VudChvcHRpb25zOiBTZGtIdHRwT3B0aW9ucykge1xuICAgIC8vIEZvcmNlIGl0IHRvIHVzZSB0aGUgcHJveHkgcHJvdmlkZWQgdGhyb3VnaCB0aGUgY29tbWFuZCBsaW5lLlxuICAgIC8vIE90aGVyd2lzZSwgbGV0IHRoZSBQcm94eUFnZW50IGF1dG8tZGV0ZWN0IHRoZSBwcm94eSB1c2luZyBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gICAgY29uc3QgZ2V0UHJveHlGb3JVcmwgPSBvcHRpb25zLnByb3h5QWRkcmVzcyAhPSBudWxsXG4gICAgICA/ICgpID0+IFByb21pc2UucmVzb2x2ZShvcHRpb25zLnByb3h5QWRkcmVzcyEpXG4gICAgICA6IHVuZGVmaW5lZDtcblxuICAgIHJldHVybiBuZXcgUHJveHlBZ2VudCh7XG4gICAgICBjYTogdHJ5R2V0Q0FDZXJ0KG9wdGlvbnMuY2FCdW5kbGVQYXRoKSxcbiAgICAgIGdldFByb3h5Rm9yVXJsLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGdldCB0aGUgcmVnaW9uIGZyb20gYSBudW1iZXIgb2Ygc291cmNlcyBhbmQgZmFsbHMgYmFjayB0byB1cy1lYXN0LTEgaWYgbm8gcmVnaW9uIGNhbiBiZSBmb3VuZCxcbiAgICogYXMgaXMgZG9uZSBpbiB0aGUgQVdTIENMSS5cbiAgICpcbiAgICogVGhlIG9yZGVyIG9mIHByaW9yaXR5IGlzIHRoZSBmb2xsb3dpbmc6XG4gICAqXG4gICAqIDEuIEVudmlyb25tZW50IHZhcmlhYmxlcyBzcGVjaWZ5aW5nIHJlZ2lvbiwgd2l0aCBib3RoIGFuIEFXUyBwcmVmaXggYW5kIEFNQVpPTiBwcmVmaXhcbiAgICogICAgdG8gbWFpbnRhaW4gYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIGFuZCB3aXRob3V0IGBERUZBVUxUYCBpbiB0aGUgbmFtZSBiZWNhdXNlXG4gICAqICAgIExhbWJkYSBhbmQgQ29kZUJ1aWxkIHNldCB0aGUgJEFXU19SRUdJT04gdmFyaWFibGUuXG4gICAqIDIuIFJlZ2lvbnMgbGlzdGVkIGluIHRoZSBTaGFyZWQgSW5pIEZpbGVzIC0gRmlyc3QgY2hlY2tpbmcgZm9yIHRoZSBwcm9maWxlIHByb3ZpZGVkXG4gICAqICAgIGFuZCB0aGVuIGNoZWNraW5nIGZvciB0aGUgZGVmYXVsdCBwcm9maWxlLlxuICAgKiAzLiBJTURTIGluc3RhbmNlIGlkZW50aXR5IHJlZ2lvbiBmcm9tIHRoZSBNZXRhZGF0YSBTZXJ2aWNlLlxuICAgKiA0LiB1cy1lYXN0LTFcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgcmVnaW9uKG1heWJlUHJvZmlsZT86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgZGVmYXVsdFJlZ2lvbiA9ICd1cy1lYXN0LTEnO1xuICAgIGNvbnN0IHByb2ZpbGUgPSBtYXliZVByb2ZpbGUgfHwgcHJvY2Vzcy5lbnYuQVdTX1BST0ZJTEUgfHwgcHJvY2Vzcy5lbnYuQVdTX0RFRkFVTFRfUFJPRklMRSB8fCAnZGVmYXVsdCc7XG5cbiAgICBjb25zdCByZWdpb24gPVxuICAgICAgcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fFxuICAgICAgcHJvY2Vzcy5lbnYuQU1BWk9OX1JFR0lPTiB8fFxuICAgICAgcHJvY2Vzcy5lbnYuQVdTX0RFRkFVTFRfUkVHSU9OIHx8XG4gICAgICBwcm9jZXNzLmVudi5BTUFaT05fREVGQVVMVF9SRUdJT04gfHxcbiAgICAgIChhd2FpdCBnZXRSZWdpb25Gcm9tSW5pKHByb2ZpbGUpKSB8fFxuICAgICAgKGF3YWl0IHJlZ2lvbkZyb21NZXRhZGF0YVNlcnZpY2UoKSk7XG5cbiAgICBpZiAoIXJlZ2lvbikge1xuICAgICAgY29uc3QgdXNlZFByb2ZpbGUgPSAhcHJvZmlsZSA/ICcnIDogYCAocHJvZmlsZTogXCIke3Byb2ZpbGV9XCIpYDtcbiAgICAgIGRlYnVnKFxuICAgICAgICBgVW5hYmxlIHRvIGRldGVybWluZSBBV1MgcmVnaW9uIGZyb20gZW52aXJvbm1lbnQgb3IgQVdTIGNvbmZpZ3VyYXRpb24ke3VzZWRQcm9maWxlfSwgZGVmYXVsdGluZyB0byAnJHtkZWZhdWx0UmVnaW9ufSdgLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBkZWZhdWx0UmVnaW9uO1xuICAgIH1cblxuICAgIHJldHVybiByZWdpb247XG4gIH1cbn1cblxuLyoqXG4gKiBMb29rcyB1cCB0aGUgcmVnaW9uIG9mIHRoZSBwcm92aWRlZCBwcm9maWxlLiBJZiBubyByZWdpb24gaXMgcHJlc2VudCxcbiAqIGl0IHdpbGwgYXR0ZW1wdCB0byBsb29rdXAgdGhlIGRlZmF1bHQgcmVnaW9uLlxuICogQHBhcmFtIHByb2ZpbGUgVGhlIHByb2ZpbGUgdG8gdXNlIHRvIGxvb2t1cCB0aGUgcmVnaW9uXG4gKiBAcmV0dXJucyBUaGUgcmVnaW9uIGZvciB0aGUgcHJvZmlsZSBvciBkZWZhdWx0IHByb2ZpbGUsIGlmIHByZXNlbnQuIE90aGVyd2lzZSByZXR1cm5zIHVuZGVmaW5lZC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0UmVnaW9uRnJvbUluaShwcm9maWxlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBzaGFyZWRGaWxlcyA9IGF3YWl0IGxvYWRTaGFyZWRDb25maWdGaWxlcyh7IGlnbm9yZUNhY2hlOiB0cnVlIH0pO1xuXG4gIC8vIFByaW9yaXR5OlxuICAvL1xuICAvLyBjcmVkZW50aWFscyBjb21lIGJlZm9yZSBjb25maWcgYmVjYXVzZSBhd3MtY2xpIHYxIGJlaGF2ZXMgbGlrZSB0aGF0LlxuICAvL1xuICAvLyAxLiBwcm9maWxlLXJlZ2lvbi1pbi1jcmVkZW50aWFsc1xuICAvLyAyLiBwcm9maWxlLXJlZ2lvbi1pbi1jb25maWdcbiAgLy8gMy4gZGVmYXVsdC1yZWdpb24taW4tY3JlZGVudGlhbHNcbiAgLy8gNC4gZGVmYXVsdC1yZWdpb24taW4tY29uZmlnXG5cbiAgcmV0dXJuIGdldFJlZ2lvbkZyb21JbmlGaWxlKHByb2ZpbGUsIHNoYXJlZEZpbGVzLmNyZWRlbnRpYWxzRmlsZSlcbiAgICA/PyBnZXRSZWdpb25Gcm9tSW5pRmlsZShwcm9maWxlLCBzaGFyZWRGaWxlcy5jb25maWdGaWxlKVxuICAgID8/IGdldFJlZ2lvbkZyb21JbmlGaWxlKCdkZWZhdWx0Jywgc2hhcmVkRmlsZXMuY3JlZGVudGlhbHNGaWxlKVxuICAgID8/IGdldFJlZ2lvbkZyb21JbmlGaWxlKCdkZWZhdWx0Jywgc2hhcmVkRmlsZXMuY29uZmlnRmlsZSk7XG5cbn1cblxuZnVuY3Rpb24gZ2V0UmVnaW9uRnJvbUluaUZpbGUocHJvZmlsZTogc3RyaW5nLCBkYXRhPzogYW55KSB7XG4gIHJldHVybiBkYXRhPy5bcHJvZmlsZV0/LnJlZ2lvbjtcbn1cblxuZnVuY3Rpb24gdHJ5R2V0Q0FDZXJ0KGJ1bmRsZVBhdGg/OiBzdHJpbmcpIHtcbiAgY29uc3QgcGF0aCA9IGJ1bmRsZVBhdGggfHwgY2FCdW5kbGVQYXRoRnJvbUVudmlyb25tZW50KCk7XG4gIGlmIChwYXRoKSB7XG4gICAgZGVidWcoJ1VzaW5nIENBIGJ1bmRsZSBwYXRoOiAlcycsIHBhdGgpO1xuICAgIHJldHVybiByZWFkSWZQb3NzaWJsZShwYXRoKTtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEZpbmQgYW5kIHJldHVybiBhIENBIGNlcnRpZmljYXRlIGJ1bmRsZSBwYXRoIHRvIGJlIHBhc3NlZCBpbnRvIHRoZSBTREsuXG4gKi9cbmZ1bmN0aW9uIGNhQnVuZGxlUGF0aEZyb21FbnZpcm9ubWVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAocHJvY2Vzcy5lbnYuYXdzX2NhX2J1bmRsZSkge1xuICAgIHJldHVybiBwcm9jZXNzLmVudi5hd3NfY2FfYnVuZGxlO1xuICB9XG4gIGlmIChwcm9jZXNzLmVudi5BV1NfQ0FfQlVORExFKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52LkFXU19DQV9CVU5ETEU7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBXZSB1c2VkIHRvIHN1cHBvcnQgYm90aCBBV1MgYW5kIEFNQVpPTiBwcmVmaXhlcyBmb3IgdGhlc2UgZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICpcbiAqIEFkZGluZyB0aGlzIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5LlxuICovXG5mdW5jdGlvbiBzaG91bGRQcmlvcml0aXplRW52KCkge1xuICBjb25zdCBpZCA9IHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEIHx8IHByb2Nlc3MuZW52LkFNQVpPTl9BQ0NFU1NfS0VZX0lEO1xuICBjb25zdCBrZXkgPSBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVkgfHwgcHJvY2Vzcy5lbnYuQU1BWk9OX1NFQ1JFVF9BQ0NFU1NfS0VZO1xuXG4gIGlmICghIWlkICYmICEha2V5KSB7XG4gICAgcHJvY2Vzcy5lbnYuQVdTX0FDQ0VTU19LRVlfSUQgPSBpZDtcbiAgICBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVkgPSBrZXk7XG5cbiAgICBjb25zdCBzZXNzaW9uVG9rZW4gPSBwcm9jZXNzLmVudi5BV1NfU0VTU0lPTl9UT0tFTiA/PyBwcm9jZXNzLmVudi5BTUFaT05fU0VTU0lPTl9UT0tFTjtcbiAgICBpZiAoc2Vzc2lvblRva2VuKSB7XG4gICAgICBwcm9jZXNzLmVudi5BV1NfU0VTU0lPTl9UT0tFTiA9IHNlc3Npb25Ub2tlbjtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBUaGUgTWV0YWRhdGFTZXJ2aWNlIGNsYXNzIHdpbGwgYXR0ZW1wdCB0byBmZXRjaCB0aGUgaW5zdGFuY2UgaWRlbnRpdHkgZG9jdW1lbnQgZnJvbVxuICogSU1EU3YyIGZpcnN0LCBhbmQgdGhlbiB3aWxsIGF0dGVtcHQgdjEgYXMgYSBmYWxsYmFjay5cbiAqXG4gKiBJZiB0aGlzIGZhaWxzLCB3ZSB3aWxsIHVzZSB1cy1lYXN0LTEgYXMgdGhlIHJlZ2lvbiBzbyBubyBlcnJvciBzaG91bGQgYmUgdGhyb3duLlxuICogQHJldHVybnMgVGhlIHJlZ2lvbiBmb3IgdGhlIGluc3RhbmNlIGlkZW50aXR5XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlZ2lvbkZyb21NZXRhZGF0YVNlcnZpY2UoKSB7XG4gIGRlYnVnKCdMb29raW5nIHVwIEFXUyByZWdpb24gaW4gdGhlIEVDMiBJbnN0YW5jZSBNZXRhZGF0YSBTZXJ2aWNlIChJTURTKS4nKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBtZXRhZGF0YVNlcnZpY2UgPSBuZXcgTWV0YWRhdGFTZXJ2aWNlKHtcbiAgICAgIGh0dHBPcHRpb25zOiB7XG4gICAgICAgIHRpbWVvdXQ6IDEwMDAsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXdhaXQgbWV0YWRhdGFTZXJ2aWNlLmZldGNoTWV0YWRhdGFUb2tlbigpO1xuICAgIGNvbnN0IGRvY3VtZW50ID0gYXdhaXQgbWV0YWRhdGFTZXJ2aWNlLnJlcXVlc3QoJy9sYXRlc3QvZHluYW1pYy9pbnN0YW5jZS1pZGVudGl0eS9kb2N1bWVudCcsIHt9KTtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShkb2N1bWVudCkucmVnaW9uO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZGVidWcoYFVuYWJsZSB0byByZXRyaWV2ZSBBV1MgcmVnaW9uIGZyb20gSU1EUzogJHtlfWApO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3JlZGVudGlhbENoYWluT3B0aW9ucyB7XG4gIHJlYWRvbmx5IHByb2ZpbGU/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGh0dHBPcHRpb25zPzogU2RrSHR0cE9wdGlvbnM7XG4gIHJlYWRvbmx5IGxvZ2dlcj86IExvZ2dlcjtcbn1cblxuLyoqXG4gKiBBc2sgdXNlciBmb3IgTUZBIHRva2VuIGZvciBnaXZlbiBzZXJpYWxcbiAqXG4gKiBSZXN1bHQgaXMgc2VuZCB0byBjYWxsYmFjayBmdW5jdGlvbiBmb3IgU0RLIHRvIGF1dGhvcml6ZSB0aGUgcmVxdWVzdFxuICovXG5hc3luYyBmdW5jdGlvbiB0b2tlbkNvZGVGbihzZXJpYWxBcm46IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGRlYnVnKCdSZXF1aXJlIE1GQSB0b2tlbiBmb3Igc2VyaWFsIEFSTicsIHNlcmlhbEFybik7XG4gIHRyeSB7XG4gICAgY29uc3QgdG9rZW46IHN0cmluZyA9IGF3YWl0IHByb21wdGx5LnByb21wdChgTUZBIHRva2VuIGZvciAke3NlcmlhbEFybn06IGAsIHtcbiAgICAgIHRyaW06IHRydWUsXG4gICAgICBkZWZhdWx0OiAnJyxcbiAgICB9KTtcbiAgICBkZWJ1ZygnU3VjY2Vzc2Z1bGx5IGdvdCBNRkEgdG9rZW4gZnJvbSB1c2VyJyk7XG4gICAgcmV0dXJuIHRva2VuO1xuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGRlYnVnKCdGYWlsZWQgdG8gZ2V0IE1GQSB0b2tlbicsIGVycik7XG4gICAgY29uc3QgZSA9IG5ldyBBdXRoZW50aWNhdGlvbkVycm9yKGBFcnJvciBmZXRjaGluZyBNRkEgdG9rZW46ICR7ZXJyLm1lc3NhZ2UgPz8gZXJyfWApO1xuICAgIGUubmFtZSA9ICdTaGFyZWRJbmlGaWxlQ3JlZGVudGlhbHNQcm92aWRlckZhaWx1cmUnO1xuICAgIHRocm93IGU7XG4gIH1cbn1cbiJdfQ==