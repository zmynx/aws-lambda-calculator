"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../../lib/api/deploy-stack');
jest.mock('../../lib/util/asset-publishing');
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const fake_cloudformation_stack_1 = require("./fake-cloudformation-stack");
const deploy_stack_1 = require("../../lib/api/deploy-stack");
const deployments_1 = require("../../lib/api/deployments");
const common_1 = require("../../lib/api/hotswap/common");
const toolkit_info_1 = require("../../lib/api/toolkit-info");
const cloudformation_1 = require("../../lib/api/util/cloudformation");
const util_1 = require("../util");
const mock_sdk_1 = require("../util/mock-sdk");
let sdkProvider;
let sdk;
let deployments;
let mockToolkitInfoLookup;
let currentCfnStackResources;
beforeEach(() => {
    jest.resetAllMocks();
    sdkProvider = new mock_sdk_1.MockSdkProvider();
    sdk = new mock_sdk_1.MockSdk();
    deployments = new deployments_1.Deployments({ sdkProvider });
    currentCfnStackResources = {};
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    toolkit_info_1.ToolkitInfo.lookup = mockToolkitInfoLookup = jest
        .fn()
        .mockResolvedValue(toolkit_info_1.ToolkitInfo.bootstrapStackNotFoundInfo('TestBootstrapStack'));
    (0, mock_sdk_1.setDefaultSTSMocks)();
});
function mockSuccessfulBootstrapStackLookup(props) {
    const outputs = {
        BucketName: 'BUCKET_NAME',
        BucketDomainName: 'BUCKET_ENDPOINT',
        BootstrapVersion: '1',
        ...props,
    };
    const fakeStack = (0, mock_sdk_1.mockBootstrapStack)({
        Outputs: Object.entries(outputs).map(([k, v]) => ({
            OutputKey: k,
            OutputValue: `${v}`,
        })),
    });
    mockToolkitInfoLookup.mockResolvedValue(toolkit_info_1.ToolkitInfo.fromStack(fakeStack));
}
test('passes through hotswap=true to deployStack()', async () => {
    // WHEN
    await deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
        }),
        hotswap: common_1.HotswapMode.FALL_BACK,
    });
    // THEN
    expect(deploy_stack_1.deployStack).toHaveBeenCalledWith(expect.objectContaining({
        hotswap: common_1.HotswapMode.FALL_BACK,
    }));
});
test('placeholders are substituted in CloudFormation execution role', async () => {
    await deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                cloudFormationExecutionRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
            },
        }),
    });
    expect(deploy_stack_1.deployStack).toHaveBeenCalledWith(expect.objectContaining({
        roleArn: 'bloop:here:123456789012',
    }));
});
test('role with placeholders is assumed if assumerole is given', async () => {
    const mockForEnvironment = jest.fn().mockImplementation(() => {
        return { sdk: new mock_sdk_1.MockSdk() };
    });
    sdkProvider.forEnvironment = mockForEnvironment;
    await deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
            },
        }),
    });
    expect(mockForEnvironment).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
        assumeRoleArn: 'bloop:here:123456789012',
    }));
});
test('deployment fails if bootstrap stack is missing', async () => {
    await expect(deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                requiresBootstrapStackVersion: 99,
            },
        }),
    })).rejects.toThrow(/requires a bootstrap stack/);
});
test('deployment fails if bootstrap stack is too old', async () => {
    mockSuccessfulBootstrapStackLookup({
        BootstrapVersion: 5,
    });
    (0, mock_sdk_1.setDefaultSTSMocks)();
    await expect(deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                requiresBootstrapStackVersion: 99,
            },
        }),
    })).rejects.toThrow(/requires bootstrap stack version '99', found '5'/);
});
test.each([false, true])('if toolkit stack be found: %p but SSM parameter name is present deployment succeeds', async (canLookup) => {
    if (canLookup) {
        mockSuccessfulBootstrapStackLookup({
            BootstrapVersion: 2,
        });
    }
    (0, mock_sdk_1.setDefaultSTSMocks)();
    mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).resolves({
        Parameter: {
            Value: '99',
        },
    });
    await deployments.deployStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
                requiresBootstrapStackVersion: 99,
                bootstrapStackVersionSsmParameter: '/some/parameter',
            },
        }),
    });
    expect(mock_sdk_1.mockSSMClient).toHaveReceivedCommandWith(client_ssm_1.GetParameterCommand, {
        Name: '/some/parameter',
    });
});
test('readCurrentTemplateWithNestedStacks() can handle non-Resources in the template', async () => {
    const stackSummary = stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd');
    pushStackResourceSummaries('ParentOfStackWithOutputAndParameter', stackSummary);
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListStackResourcesCommand).resolvesOnce({
        StackResourceSummaries: [stackSummary],
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolvesOnce({
        Stacks: [
            {
                StackName: 'NestedStack',
                RootId: 'StackId',
                CreationTime: new Date(),
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    });
    const cfnStack = new fake_cloudformation_stack_1.FakeCloudformationStack({
        stackName: 'ParentOfStackWithOutputAndParameter',
        stackId: 'StackId',
    });
    cloudformation_1.CloudFormationStack.lookup = async (_, stackName) => {
        switch (stackName) {
            case 'ParentOfStackWithOutputAndParameter':
                cfnStack.template = async () => ({
                    Resources: {
                        NestedStack: {
                            Type: 'AWS::CloudFormation::Stack',
                            Properties: {
                                TemplateURL: 'https://www.magic-url.com',
                            },
                            Metadata: {
                                'aws:asset:path': 'one-output-one-param-stack.nested.template.json',
                            },
                        },
                    },
                });
                break;
            case 'NestedStack':
                cfnStack.template = async () => ({
                    Resources: {
                        NestedResource: {
                            Type: 'AWS::Something',
                            Properties: {
                                Property: 'old-value',
                            },
                        },
                    },
                    Parameters: {
                        NestedParam: {
                            Type: 'String',
                        },
                    },
                    Outputs: {
                        NestedOutput: {
                            Value: {
                                Ref: 'NestedResource',
                            },
                        },
                    },
                });
                break;
            default:
                throw new Error('unknown stack name ' + stackName + ' found');
        }
        return cfnStack;
    };
    const rootStack = (0, util_1.testStack)({
        stackName: 'ParentOfStackWithOutputAndParameter',
        template: {
            Resources: {
                NestedStack: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-output-one-param-stack.nested.template.json',
                    },
                },
            },
        },
    });
    // WHEN
    const rootTemplate = await deployments.readCurrentTemplateWithNestedStacks(rootStack);
    const deployedTemplate = rootTemplate.deployedRootTemplate;
    const nestedStacks = rootTemplate.nestedStacks;
    // THEN
    expect(deployedTemplate).toEqual({
        Resources: {
            NestedStack: {
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-output-one-param-stack.nested.template.json',
                },
            },
        },
    });
    expect(rootStack.template).toEqual({
        Resources: {
            NestedStack: {
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-output-one-param-stack.nested.template.json',
                },
            },
        },
    });
    expect(nestedStacks).toEqual({
        NestedStack: {
            deployedTemplate: {
                Outputs: {
                    NestedOutput: {
                        Value: {
                            Ref: 'NestedResource',
                        },
                    },
                },
                Parameters: {
                    NestedParam: {
                        Type: 'String',
                    },
                },
                Resources: {
                    NestedResource: {
                        Properties: {
                            Property: 'old-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            generatedTemplate: {
                Outputs: {
                    NestedOutput: {
                        Value: {
                            Ref: 'NestedResource',
                        },
                    },
                },
                Parameters: {
                    NestedParam: {
                        Type: 'Number',
                    },
                },
                Resources: {
                    NestedResource: {
                        Properties: {
                            Property: 'new-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            nestedStackTemplates: {},
            physicalName: 'NestedStack',
        },
    });
});
test('readCurrentTemplateWithNestedStacks() with a 3-level nested + sibling structure works', async () => {
    const rootSummary = stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd');
    const nestedStackSummary = [
        stackSummaryOf('GrandChildStackA', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStackA/abcd'),
        stackSummaryOf('GrandChildStackB', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStackB/abcd'),
    ];
    const grandChildAStackSummary = stackSummaryOf('GrandChildA', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildA/abcd');
    const grandchildBStackSummary = stackSummaryOf('GrandChildB', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildB/abcd');
    pushStackResourceSummaries('MultiLevelRoot', rootSummary);
    pushStackResourceSummaries('NestedStack', ...nestedStackSummary);
    pushStackResourceSummaries('GrandChildStackA', grandChildAStackSummary);
    pushStackResourceSummaries('GrandChildStackB', grandchildBStackSummary);
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.ListStackResourcesCommand)
        .resolvesOnce({
        StackResourceSummaries: [rootSummary],
    })
        .resolvesOnce({
        StackResourceSummaries: nestedStackSummary,
    })
        .resolvesOnce({
        StackResourceSummaries: [grandChildAStackSummary],
    })
        .resolvesOnce({
        StackResourceSummaries: [grandchildBStackSummary],
    });
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                StackName: 'NestedStack',
                RootId: 'StackId',
                CreationTime: new Date(),
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackName: 'GrandChildStackA',
                RootId: 'StackId',
                ParentId: 'NestedStack',
                CreationTime: new Date(),
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackName: 'GrandChildStackB',
                RootId: 'StackId',
                ParentId: 'NestedStack',
                CreationTime: new Date(),
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    });
    givenStacks({
        MultiLevelRoot: {
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-two-stacks-stack.nested.template.json',
                        },
                    },
                },
            },
        },
        NestedStack: {
            template: {
                Resources: {
                    SomeResource: {
                        Type: 'AWS::Something',
                        Properties: {
                            Property: 'old-value',
                        },
                    },
                    GrandChildStackA: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                    GrandChildStackB: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                },
            },
        },
        GrandChildStackA: {
            template: {
                Resources: {
                    SomeResource: {
                        Type: 'AWS::Something',
                        Properties: {
                            Property: 'old-value',
                        },
                    },
                },
            },
        },
        GrandChildStackB: {
            template: {
                Resources: {
                    SomeResource: {
                        Type: 'AWS::Something',
                        Properties: {
                            Property: 'old-value',
                        },
                    },
                },
            },
        },
    });
    const rootStack = (0, util_1.testStack)({
        stackName: 'MultiLevelRoot',
        template: {
            Resources: {
                NestedStack: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-resource-two-stacks-stack.nested.template.json',
                    },
                },
            },
        },
    });
    // WHEN
    const rootTemplate = await deployments.readCurrentTemplateWithNestedStacks(rootStack);
    const deployedTemplate = rootTemplate.deployedRootTemplate;
    const nestedStacks = rootTemplate.nestedStacks;
    // THEN
    expect(deployedTemplate).toEqual({
        Resources: {
            NestedStack: {
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-resource-two-stacks-stack.nested.template.json',
                },
            },
        },
    });
    expect(rootStack.template).toEqual({
        Resources: {
            NestedStack: {
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-resource-two-stacks-stack.nested.template.json',
                },
            },
        },
    });
    expect(nestedStacks).toEqual({
        NestedStack: {
            deployedTemplate: {
                Resources: {
                    GrandChildStackA: {
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Type: 'AWS::CloudFormation::Stack',
                    },
                    GrandChildStackB: {
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Type: 'AWS::CloudFormation::Stack',
                    },
                    SomeResource: {
                        Properties: {
                            Property: 'old-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            generatedTemplate: {
                Resources: {
                    GrandChildStackA: {
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Type: 'AWS::CloudFormation::Stack',
                    },
                    GrandChildStackB: {
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Type: 'AWS::CloudFormation::Stack',
                    },
                    SomeResource: {
                        Properties: {
                            Property: 'new-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            nestedStackTemplates: {
                GrandChildStackA: {
                    deployedTemplate: {
                        Resources: {
                            SomeResource: {
                                Properties: {
                                    Property: 'old-value',
                                },
                                Type: 'AWS::Something',
                            },
                        },
                    },
                    generatedTemplate: {
                        Resources: {
                            SomeResource: {
                                Properties: {
                                    Property: 'new-value',
                                },
                                Type: 'AWS::Something',
                            },
                        },
                    },
                    nestedStackTemplates: {},
                    physicalName: 'GrandChildStackA',
                },
                GrandChildStackB: {
                    deployedTemplate: {
                        Resources: {
                            SomeResource: {
                                Properties: {
                                    Property: 'old-value',
                                },
                                Type: 'AWS::Something',
                            },
                        },
                    },
                    generatedTemplate: {
                        Resources: {
                            SomeResource: {
                                Properties: {
                                    Property: 'new-value',
                                },
                                Type: 'AWS::Something',
                            },
                        },
                    },
                    nestedStackTemplates: {},
                    physicalName: 'GrandChildStackB',
                },
            },
            physicalName: 'NestedStack',
        },
    });
});
test('readCurrentTemplateWithNestedStacks() on an undeployed parent stack with an (also undeployed) nested stack works', async () => {
    // GIVEN
    const cfnStack = new fake_cloudformation_stack_1.FakeCloudformationStack({
        stackName: 'UndeployedParent',
        stackId: 'StackId',
    });
    cloudformation_1.CloudFormationStack.lookup = async (_cfn, _stackName) => {
        cfnStack.template = async () => ({});
        return cfnStack;
    };
    const rootStack = (0, util_1.testStack)({
        stackName: 'UndeployedParent',
        template: {
            Resources: {
                NestedStack: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-resource-one-stack-stack.nested.template.json',
                    },
                },
            },
        },
    });
    // WHEN
    const deployedTemplate = (await deployments.readCurrentTemplateWithNestedStacks(rootStack)).deployedRootTemplate;
    const nestedStacks = (await deployments.readCurrentTemplateWithNestedStacks(rootStack)).nestedStacks;
    // THEN
    expect(deployedTemplate).toEqual({});
    expect(nestedStacks).toEqual({
        NestedStack: {
            deployedTemplate: {},
            generatedTemplate: {
                Resources: {
                    SomeResource: {
                        Type: 'AWS::Something',
                        Properties: {
                            Property: 'new-value',
                        },
                    },
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                },
            },
            nestedStackTemplates: {
                NestedStack: {
                    deployedTemplate: {},
                    generatedTemplate: {
                        Resources: {
                            SomeResource: {
                                Type: 'AWS::Something',
                                Properties: {
                                    Property: 'new-value',
                                },
                            },
                        },
                    },
                    nestedStackTemplates: {},
                },
            },
        },
    });
});
test('readCurrentTemplateWithNestedStacks() caches calls to listStackResources()', async () => {
    // GIVEN
    givenStacks({
        '*': {
            template: {
                Resources: {
                    NestedStackA: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                    NestedStackB: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                },
            },
        },
    });
    const rootStack = (0, util_1.testStack)({
        stackName: 'CachingRoot',
        template: {
            Resources: {
                NestedStackA: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-resource-stack.nested.template.json',
                    },
                },
                NestedStackB: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-resource-stack.nested.template.json',
                    },
                },
            },
        },
    });
    pushStackResourceSummaries('CachingRoot', stackSummaryOf('NestedStackA', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/one-resource-stack/abcd'), stackSummaryOf('NestedStackB', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/one-resource-stack/abcd'));
    // WHEN
    await deployments.readCurrentTemplateWithNestedStacks(rootStack);
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStackResourcesCommand, 1);
});
test('rollback stack assumes role if necessary', async () => {
    const mockForEnvironment = jest.fn().mockImplementation(() => {
        return { sdk };
    });
    sdkProvider.forEnvironment = mockForEnvironment;
    givenStacks({
        '*': { template: {} },
    });
    await deployments.rollbackStack({
        stack: (0, util_1.testStack)({
            stackName: 'boop',
            properties: {
                assumeRoleArn: 'bloop:${AWS::Region}:${AWS::AccountId}',
            },
        }),
        validateBootstrapStackVersion: false,
    });
    expect(mockForEnvironment).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
        assumeRoleArn: 'bloop:here:123456789012',
    }));
});
test('rollback stack allows rolling back from UPDATE_FAILED', async () => {
    // GIVEN
    givenStacks({
        '*': { template: {}, stackStatus: 'UPDATE_FAILED' },
    });
    // WHEN
    await deployments.rollbackStack({
        stack: (0, util_1.testStack)({ stackName: 'boop' }),
        validateBootstrapStackVersion: false,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.RollbackStackCommand);
});
test('rollback stack allows continue rollback from UPDATE_ROLLBACK_FAILED', async () => {
    // GIVEN
    givenStacks({
        '*': { template: {}, stackStatus: 'UPDATE_ROLLBACK_FAILED' },
    });
    // WHEN
    await deployments.rollbackStack({
        stack: (0, util_1.testStack)({ stackName: 'boop' }),
        validateBootstrapStackVersion: false,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ContinueUpdateRollbackCommand);
});
test('rollback stack fails in UPDATE_COMPLETE state', async () => {
    // GIVEN
    givenStacks({
        '*': { template: {}, stackStatus: 'UPDATE_COMPLETE' },
    });
    // WHEN
    const response = await deployments.rollbackStack({
        stack: (0, util_1.testStack)({ stackName: 'boop' }),
        validateBootstrapStackVersion: false,
    });
    // THEN
    expect(response.notInRollbackableState).toBe(true);
});
test('continue rollback stack with force ignores any failed resources', async () => {
    // GIVEN
    givenStacks({
        '*': { template: {}, stackStatus: 'UPDATE_ROLLBACK_FAILED' },
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStackEventsCommand).resolves({
        StackEvents: [
            {
                EventId: 'asdf',
                StackId: 'stack/MyStack',
                StackName: 'MyStack',
                Timestamp: new Date(),
                LogicalResourceId: 'Xyz',
                ResourceStatus: 'UPDATE_FAILED',
            },
        ],
    });
    // WHEN
    await deployments.rollbackStack({
        stack: (0, util_1.testStack)({ stackName: 'boop' }),
        validateBootstrapStackVersion: false,
        force: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ContinueUpdateRollbackCommand, {
        ResourcesToSkip: ['Xyz'],
        StackName: 'boop',
        ClientRequestToken: expect.anything(),
    });
});
test('readCurrentTemplateWithNestedStacks() successfully ignores stacks without metadata', async () => {
    // GIVEN
    const rootSummary = stackSummaryOf('WithMetadata', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/one-resource-stack/abcd');
    pushStackResourceSummaries('MetadataRoot', rootSummary);
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListStackResourcesCommand).resolves({
        StackResourceSummaries: [rootSummary],
    });
    givenStacks({
        'MetadataRoot': {
            template: {
                Resources: {
                    WithMetadata: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-resource-stack.nested.template.json',
                        },
                    },
                },
            },
        },
        '*': {
            template: {
                Resources: {
                    SomeResource: {
                        Type: 'AWS::Something',
                        Properties: {
                            Property: 'old-value',
                        },
                    },
                },
            },
        },
    });
    const rootStack = (0, util_1.testStack)({
        stackName: 'MetadataRoot',
        template: {
            Resources: {
                WithoutMetadata: {
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Type: 'AWS::CloudFormation::Stack',
                },
                WithEmptyMetadata: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {},
                },
                WithMetadata: {
                    Type: 'AWS::CloudFormation::Stack',
                    Properties: {
                        TemplateURL: 'https://www.magic-url.com',
                    },
                    Metadata: {
                        'aws:asset:path': 'one-resource-stack.nested.template.json',
                    },
                },
            },
        },
    });
    // WHEN
    const deployedTemplate = (await deployments.readCurrentTemplateWithNestedStacks(rootStack)).deployedRootTemplate;
    const nestedStacks = (await deployments.readCurrentTemplateWithNestedStacks(rootStack)).nestedStacks;
    // THEN
    expect(deployedTemplate).toEqual({
        Resources: {
            WithMetadata: {
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-resource-stack.nested.template.json',
                },
            },
        },
    });
    expect(rootStack.template).toEqual({
        Resources: {
            WithoutMetadata: {
                // Unchanged
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
            },
            WithEmptyMetadata: {
                // Unchanged
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {},
            },
            WithMetadata: {
                // Changed
                Type: 'AWS::CloudFormation::Stack',
                Properties: {
                    TemplateURL: 'https://www.magic-url.com',
                },
                Metadata: {
                    'aws:asset:path': 'one-resource-stack.nested.template.json',
                },
            },
        },
    });
    expect(nestedStacks).toEqual({
        WithMetadata: {
            deployedTemplate: {
                Resources: {
                    SomeResource: {
                        Properties: {
                            Property: 'old-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            generatedTemplate: {
                Resources: {
                    SomeResource: {
                        Properties: {
                            Property: 'new-value',
                        },
                        Type: 'AWS::Something',
                    },
                },
            },
            physicalName: 'one-resource-stack',
            nestedStackTemplates: {},
        },
    });
});
describe('stackExists', () => {
    test.each([
        [false, 'deploy:here:123456789012'],
        [true, 'lookup:here:123456789012'],
    ])('uses lookup role if requested: %p', async (tryLookupRole, expectedRoleArn) => {
        const mockForEnvironment = jest.fn().mockImplementation(() => { return { sdk: new mock_sdk_1.MockSdk() }; });
        sdkProvider.forEnvironment = mockForEnvironment;
        givenStacks({
            '*': { template: {} },
        });
        const result = await deployments.stackExists({
            stack: (0, util_1.testStack)({
                stackName: 'boop',
                properties: {
                    assumeRoleArn: 'deploy:${AWS::Region}:${AWS::AccountId}',
                    lookupRole: {
                        arn: 'lookup:${AWS::Region}:${AWS::AccountId}',
                    },
                },
            }),
            tryLookupRole,
        });
        expect(result).toBeTruthy();
        expect(mockForEnvironment).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
            assumeRoleArn: expectedRoleArn,
        }));
    });
});
function pushStackResourceSummaries(stackName, ...items) {
    if (!currentCfnStackResources[stackName]) {
        currentCfnStackResources[stackName] = [];
    }
    currentCfnStackResources[stackName].push(...items);
}
function stackSummaryOf(logicalId, resourceType, physicalResourceId) {
    return {
        LogicalResourceId: logicalId,
        PhysicalResourceId: physicalResourceId,
        ResourceType: resourceType,
        ResourceStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
        LastUpdatedTimestamp: new Date(),
    };
}
function givenStacks(stacks) {
    jest.spyOn(cloudformation_1.CloudFormationStack, 'lookup').mockImplementation(async (_, stackName) => {
        let stack = stacks[stackName];
        if (!stack) {
            stack = stacks['*'];
        }
        if (stack) {
            const cfnStack = new fake_cloudformation_stack_1.FakeCloudformationStack({
                stackName,
                stackId: `stack/${stackName}`,
                stackStatus: stack.stackStatus,
            });
            cfnStack.setTemplate(stack.template);
            return cfnStack;
        }
        else {
            return new fake_cloudformation_stack_1.FakeCloudformationStack({ stackName });
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWRmb3JtYXRpb24tZGVwbG95bWVudHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkZm9ybWF0aW9uLWRlcGxveW1lbnRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7QUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0FBRTdDLDBFQVF3QztBQUN4QyxvREFBMEQ7QUFDMUQsMkVBQXNFO0FBQ3RFLDZEQUF5RDtBQUN6RCwyREFBd0Q7QUFDeEQseURBQTJEO0FBQzNELDZEQUF5RDtBQUN6RCxzRUFBd0U7QUFDeEUsa0NBQW9DO0FBQ3BDLCtDQVEwQjtBQUUxQixJQUFJLFdBQTRCLENBQUM7QUFDakMsSUFBSSxHQUFZLENBQUM7QUFDakIsSUFBSSxXQUF3QixDQUFDO0FBQzdCLElBQUkscUJBQWdDLENBQUM7QUFDckMsSUFBSSx3QkFBbUUsQ0FBQztBQUN4RSxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3JCLFdBQVcsR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztJQUNwQyxHQUFHLEdBQUcsSUFBSSxrQkFBTyxFQUFFLENBQUM7SUFDcEIsV0FBVyxHQUFHLElBQUkseUJBQVcsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFFL0Msd0JBQXdCLEdBQUcsRUFBRSxDQUFDO0lBQzlCLElBQUEsbUNBQXdCLEdBQUUsQ0FBQztJQUMzQiwwQkFBVyxDQUFDLE1BQU0sR0FBRyxxQkFBcUIsR0FBRyxJQUFJO1NBQzlDLEVBQUUsRUFBRTtTQUNKLGlCQUFpQixDQUFDLDBCQUFXLENBQUMsMEJBQTBCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0lBQ25GLElBQUEsNkJBQWtCLEdBQUUsQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsa0NB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SyxDQUFDLG9DQUFtQixFQUFFLFFBQVEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUU7UUFDbEYsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdEIsQ0FBQztRQUNELElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixNQUFNLFFBQVEsR0FBRyxJQUFJLG1EQUF1QixDQUFDO2dCQUMzQyxTQUFTO2dCQUNULE9BQU8sRUFBRSxTQUFTLFNBQVMsRUFBRTtnQkFDN0IsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO2FBQy9CLENBQUMsQ0FBQztZQUNILFFBQVEsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3JDLE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxJQUFJLG1EQUF1QixDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNwRCxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiamVzdC5tb2NrKCcuLi8uLi9saWIvYXBpL2RlcGxveS1zdGFjaycpO1xuamVzdC5tb2NrKCcuLi8uLi9saWIvdXRpbC9hc3NldC1wdWJsaXNoaW5nJyk7XG5cbmltcG9ydCB7XG4gIERlc2NyaWJlU3RhY2tzQ29tbWFuZCxcbiAgTGlzdFN0YWNrUmVzb3VyY2VzQ29tbWFuZCxcbiAgU3RhY2tTdGF0dXMsXG4gIHR5cGUgU3RhY2tSZXNvdXJjZVN1bW1hcnksXG4gIFJvbGxiYWNrU3RhY2tDb21tYW5kLFxuICBDb250aW51ZVVwZGF0ZVJvbGxiYWNrQ29tbWFuZCxcbiAgRGVzY3JpYmVTdGFja0V2ZW50c0NvbW1hbmQsXG59IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBHZXRQYXJhbWV0ZXJDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXNzbSc7XG5pbXBvcnQgeyBGYWtlQ2xvdWRmb3JtYXRpb25TdGFjayB9IGZyb20gJy4vZmFrZS1jbG91ZGZvcm1hdGlvbi1zdGFjayc7XG5pbXBvcnQgeyBkZXBsb3lTdGFjayB9IGZyb20gJy4uLy4uL2xpYi9hcGkvZGVwbG95LXN0YWNrJztcbmltcG9ydCB7IERlcGxveW1lbnRzIH0gZnJvbSAnLi4vLi4vbGliL2FwaS9kZXBsb3ltZW50cyc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgVG9vbGtpdEluZm8gfSBmcm9tICcuLi8uLi9saWIvYXBpL3Rvb2xraXQtaW5mbyc7XG5pbXBvcnQgeyBDbG91ZEZvcm1hdGlvblN0YWNrIH0gZnJvbSAnLi4vLi4vbGliL2FwaS91dGlsL2Nsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IHRlc3RTdGFjayB9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtcbiAgbW9ja0Jvb3RzdHJhcFN0YWNrLFxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQsXG4gIE1vY2tTZGssXG4gIE1vY2tTZGtQcm92aWRlcixcbiAgbW9ja1NTTUNsaWVudCxcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0LFxuICBzZXREZWZhdWx0U1RTTW9ja3MsXG59IGZyb20gJy4uL3V0aWwvbW9jay1zZGsnO1xuXG5sZXQgc2RrUHJvdmlkZXI6IE1vY2tTZGtQcm92aWRlcjtcbmxldCBzZGs6IE1vY2tTZGs7XG5sZXQgZGVwbG95bWVudHM6IERlcGxveW1lbnRzO1xubGV0IG1vY2tUb29sa2l0SW5mb0xvb2t1cDogamVzdC5Nb2NrO1xubGV0IGN1cnJlbnRDZm5TdGFja1Jlc291cmNlczogeyBba2V5OiBzdHJpbmddOiBTdGFja1Jlc291cmNlU3VtbWFyeVtdIH07XG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgamVzdC5yZXNldEFsbE1vY2tzKCk7XG4gIHNka1Byb3ZpZGVyID0gbmV3IE1vY2tTZGtQcm92aWRlcigpO1xuICBzZGsgPSBuZXcgTW9ja1NkaygpO1xuICBkZXBsb3ltZW50cyA9IG5ldyBEZXBsb3ltZW50cyh7IHNka1Byb3ZpZGVyIH0pO1xuXG4gIGN1cnJlbnRDZm5TdGFja1Jlc291cmNlcyA9IHt9O1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgVG9vbGtpdEluZm8ubG9va3VwID0gbW9ja1Rvb2xraXRJbmZvTG9va3VwID0gamVzdFxuICAgIC5mbigpXG4gICAgLm1vY2tSZXNvbHZlZFZhbHVlKFRvb2xraXRJbmZvLmJvb3RzdHJhcFN0YWNrTm90Rm91bmRJbmZvKCdUZXN0Qm9vdHN0cmFwU3RhY2snKSk7XG4gIHNldERlZmF1bHRTVFNNb2NrcygpO1xufSk7XG5cbmZ1bmN0aW9uIG1vY2tTdWNjZXNzZnVsQm9vdHN0cmFwU3RhY2tMb29rdXAocHJvcHM/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG91dHB1dHMgPSB7XG4gICAgQnVja2V0TmFtZTogJ0JVQ0tFVF9OQU1FJyxcbiAgICBCdWNrZXREb21haW5OYW1lOiAnQlVDS0VUX0VORFBPSU5UJyxcbiAgICBCb290c3RyYXBWZXJzaW9uOiAnMScsXG4gICAgLi4ucHJvcHMsXG4gIH07XG5cbiAgY29uc3QgZmFrZVN0YWNrID0gbW9ja0Jvb3RzdHJhcFN0YWNrKHtcbiAgICBPdXRwdXRzOiBPYmplY3QuZW50cmllcyhvdXRwdXRzKS5tYXAoKFtrLCB2XSkgPT4gKHtcbiAgICAgIE91dHB1dEtleTogayxcbiAgICAgIE91dHB1dFZhbHVlOiBgJHt2fWAsXG4gICAgfSkpLFxuICB9KTtcblxuICBtb2NrVG9vbGtpdEluZm9Mb29rdXAubW9ja1Jlc29sdmVkVmFsdWUoVG9vbGtpdEluZm8uZnJvbVN0YWNrKGZha2VTdGFjaykpO1xufVxuXG50ZXN0KCdwYXNzZXMgdGhyb3VnaCBob3Rzd2FwPXRydWUgdG8gZGVwbG95U3RhY2soKScsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3ltZW50cy5kZXBsb3lTdGFjayh7XG4gICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdib29wJyxcbiAgICB9KSxcbiAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KGRlcGxveVN0YWNrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssXG4gICAgfSksXG4gICk7XG59KTtcblxudGVzdCgncGxhY2Vob2xkZXJzIGFyZSBzdWJzdGl0dXRlZCBpbiBDbG91ZEZvcm1hdGlvbiBleGVjdXRpb24gcm9sZScsIGFzeW5jICgpID0+IHtcbiAgYXdhaXQgZGVwbG95bWVudHMuZGVwbG95U3RhY2soe1xuICAgIHN0YWNrOiB0ZXN0U3RhY2soe1xuICAgICAgc3RhY2tOYW1lOiAnYm9vcCcsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xuXG4gIGV4cGVjdChkZXBsb3lTdGFjaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgcm9sZUFybjogJ2Jsb29wOmhlcmU6MTIzNDU2Nzg5MDEyJyxcbiAgICB9KSxcbiAgKTtcbn0pO1xuXG50ZXN0KCdyb2xlIHdpdGggcGxhY2Vob2xkZXJzIGlzIGFzc3VtZWQgaWYgYXNzdW1lcm9sZSBpcyBnaXZlbicsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgbW9ja0ZvckVudmlyb25tZW50ID0gamVzdC5mbigpLm1vY2tJbXBsZW1lbnRhdGlvbigoKSA9PiB7XG4gICAgcmV0dXJuIHsgc2RrOiBuZXcgTW9ja1NkaygpIH07XG4gIH0pO1xuICBzZGtQcm92aWRlci5mb3JFbnZpcm9ubWVudCA9IG1vY2tGb3JFbnZpcm9ubWVudDtcblxuICBhd2FpdCBkZXBsb3ltZW50cy5kZXBsb3lTdGFjayh7XG4gICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdib29wJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xuXG4gIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgIGV4cGVjdC5hbnl0aGluZygpLFxuICAgIGV4cGVjdC5hbnl0aGluZygpLFxuICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDpoZXJlOjEyMzQ1Njc4OTAxMicsXG4gICAgfSksXG4gICk7XG59KTtcblxudGVzdCgnZGVwbG95bWVudCBmYWlscyBpZiBib290c3RyYXAgc3RhY2sgaXMgbWlzc2luZycsIGFzeW5jICgpID0+IHtcbiAgYXdhaXQgZXhwZWN0KFxuICAgIGRlcGxveW1lbnRzLmRlcGxveVN0YWNrKHtcbiAgICAgIHN0YWNrOiB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdib29wJyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIGFzc3VtZVJvbGVBcm46ICdibG9vcDoke0FXUzo6UmVnaW9ufToke0FXUzo6QWNjb3VudElkfScsXG4gICAgICAgICAgcmVxdWlyZXNCb290c3RyYXBTdGFja1ZlcnNpb246IDk5LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgfSksXG4gICkucmVqZWN0cy50b1Rocm93KC9yZXF1aXJlcyBhIGJvb3RzdHJhcCBzdGFjay8pO1xufSk7XG5cbnRlc3QoJ2RlcGxveW1lbnQgZmFpbHMgaWYgYm9vdHN0cmFwIHN0YWNrIGlzIHRvbyBvbGQnLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tTdWNjZXNzZnVsQm9vdHN0cmFwU3RhY2tMb29rdXAoe1xuICAgIEJvb3RzdHJhcFZlcnNpb246IDUsXG4gIH0pO1xuICBzZXREZWZhdWx0U1RTTW9ja3MoKTtcblxuICBhd2FpdCBleHBlY3QoXG4gICAgZGVwbG95bWVudHMuZGVwbG95U3RhY2soe1xuICAgICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ2Jvb3AnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgICAgICByZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbjogOTksXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICB9KSxcbiAgKS5yZWplY3RzLnRvVGhyb3coL3JlcXVpcmVzIGJvb3RzdHJhcCBzdGFjayB2ZXJzaW9uICc5OScsIGZvdW5kICc1Jy8pO1xufSk7XG5cbnRlc3QuZWFjaChbZmFsc2UsIHRydWVdKShcbiAgJ2lmIHRvb2xraXQgc3RhY2sgYmUgZm91bmQ6ICVwIGJ1dCBTU00gcGFyYW1ldGVyIG5hbWUgaXMgcHJlc2VudCBkZXBsb3ltZW50IHN1Y2NlZWRzJyxcbiAgYXN5bmMgKGNhbkxvb2t1cCkgPT4ge1xuICAgIGlmIChjYW5Mb29rdXApIHtcbiAgICAgIG1vY2tTdWNjZXNzZnVsQm9vdHN0cmFwU3RhY2tMb29rdXAoe1xuICAgICAgICBCb290c3RyYXBWZXJzaW9uOiAyLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHNldERlZmF1bHRTVFNNb2NrcygpO1xuXG4gICAgbW9ja1NTTUNsaWVudC5vbihHZXRQYXJhbWV0ZXJDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBQYXJhbWV0ZXI6IHtcbiAgICAgICAgVmFsdWU6ICc5OScsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXdhaXQgZGVwbG95bWVudHMuZGVwbG95U3RhY2soe1xuICAgICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ2Jvb3AnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgICAgICByZXF1aXJlc0Jvb3RzdHJhcFN0YWNrVmVyc2lvbjogOTksXG4gICAgICAgICAgYm9vdHN0cmFwU3RhY2tWZXJzaW9uU3NtUGFyYW1ldGVyOiAnL3NvbWUvcGFyYW1ldGVyJyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KG1vY2tTU01DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoR2V0UGFyYW1ldGVyQ29tbWFuZCwge1xuICAgICAgTmFtZTogJy9zb21lL3BhcmFtZXRlcicsXG4gICAgfSk7XG4gIH0sXG4pO1xuXG50ZXN0KCdyZWFkQ3VycmVudFRlbXBsYXRlV2l0aE5lc3RlZFN0YWNrcygpIGNhbiBoYW5kbGUgbm9uLVJlc291cmNlcyBpbiB0aGUgdGVtcGxhdGUnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IHN0YWNrU3VtbWFyeSA9IHN0YWNrU3VtbWFyeU9mKFxuICAgICdOZXN0ZWRTdGFjaycsXG4gICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL05lc3RlZFN0YWNrL2FiY2QnLFxuICApO1xuXG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKCdQYXJlbnRPZlN0YWNrV2l0aE91dHB1dEFuZFBhcmFtZXRlcicsIHN0YWNrU3VtbWFyeSk7XG5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKExpc3RTdGFja1Jlc291cmNlc0NvbW1hbmQpLnJlc29sdmVzT25jZSh7XG4gICAgU3RhY2tSZXNvdXJjZVN1bW1hcmllczogW3N0YWNrU3VtbWFyeV0sXG4gIH0pO1xuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlc09uY2Uoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICBTdGFja05hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgICAgIFJvb3RJZDogJ1N0YWNrSWQnLFxuICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIGNvbnN0IGNmblN0YWNrID0gbmV3IEZha2VDbG91ZGZvcm1hdGlvblN0YWNrKHtcbiAgICBzdGFja05hbWU6ICdQYXJlbnRPZlN0YWNrV2l0aE91dHB1dEFuZFBhcmFtZXRlcicsXG4gICAgc3RhY2tJZDogJ1N0YWNrSWQnLFxuICB9KTtcbiAgQ2xvdWRGb3JtYXRpb25TdGFjay5sb29rdXAgPSBhc3luYyAoXywgc3RhY2tOYW1lOiBzdHJpbmcpID0+IHtcbiAgICBzd2l0Y2ggKHN0YWNrTmFtZSkge1xuICAgICAgY2FzZSAnUGFyZW50T2ZTdGFja1dpdGhPdXRwdXRBbmRQYXJhbWV0ZXInOlxuICAgICAgICBjZm5TdGFjay50ZW1wbGF0ZSA9IGFzeW5jICgpID0+ICh7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLW91dHB1dC1vbmUtcGFyYW0tc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ05lc3RlZFN0YWNrJzpcbiAgICAgICAgY2ZuU3RhY2sudGVtcGxhdGUgPSBhc3luYyAoKSA9PiAoe1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgTmVzdGVkUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFByb3BlcnR5OiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBOZXN0ZWRQYXJhbToge1xuICAgICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBPdXRwdXRzOiB7XG4gICAgICAgICAgICBOZXN0ZWRPdXRwdXQ6IHtcbiAgICAgICAgICAgICAgVmFsdWU6IHtcbiAgICAgICAgICAgICAgICBSZWY6ICdOZXN0ZWRSZXNvdXJjZScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtub3duIHN0YWNrIG5hbWUgJyArIHN0YWNrTmFtZSArICcgZm91bmQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2ZuU3RhY2s7XG4gIH07XG5cbiAgY29uc3Qgcm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICBzdGFja05hbWU6ICdQYXJlbnRPZlN0YWNrV2l0aE91dHB1dEFuZFBhcmFtZXRlcicsXG4gICAgdGVtcGxhdGU6IHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLW91dHB1dC1vbmUtcGFyYW0tc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3Qgcm9vdFRlbXBsYXRlID0gYXdhaXQgZGVwbG95bWVudHMucmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3Mocm9vdFN0YWNrKTtcbiAgY29uc3QgZGVwbG95ZWRUZW1wbGF0ZSA9IHJvb3RUZW1wbGF0ZS5kZXBsb3llZFJvb3RUZW1wbGF0ZTtcbiAgY29uc3QgbmVzdGVkU3RhY2tzID0gcm9vdFRlbXBsYXRlLm5lc3RlZFN0YWNrcztcblxuICAvLyBUSEVOXG4gIGV4cGVjdChkZXBsb3llZFRlbXBsYXRlKS50b0VxdWFsKHtcbiAgICBSZXNvdXJjZXM6IHtcbiAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtb3V0cHV0LW9uZS1wYXJhbS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGV4cGVjdChyb290U3RhY2sudGVtcGxhdGUpLnRvRXF1YWwoe1xuICAgIFJlc291cmNlczoge1xuICAgICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgIH0sXG4gICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1vdXRwdXQtb25lLXBhcmFtLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgZXhwZWN0KG5lc3RlZFN0YWNrcykudG9FcXVhbCh7XG4gICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgIGRlcGxveWVkVGVtcGxhdGU6IHtcbiAgICAgICAgT3V0cHV0czoge1xuICAgICAgICAgIE5lc3RlZE91dHB1dDoge1xuICAgICAgICAgICAgVmFsdWU6IHtcbiAgICAgICAgICAgICAgUmVmOiAnTmVzdGVkUmVzb3VyY2UnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgTmVzdGVkUGFyYW06IHtcbiAgICAgICAgICAgIFR5cGU6ICdTdHJpbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE5lc3RlZFJlc291cmNlOiB7XG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFByb3BlcnR5OiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZ2VuZXJhdGVkVGVtcGxhdGU6IHtcbiAgICAgICAgT3V0cHV0czoge1xuICAgICAgICAgIE5lc3RlZE91dHB1dDoge1xuICAgICAgICAgICAgVmFsdWU6IHtcbiAgICAgICAgICAgICAgUmVmOiAnTmVzdGVkUmVzb3VyY2UnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgTmVzdGVkUGFyYW06IHtcbiAgICAgICAgICAgIFR5cGU6ICdOdW1iZXInLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE5lc3RlZFJlc291cmNlOiB7XG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFByb3BlcnR5OiAnbmV3LXZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgbmVzdGVkU3RhY2tUZW1wbGF0ZXM6IHt9LFxuICAgICAgcGh5c2ljYWxOYW1lOiAnTmVzdGVkU3RhY2snLFxuICAgIH0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ3JlYWRDdXJyZW50VGVtcGxhdGVXaXRoTmVzdGVkU3RhY2tzKCkgd2l0aCBhIDMtbGV2ZWwgbmVzdGVkICsgc2libGluZyBzdHJ1Y3R1cmUgd29ya3MnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IHJvb3RTdW1tYXJ5ID0gc3RhY2tTdW1tYXJ5T2YoXG4gICAgJ05lc3RlZFN0YWNrJyxcbiAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svTmVzdGVkU3RhY2svYWJjZCcsXG4gICk7XG5cbiAgY29uc3QgbmVzdGVkU3RhY2tTdW1tYXJ5ID0gW1xuICAgIHN0YWNrU3VtbWFyeU9mKFxuICAgICAgJ0dyYW5kQ2hpbGRTdGFja0EnLFxuICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svR3JhbmRDaGlsZFN0YWNrQS9hYmNkJyxcbiAgICApLFxuICAgIHN0YWNrU3VtbWFyeU9mKFxuICAgICAgJ0dyYW5kQ2hpbGRTdGFja0InLFxuICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svR3JhbmRDaGlsZFN0YWNrQi9hYmNkJyxcbiAgICApLFxuICBdO1xuXG4gIGNvbnN0IGdyYW5kQ2hpbGRBU3RhY2tTdW1tYXJ5ID0gc3RhY2tTdW1tYXJ5T2YoXG4gICAgJ0dyYW5kQ2hpbGRBJyxcbiAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svR3JhbmRDaGlsZEEvYWJjZCcsXG4gICk7XG5cbiAgY29uc3QgZ3JhbmRjaGlsZEJTdGFja1N1bW1hcnkgPSBzdGFja1N1bW1hcnlPZihcbiAgICAnR3JhbmRDaGlsZEInLFxuICAgICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgJ2Fybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay9HcmFuZENoaWxkQi9hYmNkJyxcbiAgKTtcblxuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcygnTXVsdGlMZXZlbFJvb3QnLCByb290U3VtbWFyeSk7XG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKCdOZXN0ZWRTdGFjaycsIC4uLm5lc3RlZFN0YWNrU3VtbWFyeSk7XG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKCdHcmFuZENoaWxkU3RhY2tBJywgZ3JhbmRDaGlsZEFTdGFja1N1bW1hcnkpO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcygnR3JhbmRDaGlsZFN0YWNrQicsIGdyYW5kY2hpbGRCU3RhY2tTdW1tYXJ5KTtcblxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAub24oTGlzdFN0YWNrUmVzb3VyY2VzQ29tbWFuZClcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrUmVzb3VyY2VTdW1tYXJpZXM6IFtyb290U3VtbWFyeV0sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrUmVzb3VyY2VTdW1tYXJpZXM6IG5lc3RlZFN0YWNrU3VtbWFyeSxcbiAgICB9KVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tSZXNvdXJjZVN1bW1hcmllczogW2dyYW5kQ2hpbGRBU3RhY2tTdW1tYXJ5XSxcbiAgICB9KVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tSZXNvdXJjZVN1bW1hcmllczogW2dyYW5kY2hpbGRCU3RhY2tTdW1tYXJ5XSxcbiAgICB9KTtcblxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdGFja05hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgICAgICAgUm9vdElkOiAnU3RhY2tJZCcsXG4gICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN0YWNrTmFtZTogJ0dyYW5kQ2hpbGRTdGFja0EnLFxuICAgICAgICAgIFJvb3RJZDogJ1N0YWNrSWQnLFxuICAgICAgICAgIFBhcmVudElkOiAnTmVzdGVkU3RhY2snLFxuICAgICAgICAgIENyZWF0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdGFja05hbWU6ICdHcmFuZENoaWxkU3RhY2tCJyxcbiAgICAgICAgICBSb290SWQ6ICdTdGFja0lkJyxcbiAgICAgICAgICBQYXJlbnRJZDogJ05lc3RlZFN0YWNrJyxcbiAgICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLkNSRUFURV9DT01QTEVURSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIGdpdmVuU3RhY2tzKHtcbiAgICBNdWx0aUxldmVsUm9vdDoge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS10d28tc3RhY2tzLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgU29tZVJlc291cmNlOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBQcm9wZXJ0eTogJ29sZC12YWx1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgR3JhbmRDaGlsZFN0YWNrQToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBHcmFuZENoaWxkU3RhY2tCOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIEdyYW5kQ2hpbGRTdGFja0E6IHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcGVydHk6ICdvbGQtdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIEdyYW5kQ2hpbGRTdGFja0I6IHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcGVydHk6ICdvbGQtdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCByb290U3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgIHN0YWNrTmFtZTogJ011bHRpTGV2ZWxSb290JyxcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2UtdHdvLXN0YWNrcy1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByb290VGVtcGxhdGUgPSBhd2FpdCBkZXBsb3ltZW50cy5yZWFkQ3VycmVudFRlbXBsYXRlV2l0aE5lc3RlZFN0YWNrcyhyb290U3RhY2spO1xuICBjb25zdCBkZXBsb3llZFRlbXBsYXRlID0gcm9vdFRlbXBsYXRlLmRlcGxveWVkUm9vdFRlbXBsYXRlO1xuICBjb25zdCBuZXN0ZWRTdGFja3MgPSByb290VGVtcGxhdGUubmVzdGVkU3RhY2tzO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KGRlcGxveWVkVGVtcGxhdGUpLnRvRXF1YWwoe1xuICAgIFJlc291cmNlczoge1xuICAgICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgIH0sXG4gICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS10d28tc3RhY2tzLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgZXhwZWN0KHJvb3RTdGFjay50ZW1wbGF0ZSkudG9FcXVhbCh7XG4gICAgUmVzb3VyY2VzOiB7XG4gICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgfSxcbiAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXR3by1zdGFja3Mtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBleHBlY3QobmVzdGVkU3RhY2tzKS50b0VxdWFsKHtcbiAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgZGVwbG95ZWRUZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBHcmFuZENoaWxkU3RhY2tBOiB7XG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEdyYW5kQ2hpbGRTdGFja0I6IHtcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgU29tZVJlc291cmNlOiB7XG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFByb3BlcnR5OiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZ2VuZXJhdGVkVGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgR3JhbmRDaGlsZFN0YWNrQToge1xuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBHcmFuZENoaWxkU3RhY2tCOiB7XG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBQcm9wZXJ0eTogJ25ldy12YWx1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG5lc3RlZFN0YWNrVGVtcGxhdGVzOiB7XG4gICAgICAgIEdyYW5kQ2hpbGRTdGFja0E6IHtcbiAgICAgICAgICBkZXBsb3llZFRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgU29tZVJlc291cmNlOiB7XG4gICAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgUHJvcGVydHk6ICdvbGQtdmFsdWUnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBnZW5lcmF0ZWRUZW1wbGF0ZToge1xuICAgICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIFByb3BlcnR5OiAnbmV3LXZhbHVlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6OlNvbWV0aGluZycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbmVzdGVkU3RhY2tUZW1wbGF0ZXM6IHt9LFxuICAgICAgICAgIHBoeXNpY2FsTmFtZTogJ0dyYW5kQ2hpbGRTdGFja0EnLFxuICAgICAgICB9LFxuICAgICAgICBHcmFuZENoaWxkU3RhY2tCOiB7XG4gICAgICAgICAgZGVwbG95ZWRUZW1wbGF0ZToge1xuICAgICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIFByb3BlcnR5OiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6OlNvbWV0aGluZycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZ2VuZXJhdGVkVGVtcGxhdGU6IHtcbiAgICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBQcm9wZXJ0eTogJ25ldy12YWx1ZScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIG5lc3RlZFN0YWNrVGVtcGxhdGVzOiB7fSxcbiAgICAgICAgICBwaHlzaWNhbE5hbWU6ICdHcmFuZENoaWxkU3RhY2tCJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwaHlzaWNhbE5hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgfSxcbiAgfSk7XG59KTtcblxudGVzdCgncmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3MoKSBvbiBhbiB1bmRlcGxveWVkIHBhcmVudCBzdGFjayB3aXRoIGFuIChhbHNvIHVuZGVwbG95ZWQpIG5lc3RlZCBzdGFjayB3b3JrcycsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3QgY2ZuU3RhY2sgPSBuZXcgRmFrZUNsb3VkZm9ybWF0aW9uU3RhY2soe1xuICAgIHN0YWNrTmFtZTogJ1VuZGVwbG95ZWRQYXJlbnQnLFxuICAgIHN0YWNrSWQ6ICdTdGFja0lkJyxcbiAgfSk7XG4gIENsb3VkRm9ybWF0aW9uU3RhY2subG9va3VwID0gYXN5bmMgKF9jZm4sIF9zdGFja05hbWU6IHN0cmluZykgPT4ge1xuICAgIGNmblN0YWNrLnRlbXBsYXRlID0gYXN5bmMgKCkgPT4gKHt9KTtcblxuICAgIHJldHVybiBjZm5TdGFjaztcbiAgfTtcbiAgY29uc3Qgcm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICBzdGFja05hbWU6ICdVbmRlcGxveWVkUGFyZW50JyxcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utb25lLXN0YWNrLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IGRlcGxveWVkVGVtcGxhdGUgPSAoYXdhaXQgZGVwbG95bWVudHMucmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3Mocm9vdFN0YWNrKSkuZGVwbG95ZWRSb290VGVtcGxhdGU7XG4gIGNvbnN0IG5lc3RlZFN0YWNrcyA9IChhd2FpdCBkZXBsb3ltZW50cy5yZWFkQ3VycmVudFRlbXBsYXRlV2l0aE5lc3RlZFN0YWNrcyhyb290U3RhY2spKS5uZXN0ZWRTdGFja3M7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QoZGVwbG95ZWRUZW1wbGF0ZSkudG9FcXVhbCh7fSk7XG4gIGV4cGVjdChuZXN0ZWRTdGFja3MpLnRvRXF1YWwoe1xuICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICBkZXBsb3llZFRlbXBsYXRlOiB7fSxcbiAgICAgIGdlbmVyYXRlZFRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFNvbWVSZXNvdXJjZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U29tZXRoaW5nJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcGVydHk6ICduZXctdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG5lc3RlZFN0YWNrVGVtcGxhdGVzOiB7XG4gICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgZGVwbG95ZWRUZW1wbGF0ZToge30sXG4gICAgICAgICAgZ2VuZXJhdGVkVGVtcGxhdGU6IHtcbiAgICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTb21ldGhpbmcnLFxuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIFByb3BlcnR5OiAnbmV3LXZhbHVlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIG5lc3RlZFN0YWNrVGVtcGxhdGVzOiB7fSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59KTtcblxudGVzdCgncmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3MoKSBjYWNoZXMgY2FsbHMgdG8gbGlzdFN0YWNrUmVzb3VyY2VzKCknLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGdpdmVuU3RhY2tzKHtcbiAgICAnKic6IHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE5lc3RlZFN0YWNrQToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBOZXN0ZWRTdGFja0I6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGNvbnN0IHJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgc3RhY2tOYW1lOiAnQ2FjaGluZ1Jvb3QnLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTmVzdGVkU3RhY2tBOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIE5lc3RlZFN0YWNrQjoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXJlc291cmNlLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAnQ2FjaGluZ1Jvb3QnLFxuICAgIHN0YWNrU3VtbWFyeU9mKFxuICAgICAgJ05lc3RlZFN0YWNrQScsXG4gICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgJ2Fybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay9vbmUtcmVzb3VyY2Utc3RhY2svYWJjZCcsXG4gICAgKSxcbiAgICBzdGFja1N1bW1hcnlPZihcbiAgICAgICdOZXN0ZWRTdGFja0InLFxuICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svb25lLXJlc291cmNlLXN0YWNrL2FiY2QnLFxuICAgICksXG4gICk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3ltZW50cy5yZWFkQ3VycmVudFRlbXBsYXRlV2l0aE5lc3RlZFN0YWNrcyhyb290U3RhY2spO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrUmVzb3VyY2VzQ29tbWFuZCwgMSk7XG59KTtcblxudGVzdCgncm9sbGJhY2sgc3RhY2sgYXNzdW1lcyByb2xlIGlmIG5lY2Vzc2FyeScsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgbW9ja0ZvckVudmlyb25tZW50ID0gamVzdC5mbigpLm1vY2tJbXBsZW1lbnRhdGlvbigoKSA9PiB7XG4gICAgcmV0dXJuIHsgc2RrIH07XG4gIH0pO1xuICBzZGtQcm92aWRlci5mb3JFbnZpcm9ubWVudCA9IG1vY2tGb3JFbnZpcm9ubWVudDtcbiAgZ2l2ZW5TdGFja3Moe1xuICAgICcqJzogeyB0ZW1wbGF0ZToge30gfSxcbiAgfSk7XG5cbiAgYXdhaXQgZGVwbG95bWVudHMucm9sbGJhY2tTdGFjayh7XG4gICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdib29wJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgYXNzdW1lUm9sZUFybjogJ2Jsb29wOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgIH0sXG4gICAgfSksXG4gICAgdmFsaWRhdGVCb290c3RyYXBTdGFja1ZlcnNpb246IGZhbHNlLFxuICB9KTtcblxuICBleHBlY3QobW9ja0ZvckVudmlyb25tZW50KS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICBhc3N1bWVSb2xlQXJuOiAnYmxvb3A6aGVyZToxMjM0NTY3ODkwMTInLFxuICAgIH0pLFxuICApO1xufSk7XG5cbnRlc3QoJ3JvbGxiYWNrIHN0YWNrIGFsbG93cyByb2xsaW5nIGJhY2sgZnJvbSBVUERBVEVfRkFJTEVEJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBnaXZlblN0YWNrcyh7XG4gICAgJyonOiB7IHRlbXBsYXRlOiB7fSwgc3RhY2tTdGF0dXM6ICdVUERBVEVfRkFJTEVEJyB9LFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveW1lbnRzLnJvbGxiYWNrU3RhY2soe1xuICAgIHN0YWNrOiB0ZXN0U3RhY2soeyBzdGFja05hbWU6ICdib29wJyB9KSxcbiAgICB2YWxpZGF0ZUJvb3RzdHJhcFN0YWNrVmVyc2lvbjogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFJvbGxiYWNrU3RhY2tDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCdyb2xsYmFjayBzdGFjayBhbGxvd3MgY29udGludWUgcm9sbGJhY2sgZnJvbSBVUERBVEVfUk9MTEJBQ0tfRkFJTEVEJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBnaXZlblN0YWNrcyh7XG4gICAgJyonOiB7IHRlbXBsYXRlOiB7fSwgc3RhY2tTdGF0dXM6ICdVUERBVEVfUk9MTEJBQ0tfRkFJTEVEJyB9LFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveW1lbnRzLnJvbGxiYWNrU3RhY2soe1xuICAgIHN0YWNrOiB0ZXN0U3RhY2soeyBzdGFja05hbWU6ICdib29wJyB9KSxcbiAgICB2YWxpZGF0ZUJvb3RzdHJhcFN0YWNrVmVyc2lvbjogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENvbnRpbnVlVXBkYXRlUm9sbGJhY2tDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCdyb2xsYmFjayBzdGFjayBmYWlscyBpbiBVUERBVEVfQ09NUExFVEUgc3RhdGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGdpdmVuU3RhY2tzKHtcbiAgICAnKic6IHsgdGVtcGxhdGU6IHt9LCBzdGFja1N0YXR1czogJ1VQREFURV9DT01QTEVURScgfSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRlcGxveW1lbnRzLnJvbGxiYWNrU3RhY2soe1xuICAgIHN0YWNrOiB0ZXN0U3RhY2soeyBzdGFja05hbWU6ICdib29wJyB9KSxcbiAgICB2YWxpZGF0ZUJvb3RzdHJhcFN0YWNrVmVyc2lvbjogZmFsc2UsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHJlc3BvbnNlLm5vdEluUm9sbGJhY2thYmxlU3RhdGUpLnRvQmUodHJ1ZSk7XG59KTtcblxudGVzdCgnY29udGludWUgcm9sbGJhY2sgc3RhY2sgd2l0aCBmb3JjZSBpZ25vcmVzIGFueSBmYWlsZWQgcmVzb3VyY2VzJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBnaXZlblN0YWNrcyh7XG4gICAgJyonOiB7IHRlbXBsYXRlOiB7fSwgc3RhY2tTdGF0dXM6ICdVUERBVEVfUk9MTEJBQ0tfRkFJTEVEJyB9LFxuICB9KTtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tFdmVudHNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tFdmVudHM6IFtcbiAgICAgIHtcbiAgICAgICAgRXZlbnRJZDogJ2FzZGYnLFxuICAgICAgICBTdGFja0lkOiAnc3RhY2svTXlTdGFjaycsXG4gICAgICAgIFN0YWNrTmFtZTogJ015U3RhY2snLFxuICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKCksXG4gICAgICAgIExvZ2ljYWxSZXNvdXJjZUlkOiAnWHl6JyxcbiAgICAgICAgUmVzb3VyY2VTdGF0dXM6ICdVUERBVEVfRkFJTEVEJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3ltZW50cy5yb2xsYmFja1N0YWNrKHtcbiAgICBzdGFjazogdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiAnYm9vcCcgfSksXG4gICAgdmFsaWRhdGVCb290c3RyYXBTdGFja1ZlcnNpb246IGZhbHNlLFxuICAgIGZvcmNlOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoQ29udGludWVVcGRhdGVSb2xsYmFja0NvbW1hbmQsIHtcbiAgICBSZXNvdXJjZXNUb1NraXA6IFsnWHl6J10sXG4gICAgU3RhY2tOYW1lOiAnYm9vcCcsXG4gICAgQ2xpZW50UmVxdWVzdFRva2VuOiBleHBlY3QuYW55dGhpbmcoKSxcbiAgfSk7XG59KTtcblxudGVzdCgncmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3MoKSBzdWNjZXNzZnVsbHkgaWdub3JlcyBzdGFja3Mgd2l0aG91dCBtZXRhZGF0YScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3Qgcm9vdFN1bW1hcnkgPSBzdGFja1N1bW1hcnlPZihcbiAgICAnV2l0aE1ldGFkYXRhJyxcbiAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svb25lLXJlc291cmNlLXN0YWNrL2FiY2QnLFxuICApO1xuXG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKCdNZXRhZGF0YVJvb3QnLCByb290U3VtbWFyeSk7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihMaXN0U3RhY2tSZXNvdXJjZXNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tSZXNvdXJjZVN1bW1hcmllczogW3Jvb3RTdW1tYXJ5XSxcbiAgfSk7XG5cbiAgZ2l2ZW5TdGFja3Moe1xuICAgICdNZXRhZGF0YVJvb3QnOiB7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBXaXRoTWV0YWRhdGE6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgJyonOiB7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlNvbWV0aGluZycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFByb3BlcnR5OiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3Qgcm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICBzdGFja05hbWU6ICdNZXRhZGF0YVJvb3QnLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgV2l0aG91dE1ldGFkYXRhOiB7XG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgIH0sXG4gICAgICAgIFdpdGhFbXB0eU1ldGFkYXRhOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHt9LFxuICAgICAgICB9LFxuICAgICAgICBXaXRoTWV0YWRhdGE6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCBkZXBsb3llZFRlbXBsYXRlID0gKGF3YWl0IGRlcGxveW1lbnRzLnJlYWRDdXJyZW50VGVtcGxhdGVXaXRoTmVzdGVkU3RhY2tzKHJvb3RTdGFjaykpLmRlcGxveWVkUm9vdFRlbXBsYXRlO1xuICBjb25zdCBuZXN0ZWRTdGFja3MgPSAoYXdhaXQgZGVwbG95bWVudHMucmVhZEN1cnJlbnRUZW1wbGF0ZVdpdGhOZXN0ZWRTdGFja3Mocm9vdFN0YWNrKSkubmVzdGVkU3RhY2tzO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KGRlcGxveWVkVGVtcGxhdGUpLnRvRXF1YWwoe1xuICAgIFJlc291cmNlczoge1xuICAgICAgV2l0aE1ldGFkYXRhOiB7XG4gICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtcmVzb3VyY2Utc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICBleHBlY3Qocm9vdFN0YWNrLnRlbXBsYXRlKS50b0VxdWFsKHtcbiAgICBSZXNvdXJjZXM6IHtcbiAgICAgIFdpdGhvdXRNZXRhZGF0YToge1xuICAgICAgICAvLyBVbmNoYW5nZWRcbiAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgV2l0aEVtcHR5TWV0YWRhdGE6IHtcbiAgICAgICAgLy8gVW5jaGFuZ2VkXG4gICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICB9LFxuICAgICAgICBNZXRhZGF0YToge30sXG4gICAgICB9LFxuICAgICAgV2l0aE1ldGFkYXRhOiB7XG4gICAgICAgIC8vIENoYW5nZWRcbiAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgIH0sXG4gICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1yZXNvdXJjZS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGV4cGVjdChuZXN0ZWRTdGFja3MpLnRvRXF1YWwoe1xuICAgIFdpdGhNZXRhZGF0YToge1xuICAgICAgZGVwbG95ZWRUZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcGVydHk6ICdvbGQtdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlNvbWV0aGluZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBnZW5lcmF0ZWRUZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBTb21lUmVzb3VyY2U6IHtcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcGVydHk6ICduZXctdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlNvbWV0aGluZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwaHlzaWNhbE5hbWU6ICdvbmUtcmVzb3VyY2Utc3RhY2snLFxuICAgICAgbmVzdGVkU3RhY2tUZW1wbGF0ZXM6IHt9LFxuICAgIH0sXG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdzdGFja0V4aXN0cycsICgpID0+IHtcbiAgdGVzdC5lYWNoKFtcbiAgICBbZmFsc2UsICdkZXBsb3k6aGVyZToxMjM0NTY3ODkwMTInXSxcbiAgICBbdHJ1ZSwgJ2xvb2t1cDpoZXJlOjEyMzQ1Njc4OTAxMiddLFxuICBdKSgndXNlcyBsb29rdXAgcm9sZSBpZiByZXF1ZXN0ZWQ6ICVwJywgYXN5bmMgKHRyeUxvb2t1cFJvbGUsIGV4cGVjdGVkUm9sZUFybikgPT4ge1xuICAgIGNvbnN0IG1vY2tGb3JFbnZpcm9ubWVudCA9IGplc3QuZm4oKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4geyByZXR1cm4geyBzZGs6IG5ldyBNb2NrU2RrKCkgfTsgfSk7XG4gICAgc2RrUHJvdmlkZXIuZm9yRW52aXJvbm1lbnQgPSBtb2NrRm9yRW52aXJvbm1lbnQ7XG4gICAgZ2l2ZW5TdGFja3Moe1xuICAgICAgJyonOiB7IHRlbXBsYXRlOiB7fSB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGVwbG95bWVudHMuc3RhY2tFeGlzdHMoe1xuICAgICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ2Jvb3AnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgYXNzdW1lUm9sZUFybjogJ2RlcGxveToke0FXUzo6UmVnaW9ufToke0FXUzo6QWNjb3VudElkfScsXG4gICAgICAgICAgbG9va3VwUm9sZToge1xuICAgICAgICAgICAgYXJuOiAnbG9va3VwOiR7QVdTOjpSZWdpb259OiR7QVdTOjpBY2NvdW50SWR9JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB0cnlMb29rdXBSb2xlLFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KHJlc3VsdCkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChtb2NrRm9yRW52aXJvbm1lbnQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKGV4cGVjdC5hbnl0aGluZygpLCBleHBlY3QuYW55dGhpbmcoKSwgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgYXNzdW1lUm9sZUFybjogZXhwZWN0ZWRSb2xlQXJuLFxuICAgIH0pKTtcbiAgfSk7XG59KTtcblxuZnVuY3Rpb24gcHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoc3RhY2tOYW1lOiBzdHJpbmcsIC4uLml0ZW1zOiBTdGFja1Jlc291cmNlU3VtbWFyeVtdKSB7XG4gIGlmICghY3VycmVudENmblN0YWNrUmVzb3VyY2VzW3N0YWNrTmFtZV0pIHtcbiAgICBjdXJyZW50Q2ZuU3RhY2tSZXNvdXJjZXNbc3RhY2tOYW1lXSA9IFtdO1xuICB9XG5cbiAgY3VycmVudENmblN0YWNrUmVzb3VyY2VzW3N0YWNrTmFtZV0ucHVzaCguLi5pdGVtcyk7XG59XG5cbmZ1bmN0aW9uIHN0YWNrU3VtbWFyeU9mKGxvZ2ljYWxJZDogc3RyaW5nLCByZXNvdXJjZVR5cGU6IHN0cmluZywgcGh5c2ljYWxSZXNvdXJjZUlkOiBzdHJpbmcpOiBTdGFja1Jlc291cmNlU3VtbWFyeSB7XG4gIHJldHVybiB7XG4gICAgTG9naWNhbFJlc291cmNlSWQ6IGxvZ2ljYWxJZCxcbiAgICBQaHlzaWNhbFJlc291cmNlSWQ6IHBoeXNpY2FsUmVzb3VyY2VJZCxcbiAgICBSZXNvdXJjZVR5cGU6IHJlc291cmNlVHlwZSxcbiAgICBSZXNvdXJjZVN0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgIExhc3RVcGRhdGVkVGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBnaXZlblN0YWNrcyhzdGFja3M6IFJlY29yZDxzdHJpbmcsIHsgdGVtcGxhdGU6IGFueTsgc3RhY2tTdGF0dXM/OiBzdHJpbmcgfT4pIHtcbiAgamVzdC5zcHlPbihDbG91ZEZvcm1hdGlvblN0YWNrLCAnbG9va3VwJykubW9ja0ltcGxlbWVudGF0aW9uKGFzeW5jIChfLCBzdGFja05hbWUpID0+IHtcbiAgICBsZXQgc3RhY2sgPSBzdGFja3Nbc3RhY2tOYW1lXTtcbiAgICBpZiAoIXN0YWNrKSB7XG4gICAgICBzdGFjayA9IHN0YWNrc1snKiddO1xuICAgIH1cbiAgICBpZiAoc3RhY2spIHtcbiAgICAgIGNvbnN0IGNmblN0YWNrID0gbmV3IEZha2VDbG91ZGZvcm1hdGlvblN0YWNrKHtcbiAgICAgICAgc3RhY2tOYW1lLFxuICAgICAgICBzdGFja0lkOiBgc3RhY2svJHtzdGFja05hbWV9YCxcbiAgICAgICAgc3RhY2tTdGF0dXM6IHN0YWNrLnN0YWNrU3RhdHVzLFxuICAgICAgfSk7XG4gICAgICBjZm5TdGFjay5zZXRUZW1wbGF0ZShzdGFjay50ZW1wbGF0ZSk7XG4gICAgICByZXR1cm4gY2ZuU3RhY2s7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgRmFrZUNsb3VkZm9ybWF0aW9uU3RhY2soeyBzdGFja05hbWUgfSk7XG4gICAgfVxuICB9KTtcbn1cbiJdfQ==