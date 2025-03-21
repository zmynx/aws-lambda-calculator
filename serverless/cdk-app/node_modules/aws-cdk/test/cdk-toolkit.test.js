"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// We need to mock the chokidar library, used by 'cdk watch'
const mockChokidarWatcherOn = jest.fn();
const fakeChokidarWatcher = {
    on: mockChokidarWatcherOn,
};
const fakeChokidarWatcherOn = {
    get readyCallback() {
        expect(mockChokidarWatcherOn.mock.calls.length).toBeGreaterThanOrEqual(1);
        // The call to the first 'watcher.on()' in the production code is the one we actually want here.
        // This is a pretty fragile, but at least with this helper class,
        // we would have to change it only in one place if it ever breaks
        const firstCall = mockChokidarWatcherOn.mock.calls[0];
        // let's make sure the first argument is the 'ready' event,
        // just to be double safe
        expect(firstCall[0]).toBe('ready');
        // the second argument is the callback
        return firstCall[1];
    },
    get fileEventCallback() {
        expect(mockChokidarWatcherOn.mock.calls.length).toBeGreaterThanOrEqual(2);
        const secondCall = mockChokidarWatcherOn.mock.calls[1];
        // let's make sure the first argument is not the 'ready' event,
        // just to be double safe
        expect(secondCall[0]).not.toBe('ready');
        // the second argument is the callback
        return secondCall[1];
    },
};
const mockChokidarWatch = jest.fn();
jest.mock('chokidar', () => ({
    watch: mockChokidarWatch,
}));
const fakeChokidarWatch = {
    get includeArgs() {
        expect(mockChokidarWatch.mock.calls.length).toBe(1);
        // the include args are the first parameter to the 'watch()' call
        return mockChokidarWatch.mock.calls[0][0];
    },
    get excludeArgs() {
        expect(mockChokidarWatch.mock.calls.length).toBe(1);
        // the ignore args are a property of the second parameter to the 'watch()' call
        const chokidarWatchOpts = mockChokidarWatch.mock.calls[0][1];
        return chokidarWatchOpts.ignored;
    },
};
const mockData = jest.fn();
jest.mock('../lib/logging', () => ({
    ...jest.requireActual('../lib/logging'),
    data: mockData,
}));
jest.setTimeout(30000);
require("aws-sdk-client-mock");
const os = require("os");
const path = require("path");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const fs = require("fs-extra");
const promptly = require("promptly");
const util_1 = require("./util");
const mock_sdk_1 = require("./util/mock-sdk");
const bootstrap_1 = require("../lib/api/bootstrap");
const deployments_1 = require("../lib/api/deployments");
const common_1 = require("../lib/api/hotswap/common");
const mode_1 = require("../lib/api/plugin/mode");
const cdk_toolkit_1 = require("../lib/cdk-toolkit");
const diff_1 = require("../lib/diff");
const settings_1 = require("../lib/settings");
const util_2 = require("../lib/util");
(0, cdk_toolkit_1.markTesting)();
const defaultBootstrapSource = { source: 'default' };
const bootstrapEnvironmentMock = jest.spyOn(bootstrap_1.Bootstrapper.prototype, 'bootstrapEnvironment');
let cloudExecutable;
let stderrMock;
beforeEach(() => {
    jest.resetAllMocks();
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    mockChokidarWatch.mockReturnValue(fakeChokidarWatcher);
    // on() in chokidar's Watcher returns 'this'
    mockChokidarWatcherOn.mockReturnValue(fakeChokidarWatcher);
    bootstrapEnvironmentMock.mockResolvedValue({
        noOp: false,
        outputs: {},
        type: 'did-deploy-stack',
        stackArn: 'fake-arn',
    });
    cloudExecutable = new util_1.MockCloudExecutable({
        stacks: [MockStack.MOCK_STACK_A, MockStack.MOCK_STACK_B],
        nestedAssemblies: [
            {
                stacks: [MockStack.MOCK_STACK_C],
            },
        ],
    });
    stderrMock = jest.spyOn(process.stderr, 'write').mockImplementation(() => {
        return true;
    });
});
function defaultToolkitSetup() {
    return new cdk_toolkit_1.CdkToolkit({
        cloudExecutable,
        configuration: cloudExecutable.configuration,
        sdkProvider: cloudExecutable.sdkProvider,
        deployments: new FakeCloudFormation({
            'Test-Stack-A': { Foo: 'Bar' },
            'Test-Stack-B': { Baz: 'Zinga!' },
            'Test-Stack-C': { Baz: 'Zinga!' },
        }),
    });
}
const mockSdk = new mock_sdk_1.MockSdk();
describe('readCurrentTemplate', () => {
    let template;
    let mockCloudExecutable;
    let sdkProvider;
    let mockForEnvironment;
    beforeEach(() => {
        jest.resetAllMocks();
        template = {
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Key: 'Value',
                    },
                },
            },
        };
        mockCloudExecutable = new util_1.MockCloudExecutable({
            stacks: [
                {
                    stackName: 'Test-Stack-C',
                    template,
                    properties: {
                        assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                        lookupRole: {
                            arn: 'bloop-lookup:${AWS::Region}:${AWS::AccountId}',
                            requiresBootstrapStackVersion: 5,
                            bootstrapStackVersionSsmParameter: '/bootstrap/parameter',
                        },
                    },
                },
                {
                    stackName: 'Test-Stack-A',
                    template,
                    properties: {
                        assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                    },
                },
            ],
        });
        sdkProvider = mockCloudExecutable.sdkProvider;
        mockForEnvironment = jest
            .spyOn(sdkProvider, 'forEnvironment')
            .mockResolvedValue({ sdk: mockSdk, didAssumeRole: true });
        mock_sdk_1.mockCloudFormationClient
            .on(client_cloudformation_1.GetTemplateCommand)
            .resolves({
            TemplateBody: JSON.stringify(template),
        })
            .on(client_cloudformation_1.DescribeStacksCommand)
            .resolves({
            Stacks: [
                {
                    StackName: 'Test-Stack-C',
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    CreationTime: new Date(),
                },
                {
                    StackName: 'Test-Stack-A',
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    CreationTime: new Date(),
                },
            ],
        });
    });
    test('lookup role is used', async () => {
        // GIVEN
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).resolves({ Parameter: { Value: '6' } });
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-C'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect(mock_sdk_1.mockSSMClient).toHaveReceivedCommandWith(client_ssm_1.GetParameterCommand, {
            Name: '/bootstrap/parameter',
        });
        expect(mockForEnvironment).toHaveBeenCalledTimes(2);
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop-lookup:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
    test('fallback to deploy role if bootstrap stack version is not valid', async () => {
        // GIVEN
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).resolves({ Parameter: { Value: '1' } });
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-C'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect((0, util_2.flatten)(stderrMock.mock.calls)).toEqual(expect.arrayContaining([
            expect.stringContaining("Bootstrap stack version '5' is required, found version '1'. To get rid of this error, please upgrade to bootstrap version >= 5"),
        ]));
        expect(mock_sdk_1.mockSSMClient).toHaveReceivedCommandWith(client_ssm_1.GetParameterCommand, {
            Name: '/bootstrap/parameter',
        });
        expect(mockForEnvironment).toHaveBeenCalledTimes(3);
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop-lookup:here:123456789012',
            assumeRoleExternalId: undefined,
        });
        expect(mockForEnvironment).toHaveBeenNthCalledWith(2, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
    test('fallback to deploy role if bootstrap version parameter not found', async () => {
        // GIVEN
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).callsFake(() => {
            const e = new Error('not found');
            e.code = e.name = 'ParameterNotFound';
            throw e;
        });
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-C'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect((0, util_2.flatten)(stderrMock.mock.calls)).toEqual(expect.arrayContaining([expect.stringMatching(/SSM parameter.*not found./)]));
        expect(mockForEnvironment).toHaveBeenCalledTimes(3);
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop-lookup:here:123456789012',
            assumeRoleExternalId: undefined,
        });
        expect(mockForEnvironment).toHaveBeenNthCalledWith(2, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
    test('fallback to deploy role if forEnvironment throws', async () => {
        // GIVEN
        // throw error first for the 'prepareSdkWithLookupRoleFor' call and succeed for the rest
        mockForEnvironment = jest.spyOn(sdkProvider, 'forEnvironment').mockImplementationOnce(() => {
            throw new Error('TheErrorThatGetsThrown');
        });
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-C'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect(mock_sdk_1.mockSSMClient).not.toHaveReceivedAnyCommand();
        expect((0, util_2.flatten)(stderrMock.mock.calls)).toEqual(expect.arrayContaining([expect.stringMatching(/TheErrorThatGetsThrown/)]));
        expect(mockForEnvironment).toHaveBeenCalledTimes(3);
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop-lookup:here:123456789012',
            assumeRoleExternalId: undefined,
        });
        expect(mockForEnvironment).toHaveBeenNthCalledWith(2, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: 'bloop:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
    test('dont lookup bootstrap version parameter if default credentials are used', async () => {
        // GIVEN
        mockForEnvironment = jest.fn().mockImplementation(() => {
            return { sdk: mockSdk, didAssumeRole: false };
        });
        mockCloudExecutable.sdkProvider.forEnvironment = mockForEnvironment;
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-C'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect((0, util_2.flatten)(stderrMock.mock.calls)).toEqual(expect.arrayContaining([
            expect.stringMatching(/Lookup role.*was not assumed. Proceeding with default credentials./),
        ]));
        expect(mock_sdk_1.mockSSMClient).not.toHaveReceivedAnyCommand();
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, mode_1.Mode.ForReading, {
            assumeRoleArn: 'bloop-lookup:here:123456789012',
            assumeRoleExternalId: undefined,
        });
        expect(mockForEnvironment).toHaveBeenNthCalledWith(2, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, mode_1.Mode.ForWriting, {
            assumeRoleArn: 'bloop:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
    test('do not print warnings if lookup role not provided in stack artifact', async () => {
        // GIVEN
        const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable: mockCloudExecutable,
            configuration: mockCloudExecutable.configuration,
            sdkProvider: mockCloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({
                sdkProvider: mockCloudExecutable.sdkProvider,
            }),
        });
        // WHEN
        await cdkToolkit.deploy({
            selector: { patterns: ['Test-Stack-A'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        // THEN
        expect((0, util_2.flatten)(stderrMock.mock.calls)).not.toEqual(expect.arrayContaining([
            expect.stringMatching(/Could not assume/),
            expect.stringMatching(/please upgrade to bootstrap version/),
        ]));
        expect(mock_sdk_1.mockSSMClient).not.toHaveReceivedAnyCommand();
        expect(mockForEnvironment).toHaveBeenCalledTimes(2);
        expect(mockForEnvironment).toHaveBeenNthCalledWith(1, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 0, {
            assumeRoleArn: undefined,
            assumeRoleExternalId: undefined,
        });
        expect(mockForEnvironment).toHaveBeenNthCalledWith(2, {
            account: '123456789012',
            name: 'aws://123456789012/here',
            region: 'here',
        }, 1, {
            assumeRoleArn: 'bloop:here:123456789012',
            assumeRoleExternalId: undefined,
        });
    });
});
describe('bootstrap', () => {
    test('accepts qualifier from context', async () => {
        // GIVEN
        const toolkit = defaultToolkitSetup();
        const configuration = new settings_1.Configuration();
        configuration.context.set('@aws-cdk/core:bootstrapQualifier', 'abcde');
        // WHEN
        await toolkit.bootstrap(['aws://56789/south-pole'], {
            source: defaultBootstrapSource,
            parameters: {
                qualifier: configuration.context.get('@aws-cdk/core:bootstrapQualifier'),
            },
        });
        // THEN
        expect(bootstrapEnvironmentMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
            parameters: {
                qualifier: 'abcde',
            },
            source: defaultBootstrapSource,
        });
    });
});
describe('deploy', () => {
    test('fails when no valid stack names are given', async () => {
        // GIVEN
        const toolkit = defaultToolkitSetup();
        // WHEN
        await expect(() => toolkit.deploy({
            selector: { patterns: ['Test-Stack-D'] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        })).rejects.toThrow('No stacks match the name(s) Test-Stack-D');
    });
    describe('with hotswap deployment', () => {
        test("passes through the 'hotswap' option to CloudFormationDeployments.deployStack()", async () => {
            // GIVEN
            const mockCfnDeployments = (0, util_1.instanceMockFrom)(deployments_1.Deployments);
            mockCfnDeployments.deployStack.mockReturnValue(Promise.resolve({
                type: 'did-deploy-stack',
                noOp: false,
                outputs: {},
                stackArn: 'stackArn',
                stackArtifact: (0, util_1.instanceMockFrom)(cxapi.CloudFormationStackArtifact),
            }));
            const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
                cloudExecutable,
                configuration: cloudExecutable.configuration,
                sdkProvider: cloudExecutable.sdkProvider,
                deployments: mockCfnDeployments,
            });
            // WHEN
            await cdkToolkit.deploy({
                selector: { patterns: ['Test-Stack-A-Display-Name'] },
                requireApproval: diff_1.RequireApproval.Never,
                hotswap: common_1.HotswapMode.FALL_BACK,
            });
            // THEN
            expect(mockCfnDeployments.deployStack).toHaveBeenCalledWith(expect.objectContaining({
                hotswap: common_1.HotswapMode.FALL_BACK,
            }));
        });
    });
    describe('makes correct CloudFormation calls', () => {
        test('without options', async () => {
            // GIVEN
            const toolkit = defaultToolkitSetup();
            // WHEN
            await toolkit.deploy({
                selector: { patterns: ['Test-Stack-A', 'Test-Stack-B'] },
                hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
            });
        });
        test('with stacks all stacks specified as double wildcard', async () => {
            // GIVEN
            const toolkit = defaultToolkitSetup();
            // WHEN
            await toolkit.deploy({
                selector: { patterns: ['**'] },
                hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
            });
        });
        test('with one stack specified', async () => {
            // GIVEN
            const toolkit = defaultToolkitSetup();
            // WHEN
            await toolkit.deploy({
                selector: { patterns: ['Test-Stack-A-Display-Name'] },
                hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
            });
        });
        test('with stacks all stacks specified as wildcard', async () => {
            // GIVEN
            const toolkit = defaultToolkitSetup();
            // WHEN
            await toolkit.deploy({
                selector: { patterns: ['*'] },
                hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
            });
        });
        describe('sns notification arns', () => {
            beforeEach(() => {
                cloudExecutable = new util_1.MockCloudExecutable({
                    stacks: [
                        MockStack.MOCK_STACK_A,
                        MockStack.MOCK_STACK_B,
                        MockStack.MOCK_STACK_WITH_NOTIFICATION_ARNS,
                        MockStack.MOCK_STACK_WITH_BAD_NOTIFICATION_ARNS,
                    ],
                });
            });
            test('with sns notification arns as options', async () => {
                // GIVEN
                const notificationArns = [
                    'arn:aws:sns:us-east-2:444455556666:MyTopic',
                    'arn:aws:sns:eu-west-1:111155556666:my-great-topic',
                ];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-A': { Foo: 'Bar' },
                    }, notificationArns),
                });
                // WHEN
                await toolkit.deploy({
                    // Stacks should be selected by their hierarchical ID, which is their displayName, not by the stack ID.
                    selector: { patterns: ['Test-Stack-A-Display-Name'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                });
            });
            test('fail with incorrect sns notification arns as options', async () => {
                // GIVEN
                const notificationArns = ['arn:::cfn-my-cool-topic'];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-A': { Foo: 'Bar' },
                    }, notificationArns),
                });
                // WHEN
                await expect(() => toolkit.deploy({
                    // Stacks should be selected by their hierarchical ID, which is their displayName, not by the stack ID.
                    selector: { patterns: ['Test-Stack-A-Display-Name'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                })).rejects.toThrow('Notification arn arn:::cfn-my-cool-topic is not a valid arn for an SNS topic');
            });
            test('with sns notification arns in the executable', async () => {
                // GIVEN
                const expectedNotificationArns = ['arn:aws:sns:bermuda-triangle-1337:123456789012:MyTopic'];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Notification-Arns': { Foo: 'Bar' },
                    }, expectedNotificationArns),
                });
                // WHEN
                await toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Notification-Arns'] },
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                });
            });
            test('fail with incorrect sns notification arns in the executable', async () => {
                // GIVEN
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Bad-Notification-Arns': { Foo: 'Bar' },
                    }),
                });
                // WHEN
                await expect(() => toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Bad-Notification-Arns'] },
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                })).rejects.toThrow('Notification arn arn:1337:123456789012:sns:bad is not a valid arn for an SNS topic');
            });
            test('with sns notification arns in the executable and as options', async () => {
                // GIVEN
                const notificationArns = [
                    'arn:aws:sns:us-east-2:444455556666:MyTopic',
                    'arn:aws:sns:eu-west-1:111155556666:my-great-topic',
                ];
                const expectedNotificationArns = notificationArns.concat([
                    'arn:aws:sns:bermuda-triangle-1337:123456789012:MyTopic',
                ]);
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Notification-Arns': { Foo: 'Bar' },
                    }, expectedNotificationArns),
                });
                // WHEN
                await toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Notification-Arns'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                });
            });
            test('fail with incorrect sns notification arns in the executable and incorrect sns notification arns as options', async () => {
                // GIVEN
                const notificationArns = ['arn:::cfn-my-cool-topic'];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Bad-Notification-Arns': { Foo: 'Bar' },
                    }, notificationArns),
                });
                // WHEN
                await expect(() => toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Bad-Notification-Arns'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                })).rejects.toThrow('Notification arn arn:::cfn-my-cool-topic is not a valid arn for an SNS topic');
            });
            test('fail with incorrect sns notification arns in the executable and correct sns notification arns as options', async () => {
                // GIVEN
                const notificationArns = ['arn:aws:sns:bermuda-triangle-1337:123456789012:MyTopic'];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Bad-Notification-Arns': { Foo: 'Bar' },
                    }, notificationArns),
                });
                // WHEN
                await expect(() => toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Bad-Notification-Arns'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                })).rejects.toThrow('Notification arn arn:1337:123456789012:sns:bad is not a valid arn for an SNS topic');
            });
            test('fail with correct sns notification arns in the executable and incorrect sns notification arns as options', async () => {
                // GIVEN
                const notificationArns = ['arn:::cfn-my-cool-topic'];
                const toolkit = new cdk_toolkit_1.CdkToolkit({
                    cloudExecutable,
                    configuration: cloudExecutable.configuration,
                    sdkProvider: cloudExecutable.sdkProvider,
                    deployments: new FakeCloudFormation({
                        'Test-Stack-Notification-Arns': { Foo: 'Bar' },
                    }, notificationArns),
                });
                // WHEN
                await expect(() => toolkit.deploy({
                    selector: { patterns: ['Test-Stack-Notification-Arns'] },
                    notificationArns,
                    hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
                })).rejects.toThrow('Notification arn arn:::cfn-my-cool-topic is not a valid arn for an SNS topic');
            });
        });
    });
    test('globless bootstrap uses environment without question', async () => {
        // GIVEN
        const toolkit = defaultToolkitSetup();
        // WHEN
        await toolkit.bootstrap(['aws://56789/south-pole'], {
            source: defaultBootstrapSource,
        });
        // THEN
        expect(bootstrapEnvironmentMock).toHaveBeenCalledWith({
            account: '56789',
            region: 'south-pole',
            name: 'aws://56789/south-pole',
        }, expect.anything(), expect.anything());
        expect(bootstrapEnvironmentMock).toHaveBeenCalledTimes(1);
    });
    test('globby bootstrap uses whats in the stacks', async () => {
        // GIVEN
        const toolkit = defaultToolkitSetup();
        cloudExecutable.configuration.settings.set(['app'], 'something');
        // WHEN
        await toolkit.bootstrap(['aws://*/bermuda-triangle-1'], {
            source: defaultBootstrapSource,
        });
        // THEN
        expect(bootstrapEnvironmentMock).toHaveBeenCalledWith({
            account: '123456789012',
            region: 'bermuda-triangle-1',
            name: 'aws://123456789012/bermuda-triangle-1',
        }, expect.anything(), expect.anything());
        expect(bootstrapEnvironmentMock).toHaveBeenCalledTimes(1);
    });
    test('bootstrap can be invoked without the --app argument', async () => {
        // GIVEN
        cloudExecutable.configuration.settings.clear();
        const mockSynthesize = jest.fn();
        cloudExecutable.synthesize = mockSynthesize;
        const toolkit = defaultToolkitSetup();
        // WHEN
        await toolkit.bootstrap(['aws://123456789012/west-pole'], {
            source: defaultBootstrapSource,
        });
        // THEN
        expect(bootstrapEnvironmentMock).toHaveBeenCalledWith({
            account: '123456789012',
            region: 'west-pole',
            name: 'aws://123456789012/west-pole',
        }, expect.anything(), expect.anything());
        expect(bootstrapEnvironmentMock).toHaveBeenCalledTimes(1);
        expect(cloudExecutable.hasApp).toEqual(false);
        expect(mockSynthesize).not.toHaveBeenCalled();
    });
});
describe('destroy', () => {
    test('destroy correct stack', async () => {
        const toolkit = defaultToolkitSetup();
        expect(() => {
            return toolkit.destroy({
                selector: { patterns: ['Test-Stack-A/Test-Stack-C'] },
                exclusively: true,
                force: true,
                fromDeploy: true,
            });
        }).resolves;
    });
});
describe('watch', () => {
    test("fails when no 'watch' settings are found", async () => {
        const toolkit = defaultToolkitSetup();
        await expect(() => {
            return toolkit.watch({
                selector: { patterns: [] },
                hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
            });
        }).rejects.toThrow("Cannot use the 'watch' command without specifying at least one directory to monitor. " +
            'Make sure to add a "watch" key to your cdk.json');
    });
    test('observes only the root directory by default', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        const includeArgs = fakeChokidarWatch.includeArgs;
        expect(includeArgs.length).toBe(1);
    });
    test("allows providing a single string in 'watch.include'", async () => {
        cloudExecutable.configuration.settings.set(['watch'], {
            include: 'my-dir',
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        expect(fakeChokidarWatch.includeArgs).toStrictEqual(['my-dir']);
    });
    test("allows providing an array of strings in 'watch.include'", async () => {
        cloudExecutable.configuration.settings.set(['watch'], {
            include: ['my-dir1', '**/my-dir2/*'],
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        expect(fakeChokidarWatch.includeArgs).toStrictEqual(['my-dir1', '**/my-dir2/*']);
    });
    test('ignores the output dir, dot files, dot directories, and node_modules by default', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        cloudExecutable.configuration.settings.set(['output'], 'cdk.out');
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        expect(fakeChokidarWatch.excludeArgs).toStrictEqual(['cdk.out/**', '**/.*', '**/.*/**', '**/node_modules/**']);
    });
    test("allows providing a single string in 'watch.exclude'", async () => {
        cloudExecutable.configuration.settings.set(['watch'], {
            exclude: 'my-dir',
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        const excludeArgs = fakeChokidarWatch.excludeArgs;
        expect(excludeArgs.length).toBe(5);
        expect(excludeArgs[0]).toBe('my-dir');
    });
    test("allows providing an array of strings in 'watch.exclude'", async () => {
        cloudExecutable.configuration.settings.set(['watch'], {
            exclude: ['my-dir1', '**/my-dir2'],
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        const excludeArgs = fakeChokidarWatch.excludeArgs;
        expect(excludeArgs.length).toBe(6);
        expect(excludeArgs[0]).toBe('my-dir1');
        expect(excludeArgs[1]).toBe('**/my-dir2');
    });
    test('allows watching with deploy concurrency', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        const toolkit = defaultToolkitSetup();
        const cdkDeployMock = jest.fn();
        toolkit.deploy = cdkDeployMock;
        await toolkit.watch({
            selector: { patterns: [] },
            concurrency: 3,
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        fakeChokidarWatcherOn.readyCallback();
        expect(cdkDeployMock).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 3 }));
    });
    describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
        test('passes through the correct hotswap mode to deployStack()', async () => {
            cloudExecutable.configuration.settings.set(['watch'], {});
            const toolkit = defaultToolkitSetup();
            const cdkDeployMock = jest.fn();
            toolkit.deploy = cdkDeployMock;
            await toolkit.watch({
                selector: { patterns: [] },
                hotswap: hotswapMode,
            });
            fakeChokidarWatcherOn.readyCallback();
            expect(cdkDeployMock).toHaveBeenCalledWith(expect.objectContaining({ hotswap: hotswapMode }));
        });
    });
    test('respects HotswapMode.HOTSWAP_ONLY', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        const toolkit = defaultToolkitSetup();
        const cdkDeployMock = jest.fn();
        toolkit.deploy = cdkDeployMock;
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        });
        fakeChokidarWatcherOn.readyCallback();
        expect(cdkDeployMock).toHaveBeenCalledWith(expect.objectContaining({ hotswap: common_1.HotswapMode.HOTSWAP_ONLY }));
    });
    test('respects HotswapMode.FALL_BACK', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        const toolkit = defaultToolkitSetup();
        const cdkDeployMock = jest.fn();
        toolkit.deploy = cdkDeployMock;
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.FALL_BACK,
        });
        fakeChokidarWatcherOn.readyCallback();
        expect(cdkDeployMock).toHaveBeenCalledWith(expect.objectContaining({ hotswap: common_1.HotswapMode.FALL_BACK }));
    });
    test('respects HotswapMode.FULL_DEPLOYMENT', async () => {
        cloudExecutable.configuration.settings.set(['watch'], {});
        const toolkit = defaultToolkitSetup();
        const cdkDeployMock = jest.fn();
        toolkit.deploy = cdkDeployMock;
        await toolkit.watch({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
        });
        fakeChokidarWatcherOn.readyCallback();
        expect(cdkDeployMock).toHaveBeenCalledWith(expect.objectContaining({ hotswap: common_1.HotswapMode.FULL_DEPLOYMENT }));
    });
    describe('with file change events', () => {
        let toolkit;
        let cdkDeployMock;
        beforeEach(async () => {
            cloudExecutable.configuration.settings.set(['watch'], {});
            toolkit = defaultToolkitSetup();
            cdkDeployMock = jest.fn();
            toolkit.deploy = cdkDeployMock;
            await toolkit.watch({
                selector: { patterns: [] },
                hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
            });
        });
        test("does not trigger a 'deploy' before the 'ready' event has fired", async () => {
            await fakeChokidarWatcherOn.fileEventCallback('add', 'my-file');
            expect(cdkDeployMock).not.toHaveBeenCalled();
        });
        describe("when the 'ready' event has already fired", () => {
            beforeEach(() => {
                // The ready callback triggers a deployment so each test
                // that uses this function will see 'cdkDeployMock' called
                // an additional time.
                fakeChokidarWatcherOn.readyCallback();
            });
            test("an initial 'deploy' is triggered, without any file changes", async () => {
                expect(cdkDeployMock).toHaveBeenCalledTimes(1);
            });
            test("does trigger a 'deploy' for a file change", async () => {
                await fakeChokidarWatcherOn.fileEventCallback('add', 'my-file');
                expect(cdkDeployMock).toHaveBeenCalledTimes(2);
            });
            test("triggers a 'deploy' twice for two file changes", async () => {
                // eslint-disable-next-line @cdklabs/promiseall-no-unbounded-parallelism
                await Promise.all([
                    fakeChokidarWatcherOn.fileEventCallback('add', 'my-file1'),
                    fakeChokidarWatcherOn.fileEventCallback('change', 'my-file2'),
                ]);
                expect(cdkDeployMock).toHaveBeenCalledTimes(3);
            });
            test("batches file changes that happen during 'deploy'", async () => {
                // eslint-disable-next-line @cdklabs/promiseall-no-unbounded-parallelism
                await Promise.all([
                    fakeChokidarWatcherOn.fileEventCallback('add', 'my-file1'),
                    fakeChokidarWatcherOn.fileEventCallback('change', 'my-file2'),
                    fakeChokidarWatcherOn.fileEventCallback('unlink', 'my-file3'),
                    fakeChokidarWatcherOn.fileEventCallback('add', 'my-file4'),
                ]);
                expect(cdkDeployMock).toHaveBeenCalledTimes(3);
            });
        });
    });
});
describe('synth', () => {
    test('successful synth outputs hierarchical stack ids', async () => {
        const toolkit = defaultToolkitSetup();
        await toolkit.synth([], false, false);
        // Separate tests as colorizing hampers detection
        expect(stderrMock.mock.calls[1][0]).toMatch('Test-Stack-A-Display-Name');
        expect(stderrMock.mock.calls[1][0]).toMatch('Test-Stack-B');
    });
    test('with no stdout option', async () => {
        // GIVE
        const toolkit = defaultToolkitSetup();
        // THEN
        await toolkit.synth(['Test-Stack-A-Display-Name'], false, true);
        expect(mockData.mock.calls.length).toEqual(0);
    });
    describe('migrate', () => {
        const testResourcePath = [__dirname, 'commands', 'test-resources'];
        const templatePath = [...testResourcePath, 'templates'];
        const sqsTemplatePath = path.join(...templatePath, 'sqs-template.json');
        const autoscalingTemplatePath = path.join(...templatePath, 'autoscaling-template.yml');
        const s3TemplatePath = path.join(...templatePath, 's3-template.json');
        test('migrate fails when both --from-path and --from-stack are provided', async () => {
            const toolkit = defaultToolkitSetup();
            await expect(() => toolkit.migrate({
                stackName: 'no-source',
                fromPath: './here/template.yml',
                fromStack: true,
            })).rejects.toThrow('Only one of `--from-path` or `--from-stack` may be provided.');
            expect(stderrMock.mock.calls[1][0]).toContain(' ❌  Migrate failed for `no-source`: Only one of `--from-path` or `--from-stack` may be provided.');
        });
        test('migrate fails when --from-path is invalid', async () => {
            const toolkit = defaultToolkitSetup();
            await expect(() => toolkit.migrate({
                stackName: 'bad-local-source',
                fromPath: './here/template.yml',
            })).rejects.toThrow("'./here/template.yml' is not a valid path.");
            expect(stderrMock.mock.calls[1][0]).toContain(" ❌  Migrate failed for `bad-local-source`: './here/template.yml' is not a valid path.");
        });
        test('migrate fails when --from-stack is used and stack does not exist in account', async () => {
            const mockSdkProvider = new mock_sdk_1.MockSdkProvider();
            mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).rejects(new Error('Stack does not exist in this environment'));
            const mockCloudExecutable = new util_1.MockCloudExecutable({
                stacks: [],
            });
            const cdkToolkit = new cdk_toolkit_1.CdkToolkit({
                cloudExecutable: mockCloudExecutable,
                deployments: new deployments_1.Deployments({ sdkProvider: mockSdkProvider }),
                sdkProvider: mockSdkProvider,
                configuration: mockCloudExecutable.configuration,
            });
            await expect(() => cdkToolkit.migrate({
                stackName: 'bad-cloudformation-source',
                fromStack: true,
            })).rejects.toThrow('Stack does not exist in this environment');
            expect(stderrMock.mock.calls[1][0]).toContain(' ❌  Migrate failed for `bad-cloudformation-source`: Stack does not exist in this environment');
        });
        test('migrate fails when stack cannot be generated', async () => {
            const toolkit = defaultToolkitSetup();
            await expect(() => toolkit.migrate({
                stackName: 'cannot-generate-template',
                fromPath: path.join(__dirname, 'commands', 'test-resources', 'templates', 'sqs-template.json'),
                language: 'rust',
            })).rejects.toThrow('CannotGenerateTemplateStack could not be generated because rust is not a supported language');
            expect(stderrMock.mock.calls[1][0]).toContain(' ❌  Migrate failed for `cannot-generate-template`: CannotGenerateTemplateStack could not be generated because rust is not a supported language');
        });
        cliTest('migrate succeeds for valid template from local path when no language is provided', async (workDir) => {
            const toolkit = defaultToolkitSetup();
            await toolkit.migrate({
                stackName: 'SQSTypeScript',
                fromPath: sqsTemplatePath,
                outputPath: workDir,
            });
            // Packages created for typescript
            expect(fs.pathExistsSync(path.join(workDir, 'SQSTypeScript', 'package.json'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'SQSTypeScript', 'bin', 'sqs_type_script.ts'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'SQSTypeScript', 'lib', 'sqs_type_script-stack.ts'))).toBeTruthy();
        });
        cliTest('migrate succeeds for valid template from local path when language is provided', async (workDir) => {
            const toolkit = defaultToolkitSetup();
            await toolkit.migrate({
                stackName: 'S3Python',
                fromPath: s3TemplatePath,
                outputPath: workDir,
                language: 'python',
            });
            // Packages created for typescript
            expect(fs.pathExistsSync(path.join(workDir, 'S3Python', 'requirements.txt'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'S3Python', 'app.py'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'S3Python', 's3_python', 's3_python_stack.py'))).toBeTruthy();
        });
        cliTest('migrate call is idempotent', async (workDir) => {
            const toolkit = defaultToolkitSetup();
            await toolkit.migrate({
                stackName: 'AutoscalingCSharp',
                fromPath: autoscalingTemplatePath,
                outputPath: workDir,
                language: 'csharp',
            });
            // Packages created for typescript
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp.sln'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp', 'Program.cs'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp', 'AutoscalingCSharpStack.cs'))).toBeTruthy();
            // One more time
            await toolkit.migrate({
                stackName: 'AutoscalingCSharp',
                fromPath: autoscalingTemplatePath,
                outputPath: workDir,
                language: 'csharp',
            });
            // Packages created for typescript
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp.sln'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp', 'Program.cs'))).toBeTruthy();
            expect(fs.pathExistsSync(path.join(workDir, 'AutoscalingCSharp', 'src', 'AutoscalingCSharp', 'AutoscalingCSharpStack.cs'))).toBeTruthy();
        });
    });
    describe('stack with error and flagged for validation', () => {
        beforeEach(() => {
            cloudExecutable = new util_1.MockCloudExecutable({
                stacks: [MockStack.MOCK_STACK_A, MockStack.MOCK_STACK_B],
                nestedAssemblies: [
                    {
                        stacks: [
                            {
                                properties: { validateOnSynth: true },
                                ...MockStack.MOCK_STACK_WITH_ERROR,
                            },
                        ],
                    },
                ],
            });
        });
        test('causes synth to fail if autoValidate=true', async () => {
            const toolkit = defaultToolkitSetup();
            const autoValidate = true;
            await expect(toolkit.synth([], false, true, autoValidate)).rejects.toBeDefined();
        });
        test('causes synth to succeed if autoValidate=false', async () => {
            const toolkit = defaultToolkitSetup();
            const autoValidate = false;
            await toolkit.synth([], false, true, autoValidate);
            expect(mockData.mock.calls.length).toEqual(0);
        });
    });
    test('stack has error and was explicitly selected', async () => {
        cloudExecutable = new util_1.MockCloudExecutable({
            stacks: [MockStack.MOCK_STACK_A, MockStack.MOCK_STACK_B],
            nestedAssemblies: [
                {
                    stacks: [
                        {
                            properties: { validateOnSynth: false },
                            ...MockStack.MOCK_STACK_WITH_ERROR,
                        },
                    ],
                },
            ],
        });
        const toolkit = defaultToolkitSetup();
        await expect(toolkit.synth(['Test-Stack-A/witherrors'], false, true)).rejects.toBeDefined();
    });
    test('stack has error, is not flagged for validation and was not explicitly selected', async () => {
        cloudExecutable = new util_1.MockCloudExecutable({
            stacks: [MockStack.MOCK_STACK_A, MockStack.MOCK_STACK_B],
            nestedAssemblies: [
                {
                    stacks: [
                        {
                            properties: { validateOnSynth: false },
                            ...MockStack.MOCK_STACK_WITH_ERROR,
                        },
                    ],
                },
            ],
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.synth([], false, true);
    });
    test('stack has dependency and was explicitly selected', async () => {
        cloudExecutable = new util_1.MockCloudExecutable({
            stacks: [MockStack.MOCK_STACK_C, MockStack.MOCK_STACK_D],
        });
        const toolkit = defaultToolkitSetup();
        await toolkit.synth([MockStack.MOCK_STACK_D.stackName], true, false);
        expect(mockData.mock.calls.length).toEqual(1);
        expect(mockData.mock.calls[0][0]).toBeDefined();
    });
    test('rollback uses deployment role', async () => {
        cloudExecutable = new util_1.MockCloudExecutable({
            stacks: [MockStack.MOCK_STACK_C],
        });
        const mockedRollback = jest.spyOn(deployments_1.Deployments.prototype, 'rollbackStack').mockResolvedValue({
            success: true,
        });
        const toolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable,
            configuration: cloudExecutable.configuration,
            sdkProvider: cloudExecutable.sdkProvider,
            deployments: new deployments_1.Deployments({ sdkProvider: new mock_sdk_1.MockSdkProvider() }),
        });
        await toolkit.rollback({
            selector: { patterns: [] },
        });
        expect(mockedRollback).toHaveBeenCalled();
    });
    test.each([
        [{ type: 'failpaused-need-rollback-first', reason: 'replacement', status: 'OOPS' }, false],
        [{ type: 'failpaused-need-rollback-first', reason: 'replacement', status: 'OOPS' }, true],
        [{ type: 'failpaused-need-rollback-first', reason: 'not-norollback', status: 'OOPS' }, false],
        [{ type: 'replacement-requires-rollback' }, false],
        [{ type: 'replacement-requires-rollback' }, true],
    ])('no-rollback deployment that cant proceed will be called with rollback on retry: %p (using force: %p)', async (firstResult, useForce) => {
        cloudExecutable = new util_1.MockCloudExecutable({
            stacks: [
                MockStack.MOCK_STACK_C,
            ],
        });
        const deployments = new deployments_1.Deployments({ sdkProvider: new mock_sdk_1.MockSdkProvider() });
        // Rollback might be called -- just don't do nothing.
        const mockRollbackStack = jest.spyOn(deployments, 'rollbackStack').mockResolvedValue({});
        const mockedDeployStack = jest
            .spyOn(deployments, 'deployStack')
            .mockResolvedValueOnce(firstResult)
            .mockResolvedValueOnce({
            type: 'did-deploy-stack',
            noOp: false,
            outputs: {},
            stackArn: 'stack:arn',
        });
        const mockedConfirm = jest.spyOn(promptly, 'confirm').mockResolvedValue(true);
        const toolkit = new cdk_toolkit_1.CdkToolkit({
            cloudExecutable,
            configuration: cloudExecutable.configuration,
            sdkProvider: cloudExecutable.sdkProvider,
            deployments,
        });
        await toolkit.deploy({
            selector: { patterns: [] },
            hotswap: common_1.HotswapMode.FULL_DEPLOYMENT,
            rollback: false,
            requireApproval: diff_1.RequireApproval.Never,
            force: useForce,
        });
        if (firstResult.type === 'failpaused-need-rollback-first') {
            expect(mockRollbackStack).toHaveBeenCalled();
        }
        if (!useForce) {
            // Questions will have been asked only if --force is not specified
            if (firstResult.type === 'failpaused-need-rollback-first') {
                expect(mockedConfirm).toHaveBeenCalledWith(expect.stringContaining('Roll back first and then proceed with deployment'));
            }
            else {
                expect(mockedConfirm).toHaveBeenCalledWith(expect.stringContaining('Perform a regular deployment'));
            }
        }
        expect(mockedDeployStack).toHaveBeenNthCalledWith(1, expect.objectContaining({ rollback: false }));
        expect(mockedDeployStack).toHaveBeenNthCalledWith(2, expect.objectContaining({ rollback: true }));
    });
});
class MockStack {
}
MockStack.MOCK_STACK_A = {
    stackName: 'Test-Stack-A',
    template: { Resources: { TemplateName: 'Test-Stack-A' } },
    env: 'aws://123456789012/bermuda-triangle-1',
    metadata: {
        '/Test-Stack-A': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Foo', value: 'Bar' }],
            },
        ],
    },
    displayName: 'Test-Stack-A-Display-Name',
};
MockStack.MOCK_STACK_B = {
    stackName: 'Test-Stack-B',
    template: { Resources: { TemplateName: 'Test-Stack-B' } },
    env: 'aws://123456789012/bermuda-triangle-1',
    metadata: {
        '/Test-Stack-B': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Baz', value: 'Zinga!' }],
            },
        ],
    },
};
MockStack.MOCK_STACK_C = {
    stackName: 'Test-Stack-C',
    template: { Resources: { TemplateName: 'Test-Stack-C' } },
    env: 'aws://123456789012/bermuda-triangle-1',
    metadata: {
        '/Test-Stack-C': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Baz', value: 'Zinga!' }],
            },
        ],
    },
    displayName: 'Test-Stack-A/Test-Stack-C',
};
MockStack.MOCK_STACK_D = {
    stackName: 'Test-Stack-D',
    template: { Resources: { TemplateName: 'Test-Stack-D' } },
    env: 'aws://123456789012/bermuda-triangle-1',
    metadata: {
        '/Test-Stack-D': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Baz', value: 'Zinga!' }],
            },
        ],
    },
    depends: [MockStack.MOCK_STACK_C.stackName],
};
MockStack.MOCK_STACK_WITH_ERROR = {
    stackName: 'witherrors',
    env: 'aws://123456789012/bermuda-triangle-1',
    template: { resource: 'errorresource' },
    metadata: {
        '/resource': [
            {
                type: cxschema.ArtifactMetadataEntryType.ERROR,
                data: 'this is an error',
            },
        ],
    },
    displayName: 'Test-Stack-A/witherrors',
};
MockStack.MOCK_STACK_WITH_ASSET = {
    stackName: 'Test-Stack-Asset',
    template: { Resources: { TemplateName: 'Test-Stack-Asset' } },
    env: 'aws://123456789012/bermuda-triangle-1',
    assetManifest: {
        version: cloud_assembly_schema_1.Manifest.version(),
        files: {
            xyz: {
                source: {
                    path: path.resolve(__dirname, '..', 'LICENSE'),
                },
                destinations: {},
            },
        },
    },
};
MockStack.MOCK_STACK_WITH_NOTIFICATION_ARNS = {
    stackName: 'Test-Stack-Notification-Arns',
    notificationArns: ['arn:aws:sns:bermuda-triangle-1337:123456789012:MyTopic'],
    template: { Resources: { TemplateName: 'Test-Stack-Notification-Arns' } },
    env: 'aws://123456789012/bermuda-triangle-1337',
    metadata: {
        '/Test-Stack-Notification-Arns': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Foo', value: 'Bar' }],
            },
        ],
    },
};
MockStack.MOCK_STACK_WITH_BAD_NOTIFICATION_ARNS = {
    stackName: 'Test-Stack-Bad-Notification-Arns',
    notificationArns: ['arn:1337:123456789012:sns:bad'],
    template: { Resources: { TemplateName: 'Test-Stack-Bad-Notification-Arns' } },
    env: 'aws://123456789012/bermuda-triangle-1337',
    metadata: {
        '/Test-Stack-Bad-Notification-Arns': [
            {
                type: cxschema.ArtifactMetadataEntryType.STACK_TAGS,
                data: [{ key: 'Foo', value: 'Bar' }],
            },
        ],
    },
};
class FakeCloudFormation extends deployments_1.Deployments {
    constructor(expectedTags = {}, expectedNotificationArns) {
        super({ sdkProvider: new mock_sdk_1.MockSdkProvider() });
        this.expectedTags = {};
        for (const [stackName, tags] of Object.entries(expectedTags)) {
            this.expectedTags[stackName] = Object.entries(tags)
                .map(([Key, Value]) => ({ Key, Value }))
                .sort((l, r) => l.Key.localeCompare(r.Key));
        }
        this.expectedNotificationArns = expectedNotificationArns;
    }
    deployStack(options) {
        expect([
            MockStack.MOCK_STACK_A.stackName,
            MockStack.MOCK_STACK_B.stackName,
            MockStack.MOCK_STACK_C.stackName,
            // MockStack.MOCK_STACK_D deliberately omitted.
            MockStack.MOCK_STACK_WITH_ASSET.stackName,
            MockStack.MOCK_STACK_WITH_ERROR.stackName,
            MockStack.MOCK_STACK_WITH_NOTIFICATION_ARNS.stackName,
            MockStack.MOCK_STACK_WITH_BAD_NOTIFICATION_ARNS.stackName,
        ]).toContain(options.stack.stackName);
        if (this.expectedTags[options.stack.stackName]) {
            expect(options.tags).toEqual(this.expectedTags[options.stack.stackName]);
        }
        // In these tests, we don't make a distinction here between `undefined` and `[]`.
        //
        // In tests `deployStack` itself we do treat `undefined` and `[]` differently,
        // and in `aws-cdk-lib` we emit them under different conditions. But this test
        // without normalization depends on a version of `aws-cdk-lib` that hasn't been
        // released yet.
        expect(options.notificationArns ?? []).toEqual(this.expectedNotificationArns ?? []);
        return Promise.resolve({
            type: 'did-deploy-stack',
            stackArn: `arn:aws:cloudformation:::stack/${options.stack.stackName}/MockedOut`,
            noOp: false,
            outputs: { StackName: options.stack.stackName },
            stackArtifact: options.stack,
        });
    }
    rollbackStack(_options) {
        return Promise.resolve({
            success: true,
        });
    }
    destroyStack(options) {
        expect(options.stack).toBeDefined();
        return Promise.resolve();
    }
    readCurrentTemplate(stack) {
        switch (stack.stackName) {
            case MockStack.MOCK_STACK_A.stackName:
                return Promise.resolve({});
            case MockStack.MOCK_STACK_B.stackName:
                return Promise.resolve({});
            case MockStack.MOCK_STACK_C.stackName:
                return Promise.resolve({});
            case MockStack.MOCK_STACK_WITH_ASSET.stackName:
                return Promise.resolve({});
            case MockStack.MOCK_STACK_WITH_NOTIFICATION_ARNS.stackName:
                return Promise.resolve({});
            case MockStack.MOCK_STACK_WITH_BAD_NOTIFICATION_ARNS.stackName:
                return Promise.resolve({});
            default:
                throw new Error(`not an expected mock stack: ${stack.stackName}`);
        }
    }
}
function cliTest(name, handler) {
    test(name, () => withTempDir(handler));
}
async function withTempDir(cb) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aws-cdk-test'));
    try {
        await cb(tmpDir);
    }
    finally {
        await fs.remove(tmpDir);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXRvb2xraXQudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay10b29sa2l0LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw0REFBNEQ7QUFDNUQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7QUFDeEMsTUFBTSxtQkFBbUIsR0FBRztJQUMxQixFQUFFLEVBQUUscUJBQXFCO0NBQzFCLENBQUM7QUFDRixNQUFNLHFCQUFxQixHQUFHO0lBQzVCLElBQUksYUFBYTtRQUNmLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFFLGdHQUFnRztRQUNoRyxpRUFBaUU7UUFDakUsaUVBQWlFO1FBQ2pFLE1BQU0sU0FBUyxHQUFHLHFCQUFxQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEQsMkRBQTJEO1FBQzNELHlCQUF5QjtRQUN6QixNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25DLHNDQUFzQztRQUN0QyxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBSSxpQkFBaUI7UUFJbkIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUUsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RCwrREFBK0Q7UUFDL0QseUJBQXlCO1FBQ3pCLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hDLHNDQUFzQztRQUN0QyxPQUFPLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2QixDQUFDO0NBQ0YsQ0FBQztBQUVGLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDM0IsS0FBSyxFQUFFLGlCQUFpQjtDQUN6QixDQUFDLENBQUMsQ0FBQztBQUNKLE1BQU0saUJBQWlCLEdBQUc7SUFDeEIsSUFBSSxXQUFXO1FBQ2IsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELGlFQUFpRTtRQUNqRSxPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQUksV0FBVztRQUNiLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCwrRUFBK0U7UUFDL0UsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdELE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDO0lBQ25DLENBQUM7Q0FDRixDQUFDO0FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNqQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUM7SUFDdkMsSUFBSSxFQUFFLFFBQVE7Q0FDZixDQUFDLENBQUMsQ0FBQztBQUNKLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBTSxDQUFDLENBQUM7QUFFeEIsK0JBQTZCO0FBQzdCLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFDN0IsMkRBQTJEO0FBQzNELDBFQUEwRDtBQUMxRCx5Q0FBeUM7QUFDekMsMEVBQXdHO0FBQ3hHLG9EQUEwRDtBQUMxRCwrQkFBK0I7QUFDL0IscUNBQXFDO0FBQ3JDLGlDQUFrRjtBQUVsRiw4Q0FNeUI7QUFDekIsb0RBQTBFO0FBRTFFLHdEQU1nQztBQUNoQyxzREFBd0Q7QUFDeEQsaURBQThDO0FBRTlDLG9EQUFrRTtBQUNsRSxzQ0FBOEM7QUFDOUMsOENBQWdEO0FBQ2hELHNDQUFzQztBQUV0QyxJQUFBLHlCQUFXLEdBQUUsQ0FBQztBQUVkLE1BQU0sc0JBQXNCLEdBQW9CLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDO0FBQ3RFLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyx3QkFBWSxDQUFDLFNBQVMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0FBQzVGLElBQUksZUFBb0MsQ0FBQztBQUN6QyxJQUFJLFVBQTRCLENBQUM7QUFDakMsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUNyQixJQUFBLG1DQUF3QixHQUFFLENBQUM7SUFFM0IsaUJBQWlCLENBQUMsZUFBZSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDdkQsNENBQTRDO0lBQzVDLHFCQUFxQixDQUFDLGVBQWUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBRTNELHdCQUF3QixDQUFDLGlCQUFpQixDQUFDO1FBQ3pDLElBQUksRUFBRSxLQUFLO1FBQ1gsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLFFBQVEsRUFBRSxVQUFVO0tBQ3JCLENBQUMsQ0FBQztJQUVILGVBQWUsR0FBRyxJQUFJLDBCQUFtQixDQUFDO1FBQ3hDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQztRQUN4RCxnQkFBZ0IsRUFBRTtZQUNoQjtnQkFDRSxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDO2FBQ2pDO1NBQ0Y7S0FDRixDQUFDLENBQUM7SUFFSCxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRTtRQUN2RSxPQUFPLElBQUksQ0FBQztJQUNkLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFTLG1CQUFtQjtJQUMxQixPQUFPLElBQUksd0JBQVUsQ0FBQztRQUNwQixlQUFlO1FBQ2YsYUFBYSxFQUFFLGVBQWUsQ0FBQyxhQUFhO1FBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztRQUN4QyxXQUFXLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQztZQUNsQyxjQUFjLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFO1lBQzlCLGNBQWMsRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUU7WUFDakMsY0FBYyxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRTtTQUNsQyxDQUFDO0tBQ0gsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO0FBRTlCLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7SUFDbkMsSUFBSSxRQUFhLENBQUM7SUFDbEIsSUFBSSxtQkFBd0MsQ0FBQztJQUM3QyxJQUFJLFdBQXdCLENBQUM7SUFDN0IsSUFBSSxrQkFBdUIsQ0FBQztJQUM1QixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3JCLFFBQVEsR0FBRztZQUNULFNBQVMsRUFBRTtnQkFDVCxJQUFJLEVBQUU7b0JBQ0osSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsVUFBVSxFQUFFO3dCQUNWLEdBQUcsRUFBRSxPQUFPO3FCQUNiO2lCQUNGO2FBQ0Y7U0FDRixDQUFDO1FBQ0YsbUJBQW1CLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztZQUM1QyxNQUFNLEVBQUU7Z0JBQ047b0JBQ0UsU0FBUyxFQUFFLGNBQWM7b0JBQ3pCLFFBQVE7b0JBQ1IsVUFBVSxFQUFFO3dCQUNWLGFBQWEsRUFBRSx3Q0FBd0M7d0JBQ3ZELFVBQVUsRUFBRTs0QkFDVixHQUFHLEVBQUUsK0NBQStDOzRCQUNwRCw2QkFBNkIsRUFBRSxDQUFDOzRCQUNoQyxpQ0FBaUMsRUFBRSxzQkFBc0I7eUJBQzFEO3FCQUNGO2lCQUNGO2dCQUNEO29CQUNFLFNBQVMsRUFBRSxjQUFjO29CQUN6QixRQUFRO29CQUNSLFVBQVUsRUFBRTt3QkFDVixhQUFhLEVBQUUsd0NBQXdDO3FCQUN4RDtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsV0FBVyxHQUFHLG1CQUFtQixDQUFDLFdBQVcsQ0FBQztRQUM5QyxrQkFBa0IsR0FBRyxJQUFJO2FBQ3RCLEtBQUssQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUM7YUFDcEMsaUJBQWlCLENBQUMsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzVELG1DQUF3QjthQUNyQixFQUFFLENBQUMsMENBQWtCLENBQUM7YUFDdEIsUUFBUSxDQUFDO1lBQ1IsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1NBQ3ZDLENBQUM7YUFDRCxFQUFFLENBQUMsNkNBQXFCLENBQUM7YUFDekIsUUFBUSxDQUFDO1lBQ1IsTUFBTSxFQUFFO2dCQUNOO29CQUNFLFNBQVMsRUFBRSxjQUFjO29CQUN6QixXQUFXLEVBQUUsbUNBQVcsQ0FBQyxlQUFlO29CQUN4QyxZQUFZLEVBQUUsSUFBSSxJQUFJLEVBQUU7aUJBQ3pCO2dCQUNEO29CQUNFLFNBQVMsRUFBRSxjQUFjO29CQUN6QixXQUFXLEVBQUUsbUNBQVcsQ0FBQyxlQUFlO29CQUN4QyxZQUFZLEVBQUUsSUFBSSxJQUFJLEVBQUU7aUJBQ3pCO2FBQ0Y7U0FDRixDQUFDLENBQUM7SUFDUCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxxQkFBcUIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNyQyxRQUFRO1FBQ1Isd0JBQWEsQ0FBQyxFQUFFLENBQUMsZ0NBQW1CLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRTlFLE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQztZQUNoQyxlQUFlLEVBQUUsbUJBQW1CO1lBQ3BDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQyxhQUFhO1lBQ2hELFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO1lBQzVDLFdBQVcsRUFBRSxJQUFJLHlCQUFXLENBQUM7Z0JBQzNCLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO2FBQzdDLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ3RCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ3hDLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMseUJBQXlCLENBQUMsZ0NBQW1CLEVBQUU7WUFDbkUsSUFBSSxFQUFFLHNCQUFzQjtTQUM3QixDQUFDLENBQUM7UUFDSCxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyx1QkFBdUIsQ0FDaEQsQ0FBQyxFQUNEO1lBQ0UsT0FBTyxFQUFFLGNBQWM7WUFDdkIsSUFBSSxFQUFFLHlCQUF5QjtZQUMvQixNQUFNLEVBQUUsTUFBTTtTQUNmLEVBQ0QsQ0FBQyxFQUNEO1lBQ0UsYUFBYSxFQUFFLGdDQUFnQztZQUMvQyxvQkFBb0IsRUFBRSxTQUFTO1NBQ2hDLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGlFQUFpRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2pGLFFBQVE7UUFDUix3QkFBYSxDQUFDLEVBQUUsQ0FBQyxnQ0FBbUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFOUUsTUFBTSxVQUFVLEdBQUcsSUFBSSx3QkFBVSxDQUFDO1lBQ2hDLGVBQWUsRUFBRSxtQkFBbUI7WUFDcEMsYUFBYSxFQUFFLG1CQUFtQixDQUFDLGFBQWE7WUFDaEQsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFdBQVc7WUFDNUMsV0FBVyxFQUFFLElBQUkseUJBQVcsQ0FBQztnQkFDM0IsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFdBQVc7YUFDN0MsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDdEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDeEMsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtTQUNyQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxDQUFDLElBQUEsY0FBTyxFQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQzVDLE1BQU0sQ0FBQyxlQUFlLENBQUM7WUFFckIsTUFBTSxDQUFDLGdCQUFnQixDQUNyQixnSUFBZ0ksQ0FDakk7U0FDRixDQUFDLENBQ0gsQ0FBQztRQUNGLE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMseUJBQXlCLENBQUMsZ0NBQW1CLEVBQUU7WUFDbkUsSUFBSSxFQUFFLHNCQUFzQjtTQUM3QixDQUFDLENBQUM7UUFDSCxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyx1QkFBdUIsQ0FDaEQsQ0FBQyxFQUNEO1lBQ0UsT0FBTyxFQUFFLGNBQWM7WUFDdkIsSUFBSSxFQUFFLHlCQUF5QjtZQUMvQixNQUFNLEVBQUUsTUFBTTtTQUNmLEVBQ0QsQ0FBQyxFQUNEO1lBQ0UsYUFBYSxFQUFFLGdDQUFnQztZQUMvQyxvQkFBb0IsRUFBRSxTQUFTO1NBQ2hDLENBQ0YsQ0FBQztRQUNGLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHVCQUF1QixDQUNoRCxDQUFDLEVBQ0Q7WUFDRSxPQUFPLEVBQUUsY0FBYztZQUN2QixJQUFJLEVBQUUseUJBQXlCO1lBQy9CLE1BQU0sRUFBRSxNQUFNO1NBQ2YsRUFDRCxDQUFDLEVBQ0Q7WUFDRSxhQUFhLEVBQUUseUJBQXlCO1lBQ3hDLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FDRixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0VBQWtFLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEYsUUFBUTtRQUNSLHdCQUFhLENBQUMsRUFBRSxDQUFDLGdDQUFtQixDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUNuRCxNQUFNLENBQUMsR0FBUSxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7WUFDdEMsTUFBTSxDQUFDLENBQUM7UUFDVixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQztZQUNoQyxlQUFlLEVBQUUsbUJBQW1CO1lBQ3BDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQyxhQUFhO1lBQ2hELFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO1lBQzVDLFdBQVcsRUFBRSxJQUFJLHlCQUFXLENBQUM7Z0JBQzNCLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO2FBQzdDLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ3RCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ3hDLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyxJQUFBLGNBQU8sRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUM1QyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUMsQ0FDN0UsQ0FBQztRQUNGLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHVCQUF1QixDQUNoRCxDQUFDLEVBQ0Q7WUFDRSxPQUFPLEVBQUUsY0FBYztZQUN2QixJQUFJLEVBQUUseUJBQXlCO1lBQy9CLE1BQU0sRUFBRSxNQUFNO1NBQ2YsRUFDRCxDQUFDLEVBQ0Q7WUFDRSxhQUFhLEVBQUUsZ0NBQWdDO1lBQy9DLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FDRixDQUFDO1FBQ0YsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsdUJBQXVCLENBQ2hELENBQUMsRUFDRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLElBQUksRUFBRSx5QkFBeUI7WUFDL0IsTUFBTSxFQUFFLE1BQU07U0FDZixFQUNELENBQUMsRUFDRDtZQUNFLGFBQWEsRUFBRSx5QkFBeUI7WUFDeEMsb0JBQW9CLEVBQUUsU0FBUztTQUNoQyxDQUNGLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrREFBa0QsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNsRSxRQUFRO1FBQ1Isd0ZBQXdGO1FBQ3hGLGtCQUFrQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUMsc0JBQXNCLENBQUMsR0FBRyxFQUFFO1lBQ3pGLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQztZQUNoQyxlQUFlLEVBQUUsbUJBQW1CO1lBQ3BDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQyxhQUFhO1lBQ2hELFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO1lBQzVDLFdBQVcsRUFBRSxJQUFJLHlCQUFXLENBQUM7Z0JBQzNCLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO2FBQzdDLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ3RCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ3hDLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDckQsTUFBTSxDQUFDLElBQUEsY0FBTyxFQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQzVDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUMxRSxDQUFDO1FBQ0YsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEQsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsdUJBQXVCLENBQ2hELENBQUMsRUFDRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLElBQUksRUFBRSx5QkFBeUI7WUFDL0IsTUFBTSxFQUFFLE1BQU07U0FDZixFQUNELENBQUMsRUFDRDtZQUNFLGFBQWEsRUFBRSxnQ0FBZ0M7WUFDL0Msb0JBQW9CLEVBQUUsU0FBUztTQUNoQyxDQUNGLENBQUM7UUFDRixNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQyx1QkFBdUIsQ0FDaEQsQ0FBQyxFQUNEO1lBQ0UsT0FBTyxFQUFFLGNBQWM7WUFDdkIsSUFBSSxFQUFFLHlCQUF5QjtZQUMvQixNQUFNLEVBQUUsTUFBTTtTQUNmLEVBQ0QsQ0FBQyxFQUNEO1lBQ0UsYUFBYSxFQUFFLHlCQUF5QjtZQUN4QyxvQkFBb0IsRUFBRSxTQUFTO1NBQ2hDLENBQ0YsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlFQUF5RSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3pGLFFBQVE7UUFDUixrQkFBa0IsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFO1lBQ3JELE9BQU8sRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNILG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxjQUFjLEdBQUcsa0JBQWtCLENBQUM7UUFDcEUsTUFBTSxVQUFVLEdBQUcsSUFBSSx3QkFBVSxDQUFDO1lBQ2hDLGVBQWUsRUFBRSxtQkFBbUI7WUFDcEMsYUFBYSxFQUFFLG1CQUFtQixDQUFDLGFBQWE7WUFDaEQsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFdBQVc7WUFDNUMsV0FBVyxFQUFFLElBQUkseUJBQVcsQ0FBQztnQkFDM0IsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFdBQVc7YUFDN0MsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDdEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDeEMsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtTQUNyQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxDQUFDLElBQUEsY0FBTyxFQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQzVDLE1BQU0sQ0FBQyxlQUFlLENBQUM7WUFDckIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxvRUFBb0UsQ0FBQztTQUM1RixDQUFDLENBQ0gsQ0FBQztRQUNGLE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDckQsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsdUJBQXVCLENBQ2hELENBQUMsRUFDRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLElBQUksRUFBRSx5QkFBeUI7WUFDL0IsTUFBTSxFQUFFLE1BQU07U0FDZixFQUNELFdBQUksQ0FBQyxVQUFVLEVBQ2Y7WUFDRSxhQUFhLEVBQUUsZ0NBQWdDO1lBQy9DLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FDRixDQUFDO1FBQ0YsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsdUJBQXVCLENBQ2hELENBQUMsRUFDRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLElBQUksRUFBRSx5QkFBeUI7WUFDL0IsTUFBTSxFQUFFLE1BQU07U0FDZixFQUNELFdBQUksQ0FBQyxVQUFVLEVBQ2Y7WUFDRSxhQUFhLEVBQUUseUJBQXlCO1lBQ3hDLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FDRixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscUVBQXFFLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckYsUUFBUTtRQUNSLE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQztZQUNoQyxlQUFlLEVBQUUsbUJBQW1CO1lBQ3BDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQyxhQUFhO1lBQ2hELFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO1lBQzVDLFdBQVcsRUFBRSxJQUFJLHlCQUFXLENBQUM7Z0JBQzNCLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxXQUFXO2FBQzdDLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQ3RCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQ3hDLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7U0FDckMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyxJQUFBLGNBQU8sRUFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQztZQUNyQixNQUFNLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxjQUFjLENBQUMscUNBQXFDLENBQUM7U0FDN0QsQ0FBQyxDQUNILENBQUM7UUFDRixNQUFNLENBQUMsd0JBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHVCQUF1QixDQUNoRCxDQUFDLEVBQ0Q7WUFDRSxPQUFPLEVBQUUsY0FBYztZQUN2QixJQUFJLEVBQUUseUJBQXlCO1lBQy9CLE1BQU0sRUFBRSxNQUFNO1NBQ2YsRUFDRCxDQUFDLEVBQ0Q7WUFDRSxhQUFhLEVBQUUsU0FBUztZQUN4QixvQkFBb0IsRUFBRSxTQUFTO1NBQ2hDLENBQ0YsQ0FBQztRQUNGLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLHVCQUF1QixDQUNoRCxDQUFDLEVBQ0Q7WUFDRSxPQUFPLEVBQUUsY0FBYztZQUN2QixJQUFJLEVBQUUseUJBQXlCO1lBQy9CLE1BQU0sRUFBRSxNQUFNO1NBQ2YsRUFDRCxDQUFDLEVBQ0Q7WUFDRSxhQUFhLEVBQUUseUJBQXlCO1lBQ3hDLG9CQUFvQixFQUFFLFNBQVM7U0FDaEMsQ0FDRixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3pCLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNoRCxRQUFRO1FBQ1IsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUN0QyxNQUFNLGFBQWEsR0FBRyxJQUFJLHdCQUFhLEVBQUUsQ0FBQztRQUMxQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV2RSxPQUFPO1FBQ1AsTUFBTSxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsd0JBQXdCLENBQUMsRUFBRTtZQUNsRCxNQUFNLEVBQUUsc0JBQXNCO1lBQzlCLFVBQVUsRUFBRTtnQkFDVixTQUFTLEVBQUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0NBQWtDLENBQUM7YUFDekU7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUMxRixVQUFVLEVBQUU7Z0JBQ1YsU0FBUyxFQUFFLE9BQU87YUFDbkI7WUFDRCxNQUFNLEVBQUUsc0JBQXNCO1NBQy9CLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtJQUN0QixJQUFJLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDM0QsUUFBUTtRQUNSLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUNoQixPQUFPLENBQUMsTUFBTSxDQUFDO1lBQ2IsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDeEMsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtTQUNyQyxDQUFDLENBQ0gsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7SUFDaEUsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO1FBQ3ZDLElBQUksQ0FBQyxnRkFBZ0YsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNoRyxRQUFRO1lBQ1IsTUFBTSxrQkFBa0IsR0FBRyxJQUFBLHVCQUFnQixFQUFDLHlCQUFXLENBQUMsQ0FBQztZQUN6RCxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUM1QyxPQUFPLENBQUMsT0FBTyxDQUFDO2dCQUNkLElBQUksRUFBRSxrQkFBa0I7Z0JBQ3hCLElBQUksRUFBRSxLQUFLO2dCQUNYLE9BQU8sRUFBRSxFQUFFO2dCQUNYLFFBQVEsRUFBRSxVQUFVO2dCQUNwQixhQUFhLEVBQUUsSUFBQSx1QkFBZ0IsRUFBQyxLQUFLLENBQUMsMkJBQTJCLENBQUM7YUFDbkUsQ0FBQyxDQUNILENBQUM7WUFDRixNQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFVLENBQUM7Z0JBQ2hDLGVBQWU7Z0JBQ2YsYUFBYSxFQUFFLGVBQWUsQ0FBQyxhQUFhO2dCQUM1QyxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7Z0JBQ3hDLFdBQVcsRUFBRSxrQkFBa0I7YUFDaEMsQ0FBQyxDQUFDO1lBRUgsT0FBTztZQUNQLE1BQU0sVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDdEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsMkJBQTJCLENBQUMsRUFBRTtnQkFDckQsZUFBZSxFQUFFLHNCQUFlLENBQUMsS0FBSztnQkFDdEMsT0FBTyxFQUFFLG9CQUFXLENBQUMsU0FBUzthQUMvQixDQUFDLENBQUM7WUFFSCxPQUFPO1lBQ1AsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDLG9CQUFvQixDQUN6RCxNQUFNLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ3RCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFNBQVM7YUFDL0IsQ0FBQyxDQUNILENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLG9DQUFvQyxFQUFFLEdBQUcsRUFBRTtRQUNsRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDakMsUUFBUTtZQUNSLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7WUFFdEMsT0FBTztZQUNQLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQztnQkFDbkIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsY0FBYyxFQUFFLGNBQWMsQ0FBQyxFQUFFO2dCQUN4RCxPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO2FBQ3JDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3JFLFFBQVE7WUFDUixNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBRXRDLE9BQU87WUFDUCxNQUFNLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQ25CLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM5QixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO2FBQ3JDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDBCQUEwQixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzFDLFFBQVE7WUFDUixNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBRXRDLE9BQU87WUFDUCxNQUFNLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQ25CLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLDJCQUEyQixDQUFDLEVBQUU7Z0JBQ3JELE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7YUFDckMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsOENBQThDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDOUQsUUFBUTtZQUNSLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7WUFFdEMsT0FBTztZQUNQLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQztnQkFDbkIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzdCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7YUFDckMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO1lBQ3JDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2QsZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7b0JBQ3hDLE1BQU0sRUFBRTt3QkFDTixTQUFTLENBQUMsWUFBWTt3QkFDdEIsU0FBUyxDQUFDLFlBQVk7d0JBQ3RCLFNBQVMsQ0FBQyxpQ0FBaUM7d0JBQzNDLFNBQVMsQ0FBQyxxQ0FBcUM7cUJBQ2hEO2lCQUNGLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLHVDQUF1QyxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUN2RCxRQUFRO2dCQUNSLE1BQU0sZ0JBQWdCLEdBQUc7b0JBQ3ZCLDRDQUE0QztvQkFDNUMsbURBQW1EO2lCQUNwRCxDQUFDO2dCQUNGLE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQVUsQ0FBQztvQkFDN0IsZUFBZTtvQkFDZixhQUFhLEVBQUUsZUFBZSxDQUFDLGFBQWE7b0JBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztvQkFDeEMsV0FBVyxFQUFFLElBQUksa0JBQWtCLENBQ2pDO3dCQUNFLGNBQWMsRUFBRSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUU7cUJBQy9CLEVBQ0QsZ0JBQWdCLENBQ2pCO2lCQUNGLENBQUMsQ0FBQztnQkFFSCxPQUFPO2dCQUNQLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFDbkIsdUdBQXVHO29CQUN2RyxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxFQUFFO29CQUNyRCxnQkFBZ0I7b0JBQ2hCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7aUJBQ3JDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUN0RSxRQUFRO2dCQUNSLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLE9BQU8sR0FBRyxJQUFJLHdCQUFVLENBQUM7b0JBQzdCLGVBQWU7b0JBQ2YsYUFBYSxFQUFFLGVBQWUsQ0FBQyxhQUFhO29CQUM1QyxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7b0JBQ3hDLFdBQVcsRUFBRSxJQUFJLGtCQUFrQixDQUNqQzt3QkFDRSxjQUFjLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFO3FCQUMvQixFQUNELGdCQUFnQixDQUNqQjtpQkFDRixDQUFDLENBQUM7Z0JBRUgsT0FBTztnQkFDUCxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FDaEIsT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFDYix1R0FBdUc7b0JBQ3ZHLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLDJCQUEyQixDQUFDLEVBQUU7b0JBQ3JELGdCQUFnQjtvQkFDaEIsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtpQkFDckMsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyw4RUFBOEUsQ0FBQyxDQUFDO1lBQ3BHLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLDhDQUE4QyxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUM5RCxRQUFRO2dCQUNSLE1BQU0sd0JBQXdCLEdBQUcsQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO2dCQUM1RixNQUFNLE9BQU8sR0FBRyxJQUFJLHdCQUFVLENBQUM7b0JBQzdCLGVBQWU7b0JBQ2YsYUFBYSxFQUFFLGVBQWUsQ0FBQyxhQUFhO29CQUM1QyxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7b0JBQ3hDLFdBQVcsRUFBRSxJQUFJLGtCQUFrQixDQUNqQzt3QkFDRSw4QkFBOEIsRUFBRSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUU7cUJBQy9DLEVBQ0Qsd0JBQXdCLENBQ3pCO2lCQUNGLENBQUMsQ0FBQztnQkFFSCxPQUFPO2dCQUNQLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQztvQkFDbkIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsOEJBQThCLENBQUMsRUFBRTtvQkFDeEQsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtpQkFDckMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzdFLFFBQVE7Z0JBQ1IsTUFBTSxPQUFPLEdBQUcsSUFBSSx3QkFBVSxDQUFDO29CQUM3QixlQUFlO29CQUNmLGFBQWEsRUFBRSxlQUFlLENBQUMsYUFBYTtvQkFDNUMsV0FBVyxFQUFFLGVBQWUsQ0FBQyxXQUFXO29CQUN4QyxXQUFXLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQzt3QkFDbEMsa0NBQWtDLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFO3FCQUNuRCxDQUFDO2lCQUNILENBQUMsQ0FBQztnQkFFSCxPQUFPO2dCQUNQLE1BQU0sTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUNoQixPQUFPLENBQUMsTUFBTSxDQUFDO29CQUNiLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGtDQUFrQyxDQUFDLEVBQUU7b0JBQzVELE9BQU8sRUFBRSxvQkFBVyxDQUFDLGVBQWU7aUJBQ3JDLENBQUMsQ0FDSCxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0ZBQW9GLENBQUMsQ0FBQztZQUMxRyxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyw2REFBNkQsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDN0UsUUFBUTtnQkFDUixNQUFNLGdCQUFnQixHQUFHO29CQUN2Qiw0Q0FBNEM7b0JBQzVDLG1EQUFtRDtpQkFDcEQsQ0FBQztnQkFFRixNQUFNLHdCQUF3QixHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztvQkFDdkQsd0RBQXdEO2lCQUN6RCxDQUFDLENBQUM7Z0JBQ0gsTUFBTSxPQUFPLEdBQUcsSUFBSSx3QkFBVSxDQUFDO29CQUM3QixlQUFlO29CQUNmLGFBQWEsRUFBRSxlQUFlLENBQUMsYUFBYTtvQkFDNUMsV0FBVyxFQUFFLGVBQWUsQ0FBQyxXQUFXO29CQUN4QyxXQUFXLEVBQUUsSUFBSSxrQkFBa0IsQ0FDakM7d0JBQ0UsOEJBQThCLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFO3FCQUMvQyxFQUNELHdCQUF3QixDQUN6QjtpQkFDRixDQUFDLENBQUM7Z0JBRUgsT0FBTztnQkFDUCxNQUFNLE9BQU8sQ0FBQyxNQUFNLENBQUM7b0JBQ25CLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLDhCQUE4QixDQUFDLEVBQUU7b0JBQ3hELGdCQUFnQjtvQkFDaEIsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtpQkFDckMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsNEdBQTRHLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzVILFFBQVE7Z0JBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7Z0JBQ3JELE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQVUsQ0FBQztvQkFDN0IsZUFBZTtvQkFDZixhQUFhLEVBQUUsZUFBZSxDQUFDLGFBQWE7b0JBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztvQkFDeEMsV0FBVyxFQUFFLElBQUksa0JBQWtCLENBQ2pDO3dCQUNFLGtDQUFrQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRTtxQkFDbkQsRUFDRCxnQkFBZ0IsQ0FDakI7aUJBQ0YsQ0FBQyxDQUFDO2dCQUVILE9BQU87Z0JBQ1AsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUM7b0JBQ2IsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsa0NBQWtDLENBQUMsRUFBRTtvQkFDNUQsZ0JBQWdCO29CQUNoQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO2lCQUNyQyxDQUFDLENBQ0gsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDhFQUE4RSxDQUFDLENBQUM7WUFDcEcsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsMEdBQTBHLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzFILFFBQVE7Z0JBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7Z0JBQ3BGLE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQVUsQ0FBQztvQkFDN0IsZUFBZTtvQkFDZixhQUFhLEVBQUUsZUFBZSxDQUFDLGFBQWE7b0JBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztvQkFDeEMsV0FBVyxFQUFFLElBQUksa0JBQWtCLENBQ2pDO3dCQUNFLGtDQUFrQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRTtxQkFDbkQsRUFDRCxnQkFBZ0IsQ0FDakI7aUJBQ0YsQ0FBQyxDQUFDO2dCQUVILE9BQU87Z0JBQ1AsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUM7b0JBQ2IsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsa0NBQWtDLENBQUMsRUFBRTtvQkFDNUQsZ0JBQWdCO29CQUNoQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO2lCQUNyQyxDQUFDLENBQ0gsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9GQUFvRixDQUFDLENBQUM7WUFDMUcsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsMEdBQTBHLEVBQUUsS0FBSyxJQUFJLEVBQUU7Z0JBQzFILFFBQVE7Z0JBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7Z0JBQ3JELE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQVUsQ0FBQztvQkFDN0IsZUFBZTtvQkFDZixhQUFhLEVBQUUsZUFBZSxDQUFDLGFBQWE7b0JBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztvQkFDeEMsV0FBVyxFQUFFLElBQUksa0JBQWtCLENBQ2pDO3dCQUNFLDhCQUE4QixFQUFFLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRTtxQkFDL0MsRUFDRCxnQkFBZ0IsQ0FDakI7aUJBQ0YsQ0FBQyxDQUFDO2dCQUVILE9BQU87Z0JBQ1AsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQ2hCLE9BQU8sQ0FBQyxNQUFNLENBQUM7b0JBQ2IsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsOEJBQThCLENBQUMsRUFBRTtvQkFDeEQsZ0JBQWdCO29CQUNoQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO2lCQUNyQyxDQUFDLENBQ0gsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDhFQUE4RSxDQUFDLENBQUM7WUFDcEcsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3RFLFFBQVE7UUFDUixNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE9BQU87UUFDUCxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFO1lBQ2xELE1BQU0sRUFBRSxzQkFBc0I7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLG9CQUFvQixDQUNuRDtZQUNFLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLElBQUksRUFBRSx3QkFBd0I7U0FDL0IsRUFDRCxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQ2pCLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FDbEIsQ0FBQztRQUNGLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzNELFFBQVE7UUFDUixNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3RDLGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRWpFLE9BQU87UUFDUCxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFO1lBQ3RELE1BQU0sRUFBRSxzQkFBc0I7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLG9CQUFvQixDQUNuRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLE1BQU0sRUFBRSxvQkFBb0I7WUFDNUIsSUFBSSxFQUFFLHVDQUF1QztTQUM5QyxFQUNELE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFDakIsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUNsQixDQUFDO1FBQ0YsTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscURBQXFELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckUsUUFBUTtRQUNSLGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9DLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNqQyxlQUFlLENBQUMsVUFBVSxHQUFHLGNBQWMsQ0FBQztRQUU1QyxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE9BQU87UUFDUCxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFO1lBQ3hELE1BQU0sRUFBRSxzQkFBc0I7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLG9CQUFvQixDQUNuRDtZQUNFLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLE1BQU0sRUFBRSxXQUFXO1lBQ25CLElBQUksRUFBRSw4QkFBOEI7U0FDckMsRUFDRCxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQ2pCLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FDbEIsQ0FBQztRQUNGLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTFELE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUNoRCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7SUFDdkIsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3ZDLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsTUFBTSxDQUFDLEdBQUcsRUFBRTtZQUNWLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQztnQkFDckIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsMkJBQTJCLENBQUMsRUFBRTtnQkFDckQsV0FBVyxFQUFFLElBQUk7Z0JBQ2pCLEtBQUssRUFBRSxJQUFJO2dCQUNYLFVBQVUsRUFBRSxJQUFJO2FBQ2pCLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUNkLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtJQUNyQixJQUFJLENBQUMsMENBQTBDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDMUQsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUV0QyxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUU7WUFDaEIsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDO2dCQUNuQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO2dCQUMxQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxZQUFZO2FBQ2xDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ2hCLHVGQUF1RjtZQUNyRixpREFBaUQsQ0FDcEQsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdELGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzFELE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7WUFDMUIsT0FBTyxFQUFFLG9CQUFXLENBQUMsWUFBWTtTQUNsQyxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLENBQUM7UUFDbEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscURBQXFELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckUsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDcEQsT0FBTyxFQUFFLFFBQVE7U0FDbEIsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUV0QyxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUMxQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxZQUFZO1NBQ2xDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlEQUF5RCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3pFLGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3BELE9BQU8sRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUM7U0FDckMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUV0QyxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUMxQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxZQUFZO1NBQ2xDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUNuRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxpRkFBaUYsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNqRyxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRCxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNsRSxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQztZQUNsQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1lBQzFCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFlBQVk7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUNqSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxxREFBcUQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNyRSxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNwRCxPQUFPLEVBQUUsUUFBUTtTQUNsQixDQUFDLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQztZQUNsQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1lBQzFCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFlBQVk7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekUsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDcEQsT0FBTyxFQUFFLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQztTQUNuQyxDQUFDLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQztZQUNsQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1lBQzFCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFlBQVk7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM1QyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx5Q0FBeUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN6RCxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQztRQUUvQixNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUMxQixXQUFXLEVBQUUsQ0FBQztZQUNkLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFlBQVk7U0FDbEMsQ0FBQyxDQUFDO1FBQ0gscUJBQXFCLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFdEMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDMUYsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1FBQzFGLElBQUksQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMxRSxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNoQyxPQUFPLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQztZQUUvQixNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUM7Z0JBQ2xCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7Z0JBQzFCLE9BQU8sRUFBRSxXQUFXO2FBQ3JCLENBQUMsQ0FBQztZQUNILHFCQUFxQixDQUFDLGFBQWEsRUFBRSxDQUFDO1lBRXRDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbkQsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDMUQsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUN0QyxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDaEMsT0FBTyxDQUFDLE1BQU0sR0FBRyxhQUFhLENBQUM7UUFFL0IsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7WUFDMUIsT0FBTyxFQUFFLG9CQUFXLENBQUMsWUFBWTtTQUNsQyxDQUFDLENBQUM7UUFDSCxxQkFBcUIsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUV0QyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsT0FBTyxFQUFFLG9CQUFXLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdHLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hELGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzFELE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFDdEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO1FBRS9CLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQztZQUNsQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1lBQzFCLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFNBQVM7U0FDL0IsQ0FBQyxDQUFDO1FBQ0gscUJBQXFCLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFdEMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxvQkFBVyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMxRyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN0RCxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQztRQUUvQixNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtZQUMxQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlO1NBQ3JDLENBQUMsQ0FBQztRQUNILHFCQUFxQixDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXRDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLEVBQUUsb0JBQVcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDaEgsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO1FBQ3ZDLElBQUksT0FBbUIsQ0FBQztRQUN4QixJQUFJLGFBQXdCLENBQUM7UUFFN0IsVUFBVSxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQ3BCLGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFELE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ2hDLGFBQWEsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDMUIsT0FBTyxDQUFDLE1BQU0sR0FBRyxhQUFhLENBQUM7WUFDL0IsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDO2dCQUNsQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO2dCQUMxQixPQUFPLEVBQUUsb0JBQVcsQ0FBQyxZQUFZO2FBQ2xDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGdFQUFnRSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ2hGLE1BQU0scUJBQXFCLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBRWhFLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUMvQyxDQUFDLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQywwQ0FBMEMsRUFBRSxHQUFHLEVBQUU7WUFDeEQsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDZCx3REFBd0Q7Z0JBQ3hELDBEQUEwRDtnQkFDMUQsc0JBQXNCO2dCQUN0QixxQkFBcUIsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QyxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyw0REFBNEQsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDNUUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUMzRCxNQUFNLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFFaEUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pELENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUNoRSx3RUFBd0U7Z0JBQ3hFLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztvQkFDaEIscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQztvQkFDMUQscUJBQXFCLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQztpQkFDOUQsQ0FBQyxDQUFDO2dCQUVILE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqRCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxrREFBa0QsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDbEUsd0VBQXdFO2dCQUN4RSxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUM7b0JBQ2hCLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxVQUFVLENBQUM7b0JBQzFELHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUM7b0JBQzdELHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUM7b0JBQzdELHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxVQUFVLENBQUM7aUJBQzNELENBQUMsQ0FBQztnQkFFSCxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakQsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtJQUNyQixJQUFJLENBQUMsaURBQWlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDakUsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUN0QyxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV0QyxpREFBaUQ7UUFDakQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDekUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzlELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3ZDLE9BQU87UUFDUCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBRXRDLE9BQU87UUFDUCxNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7UUFDdkIsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLFNBQVMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRSxNQUFNLFlBQVksR0FBRyxDQUFDLEdBQUcsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDeEQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3hFLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO1FBQ3ZGLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUV0RSxJQUFJLENBQUMsbUVBQW1FLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDbkYsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztZQUN0QyxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FDaEIsT0FBTyxDQUFDLE9BQU8sQ0FBQztnQkFDZCxTQUFTLEVBQUUsV0FBVztnQkFDdEIsUUFBUSxFQUFFLHFCQUFxQjtnQkFDL0IsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyw4REFBOEQsQ0FBQyxDQUFDO1lBQ2xGLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FDM0Msa0dBQWtHLENBQ25HLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMzRCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUNoQixPQUFPLENBQUMsT0FBTyxDQUFDO2dCQUNkLFNBQVMsRUFBRSxrQkFBa0I7Z0JBQzdCLFFBQVEsRUFBRSxxQkFBcUI7YUFDaEMsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1lBQ2hFLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FDM0MsdUZBQXVGLENBQ3hGLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw2RUFBNkUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM3RixNQUFNLGVBQWUsR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztZQUM5QyxtQ0FBd0IsQ0FBQyxFQUFFLENBQUMsNkNBQXFCLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQyxDQUFDO1lBRWxILE1BQU0sbUJBQW1CLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztnQkFDbEQsTUFBTSxFQUFFLEVBQUU7YUFDWCxDQUFDLENBQUM7WUFFSCxNQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFVLENBQUM7Z0JBQ2hDLGVBQWUsRUFBRSxtQkFBbUI7Z0JBQ3BDLFdBQVcsRUFBRSxJQUFJLHlCQUFXLENBQUMsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLENBQUM7Z0JBQzlELFdBQVcsRUFBRSxlQUFlO2dCQUM1QixhQUFhLEVBQUUsbUJBQW1CLENBQUMsYUFBYTthQUNqRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FDaEIsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQkFDakIsU0FBUyxFQUFFLDJCQUEyQjtnQkFDdEMsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1lBQzlELE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FDM0MsOEZBQThGLENBQy9GLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM5RCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUNoQixPQUFPLENBQUMsT0FBTyxDQUFDO2dCQUNkLFNBQVMsRUFBRSwwQkFBMEI7Z0JBQ3JDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixDQUFDO2dCQUM5RixRQUFRLEVBQUUsTUFBTTthQUNqQixDQUFDLENBQ0gsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUNmLDZGQUE2RixDQUM5RixDQUFDO1lBQ0YsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUMzQyxnSkFBZ0osQ0FDakosQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLGtGQUFrRixFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRTtZQUM1RyxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sT0FBTyxDQUFDLE9BQU8sQ0FBQztnQkFDcEIsU0FBUyxFQUFFLGVBQWU7Z0JBQzFCLFFBQVEsRUFBRSxlQUFlO2dCQUN6QixVQUFVLEVBQUUsT0FBTzthQUNwQixDQUFDLENBQUM7WUFFSCxrQ0FBa0M7WUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM1RixNQUFNLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxlQUFlLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3pHLE1BQU0sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDakgsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsK0VBQStFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFO1lBQ3pHLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7WUFDdEMsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDO2dCQUNwQixTQUFTLEVBQUUsVUFBVTtnQkFDckIsUUFBUSxFQUFFLGNBQWM7Z0JBQ3hCLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixRQUFRLEVBQUUsUUFBUTthQUNuQixDQUFDLENBQUM7WUFFSCxrQ0FBa0M7WUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzNGLE1BQU0sQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakYsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUM1RyxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUU7WUFDdEQsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztZQUN0QyxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxtQkFBbUI7Z0JBQzlCLFFBQVEsRUFBRSx1QkFBdUI7Z0JBQ2pDLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixRQUFRLEVBQUUsUUFBUTthQUNuQixDQUFDLENBQUM7WUFFSCxrQ0FBa0M7WUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hILE1BQU0sQ0FDSixFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUNyRyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2YsTUFBTSxDQUNKLEVBQUUsQ0FBQyxjQUFjLENBQ2YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixDQUFDLENBQ2pHLENBQ0YsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUVmLGdCQUFnQjtZQUNoQixNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxtQkFBbUI7Z0JBQzlCLFFBQVEsRUFBRSx1QkFBdUI7Z0JBQ2pDLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixRQUFRLEVBQUUsUUFBUTthQUNuQixDQUFDLENBQUM7WUFFSCxrQ0FBa0M7WUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hILE1BQU0sQ0FDSixFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUNyRyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2YsTUFBTSxDQUNKLEVBQUUsQ0FBQyxjQUFjLENBQ2YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixDQUFDLENBQ2pHLENBQ0YsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLDZDQUE2QyxFQUFFLEdBQUcsRUFBRTtRQUMzRCxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2QsZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7Z0JBQ3hDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQztnQkFDeEQsZ0JBQWdCLEVBQUU7b0JBQ2hCO3dCQUNFLE1BQU0sRUFBRTs0QkFDTjtnQ0FDRSxVQUFVLEVBQUUsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFO2dDQUNyQyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUI7NkJBQ25DO3lCQUNGO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDM0QsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztZQUN0QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7WUFDMUIsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuRixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywrQ0FBK0MsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMvRCxNQUFNLE9BQU8sR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztZQUMzQixNQUFNLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDbkQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdELGVBQWUsR0FBRyxJQUFJLDBCQUFtQixDQUFDO1lBQ3hDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQztZQUN4RCxnQkFBZ0IsRUFBRTtnQkFDaEI7b0JBQ0UsTUFBTSxFQUFFO3dCQUNOOzRCQUNFLFVBQVUsRUFBRSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUU7NEJBQ3RDLEdBQUcsU0FBUyxDQUFDLHFCQUFxQjt5QkFDbkM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLHlCQUF5QixDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzlGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdGQUFnRixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hHLGVBQWUsR0FBRyxJQUFJLDBCQUFtQixDQUFDO1lBQ3hDLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQztZQUN4RCxnQkFBZ0IsRUFBRTtnQkFDaEI7b0JBQ0UsTUFBTSxFQUFFO3dCQUNOOzRCQUNFLFVBQVUsRUFBRSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUU7NEJBQ3RDLEdBQUcsU0FBUyxDQUFDLHFCQUFxQjt5QkFDbkM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0RBQWtELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEUsZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7WUFDeEMsTUFBTSxFQUFFLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsWUFBWSxDQUFDO1NBQ3pELENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFdEMsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFckUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNsRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywrQkFBK0IsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMvQyxlQUFlLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztZQUN4QyxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDO1NBQ2pDLENBQUMsQ0FBQztRQUVILE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMseUJBQVcsQ0FBQyxTQUFTLEVBQUUsZUFBZSxDQUFDLENBQUMsaUJBQWlCLENBQUM7WUFDMUYsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLHdCQUFVLENBQUM7WUFDN0IsZUFBZTtZQUNmLGFBQWEsRUFBRSxlQUFlLENBQUMsYUFBYTtZQUM1QyxXQUFXLEVBQUUsZUFBZSxDQUFDLFdBQVc7WUFDeEMsV0FBVyxFQUFFLElBQUkseUJBQVcsQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLDBCQUFlLEVBQUUsRUFBRSxDQUFDO1NBQ3JFLENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxDQUFDLFFBQVEsQ0FBQztZQUNyQixRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO1NBQzNCLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQzVDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNSLENBQUMsRUFBRSxJQUFJLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxDQUFDO1FBQzFGLENBQUMsRUFBRSxJQUFJLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDO1FBQ3pGLENBQUMsRUFBRSxJQUFJLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRSxLQUFLLENBQUM7UUFDN0YsQ0FBQyxFQUFFLElBQUksRUFBRSwrQkFBK0IsRUFBRSxFQUFFLEtBQUssQ0FBQztRQUNsRCxDQUFDLEVBQUUsSUFBSSxFQUFFLCtCQUErQixFQUFFLEVBQUUsSUFBSSxDQUFDO0tBQ0osQ0FBQyxDQUFDLHNHQUFzRyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDdkwsZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7WUFDeEMsTUFBTSxFQUFFO2dCQUNOLFNBQVMsQ0FBQyxZQUFZO2FBQ3ZCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxXQUFXLEdBQUcsSUFBSSx5QkFBVyxDQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksMEJBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUU1RSxxREFBcUQ7UUFDckQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUV6RixNQUFNLGlCQUFpQixHQUFHLElBQUk7YUFDM0IsS0FBSyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUM7YUFDakMscUJBQXFCLENBQUMsV0FBVyxDQUFDO2FBQ2xDLHFCQUFxQixDQUFDO1lBQ3JCLElBQUksRUFBRSxrQkFBa0I7WUFDeEIsSUFBSSxFQUFFLEtBQUs7WUFDWCxPQUFPLEVBQUUsRUFBRTtZQUNYLFFBQVEsRUFBRSxXQUFXO1NBQ3RCLENBQUMsQ0FBQztRQUVMLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTlFLE1BQU0sT0FBTyxHQUFHLElBQUksd0JBQVUsQ0FBQztZQUM3QixlQUFlO1lBQ2YsYUFBYSxFQUFFLGVBQWUsQ0FBQyxhQUFhO1lBQzVDLFdBQVcsRUFBRSxlQUFlLENBQUMsV0FBVztZQUN4QyxXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLENBQUMsTUFBTSxDQUFDO1lBQ25CLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7WUFDMUIsT0FBTyxFQUFFLG9CQUFXLENBQUMsZUFBZTtZQUNwQyxRQUFRLEVBQUUsS0FBSztZQUNmLGVBQWUsRUFBRSxzQkFBZSxDQUFDLEtBQUs7WUFDdEMsS0FBSyxFQUFFLFFBQVE7U0FDaEIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLGdDQUFnQyxFQUFFLENBQUM7WUFDMUQsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUMvQyxDQUFDO1FBRUQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2Qsa0VBQWtFO1lBQ2xFLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxnQ0FBZ0MsRUFBRSxDQUFDO2dCQUMxRCxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGtEQUFrRCxDQUFDLENBQUMsQ0FBQztZQUMxSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7WUFDdEcsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNuRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNwRyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxTQUFTOztBQUNVLHNCQUFZLEdBQXNCO0lBQ3ZELFNBQVMsRUFBRSxjQUFjO0lBQ3pCLFFBQVEsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsRUFBRTtJQUN6RCxHQUFHLEVBQUUsdUNBQXVDO0lBQzVDLFFBQVEsRUFBRTtRQUNSLGVBQWUsRUFBRTtZQUNmO2dCQUNFLElBQUksRUFBRSxRQUFRLENBQUMseUJBQXlCLENBQUMsVUFBVTtnQkFDbkQsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQzthQUNyQztTQUNGO0tBQ0Y7SUFDRCxXQUFXLEVBQUUsMkJBQTJCO0NBQ3pDLENBQUM7QUFDcUIsc0JBQVksR0FBc0I7SUFDdkQsU0FBUyxFQUFFLGNBQWM7SUFDekIsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxFQUFFO0lBQ3pELEdBQUcsRUFBRSx1Q0FBdUM7SUFDNUMsUUFBUSxFQUFFO1FBQ1IsZUFBZSxFQUFFO1lBQ2Y7Z0JBQ0UsSUFBSSxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVO2dCQUNuRCxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDO2FBQ3hDO1NBQ0Y7S0FDRjtDQUNGLENBQUM7QUFDcUIsc0JBQVksR0FBc0I7SUFDdkQsU0FBUyxFQUFFLGNBQWM7SUFDekIsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxFQUFFO0lBQ3pELEdBQUcsRUFBRSx1Q0FBdUM7SUFDNUMsUUFBUSxFQUFFO1FBQ1IsZUFBZSxFQUFFO1lBQ2Y7Z0JBQ0UsSUFBSSxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVO2dCQUNuRCxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDO2FBQ3hDO1NBQ0Y7S0FDRjtJQUNELFdBQVcsRUFBRSwyQkFBMkI7Q0FDekMsQ0FBQztBQUNxQixzQkFBWSxHQUFzQjtJQUN2RCxTQUFTLEVBQUUsY0FBYztJQUN6QixRQUFRLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLEVBQUU7SUFDekQsR0FBRyxFQUFFLHVDQUF1QztJQUM1QyxRQUFRLEVBQUU7UUFDUixlQUFlLEVBQUU7WUFDZjtnQkFDRSxJQUFJLEVBQUUsUUFBUSxDQUFDLHlCQUF5QixDQUFDLFVBQVU7Z0JBQ25ELElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLENBQUM7YUFDeEM7U0FDRjtLQUNGO0lBQ0QsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUM7Q0FDNUMsQ0FBQztBQUNxQiwrQkFBcUIsR0FBc0I7SUFDaEUsU0FBUyxFQUFFLFlBQVk7SUFDdkIsR0FBRyxFQUFFLHVDQUF1QztJQUM1QyxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFO0lBQ3ZDLFFBQVEsRUFBRTtRQUNSLFdBQVcsRUFBRTtZQUNYO2dCQUNFLElBQUksRUFBRSxRQUFRLENBQUMseUJBQXlCLENBQUMsS0FBSztnQkFDOUMsSUFBSSxFQUFFLGtCQUFrQjthQUN6QjtTQUNGO0tBQ0Y7SUFDRCxXQUFXLEVBQUUseUJBQXlCO0NBQ3ZDLENBQUM7QUFDcUIsK0JBQXFCLEdBQXNCO0lBQ2hFLFNBQVMsRUFBRSxrQkFBa0I7SUFDN0IsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFFLEVBQUU7SUFDN0QsR0FBRyxFQUFFLHVDQUF1QztJQUM1QyxhQUFhLEVBQUU7UUFDYixPQUFPLEVBQUUsZ0NBQVEsQ0FBQyxPQUFPLEVBQUU7UUFDM0IsS0FBSyxFQUFFO1lBQ0wsR0FBRyxFQUFFO2dCQUNILE1BQU0sRUFBRTtvQkFDTixJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQztpQkFDL0M7Z0JBQ0QsWUFBWSxFQUFFLEVBQUU7YUFDakI7U0FDRjtLQUNGO0NBQ0YsQ0FBQztBQUNxQiwyQ0FBaUMsR0FBc0I7SUFDNUUsU0FBUyxFQUFFLDhCQUE4QjtJQUN6QyxnQkFBZ0IsRUFBRSxDQUFDLHdEQUF3RCxDQUFDO0lBQzVFLFFBQVEsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLFlBQVksRUFBRSw4QkFBOEIsRUFBRSxFQUFFO0lBQ3pFLEdBQUcsRUFBRSwwQ0FBMEM7SUFDL0MsUUFBUSxFQUFFO1FBQ1IsK0JBQStCLEVBQUU7WUFDL0I7Z0JBQ0UsSUFBSSxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVO2dCQUNuRCxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDO2FBQ3JDO1NBQ0Y7S0FDRjtDQUNGLENBQUM7QUFFcUIsK0NBQXFDLEdBQXNCO0lBQ2hGLFNBQVMsRUFBRSxrQ0FBa0M7SUFDN0MsZ0JBQWdCLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztJQUNuRCxRQUFRLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxZQUFZLEVBQUUsa0NBQWtDLEVBQUUsRUFBRTtJQUM3RSxHQUFHLEVBQUUsMENBQTBDO0lBQy9DLFFBQVEsRUFBRTtRQUNSLG1DQUFtQyxFQUFFO1lBQ25DO2dCQUNFLElBQUksRUFBRSxRQUFRLENBQUMseUJBQXlCLENBQUMsVUFBVTtnQkFDbkQsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQzthQUNyQztTQUNGO0tBQ0Y7Q0FDRixDQUFDO0FBR0osTUFBTSxrQkFBbUIsU0FBUSx5QkFBVztJQUkxQyxZQUNFLGVBQW1FLEVBQUUsRUFDckUsd0JBQW1DO1FBRW5DLEtBQUssQ0FBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLDBCQUFlLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFQL0IsaUJBQVksR0FBbUMsRUFBRSxDQUFDO1FBU2pFLEtBQUssTUFBTSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDN0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztpQkFDaEQsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztpQkFDdkMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUNELElBQUksQ0FBQyx3QkFBd0IsR0FBRyx3QkFBd0IsQ0FBQztJQUMzRCxDQUFDO0lBRU0sV0FBVyxDQUFDLE9BQTJCO1FBQzVDLE1BQU0sQ0FBQztZQUNMLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUztZQUNoQyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVM7WUFDaEMsU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTO1lBQ2hDLCtDQUErQztZQUMvQyxTQUFTLENBQUMscUJBQXFCLENBQUMsU0FBUztZQUN6QyxTQUFTLENBQUMscUJBQXFCLENBQUMsU0FBUztZQUN6QyxTQUFTLENBQUMsaUNBQWlDLENBQUMsU0FBUztZQUNyRCxTQUFTLENBQUMscUNBQXFDLENBQUMsU0FBUztTQUMxRCxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFdEMsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUMvQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsaUZBQWlGO1FBQ2pGLEVBQUU7UUFDRiw4RUFBOEU7UUFDOUUsOEVBQThFO1FBQzlFLCtFQUErRTtRQUMvRSxnQkFBZ0I7UUFDaEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHdCQUF3QixJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3BGLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNyQixJQUFJLEVBQUUsa0JBQWtCO1lBQ3hCLFFBQVEsRUFBRSxrQ0FBa0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLFlBQVk7WUFDL0UsSUFBSSxFQUFFLEtBQUs7WUFDWCxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUU7WUFDL0MsYUFBYSxFQUFFLE9BQU8sQ0FBQyxLQUFLO1NBQzdCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTSxhQUFhLENBQUMsUUFBOEI7UUFDakQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDO1lBQ3JCLE9BQU8sRUFBRSxJQUFJO1NBQ2QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVNLFlBQVksQ0FBQyxPQUE0QjtRQUM5QyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3BDLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFFTSxtQkFBbUIsQ0FBQyxLQUF3QztRQUNqRSxRQUFRLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4QixLQUFLLFNBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUztnQkFDbkMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdCLEtBQUssU0FBUyxDQUFDLFlBQVksQ0FBQyxTQUFTO2dCQUNuQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsS0FBSyxTQUFTLENBQUMsWUFBWSxDQUFDLFNBQVM7Z0JBQ25DLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QixLQUFLLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTO2dCQUM1QyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsS0FBSyxTQUFTLENBQUMsaUNBQWlDLENBQUMsU0FBUztnQkFDeEQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdCLEtBQUssU0FBUyxDQUFDLHFDQUFxQyxDQUFDLFNBQVM7Z0JBQzVELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QjtnQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixLQUFLLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN0RSxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBRUQsU0FBUyxPQUFPLENBQUMsSUFBWSxFQUFFLE9BQTZDO0lBQzFFLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVELEtBQUssVUFBVSxXQUFXLENBQUMsRUFBd0M7SUFDakUsTUFBTSxNQUFNLEdBQUcsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkIsQ0FBQztZQUFTLENBQUM7UUFDVCxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUIsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBXZSBuZWVkIHRvIG1vY2sgdGhlIGNob2tpZGFyIGxpYnJhcnksIHVzZWQgYnkgJ2NkayB3YXRjaCdcbmNvbnN0IG1vY2tDaG9raWRhcldhdGNoZXJPbiA9IGplc3QuZm4oKTtcbmNvbnN0IGZha2VDaG9raWRhcldhdGNoZXIgPSB7XG4gIG9uOiBtb2NrQ2hva2lkYXJXYXRjaGVyT24sXG59O1xuY29uc3QgZmFrZUNob2tpZGFyV2F0Y2hlck9uID0ge1xuICBnZXQgcmVhZHlDYWxsYmFjaygpOiAoKSA9PiB2b2lkIHtcbiAgICBleHBlY3QobW9ja0Nob2tpZGFyV2F0Y2hlck9uLm1vY2suY2FsbHMubGVuZ3RoKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDEpO1xuICAgIC8vIFRoZSBjYWxsIHRvIHRoZSBmaXJzdCAnd2F0Y2hlci5vbigpJyBpbiB0aGUgcHJvZHVjdGlvbiBjb2RlIGlzIHRoZSBvbmUgd2UgYWN0dWFsbHkgd2FudCBoZXJlLlxuICAgIC8vIFRoaXMgaXMgYSBwcmV0dHkgZnJhZ2lsZSwgYnV0IGF0IGxlYXN0IHdpdGggdGhpcyBoZWxwZXIgY2xhc3MsXG4gICAgLy8gd2Ugd291bGQgaGF2ZSB0byBjaGFuZ2UgaXQgb25seSBpbiBvbmUgcGxhY2UgaWYgaXQgZXZlciBicmVha3NcbiAgICBjb25zdCBmaXJzdENhbGwgPSBtb2NrQ2hva2lkYXJXYXRjaGVyT24ubW9jay5jYWxsc1swXTtcbiAgICAvLyBsZXQncyBtYWtlIHN1cmUgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIHRoZSAncmVhZHknIGV2ZW50LFxuICAgIC8vIGp1c3QgdG8gYmUgZG91YmxlIHNhZmVcbiAgICBleHBlY3QoZmlyc3RDYWxsWzBdKS50b0JlKCdyZWFkeScpO1xuICAgIC8vIHRoZSBzZWNvbmQgYXJndW1lbnQgaXMgdGhlIGNhbGxiYWNrXG4gICAgcmV0dXJuIGZpcnN0Q2FsbFsxXTtcbiAgfSxcblxuICBnZXQgZmlsZUV2ZW50Q2FsbGJhY2soKTogKFxuICBldmVudDogJ2FkZCcgfCAnYWRkRGlyJyB8ICdjaGFuZ2UnIHwgJ3VubGluaycgfCAndW5saW5rRGlyJyxcbiAgcGF0aDogc3RyaW5nLFxuICApID0+IFByb21pc2U8dm9pZD4ge1xuICAgIGV4cGVjdChtb2NrQ2hva2lkYXJXYXRjaGVyT24ubW9jay5jYWxscy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMik7XG4gICAgY29uc3Qgc2Vjb25kQ2FsbCA9IG1vY2tDaG9raWRhcldhdGNoZXJPbi5tb2NrLmNhbGxzWzFdO1xuICAgIC8vIGxldCdzIG1ha2Ugc3VyZSB0aGUgZmlyc3QgYXJndW1lbnQgaXMgbm90IHRoZSAncmVhZHknIGV2ZW50LFxuICAgIC8vIGp1c3QgdG8gYmUgZG91YmxlIHNhZmVcbiAgICBleHBlY3Qoc2Vjb25kQ2FsbFswXSkubm90LnRvQmUoJ3JlYWR5Jyk7XG4gICAgLy8gdGhlIHNlY29uZCBhcmd1bWVudCBpcyB0aGUgY2FsbGJhY2tcbiAgICByZXR1cm4gc2Vjb25kQ2FsbFsxXTtcbiAgfSxcbn07XG5cbmNvbnN0IG1vY2tDaG9raWRhcldhdGNoID0gamVzdC5mbigpO1xuamVzdC5tb2NrKCdjaG9raWRhcicsICgpID0+ICh7XG4gIHdhdGNoOiBtb2NrQ2hva2lkYXJXYXRjaCxcbn0pKTtcbmNvbnN0IGZha2VDaG9raWRhcldhdGNoID0ge1xuICBnZXQgaW5jbHVkZUFyZ3MoKTogc3RyaW5nW10ge1xuICAgIGV4cGVjdChtb2NrQ2hva2lkYXJXYXRjaC5tb2NrLmNhbGxzLmxlbmd0aCkudG9CZSgxKTtcbiAgICAvLyB0aGUgaW5jbHVkZSBhcmdzIGFyZSB0aGUgZmlyc3QgcGFyYW1ldGVyIHRvIHRoZSAnd2F0Y2goKScgY2FsbFxuICAgIHJldHVybiBtb2NrQ2hva2lkYXJXYXRjaC5tb2NrLmNhbGxzWzBdWzBdO1xuICB9LFxuXG4gIGdldCBleGNsdWRlQXJncygpOiBzdHJpbmdbXSB7XG4gICAgZXhwZWN0KG1vY2tDaG9raWRhcldhdGNoLm1vY2suY2FsbHMubGVuZ3RoKS50b0JlKDEpO1xuICAgIC8vIHRoZSBpZ25vcmUgYXJncyBhcmUgYSBwcm9wZXJ0eSBvZiB0aGUgc2Vjb25kIHBhcmFtZXRlciB0byB0aGUgJ3dhdGNoKCknIGNhbGxcbiAgICBjb25zdCBjaG9raWRhcldhdGNoT3B0cyA9IG1vY2tDaG9raWRhcldhdGNoLm1vY2suY2FsbHNbMF1bMV07XG4gICAgcmV0dXJuIGNob2tpZGFyV2F0Y2hPcHRzLmlnbm9yZWQ7XG4gIH0sXG59O1xuXG5jb25zdCBtb2NrRGF0YSA9IGplc3QuZm4oKTtcbmplc3QubW9jaygnLi4vbGliL2xvZ2dpbmcnLCAoKSA9PiAoe1xuICAuLi5qZXN0LnJlcXVpcmVBY3R1YWwoJy4uL2xpYi9sb2dnaW5nJyksXG4gIGRhdGE6IG1vY2tEYXRhLFxufSkpO1xuamVzdC5zZXRUaW1lb3V0KDMwXzAwMCk7XG5cbmltcG9ydCAnYXdzLXNkay1jbGllbnQtbW9jayc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY3hzY2hlbWEgZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCB7IE1hbmlmZXN0IH0gZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgeyBEZXNjcmliZVN0YWNrc0NvbW1hbmQsIEdldFRlbXBsYXRlQ29tbWFuZCwgU3RhY2tTdGF0dXMgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWRmb3JtYXRpb24nO1xuaW1wb3J0IHsgR2V0UGFyYW1ldGVyQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zc20nO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0ICogYXMgcHJvbXB0bHkgZnJvbSAncHJvbXB0bHknO1xuaW1wb3J0IHsgaW5zdGFuY2VNb2NrRnJvbSwgTW9ja0Nsb3VkRXhlY3V0YWJsZSwgVGVzdFN0YWNrQXJ0aWZhY3QgfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgU2RrUHJvdmlkZXIgfSBmcm9tICcuLi9saWInO1xuaW1wb3J0IHtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LFxuICBNb2NrU2RrLFxuICBNb2NrU2RrUHJvdmlkZXIsXG4gIG1vY2tTU01DbGllbnQsXG4gIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCxcbn0gZnJvbSAnLi91dGlsL21vY2stc2RrJztcbmltcG9ydCB7IEJvb3RzdHJhcHBlciwgdHlwZSBCb290c3RyYXBTb3VyY2UgfSBmcm9tICcuLi9saWIvYXBpL2Jvb3RzdHJhcCc7XG5pbXBvcnQgeyBEZXBsb3lTdGFja1Jlc3VsdCwgU3VjY2Vzc2Z1bERlcGxveVN0YWNrUmVzdWx0IH0gZnJvbSAnLi4vbGliL2FwaS9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHtcbiAgRGVwbG95bWVudHMsXG4gIERlcGxveVN0YWNrT3B0aW9ucyxcbiAgRGVzdHJveVN0YWNrT3B0aW9ucyxcbiAgUm9sbGJhY2tTdGFja09wdGlvbnMsXG4gIFJvbGxiYWNrU3RhY2tSZXN1bHQsXG59IGZyb20gJy4uL2xpYi9hcGkvZGVwbG95bWVudHMnO1xuaW1wb3J0IHsgSG90c3dhcE1vZGUgfSBmcm9tICcuLi9saWIvYXBpL2hvdHN3YXAvY29tbW9uJztcbmltcG9ydCB7IE1vZGUgfSBmcm9tICcuLi9saWIvYXBpL3BsdWdpbi9tb2RlJztcbmltcG9ydCB7IFRlbXBsYXRlIH0gZnJvbSAnLi4vbGliL2FwaS91dGlsL2Nsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IENka1Rvb2xraXQsIG1hcmtUZXN0aW5nLCBUYWcgfSBmcm9tICcuLi9saWIvY2RrLXRvb2xraXQnO1xuaW1wb3J0IHsgUmVxdWlyZUFwcHJvdmFsIH0gZnJvbSAnLi4vbGliL2RpZmYnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2xpYi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAnLi4vbGliL3V0aWwnO1xuXG5tYXJrVGVzdGluZygpO1xuXG5jb25zdCBkZWZhdWx0Qm9vdHN0cmFwU291cmNlOiBCb290c3RyYXBTb3VyY2UgPSB7IHNvdXJjZTogJ2RlZmF1bHQnIH07XG5jb25zdCBib290c3RyYXBFbnZpcm9ubWVudE1vY2sgPSBqZXN0LnNweU9uKEJvb3RzdHJhcHBlci5wcm90b3R5cGUsICdib290c3RyYXBFbnZpcm9ubWVudCcpO1xubGV0IGNsb3VkRXhlY3V0YWJsZTogTW9ja0Nsb3VkRXhlY3V0YWJsZTtcbmxldCBzdGRlcnJNb2NrOiBqZXN0LlNweUluc3RhbmNlO1xuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGplc3QucmVzZXRBbGxNb2NrcygpO1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcblxuICBtb2NrQ2hva2lkYXJXYXRjaC5tb2NrUmV0dXJuVmFsdWUoZmFrZUNob2tpZGFyV2F0Y2hlcik7XG4gIC8vIG9uKCkgaW4gY2hva2lkYXIncyBXYXRjaGVyIHJldHVybnMgJ3RoaXMnXG4gIG1vY2tDaG9raWRhcldhdGNoZXJPbi5tb2NrUmV0dXJuVmFsdWUoZmFrZUNob2tpZGFyV2F0Y2hlcik7XG5cbiAgYm9vdHN0cmFwRW52aXJvbm1lbnRNb2NrLm1vY2tSZXNvbHZlZFZhbHVlKHtcbiAgICBub09wOiBmYWxzZSxcbiAgICBvdXRwdXRzOiB7fSxcbiAgICB0eXBlOiAnZGlkLWRlcGxveS1zdGFjaycsXG4gICAgc3RhY2tBcm46ICdmYWtlLWFybicsXG4gIH0pO1xuXG4gIGNsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICBzdGFja3M6IFtNb2NrU3RhY2suTU9DS19TVEFDS19BLCBNb2NrU3RhY2suTU9DS19TVEFDS19CXSxcbiAgICBuZXN0ZWRBc3NlbWJsaWVzOiBbXG4gICAgICB7XG4gICAgICAgIHN0YWNrczogW01vY2tTdGFjay5NT0NLX1NUQUNLX0NdLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICBzdGRlcnJNb2NrID0gamVzdC5zcHlPbihwcm9jZXNzLnN0ZGVyciwgJ3dyaXRlJykubW9ja0ltcGxlbWVudGF0aW9uKCgpID0+IHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG59KTtcblxuZnVuY3Rpb24gZGVmYXVsdFRvb2xraXRTZXR1cCgpIHtcbiAgcmV0dXJuIG5ldyBDZGtUb29sa2l0KHtcbiAgICBjbG91ZEV4ZWN1dGFibGUsXG4gICAgY29uZmlndXJhdGlvbjogY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICBkZXBsb3ltZW50czogbmV3IEZha2VDbG91ZEZvcm1hdGlvbih7XG4gICAgICAnVGVzdC1TdGFjay1BJzogeyBGb286ICdCYXInIH0sXG4gICAgICAnVGVzdC1TdGFjay1CJzogeyBCYXo6ICdaaW5nYSEnIH0sXG4gICAgICAnVGVzdC1TdGFjay1DJzogeyBCYXo6ICdaaW5nYSEnIH0sXG4gICAgfSksXG4gIH0pO1xufVxuXG5jb25zdCBtb2NrU2RrID0gbmV3IE1vY2tTZGsoKTtcblxuZGVzY3JpYmUoJ3JlYWRDdXJyZW50VGVtcGxhdGUnLCAoKSA9PiB7XG4gIGxldCB0ZW1wbGF0ZTogYW55O1xuICBsZXQgbW9ja0Nsb3VkRXhlY3V0YWJsZTogTW9ja0Nsb3VkRXhlY3V0YWJsZTtcbiAgbGV0IHNka1Byb3ZpZGVyOiBTZGtQcm92aWRlcjtcbiAgbGV0IG1vY2tGb3JFbnZpcm9ubWVudDogYW55O1xuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBqZXN0LnJlc2V0QWxsTW9ja3MoKTtcbiAgICB0ZW1wbGF0ZSA9IHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgS2V5OiAnVmFsdWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG4gICAgbW9ja0Nsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICAgIHN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnVGVzdC1TdGFjay1DJyxcbiAgICAgICAgICB0ZW1wbGF0ZSxcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhc3N1bWVSb2xlQXJuOiAnYmxvb3A6JHtBV1M6OlJlZ2lvbn06JHtBV1M6OkFjY291bnRJZH0nLFxuICAgICAgICAgICAgbG9va3VwUm9sZToge1xuICAgICAgICAgICAgICBhcm46ICdibG9vcC1sb29rdXA6JHtBV1M6OlJlZ2lvbn06JHtBV1M6OkFjY291bnRJZH0nLFxuICAgICAgICAgICAgICByZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbjogNSxcbiAgICAgICAgICAgICAgYm9vdHN0cmFwU3RhY2tWZXJzaW9uU3NtUGFyYW1ldGVyOiAnL2Jvb3RzdHJhcC9wYXJhbWV0ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnVGVzdC1TdGFjay1BJyxcbiAgICAgICAgICB0ZW1wbGF0ZSxcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhc3N1bWVSb2xlQXJuOiAnYmxvb3A6JHtBV1M6OlJlZ2lvbn06JHtBV1M6OkFjY291bnRJZH0nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHNka1Byb3ZpZGVyID0gbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcjtcbiAgICBtb2NrRm9yRW52aXJvbm1lbnQgPSBqZXN0XG4gICAgICAuc3B5T24oc2RrUHJvdmlkZXIsICdmb3JFbnZpcm9ubWVudCcpXG4gICAgICAubW9ja1Jlc29sdmVkVmFsdWUoeyBzZGs6IG1vY2tTZGssIGRpZEFzc3VtZVJvbGU6IHRydWUgfSk7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50XG4gICAgICAub24oR2V0VGVtcGxhdGVDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgVGVtcGxhdGVCb2R5OiBKU09OLnN0cmluZ2lmeSh0ZW1wbGF0ZSksXG4gICAgICB9KVxuICAgICAgLm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFN0YWNrczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIFN0YWNrTmFtZTogJ1Rlc3QtU3RhY2stQycsXG4gICAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgU3RhY2tOYW1lOiAnVGVzdC1TdGFjay1BJyxcbiAgICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rdXAgcm9sZSBpcyB1c2VkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja1NTTUNsaWVudC5vbihHZXRQYXJhbWV0ZXJDb21tYW5kKS5yZXNvbHZlcyh7IFBhcmFtZXRlcjogeyBWYWx1ZTogJzYnIH0gfSk7XG5cbiAgICBjb25zdCBjZGtUb29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgY2xvdWRFeGVjdXRhYmxlOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLFxuICAgICAgY29uZmlndXJhdGlvbjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICBkZXBsb3ltZW50czogbmV3IERlcGxveW1lbnRzKHtcbiAgICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBjZGtUb29sa2l0LmRlcGxveSh7XG4gICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUMnXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChtb2NrU1NNQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldFBhcmFtZXRlckNvbW1hbmQsIHtcbiAgICAgIE5hbWU6ICcvYm9vdHN0cmFwL3BhcmFtZXRlcicsXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tGb3JFbnZpcm9ubWVudCkudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDIpO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMSxcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcC1sb29rdXA6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdmYWxsYmFjayB0byBkZXBsb3kgcm9sZSBpZiBib290c3RyYXAgc3RhY2sgdmVyc2lvbiBpcyBub3QgdmFsaWQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLnJlc29sdmVzKHsgUGFyYW1ldGVyOiB7IFZhbHVlOiAnMScgfSB9KTtcblxuICAgIGNvbnN0IGNka1Rvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICBjbG91ZEV4ZWN1dGFibGU6IG1vY2tDbG91ZEV4ZWN1dGFibGUsXG4gICAgICBjb25maWd1cmF0aW9uOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICBzZGtQcm92aWRlcjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgIGRlcGxveW1lbnRzOiBuZXcgRGVwbG95bWVudHMoe1xuICAgICAgICBzZGtQcm92aWRlcjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGNka1Rvb2xraXQuZGVwbG95KHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQyddIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGZsYXR0ZW4oc3RkZXJyTW9jay5tb2NrLmNhbGxzKSkudG9FcXVhbChcbiAgICAgIGV4cGVjdC5hcnJheUNvbnRhaW5pbmcoW1xuXG4gICAgICAgIGV4cGVjdC5zdHJpbmdDb250YWluaW5nKFxuICAgICAgICAgIFwiQm9vdHN0cmFwIHN0YWNrIHZlcnNpb24gJzUnIGlzIHJlcXVpcmVkLCBmb3VuZCB2ZXJzaW9uICcxJy4gVG8gZ2V0IHJpZCBvZiB0aGlzIGVycm9yLCBwbGVhc2UgdXBncmFkZSB0byBib290c3RyYXAgdmVyc2lvbiA+PSA1XCIsXG4gICAgICAgICksXG4gICAgICBdKSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrU1NNQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldFBhcmFtZXRlckNvbW1hbmQsIHtcbiAgICAgIE5hbWU6ICcvYm9vdHN0cmFwL3BhcmFtZXRlcicsXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tGb3JFbnZpcm9ubWVudCkudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDMpO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMSxcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcC1sb29rdXA6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMixcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDpoZXJlOjEyMzQ1Njc4OTAxMicsXG4gICAgICAgIGFzc3VtZVJvbGVFeHRlcm5hbElkOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2ZhbGxiYWNrIHRvIGRlcGxveSByb2xlIGlmIGJvb3RzdHJhcCB2ZXJzaW9uIHBhcmFtZXRlciBub3QgZm91bmQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLmNhbGxzRmFrZSgoKSA9PiB7XG4gICAgICBjb25zdCBlOiBhbnkgPSBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpO1xuICAgICAgZS5jb2RlID0gZS5uYW1lID0gJ1BhcmFtZXRlck5vdEZvdW5kJztcbiAgICAgIHRocm93IGU7XG4gICAgfSk7XG5cbiAgICBjb25zdCBjZGtUb29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgY2xvdWRFeGVjdXRhYmxlOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLFxuICAgICAgY29uZmlndXJhdGlvbjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICBkZXBsb3ltZW50czogbmV3IERlcGxveW1lbnRzKHtcbiAgICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBjZGtUb29sa2l0LmRlcGxveSh7XG4gICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUMnXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChmbGF0dGVuKHN0ZGVyck1vY2subW9jay5jYWxscykpLnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtleHBlY3Quc3RyaW5nTWF0Y2hpbmcoL1NTTSBwYXJhbWV0ZXIuKm5vdCBmb3VuZC4vKV0pLFxuICAgICk7XG4gICAgZXhwZWN0KG1vY2tGb3JFbnZpcm9ubWVudCkudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDMpO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMSxcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcC1sb29rdXA6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMixcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDpoZXJlOjEyMzQ1Njc4OTAxMicsXG4gICAgICAgIGFzc3VtZVJvbGVFeHRlcm5hbElkOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2ZhbGxiYWNrIHRvIGRlcGxveSByb2xlIGlmIGZvckVudmlyb25tZW50IHRocm93cycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIC8vIHRocm93IGVycm9yIGZpcnN0IGZvciB0aGUgJ3ByZXBhcmVTZGtXaXRoTG9va3VwUm9sZUZvcicgY2FsbCBhbmQgc3VjY2VlZCBmb3IgdGhlIHJlc3RcbiAgICBtb2NrRm9yRW52aXJvbm1lbnQgPSBqZXN0LnNweU9uKHNka1Byb3ZpZGVyLCAnZm9yRW52aXJvbm1lbnQnKS5tb2NrSW1wbGVtZW50YXRpb25PbmNlKCgpID0+IHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlRXJyb3JUaGF0R2V0c1Rocm93bicpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgY2RrVG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgIGNsb3VkRXhlY3V0YWJsZTogbW9ja0Nsb3VkRXhlY3V0YWJsZSxcbiAgICAgIGNvbmZpZ3VyYXRpb246IG1vY2tDbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbixcbiAgICAgIHNka1Byb3ZpZGVyOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLnNka1Byb3ZpZGVyLFxuICAgICAgZGVwbG95bWVudHM6IG5ldyBEZXBsb3ltZW50cyh7XG4gICAgICAgIHNka1Byb3ZpZGVyOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLnNka1Byb3ZpZGVyLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgY2RrVG9vbGtpdC5kZXBsb3koe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFsnVGVzdC1TdGFjay1DJ10gfSxcbiAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobW9ja1NTTUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQW55Q29tbWFuZCgpO1xuICAgIGV4cGVjdChmbGF0dGVuKHN0ZGVyck1vY2subW9jay5jYWxscykpLnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtleHBlY3Quc3RyaW5nTWF0Y2hpbmcoL1RoZUVycm9yVGhhdEdldHNUaHJvd24vKV0pLFxuICAgICk7XG4gICAgZXhwZWN0KG1vY2tGb3JFbnZpcm9ubWVudCkudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDMpO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMSxcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcC1sb29rdXA6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMixcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDAsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDpoZXJlOjEyMzQ1Njc4OTAxMicsXG4gICAgICAgIGFzc3VtZVJvbGVFeHRlcm5hbElkOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2RvbnQgbG9va3VwIGJvb3RzdHJhcCB2ZXJzaW9uIHBhcmFtZXRlciBpZiBkZWZhdWx0IGNyZWRlbnRpYWxzIGFyZSB1c2VkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja0ZvckVudmlyb25tZW50ID0gamVzdC5mbigpLm1vY2tJbXBsZW1lbnRhdGlvbigoKSA9PiB7XG4gICAgICByZXR1cm4geyBzZGs6IG1vY2tTZGssIGRpZEFzc3VtZVJvbGU6IGZhbHNlIH07XG4gICAgfSk7XG4gICAgbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlci5mb3JFbnZpcm9ubWVudCA9IG1vY2tGb3JFbnZpcm9ubWVudDtcbiAgICBjb25zdCBjZGtUb29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgY2xvdWRFeGVjdXRhYmxlOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLFxuICAgICAgY29uZmlndXJhdGlvbjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICBkZXBsb3ltZW50czogbmV3IERlcGxveW1lbnRzKHtcbiAgICAgICAgc2RrUHJvdmlkZXI6IG1vY2tDbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBjZGtUb29sa2l0LmRlcGxveSh7XG4gICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUMnXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChmbGF0dGVuKHN0ZGVyck1vY2subW9jay5jYWxscykpLnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtcbiAgICAgICAgZXhwZWN0LnN0cmluZ01hdGNoaW5nKC9Mb29rdXAgcm9sZS4qd2FzIG5vdCBhc3N1bWVkLiBQcm9jZWVkaW5nIHdpdGggZGVmYXVsdCBjcmVkZW50aWFscy4vKSxcbiAgICAgIF0pLFxuICAgICk7XG4gICAgZXhwZWN0KG1vY2tTU01DbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZEFueUNvbW1hbmQoKTtcbiAgICBleHBlY3QobW9ja0ZvckVudmlyb25tZW50KS50b0hhdmVCZWVuTnRoQ2FsbGVkV2l0aChcbiAgICAgIDEsXG4gICAgICB7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgICAgICBuYW1lOiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2hlcmUnLFxuICAgICAgICByZWdpb246ICdoZXJlJyxcbiAgICAgIH0sXG4gICAgICBNb2RlLkZvclJlYWRpbmcsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcC1sb29rdXA6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMixcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIE1vZGUuRm9yV3JpdGluZyxcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOmhlcmU6MTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgYXNzdW1lUm9sZUV4dGVybmFsSWQ6IHVuZGVmaW5lZCxcbiAgICAgIH0sXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgnZG8gbm90IHByaW50IHdhcm5pbmdzIGlmIGxvb2t1cCByb2xlIG5vdCBwcm92aWRlZCBpbiBzdGFjayBhcnRpZmFjdCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IGNka1Rvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICBjbG91ZEV4ZWN1dGFibGU6IG1vY2tDbG91ZEV4ZWN1dGFibGUsXG4gICAgICBjb25maWd1cmF0aW9uOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICBzZGtQcm92aWRlcjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgIGRlcGxveW1lbnRzOiBuZXcgRGVwbG95bWVudHMoe1xuICAgICAgICBzZGtQcm92aWRlcjogbW9ja0Nsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGNka1Rvb2xraXQuZGVwbG95KHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQSddIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGZsYXR0ZW4oc3RkZXJyTW9jay5tb2NrLmNhbGxzKSkubm90LnRvRXF1YWwoXG4gICAgICBleHBlY3QuYXJyYXlDb250YWluaW5nKFtcbiAgICAgICAgZXhwZWN0LnN0cmluZ01hdGNoaW5nKC9Db3VsZCBub3QgYXNzdW1lLyksXG4gICAgICAgIGV4cGVjdC5zdHJpbmdNYXRjaGluZygvcGxlYXNlIHVwZ3JhZGUgdG8gYm9vdHN0cmFwIHZlcnNpb24vKSxcbiAgICAgIF0pLFxuICAgICk7XG4gICAgZXhwZWN0KG1vY2tTU01DbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZEFueUNvbW1hbmQoKTtcbiAgICBleHBlY3QobW9ja0ZvckVudmlyb25tZW50KS50b0hhdmVCZWVuQ2FsbGVkVGltZXMoMik7XG4gICAgZXhwZWN0KG1vY2tGb3JFbnZpcm9ubWVudCkudG9IYXZlQmVlbk50aENhbGxlZFdpdGgoXG4gICAgICAxLFxuICAgICAge1xuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgbmFtZTogJ2F3czovLzEyMzQ1Njc4OTAxMi9oZXJlJyxcbiAgICAgICAgcmVnaW9uOiAnaGVyZScsXG4gICAgICB9LFxuICAgICAgMCxcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogdW5kZWZpbmVkLFxuICAgICAgICBhc3N1bWVSb2xlRXh0ZXJuYWxJZDogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5OdGhDYWxsZWRXaXRoKFxuICAgICAgMixcbiAgICAgIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIG5hbWU6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvaGVyZScsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgfSxcbiAgICAgIDEsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDpoZXJlOjEyMzQ1Njc4OTAxMicsXG4gICAgICAgIGFzc3VtZVJvbGVFeHRlcm5hbElkOiB1bmRlZmluZWQsXG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdib290c3RyYXAnLCAoKSA9PiB7XG4gIHRlc3QoJ2FjY2VwdHMgcXVhbGlmaWVyIGZyb20gY29udGV4dCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbiA9IG5ldyBDb25maWd1cmF0aW9uKCk7XG4gICAgY29uZmlndXJhdGlvbi5jb250ZXh0LnNldCgnQGF3cy1jZGsvY29yZTpib290c3RyYXBRdWFsaWZpZXInLCAnYWJjZGUnKTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCB0b29sa2l0LmJvb3RzdHJhcChbJ2F3czovLzU2Nzg5L3NvdXRoLXBvbGUnXSwge1xuICAgICAgc291cmNlOiBkZWZhdWx0Qm9vdHN0cmFwU291cmNlLFxuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBxdWFsaWZpZXI6IGNvbmZpZ3VyYXRpb24uY29udGV4dC5nZXQoJ0Bhd3MtY2RrL2NvcmU6Ym9vdHN0cmFwUXVhbGlmaWVyJyksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChib290c3RyYXBFbnZpcm9ubWVudE1vY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5hbnl0aGluZygpLCBleHBlY3QuYW55dGhpbmcoKSwge1xuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICBxdWFsaWZpZXI6ICdhYmNkZScsXG4gICAgICB9LFxuICAgICAgc291cmNlOiBkZWZhdWx0Qm9vdHN0cmFwU291cmNlLFxuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnZGVwbG95JywgKCkgPT4ge1xuICB0ZXN0KCdmYWlscyB3aGVuIG5vIHZhbGlkIHN0YWNrIG5hbWVzIGFyZSBnaXZlbicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICB0b29sa2l0LmRlcGxveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stRCddIH0sXG4gICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KCdObyBzdGFja3MgbWF0Y2ggdGhlIG5hbWUocykgVGVzdC1TdGFjay1EJyk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCd3aXRoIGhvdHN3YXAgZGVwbG95bWVudCcsICgpID0+IHtcbiAgICB0ZXN0KFwicGFzc2VzIHRocm91Z2ggdGhlICdob3Rzd2FwJyBvcHRpb24gdG8gQ2xvdWRGb3JtYXRpb25EZXBsb3ltZW50cy5kZXBsb3lTdGFjaygpXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBjb25zdCBtb2NrQ2ZuRGVwbG95bWVudHMgPSBpbnN0YW5jZU1vY2tGcm9tKERlcGxveW1lbnRzKTtcbiAgICAgIG1vY2tDZm5EZXBsb3ltZW50cy5kZXBsb3lTdGFjay5tb2NrUmV0dXJuVmFsdWUoXG4gICAgICAgIFByb21pc2UucmVzb2x2ZSh7XG4gICAgICAgICAgdHlwZTogJ2RpZC1kZXBsb3ktc3RhY2snLFxuICAgICAgICAgIG5vT3A6IGZhbHNlLFxuICAgICAgICAgIG91dHB1dHM6IHt9LFxuICAgICAgICAgIHN0YWNrQXJuOiAnc3RhY2tBcm4nLFxuICAgICAgICAgIHN0YWNrQXJ0aWZhY3Q6IGluc3RhbmNlTW9ja0Zyb20oY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0KSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrVG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgICAgY2xvdWRFeGVjdXRhYmxlLFxuICAgICAgICBjb25maWd1cmF0aW9uOiBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbixcbiAgICAgICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgICAgZGVwbG95bWVudHM6IG1vY2tDZm5EZXBsb3ltZW50cyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCBjZGtUb29sa2l0LmRlcGxveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQS1EaXNwbGF5LU5hbWUnXSB9LFxuICAgICAgICByZXF1aXJlQXBwcm92YWw6IFJlcXVpcmVBcHByb3ZhbC5OZXZlcixcbiAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRkFMTF9CQUNLLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChtb2NrQ2ZuRGVwbG95bWVudHMuZGVwbG95U3RhY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRkFMTF9CQUNLLFxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdtYWtlcyBjb3JyZWN0IENsb3VkRm9ybWF0aW9uIGNhbGxzJywgKCkgPT4ge1xuICAgIHRlc3QoJ3dpdGhvdXQgb3B0aW9ucycsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCB0b29sa2l0LmRlcGxveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQScsICdUZXN0LVN0YWNrLUInXSB9LFxuICAgICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3dpdGggc3RhY2tzIGFsbCBzdGFja3Mgc3BlY2lmaWVkIGFzIGRvdWJsZSB3aWxkY2FyZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCB0b29sa2l0LmRlcGxveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJyoqJ10gfSxcbiAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd3aXRoIG9uZSBzdGFjayBzcGVjaWZpZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgYXdhaXQgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUEtRGlzcGxheS1OYW1lJ10gfSxcbiAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd3aXRoIHN0YWNrcyBhbGwgc3RhY2tzIHNwZWNpZmllZCBhcyB3aWxkY2FyZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBhd2FpdCB0b29sa2l0LmRlcGxveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJyonXSB9LFxuICAgICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGRlc2NyaWJlKCdzbnMgbm90aWZpY2F0aW9uIGFybnMnLCAoKSA9PiB7XG4gICAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgICAgY2xvdWRFeGVjdXRhYmxlID0gbmV3IE1vY2tDbG91ZEV4ZWN1dGFibGUoe1xuICAgICAgICAgIHN0YWNrczogW1xuICAgICAgICAgICAgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQSxcbiAgICAgICAgICAgIE1vY2tTdGFjay5NT0NLX1NUQUNLX0IsXG4gICAgICAgICAgICBNb2NrU3RhY2suTU9DS19TVEFDS19XSVRIX05PVElGSUNBVElPTl9BUk5TLFxuICAgICAgICAgICAgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfV0lUSF9CQURfTk9USUZJQ0FUSU9OX0FSTlMsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnd2l0aCBzbnMgbm90aWZpY2F0aW9uIGFybnMgYXMgb3B0aW9ucycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uQXJucyA9IFtcbiAgICAgICAgICAnYXJuOmF3czpzbnM6dXMtZWFzdC0yOjQ0NDQ1NTU1NjY2NjpNeVRvcGljJyxcbiAgICAgICAgICAnYXJuOmF3czpzbnM6ZXUtd2VzdC0xOjExMTE1NTU1NjY2NjpteS1ncmVhdC10b3BpYycsXG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IHRvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICAgICAgY2xvdWRFeGVjdXRhYmxlLFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb246IGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgICAgIHNka1Byb3ZpZGVyOiBjbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICAgICAgZGVwbG95bWVudHM6IG5ldyBGYWtlQ2xvdWRGb3JtYXRpb24oXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICdUZXN0LVN0YWNrLUEnOiB7IEZvbzogJ0JhcicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICAgIC8vIFN0YWNrcyBzaG91bGQgYmUgc2VsZWN0ZWQgYnkgdGhlaXIgaGllcmFyY2hpY2FsIElELCB3aGljaCBpcyB0aGVpciBkaXNwbGF5TmFtZSwgbm90IGJ5IHRoZSBzdGFjayBJRC5cbiAgICAgICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUEtRGlzcGxheS1OYW1lJ10gfSxcbiAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnZmFpbCB3aXRoIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgYXMgb3B0aW9ucycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uQXJucyA9IFsnYXJuOjo6Y2ZuLW15LWNvb2wtdG9waWMnXTtcbiAgICAgICAgY29uc3QgdG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgICAgICBjbG91ZEV4ZWN1dGFibGUsXG4gICAgICAgICAgY29uZmlndXJhdGlvbjogY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICAgICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgICAgICBkZXBsb3ltZW50czogbmV3IEZha2VDbG91ZEZvcm1hdGlvbihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgJ1Rlc3QtU3RhY2stQSc6IHsgRm9vOiAnQmFyJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbkFybnMsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBhd2FpdCBleHBlY3QoKCkgPT5cbiAgICAgICAgICB0b29sa2l0LmRlcGxveSh7XG4gICAgICAgICAgICAvLyBTdGFja3Mgc2hvdWxkIGJlIHNlbGVjdGVkIGJ5IHRoZWlyIGhpZXJhcmNoaWNhbCBJRCwgd2hpY2ggaXMgdGhlaXIgZGlzcGxheU5hbWUsIG5vdCBieSB0aGUgc3RhY2sgSUQuXG4gICAgICAgICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLUEtRGlzcGxheS1OYW1lJ10gfSxcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbkFybnMsXG4gICAgICAgICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgICAgICAgfSksXG4gICAgICAgICkucmVqZWN0cy50b1Rocm93KCdOb3RpZmljYXRpb24gYXJuIGFybjo6OmNmbi1teS1jb29sLXRvcGljIGlzIG5vdCBhIHZhbGlkIGFybiBmb3IgYW4gU05TIHRvcGljJyk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnd2l0aCBzbnMgbm90aWZpY2F0aW9uIGFybnMgaW4gdGhlIGV4ZWN1dGFibGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIEdJVkVOXG4gICAgICAgIGNvbnN0IGV4cGVjdGVkTm90aWZpY2F0aW9uQXJucyA9IFsnYXJuOmF3czpzbnM6YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpNeVRvcGljJ107XG4gICAgICAgIGNvbnN0IHRvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICAgICAgY2xvdWRFeGVjdXRhYmxlLFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb246IGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgICAgIHNka1Byb3ZpZGVyOiBjbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICAgICAgZGVwbG95bWVudHM6IG5ldyBGYWtlQ2xvdWRGb3JtYXRpb24oXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICdUZXN0LVN0YWNrLU5vdGlmaWNhdGlvbi1Bcm5zJzogeyBGb286ICdCYXInIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhwZWN0ZWROb3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stTm90aWZpY2F0aW9uLUFybnMnXSB9LFxuICAgICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnZmFpbCB3aXRoIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgaW4gdGhlIGV4ZWN1dGFibGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIEdJVkVOXG4gICAgICAgIGNvbnN0IHRvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICAgICAgY2xvdWRFeGVjdXRhYmxlLFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb246IGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgICAgIHNka1Byb3ZpZGVyOiBjbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICAgICAgZGVwbG95bWVudHM6IG5ldyBGYWtlQ2xvdWRGb3JtYXRpb24oe1xuICAgICAgICAgICAgJ1Rlc3QtU3RhY2stQmFkLU5vdGlmaWNhdGlvbi1Bcm5zJzogeyBGb286ICdCYXInIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgICAgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFsnVGVzdC1TdGFjay1CYWQtTm90aWZpY2F0aW9uLUFybnMnXSB9LFxuICAgICAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgICAgICAgIH0pLFxuICAgICAgICApLnJlamVjdHMudG9UaHJvdygnTm90aWZpY2F0aW9uIGFybiBhcm46MTMzNzoxMjM0NTY3ODkwMTI6c25zOmJhZCBpcyBub3QgYSB2YWxpZCBhcm4gZm9yIGFuIFNOUyB0b3BpYycpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3QoJ3dpdGggc25zIG5vdGlmaWNhdGlvbiBhcm5zIGluIHRoZSBleGVjdXRhYmxlIGFuZCBhcyBvcHRpb25zJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBjb25zdCBub3RpZmljYXRpb25Bcm5zID0gW1xuICAgICAgICAgICdhcm46YXdzOnNuczp1cy1lYXN0LTI6NDQ0NDU1NTU2NjY2Ok15VG9waWMnLFxuICAgICAgICAgICdhcm46YXdzOnNuczpldS13ZXN0LTE6MTExMTU1NTU2NjY2Om15LWdyZWF0LXRvcGljJyxcbiAgICAgICAgXTtcblxuICAgICAgICBjb25zdCBleHBlY3RlZE5vdGlmaWNhdGlvbkFybnMgPSBub3RpZmljYXRpb25Bcm5zLmNvbmNhdChbXG4gICAgICAgICAgJ2Fybjphd3M6c25zOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6TXlUb3BpYycsXG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCB0b29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgICAgIGNsb3VkRXhlY3V0YWJsZSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uOiBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbixcbiAgICAgICAgICBzZGtQcm92aWRlcjogY2xvdWRFeGVjdXRhYmxlLnNka1Byb3ZpZGVyLFxuICAgICAgICAgIGRlcGxveW1lbnRzOiBuZXcgRmFrZUNsb3VkRm9ybWF0aW9uKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAnVGVzdC1TdGFjay1Ob3RpZmljYXRpb24tQXJucyc6IHsgRm9vOiAnQmFyJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4cGVjdGVkTm90aWZpY2F0aW9uQXJucyxcbiAgICAgICAgICApLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGF3YWl0IHRvb2xraXQuZGVwbG95KHtcbiAgICAgICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogWydUZXN0LVN0YWNrLU5vdGlmaWNhdGlvbi1Bcm5zJ10gfSxcbiAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnZmFpbCB3aXRoIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgaW4gdGhlIGV4ZWN1dGFibGUgYW5kIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgYXMgb3B0aW9ucycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uQXJucyA9IFsnYXJuOjo6Y2ZuLW15LWNvb2wtdG9waWMnXTtcbiAgICAgICAgY29uc3QgdG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgICAgICBjbG91ZEV4ZWN1dGFibGUsXG4gICAgICAgICAgY29uZmlndXJhdGlvbjogY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICAgICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgICAgICBkZXBsb3ltZW50czogbmV3IEZha2VDbG91ZEZvcm1hdGlvbihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgJ1Rlc3QtU3RhY2stQmFkLU5vdGlmaWNhdGlvbi1Bcm5zJzogeyBGb286ICdCYXInIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uQXJucyxcbiAgICAgICAgICApLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGF3YWl0IGV4cGVjdCgoKSA9PlxuICAgICAgICAgIHRvb2xraXQuZGVwbG95KHtcbiAgICAgICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQmFkLU5vdGlmaWNhdGlvbi1Bcm5zJ10gfSxcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbkFybnMsXG4gICAgICAgICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQsXG4gICAgICAgICAgfSksXG4gICAgICAgICkucmVqZWN0cy50b1Rocm93KCdOb3RpZmljYXRpb24gYXJuIGFybjo6OmNmbi1teS1jb29sLXRvcGljIGlzIG5vdCBhIHZhbGlkIGFybiBmb3IgYW4gU05TIHRvcGljJyk7XG4gICAgICB9KTtcblxuICAgICAgdGVzdCgnZmFpbCB3aXRoIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgaW4gdGhlIGV4ZWN1dGFibGUgYW5kIGNvcnJlY3Qgc25zIG5vdGlmaWNhdGlvbiBhcm5zIGFzIG9wdGlvbnMnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIEdJVkVOXG4gICAgICAgIGNvbnN0IG5vdGlmaWNhdGlvbkFybnMgPSBbJ2Fybjphd3M6c25zOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6TXlUb3BpYyddO1xuICAgICAgICBjb25zdCB0b29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgICAgIGNsb3VkRXhlY3V0YWJsZSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uOiBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbixcbiAgICAgICAgICBzZGtQcm92aWRlcjogY2xvdWRFeGVjdXRhYmxlLnNka1Byb3ZpZGVyLFxuICAgICAgICAgIGRlcGxveW1lbnRzOiBuZXcgRmFrZUNsb3VkRm9ybWF0aW9uKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAnVGVzdC1TdGFjay1CYWQtTm90aWZpY2F0aW9uLUFybnMnOiB7IEZvbzogJ0JhcicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgICAgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFsnVGVzdC1TdGFjay1CYWQtTm90aWZpY2F0aW9uLUFybnMnXSB9LFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uQXJucyxcbiAgICAgICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZVTExfREVQTE9ZTUVOVCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgKS5yZWplY3RzLnRvVGhyb3coJ05vdGlmaWNhdGlvbiBhcm4gYXJuOjEzMzc6MTIzNDU2Nzg5MDEyOnNuczpiYWQgaXMgbm90IGEgdmFsaWQgYXJuIGZvciBhbiBTTlMgdG9waWMnKTtcbiAgICAgIH0pO1xuXG4gICAgICB0ZXN0KCdmYWlsIHdpdGggY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgaW4gdGhlIGV4ZWN1dGFibGUgYW5kIGluY29ycmVjdCBzbnMgbm90aWZpY2F0aW9uIGFybnMgYXMgb3B0aW9ucycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uQXJucyA9IFsnYXJuOjo6Y2ZuLW15LWNvb2wtdG9waWMnXTtcbiAgICAgICAgY29uc3QgdG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgICAgICBjbG91ZEV4ZWN1dGFibGUsXG4gICAgICAgICAgY29uZmlndXJhdGlvbjogY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICAgICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgICAgICBkZXBsb3ltZW50czogbmV3IEZha2VDbG91ZEZvcm1hdGlvbihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgJ1Rlc3QtU3RhY2stTm90aWZpY2F0aW9uLUFybnMnOiB7IEZvbzogJ0JhcicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgICksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgICAgdG9vbGtpdC5kZXBsb3koe1xuICAgICAgICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFsnVGVzdC1TdGFjay1Ob3RpZmljYXRpb24tQXJucyddIH0sXG4gICAgICAgICAgICBub3RpZmljYXRpb25Bcm5zLFxuICAgICAgICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgICAgICAgIH0pLFxuICAgICAgICApLnJlamVjdHMudG9UaHJvdygnTm90aWZpY2F0aW9uIGFybiBhcm46OjpjZm4tbXktY29vbC10b3BpYyBpcyBub3QgYSB2YWxpZCBhcm4gZm9yIGFuIFNOUyB0b3BpYycpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2dsb2JsZXNzIGJvb3RzdHJhcCB1c2VzIGVudmlyb25tZW50IHdpdGhvdXQgcXVlc3Rpb24nLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IHRvb2xraXQuYm9vdHN0cmFwKFsnYXdzOi8vNTY3ODkvc291dGgtcG9sZSddLCB7XG4gICAgICBzb3VyY2U6IGRlZmF1bHRCb290c3RyYXBTb3VyY2UsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGJvb3RzdHJhcEVudmlyb25tZW50TW9jaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICB7XG4gICAgICAgIGFjY291bnQ6ICc1Njc4OScsXG4gICAgICAgIHJlZ2lvbjogJ3NvdXRoLXBvbGUnLFxuICAgICAgICBuYW1lOiAnYXdzOi8vNTY3ODkvc291dGgtcG9sZScsXG4gICAgICB9LFxuICAgICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICApO1xuICAgIGV4cGVjdChib290c3RyYXBFbnZpcm9ubWVudE1vY2spLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygxKTtcbiAgfSk7XG5cbiAgdGVzdCgnZ2xvYmJ5IGJvb3RzdHJhcCB1c2VzIHdoYXRzIGluIHRoZSBzdGFja3MnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgIGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLnNldHRpbmdzLnNldChbJ2FwcCddLCAnc29tZXRoaW5nJyk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgdG9vbGtpdC5ib290c3RyYXAoWydhd3M6Ly8qL2Jlcm11ZGEtdHJpYW5nbGUtMSddLCB7XG4gICAgICBzb3VyY2U6IGRlZmF1bHRCb290c3RyYXBTb3VyY2UsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGJvb3RzdHJhcEVudmlyb25tZW50TW9jaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICB7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgICAgICByZWdpb246ICdiZXJtdWRhLXRyaWFuZ2xlLTEnLFxuICAgICAgICBuYW1lOiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2Jlcm11ZGEtdHJpYW5nbGUtMScsXG4gICAgICB9LFxuICAgICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICApO1xuICAgIGV4cGVjdChib290c3RyYXBFbnZpcm9ubWVudE1vY2spLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygxKTtcbiAgfSk7XG5cbiAgdGVzdCgnYm9vdHN0cmFwIGNhbiBiZSBpbnZva2VkIHdpdGhvdXQgdGhlIC0tYXBwIGFyZ3VtZW50JywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3MuY2xlYXIoKTtcbiAgICBjb25zdCBtb2NrU3ludGhlc2l6ZSA9IGplc3QuZm4oKTtcbiAgICBjbG91ZEV4ZWN1dGFibGUuc3ludGhlc2l6ZSA9IG1vY2tTeW50aGVzaXplO1xuXG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCB0b29sa2l0LmJvb3RzdHJhcChbJ2F3czovLzEyMzQ1Njc4OTAxMi93ZXN0LXBvbGUnXSwge1xuICAgICAgc291cmNlOiBkZWZhdWx0Qm9vdHN0cmFwU291cmNlLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChib290c3RyYXBFbnZpcm9ubWVudE1vY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAge1xuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgcmVnaW9uOiAnd2VzdC1wb2xlJyxcbiAgICAgICAgbmFtZTogJ2F3czovLzEyMzQ1Njc4OTAxMi93ZXN0LXBvbGUnLFxuICAgICAgfSxcbiAgICAgIGV4cGVjdC5hbnl0aGluZygpLFxuICAgICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICAgKTtcbiAgICBleHBlY3QoYm9vdHN0cmFwRW52aXJvbm1lbnRNb2NrKS50b0hhdmVCZWVuQ2FsbGVkVGltZXMoMSk7XG5cbiAgICBleHBlY3QoY2xvdWRFeGVjdXRhYmxlLmhhc0FwcCkudG9FcXVhbChmYWxzZSk7XG4gICAgZXhwZWN0KG1vY2tTeW50aGVzaXplKS5ub3QudG9IYXZlQmVlbkNhbGxlZCgpO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnZGVzdHJveScsICgpID0+IHtcbiAgdGVzdCgnZGVzdHJveSBjb3JyZWN0IHN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG5cbiAgICBleHBlY3QoKCkgPT4ge1xuICAgICAgcmV0dXJuIHRvb2xraXQuZGVzdHJveSh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbJ1Rlc3QtU3RhY2stQS9UZXN0LVN0YWNrLUMnXSB9LFxuICAgICAgICBleGNsdXNpdmVseTogdHJ1ZSxcbiAgICAgICAgZm9yY2U6IHRydWUsXG4gICAgICAgIGZyb21EZXBsb3k6IHRydWUsXG4gICAgICB9KTtcbiAgICB9KS5yZXNvbHZlcztcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ3dhdGNoJywgKCkgPT4ge1xuICB0ZXN0KFwiZmFpbHMgd2hlbiBubyAnd2F0Y2gnIHNldHRpbmdzIGFyZSBmb3VuZFwiLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IGV4cGVjdCgoKSA9PiB7XG4gICAgICByZXR1cm4gdG9vbGtpdC53YXRjaCh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgICB9KTtcbiAgICB9KS5yZWplY3RzLnRvVGhyb3coXG4gICAgICBcIkNhbm5vdCB1c2UgdGhlICd3YXRjaCcgY29tbWFuZCB3aXRob3V0IHNwZWNpZnlpbmcgYXQgbGVhc3Qgb25lIGRpcmVjdG9yeSB0byBtb25pdG9yLiBcIiArXG4gICAgICAgICdNYWtlIHN1cmUgdG8gYWRkIGEgXCJ3YXRjaFwiIGtleSB0byB5b3VyIGNkay5qc29uJyxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdvYnNlcnZlcyBvbmx5IHRoZSByb290IGRpcmVjdG9yeSBieSBkZWZhdWx0JywgYXN5bmMgKCkgPT4ge1xuICAgIGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLnNldHRpbmdzLnNldChbJ3dhdGNoJ10sIHt9KTtcbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgYXdhaXQgdG9vbGtpdC53YXRjaCh7XG4gICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogW10gfSxcbiAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGluY2x1ZGVBcmdzID0gZmFrZUNob2tpZGFyV2F0Y2guaW5jbHVkZUFyZ3M7XG4gICAgZXhwZWN0KGluY2x1ZGVBcmdzLmxlbmd0aCkudG9CZSgxKTtcbiAgfSk7XG5cbiAgdGVzdChcImFsbG93cyBwcm92aWRpbmcgYSBzaW5nbGUgc3RyaW5nIGluICd3YXRjaC5pbmNsdWRlJ1wiLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge1xuICAgICAgaW5jbHVkZTogJ215LWRpcicsXG4gICAgfSk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgfSk7XG5cbiAgICBleHBlY3QoZmFrZUNob2tpZGFyV2F0Y2guaW5jbHVkZUFyZ3MpLnRvU3RyaWN0RXF1YWwoWydteS1kaXInXSk7XG4gIH0pO1xuXG4gIHRlc3QoXCJhbGxvd3MgcHJvdmlkaW5nIGFuIGFycmF5IG9mIHN0cmluZ3MgaW4gJ3dhdGNoLmluY2x1ZGUnXCIsIGFzeW5jICgpID0+IHtcbiAgICBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5zZXQoWyd3YXRjaCddLCB7XG4gICAgICBpbmNsdWRlOiBbJ215LWRpcjEnLCAnKiovbXktZGlyMi8qJ10sXG4gICAgfSk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgfSk7XG5cbiAgICBleHBlY3QoZmFrZUNob2tpZGFyV2F0Y2guaW5jbHVkZUFyZ3MpLnRvU3RyaWN0RXF1YWwoWydteS1kaXIxJywgJyoqL215LWRpcjIvKiddKTtcbiAgfSk7XG5cbiAgdGVzdCgnaWdub3JlcyB0aGUgb3V0cHV0IGRpciwgZG90IGZpbGVzLCBkb3QgZGlyZWN0b3JpZXMsIGFuZCBub2RlX21vZHVsZXMgYnkgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcbiAgICBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5zZXQoWyd3YXRjaCddLCB7fSk7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnb3V0cHV0J10sICdjZGsub3V0Jyk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgfSk7XG5cbiAgICBleHBlY3QoZmFrZUNob2tpZGFyV2F0Y2guZXhjbHVkZUFyZ3MpLnRvU3RyaWN0RXF1YWwoWydjZGsub3V0LyoqJywgJyoqLy4qJywgJyoqLy4qLyoqJywgJyoqL25vZGVfbW9kdWxlcy8qKiddKTtcbiAgfSk7XG5cbiAgdGVzdChcImFsbG93cyBwcm92aWRpbmcgYSBzaW5nbGUgc3RyaW5nIGluICd3YXRjaC5leGNsdWRlJ1wiLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge1xuICAgICAgZXhjbHVkZTogJ215LWRpcicsXG4gICAgfSk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgfSk7XG5cbiAgICBjb25zdCBleGNsdWRlQXJncyA9IGZha2VDaG9raWRhcldhdGNoLmV4Y2x1ZGVBcmdzO1xuICAgIGV4cGVjdChleGNsdWRlQXJncy5sZW5ndGgpLnRvQmUoNSk7XG4gICAgZXhwZWN0KGV4Y2x1ZGVBcmdzWzBdKS50b0JlKCdteS1kaXInKTtcbiAgfSk7XG5cbiAgdGVzdChcImFsbG93cyBwcm92aWRpbmcgYW4gYXJyYXkgb2Ygc3RyaW5ncyBpbiAnd2F0Y2guZXhjbHVkZSdcIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLnNldHRpbmdzLnNldChbJ3dhdGNoJ10sIHtcbiAgICAgIGV4Y2x1ZGU6IFsnbXktZGlyMScsICcqKi9teS1kaXIyJ10sXG4gICAgfSk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgfSk7XG5cbiAgICBjb25zdCBleGNsdWRlQXJncyA9IGZha2VDaG9raWRhcldhdGNoLmV4Y2x1ZGVBcmdzO1xuICAgIGV4cGVjdChleGNsdWRlQXJncy5sZW5ndGgpLnRvQmUoNik7XG4gICAgZXhwZWN0KGV4Y2x1ZGVBcmdzWzBdKS50b0JlKCdteS1kaXIxJyk7XG4gICAgZXhwZWN0KGV4Y2x1ZGVBcmdzWzFdKS50b0JlKCcqKi9teS1kaXIyJyk7XG4gIH0pO1xuXG4gIHRlc3QoJ2FsbG93cyB3YXRjaGluZyB3aXRoIGRlcGxveSBjb25jdXJyZW5jeScsIGFzeW5jICgpID0+IHtcbiAgICBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5zZXQoWyd3YXRjaCddLCB7fSk7XG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcbiAgICBjb25zdCBjZGtEZXBsb3lNb2NrID0gamVzdC5mbigpO1xuICAgIHRvb2xraXQuZGVwbG95ID0gY2RrRGVwbG95TW9jaztcblxuICAgIGF3YWl0IHRvb2xraXQud2F0Y2goe1xuICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICBjb25jdXJyZW5jeTogMyxcbiAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSxcbiAgICB9KTtcbiAgICBmYWtlQ2hva2lkYXJXYXRjaGVyT24ucmVhZHlDYWxsYmFjaygpO1xuXG4gICAgZXhwZWN0KGNka0RlcGxveU1vY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHsgY29uY3VycmVuY3k6IDMgfSkpO1xuICB9KTtcblxuICBkZXNjcmliZS5lYWNoKFtIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssIEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWV0pKCclcCBtb2RlJywgKGhvdHN3YXBNb2RlKSA9PiB7XG4gICAgdGVzdCgncGFzc2VzIHRocm91Z2ggdGhlIGNvcnJlY3QgaG90c3dhcCBtb2RlIHRvIGRlcGxveVN0YWNrKCknLCBhc3luYyAoKSA9PiB7XG4gICAgICBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5zZXQoWyd3YXRjaCddLCB7fSk7XG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgICAgY29uc3QgY2RrRGVwbG95TW9jayA9IGplc3QuZm4oKTtcbiAgICAgIHRvb2xraXQuZGVwbG95ID0gY2RrRGVwbG95TW9jaztcblxuICAgICAgYXdhaXQgdG9vbGtpdC53YXRjaCh7XG4gICAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgICBob3Rzd2FwOiBob3Rzd2FwTW9kZSxcbiAgICAgIH0pO1xuICAgICAgZmFrZUNob2tpZGFyV2F0Y2hlck9uLnJlYWR5Q2FsbGJhY2soKTtcblxuICAgICAgZXhwZWN0KGNka0RlcGxveU1vY2spLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHsgaG90c3dhcDogaG90c3dhcE1vZGUgfSkpO1xuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdyZXNwZWN0cyBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFknLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge30pO1xuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG4gICAgY29uc3QgY2RrRGVwbG95TW9jayA9IGplc3QuZm4oKTtcbiAgICB0b29sa2l0LmRlcGxveSA9IGNka0RlcGxveU1vY2s7XG5cbiAgICBhd2FpdCB0b29sa2l0LndhdGNoKHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZLFxuICAgIH0pO1xuICAgIGZha2VDaG9raWRhcldhdGNoZXJPbi5yZWFkeUNhbGxiYWNrKCk7XG5cbiAgICBleHBlY3QoY2RrRGVwbG95TW9jaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoeyBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkgfSkpO1xuICB9KTtcblxuICB0ZXN0KCdyZXNwZWN0cyBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0snLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge30pO1xuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG4gICAgY29uc3QgY2RrRGVwbG95TW9jayA9IGplc3QuZm4oKTtcbiAgICB0b29sa2l0LmRlcGxveSA9IGNka0RlcGxveU1vY2s7XG5cbiAgICBhd2FpdCB0b29sa2l0LndhdGNoKHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRkFMTF9CQUNLLFxuICAgIH0pO1xuICAgIGZha2VDaG9raWRhcldhdGNoZXJPbi5yZWFkeUNhbGxiYWNrKCk7XG5cbiAgICBleHBlY3QoY2RrRGVwbG95TW9jaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoeyBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0sgfSkpO1xuICB9KTtcblxuICB0ZXN0KCdyZXNwZWN0cyBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQnLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge30pO1xuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG4gICAgY29uc3QgY2RrRGVwbG95TW9jayA9IGplc3QuZm4oKTtcbiAgICB0b29sa2l0LmRlcGxveSA9IGNka0RlcGxveU1vY2s7XG5cbiAgICBhd2FpdCB0b29sa2l0LndhdGNoKHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgIH0pO1xuICAgIGZha2VDaG9raWRhcldhdGNoZXJPbi5yZWFkeUNhbGxiYWNrKCk7XG5cbiAgICBleHBlY3QoY2RrRGVwbG95TW9jaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoeyBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GVUxMX0RFUExPWU1FTlQgfSkpO1xuICB9KTtcblxuICBkZXNjcmliZSgnd2l0aCBmaWxlIGNoYW5nZSBldmVudHMnLCAoKSA9PiB7XG4gICAgbGV0IHRvb2xraXQ6IENka1Rvb2xraXQ7XG4gICAgbGV0IGNka0RlcGxveU1vY2s6IGplc3QuTW9jaztcblxuICAgIGJlZm9yZUVhY2goYXN5bmMgKCkgPT4ge1xuICAgICAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnd2F0Y2gnXSwge30pO1xuICAgICAgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcbiAgICAgIGNka0RlcGxveU1vY2sgPSBqZXN0LmZuKCk7XG4gICAgICB0b29sa2l0LmRlcGxveSA9IGNka0RlcGxveU1vY2s7XG4gICAgICBhd2FpdCB0b29sa2l0LndhdGNoKHtcbiAgICAgICAgc2VsZWN0b3I6IHsgcGF0dGVybnM6IFtdIH0sXG4gICAgICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdChcImRvZXMgbm90IHRyaWdnZXIgYSAnZGVwbG95JyBiZWZvcmUgdGhlICdyZWFkeScgZXZlbnQgaGFzIGZpcmVkXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGZha2VDaG9raWRhcldhdGNoZXJPbi5maWxlRXZlbnRDYWxsYmFjaygnYWRkJywgJ215LWZpbGUnKTtcblxuICAgICAgZXhwZWN0KGNka0RlcGxveU1vY2spLm5vdC50b0hhdmVCZWVuQ2FsbGVkKCk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZShcIndoZW4gdGhlICdyZWFkeScgZXZlbnQgaGFzIGFscmVhZHkgZmlyZWRcIiwgKCkgPT4ge1xuICAgICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICAgIC8vIFRoZSByZWFkeSBjYWxsYmFjayB0cmlnZ2VycyBhIGRlcGxveW1lbnQgc28gZWFjaCB0ZXN0XG4gICAgICAgIC8vIHRoYXQgdXNlcyB0aGlzIGZ1bmN0aW9uIHdpbGwgc2VlICdjZGtEZXBsb3lNb2NrJyBjYWxsZWRcbiAgICAgICAgLy8gYW4gYWRkaXRpb25hbCB0aW1lLlxuICAgICAgICBmYWtlQ2hva2lkYXJXYXRjaGVyT24ucmVhZHlDYWxsYmFjaygpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3QoXCJhbiBpbml0aWFsICdkZXBsb3knIGlzIHRyaWdnZXJlZCwgd2l0aG91dCBhbnkgZmlsZSBjaGFuZ2VzXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgZXhwZWN0KGNka0RlcGxveU1vY2spLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygxKTtcbiAgICAgIH0pO1xuXG4gICAgICB0ZXN0KFwiZG9lcyB0cmlnZ2VyIGEgJ2RlcGxveScgZm9yIGEgZmlsZSBjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBmYWtlQ2hva2lkYXJXYXRjaGVyT24uZmlsZUV2ZW50Q2FsbGJhY2soJ2FkZCcsICdteS1maWxlJyk7XG5cbiAgICAgICAgZXhwZWN0KGNka0RlcGxveU1vY2spLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygyKTtcbiAgICAgIH0pO1xuXG4gICAgICB0ZXN0KFwidHJpZ2dlcnMgYSAnZGVwbG95JyB0d2ljZSBmb3IgdHdvIGZpbGUgY2hhbmdlc1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAY2RrbGFicy9wcm9taXNlYWxsLW5vLXVuYm91bmRlZC1wYXJhbGxlbGlzbVxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgZmFrZUNob2tpZGFyV2F0Y2hlck9uLmZpbGVFdmVudENhbGxiYWNrKCdhZGQnLCAnbXktZmlsZTEnKSxcbiAgICAgICAgICBmYWtlQ2hva2lkYXJXYXRjaGVyT24uZmlsZUV2ZW50Q2FsbGJhY2soJ2NoYW5nZScsICdteS1maWxlMicpLFxuICAgICAgICBdKTtcblxuICAgICAgICBleHBlY3QoY2RrRGVwbG95TW9jaykudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDMpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3QoXCJiYXRjaGVzIGZpbGUgY2hhbmdlcyB0aGF0IGhhcHBlbiBkdXJpbmcgJ2RlcGxveSdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQGNka2xhYnMvcHJvbWlzZWFsbC1uby11bmJvdW5kZWQtcGFyYWxsZWxpc21cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgIGZha2VDaG9raWRhcldhdGNoZXJPbi5maWxlRXZlbnRDYWxsYmFjaygnYWRkJywgJ215LWZpbGUxJyksXG4gICAgICAgICAgZmFrZUNob2tpZGFyV2F0Y2hlck9uLmZpbGVFdmVudENhbGxiYWNrKCdjaGFuZ2UnLCAnbXktZmlsZTInKSxcbiAgICAgICAgICBmYWtlQ2hva2lkYXJXYXRjaGVyT24uZmlsZUV2ZW50Q2FsbGJhY2soJ3VubGluaycsICdteS1maWxlMycpLFxuICAgICAgICAgIGZha2VDaG9raWRhcldhdGNoZXJPbi5maWxlRXZlbnRDYWxsYmFjaygnYWRkJywgJ215LWZpbGU0JyksXG4gICAgICAgIF0pO1xuXG4gICAgICAgIGV4cGVjdChjZGtEZXBsb3lNb2NrKS50b0hhdmVCZWVuQ2FsbGVkVGltZXMoMyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ3N5bnRoJywgKCkgPT4ge1xuICB0ZXN0KCdzdWNjZXNzZnVsIHN5bnRoIG91dHB1dHMgaGllcmFyY2hpY2FsIHN0YWNrIGlkcycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgIGF3YWl0IHRvb2xraXQuc3ludGgoW10sIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAvLyBTZXBhcmF0ZSB0ZXN0cyBhcyBjb2xvcml6aW5nIGhhbXBlcnMgZGV0ZWN0aW9uXG4gICAgZXhwZWN0KHN0ZGVyck1vY2subW9jay5jYWxsc1sxXVswXSkudG9NYXRjaCgnVGVzdC1TdGFjay1BLURpc3BsYXktTmFtZScpO1xuICAgIGV4cGVjdChzdGRlcnJNb2NrLm1vY2suY2FsbHNbMV1bMF0pLnRvTWF0Y2goJ1Rlc3QtU3RhY2stQicpO1xuICB9KTtcblxuICB0ZXN0KCd3aXRoIG5vIHN0ZG91dCBvcHRpb24nLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRVxuICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG5cbiAgICAvLyBUSEVOXG4gICAgYXdhaXQgdG9vbGtpdC5zeW50aChbJ1Rlc3QtU3RhY2stQS1EaXNwbGF5LU5hbWUnXSwgZmFsc2UsIHRydWUpO1xuICAgIGV4cGVjdChtb2NrRGF0YS5tb2NrLmNhbGxzLmxlbmd0aCkudG9FcXVhbCgwKTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ21pZ3JhdGUnLCAoKSA9PiB7XG4gICAgY29uc3QgdGVzdFJlc291cmNlUGF0aCA9IFtfX2Rpcm5hbWUsICdjb21tYW5kcycsICd0ZXN0LXJlc291cmNlcyddO1xuICAgIGNvbnN0IHRlbXBsYXRlUGF0aCA9IFsuLi50ZXN0UmVzb3VyY2VQYXRoLCAndGVtcGxhdGVzJ107XG4gICAgY29uc3Qgc3FzVGVtcGxhdGVQYXRoID0gcGF0aC5qb2luKC4uLnRlbXBsYXRlUGF0aCwgJ3Nxcy10ZW1wbGF0ZS5qc29uJyk7XG4gICAgY29uc3QgYXV0b3NjYWxpbmdUZW1wbGF0ZVBhdGggPSBwYXRoLmpvaW4oLi4udGVtcGxhdGVQYXRoLCAnYXV0b3NjYWxpbmctdGVtcGxhdGUueW1sJyk7XG4gICAgY29uc3QgczNUZW1wbGF0ZVBhdGggPSBwYXRoLmpvaW4oLi4udGVtcGxhdGVQYXRoLCAnczMtdGVtcGxhdGUuanNvbicpO1xuXG4gICAgdGVzdCgnbWlncmF0ZSBmYWlscyB3aGVuIGJvdGggLS1mcm9tLXBhdGggYW5kIC0tZnJvbS1zdGFjayBhcmUgcHJvdmlkZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgIHRvb2xraXQubWlncmF0ZSh7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnbm8tc291cmNlJyxcbiAgICAgICAgICBmcm9tUGF0aDogJy4vaGVyZS90ZW1wbGF0ZS55bWwnLFxuICAgICAgICAgIGZyb21TdGFjazogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICApLnJlamVjdHMudG9UaHJvdygnT25seSBvbmUgb2YgYC0tZnJvbS1wYXRoYCBvciBgLS1mcm9tLXN0YWNrYCBtYXkgYmUgcHJvdmlkZWQuJyk7XG4gICAgICBleHBlY3Qoc3RkZXJyTW9jay5tb2NrLmNhbGxzWzFdWzBdKS50b0NvbnRhaW4oXG4gICAgICAgICcg4p2MICBNaWdyYXRlIGZhaWxlZCBmb3IgYG5vLXNvdXJjZWA6IE9ubHkgb25lIG9mIGAtLWZyb20tcGF0aGAgb3IgYC0tZnJvbS1zdGFja2AgbWF5IGJlIHByb3ZpZGVkLicsXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnbWlncmF0ZSBmYWlscyB3aGVuIC0tZnJvbS1wYXRoIGlzIGludmFsaWQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgIHRvb2xraXQubWlncmF0ZSh7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnYmFkLWxvY2FsLXNvdXJjZScsXG4gICAgICAgICAgZnJvbVBhdGg6ICcuL2hlcmUvdGVtcGxhdGUueW1sJyxcbiAgICAgICAgfSksXG4gICAgICApLnJlamVjdHMudG9UaHJvdyhcIicuL2hlcmUvdGVtcGxhdGUueW1sJyBpcyBub3QgYSB2YWxpZCBwYXRoLlwiKTtcbiAgICAgIGV4cGVjdChzdGRlcnJNb2NrLm1vY2suY2FsbHNbMV1bMF0pLnRvQ29udGFpbihcbiAgICAgICAgXCIg4p2MICBNaWdyYXRlIGZhaWxlZCBmb3IgYGJhZC1sb2NhbC1zb3VyY2VgOiAnLi9oZXJlL3RlbXBsYXRlLnltbCcgaXMgbm90IGEgdmFsaWQgcGF0aC5cIixcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdtaWdyYXRlIGZhaWxzIHdoZW4gLS1mcm9tLXN0YWNrIGlzIHVzZWQgYW5kIHN0YWNrIGRvZXMgbm90IGV4aXN0IGluIGFjY291bnQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBtb2NrU2RrUHJvdmlkZXIgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gICAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZWplY3RzKG5ldyBFcnJvcignU3RhY2sgZG9lcyBub3QgZXhpc3QgaW4gdGhpcyBlbnZpcm9ubWVudCcpKTtcblxuICAgICAgY29uc3QgbW9ja0Nsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICAgICAgc3RhY2tzOiBbXSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjZGtUb29sa2l0ID0gbmV3IENka1Rvb2xraXQoe1xuICAgICAgICBjbG91ZEV4ZWN1dGFibGU6IG1vY2tDbG91ZEV4ZWN1dGFibGUsXG4gICAgICAgIGRlcGxveW1lbnRzOiBuZXcgRGVwbG95bWVudHMoeyBzZGtQcm92aWRlcjogbW9ja1Nka1Byb3ZpZGVyIH0pLFxuICAgICAgICBzZGtQcm92aWRlcjogbW9ja1Nka1Byb3ZpZGVyLFxuICAgICAgICBjb25maWd1cmF0aW9uOiBtb2NrQ2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24sXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgZXhwZWN0KCgpID0+XG4gICAgICAgIGNka1Rvb2xraXQubWlncmF0ZSh7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnYmFkLWNsb3VkZm9ybWF0aW9uLXNvdXJjZScsXG4gICAgICAgICAgZnJvbVN0YWNrOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICkucmVqZWN0cy50b1Rocm93KCdTdGFjayBkb2VzIG5vdCBleGlzdCBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICBleHBlY3Qoc3RkZXJyTW9jay5tb2NrLmNhbGxzWzFdWzBdKS50b0NvbnRhaW4oXG4gICAgICAgICcg4p2MICBNaWdyYXRlIGZhaWxlZCBmb3IgYGJhZC1jbG91ZGZvcm1hdGlvbi1zb3VyY2VgOiBTdGFjayBkb2VzIG5vdCBleGlzdCBpbiB0aGlzIGVudmlyb25tZW50JyxcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdtaWdyYXRlIGZhaWxzIHdoZW4gc3RhY2sgY2Fubm90IGJlIGdlbmVyYXRlZCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRvb2xraXQgPSBkZWZhdWx0VG9vbGtpdFNldHVwKCk7XG4gICAgICBhd2FpdCBleHBlY3QoKCkgPT5cbiAgICAgICAgdG9vbGtpdC5taWdyYXRlKHtcbiAgICAgICAgICBzdGFja05hbWU6ICdjYW5ub3QtZ2VuZXJhdGUtdGVtcGxhdGUnLFxuICAgICAgICAgIGZyb21QYXRoOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnY29tbWFuZHMnLCAndGVzdC1yZXNvdXJjZXMnLCAndGVtcGxhdGVzJywgJ3Nxcy10ZW1wbGF0ZS5qc29uJyksXG4gICAgICAgICAgbGFuZ3VhZ2U6ICdydXN0JyxcbiAgICAgICAgfSksXG4gICAgICApLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICAgJ0Nhbm5vdEdlbmVyYXRlVGVtcGxhdGVTdGFjayBjb3VsZCBub3QgYmUgZ2VuZXJhdGVkIGJlY2F1c2UgcnVzdCBpcyBub3QgYSBzdXBwb3J0ZWQgbGFuZ3VhZ2UnLFxuICAgICAgKTtcbiAgICAgIGV4cGVjdChzdGRlcnJNb2NrLm1vY2suY2FsbHNbMV1bMF0pLnRvQ29udGFpbihcbiAgICAgICAgJyDinYwgIE1pZ3JhdGUgZmFpbGVkIGZvciBgY2Fubm90LWdlbmVyYXRlLXRlbXBsYXRlYDogQ2Fubm90R2VuZXJhdGVUZW1wbGF0ZVN0YWNrIGNvdWxkIG5vdCBiZSBnZW5lcmF0ZWQgYmVjYXVzZSBydXN0IGlzIG5vdCBhIHN1cHBvcnRlZCBsYW5ndWFnZScsXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgY2xpVGVzdCgnbWlncmF0ZSBzdWNjZWVkcyBmb3IgdmFsaWQgdGVtcGxhdGUgZnJvbSBsb2NhbCBwYXRoIHdoZW4gbm8gbGFuZ3VhZ2UgaXMgcHJvdmlkZWQnLCBhc3luYyAod29ya0RpcikgPT4ge1xuICAgICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcbiAgICAgIGF3YWl0IHRvb2xraXQubWlncmF0ZSh7XG4gICAgICAgIHN0YWNrTmFtZTogJ1NRU1R5cGVTY3JpcHQnLFxuICAgICAgICBmcm9tUGF0aDogc3FzVGVtcGxhdGVQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoOiB3b3JrRGlyLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFBhY2thZ2VzIGNyZWF0ZWQgZm9yIHR5cGVzY3JpcHRcbiAgICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ1NRU1R5cGVTY3JpcHQnLCAncGFja2FnZS5qc29uJykpKS50b0JlVHJ1dGh5KCk7XG4gICAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdTUVNUeXBlU2NyaXB0JywgJ2JpbicsICdzcXNfdHlwZV9zY3JpcHQudHMnKSkpLnRvQmVUcnV0aHkoKTtcbiAgICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ1NRU1R5cGVTY3JpcHQnLCAnbGliJywgJ3Nxc190eXBlX3NjcmlwdC1zdGFjay50cycpKSkudG9CZVRydXRoeSgpO1xuICAgIH0pO1xuXG4gICAgY2xpVGVzdCgnbWlncmF0ZSBzdWNjZWVkcyBmb3IgdmFsaWQgdGVtcGxhdGUgZnJvbSBsb2NhbCBwYXRoIHdoZW4gbGFuZ3VhZ2UgaXMgcHJvdmlkZWQnLCBhc3luYyAod29ya0RpcikgPT4ge1xuICAgICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcbiAgICAgIGF3YWl0IHRvb2xraXQubWlncmF0ZSh7XG4gICAgICAgIHN0YWNrTmFtZTogJ1MzUHl0aG9uJyxcbiAgICAgICAgZnJvbVBhdGg6IHMzVGVtcGxhdGVQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoOiB3b3JrRGlyLFxuICAgICAgICBsYW5ndWFnZTogJ3B5dGhvbicsXG4gICAgICB9KTtcblxuICAgICAgLy8gUGFja2FnZXMgY3JlYXRlZCBmb3IgdHlwZXNjcmlwdFxuICAgICAgZXhwZWN0KGZzLnBhdGhFeGlzdHNTeW5jKHBhdGguam9pbih3b3JrRGlyLCAnUzNQeXRob24nLCAncmVxdWlyZW1lbnRzLnR4dCcpKSkudG9CZVRydXRoeSgpO1xuICAgICAgZXhwZWN0KGZzLnBhdGhFeGlzdHNTeW5jKHBhdGguam9pbih3b3JrRGlyLCAnUzNQeXRob24nLCAnYXBwLnB5JykpKS50b0JlVHJ1dGh5KCk7XG4gICAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdTM1B5dGhvbicsICdzM19weXRob24nLCAnczNfcHl0aG9uX3N0YWNrLnB5JykpKS50b0JlVHJ1dGh5KCk7XG4gICAgfSk7XG5cbiAgICBjbGlUZXN0KCdtaWdyYXRlIGNhbGwgaXMgaWRlbXBvdGVudCcsIGFzeW5jICh3b3JrRGlyKSA9PiB7XG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgICAgYXdhaXQgdG9vbGtpdC5taWdyYXRlKHtcbiAgICAgICAgc3RhY2tOYW1lOiAnQXV0b3NjYWxpbmdDU2hhcnAnLFxuICAgICAgICBmcm9tUGF0aDogYXV0b3NjYWxpbmdUZW1wbGF0ZVBhdGgsXG4gICAgICAgIG91dHB1dFBhdGg6IHdvcmtEaXIsXG4gICAgICAgIGxhbmd1YWdlOiAnY3NoYXJwJyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBQYWNrYWdlcyBjcmVhdGVkIGZvciB0eXBlc2NyaXB0XG4gICAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdBdXRvc2NhbGluZ0NTaGFycCcsICdzcmMnLCAnQXV0b3NjYWxpbmdDU2hhcnAuc2xuJykpKS50b0JlVHJ1dGh5KCk7XG4gICAgICBleHBlY3QoXG4gICAgICAgIGZzLnBhdGhFeGlzdHNTeW5jKHBhdGguam9pbih3b3JrRGlyLCAnQXV0b3NjYWxpbmdDU2hhcnAnLCAnc3JjJywgJ0F1dG9zY2FsaW5nQ1NoYXJwJywgJ1Byb2dyYW0uY3MnKSksXG4gICAgICApLnRvQmVUcnV0aHkoKTtcbiAgICAgIGV4cGVjdChcbiAgICAgICAgZnMucGF0aEV4aXN0c1N5bmMoXG4gICAgICAgICAgcGF0aC5qb2luKHdvcmtEaXIsICdBdXRvc2NhbGluZ0NTaGFycCcsICdzcmMnLCAnQXV0b3NjYWxpbmdDU2hhcnAnLCAnQXV0b3NjYWxpbmdDU2hhcnBTdGFjay5jcycpLFxuICAgICAgICApLFxuICAgICAgKS50b0JlVHJ1dGh5KCk7XG5cbiAgICAgIC8vIE9uZSBtb3JlIHRpbWVcbiAgICAgIGF3YWl0IHRvb2xraXQubWlncmF0ZSh7XG4gICAgICAgIHN0YWNrTmFtZTogJ0F1dG9zY2FsaW5nQ1NoYXJwJyxcbiAgICAgICAgZnJvbVBhdGg6IGF1dG9zY2FsaW5nVGVtcGxhdGVQYXRoLFxuICAgICAgICBvdXRwdXRQYXRoOiB3b3JrRGlyLFxuICAgICAgICBsYW5ndWFnZTogJ2NzaGFycCcsXG4gICAgICB9KTtcblxuICAgICAgLy8gUGFja2FnZXMgY3JlYXRlZCBmb3IgdHlwZXNjcmlwdFxuICAgICAgZXhwZWN0KGZzLnBhdGhFeGlzdHNTeW5jKHBhdGguam9pbih3b3JrRGlyLCAnQXV0b3NjYWxpbmdDU2hhcnAnLCAnc3JjJywgJ0F1dG9zY2FsaW5nQ1NoYXJwLnNsbicpKSkudG9CZVRydXRoeSgpO1xuICAgICAgZXhwZWN0KFxuICAgICAgICBmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0F1dG9zY2FsaW5nQ1NoYXJwJywgJ3NyYycsICdBdXRvc2NhbGluZ0NTaGFycCcsICdQcm9ncmFtLmNzJykpLFxuICAgICAgKS50b0JlVHJ1dGh5KCk7XG4gICAgICBleHBlY3QoXG4gICAgICAgIGZzLnBhdGhFeGlzdHNTeW5jKFxuICAgICAgICAgIHBhdGguam9pbih3b3JrRGlyLCAnQXV0b3NjYWxpbmdDU2hhcnAnLCAnc3JjJywgJ0F1dG9zY2FsaW5nQ1NoYXJwJywgJ0F1dG9zY2FsaW5nQ1NoYXJwU3RhY2suY3MnKSxcbiAgICAgICAgKSxcbiAgICAgICkudG9CZVRydXRoeSgpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZSgnc3RhY2sgd2l0aCBlcnJvciBhbmQgZmxhZ2dlZCBmb3IgdmFsaWRhdGlvbicsICgpID0+IHtcbiAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgIGNsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICAgICAgc3RhY2tzOiBbTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQSwgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQl0sXG4gICAgICAgIG5lc3RlZEFzc2VtYmxpZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGFja3M6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHsgdmFsaWRhdGVPblN5bnRoOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgLi4uTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfV0lUSF9FUlJPUixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnY2F1c2VzIHN5bnRoIHRvIGZhaWwgaWYgYXV0b1ZhbGlkYXRlPXRydWUnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuICAgICAgY29uc3QgYXV0b1ZhbGlkYXRlID0gdHJ1ZTtcbiAgICAgIGF3YWl0IGV4cGVjdCh0b29sa2l0LnN5bnRoKFtdLCBmYWxzZSwgdHJ1ZSwgYXV0b1ZhbGlkYXRlKSkucmVqZWN0cy50b0JlRGVmaW5lZCgpO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnY2F1c2VzIHN5bnRoIHRvIHN1Y2NlZWQgaWYgYXV0b1ZhbGlkYXRlPWZhbHNlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcbiAgICAgIGNvbnN0IGF1dG9WYWxpZGF0ZSA9IGZhbHNlO1xuICAgICAgYXdhaXQgdG9vbGtpdC5zeW50aChbXSwgZmFsc2UsIHRydWUsIGF1dG9WYWxpZGF0ZSk7XG4gICAgICBleHBlY3QobW9ja0RhdGEubW9jay5jYWxscy5sZW5ndGgpLnRvRXF1YWwoMCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3N0YWNrIGhhcyBlcnJvciBhbmQgd2FzIGV4cGxpY2l0bHkgc2VsZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlID0gbmV3IE1vY2tDbG91ZEV4ZWN1dGFibGUoe1xuICAgICAgc3RhY2tzOiBbTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQSwgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQl0sXG4gICAgICBuZXN0ZWRBc3NlbWJsaWVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFja3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcHJvcGVydGllczogeyB2YWxpZGF0ZU9uU3ludGg6IGZhbHNlIH0sXG4gICAgICAgICAgICAgIC4uLk1vY2tTdGFjay5NT0NLX1NUQUNLX1dJVEhfRVJST1IsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdG9vbGtpdCA9IGRlZmF1bHRUb29sa2l0U2V0dXAoKTtcblxuICAgIGF3YWl0IGV4cGVjdCh0b29sa2l0LnN5bnRoKFsnVGVzdC1TdGFjay1BL3dpdGhlcnJvcnMnXSwgZmFsc2UsIHRydWUpKS5yZWplY3RzLnRvQmVEZWZpbmVkKCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3N0YWNrIGhhcyBlcnJvciwgaXMgbm90IGZsYWdnZWQgZm9yIHZhbGlkYXRpb24gYW5kIHdhcyBub3QgZXhwbGljaXRseSBzZWxlY3RlZCcsIGFzeW5jICgpID0+IHtcbiAgICBjbG91ZEV4ZWN1dGFibGUgPSBuZXcgTW9ja0Nsb3VkRXhlY3V0YWJsZSh7XG4gICAgICBzdGFja3M6IFtNb2NrU3RhY2suTU9DS19TVEFDS19BLCBNb2NrU3RhY2suTU9DS19TVEFDS19CXSxcbiAgICAgIG5lc3RlZEFzc2VtYmxpZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YWNrczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7IHZhbGlkYXRlT25TeW50aDogZmFsc2UgfSxcbiAgICAgICAgICAgICAgLi4uTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfV0lUSF9FUlJPUixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgYXdhaXQgdG9vbGtpdC5zeW50aChbXSwgZmFsc2UsIHRydWUpO1xuICB9KTtcblxuICB0ZXN0KCdzdGFjayBoYXMgZGVwZW5kZW5jeSBhbmQgd2FzIGV4cGxpY2l0bHkgc2VsZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvdWRFeGVjdXRhYmxlID0gbmV3IE1vY2tDbG91ZEV4ZWN1dGFibGUoe1xuICAgICAgc3RhY2tzOiBbTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQywgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfRF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB0b29sa2l0ID0gZGVmYXVsdFRvb2xraXRTZXR1cCgpO1xuXG4gICAgYXdhaXQgdG9vbGtpdC5zeW50aChbTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfRC5zdGFja05hbWVdLCB0cnVlLCBmYWxzZSk7XG5cbiAgICBleHBlY3QobW9ja0RhdGEubW9jay5jYWxscy5sZW5ndGgpLnRvRXF1YWwoMSk7XG4gICAgZXhwZWN0KG1vY2tEYXRhLm1vY2suY2FsbHNbMF1bMF0pLnRvQmVEZWZpbmVkKCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3JvbGxiYWNrIHVzZXMgZGVwbG95bWVudCByb2xlJywgYXN5bmMgKCkgPT4ge1xuICAgIGNsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICAgIHN0YWNrczogW01vY2tTdGFjay5NT0NLX1NUQUNLX0NdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW9ja2VkUm9sbGJhY2sgPSBqZXN0LnNweU9uKERlcGxveW1lbnRzLnByb3RvdHlwZSwgJ3JvbGxiYWNrU3RhY2snKS5tb2NrUmVzb2x2ZWRWYWx1ZSh7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdG9vbGtpdCA9IG5ldyBDZGtUb29sa2l0KHtcbiAgICAgIGNsb3VkRXhlY3V0YWJsZSxcbiAgICAgIGNvbmZpZ3VyYXRpb246IGNsb3VkRXhlY3V0YWJsZS5jb25maWd1cmF0aW9uLFxuICAgICAgc2RrUHJvdmlkZXI6IGNsb3VkRXhlY3V0YWJsZS5zZGtQcm92aWRlcixcbiAgICAgIGRlcGxveW1lbnRzOiBuZXcgRGVwbG95bWVudHMoeyBzZGtQcm92aWRlcjogbmV3IE1vY2tTZGtQcm92aWRlcigpIH0pLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgdG9vbGtpdC5yb2xsYmFjayh7XG4gICAgICBzZWxlY3RvcjogeyBwYXR0ZXJuczogW10gfSxcbiAgICB9KTtcblxuICAgIGV4cGVjdChtb2NrZWRSb2xsYmFjaykudG9IYXZlQmVlbkNhbGxlZCgpO1xuICB9KTtcblxuICB0ZXN0LmVhY2goW1xuICAgIFt7IHR5cGU6ICdmYWlscGF1c2VkLW5lZWQtcm9sbGJhY2stZmlyc3QnLCByZWFzb246ICdyZXBsYWNlbWVudCcsIHN0YXR1czogJ09PUFMnIH0sIGZhbHNlXSxcbiAgICBbeyB0eXBlOiAnZmFpbHBhdXNlZC1uZWVkLXJvbGxiYWNrLWZpcnN0JywgcmVhc29uOiAncmVwbGFjZW1lbnQnLCBzdGF0dXM6ICdPT1BTJyB9LCB0cnVlXSxcbiAgICBbeyB0eXBlOiAnZmFpbHBhdXNlZC1uZWVkLXJvbGxiYWNrLWZpcnN0JywgcmVhc29uOiAnbm90LW5vcm9sbGJhY2snLCBzdGF0dXM6ICdPT1BTJyB9LCBmYWxzZV0sXG4gICAgW3sgdHlwZTogJ3JlcGxhY2VtZW50LXJlcXVpcmVzLXJvbGxiYWNrJyB9LCBmYWxzZV0sXG4gICAgW3sgdHlwZTogJ3JlcGxhY2VtZW50LXJlcXVpcmVzLXJvbGxiYWNrJyB9LCB0cnVlXSxcbiAgXSBzYXRpc2ZpZXMgQXJyYXk8W0RlcGxveVN0YWNrUmVzdWx0LCBib29sZWFuXT4pKCduby1yb2xsYmFjayBkZXBsb3ltZW50IHRoYXQgY2FudCBwcm9jZWVkIHdpbGwgYmUgY2FsbGVkIHdpdGggcm9sbGJhY2sgb24gcmV0cnk6ICVwICh1c2luZyBmb3JjZTogJXApJywgYXN5bmMgKGZpcnN0UmVzdWx0LCB1c2VGb3JjZSkgPT4ge1xuICAgIGNsb3VkRXhlY3V0YWJsZSA9IG5ldyBNb2NrQ2xvdWRFeGVjdXRhYmxlKHtcbiAgICAgIHN0YWNrczogW1xuICAgICAgICBNb2NrU3RhY2suTU9DS19TVEFDS19DLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcGxveW1lbnRzID0gbmV3IERlcGxveW1lbnRzKHsgc2RrUHJvdmlkZXI6IG5ldyBNb2NrU2RrUHJvdmlkZXIoKSB9KTtcblxuICAgIC8vIFJvbGxiYWNrIG1pZ2h0IGJlIGNhbGxlZCAtLSBqdXN0IGRvbid0IGRvIG5vdGhpbmcuXG4gICAgY29uc3QgbW9ja1JvbGxiYWNrU3RhY2sgPSBqZXN0LnNweU9uKGRlcGxveW1lbnRzLCAncm9sbGJhY2tTdGFjaycpLm1vY2tSZXNvbHZlZFZhbHVlKHt9KTtcblxuICAgIGNvbnN0IG1vY2tlZERlcGxveVN0YWNrID0gamVzdFxuICAgICAgLnNweU9uKGRlcGxveW1lbnRzLCAnZGVwbG95U3RhY2snKVxuICAgICAgLm1vY2tSZXNvbHZlZFZhbHVlT25jZShmaXJzdFJlc3VsdClcbiAgICAgIC5tb2NrUmVzb2x2ZWRWYWx1ZU9uY2Uoe1xuICAgICAgICB0eXBlOiAnZGlkLWRlcGxveS1zdGFjaycsXG4gICAgICAgIG5vT3A6IGZhbHNlLFxuICAgICAgICBvdXRwdXRzOiB7fSxcbiAgICAgICAgc3RhY2tBcm46ICdzdGFjazphcm4nLFxuICAgICAgfSk7XG5cbiAgICBjb25zdCBtb2NrZWRDb25maXJtID0gamVzdC5zcHlPbihwcm9tcHRseSwgJ2NvbmZpcm0nKS5tb2NrUmVzb2x2ZWRWYWx1ZSh0cnVlKTtcblxuICAgIGNvbnN0IHRvb2xraXQgPSBuZXcgQ2RrVG9vbGtpdCh7XG4gICAgICBjbG91ZEV4ZWN1dGFibGUsXG4gICAgICBjb25maWd1cmF0aW9uOiBjbG91ZEV4ZWN1dGFibGUuY29uZmlndXJhdGlvbixcbiAgICAgIHNka1Byb3ZpZGVyOiBjbG91ZEV4ZWN1dGFibGUuc2RrUHJvdmlkZXIsXG4gICAgICBkZXBsb3ltZW50cyxcbiAgICB9KTtcblxuICAgIGF3YWl0IHRvb2xraXQuZGVwbG95KHtcbiAgICAgIHNlbGVjdG9yOiB7IHBhdHRlcm5zOiBbXSB9LFxuICAgICAgaG90c3dhcDogSG90c3dhcE1vZGUuRlVMTF9ERVBMT1lNRU5ULFxuICAgICAgcm9sbGJhY2s6IGZhbHNlLFxuICAgICAgcmVxdWlyZUFwcHJvdmFsOiBSZXF1aXJlQXBwcm92YWwuTmV2ZXIsXG4gICAgICBmb3JjZTogdXNlRm9yY2UsXG4gICAgfSk7XG5cbiAgICBpZiAoZmlyc3RSZXN1bHQudHlwZSA9PT0gJ2ZhaWxwYXVzZWQtbmVlZC1yb2xsYmFjay1maXJzdCcpIHtcbiAgICAgIGV4cGVjdChtb2NrUm9sbGJhY2tTdGFjaykudG9IYXZlQmVlbkNhbGxlZCgpO1xuICAgIH1cblxuICAgIGlmICghdXNlRm9yY2UpIHtcbiAgICAgIC8vIFF1ZXN0aW9ucyB3aWxsIGhhdmUgYmVlbiBhc2tlZCBvbmx5IGlmIC0tZm9yY2UgaXMgbm90IHNwZWNpZmllZFxuICAgICAgaWYgKGZpcnN0UmVzdWx0LnR5cGUgPT09ICdmYWlscGF1c2VkLW5lZWQtcm9sbGJhY2stZmlyc3QnKSB7XG4gICAgICAgIGV4cGVjdChtb2NrZWRDb25maXJtKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Quc3RyaW5nQ29udGFpbmluZygnUm9sbCBiYWNrIGZpcnN0IGFuZCB0aGVuIHByb2NlZWQgd2l0aCBkZXBsb3ltZW50JykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhwZWN0KG1vY2tlZENvbmZpcm0pLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5zdHJpbmdDb250YWluaW5nKCdQZXJmb3JtIGEgcmVndWxhciBkZXBsb3ltZW50JykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGV4cGVjdChtb2NrZWREZXBsb3lTdGFjaykudG9IYXZlQmVlbk50aENhbGxlZFdpdGgoMSwgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoeyByb2xsYmFjazogZmFsc2UgfSkpO1xuICAgIGV4cGVjdChtb2NrZWREZXBsb3lTdGFjaykudG9IYXZlQmVlbk50aENhbGxlZFdpdGgoMiwgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoeyByb2xsYmFjazogdHJ1ZSB9KSk7XG4gIH0pO1xufSk7XG5cbmNsYXNzIE1vY2tTdGFjayB7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTU9DS19TVEFDS19BOiBUZXN0U3RhY2tBcnRpZmFjdCA9IHtcbiAgICBzdGFja05hbWU6ICdUZXN0LVN0YWNrLUEnLFxuICAgIHRlbXBsYXRlOiB7IFJlc291cmNlczogeyBUZW1wbGF0ZU5hbWU6ICdUZXN0LVN0YWNrLUEnIH0gfSxcbiAgICBlbnY6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvYmVybXVkYS10cmlhbmdsZS0xJyxcbiAgICBtZXRhZGF0YToge1xuICAgICAgJy9UZXN0LVN0YWNrLUEnOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiBjeHNjaGVtYS5BcnRpZmFjdE1ldGFkYXRhRW50cnlUeXBlLlNUQUNLX1RBR1MsXG4gICAgICAgICAgZGF0YTogW3sga2V5OiAnRm9vJywgdmFsdWU6ICdCYXInIH1dLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICAgIGRpc3BsYXlOYW1lOiAnVGVzdC1TdGFjay1BLURpc3BsYXktTmFtZScsXG4gIH07XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTU9DS19TVEFDS19COiBUZXN0U3RhY2tBcnRpZmFjdCA9IHtcbiAgICBzdGFja05hbWU6ICdUZXN0LVN0YWNrLUInLFxuICAgIHRlbXBsYXRlOiB7IFJlc291cmNlczogeyBUZW1wbGF0ZU5hbWU6ICdUZXN0LVN0YWNrLUInIH0gfSxcbiAgICBlbnY6ICdhd3M6Ly8xMjM0NTY3ODkwMTIvYmVybXVkYS10cmlhbmdsZS0xJyxcbiAgICBtZXRhZGF0YToge1xuICAgICAgJy9UZXN0LVN0YWNrLUInOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiBjeHNjaGVtYS5BcnRpZmFjdE1ldGFkYXRhRW50cnlUeXBlLlNUQUNLX1RBR1MsXG4gICAgICAgICAgZGF0YTogW3sga2V5OiAnQmF6JywgdmFsdWU6ICdaaW5nYSEnIH1dLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICB9O1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IE1PQ0tfU1RBQ0tfQzogVGVzdFN0YWNrQXJ0aWZhY3QgPSB7XG4gICAgc3RhY2tOYW1lOiAnVGVzdC1TdGFjay1DJyxcbiAgICB0ZW1wbGF0ZTogeyBSZXNvdXJjZXM6IHsgVGVtcGxhdGVOYW1lOiAnVGVzdC1TdGFjay1DJyB9IH0sXG4gICAgZW52OiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2Jlcm11ZGEtdHJpYW5nbGUtMScsXG4gICAgbWV0YWRhdGE6IHtcbiAgICAgICcvVGVzdC1TdGFjay1DJzogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5TVEFDS19UQUdTLFxuICAgICAgICAgIGRhdGE6IFt7IGtleTogJ0JheicsIHZhbHVlOiAnWmluZ2EhJyB9XSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBkaXNwbGF5TmFtZTogJ1Rlc3QtU3RhY2stQS9UZXN0LVN0YWNrLUMnLFxuICB9O1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IE1PQ0tfU1RBQ0tfRDogVGVzdFN0YWNrQXJ0aWZhY3QgPSB7XG4gICAgc3RhY2tOYW1lOiAnVGVzdC1TdGFjay1EJyxcbiAgICB0ZW1wbGF0ZTogeyBSZXNvdXJjZXM6IHsgVGVtcGxhdGVOYW1lOiAnVGVzdC1TdGFjay1EJyB9IH0sXG4gICAgZW52OiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2Jlcm11ZGEtdHJpYW5nbGUtMScsXG4gICAgbWV0YWRhdGE6IHtcbiAgICAgICcvVGVzdC1TdGFjay1EJzogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5TVEFDS19UQUdTLFxuICAgICAgICAgIGRhdGE6IFt7IGtleTogJ0JheicsIHZhbHVlOiAnWmluZ2EhJyB9XSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICBkZXBlbmRzOiBbTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQy5zdGFja05hbWVdLFxuICB9O1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IE1PQ0tfU1RBQ0tfV0lUSF9FUlJPUjogVGVzdFN0YWNrQXJ0aWZhY3QgPSB7XG4gICAgc3RhY2tOYW1lOiAnd2l0aGVycm9ycycsXG4gICAgZW52OiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2Jlcm11ZGEtdHJpYW5nbGUtMScsXG4gICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdlcnJvcnJlc291cmNlJyB9LFxuICAgIG1ldGFkYXRhOiB7XG4gICAgICAnL3Jlc291cmNlJzogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5FUlJPUixcbiAgICAgICAgICBkYXRhOiAndGhpcyBpcyBhbiBlcnJvcicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAgZGlzcGxheU5hbWU6ICdUZXN0LVN0YWNrLUEvd2l0aGVycm9ycycsXG4gIH07XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTU9DS19TVEFDS19XSVRIX0FTU0VUOiBUZXN0U3RhY2tBcnRpZmFjdCA9IHtcbiAgICBzdGFja05hbWU6ICdUZXN0LVN0YWNrLUFzc2V0JyxcbiAgICB0ZW1wbGF0ZTogeyBSZXNvdXJjZXM6IHsgVGVtcGxhdGVOYW1lOiAnVGVzdC1TdGFjay1Bc3NldCcgfSB9LFxuICAgIGVudjogJ2F3czovLzEyMzQ1Njc4OTAxMi9iZXJtdWRhLXRyaWFuZ2xlLTEnLFxuICAgIGFzc2V0TWFuaWZlc3Q6IHtcbiAgICAgIHZlcnNpb246IE1hbmlmZXN0LnZlcnNpb24oKSxcbiAgICAgIGZpbGVzOiB7XG4gICAgICAgIHh5ejoge1xuICAgICAgICAgIHNvdXJjZToge1xuICAgICAgICAgICAgcGF0aDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgJ0xJQ0VOU0UnKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRlc3RpbmF0aW9uczoge30sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTU9DS19TVEFDS19XSVRIX05PVElGSUNBVElPTl9BUk5TOiBUZXN0U3RhY2tBcnRpZmFjdCA9IHtcbiAgICBzdGFja05hbWU6ICdUZXN0LVN0YWNrLU5vdGlmaWNhdGlvbi1Bcm5zJyxcbiAgICBub3RpZmljYXRpb25Bcm5zOiBbJ2Fybjphd3M6c25zOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6TXlUb3BpYyddLFxuICAgIHRlbXBsYXRlOiB7IFJlc291cmNlczogeyBUZW1wbGF0ZU5hbWU6ICdUZXN0LVN0YWNrLU5vdGlmaWNhdGlvbi1Bcm5zJyB9IH0sXG4gICAgZW52OiAnYXdzOi8vMTIzNDU2Nzg5MDEyL2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgbWV0YWRhdGE6IHtcbiAgICAgICcvVGVzdC1TdGFjay1Ob3RpZmljYXRpb24tQXJucyc6IFtcbiAgICAgICAge1xuICAgICAgICAgIHR5cGU6IGN4c2NoZW1hLkFydGlmYWN0TWV0YWRhdGFFbnRyeVR5cGUuU1RBQ0tfVEFHUyxcbiAgICAgICAgICBkYXRhOiBbeyBrZXk6ICdGb28nLCB2YWx1ZTogJ0JhcicgfV0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIH07XG5cbiAgcHVibGljIHN0YXRpYyByZWFkb25seSBNT0NLX1NUQUNLX1dJVEhfQkFEX05PVElGSUNBVElPTl9BUk5TOiBUZXN0U3RhY2tBcnRpZmFjdCA9IHtcbiAgICBzdGFja05hbWU6ICdUZXN0LVN0YWNrLUJhZC1Ob3RpZmljYXRpb24tQXJucycsXG4gICAgbm90aWZpY2F0aW9uQXJuczogWydhcm46MTMzNzoxMjM0NTY3ODkwMTI6c25zOmJhZCddLFxuICAgIHRlbXBsYXRlOiB7IFJlc291cmNlczogeyBUZW1wbGF0ZU5hbWU6ICdUZXN0LVN0YWNrLUJhZC1Ob3RpZmljYXRpb24tQXJucycgfSB9LFxuICAgIGVudjogJ2F3czovLzEyMzQ1Njc4OTAxMi9iZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLFxuICAgIG1ldGFkYXRhOiB7XG4gICAgICAnL1Rlc3QtU3RhY2stQmFkLU5vdGlmaWNhdGlvbi1Bcm5zJzogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5TVEFDS19UQUdTLFxuICAgICAgICAgIGRhdGE6IFt7IGtleTogJ0ZvbycsIHZhbHVlOiAnQmFyJyB9XSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgfTtcbn1cblxuY2xhc3MgRmFrZUNsb3VkRm9ybWF0aW9uIGV4dGVuZHMgRGVwbG95bWVudHMge1xuICBwcml2YXRlIHJlYWRvbmx5IGV4cGVjdGVkVGFnczogeyBbc3RhY2tOYW1lOiBzdHJpbmddOiBUYWdbXSB9ID0ge307XG4gIHByaXZhdGUgcmVhZG9ubHkgZXhwZWN0ZWROb3RpZmljYXRpb25Bcm5zPzogc3RyaW5nW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXhwZWN0ZWRUYWdzOiB7IFtzdGFja05hbWU6IHN0cmluZ106IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gfSA9IHt9LFxuICAgIGV4cGVjdGVkTm90aWZpY2F0aW9uQXJucz86IHN0cmluZ1tdLFxuICApIHtcbiAgICBzdXBlcih7IHNka1Byb3ZpZGVyOiBuZXcgTW9ja1Nka1Byb3ZpZGVyKCkgfSk7XG5cbiAgICBmb3IgKGNvbnN0IFtzdGFja05hbWUsIHRhZ3NdIG9mIE9iamVjdC5lbnRyaWVzKGV4cGVjdGVkVGFncykpIHtcbiAgICAgIHRoaXMuZXhwZWN0ZWRUYWdzW3N0YWNrTmFtZV0gPSBPYmplY3QuZW50cmllcyh0YWdzKVxuICAgICAgICAubWFwKChbS2V5LCBWYWx1ZV0pID0+ICh7IEtleSwgVmFsdWUgfSkpXG4gICAgICAgIC5zb3J0KChsLCByKSA9PiBsLktleS5sb2NhbGVDb21wYXJlKHIuS2V5KSk7XG4gICAgfVxuICAgIHRoaXMuZXhwZWN0ZWROb3RpZmljYXRpb25Bcm5zID0gZXhwZWN0ZWROb3RpZmljYXRpb25Bcm5zO1xuICB9XG5cbiAgcHVibGljIGRlcGxveVN0YWNrKG9wdGlvbnM6IERlcGxveVN0YWNrT3B0aW9ucyk6IFByb21pc2U8U3VjY2Vzc2Z1bERlcGxveVN0YWNrUmVzdWx0PiB7XG4gICAgZXhwZWN0KFtcbiAgICAgIE1vY2tTdGFjay5NT0NLX1NUQUNLX0Euc3RhY2tOYW1lLFxuICAgICAgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQi5zdGFja05hbWUsXG4gICAgICBNb2NrU3RhY2suTU9DS19TVEFDS19DLnN0YWNrTmFtZSxcbiAgICAgIC8vIE1vY2tTdGFjay5NT0NLX1NUQUNLX0QgZGVsaWJlcmF0ZWx5IG9taXR0ZWQuXG4gICAgICBNb2NrU3RhY2suTU9DS19TVEFDS19XSVRIX0FTU0VULnN0YWNrTmFtZSxcbiAgICAgIE1vY2tTdGFjay5NT0NLX1NUQUNLX1dJVEhfRVJST1Iuc3RhY2tOYW1lLFxuICAgICAgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfV0lUSF9OT1RJRklDQVRJT05fQVJOUy5zdGFja05hbWUsXG4gICAgICBNb2NrU3RhY2suTU9DS19TVEFDS19XSVRIX0JBRF9OT1RJRklDQVRJT05fQVJOUy5zdGFja05hbWUsXG4gICAgXSkudG9Db250YWluKG9wdGlvbnMuc3RhY2suc3RhY2tOYW1lKTtcblxuICAgIGlmICh0aGlzLmV4cGVjdGVkVGFnc1tvcHRpb25zLnN0YWNrLnN0YWNrTmFtZV0pIHtcbiAgICAgIGV4cGVjdChvcHRpb25zLnRhZ3MpLnRvRXF1YWwodGhpcy5leHBlY3RlZFRhZ3Nbb3B0aW9ucy5zdGFjay5zdGFja05hbWVdKTtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGVzZSB0ZXN0cywgd2UgZG9uJ3QgbWFrZSBhIGRpc3RpbmN0aW9uIGhlcmUgYmV0d2VlbiBgdW5kZWZpbmVkYCBhbmQgYFtdYC5cbiAgICAvL1xuICAgIC8vIEluIHRlc3RzIGBkZXBsb3lTdGFja2AgaXRzZWxmIHdlIGRvIHRyZWF0IGB1bmRlZmluZWRgIGFuZCBgW11gIGRpZmZlcmVudGx5LFxuICAgIC8vIGFuZCBpbiBgYXdzLWNkay1saWJgIHdlIGVtaXQgdGhlbSB1bmRlciBkaWZmZXJlbnQgY29uZGl0aW9ucy4gQnV0IHRoaXMgdGVzdFxuICAgIC8vIHdpdGhvdXQgbm9ybWFsaXphdGlvbiBkZXBlbmRzIG9uIGEgdmVyc2lvbiBvZiBgYXdzLWNkay1saWJgIHRoYXQgaGFzbid0IGJlZW5cbiAgICAvLyByZWxlYXNlZCB5ZXQuXG4gICAgZXhwZWN0KG9wdGlvbnMubm90aWZpY2F0aW9uQXJucyA/PyBbXSkudG9FcXVhbCh0aGlzLmV4cGVjdGVkTm90aWZpY2F0aW9uQXJucyA/PyBbXSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG4gICAgICB0eXBlOiAnZGlkLWRlcGxveS1zdGFjaycsXG4gICAgICBzdGFja0FybjogYGFybjphd3M6Y2xvdWRmb3JtYXRpb246OjpzdGFjay8ke29wdGlvbnMuc3RhY2suc3RhY2tOYW1lfS9Nb2NrZWRPdXRgLFxuICAgICAgbm9PcDogZmFsc2UsXG4gICAgICBvdXRwdXRzOiB7IFN0YWNrTmFtZTogb3B0aW9ucy5zdGFjay5zdGFja05hbWUgfSxcbiAgICAgIHN0YWNrQXJ0aWZhY3Q6IG9wdGlvbnMuc3RhY2ssXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgcm9sbGJhY2tTdGFjayhfb3B0aW9uczogUm9sbGJhY2tTdGFja09wdGlvbnMpOiBQcm9taXNlPFJvbGxiYWNrU3RhY2tSZXN1bHQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgZGVzdHJveVN0YWNrKG9wdGlvbnM6IERlc3Ryb3lTdGFja09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBleHBlY3Qob3B0aW9ucy5zdGFjaykudG9CZURlZmluZWQoKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBwdWJsaWMgcmVhZEN1cnJlbnRUZW1wbGF0ZShzdGFjazogY3hhcGkuQ2xvdWRGb3JtYXRpb25TdGFja0FydGlmYWN0KTogUHJvbWlzZTxUZW1wbGF0ZT4ge1xuICAgIHN3aXRjaCAoc3RhY2suc3RhY2tOYW1lKSB7XG4gICAgICBjYXNlIE1vY2tTdGFjay5NT0NLX1NUQUNLX0Euc3RhY2tOYW1lOlxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHt9KTtcbiAgICAgIGNhc2UgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfQi5zdGFja05hbWU6XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe30pO1xuICAgICAgY2FzZSBNb2NrU3RhY2suTU9DS19TVEFDS19DLnN0YWNrTmFtZTpcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7fSk7XG4gICAgICBjYXNlIE1vY2tTdGFjay5NT0NLX1NUQUNLX1dJVEhfQVNTRVQuc3RhY2tOYW1lOlxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHt9KTtcbiAgICAgIGNhc2UgTW9ja1N0YWNrLk1PQ0tfU1RBQ0tfV0lUSF9OT1RJRklDQVRJT05fQVJOUy5zdGFja05hbWU6XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe30pO1xuICAgICAgY2FzZSBNb2NrU3RhY2suTU9DS19TVEFDS19XSVRIX0JBRF9OT1RJRklDQVRJT05fQVJOUy5zdGFja05hbWU6XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe30pO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBub3QgYW4gZXhwZWN0ZWQgbW9jayBzdGFjazogJHtzdGFjay5zdGFja05hbWV9YCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsaVRlc3QobmFtZTogc3RyaW5nLCBoYW5kbGVyOiAoZGlyOiBzdHJpbmcpID0+IHZvaWQgfCBQcm9taXNlPGFueT4pOiB2b2lkIHtcbiAgdGVzdChuYW1lLCAoKSA9PiB3aXRoVGVtcERpcihoYW5kbGVyKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhUZW1wRGlyKGNiOiAoZGlyOiBzdHJpbmcpID0+IHZvaWQgfCBQcm9taXNlPGFueT4pIHtcbiAgY29uc3QgdG1wRGlyID0gYXdhaXQgZnMubWtkdGVtcChwYXRoLmpvaW4ob3MudG1wZGlyKCksICdhd3MtY2RrLXRlc3QnKSk7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2IodG1wRGlyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBmcy5yZW1vdmUodG1wRGlyKTtcbiAgfVxufVxuIl19