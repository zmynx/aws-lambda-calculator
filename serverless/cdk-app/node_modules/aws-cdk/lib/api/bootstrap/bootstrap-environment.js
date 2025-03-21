"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bootstrapper = void 0;
const console_1 = require("console");
const path = require("path");
const deploy_bootstrap_1 = require("./deploy-bootstrap");
const legacy_template_1 = require("./legacy-template");
const logging_1 = require("../../logging");
const serialize_1 = require("../../serialize");
const error_1 = require("../../toolkit/error");
const directories_1 = require("../../util/directories");
const mode_1 = require("../plugin/mode");
class Bootstrapper {
    constructor(source = { source: 'default' }) {
        this.source = source;
    }
    bootstrapEnvironment(environment, sdkProvider, options = {}) {
        switch (this.source.source) {
            case 'legacy':
                return this.legacyBootstrap(environment, sdkProvider, options);
            case 'default':
                return this.modernBootstrap(environment, sdkProvider, options);
            case 'custom':
                return this.customBootstrap(environment, sdkProvider, options);
        }
    }
    async showTemplate(json) {
        const template = await this.loadTemplate();
        process.stdout.write(`${(0, serialize_1.serializeStructure)(template, json)}\n`);
    }
    /**
     * Deploy legacy bootstrap stack
     *
     */
    async legacyBootstrap(environment, sdkProvider, options = {}) {
        const params = options.parameters ?? {};
        if (params.trustedAccounts?.length) {
            throw new error_1.ToolkitError('--trust can only be passed for the modern bootstrap experience.');
        }
        if (params.cloudFormationExecutionPolicies?.length) {
            throw new error_1.ToolkitError('--cloudformation-execution-policies can only be passed for the modern bootstrap experience.');
        }
        if (params.createCustomerMasterKey !== undefined) {
            throw new error_1.ToolkitError('--bootstrap-customer-key can only be passed for the modern bootstrap experience.');
        }
        if (params.qualifier) {
            throw new error_1.ToolkitError('--qualifier can only be passed for the modern bootstrap experience.');
        }
        const current = await deploy_bootstrap_1.BootstrapStack.lookup(sdkProvider, environment, options.toolkitStackName);
        return current.update(await this.loadTemplate(params), {}, {
            ...options,
            terminationProtection: options.terminationProtection ?? current.terminationProtection,
        });
    }
    /**
     * Deploy CI/CD-ready bootstrap stack from template
     *
     */
    async modernBootstrap(environment, sdkProvider, options = {}) {
        const params = options.parameters ?? {};
        const bootstrapTemplate = await this.loadTemplate();
        const current = await deploy_bootstrap_1.BootstrapStack.lookup(sdkProvider, environment, options.toolkitStackName);
        const partition = await current.partition();
        if (params.createCustomerMasterKey !== undefined && params.kmsKeyId) {
            throw new error_1.ToolkitError("You cannot pass '--bootstrap-kms-key-id' and '--bootstrap-customer-key' together. Specify one or the other");
        }
        // If people re-bootstrap, existing parameter values are reused so that people don't accidentally change the configuration
        // on their bootstrap stack (this happens automatically in deployStack). However, to do proper validation on the
        // combined arguments (such that if --trust has been given, --cloudformation-execution-policies is necessary as well)
        // we need to take this parameter reuse into account.
        //
        // Ideally we'd do this inside the template, but the `Rules` section of CFN
        // templates doesn't seem to be able to express the conditions that we need
        // (can't use Fn::Join or reference Conditions) so we do it here instead.
        const trustedAccounts = params.trustedAccounts ?? splitCfnArray(current.parameters.TrustedAccounts);
        (0, console_1.info)(`Trusted accounts for deployment: ${trustedAccounts.length > 0 ? trustedAccounts.join(', ') : '(none)'}`);
        const trustedAccountsForLookup = params.trustedAccountsForLookup ?? splitCfnArray(current.parameters.TrustedAccountsForLookup);
        (0, console_1.info)(`Trusted accounts for lookup: ${trustedAccountsForLookup.length > 0 ? trustedAccountsForLookup.join(', ') : '(none)'}`);
        const cloudFormationExecutionPolicies = params.cloudFormationExecutionPolicies ?? splitCfnArray(current.parameters.CloudFormationExecutionPolicies);
        if (trustedAccounts.length === 0 && cloudFormationExecutionPolicies.length === 0) {
            // For self-trust it's okay to default to AdministratorAccess, and it improves the usability of bootstrapping a lot.
            //
            // We don't actually make the implicitly policy a physical parameter. The template will infer it instead,
            // we simply do the UI advertising that behavior here.
            //
            // If we DID make it an explicit parameter, we wouldn't be able to tell the difference between whether
            // we inferred it or whether the user told us, and the sequence:
            //
            // $ cdk bootstrap
            // $ cdk bootstrap --trust 1234
            //
            // Would leave AdministratorAccess policies with a trust relationship, without the user explicitly
            // approving the trust policy.
            const implicitPolicy = `arn:${partition}:iam::aws:policy/AdministratorAccess`;
            (0, logging_1.warning)(`Using default execution policy of '${implicitPolicy}'. Pass '--cloudformation-execution-policies' to customize.`);
        }
        else if (cloudFormationExecutionPolicies.length === 0) {
            throw new error_1.ToolkitError(`Please pass \'--cloudformation-execution-policies\' when using \'--trust\' to specify deployment permissions. Try a managed policy of the form \'arn:${partition}:iam::aws:policy/<PolicyName>\'.`);
        }
        else {
            // Remind people what the current settings are
            (0, console_1.info)(`Execution policies: ${cloudFormationExecutionPolicies.join(', ')}`);
        }
        // * If an ARN is given, that ARN. Otherwise:
        //   * '-' if customerKey = false
        //   * '' if customerKey = true
        //   * if customerKey is also not given
        //     * undefined if we already had a value in place (reusing what we had)
        //     * '-' if this is the first time we're deploying this stack (or upgrading from old to new bootstrap)
        const currentKmsKeyId = current.parameters.FileAssetsBucketKmsKeyId;
        const kmsKeyId = params.kmsKeyId ??
            (params.createCustomerMasterKey === true
                ? CREATE_NEW_KEY
                : params.createCustomerMasterKey === false || currentKmsKeyId === undefined
                    ? USE_AWS_MANAGED_KEY
                    : undefined);
        /* A permissions boundary can be provided via:
         *    - the flag indicating the example one should be used
         *    - the name indicating the custom permissions boundary to be used
         * Re-bootstrapping will NOT be blocked by either tightening or relaxing the permissions' boundary.
         */
        // InputPermissionsBoundary is an `any` type and if it is not defined it
        // appears as an empty string ''. We need to force it to evaluate an empty string
        // as undefined
        const currentPermissionsBoundary = current.parameters.InputPermissionsBoundary || undefined;
        const inputPolicyName = params.examplePermissionsBoundary
            ? CDK_BOOTSTRAP_PERMISSIONS_BOUNDARY
            : params.customPermissionsBoundary;
        let policyName;
        if (inputPolicyName) {
            // If the example policy is not already in place, it must be created.
            const sdk = (await sdkProvider.forEnvironment(environment, mode_1.Mode.ForWriting)).sdk;
            policyName = await this.getPolicyName(environment, sdk, inputPolicyName, partition, params);
        }
        if (currentPermissionsBoundary !== policyName) {
            if (!currentPermissionsBoundary) {
                (0, logging_1.warning)(`Adding new permissions boundary ${policyName}`);
            }
            else if (!policyName) {
                (0, logging_1.warning)(`Removing existing permissions boundary ${currentPermissionsBoundary}`);
            }
            else {
                (0, logging_1.warning)(`Changing permissions boundary from ${currentPermissionsBoundary} to ${policyName}`);
            }
        }
        return current.update(bootstrapTemplate, {
            FileAssetsBucketName: params.bucketName,
            FileAssetsBucketKmsKeyId: kmsKeyId,
            // Empty array becomes empty string
            TrustedAccounts: trustedAccounts.join(','),
            TrustedAccountsForLookup: trustedAccountsForLookup.join(','),
            CloudFormationExecutionPolicies: cloudFormationExecutionPolicies.join(','),
            Qualifier: params.qualifier,
            PublicAccessBlockConfiguration: params.publicAccessBlockConfiguration || params.publicAccessBlockConfiguration === undefined
                ? 'true'
                : 'false',
            InputPermissionsBoundary: policyName,
        }, {
            ...options,
            terminationProtection: options.terminationProtection ?? current.terminationProtection,
        });
    }
    async getPolicyName(environment, sdk, permissionsBoundary, partition, params) {
        if (permissionsBoundary !== CDK_BOOTSTRAP_PERMISSIONS_BOUNDARY) {
            this.validatePolicyName(permissionsBoundary);
            return Promise.resolve(permissionsBoundary);
        }
        // if no Qualifier is supplied, resort to the default one
        const arn = await this.getExamplePermissionsBoundary(params.qualifier ?? 'hnb659fds', partition, environment.account, sdk);
        const policyName = arn.split('/').pop();
        if (!policyName) {
            throw new error_1.ToolkitError('Could not retrieve the example permission boundary!');
        }
        return Promise.resolve(policyName);
    }
    async getExamplePermissionsBoundary(qualifier, partition, account, sdk) {
        const iam = sdk.iam();
        let policyName = `cdk-${qualifier}-permissions-boundary`;
        const arn = `arn:${partition}:iam::${account}:policy/${policyName}`;
        try {
            let getPolicyResp = await iam.getPolicy({ PolicyArn: arn });
            if (getPolicyResp.Policy) {
                return arn;
            }
        }
        catch (e) {
            // https://docs.aws.amazon.com/IAM/latest/APIReference/API_GetPolicy.html#API_GetPolicy_Errors
            if (e.name === 'NoSuchEntity') {
                //noop, proceed with creating the policy
            }
            else {
                throw e;
            }
        }
        const policyDoc = {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: ['*'],
                    Resource: '*',
                    Effect: 'Allow',
                    Sid: 'ExplicitAllowAll',
                },
                {
                    Condition: {
                        StringEquals: {
                            'iam:PermissionsBoundary': `arn:${partition}:iam::${account}:policy/cdk-${qualifier}-permissions-boundary`,
                        },
                    },
                    Action: [
                        'iam:CreateUser',
                        'iam:CreateRole',
                        'iam:PutRolePermissionsBoundary',
                        'iam:PutUserPermissionsBoundary',
                    ],
                    Resource: '*',
                    Effect: 'Allow',
                    Sid: 'DenyAccessIfRequiredPermBoundaryIsNotBeingApplied',
                },
                {
                    Action: [
                        'iam:CreatePolicyVersion',
                        'iam:DeletePolicy',
                        'iam:DeletePolicyVersion',
                        'iam:SetDefaultPolicyVersion',
                    ],
                    Resource: `arn:${partition}:iam::${account}:policy/cdk-${qualifier}-permissions-boundary`,
                    Effect: 'Deny',
                    Sid: 'DenyPermBoundaryIAMPolicyAlteration',
                },
                {
                    Action: ['iam:DeleteUserPermissionsBoundary', 'iam:DeleteRolePermissionsBoundary'],
                    Resource: '*',
                    Effect: 'Deny',
                    Sid: 'DenyRemovalOfPermBoundaryFromAnyUserOrRole',
                },
            ],
        };
        const request = {
            PolicyName: policyName,
            PolicyDocument: JSON.stringify(policyDoc),
        };
        const createPolicyResponse = await iam.createPolicy(request);
        if (createPolicyResponse.Policy?.Arn) {
            return createPolicyResponse.Policy.Arn;
        }
        else {
            throw new error_1.ToolkitError(`Could not retrieve the example permission boundary ${arn}!`);
        }
    }
    validatePolicyName(permissionsBoundary) {
        // https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreatePolicy.html
        // Added support for policy names with a path
        // See https://github.com/aws/aws-cdk/issues/26320
        const regexp = /[\w+\/=,.@-]+/;
        const matches = regexp.exec(permissionsBoundary);
        if (!(matches && matches.length === 1 && matches[0] === permissionsBoundary)) {
            throw new error_1.ToolkitError(`The permissions boundary name ${permissionsBoundary} does not match the IAM conventions.`);
        }
    }
    async customBootstrap(environment, sdkProvider, options = {}) {
        // Look at the template, decide whether it's most likely a legacy or modern bootstrap
        // template, and use the right bootstrapper for that.
        const version = (0, deploy_bootstrap_1.bootstrapVersionFromTemplate)(await this.loadTemplate());
        if (version === 0) {
            return this.legacyBootstrap(environment, sdkProvider, options);
        }
        else {
            return this.modernBootstrap(environment, sdkProvider, options);
        }
    }
    async loadTemplate(params = {}) {
        switch (this.source.source) {
            case 'custom':
                return (0, serialize_1.loadStructuredFile)(this.source.templateFile);
            case 'default':
                return (0, serialize_1.loadStructuredFile)(path.join((0, directories_1.rootDir)(), 'lib', 'api', 'bootstrap', 'bootstrap-template.yaml'));
            case 'legacy':
                return (0, legacy_template_1.legacyBootstrapTemplate)(params);
        }
    }
}
exports.Bootstrapper = Bootstrapper;
/**
 * Magic parameter value that will cause the bootstrap-template.yml to NOT create a CMK but use the default key
 */
