"use strict";
/* eslint-disable import/order */
Object.defineProperty(exports, "__esModule", { value: true });
const deployStack = require("../../lib/api/deploy-stack");
const client_iam_1 = require("@aws-sdk/client-iam");
const api_1 = require("../../lib/api");
const mock_sdk_1 = require("../util/mock-sdk");
const mockDeployStack = jest.spyOn(deployStack, 'deployStack');
let bootstrapper;
let stderrMock;
beforeEach(() => {
    bootstrapper = new api_1.Bootstrapper({ source: 'default' });
    stderrMock = jest.spyOn(process.stderr, 'write').mockImplementation(() => {
        return true;
    });
});
afterEach(() => {
    stderrMock.mockRestore();
});
function mockTheToolkitInfo(stackProps) {
    api_1.ToolkitInfo.lookup = jest.fn().mockResolvedValue(api_1.ToolkitInfo.fromStack((0, mock_sdk_1.mockBootstrapStack)(stackProps)));
}
describe('Bootstrapping v2', () => {
    const env = {
        account: '123456789012',
        region: 'us-east-1',
        name: 'mock',
    };
    let sdk;
    beforeEach(() => {
        sdk = new mock_sdk_1.MockSdkProvider();
        // By default, we'll return a non-found toolkit info
        api_1.ToolkitInfo.lookup = jest.fn().mockResolvedValue(api_1.ToolkitInfo.bootstrapStackNotFoundInfo('BootstrapStack'));
        const value = {
            Policy: {
                PolicyName: 'my-policy',
                Arn: 'arn:aws:iam::0123456789012:policy/my-policy',
            },
        };
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
        (0, mock_sdk_1.setDefaultSTSMocks)();
        mock_sdk_1.mockIAMClient.on(client_iam_1.GetPolicyCommand).resolves(value);
        mock_sdk_1.mockIAMClient.on(client_iam_1.CreatePolicyCommand).resolves(value);
        mockDeployStack.mockResolvedValue({
            type: 'did-deploy-stack',
            noOp: false,
            outputs: {},
            stackArn: 'arn:stack',
        });
    });
    afterEach(() => {
        mockDeployStack.mockClear();
    });
    test('passes the bucket name as a CFN parameter', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                bucketName: 'my-bucket-name',
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                FileAssetsBucketName: 'my-bucket-name',
                PublicAccessBlockConfiguration: 'true',
            }),
        }));
    });
    test('passes the KMS key ID as a CFN parameter', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
                kmsKeyId: 'my-kms-key-id',
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                FileAssetsBucketKmsKeyId: 'my-kms-key-id',
                PublicAccessBlockConfiguration: 'true',
            }),
        }));
    });
    test('passes false to PublicAccessBlockConfiguration', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
                publicAccessBlockConfiguration: false,
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                PublicAccessBlockConfiguration: 'false',
            }),
        }));
    });
    test('passes true to PermissionsBoundary', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                examplePermissionsBoundary: true,
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                InputPermissionsBoundary: 'cdk-hnb659fds-permissions-boundary',
            }),
        }));
    });
    test('passes value to PermissionsBoundary', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'InputPermissionsBoundary',
                    ParameterValue: 'existing-pb',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                customPermissionsBoundary: 'permissions-boundary-name',
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                InputPermissionsBoundary: 'permissions-boundary-name',
            }),
        }));
        expect(stderrMock.mock.calls).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                expect.stringMatching(/Changing permissions boundary from existing-pb to permissions-boundary-name/),
            ]),
        ]));
    });
    test('permission boundary switch message does not appear', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'InputPermissionsBoundary',
                    ParameterValue: '',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk);
        expect(stderrMock.mock.calls).toEqual(expect.arrayContaining([expect.not.arrayContaining([expect.stringMatching(/Changing permissions boundary/)])]));
    });
    test('adding new permissions boundary', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'InputPermissionsBoundary',
                    ParameterValue: '',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                customPermissionsBoundary: 'permissions-boundary-name',
            },
        });
        expect(stderrMock.mock.calls).toEqual(expect.arrayContaining([
            expect.arrayContaining([expect.stringMatching(/Adding new permissions boundary permissions-boundary-name/)]),
        ]));
    });
    test('removing existing permissions boundary', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'InputPermissionsBoundary',
                    ParameterValue: 'permissions-boundary-name',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {},
        });
        expect(stderrMock.mock.calls).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                expect.stringMatching(/Removing existing permissions boundary permissions-boundary-name/),
            ]),
        ]));
    });
    test('adding permission boundary with path in policy name', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'InputPermissionsBoundary',
                    ParameterValue: '',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                customPermissionsBoundary: 'permissions-boundary-name/with/path',
            },
        });
        expect(stderrMock.mock.calls).toEqual(expect.arrayContaining([
            expect.arrayContaining([
                expect.stringMatching(/Adding new permissions boundary permissions-boundary-name\/with\/path/),
            ]),
        ]));
    });
    test('passing trusted accounts without CFN managed policies results in an error', async () => {
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        })).rejects.toThrow(/--cloudformation-execution-policies/);
    });
    test('passing trusted accounts without CFN managed policies on the existing stack results in an error', async () => {
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'CloudFormationExecutionPolicies',
                    ParameterValue: '',
                },
            ],
        });
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        })).rejects.toThrow(/--cloudformation-execution-policies/);
    });
    test('passing no CFN managed policies without trusted accounts is okay', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {},
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                CloudFormationExecutionPolicies: '',
            }),
        }));
    });
    test('passing trusted accounts for lookup generates the correct stack parameter', async () => {
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccountsForLookup: ['123456789012'],
                cloudFormationExecutionPolicies: ['aws://foo'],
            },
        });
        expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
            parameters: expect.objectContaining({
                TrustedAccountsForLookup: '123456789012',
            }),
        }));
    });
    test('allow adding trusted account if there was already a policy on the stack', async () => {
        // GIVEN
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'CloudFormationExecutionPolicies',
                    ParameterValue: 'arn:aws:something',
                },
            ],
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                trustedAccounts: ['123456789012'],
            },
        });
        // Did not throw
    });
    test('Do not allow downgrading bootstrap stack version', async () => {
        // GIVEN
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        })).resolves.toEqual(expect.objectContaining({ noOp: true }));
    });
    test('Do not allow overwriting bootstrap stack from a different vendor', async () => {
        // GIVEN
        mockTheToolkitInfo({
            Parameters: [
                {
                    ParameterKey: 'BootstrapVariant',
                    ParameterValue: 'JoeSchmoe',
                },
            ],
        });
        await expect(bootstrapper.bootstrapEnvironment(env, sdk, {})).resolves.toEqual(expect.objectContaining({ noOp: true }));
    });
    test('bootstrap template has the right exports', async () => {
        let template;
        mockDeployStack.mockImplementation((args) => {
            template = args.stack.template;
            return Promise.resolve({
                type: 'did-deploy-stack',
                noOp: false,
                outputs: {},
                stackArn: 'arn:stack',
            });
        });
        await bootstrapper.bootstrapEnvironment(env, sdk, {
            parameters: {
                cloudFormationExecutionPolicies: ['arn:policy'],
            },
        });
        const exports = Object.values(template.Outputs ?? {})
            .filter((o) => o.Export !== undefined)
            .map((o) => o.Export.Name);
        expect(exports).toEqual([
            // This used to be used by aws-s3-assets
            { 'Fn::Sub': 'CdkBootstrap-${Qualifier}-FileAssetKeyArn' },
        ]);
    });
    describe('termination protection', () => {
        test('stack is not termination protected by default', async () => {
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: false,
                }),
            }));
        });
        test('stack is termination protected when option is set', async () => {
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                terminationProtection: true,
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: true,
                }),
            }));
        });
        test('termination protection is left alone when option is not given', async () => {
            mockTheToolkitInfo({
                EnableTerminationProtection: true,
            });
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: true,
                }),
            }));
        });
        test('termination protection can be switched off', async () => {
            mockTheToolkitInfo({
                EnableTerminationProtection: true,
            });
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                terminationProtection: false,
                parameters: {
                    cloudFormationExecutionPolicies: ['arn:policy'],
                },
            });
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.objectContaining({
                    terminationProtection: false,
                }),
            }));
        });
    });
    describe('KMS key', () => {
        test.each([
            // Default case
            [undefined, 'AWS_MANAGED_KEY'],
            // Create a new key
            [true, ''],
            // Don't create a new key
            [false, 'AWS_MANAGED_KEY'],
        ])('(new stack) createCustomerMasterKey=%p => parameter becomes %p ', async (createCustomerMasterKey, paramKeyId) => {
            // GIVEN: no existing stack
            // WHEN
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    createCustomerMasterKey,
                    cloudFormationExecutionPolicies: ['arn:booh'],
                },
            });
            // THEN
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                parameters: expect.objectContaining({
                    FileAssetsBucketKmsKeyId: paramKeyId,
                }),
            }));
        });
        test.each([
            // Old bootstrap stack being upgraded to new one
            [undefined, undefined, 'AWS_MANAGED_KEY'],
            // There is a value, user doesn't request a change
            ['arn:aws:key', undefined, undefined],
            // Switch off existing key
            ['arn:aws:key', false, 'AWS_MANAGED_KEY'],
            // Switch on existing key
            ['AWS_MANAGED_KEY', true, ''],
        ])('(upgrading) current param %p, createCustomerMasterKey=%p => parameter becomes %p ', async (currentKeyId, createCustomerMasterKey, paramKeyId) => {
            // GIVEN
            mockTheToolkitInfo({
                Parameters: currentKeyId
                    ? [
                        {
                            ParameterKey: 'FileAssetsBucketKmsKeyId',
                            ParameterValue: currentKeyId,
                        },
                    ]
                    : undefined,
            });
            // WHEN
            await bootstrapper.bootstrapEnvironment(env, sdk, {
                parameters: {
                    createCustomerMasterKey,
                    cloudFormationExecutionPolicies: ['arn:booh'],
                },
            });
            // THEN
            expect(mockDeployStack).toHaveBeenCalledWith(expect.objectContaining({
                parameters: expect.objectContaining({
                    FileAssetsBucketKmsKeyId: paramKeyId,
                }),
            }));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwMi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYm9vdHN0cmFwMi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQ0FBaUM7O0FBRWpDLDBEQUEwRDtBQUUxRCxvREFBNEU7QUFDNUUsdUNBQThFO0FBQzlFLCtDQUswQjtBQUUxQixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztBQUUvRCxJQUFJLFlBQTBCLENBQUM7QUFDL0IsSUFBSSxVQUE0QixDQUFDO0FBRWpDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxZQUFZLEdBQUcsSUFBSSxrQkFBWSxDQUFDLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDdkQsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7UUFDdkUsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxDQUFDLEdBQUcsRUFBRTtJQUNiLFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUMzQixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsa0JBQWtCLENBQUMsVUFBMEI7SUFDbkQsaUJBQW1CLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBVyxDQUFDLFNBQVMsQ0FBQyxJQUFBLDZCQUFrQixFQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuSCxDQUFDO0FBRUQsUUFBUSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRTtJQUNoQyxNQUFNLEdBQUcsR0FBRztRQUNWLE9BQU8sRUFBRSxjQUFjO1FBQ3ZCLE1BQU0sRUFBRSxXQUFXO1FBQ25CLElBQUksRUFBRSxNQUFNO0tB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QUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBpbXBvcnQvb3JkZXIgKi9cblxuaW1wb3J0ICogYXMgZGVwbG95U3RhY2sgZnJvbSAnLi4vLi4vbGliL2FwaS9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHsgU3RhY2sgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWRmb3JtYXRpb24nO1xuaW1wb3J0IHsgQ3JlYXRlUG9saWN5Q29tbWFuZCwgR2V0UG9saWN5Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1pYW0nO1xuaW1wb3J0IHsgQm9vdHN0cmFwcGVyLCBEZXBsb3lTdGFja09wdGlvbnMsIFRvb2xraXRJbmZvIH0gZnJvbSAnLi4vLi4vbGliL2FwaSc7XG5pbXBvcnQge1xuICBtb2NrQm9vdHN0cmFwU3RhY2ssXG4gIG1vY2tJQU1DbGllbnQsXG4gIE1vY2tTZGtQcm92aWRlcixcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0LCBzZXREZWZhdWx0U1RTTW9ja3MsXG59IGZyb20gJy4uL3V0aWwvbW9jay1zZGsnO1xuXG5jb25zdCBtb2NrRGVwbG95U3RhY2sgPSBqZXN0LnNweU9uKGRlcGxveVN0YWNrLCAnZGVwbG95U3RhY2snKTtcblxubGV0IGJvb3RzdHJhcHBlcjogQm9vdHN0cmFwcGVyO1xubGV0IHN0ZGVyck1vY2s6IGplc3QuU3B5SW5zdGFuY2U7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICBib290c3RyYXBwZXIgPSBuZXcgQm9vdHN0cmFwcGVyKHsgc291cmNlOiAnZGVmYXVsdCcgfSk7XG4gIHN0ZGVyck1vY2sgPSBqZXN0LnNweU9uKHByb2Nlc3Muc3RkZXJyLCAnd3JpdGUnKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4ge1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn0pO1xuXG5hZnRlckVhY2goKCkgPT4ge1xuICBzdGRlcnJNb2NrLm1vY2tSZXN0b3JlKCk7XG59KTtcblxuZnVuY3Rpb24gbW9ja1RoZVRvb2xraXRJbmZvKHN0YWNrUHJvcHM6IFBhcnRpYWw8U3RhY2s+KSB7XG4gIChUb29sa2l0SW5mbyBhcyBhbnkpLmxvb2t1cCA9IGplc3QuZm4oKS5tb2NrUmVzb2x2ZWRWYWx1ZShUb29sa2l0SW5mby5mcm9tU3RhY2sobW9ja0Jvb3RzdHJhcFN0YWNrKHN0YWNrUHJvcHMpKSk7XG59XG5cbmRlc2NyaWJlKCdCb290c3RyYXBwaW5nIHYyJywgKCkgPT4ge1xuICBjb25zdCBlbnYgPSB7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBuYW1lOiAnbW9jaycsXG4gIH07XG5cbiAgbGV0IHNkazogTW9ja1Nka1Byb3ZpZGVyO1xuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBzZGsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gICAgLy8gQnkgZGVmYXVsdCwgd2UnbGwgcmV0dXJuIGEgbm9uLWZvdW5kIHRvb2xraXQgaW5mb1xuICAgIChUb29sa2l0SW5mbyBhcyBhbnkpLmxvb2t1cCA9IGplc3QuZm4oKS5tb2NrUmVzb2x2ZWRWYWx1ZShUb29sa2l0SW5mby5ib290c3RyYXBTdGFja05vdEZvdW5kSW5mbygnQm9vdHN0cmFwU3RhY2snKSk7XG4gICAgY29uc3QgdmFsdWUgPSB7XG4gICAgICBQb2xpY3k6IHtcbiAgICAgICAgUG9saWN5TmFtZTogJ215LXBvbGljeScsXG4gICAgICAgIEFybjogJ2Fybjphd3M6aWFtOjowMTIzNDU2Nzg5MDEyOnBvbGljeS9teS1wb2xpY3knLFxuICAgICAgfSxcbiAgICB9O1xuICAgIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCgpO1xuICAgIHNldERlZmF1bHRTVFNNb2NrcygpO1xuICAgIG1vY2tJQU1DbGllbnQub24oR2V0UG9saWN5Q29tbWFuZCkucmVzb2x2ZXModmFsdWUpO1xuICAgIG1vY2tJQU1DbGllbnQub24oQ3JlYXRlUG9saWN5Q29tbWFuZCkucmVzb2x2ZXModmFsdWUpO1xuICAgIG1vY2tEZXBsb3lTdGFjay5tb2NrUmVzb2x2ZWRWYWx1ZSh7XG4gICAgICB0eXBlOiAnZGlkLWRlcGxveS1zdGFjaycsXG4gICAgICBub09wOiBmYWxzZSxcbiAgICAgIG91dHB1dHM6IHt9LFxuICAgICAgc3RhY2tBcm46ICdhcm46c3RhY2snLFxuICAgIH0pO1xuICB9KTtcblxuICBhZnRlckVhY2goKCkgPT4ge1xuICAgIG1vY2tEZXBsb3lTdGFjay5tb2NrQ2xlYXIoKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFzc2VzIHRoZSBidWNrZXQgbmFtZSBhcyBhIENGTiBwYXJhbWV0ZXInLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIGJ1Y2tldE5hbWU6ICdteS1idWNrZXQtbmFtZScsXG4gICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgRmlsZUFzc2V0c0J1Y2tldE5hbWU6ICdteS1idWNrZXQtbmFtZScsXG4gICAgICAgICAgUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiAndHJ1ZScsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFzc2VzIHRoZSBLTVMga2V5IElEIGFzIGEgQ0ZOIHBhcmFtZXRlcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICAgIGttc0tleUlkOiAnbXkta21zLWtleS1pZCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KG1vY2tEZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICBGaWxlQXNzZXRzQnVja2V0S21zS2V5SWQ6ICdteS1rbXMta2V5LWlkJyxcbiAgICAgICAgICBQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246ICd0cnVlJyxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdwYXNzZXMgZmFsc2UgdG8gUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpwb2xpY3knXSxcbiAgICAgICAgcHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgcGFyYW1ldGVyczogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgIFB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvbjogJ2ZhbHNlJyxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdwYXNzZXMgdHJ1ZSB0byBQZXJtaXNzaW9uc0JvdW5kYXJ5JywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBleGFtcGxlUGVybWlzc2lvbnNCb3VuZGFyeTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgcGFyYW1ldGVyczogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgIElucHV0UGVybWlzc2lvbnNCb3VuZGFyeTogJ2Nkay1obmI2NTlmZHMtcGVybWlzc2lvbnMtYm91bmRhcnknLFxuICAgICAgICB9KSxcbiAgICAgIH0pLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Bhc3NlcyB2YWx1ZSB0byBQZXJtaXNzaW9uc0JvdW5kYXJ5JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBQYXJhbWV0ZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBQYXJhbWV0ZXJLZXk6ICdJbnB1dFBlcm1pc3Npb25zQm91bmRhcnknLFxuICAgICAgICAgIFBhcmFtZXRlclZhbHVlOiAnZXhpc3RpbmctcGInLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgY3VzdG9tUGVybWlzc2lvbnNCb3VuZGFyeTogJ3Blcm1pc3Npb25zLWJvdW5kYXJ5LW5hbWUnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgSW5wdXRQZXJtaXNzaW9uc0JvdW5kYXJ5OiAncGVybWlzc2lvbnMtYm91bmRhcnktbmFtZScsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcbiAgICBleHBlY3Qoc3RkZXJyTW9jay5tb2NrLmNhbGxzKS50b0VxdWFsKFxuICAgICAgZXhwZWN0LmFycmF5Q29udGFpbmluZyhbXG4gICAgICAgIGV4cGVjdC5hcnJheUNvbnRhaW5pbmcoW1xuICAgICAgICAgIGV4cGVjdC5zdHJpbmdNYXRjaGluZygvQ2hhbmdpbmcgcGVybWlzc2lvbnMgYm91bmRhcnkgZnJvbSBleGlzdGluZy1wYiB0byBwZXJtaXNzaW9ucy1ib3VuZGFyeS1uYW1lLyksXG4gICAgICAgIF0pLFxuICAgICAgXSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgncGVybWlzc2lvbiBib3VuZGFyeSBzd2l0Y2ggbWVzc2FnZSBkb2VzIG5vdCBhcHBlYXInLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFBhcmFtZXRlcktleTogJ0lucHV0UGVybWlzc2lvbnNCb3VuZGFyeScsXG4gICAgICAgICAgUGFyYW1ldGVyVmFsdWU6ICcnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGspO1xuXG4gICAgZXhwZWN0KHN0ZGVyck1vY2subW9jay5jYWxscykudG9FcXVhbChcbiAgICAgIGV4cGVjdC5hcnJheUNvbnRhaW5pbmcoW2V4cGVjdC5ub3QuYXJyYXlDb250YWluaW5nKFtleHBlY3Quc3RyaW5nTWF0Y2hpbmcoL0NoYW5naW5nIHBlcm1pc3Npb25zIGJvdW5kYXJ5LyldKV0pLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2FkZGluZyBuZXcgcGVybWlzc2lvbnMgYm91bmRhcnknLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFBhcmFtZXRlcktleTogJ0lucHV0UGVybWlzc2lvbnNCb3VuZGFyeScsXG4gICAgICAgICAgUGFyYW1ldGVyVmFsdWU6ICcnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgY3VzdG9tUGVybWlzc2lvbnNCb3VuZGFyeTogJ3Blcm1pc3Npb25zLWJvdW5kYXJ5LW5hbWUnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChzdGRlcnJNb2NrLm1vY2suY2FsbHMpLnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtcbiAgICAgICAgZXhwZWN0LmFycmF5Q29udGFpbmluZyhbZXhwZWN0LnN0cmluZ01hdGNoaW5nKC9BZGRpbmcgbmV3IHBlcm1pc3Npb25zIGJvdW5kYXJ5IHBlcm1pc3Npb25zLWJvdW5kYXJ5LW5hbWUvKV0pLFxuICAgICAgXSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgncmVtb3ZpbmcgZXhpc3RpbmcgcGVybWlzc2lvbnMgYm91bmRhcnknLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFBhcmFtZXRlcktleTogJ0lucHV0UGVybWlzc2lvbnNCb3VuZGFyeScsXG4gICAgICAgICAgUGFyYW1ldGVyVmFsdWU6ICdwZXJtaXNzaW9ucy1ib3VuZGFyeS1uYW1lJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7fSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChzdGRlcnJNb2NrLm1vY2suY2FsbHMpLnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtcbiAgICAgICAgZXhwZWN0LmFycmF5Q29udGFpbmluZyhbXG4gICAgICAgICAgZXhwZWN0LnN0cmluZ01hdGNoaW5nKC9SZW1vdmluZyBleGlzdGluZyBwZXJtaXNzaW9ucyBib3VuZGFyeSBwZXJtaXNzaW9ucy1ib3VuZGFyeS1uYW1lLyksXG4gICAgICAgIF0pLFxuICAgICAgXSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgnYWRkaW5nIHBlcm1pc3Npb24gYm91bmRhcnkgd2l0aCBwYXRoIGluIHBvbGljeSBuYW1lJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBQYXJhbWV0ZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBQYXJhbWV0ZXJLZXk6ICdJbnB1dFBlcm1pc3Npb25zQm91bmRhcnknLFxuICAgICAgICAgIFBhcmFtZXRlclZhbHVlOiAnJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIGN1c3RvbVBlcm1pc3Npb25zQm91bmRhcnk6ICdwZXJtaXNzaW9ucy1ib3VuZGFyeS1uYW1lL3dpdGgvcGF0aCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KHN0ZGVyck1vY2subW9jay5jYWxscykudG9FcXVhbChcbiAgICAgIGV4cGVjdC5hcnJheUNvbnRhaW5pbmcoW1xuICAgICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtcbiAgICAgICAgICBleHBlY3Quc3RyaW5nTWF0Y2hpbmcoL0FkZGluZyBuZXcgcGVybWlzc2lvbnMgYm91bmRhcnkgcGVybWlzc2lvbnMtYm91bmRhcnktbmFtZVxcL3dpdGhcXC9wYXRoLyksXG4gICAgICAgIF0pLFxuICAgICAgXSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFzc2luZyB0cnVzdGVkIGFjY291bnRzIHdpdGhvdXQgQ0ZOIG1hbmFnZWQgcG9saWNpZXMgcmVzdWx0cyBpbiBhbiBlcnJvcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIHRydXN0ZWRBY2NvdW50czogWycxMjM0NTY3ODkwMTInXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC8tLWNsb3VkZm9ybWF0aW9uLWV4ZWN1dGlvbi1wb2xpY2llcy8pO1xuICB9KTtcblxuICB0ZXN0KCdwYXNzaW5nIHRydXN0ZWQgYWNjb3VudHMgd2l0aG91dCBDRk4gbWFuYWdlZCBwb2xpY2llcyBvbiB0aGUgZXhpc3Rpbmcgc3RhY2sgcmVzdWx0cyBpbiBhbiBlcnJvcicsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgUGFyYW1ldGVyczogW1xuICAgICAgICB7XG4gICAgICAgICAgUGFyYW1ldGVyS2V5OiAnQ2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llcycsXG4gICAgICAgICAgUGFyYW1ldGVyVmFsdWU6ICcnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgdHJ1c3RlZEFjY291bnRzOiBbJzEyMzQ1Njc4OTAxMiddLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgKS5yZWplY3RzLnRvVGhyb3coLy0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzLyk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Bhc3Npbmcgbm8gQ0ZOIG1hbmFnZWQgcG9saWNpZXMgd2l0aG91dCB0cnVzdGVkIGFjY291bnRzIGlzIG9rYXknLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICBwYXJhbWV0ZXJzOiB7fSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgQ2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogJycsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFzc2luZyB0cnVzdGVkIGFjY291bnRzIGZvciBsb29rdXAgZ2VuZXJhdGVzIHRoZSBjb3JyZWN0IHN0YWNrIHBhcmFtZXRlcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgdHJ1c3RlZEFjY291bnRzRm9yTG9va3VwOiBbJzEyMzQ1Njc4OTAxMiddLFxuICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2F3czovL2ZvbyddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgVHJ1c3RlZEFjY291bnRzRm9yTG9va3VwOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdhbGxvdyBhZGRpbmcgdHJ1c3RlZCBhY2NvdW50IGlmIHRoZXJlIHdhcyBhbHJlYWR5IGEgcG9saWN5IG9uIHRoZSBzdGFjaycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBQYXJhbWV0ZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBQYXJhbWV0ZXJLZXk6ICdDbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzJyxcbiAgICAgICAgICBQYXJhbWV0ZXJWYWx1ZTogJ2Fybjphd3M6c29tZXRoaW5nJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgdHJ1c3RlZEFjY291bnRzOiBbJzEyMzQ1Njc4OTAxMiddLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAvLyBEaWQgbm90IHRocm93XG4gIH0pO1xuXG4gIHRlc3QoJ0RvIG5vdCBhbGxvdyBkb3duZ3JhZGluZyBib290c3RyYXAgc3RhY2sgdmVyc2lvbicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpwb2xpY3knXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICkucmVzb2x2ZXMudG9FcXVhbChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7IG5vT3A6IHRydWUgfSkpO1xuICB9KTtcblxuICB0ZXN0KCdEbyBub3QgYWxsb3cgb3ZlcndyaXRpbmcgYm9vdHN0cmFwIHN0YWNrIGZyb20gYSBkaWZmZXJlbnQgdmVuZG9yJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFBhcmFtZXRlcktleTogJ0Jvb3RzdHJhcFZhcmlhbnQnLFxuICAgICAgICAgIFBhcmFtZXRlclZhbHVlOiAnSm9lU2NobW9lJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBleHBlY3QoYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7fSkpLnJlc29sdmVzLnRvRXF1YWwoXG4gICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7IG5vT3A6IHRydWUgfSksXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgnYm9vdHN0cmFwIHRlbXBsYXRlIGhhcyB0aGUgcmlnaHQgZXhwb3J0cycsIGFzeW5jICgpID0+IHtcbiAgICBsZXQgdGVtcGxhdGU6IGFueTtcbiAgICBtb2NrRGVwbG95U3RhY2subW9ja0ltcGxlbWVudGF0aW9uKChhcmdzOiBEZXBsb3lTdGFja09wdGlvbnMpID0+IHtcbiAgICAgIHRlbXBsYXRlID0gYXJncy5zdGFjay50ZW1wbGF0ZTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgICB0eXBlOiAnZGlkLWRlcGxveS1zdGFjaycsXG4gICAgICAgIG5vT3A6IGZhbHNlLFxuICAgICAgICBvdXRwdXRzOiB7fSxcbiAgICAgICAgc3RhY2tBcm46ICdhcm46c3RhY2snLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZXhwb3J0cyA9IE9iamVjdC52YWx1ZXModGVtcGxhdGUuT3V0cHV0cyA/PyB7fSlcbiAgICAgIC5maWx0ZXIoKG86IGFueSkgPT4gby5FeHBvcnQgIT09IHVuZGVmaW5lZClcbiAgICAgIC5tYXAoKG86IGFueSkgPT4gby5FeHBvcnQuTmFtZSk7XG5cbiAgICBleHBlY3QoZXhwb3J0cykudG9FcXVhbChbXG4gICAgICAvLyBUaGlzIHVzZWQgdG8gYmUgdXNlZCBieSBhd3MtczMtYXNzZXRzXG4gICAgICB7ICdGbjo6U3ViJzogJ0Nka0Jvb3RzdHJhcC0ke1F1YWxpZmllcn0tRmlsZUFzc2V0S2V5QXJuJyB9LFxuICAgIF0pO1xuICB9KTtcblxuICBkZXNjcmliZSgndGVybWluYXRpb24gcHJvdGVjdGlvbicsICgpID0+IHtcbiAgICB0ZXN0KCdzdGFjayBpcyBub3QgdGVybWluYXRpb24gcHJvdGVjdGVkIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOnBvbGljeSddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgc3RhY2s6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICAgIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3N0YWNrIGlzIHRlcm1pbmF0aW9uIHByb3RlY3RlZCB3aGVuIG9wdGlvbiBpcyBzZXQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgZXhwZWN0KG1vY2tEZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICBzdGFjazogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGlzIGxlZnQgYWxvbmUgd2hlbiBvcHRpb24gaXMgbm90IGdpdmVuJywgYXN5bmMgKCkgPT4ge1xuICAgICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgY2xvdWRGb3JtYXRpb25FeGVjdXRpb25Qb2xpY2llczogWydhcm46cG9saWN5J10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgZXhwZWN0KG1vY2tEZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICBzdGFjazogZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uIGNhbiBiZSBzd2l0Y2hlZCBvZmYnLCBhc3luYyAoKSA9PiB7XG4gICAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgICBFbmFibGVUZXJtaW5hdGlvblByb3RlY3Rpb246IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICAgIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpwb2xpY3knXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICAgIHN0YWNrOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdLTVMga2V5JywgKCkgPT4ge1xuICAgIHRlc3QuZWFjaChbXG4gICAgICAvLyBEZWZhdWx0IGNhc2VcbiAgICAgIFt1bmRlZmluZWQsICdBV1NfTUFOQUdFRF9LRVknXSxcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyBrZXlcbiAgICAgIFt0cnVlLCAnJ10sXG4gICAgICAvLyBEb24ndCBjcmVhdGUgYSBuZXcga2V5XG4gICAgICBbZmFsc2UsICdBV1NfTUFOQUdFRF9LRVknXSxcbiAgICBdKShcbiAgICAgICcobmV3IHN0YWNrKSBjcmVhdGVDdXN0b21lck1hc3RlcktleT0lcCA9PiBwYXJhbWV0ZXIgYmVjb21lcyAlcCAnLFxuICAgICAgYXN5bmMgKGNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5LCBwYXJhbUtleUlkKSA9PiB7XG4gICAgICAgIC8vIEdJVkVOOiBubyBleGlzdGluZyBzdGFja1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgY3JlYXRlQ3VzdG9tZXJNYXN0ZXJLZXksXG4gICAgICAgICAgICBjbG91ZEZvcm1hdGlvbkV4ZWN1dGlvblBvbGljaWVzOiBbJ2Fybjpib29oJ10sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QobW9ja0RlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICAgICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgICAgIEZpbGVBc3NldHNCdWNrZXRLbXNLZXlJZDogcGFyYW1LZXlJZCxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgdGVzdC5lYWNoKFtcbiAgICAgIC8vIE9sZCBib290c3RyYXAgc3RhY2sgYmVpbmcgdXBncmFkZWQgdG8gbmV3IG9uZVxuICAgICAgW3VuZGVmaW5lZCwgdW5kZWZpbmVkLCAnQVdTX01BTkFHRURfS0VZJ10sXG4gICAgICAvLyBUaGVyZSBpcyBhIHZhbHVlLCB1c2VyIGRvZXNuJ3QgcmVxdWVzdCBhIGNoYW5nZVxuICAgICAgWydhcm46YXdzOmtleScsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXSxcbiAgICAgIC8vIFN3aXRjaCBvZmYgZXhpc3Rpbmcga2V5XG4gICAgICBbJ2Fybjphd3M6a2V5JywgZmFsc2UsICdBV1NfTUFOQUdFRF9LRVknXSxcbiAgICAgIC8vIFN3aXRjaCBvbiBleGlzdGluZyBrZXlcbiAgICAgIFsnQVdTX01BTkFHRURfS0VZJywgdHJ1ZSwgJyddLFxuICAgIF0pKFxuICAgICAgJyh1cGdyYWRpbmcpIGN1cnJlbnQgcGFyYW0gJXAsIGNyZWF0ZUN1c3RvbWVyTWFzdGVyS2V5PSVwID0+IHBhcmFtZXRlciBiZWNvbWVzICVwICcsXG4gICAgICBhc3luYyAoY3VycmVudEtleUlkLCBjcmVhdGVDdXN0b21lck1hc3RlcktleSwgcGFyYW1LZXlJZCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgICAgIFBhcmFtZXRlcnM6IGN1cnJlbnRLZXlJZFxuICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBQYXJhbWV0ZXJLZXk6ICdGaWxlQXNzZXRzQnVja2V0S21zS2V5SWQnLFxuICAgICAgICAgICAgICAgIFBhcmFtZXRlclZhbHVlOiBjdXJyZW50S2V5SWQsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBjcmVhdGVDdXN0b21lck1hc3RlcktleSxcbiAgICAgICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOmJvb2gnXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChtb2NrRGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgICAgICAgICAgRmlsZUFzc2V0c0J1Y2tldEttc0tleUlkOiBwYXJhbUtleUlkLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xufSk7XG4iXX0=