const USE_AWS_MANAGED_KEY = 'AWS_MANAGED_KEY';
/**
 * Magic parameter value that will cause the bootstrap-template.yml to create a CMK
 */
const CREATE_NEW_KEY = '';
/**
 * Parameter value indicating the use of the default, CDK provided permissions boundary for bootstrap-template.yml
 */
const CDK_BOOTSTRAP_PERMISSIONS_BOUNDARY = 'CDK_BOOTSTRAP_PERMISSIONS_BOUNDARY';
/**
 * Split an array-like CloudFormation parameter on ,
 *
 * An empty string is the empty array (instead of `['']`).
 */
function splitCfnArray(xs) {
    if (xs === '' || xs === undefined) {
        return [];
    }
    return xs.split(',');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLWVudmlyb25tZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdHN0cmFwLWVudmlyb25tZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUErQjtBQUMvQiw2QkFBNkI7QUFHN0IseURBQWtGO0FBQ2xGLHVEQUE0RDtBQUM1RCwyQ0FBd0M7QUFDeEMsK0NBQXlFO0FBQ3pFLCtDQUFtRDtBQUNuRCx3REFBaUQ7QUFHakQseUNBQXNDO0FBSXRDLE1BQWEsWUFBWTtJQUN2QixZQUE2QixTQUEwQixFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7UUFBL0MsV0FBTSxHQUFOLE1BQU0sQ0FBeUM7SUFBRyxDQUFDO0lBRXpFLG9CQUFvQixDQUN6QixXQUE4QixFQUM5QixXQUF3QixFQUN4QixVQUF1QyxFQUFFO1FBRXpDLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMzQixLQUFLLFFBQVE7Z0JBQ1gsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDakUsS0FBSyxTQUFTO2dCQUNaLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2pFLEtBQUssUUFBUTtnQkFDWCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNuRSxDQUFDO0lBQ0gsQ0FBQztJQUVNLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBYTtRQUNyQyxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUMzQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUEsOEJBQWtCLEVBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQ7OztP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QUN0RCxLQUFLLFNBQVM7Z0JBQ1osT0FBTyxJQUFBLDhCQUFrQixFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBQSxxQkFBTyxHQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1lBQ3hHLEtBQUssUUFBUTtnQkFDWCxPQUFPLElBQUEseUNBQXVCLEVBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7Q0FDRjtBQS9VRCxvQ0ErVUM7QUFFRDs7R0FFRztBQUNILE1BQU0sbUJBQW1CLEdBQUcsaUJBQWlCLENBQUM7QUFFOUM7O0dBRUc7QUFDSCxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUM7QUFDMUI7O0dBRUc7QUFDSCxNQUFNLGtDQUFrQyxHQUFHLG9DQUFvQyxDQUFDO0FBRWhGOzs7O0dBSUc7QUFDSCxTQUFTLGFBQWEsQ0FBQyxFQUFzQjtJQUMzQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUNELE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaW5mbyB9IGZyb20gJ2NvbnNvbGUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgdHlwZSB7IEJvb3RzdHJhcEVudmlyb25tZW50T3B0aW9ucywgQm9vdHN0cmFwcGluZ1BhcmFtZXRlcnMgfSBmcm9tICcuL2Jvb3RzdHJhcC1wcm9wcyc7XG5pbXBvcnQgeyBCb290c3RyYXBTdGFjaywgYm9vdHN0cmFwVmVyc2lvbkZyb21UZW1wbGF0ZSB9IGZyb20gJy4vZGVwbG95LWJvb3RzdHJhcCc7XG5pbXBvcnQgeyBsZWdhY3lCb290c3RyYXBUZW1wbGF0ZSB9IGZyb20gJy4vbGVnYWN5LXRlbXBsYXRlJztcbmltcG9ydCB7IHdhcm5pbmcgfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcbmltcG9ydCB7IGxvYWRTdHJ1Y3R1cmVkRmlsZSwgc2VyaWFsaXplU3RydWN0dXJlIH0gZnJvbSAnLi4vLi4vc2VyaWFsaXplJztcbmltcG9ydCB7IFRvb2xraXRFcnJvciB9IGZyb20gJy4uLy4uL3Rvb2xraXQvZXJyb3InO1xuaW1wb3J0IHsgcm9vdERpciB9IGZyb20gJy4uLy4uL3V0aWwvZGlyZWN0b3JpZXMnO1xuaW1wb3J0IHR5cGUgeyBTREssIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuaW1wb3J0IHR5cGUgeyBTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQgfSBmcm9tICcuLi9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHsgTW9kZSB9IGZyb20gJy4uL3BsdWdpbi9tb2RlJztcblxuZXhwb3J0IHR5cGUgQm9vdHN0cmFwU291cmNlID0geyBzb3VyY2U6ICdsZWdhY3knIH0gfCB7IHNvdXJjZTogJ2RlZmF1bHQnIH0gfCB7IHNvdXJjZTogJ2N1c3RvbSc7IHRlbXBsYXRlRmlsZTogc3RyaW5nIH07XG5cbmV4cG9ydCBjbGFzcyBCb290c3RyYXBwZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHNvdXJjZTogQm9vdHN0cmFwU291cmNlID0geyBzb3VyY2U6ICdkZWZhdWx0JyB9KSB7fVxuXG4gIHB1YmxpYyBib290c3RyYXBFbnZpcm9ubWVudChcbiAgICBlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsXG4gICAgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLFxuICAgIG9wdGlvbnM6IEJvb3RzdHJhcEVudmlyb25tZW50T3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFN1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdD4ge1xuICAgIHN3aXRjaCAodGhpcy5zb3VyY2Uuc291cmNlKSB7XG4gICAgICBjYXNlICdsZWdhY3knOlxuICAgICAgICByZXR1cm4gdGhpcy5sZWdhY3lCb290c3RyYXAoZW52aXJvbm1lbnQsIHNka1Byb3ZpZGVyLCBvcHRpb25zKTtcbiAgICAgIGNhc2UgJ2RlZmF1bHQnOlxuICAgICAgICByZXR1cm4gdGhpcy5tb2Rlcm5Cb290c3RyYXAoZW52aXJvbm1lbnQsIHNka1Byb3ZpZGVyLCBvcHRpb25zKTtcbiAgICAgIGNhc2UgJ2N1c3RvbSc6XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbUJvb3RzdHJhcChlbnZpcm9ubWVudCwgc2RrUHJvdmlkZXIsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzaG93VGVtcGxhdGUoanNvbjogYm9vbGVhbikge1xuICAgIGNvbnN0IHRlbXBsYXRlID0gYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGUoKTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgJHtzZXJpYWxpemVTdHJ1Y3R1cmUodGVtcGxhdGUsIGpzb24pfVxcbmApO1xuICB9XG5cbiAgLyoqXG4gICAqIERlcGxveSBsZWdhY3kgYm9vdHN0cmFwIHN0YWNrXG4gICAqXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxlZ2FjeUJvb3RzdHJhcChcbiAgICBlbnZpcm9ubWVudDogY3hhcGkuRW52aXJvbm1lbnQsXG4gICAgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLFxuICAgIG9wdGlvbnM6IEJvb3RzdHJhcEVudmlyb25tZW50T3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFN1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdD4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG9wdGlvbnMucGFyYW1ldGVycyA/PyB7fTtcblxuICAgIGlmIChwYXJhbXMudHJ1c3RlZEFjY291bnRzPy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoJy0tdHJ1c3QgY2FuIG9ubHkgYmUgcGFzc2VkIGZvciB0aGUgbW9kZXJuIGJvb3RzdHJhcCBleHBlcmllbmNlLicpO1xuICAgIH1cbiAgICBpZiAocGFyYW1zLmNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM/Lmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IFRvb2xraXRFcnJvcignLS1jbG91ZGZvcm1hdGlvbi1leGVjdXRpb24tcG9saWNpZXMgY2FuIG9ubHkgYmUgcGFzc2VkIGZvciB0aGUgbW9kZXJuIGJvb3RzdHJhcCBleHBlcmllbmNlLicpO1xuICAgIH1cbiAgICBpZiAocGFyYW1zLmNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoJy0tYm9vdHN0cmFwLWN1c3RvbWVyLWtleSBjYW4gb25seSBiZSBwYXNzZWQgZm9yIHRoZSBtb2Rlcm4gYm9vdHN0cmFwIGV4cGVyaWVuY2UuJyk7XG4gICAgfVxuICAgIGlmIChwYXJhbXMucXVhbGlmaWVyKSB7XG4gICAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKCctLXF1YWxpZmllciBjYW4gb25seSBiZSBwYXNzZWQgZm9yIHRoZSBtb2Rlcm4gYm9vdHN0cmFwIGV4cGVyaWVuY2UuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudCA9IGF3YWl0IEJvb3RzdHJhcFN0YWNrLmxvb2t1cChzZGtQcm92aWRlciwgZW52aXJvbm1lbnQsIG9wdGlvbnMudG9vbGtpdFN0YWNrTmFtZSk7XG4gICAgcmV0dXJuIGN1cnJlbnQudXBkYXRlKFxuICAgICAgYXdhaXQgdGhpcy5sb2FkVGVtcGxhdGUocGFyYW1zKSxcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IG9wdGlvbnMudGVybWluYXRpb25Qcm90ZWN0aW9uID8/IGN1cnJlbnQudGVybWluYXRpb25Qcm90ZWN0aW9uLFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIERlcGxveSBDSS9DRC1yZWFkeSBib290c3RyYXAgc3RhY2sgZnJvbSB0ZW1wbGF0ZVxuICAgKlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBtb2Rlcm5Cb290c3RyYXAoXG4gICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50LFxuICAgIHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcixcbiAgICBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQ+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBvcHRpb25zLnBhcmFtZXRlcnMgPz8ge307XG5cbiAgICBjb25zdCBib290c3RyYXBUZW1wbGF0ZSA9IGF3YWl0IHRoaXMubG9hZFRlbXBsYXRlKCk7XG5cbiAgICBjb25zdCBjdXJyZW50ID0gYXdhaXQgQm9vdHN0cmFwU3RhY2subG9va3VwKHNka1Byb3ZpZGVyLCBlbnZpcm9ubWVudCwgb3B0aW9ucy50b29sa2l0U3RhY2tOYW1lKTtcbiAgICBjb25zdCBwYXJ0aXRpb24gPSBhd2FpdCBjdXJyZW50LnBhcnRpdGlvbigpO1xuXG4gICAgaWYgKHBhcmFtcy5jcmVhdGVDdXN0b21lck1hc3RlcktleSAhPT0gdW5kZWZpbmVkICYmIHBhcmFtcy5rbXNLZXlJZCkge1xuICAgICAgdGhyb3cgbmV3IFRvb2xraXRFcnJvcihcbiAgICAgICAgXCJZb3UgY2Fubm90IHBhc3MgJy0tYm9vdHN0cmFwLWttcy1rZXktaWQnIGFuZCAnLS1ib290c3RyYXAtY3VzdG9tZXIta2V5JyB0b2dldGhlci4gU3BlY2lmeSBvbmUgb3IgdGhlIG90aGVyXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIElmIHBlb3BsZSByZS1ib290c3RyYXAsIGV4aXN0aW5nIHBhcmFtZXRlciB2YWx1ZXMgYXJlIHJldXNlZCBzbyB0aGF0IHBlb3BsZSBkb24ndCBhY2NpZGVudGFsbHkgY2hhbmdlIHRoZSBjb25maWd1cmF0aW9uXG4gICAgLy8gb24gdGhlaXIgYm9vdHN0cmFwIHN0YWNrICh0aGlzIGhhcHBlbnMgYXV0b21hdGljYWxseSBpbiBkZXBsb3lTdGFjaykuIEhvd2V2ZXIsIHRvIGRvIHByb3BlciB2YWxpZGF0aW9uIG9uIHRoZVxuICAgIC8vIGNvbWJpbmVkIGFyZ3VtZW50cyAoc3VjaCB0aGF0IGlmIC0tdHJ1c3QgaGFzIGJlZW4gZ2l2ZW4sIC0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzIGlzIG5lY2Vzc2FyeSBhcyB3ZWxsKVxuICAgIC8vIHdlIG5lZWQgdG8gdGFrZSB0aGlzIHBhcmFtZXRlciByZXVzZSBpbnRvIGFjY291bnQuXG4gICAgLy9cbiAgICAvLyBJZGVhbGx5IHdlJ2QgZG8gdGhpcyBpbnNpZGUgdGhlIHRlbXBsYXRlLCBidXQgdGhlIGBSdWxlc2Agc2VjdGlvbiBvZiBDRk5cbiAgICAvLyB0ZW1wbGF0ZXMgZG9lc24ndCBzZWVtIHRvIGJlIGFibGUgdG8gZXhwcmVzcyB0aGUgY29uZGl0aW9ucyB0aGF0IHdlIG5lZWRcbiAgICAvLyAoY2FuJ3QgdXNlIEZuOjpKb2luIG9yIHJlZmVyZW5jZSBDb25kaXRpb25zKSBzbyB3ZSBkbyBpdCBoZXJlIGluc3RlYWQuXG4gICAgY29uc3QgdHJ1c3RlZEFjY291bnRzID0gcGFyYW1zLnRydXN0ZWRBY2NvdW50cyA/PyBzcGxpdENmbkFycmF5KGN1cnJlbnQucGFyYW1ldGVycy5UcnVzdGVkQWNjb3VudHMpO1xuICAgIGluZm8oYFRydXN0ZWQgYWNjb3VudHMgZm9yIGRlcGxveW1lbnQ6ICR7dHJ1c3RlZEFjY291bnRzLmxlbmd0aCA+IDAgPyB0cnVzdGVkQWNjb3VudHMuam9pbignLCAnKSA6ICcobm9uZSknfWApO1xuXG4gICAgY29uc3QgdHJ1c3RlZEFjY291bnRzRm9yTG9va3VwID1cbiAgICAgIHBhcmFtcy50cnVzdGVkQWNjb3VudHNGb3JMb29rdXAgPz8gc3BsaXRDZm5BcnJheShjdXJyZW50LnBhcmFtZXRlcnMuVHJ1c3RlZEFjY291bnRzRm9yTG9va3VwKTtcbiAgICBpbmZvKFxuICAgICAgYFRydXN0ZWQgYWNjb3VudHMgZm9yIGxvb2t1cDogJHt0cnVzdGVkQWNjb3VudHNGb3JMb29rdXAubGVuZ3RoID4gMCA/IHRydXN0ZWRBY2NvdW50c0Zvckxvb2t1cC5qb2luKCcsICcpIDogJyhub25lKSd9YCxcbiAgICApO1xuXG4gICAgY29uc3QgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llcyA9XG4gICAgICBwYXJhbXMuY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llcyA/PyBzcGxpdENmbkFycmF5KGN1cnJlbnQucGFyYW1ldGVycy5DbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzKTtcbiAgICBpZiAodHJ1c3RlZEFjY291bnRzLmxlbmd0aCA9PT0gMCAmJiBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gRm9yIHNlbGYtdHJ1c3QgaXQncyBva2F5IHRvIGRlZmF1bHQgdG8gQWRtaW5pc3RyYXRvckFjY2VzcywgYW5kIGl0IGltcHJvdmVzIHRoZSB1c2FiaWxpdHkgb2YgYm9vdHN0cmFwcGluZyBhIGxvdC5cbiAgICAgIC8vXG4gICAgICAvLyBXZSBkb24ndCBhY3R1YWxseSBtYWtlIHRoZSBpbXBsaWNpdGx5IHBvbGljeSBhIHBoeXNpY2FsIHBhcmFtZXRlci4gVGhlIHRlbXBsYXRlIHdpbGwgaW5mZXIgaXQgaW5zdGVhZCxcbiAgICAgIC8vIHdlIHNpbXBseSBkbyB0aGUgVUkgYWR2ZXJ0aXNpbmcgdGhhdCBiZWhhdmlvciBoZXJlLlxuICAgICAgLy9cbiAgICAgIC8vIElmIHdlIERJRCBtYWtlIGl0IGFuIGV4cGxpY2l0IHBhcmFtZXRlciwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byB0ZWxsIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gd2hldGhlclxuICAgICAgLy8gd2UgaW5mZXJyZWQgaXQgb3Igd2hldGhlciB0aGUgdXNlciB0b2xkIHVzLCBhbmQgdGhlIHNlcXVlbmNlOlxuICAgICAgLy9cbiAgICAgIC8vICQgY2RrIGJvb3RzdHJhcFxuICAgICAgLy8gJCBjZGsgYm9vdHN0cmFwIC0tdHJ1c3QgMTIzNFxuICAgICAgLy9cbiAgICAgIC8vIFdvdWxkIGxlYXZlIEFkbWluaXN0cmF0b3JBY2Nlc3MgcG9saWNpZXMgd2l0aCBhIHRydXN0IHJlbGF0aW9uc2hpcCwgd2l0aG91dCB0aGUgdXNlciBleHBsaWNpdGx5XG4gICAgICAvLyBhcHByb3ZpbmcgdGhlIHRydXN0IHBvbGljeS5cbiAgICAgIGNvbnN0IGltcGxpY2l0UG9saWN5ID0gYGFybjoke3BhcnRpdGlvbn06aWFtOjphd3M6cG9saWN5L0FkbWluaXN0cmF0b3JBY2Nlc3NgO1xuICAgICAgd2FybmluZyhcbiAgICAgICAgYFVzaW5nIGRlZmF1bHQgZXhlY3V0aW9uIHBvbGljeSBvZiAnJHtpbXBsaWNpdFBvbGljeX0nLiBQYXNzICctLWNsb3VkZm9ybWF0aW9uLWV4ZWN1dGlvbi1wb2xpY2llcycgdG8gY3VzdG9taXplLmAsXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoXG4gICAgICAgIGBQbGVhc2UgcGFzcyBcXCctLWNsb3VkZm9ybWF0aW9uLWV4ZWN1dGlvbi1wb2xpY2llc1xcJyB3aGVuIHVzaW5nIFxcJy0tdHJ1c3RcXCcgdG8gc3BlY2lmeSBkZXBsb3ltZW50IHBlcm1pc3Npb25zLiBUcnkgYSBtYW5hZ2VkIHBvbGljeSBvZiB0aGUgZm9ybSBcXCdhcm46JHtwYXJ0aXRpb259OmlhbTo6YXdzOnBvbGljeS88UG9saWN5TmFtZT5cXCcuYCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlbWluZCBwZW9wbGUgd2hhdCB0aGUgY3VycmVudCBzZXR0aW5ncyBhcmVcbiAgICAgIGluZm8oYEV4ZWN1dGlvbiBwb2xpY2llczogJHtjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgLy8gKiBJZiBhbiBBUk4gaXMgZ2l2ZW4sIHRoYXQgQVJOLiBPdGhlcndpc2U6XG4gICAgLy8gICAqICctJyBpZiBjdXN0b21lcktleSA9IGZhbHNlXG4gICAgLy8gICAqICcnIGlmIGN1c3RvbWVyS2V5ID0gdHJ1ZVxuICAgIC8vICAgKiBpZiBjdXN0b21lcktleSBpcyBhbHNvIG5vdCBnaXZlblxuICAgIC8vICAgICAqIHVuZGVmaW5lZCBpZiB3ZSBhbHJlYWR5IGhhZCBhIHZhbHVlIGluIHBsYWNlIChyZXVzaW5nIHdoYXQgd2UgaGFkKVxuICAgIC8vICAgICAqICctJyBpZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lIHdlJ3JlIGRlcGxveWluZyB0aGlzIHN0YWNrIChvciB1cGdyYWRpbmcgZnJvbSBvbGQgdG8gbmV3IGJvb3RzdHJhcClcbiAgICBjb25zdCBjdXJyZW50S21zS2V5SWQgPSBjdXJyZW50LnBhcmFtZXRlcnMuRmlsZUFzc2V0c0J1Y2tldEttc0tleUlkO1xuICAgIGNvbnN0IGttc0tleUlkID1cbiAgICAgIHBhcmFtcy5rbXNLZXlJZCA/P1xuICAgICAgKHBhcmFtcy5jcmVhdGVDdXN0b21lck1hc3RlcktleSA9PT0gdHJ1ZVxuICAgICAgICA/IENSRUFURV9ORVdfS0VZXG4gICAgICAgIDogcGFyYW1zLmNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5ID09PSBmYWxzZSB8fCBjdXJyZW50S21zS2V5SWQgPT09IHVuZGVmaW5lZFxuICAgICAgICAgID8gVVNFX0FXU19NQU5BR0VEX0tFWVxuICAgICAgICAgIDogdW5kZWZpbmVkKTtcblxuICAgIC8qIEEgcGVybWlzc2lvbnMgYm91bmRhcnkgY2FuIGJlIHByb3ZpZGVkIHZpYTpcbiAgICAgKiAgICAtIHRoZSBmbGFnIGluZGljYXRpbmcgdGhlIGV4YW1wbGUgb25lIHNob3VsZCBiZSB1c2VkXG4gICAgICogICAgLSB0aGUgbmFtZSBpbmRpY2F0aW5nIHRoZSBjdXN0b20gcGVybWlzc2lvbnMgYm91bmRhcnkgdG8gYmUgdXNlZFxuICAgICAqIFJlLWJvb3RzdHJhcHBpbmcgd2lsbCBOT1QgYmUgYmxvY2tlZCBieSBlaXRoZXIgdGlnaHRlbmluZyBvciByZWxheGluZyB0aGUgcGVybWlzc2lvbnMnIGJvdW5kYXJ5LlxuICAgICAqL1xuXG4gICAgLy8gSW5wdXRQZXJtaXNzaW9uc0JvdW5kYXJ5IGlzIGFuIGBhbnlgIHR5cGUgYW5kIGlmIGl0IGlzIG5vdCBkZWZpbmVkIGl0XG4gICAgLy8gYXBwZWFycyBhcyBhbiBlbXB0eSBzdHJpbmcgJycuIFdlIG5lZWQgdG8gZm9yY2UgaXQgdG8gZXZhbHVhdGUgYW4gZW1wdHkgc3RyaW5nXG4gICAgLy8gYXMgdW5kZWZpbmVkXG4gICAgY29uc3QgY3VycmVudFBlcm1pc3Npb25zQm91bmRhcnk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGN1cnJlbnQucGFyYW1ldGVycy5JbnB1dFBlcm1pc3Npb25zQm91bmRhcnkgfHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGlucHV0UG9saWN5TmFtZSA9IHBhcmFtcy5leGFtcGxlUGVybWlzc2lvbnNCb3VuZGFyeVxuICAgICAgPyBDREtfQk9PVFNUUkFQX1BFUk1JU1NJT05TX0JPVU5EQVJZXG4gICAgICA6IHBhcmFtcy5jdXN0b21QZXJtaXNzaW9uc0JvdW5kYXJ5O1xuICAgIGxldCBwb2xpY3lOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGlucHV0UG9saWN5TmFtZSkge1xuICAgICAgLy8gSWYgdGhlIGV4YW1wbGUgcG9saWN5IGlzIG5vdCBhbHJlYWR5IGluIHBsYWNlLCBpdCBtdXN0IGJlIGNyZWF0ZWQuXG4gICAgICBjb25zdCBzZGsgPSAoYXdhaXQgc2RrUHJvdmlkZXIuZm9yRW52aXJvbm1lbnQoZW52aXJvbm1lbnQsIE1vZGUuRm9yV3JpdGluZykpLnNkaztcbiAgICAgIHBvbGljeU5hbWUgPSBhd2FpdCB0aGlzLmdldFBvbGljeU5hbWUoZW52aXJvbm1lbnQsIHNkaywgaW5wdXRQb2xpY3lOYW1lLCBwYXJ0aXRpb24sIHBhcmFtcyk7XG4gICAgfVxuICAgIGlmIChjdXJyZW50UGVybWlzc2lvbnNCb3VuZGFyeSAhPT0gcG9saWN5TmFtZSkge1xuICAgICAgaWYgKCFjdXJyZW50UGVybWlzc2lvbnNCb3VuZGFyeSkge1xuICAgICAgICB3YXJuaW5nKGBBZGRpbmcgbmV3IHBlcm1pc3Npb25zIGJvdW5kYXJ5ICR7cG9saWN5TmFtZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAoIXBvbGljeU5hbWUpIHtcbiAgICAgICAgd2FybmluZyhgUmVtb3ZpbmcgZXhpc3RpbmcgcGVybWlzc2lvbnMgYm91bmRhcnkgJHtjdXJyZW50UGVybWlzc2lvbnNCb3VuZGFyeX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdhcm5pbmcoYENoYW5naW5nIHBlcm1pc3Npb25zIGJvdW5kYXJ5IGZyb20gJHtjdXJyZW50UGVybWlzc2lvbnNCb3VuZGFyeX0gdG8gJHtwb2xpY3lOYW1lfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjdXJyZW50LnVwZGF0ZShcbiAgICAgIGJvb3RzdHJhcFRlbXBsYXRlLFxuICAgICAge1xuICAgICAgICBGaWxlQXNzZXRzQnVja2V0TmFtZTogcGFyYW1zLmJ1Y2tldE5hbWUsXG4gICAgICAgIEZpbGVBc3NldHNCdWNrZXRLbXNLZXlJZDoga21zS2V5SWQsXG4gICAgICAgIC8vIEVtcHR5IGFycmF5IGJlY29tZXMgZW1wdHkgc3RyaW5nXG4gICAgICAgIFRydXN0ZWRBY2NvdW50czogdHJ1c3RlZEFjY291bnRzLmpvaW4oJywnKSxcbiAgICAgICAgVHJ1c3RlZEFjY291bnRzRm9yTG9va3VwOiB0cnVzdGVkQWNjb3VudHNGb3JMb29rdXAuam9pbignLCcpLFxuICAgICAgICBDbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzLmpvaW4oJywnKSxcbiAgICAgICAgUXVhbGlmaWVyOiBwYXJhbXMucXVhbGlmaWVyLFxuICAgICAgICBQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246XG4gICAgICAgICAgcGFyYW1zLnB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbiB8fCBwYXJhbXMucHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgID8gJ3RydWUnXG4gICAgICAgICAgICA6ICdmYWxzZScsXG4gICAgICAgIElucHV0UGVybWlzc2lvbnNCb3VuZGFyeTogcG9saWN5TmFtZSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogb3B0aW9ucy50ZXJtaW5hdGlvblByb3RlY3Rpb24gPz8gY3VycmVudC50ZXJtaW5hdGlvblByb3RlY3Rpb24sXG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdldFBvbGljeU5hbWUoXG4gICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50LFxuICAgIHNkazogU0RLLFxuICAgIHBlcm1pc3Npb25zQm91bmRhcnk6IHN0cmluZyxcbiAgICBwYXJ0aXRpb246IHN0cmluZyxcbiAgICBwYXJhbXM6IEJvb3RzdHJhcHBpbmdQYXJhbWV0ZXJzLFxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGlmIChwZXJtaXNzaW9uc0JvdW5kYXJ5ICE9PSBDREtfQk9PVFNUUkFQX1BFUk1JU1NJT05TX0JPVU5EQVJZKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlUG9saWN5TmFtZShwZXJtaXNzaW9uc0JvdW5kYXJ5KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocGVybWlzc2lvbnNCb3VuZGFyeSk7XG4gICAgfVxuICAgIC8vIGlmIG5vIFF1YWxpZmllciBpcyBzdXBwbGllZCwgcmVzb3J0IHRvIHRoZSBkZWZhdWx0IG9uZVxuICAgIGNvbnN0IGFybiA9IGF3YWl0IHRoaXMuZ2V0RXhhbXBsZVBlcm1pc3Npb25zQm91bmRhcnkoXG4gICAgICBwYXJhbXMucXVhbGlmaWVyID8/ICdobmI2NTlmZHMnLFxuICAgICAgcGFydGl0aW9uLFxuICAgICAgZW52aXJvbm1lbnQuYWNjb3VudCxcbiAgICAgIHNkayxcbiAgICApO1xuICAgIGNvbnN0IHBvbGljeU5hbWUgPSBhcm4uc3BsaXQoJy8nKS5wb3AoKTtcbiAgICBpZiAoIXBvbGljeU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoJ0NvdWxkIG5vdCByZXRyaWV2ZSB0aGUgZXhhbXBsZSBwZXJtaXNzaW9uIGJvdW5kYXJ5IScpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHBvbGljeU5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBnZXRFeGFtcGxlUGVybWlzc2lvbnNCb3VuZGFyeShcbiAgICBxdWFsaWZpZXI6IHN0cmluZyxcbiAgICBwYXJ0aXRpb246IHN0cmluZyxcbiAgICBhY2NvdW50OiBzdHJpbmcsXG4gICAgc2RrOiBTREssXG4gICk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaWFtID0gc2RrLmlhbSgpO1xuXG4gICAgbGV0IHBvbGljeU5hbWUgPSBgY2RrLSR7cXVhbGlmaWVyfS1wZXJtaXNzaW9ucy1ib3VuZGFyeWA7XG4gICAgY29uc3QgYXJuID0gYGFybjoke3BhcnRpdGlvbn06aWFtOjoke2FjY291bnR9OnBvbGljeS8ke3BvbGljeU5hbWV9YDtcblxuICAgIHRyeSB7XG4gICAgICBsZXQgZ2V0UG9saWN5UmVzcCA9IGF3YWl0IGlhbS5nZXRQb2xpY3koeyBQb2xpY3lBcm46IGFybiB9KTtcbiAgICAgIGlmIChnZXRQb2xpY3lSZXNwLlBvbGljeSkge1xuICAgICAgICByZXR1cm4gYXJuO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgLy8gaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL0lBTS9sYXRlc3QvQVBJUmVmZXJlbmNlL0FQSV9HZXRQb2xpY3kuaHRtbCNBUElfR2V0UG9saWN5X0Vycm9yc1xuICAgICAgaWYgKGUubmFtZSA9PT0gJ05vU3VjaEVudGl0eScpIHtcbiAgICAgICAgLy9ub29wLCBwcm9jZWVkIHdpdGggY3JlYXRpbmcgdGhlIHBvbGljeVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBwb2xpY3lEb2MgPSB7XG4gICAgICBWZXJzaW9uOiAnMjAxMi0xMC0xNycsXG4gICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAge1xuICAgICAgICAgIEFjdGlvbjogWycqJ10sXG4gICAgICAgICAgUmVzb3VyY2U6ICcqJyxcbiAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgU2lkOiAnRXhwbGljaXRBbGxvd0FsbCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBDb25kaXRpb246IHtcbiAgICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgICAnaWFtOlBlcm1pc3Npb25zQm91bmRhcnknOiBgYXJuOiR7cGFydGl0aW9ufTppYW06OiR7YWNjb3VudH06cG9saWN5L2Nkay0ke3F1YWxpZmllcn0tcGVybWlzc2lvbnMtYm91bmRhcnlgLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEFjdGlvbjogW1xuICAgICAgICAgICAgJ2lhbTpDcmVhdGVVc2VyJyxcbiAgICAgICAgICAgICdpYW06Q3JlYXRlUm9sZScsXG4gICAgICAgICAgICAnaWFtOlB1dFJvbGVQZXJtaXNzaW9uc0JvdW5kYXJ5JyxcbiAgICAgICAgICAgICdpYW06UHV0VXNlclBlcm1pc3Npb25zQm91bmRhcnknLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgUmVzb3VyY2U6ICcqJyxcbiAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgU2lkOiAnRGVueUFjY2Vzc0lmUmVxdWlyZWRQZXJtQm91bmRhcnlJc05vdEJlaW5nQXBwbGllZCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBY3Rpb246IFtcbiAgICAgICAgICAgICdpYW06Q3JlYXRlUG9saWN5VmVyc2lvbicsXG4gICAgICAgICAgICAnaWFtOkRlbGV0ZVBvbGljeScsXG4gICAgICAgICAgICAnaWFtOkRlbGV0ZVBvbGljeVZlcnNpb24nLFxuICAgICAgICAgICAgJ2lhbTpTZXREZWZhdWx0UG9saWN5VmVyc2lvbicsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBSZXNvdXJjZTogYGFybjoke3BhcnRpdGlvbn06aWFtOjoke2FjY291bnR9OnBvbGljeS9jZGstJHtxdWFsaWZpZXJ9LXBlcm1pc3Npb25zLWJvdW5kYXJ5YCxcbiAgICAgICAgICBFZmZlY3Q6ICdEZW55JyxcbiAgICAgICAgICBTaWQ6ICdEZW55UGVybUJvdW5kYXJ5SUFNUG9saWN5QWx0ZXJhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBY3Rpb246IFsnaWFtOkRlbGV0ZVVzZXJQZXJtaXNzaW9uc0JvdW5kYXJ5JywgJ2lhbTpEZWxldGVSb2xlUGVybWlzc2lvbnNCb3VuZGFyeSddLFxuICAgICAgICAgIFJlc291cmNlOiAnKicsXG4gICAgICAgICAgRWZmZWN0OiAnRGVueScsXG4gICAgICAgICAgU2lkOiAnRGVueVJlbW92YWxPZlBlcm1Cb3VuZGFyeUZyb21BbnlVc2VyT3JSb2xlJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfTtcbiAgICBjb25zdCByZXF1ZXN0ID0ge1xuICAgICAgUG9saWN5TmFtZTogcG9saWN5TmFtZSxcbiAgICAgIFBvbGljeURvY3VtZW50OiBKU09OLnN0cmluZ2lmeShwb2xpY3lEb2MpLFxuICAgIH07XG4gICAgY29uc3QgY3JlYXRlUG9saWN5UmVzcG9uc2UgPSBhd2FpdCBpYW0uY3JlYXRlUG9saWN5KHJlcXVlc3QpO1xuICAgIGlmIChjcmVhdGVQb2xpY3lSZXNwb25zZS5Qb2xpY3k/LkFybikge1xuICAgICAgcmV0dXJuIGNyZWF0ZVBvbGljeVJlc3BvbnNlLlBvbGljeS5Bcm47XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoYENvdWxkIG5vdCByZXRyaWV2ZSB0aGUgZXhhbXBsZSBwZXJtaXNzaW9uIGJvdW5kYXJ5ICR7YXJufSFgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHZhbGlkYXRlUG9saWN5TmFtZShwZXJtaXNzaW9uc0JvdW5kYXJ5OiBzdHJpbmcpIHtcbiAgICAvLyBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vSUFNL2xhdGVzdC9BUElSZWZlcmVuY2UvQVBJX0NyZWF0ZVBvbGljeS5odG1sXG4gICAgLy8gQWRkZWQgc3VwcG9ydCBmb3IgcG9saWN5IG5hbWVzIHdpdGggYSBwYXRoXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvMjYzMjBcbiAgICBjb25zdCByZWdleHA6IFJlZ0V4cCA9IC9bXFx3K1xcLz0sLkAtXSsvO1xuICAgIGNvbnN0IG1hdGNoZXMgPSByZWdleHAuZXhlYyhwZXJtaXNzaW9uc0JvdW5kYXJ5KTtcbiAgICBpZiAoIShtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoID09PSAxICYmIG1hdGNoZXNbMF0gPT09IHBlcm1pc3Npb25zQm91bmRhcnkpKSB7XG4gICAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKGBUaGUgcGVybWlzc2lvbnMgYm91bmRhcnkgbmFtZSAke3Blcm1pc3Npb25zQm91bmRhcnl9IGRvZXMgbm90IG1hdGNoIHRoZSBJQU0gY29udmVudGlvbnMuYCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjdXN0b21Cb290c3RyYXAoXG4gICAgZW52aXJvbm1lbnQ6IGN4YXBpLkVudmlyb25tZW50LFxuICAgIHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcixcbiAgICBvcHRpb25zOiBCb290c3RyYXBFbnZpcm9ubWVudE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQ+IHtcbiAgICAvLyBMb29rIGF0IHRoZSB0ZW1wbGF0ZSwgZGVjaWRlIHdoZXRoZXIgaXQncyBtb3N0IGxpa2VseSBhIGxlZ2FjeSBvciBtb2Rlcm4gYm9vdHN0cmFwXG4gICAgLy8gdGVtcGxhdGUsIGFuZCB1c2UgdGhlIHJpZ2h0IGJvb3RzdHJhcHBlciBmb3IgdGhhdC5cbiAgICBjb25zdCB2ZXJzaW9uID0gYm9vdHN0cmFwVmVyc2lvbkZyb21UZW1wbGF0ZShhd2FpdCB0aGlzLmxvYWRUZW1wbGF0ZSgpKTtcbiAgICBpZiAodmVyc2lvbiA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMubGVnYWN5Qm9vdHN0cmFwKGVudmlyb25tZW50LCBzZGtQcm92aWRlciwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVybkJvb3RzdHJhcChlbnZpcm9ubWVudCwgc2RrUHJvdmlkZXIsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZFRlbXBsYXRlKHBhcmFtczogQm9vdHN0cmFwcGluZ1BhcmFtZXRlcnMgPSB7fSk6IFByb21pc2U8YW55PiB7XG4gICAgc3dpdGNoICh0aGlzLnNvdXJjZS5zb3VyY2UpIHtcbiAgICAgIGNhc2UgJ2N1c3RvbSc6XG4gICAgICAgIHJldHVybiBsb2FkU3RydWN0dXJlZEZpbGUodGhpcy5zb3VyY2UudGVtcGxhdGVGaWxlKTtcbiAgICAgIGNhc2UgJ2RlZmF1bHQnOlxuICAgICAgICByZXR1cm4gbG9hZFN0cnVjdHVyZWRGaWxlKHBhdGguam9pbihyb290RGlyKCksICdsaWInLCAnYXBpJywgJ2Jvb3RzdHJhcCcsICdib290c3RyYXAtdGVtcGxhdGUueWFtbCcpKTtcbiAgICAgIGNhc2UgJ2xlZ2FjeSc6XG4gICAgICAgIHJldHVybiBsZWdhY3lCb290c3RyYXBUZW1wbGF0ZShwYXJhbXMpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1hZ2ljIHBhcmFtZXRlciB2YWx1ZSB0aGF0IHdpbGwgY2F1c2UgdGhlIGJvb3RzdHJhcC10ZW1wbGF0ZS55bWwgdG8gTk9UIGNyZWF0ZSBhIENNSyBidXQgdXNlIHRoZSBkZWZhdWx0IGtleVxuICovXG5jb25zdCBVU0VfQVdTX01BTkFHRURfS0VZID0gJ0FXU19NQU5BR0VEX0tFWSc7XG5cbi8qKlxuICogTWFnaWMgcGFyYW1ldGVyIHZhbHVlIHRoYXQgd2lsbCBjYXVzZSB0aGUgYm9vdHN0cmFwLXRlbXBsYXRlLnltbCB0byBjcmVhdGUgYSBDTUtcbiAqL1xuY29uc3QgQ1JFQVRFX05FV19LRVkgPSAnJztcbi8qKlxuICogUGFyYW1ldGVyIHZhbHVlIGluZGljYXRpbmcgdGhlIHVzZSBvZiB0aGUgZGVmYXVsdCwgQ0RLIHByb3ZpZGVkIHBlcm1pc3Npb25zIGJvdW5kYXJ5IGZvciBib290c3RyYXAtdGVtcGxhdGUueW1sXG4gKi9cbmNvbnN0IENES19CT09UU1RSQVBfUEVSTUlTU0lPTlNfQk9VTkRBUlkgPSAnQ0RLX0JPT1RTVFJBUF9QRVJNSVNTSU9OU19CT1VOREFSWSc7XG5cbi8qKlxuICogU3BsaXQgYW4gYXJyYXktbGlrZSBDbG91ZEZvcm1hdGlvbiBwYXJhbWV0ZXIgb24gLFxuICpcbiAqIEFuIGVtcHR5IHN0cmluZyBpcyB0aGUgZW1wdHkgYXJyYXkgKGluc3RlYWQgb2YgYFsnJ11gKS5cbiAqL1xuZnVuY3Rpb24gc3BsaXRDZm5BcnJheSh4czogc3RyaW5nIHwgdW5kZWZpbmVkKTogc3RyaW5nW10ge1xuICBpZiAoeHMgPT09ICcnIHx8IHhzID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgcmV0dXJuIHhzLnNwbGl0KCcsJyk7XG59XG4iXX0=