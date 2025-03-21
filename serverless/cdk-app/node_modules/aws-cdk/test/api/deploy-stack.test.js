"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const api_1 = require("../../lib/api");
const environment_resources_1 = require("../../lib/api/environment-resources");
const common_1 = require("../../lib/api/hotswap/common");
const hotswap_deployments_1 = require("../../lib/api/hotswap-deployments");
const logging_1 = require("../../lib/logging");
const util_1 = require("../util");
const mock_sdk_1 = require("../util/mock-sdk");
jest.mock('../../lib/api/hotswap-deployments');
jest.mock('../../lib/api/util/checks', () => ({
    determineAllowCrossAccountAssetPublishing: jest.fn().mockResolvedValue(true),
}));
const FAKE_STACK = (0, util_1.testStack)({
    stackName: 'withouterrors',
});
const FAKE_STACK_WITH_PARAMETERS = (0, util_1.testStack)({
    stackName: 'withparameters',
    template: {
        Parameters: {
            HasValue: { Type: 'String' },
            HasDefault: { Type: 'String', Default: 'TheDefault' },
            OtherParameter: { Type: 'String' },
        },
    },
});
const FAKE_STACK_TERMINATION_PROTECTION = (0, util_1.testStack)({
    stackName: 'termination-protection',
    template: util_1.DEFAULT_FAKE_TEMPLATE,
    terminationProtection: true,
});
const baseResponse = {
    StackName: 'mock-stack-name',
    StackId: 'mock-stack-id',
    CreationTime: new Date(),
    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
    EnableTerminationProtection: false,
};
let sdk;
let sdkProvider;
beforeEach(() => {
    sdkProvider = new mock_sdk_1.MockSdkProvider();
    sdk = new mock_sdk_1.MockSdk();
    sdk.getUrlSuffix = () => Promise.resolve('amazonaws.com');
    jest.resetAllMocks();
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        // First call, no stacks exis
        .resolvesOnce({
        Stacks: [],
    })
        // Second call, stack has been created
        .resolves({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                StackStatusReason: 'It is magic',
                EnableTerminationProtection: false,
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).resolves({
        Status: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
        Changes: [],
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.GetTemplateCommand).resolves({
        TemplateBody: JSON.stringify(util_1.DEFAULT_FAKE_TEMPLATE),
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.UpdateTerminationProtectionCommand).resolves({
        StackId: 'stack-id',
    });
});
function standardDeployStackArguments() {
    const resolvedEnvironment = (0, mock_sdk_1.mockResolvedEnvironment)();
    return {
        stack: FAKE_STACK,
        sdk,
        sdkProvider,
        resolvedEnvironment,
        envResources: new environment_resources_1.NoBootstrapStackEnvironmentResources(resolvedEnvironment, sdk),
    };
}
test("calls tryHotswapDeployment() if 'hotswap' is `HotswapMode.CLASSIC`", async () => {
    // WHEN
    const spyOnSdk = jest.spyOn(sdk, 'appendCustomUserAgent');
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: common_1.HotswapMode.FALL_BACK,
        extraUserAgent: 'extra-user-agent',
    });
    // THEN
    expect(hotswap_deployments_1.tryHotswapDeployment).toHaveBeenCalled();
    // check that the extra User-Agent is honored
    expect(spyOnSdk).toHaveBeenCalledWith('extra-user-agent');
    // check that the fallback has been called if hotswapping failed
    expect(spyOnSdk).toHaveBeenCalledWith('cdk-hotswap/fallback');
});
test("calls tryHotswapDeployment() if 'hotswap' is `HotswapMode.HOTSWAP_ONLY`", async () => {
    // we need the first call to return something in the Stacks prop,
    // otherwise the access to `stackId` will fail
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    const spyOnSdk = jest.spyOn(sdk, 'appendCustomUserAgent');
    // WHEN
    const deployStackResult = await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: common_1.HotswapMode.HOTSWAP_ONLY,
        extraUserAgent: 'extra-user-agent',
        force: true, // otherwise, deployment would be skipped
    });
    // THEN
    expect(deployStackResult.type === 'did-deploy-stack' && deployStackResult.noOp).toEqual(true);
    expect(hotswap_deployments_1.tryHotswapDeployment).toHaveBeenCalled();
    // check that the extra User-Agent is honored
    expect(spyOnSdk).toHaveBeenCalledWith('extra-user-agent');
    // check that the fallback has not been called if hotswapping failed
    expect(spyOnSdk).not.toHaveBeenCalledWith('cdk-hotswap/fallback');
});
test('correctly passes CFN parameters when hotswapping', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: common_1.HotswapMode.FALL_BACK,
        parameters: {
            A: 'A-value',
            B: 'B=value',
            C: undefined,
            D: '',
        },
    });
    // THEN
    expect(hotswap_deployments_1.tryHotswapDeployment).toHaveBeenCalledWith(expect.anything(), { A: 'A-value', B: 'B=value' }, expect.anything(), expect.anything(), common_1.HotswapMode.FALL_BACK, expect.anything());
});
test('correctly passes SSM parameters when hotswapping', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [{ ParameterKey: 'SomeParameter', ParameterValue: 'ParameterName', ResolvedValue: 'SomeValue' }],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: (0, util_1.testStack)({
            stackName: 'stack',
            template: {
                Parameters: {
                    SomeParameter: {
                        Type: 'AWS::SSM::Parameter::Value<String>',
                        Default: 'ParameterName',
                    },
                },
            },
        }),
        hotswap: common_1.HotswapMode.FALL_BACK,
        usePreviousParameters: true,
    });
    // THEN
    expect(hotswap_deployments_1.tryHotswapDeployment).toHaveBeenCalledWith(expect.anything(), { SomeParameter: 'SomeValue' }, expect.anything(), expect.anything(), common_1.HotswapMode.FALL_BACK, expect.anything());
});
test('call CreateStack when method=direct and the stack doesnt exist yet', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'direct' },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateStackCommand);
});
test('call UpdateStack when method=direct and the stack exists already', async () => {
    // WHEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'direct' },
        force: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.UpdateStackCommand);
});
test('method=direct and no updates to be performed', async () => {
    const error = new Error('No updates are to be performed.');
    error.name = 'ValidationError';
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.UpdateStackCommand).rejectsOnce(error);
    // WHEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    const ret = await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'direct' },
        force: true,
    });
    // THEN
    expect(ret).toEqual(expect.objectContaining({ noOp: true }));
});
test("does not call tryHotswapDeployment() if 'hotswap' is false", async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: undefined,
    });
    // THEN
    expect(hotswap_deployments_1.tryHotswapDeployment).not.toHaveBeenCalled();
});
test("rollback still defaults to enabled even if 'hotswap' is enabled", async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: common_1.HotswapMode.FALL_BACK,
        rollback: undefined,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, expect.objectContaining({
        DisableRollback: true,
    }));
});
test("rollback defaults to enabled if 'hotswap' is undefined", async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        hotswap: undefined,
        rollback: undefined,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ExecuteChangeSetCommand, 1);
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, expect.objectContaining({
        DisableRollback: true,
    }));
});
test('do deploy executable change set with 0 changes', async () => {
    // WHEN
    const ret = await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(ret.type === 'did-deploy-stack' && ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('correctly passes CFN parameters, ignoring ones with empty values', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        parameters: {
            A: 'A-value',
            B: 'B=value',
            C: undefined,
            D: '',
        },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        Parameters: [
            { ParameterKey: 'A', ParameterValue: 'A-value' },
            { ParameterKey: 'B', ParameterValue: 'B=value' },
        ],
        TemplateBody: expect.any(String),
    });
});
test('reuse previous parameters if requested', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [
                    { ParameterKey: 'HasValue', ParameterValue: 'TheValue' },
                    { ParameterKey: 'HasDefault', ParameterValue: 'TheOldValue' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_WITH_PARAMETERS,
        parameters: {
            OtherParameter: 'SomeValue',
        },
        usePreviousParameters: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        Parameters: [
            { ParameterKey: 'HasValue', UsePreviousValue: true },
            { ParameterKey: 'HasDefault', UsePreviousValue: true },
            { ParameterKey: 'OtherParameter', ParameterValue: 'SomeValue' },
        ],
    });
});
describe('ci=true', () => {
    let stderrMock;
    let stdoutMock;
    beforeEach(() => {
        (0, logging_1.setCI)(true);
        jest.resetAllMocks();
        stderrMock = jest.spyOn(process.stderr, 'write').mockImplementation(() => {
            return true;
        });
        stdoutMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => {
            return true;
        });
    });
    afterEach(() => {
        (0, logging_1.setCI)(false);
    });
    test('output written to stdout', async () => {
        // GIVEN
        await (0, api_1.deployStack)({
            ...standardDeployStackArguments(),
        });
        // THEN
        expect(stderrMock.mock.calls).toEqual([]);
        expect(stdoutMock.mock.calls).not.toEqual([]);
    });
});
test('do not reuse previous parameters if not requested', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [
                    { ParameterKey: 'HasValue', ParameterValue: 'TheValue' },
                    { ParameterKey: 'HasDefault', ParameterValue: 'TheOldValue' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_WITH_PARAMETERS,
        parameters: {
            HasValue: 'SomeValue',
            OtherParameter: 'SomeValue',
        },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.UPDATE,
        Parameters: [
            { ParameterKey: 'HasValue', ParameterValue: 'SomeValue' },
            { ParameterKey: 'OtherParameter', ParameterValue: 'SomeValue' },
        ],
    });
});
test('throw exception if not enough parameters supplied', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [
                    { ParameterKey: 'HasValue', ParameterValue: 'TheValue' },
                    { ParameterKey: 'HasDefault', ParameterValue: 'TheOldValue' },
                ],
            },
        ],
    });
    // WHEN
    await expect((0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_WITH_PARAMETERS,
        parameters: {
            OtherParameter: 'SomeValue',
        },
    })).rejects.toThrow(/CloudFormation Parameters are missing a value/);
});
test('deploy is skipped if template did not change', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('deploy is skipped if parameters are the same', async () => {
    // GIVEN
    givenTemplateIs(FAKE_STACK_WITH_PARAMETERS.template);
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [
                    { ParameterKey: 'HasValue', ParameterValue: 'TheValue' },
                    { ParameterKey: 'HasDefault', ParameterValue: 'TheOldValue' },
                    { ParameterKey: 'OtherParameter', ParameterValue: 'OtherParameter' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_WITH_PARAMETERS,
        parameters: {},
        usePreviousParameters: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
});
test('deploy is not skipped if parameters are different', async () => {
    // GIVEN
    givenTemplateIs(FAKE_STACK_WITH_PARAMETERS.template);
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Parameters: [
                    { ParameterKey: 'HasValue', ParameterValue: 'TheValue' },
                    { ParameterKey: 'HasDefault', ParameterValue: 'TheOldValue' },
                    { ParameterKey: 'OtherParameter', ParameterValue: 'OtherParameter' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_WITH_PARAMETERS,
        parameters: {
            HasValue: 'NewValue',
        },
        usePreviousParameters: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.UPDATE,
        Parameters: [
            { ParameterKey: 'HasValue', ParameterValue: 'NewValue' },
            { ParameterKey: 'HasDefault', UsePreviousValue: true },
            { ParameterKey: 'OtherParameter', UsePreviousValue: true },
        ],
    });
});
test('deploy is skipped if notificationArns are the same', async () => {
    // GIVEN
    givenTemplateIs(FAKE_STACK.template);
    givenStackExists({
        NotificationARNs: ['arn:aws:sns:bermuda-triangle-1337:123456789012:TestTopic'],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK,
        notificationArns: ['arn:aws:sns:bermuda-triangle-1337:123456789012:TestTopic'],
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
});
test('deploy is not skipped if notificationArns are different', async () => {
    // GIVEN
    givenTemplateIs(FAKE_STACK.template);
    givenStackExists({
        NotificationARNs: ['arn:aws:sns:bermuda-triangle-1337:123456789012:TestTopic'],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK,
        notificationArns: ['arn:aws:sns:bermuda-triangle-1337:123456789012:MagicTopic'],
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
});
test('if existing stack failed to create, it is deleted and recreated', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE,
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.DELETE_COMPLETE,
            },
        ],
    })
        .resolves({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    });
    givenTemplateIs({
        DifferentThan: 'TheDefault',
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.DeleteStackCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.CREATE,
    });
});
test('if existing stack failed to create, it is deleted and recreated even if the template did not change', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE,
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.DELETE_COMPLETE,
            },
        ],
    })
        .resolves({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.DeleteStackCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.CREATE,
    });
});
test('deploy not skipped if template did not change and --force is applied', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        force: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ExecuteChangeSetCommand, 1);
});
test('deploy is skipped if template and tags did not change', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Tags: [
                    { Key: 'Key1', Value: 'Value1' },
                    { Key: 'Key2', Value: 'Value2' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        tags: [
            { Key: 'Key1', Value: 'Value1' },
            { Key: 'Key2', Value: 'Value2' },
        ],
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.DescribeStacksCommand, {
        StackName: 'withouterrors',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.GetTemplateCommand, {
        StackName: 'withouterrors',
        TemplateStage: 'Original',
    });
});
test('deploy not skipped if template did not change but tags changed', async () => {
    // GIVEN
    givenStackExists({
        Tags: [{ Key: 'Key', Value: 'Value' }],
    });
    // WHEN
    const resolvedEnvironment = (0, mock_sdk_1.mockResolvedEnvironment)();
    await (0, api_1.deployStack)({
        stack: FAKE_STACK,
        sdk,
        sdkProvider,
        resolvedEnvironment,
        tags: [
            {
                Key: 'Key',
                Value: 'NewValue',
            },
        ],
        envResources: new environment_resources_1.NoBootstrapStackEnvironmentResources(resolvedEnvironment, sdk),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.DescribeChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.DescribeStacksCommand, {
        StackName: 'withouterrors',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.GetTemplateCommand, {
        StackName: 'withouterrors',
        TemplateStage: 'Original',
    });
});
test('deployStack reports no change if describeChangeSet returns specific error', async () => {
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).resolvesOnce({
        Status: client_cloudformation_1.ChangeSetStatus.FAILED,
        StatusReason: 'No updates are to be performed.',
    });
    // WHEN
    const deployResult = await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(deployResult.type === 'did-deploy-stack' && deployResult.noOp).toEqual(true);
});
test('deploy not skipped if template did not change but one tag removed', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Tags: [
                    { Key: 'Key1', Value: 'Value1' },
                    { Key: 'Key2', Value: 'Value2' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        tags: [{ Key: 'Key1', Value: 'Value1' }],
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.DescribeChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.DescribeStacksCommand, {
        StackName: 'withouterrors',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.GetTemplateCommand, {
        StackName: 'withouterrors',
        TemplateStage: 'Original',
    });
});
test('deploy is not skipped if stack is in a _FAILED state', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.DELETE_FAILED,
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        usePreviousParameters: true,
    }).catch(() => { });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('existing stack in UPDATE_ROLLBACK_COMPLETE state can be updated', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.UPDATE_ROLLBACK_COMPLETE,
            },
        ],
    })
        .resolves({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.UPDATE_COMPLETE,
            },
        ],
    });
    givenTemplateIs({ changed: 123 });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.DeleteStackCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.UPDATE,
    });
});
test('deploy not skipped if template changed', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    givenTemplateIs({ changed: 123 });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('not executed and no error if --no-execute is given', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'change-set', execute: false },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('empty change set is deleted if --execute is given', async () => {
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).resolvesOnce({
        Status: client_cloudformation_1.ChangeSetStatus.FAILED,
        StatusReason: 'No updates are to be performed.',
    });
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'change-set', execute: true },
        force: true, // Necessary to bypass "skip deploy"
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
    //the first deletion is for any existing cdk change sets, the second is for the deleting the new empty change set
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.DeleteChangeSetCommand, 2);
});
test('empty change set is not deleted if --no-execute is given', async () => {
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).resolvesOnce({
        Status: client_cloudformation_1.ChangeSetStatus.FAILED,
        StatusReason: 'No updates are to be performed.',
    });
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [{ ...baseResponse }],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'change-set', execute: false },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.CreateChangeSetCommand);
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
    //the first deletion is for any existing cdk change sets
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.DeleteChangeSetCommand, 1);
});
test('use S3 url for stack deployment if present in Stack Artifact', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: (0, util_1.testStack)({
            stackName: 'withouterrors',
            properties: {
                stackTemplateAssetObjectUrl: 'https://use-me-use-me/',
            },
        }),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        TemplateURL: 'https://use-me-use-me/',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('use REST API S3 url with substituted placeholders if manifest url starts with s3://', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: (0, util_1.testStack)({
            stackName: 'withouterrors',
            properties: {
                stackTemplateAssetObjectUrl: 's3://use-me-use-me-${AWS::AccountId}/object',
            },
        }),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        TemplateURL: 'https://s3.bermuda-triangle-1337.amazonaws.com/use-me-use-me-123456789/object',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('changeset is created when stack exists in REVIEW_IN_PROGRESS status', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                StackStatus: client_cloudformation_1.StackStatus.REVIEW_IN_PROGRESS,
                Tags: [
                    { Key: 'Key1', Value: 'Value1' },
                    { Key: 'Key2', Value: 'Value2' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'change-set', execute: false },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.CREATE,
        StackName: 'withouterrors',
    });
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('changeset is updated when stack exists in CREATE_COMPLETE status', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                Tags: [
                    { Key: 'Key1', Value: 'Value1' },
                    { Key: 'Key2', Value: 'Value2' },
                ],
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        deploymentMethod: { method: 'change-set', execute: false },
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        ...expect.anything,
        ChangeSetType: client_cloudformation_1.ChangeSetType.UPDATE,
        StackName: 'withouterrors',
    });
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.ExecuteChangeSetCommand);
});
test('deploy with termination protection enabled', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK_TERMINATION_PROTECTION,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.UpdateTerminationProtectionCommand, {
        StackName: 'termination-protection',
        EnableTerminationProtection: true,
    });
});
test('updateTerminationProtection not called when termination protection is undefined', async () => {
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.UpdateTerminationProtectionCommand);
});
test('updateTerminationProtection called when termination protection is undefined and stack has termination protection', async () => {
    // GIVEN
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
        Stacks: [
            {
                ...baseResponse,
                EnableTerminationProtection: true,
            },
        ],
    });
    // WHEN
    await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.UpdateTerminationProtectionCommand, {
        StackName: 'withouterrors',
        EnableTerminationProtection: false,
    });
});
describe('disable rollback', () => {
    test('by default, we do not disable rollback (and also do not pass the flag)', async () => {
        // WHEN
        await (0, api_1.deployStack)({
            ...standardDeployStackArguments(),
        });
        // THEN
        expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ExecuteChangeSetCommand, 1);
        expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
            DisableRollback: expect.anything,
            ChangeSetName: expect.any(String),
        });
    });
    test('rollback can be disabled by setting rollback: false', async () => {
        // WHEN
        await (0, api_1.deployStack)({
            ...standardDeployStackArguments(),
            rollback: false,
        });
        // THEN
        expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
            ...expect.anything,
            DisableRollback: true,
        });
    });
});
describe('import-existing-resources', () => {
    test('is disabled by default', async () => {
        // WHEN
        await (0, api_1.deployStack)({
            ...standardDeployStackArguments(),
            deploymentMethod: {
                method: 'change-set',
            },
        });
        // THEN
        expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
            ...expect.anything,
            ImportExistingResources: false,
        });
    });
    test('is added to the CreateChangeSetCommandInput', async () => {
        // WHEN
        await (0, api_1.deployStack)({
            ...standardDeployStackArguments(),
            deploymentMethod: {
                method: 'change-set',
                importExistingResources: true,
            },
        });
        // THEN
        expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
            ...expect.anything,
            ImportExistingResources: true,
        });
    });
});
test.each([
    // From a failed state, a --no-rollback is possible as long as there is not a replacement
    [client_cloudformation_1.StackStatus.UPDATE_FAILED, 'no-rollback', 'no-replacement', 'did-deploy-stack'],
    [client_cloudformation_1.StackStatus.UPDATE_FAILED, 'no-rollback', 'replacement', 'failpaused-need-rollback-first'],
    // Any combination of UPDATE_FAILED & rollback always requires a rollback first
    [client_cloudformation_1.StackStatus.UPDATE_FAILED, 'rollback', 'replacement', 'failpaused-need-rollback-first'],
    [client_cloudformation_1.StackStatus.UPDATE_FAILED, 'rollback', 'no-replacement', 'failpaused-need-rollback-first'],
    // From a stable state, any deployment containing a replacement requires a regular deployment (--rollback)
    [client_cloudformation_1.StackStatus.UPDATE_COMPLETE, 'no-rollback', 'replacement', 'replacement-requires-rollback'],
])('no-rollback and replacement is disadvised: %s %s %s -> %s', async (stackStatus, rollback, replacement, expectedType) => {
    // GIVEN
    givenTemplateIs(FAKE_STACK.template);
    givenStackExists({
        // First call
        StackStatus: stackStatus,
    }, {
        // Later calls
        StackStatus: 'UPDATE_COMPLETE',
    });
    givenChangeSetContainsReplacement(replacement === 'replacement');
    // WHEN
    const result = await (0, api_1.deployStack)({
        ...standardDeployStackArguments(),
        stack: FAKE_STACK,
        rollback: rollback === 'rollback',
        force: true, // Bypass 'canSkipDeploy'
    });
    // THEN
    expect(result.type).toEqual(expectedType);
});
test('assertIsSuccessfulDeployStackResult does what it says', () => {
    expect(() => (0, api_1.assertIsSuccessfulDeployStackResult)({ type: 'replacement-requires-rollback' })).toThrow();
});
/**
 * Set up the mocks so that it looks like the stack exists to start with
 *
 * The last element of this array will be continuously repeated.
 */
function givenStackExists(...overrides) {
    if (overrides.length === 0) {
        overrides = [{}];
    }
    let handler = mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand);
    for (const override of overrides.slice(0, overrides.length - 1)) {
        handler = handler.resolvesOnce({
            Stacks: [{ ...baseResponse, ...override }],
        });
    }
    handler.resolves({
        Stacks: [{ ...baseResponse, ...overrides[overrides.length - 1] }],
    });
}
function givenTemplateIs(template) {
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.GetTemplateCommand).resolves({
        TemplateBody: JSON.stringify(template),
    });
}
function givenChangeSetContainsReplacement(replacement) {
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).resolves({
        Status: 'CREATE_COMPLETE',
        Changes: replacement ? [
            {
                Type: 'Resource',
                ResourceChange: {
                    PolicyAction: 'ReplaceAndDelete',
                    Action: 'Modify',
                    LogicalResourceId: 'Queue4A7E3555',
                    PhysicalResourceId: 'https://sqs.eu-west-1.amazonaws.com/111111111111/Queue4A7E3555-P9C8nK3uv8v6.fifo',
                    ResourceType: 'AWS::SQS::Queue',
                    Replacement: 'True',
                    Scope: ['Properties'],
                    Details: [
                        {
                            Target: {
                                Attribute: 'Properties',
                                Name: 'FifoQueue',
                                RequiresRecreation: 'Always',
                            },
                            Evaluation: 'Static',
                            ChangeSource: 'DirectModification',
                        },
                    ],
                },
            },
        ] : [],
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3ktc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBFQWlCd0M7QUFDeEMsdUNBQXFHO0FBQ3JHLCtFQUEyRjtBQUMzRix5REFBMkQ7QUFDM0QsMkVBQXlFO0FBQ3pFLCtDQUEwQztBQUMxQyxrQ0FBMkQ7QUFDM0QsK0NBTTBCO0FBRTFCLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsQ0FBQztBQUMvQyxJQUFJLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDNUMseUNBQXlDLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztDQUM3RSxDQUFDLENBQUMsQ0FBQztBQUVKLE1BQU0sVUFBVSxHQUFHLElBQUEsZ0JBQVMsRUFBQztJQUMzQixTQUFTLEVBQUUsZUFBZTtDQUMzQixDQUFDLENBQUM7QUFFSCxNQUFNLDBCQUEwQixHQUFHLElBQUEsZ0JBQVMsRUFBQztJQUMzQyxTQUFTLEVBQUUsZ0JBQWdCO0lBQzNCLFFBQVEsRUFBRTtRQUNSLFVBQVUsRUFBRTtZQUNWLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDNUIsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFO1lBQ3JELGNBQWMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7U0FDbkM7S0FDRjtDQUNGLENBQUMsQ0FBQztBQUVILE1BQU0saUNBQWlDLEdBQUcsSUFBQSxnQkFBUyxFQUFDO0lBQ2xELFNBQVMsRUFBRSx3QkFBd0I7SUFDbkMsUUFBUSxFQUFFLDRCQUFxQjtJQUMvQixxQkFBcUIsRUFBRSxJQUFJO0NBQzVCLENBQUMsQ0FBQztBQUVILE1BQU0sWUFBWSxHQUFHO0lBQ25CLFNBQVMsRUFB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LENBQUMsZ0RBQXdCLENBQUMsQ0FBQyxRQUFRLENBQUM7UUFDN0QsTUFBTSxFQUFFLGlCQUFpQjtRQUN6QixPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNyQjtnQkFDRSxJQUFJLEVBQUUsVUFBVTtnQkFDaEIsY0FBYyxFQUFFO29CQUNkLFlBQVksRUFBRSxrQkFBa0I7b0JBQ2hDLE1BQU0sRUFBRSxRQUFRO29CQUNoQixpQkFBaUIsRUFBRSxlQUFlO29CQUNsQyxrQkFBa0IsRUFBRSxrRkFBa0Y7b0JBQ3RHLFlBQVksRUFBRSxpQkFBaUI7b0JBQy9CLFdBQVcsRUFBRSxNQUFNO29CQUNuQixLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUM7b0JBQ3JCLE9BQU8sRUFBRTt3QkFDUDs0QkFDRSxNQUFNLEVBQUU7Z0NBQ04sU0FBUyxFQUFFLFlBQVk7Z0NBQ3ZCLElBQUksRUFBRSxXQUFXO2dDQUNqQixrQkFBa0IsRUFBRSxRQUFROzZCQUM3Qjs0QkFDRCxVQUFVLEVBQUUsUUFBUTs0QkFDcEIsWUFBWSxFQUFFLG9CQUFvQjt5QkFDbkM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQyxDQUFDLEVBQUU7S0FDUCxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ2hhbmdlU2V0U3RhdHVzLFxuICBDaGFuZ2VTZXRUeXBlLFxuICBDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLFxuICB0eXBlIENyZWF0ZUNoYW5nZVNldENvbW1hbmRJbnB1dCxcbiAgQ3JlYXRlU3RhY2tDb21tYW5kLFxuICBEZWxldGVDaGFuZ2VTZXRDb21tYW5kLFxuICBEZWxldGVTdGFja0NvbW1hbmQsXG4gIERlc2NyaWJlQ2hhbmdlU2V0Q29tbWFuZCxcbiAgRGVzY3JpYmVTdGFja3NDb21tYW5kLFxuICBFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCxcbiAgdHlwZSBFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0LFxuICBHZXRUZW1wbGF0ZUNvbW1hbmQsXG4gIHR5cGUgU3RhY2ssXG4gIFN0YWNrU3RhdHVzLFxuICBVcGRhdGVTdGFja0NvbW1hbmQsXG4gIFVwZGF0ZVRlcm1pbmF0aW9uUHJvdGVjdGlvbkNvbW1hbmQsXG59IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBhc3NlcnRJc1N1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdCwgZGVwbG95U3RhY2ssIERlcGxveVN0YWNrT3B0aW9ucyB9IGZyb20gJy4uLy4uL2xpYi9hcGknO1xuaW1wb3J0IHsgTm9Cb290c3RyYXBTdGFja0Vudmlyb25tZW50UmVzb3VyY2VzIH0gZnJvbSAnLi4vLi4vbGliL2FwaS9lbnZpcm9ubWVudC1yZXNvdXJjZXMnO1xuaW1wb3J0IHsgSG90c3dhcE1vZGUgfSBmcm9tICcuLi8uLi9saWIvYXBpL2hvdHN3YXAvY29tbW9uJztcbmltcG9ydCB7IHRyeUhvdHN3YXBEZXBsb3ltZW50IH0gZnJvbSAnLi4vLi4vbGliL2FwaS9ob3Rzd2FwLWRlcGxveW1lbnRzJztcbmltcG9ydCB7IHNldENJIH0gZnJvbSAnLi4vLi4vbGliL2xvZ2dpbmcnO1xuaW1wb3J0IHsgREVGQVVMVF9GQUtFX1RFTVBMQVRFLCB0ZXN0U3RhY2sgfSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCxcbiAgbW9ja1Jlc29sdmVkRW52aXJvbm1lbnQsXG4gIE1vY2tTZGssXG4gIE1vY2tTZGtQcm92aWRlcixcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0LFxufSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuamVzdC5tb2NrKCcuLi8uLi9saWIvYXBpL2hvdHN3YXAtZGVwbG95bWVudHMnKTtcbmplc3QubW9jaygnLi4vLi4vbGliL2FwaS91dGlsL2NoZWNrcycsICgpID0+ICh7XG4gIGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nOiBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUodHJ1ZSksXG59KSk7XG5cbmNvbnN0IEZBS0VfU1RBQ0sgPSB0ZXN0U3RhY2soe1xuICBzdGFja05hbWU6ICd3aXRob3V0ZXJyb3JzJyxcbn0pO1xuXG5jb25zdCBGQUtFX1NUQUNLX1dJVEhfUEFSQU1FVEVSUyA9IHRlc3RTdGFjayh7XG4gIHN0YWNrTmFtZTogJ3dpdGhwYXJhbWV0ZXJzJyxcbiAgdGVtcGxhdGU6IHtcbiAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICBIYXNWYWx1ZTogeyBUeXBlOiAnU3RyaW5nJyB9LFxuICAgICAgSGFzRGVmYXVsdDogeyBUeXBlOiAnU3RyaW5nJywgRGVmYXVsdDogJ1RoZURlZmF1bHQnIH0sXG4gICAgICBPdGhlclBhcmFtZXRlcjogeyBUeXBlOiAnU3RyaW5nJyB9LFxuICAgIH0sXG4gIH0sXG59KTtcblxuY29uc3QgRkFLRV9TVEFDS19URVJNSU5BVElPTl9QUk9URUNUSU9OID0gdGVzdFN0YWNrKHtcbiAgc3RhY2tOYW1lOiAndGVybWluYXRpb24tcHJvdGVjdGlvbicsXG4gIHRlbXBsYXRlOiBERUZBVUxUX0ZBS0VfVEVNUExBVEUsXG4gIHRlcm1pbmF0aW9uUHJvdGVjdGlvbjogdHJ1ZSxcbn0pO1xuXG5jb25zdCBiYXNlUmVzcG9uc2UgPSB7XG4gIFN0YWNrTmFtZTogJ21vY2stc3RhY2stbmFtZScsXG4gIFN0YWNrSWQ6ICdtb2NrLXN0YWNrLWlkJyxcbiAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICBFbmFibGVUZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxufTtcblxubGV0IHNkazogTW9ja1NkaztcbmxldCBzZGtQcm92aWRlcjogTW9ja1Nka1Byb3ZpZGVyO1xuXG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgc2RrUHJvdmlkZXIgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gIHNkayA9IG5ldyBNb2NrU2RrKCk7XG4gIHNkay5nZXRVcmxTdWZmaXggPSAoKSA9PiBQcm9taXNlLnJlc29sdmUoJ2FtYXpvbmF3cy5jb20nKTtcbiAgamVzdC5yZXNldEFsbE1vY2tzKCk7XG5cbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0KCk7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudFxuICAgIC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpXG4gICAgLy8gRmlyc3QgY2FsbCwgbm8gc3RhY2tzIGV4aXNcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW10sXG4gICAgfSlcbiAgICAvLyBTZWNvbmQgY2FsbCwgc3RhY2sgaGFzIGJlZW4gY3JlYXRlZFxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgICAgU3RhY2tTdGF0dXNSZWFzb246ICdJdCBpcyBtYWdpYycsXG4gICAgICAgICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICBTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snLFxuICAgICAgICAgIENyZWF0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZUNoYW5nZVNldENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGF0dXM6IFN0YWNrU3RhdHVzLkNSRUFURV9DT01QTEVURSxcbiAgICBDaGFuZ2VzOiBbXSxcbiAgfSk7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihHZXRUZW1wbGF0ZUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBUZW1wbGF0ZUJvZHk6IEpTT04uc3RyaW5naWZ5KERFRkFVTFRfRkFLRV9URU1QTEFURSksXG4gIH0pO1xuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oVXBkYXRlVGVybWluYXRpb25Qcm90ZWN0aW9uQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrSWQ6ICdzdGFjay1pZCcsXG4gIH0pO1xufSk7XG5cbmZ1bmN0aW9uIHN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKTogRGVwbG95U3RhY2tPcHRpb25zIHtcbiAgY29uc3QgcmVzb2x2ZWRFbnZpcm9ubWVudCA9IG1vY2tSZXNvbHZlZEVudmlyb25tZW50KCk7XG4gIHJldHVybiB7XG4gICAgc3RhY2s6IEZBS0VfU1RBQ0ssXG4gICAgc2RrLFxuICAgIHNka1Byb3ZpZGVyLFxuICAgIHJlc29sdmVkRW52aXJvbm1lbnQsXG4gICAgZW52UmVzb3VyY2VzOiBuZXcgTm9Cb290c3RyYXBTdGFja0Vudmlyb25tZW50UmVzb3VyY2VzKHJlc29sdmVkRW52aXJvbm1lbnQsIHNkayksXG4gIH07XG59XG5cbnRlc3QoXCJjYWxscyB0cnlIb3Rzd2FwRGVwbG95bWVudCgpIGlmICdob3Rzd2FwJyBpcyBgSG90c3dhcE1vZGUuQ0xBU1NJQ2BcIiwgYXN5bmMgKCkgPT4ge1xuICAvLyBXSEVOXG4gIGNvbnN0IHNweU9uU2RrID0gamVzdC5zcHlPbihzZGssICdhcHBlbmRDdXN0b21Vc2VyQWdlbnQnKTtcbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssXG4gICAgZXh0cmFVc2VyQWdlbnQ6ICdleHRyYS11c2VyLWFnZW50JyxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QodHJ5SG90c3dhcERlcGxveW1lbnQpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgLy8gY2hlY2sgdGhhdCB0aGUgZXh0cmEgVXNlci1BZ2VudCBpcyBob25vcmVkXG4gIGV4cGVjdChzcHlPblNkaykudG9IYXZlQmVlbkNhbGxlZFdpdGgoJ2V4dHJhLXVzZXItYWdlbnQnKTtcbiAgLy8gY2hlY2sgdGhhdCB0aGUgZmFsbGJhY2sgaGFzIGJlZW4gY2FsbGVkIGlmIGhvdHN3YXBwaW5nIGZhaWxlZFxuICBleHBlY3Qoc3B5T25TZGspLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdjZGstaG90c3dhcC9mYWxsYmFjaycpO1xufSk7XG5cbnRlc3QoXCJjYWxscyB0cnlIb3Rzd2FwRGVwbG95bWVudCgpIGlmICdob3Rzd2FwJyBpcyBgSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZYFwiLCBhc3luYyAoKSA9PiB7XG4gIC8vIHdlIG5lZWQgdGhlIGZpcnN0IGNhbGwgdG8gcmV0dXJuIHNvbWV0aGluZyBpbiB0aGUgU3RhY2tzIHByb3AsXG4gIC8vIG90aGVyd2lzZSB0aGUgYWNjZXNzIHRvIGBzdGFja0lkYCB3aWxsIGZhaWxcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW3sgLi4uYmFzZVJlc3BvbnNlIH1dLFxuICB9KTtcbiAgY29uc3Qgc3B5T25TZGsgPSBqZXN0LnNweU9uKHNkaywgJ2FwcGVuZEN1c3RvbVVzZXJBZ2VudCcpO1xuICAvLyBXSEVOXG4gIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFksXG4gICAgZXh0cmFVc2VyQWdlbnQ6ICdleHRyYS11c2VyLWFnZW50JyxcbiAgICBmb3JjZTogdHJ1ZSwgLy8gb3RoZXJ3aXNlLCBkZXBsb3ltZW50IHdvdWxkIGJlIHNraXBwZWRcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQudHlwZSA9PT0gJ2RpZC1kZXBsb3ktc3RhY2snICYmIGRlcGxveVN0YWNrUmVzdWx0Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gIGV4cGVjdCh0cnlIb3Rzd2FwRGVwbG95bWVudCkudG9IYXZlQmVlbkNhbGxlZCgpO1xuICAvLyBjaGVjayB0aGF0IHRoZSBleHRyYSBVc2VyLUFnZW50IGlzIGhvbm9yZWRcbiAgZXhwZWN0KHNweU9uU2RrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnZXh0cmEtdXNlci1hZ2VudCcpO1xuICAvLyBjaGVjayB0aGF0IHRoZSBmYWxsYmFjayBoYXMgbm90IGJlZW4gY2FsbGVkIGlmIGhvdHN3YXBwaW5nIGZhaWxlZFxuICBleHBlY3Qoc3B5T25TZGspLm5vdC50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnY2RrLWhvdHN3YXAvZmFsbGJhY2snKTtcbn0pO1xuXG50ZXN0KCdjb3JyZWN0bHkgcGFzc2VzIENGTiBwYXJhbWV0ZXJzIHdoZW4gaG90c3dhcHBpbmcnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBob3Rzd2FwOiBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssXG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgQTogJ0EtdmFsdWUnLFxuICAgICAgQjogJ0I9dmFsdWUnLFxuICAgICAgQzogdW5kZWZpbmVkLFxuICAgICAgRDogJycsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QodHJ5SG90c3dhcERlcGxveW1lbnQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgIGV4cGVjdC5hbnl0aGluZygpLFxuICAgIHsgQTogJ0EtdmFsdWUnLCBCOiAnQj12YWx1ZScgfSxcbiAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssXG4gICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICk7XG59KTtcblxudGVzdCgnY29ycmVjdGx5IHBhc3NlcyBTU00gcGFyYW1ldGVycyB3aGVuIGhvdHN3YXBwaW5nJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgUGFyYW1ldGVyczogW3sgUGFyYW1ldGVyS2V5OiAnU29tZVBhcmFtZXRlcicsIFBhcmFtZXRlclZhbHVlOiAnUGFyYW1ldGVyTmFtZScsIFJlc29sdmVkVmFsdWU6ICdTb21lVmFsdWUnIH1dLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgc3RhY2s6IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdzdGFjaycsXG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgU29tZVBhcmFtZXRlcjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U1NNOjpQYXJhbWV0ZXI6OlZhbHVlPFN0cmluZz4nLFxuICAgICAgICAgICAgRGVmYXVsdDogJ1BhcmFtZXRlck5hbWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pLFxuICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZBTExfQkFDSyxcbiAgICB1c2VQcmV2aW91c1BhcmFtZXRlcnM6IHRydWUsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHRyeUhvdHN3YXBEZXBsb3ltZW50KS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcbiAgICBleHBlY3QuYW55dGhpbmcoKSxcbiAgICB7IFNvbWVQYXJhbWV0ZXI6ICdTb21lVmFsdWUnIH0sXG4gICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICAgZXhwZWN0LmFueXRoaW5nKCksXG4gICAgSG90c3dhcE1vZGUuRkFMTF9CQUNLLFxuICAgIGV4cGVjdC5hbnl0aGluZygpLFxuICApO1xufSk7XG5cbnRlc3QoJ2NhbGwgQ3JlYXRlU3RhY2sgd2hlbiBtZXRob2Q9ZGlyZWN0IGFuZCB0aGUgc3RhY2sgZG9lc250IGV4aXN0IHlldCcsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGRlcGxveW1lbnRNZXRob2Q6IHsgbWV0aG9kOiAnZGlyZWN0JyB9LFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChDcmVhdGVTdGFja0NvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ2NhbGwgVXBkYXRlU3RhY2sgd2hlbiBtZXRob2Q9ZGlyZWN0IGFuZCB0aGUgc3RhY2sgZXhpc3RzIGFscmVhZHknLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW3sgLi4uYmFzZVJlc3BvbnNlIH1dLFxuICB9KTtcblxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGRlcGxveW1lbnRNZXRob2Q6IHsgbWV0aG9kOiAnZGlyZWN0JyB9LFxuICAgIGZvcmNlOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGFja0NvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ21ldGhvZD1kaXJlY3QgYW5kIG5vIHVwZGF0ZXMgdG8gYmUgcGVyZm9ybWVkJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignTm8gdXBkYXRlcyBhcmUgdG8gYmUgcGVyZm9ybWVkLicpO1xuICBlcnJvci5uYW1lID0gJ1ZhbGlkYXRpb25FcnJvcic7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihVcGRhdGVTdGFja0NvbW1hbmQpLnJlamVjdHNPbmNlKGVycm9yKTtcblxuICAvLyBXSEVOXG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGFja3M6IFt7IC4uLmJhc2VSZXNwb25zZSB9XSxcbiAgfSk7XG5cbiAgY29uc3QgcmV0ID0gYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBkZXBsb3ltZW50TWV0aG9kOiB7IG1ldGhvZDogJ2RpcmVjdCcgfSxcbiAgICBmb3JjZTogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmV0KS50b0VxdWFsKGV4cGVjdC5vYmplY3RDb250YWluaW5nKHsgbm9PcDogdHJ1ZSB9KSk7XG59KTtcblxudGVzdChcImRvZXMgbm90IGNhbGwgdHJ5SG90c3dhcERlcGxveW1lbnQoKSBpZiAnaG90c3dhcCcgaXMgZmFsc2VcIiwgYXN5bmMgKCkgPT4ge1xuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgaG90c3dhcDogdW5kZWZpbmVkLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdCh0cnlIb3Rzd2FwRGVwbG95bWVudCkubm90LnRvSGF2ZUJlZW5DYWxsZWQoKTtcbn0pO1xuXG50ZXN0KFwicm9sbGJhY2sgc3RpbGwgZGVmYXVsdHMgdG8gZW5hYmxlZCBldmVuIGlmICdob3Rzd2FwJyBpcyBlbmFibGVkXCIsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGhvdHN3YXA6IEhvdHN3YXBNb2RlLkZBTExfQkFDSyxcbiAgICByb2xsYmFjazogdW5kZWZpbmVkLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFxuICAgIEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLFxuICAgIGV4cGVjdC5vYmplY3RDb250YWluaW5nKHtcbiAgICAgIERpc2FibGVSb2xsYmFjazogdHJ1ZSxcbiAgICB9KSxcbiAgKTtcbn0pO1xuXG50ZXN0KFwicm9sbGJhY2sgZGVmYXVsdHMgdG8gZW5hYmxlZCBpZiAnaG90c3dhcCcgaXMgdW5kZWZpbmVkXCIsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGhvdHN3YXA6IHVuZGVmaW5lZCxcbiAgICByb2xsYmFjazogdW5kZWZpbmVkLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCAxKTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoXG4gICAgRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQsXG4gICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgRGlzYWJsZVJvbGxiYWNrOiB0cnVlLFxuICAgIH0pLFxuICApO1xufSk7XG5cbnRlc3QoJ2RvIGRlcGxveSBleGVjdXRhYmxlIGNoYW5nZSBzZXQgd2l0aCAwIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgY29uc3QgcmV0ID0gYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmV0LnR5cGUgPT09ICdkaWQtZGVwbG95LXN0YWNrJyAmJiByZXQubm9PcCkudG9CZUZhbHN5KCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG59KTtcblxudGVzdCgnY29ycmVjdGx5IHBhc3NlcyBDRk4gcGFyYW1ldGVycywgaWdub3Jpbmcgb25lcyB3aXRoIGVtcHR5IHZhbHVlcycsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgIEE6ICdBLXZhbHVlJyxcbiAgICAgIEI6ICdCPXZhbHVlJyxcbiAgICAgIEM6IHVuZGVmaW5lZCxcbiAgICAgIEQ6ICcnLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgIHsgUGFyYW1ldGVyS2V5OiAnQScsIFBhcmFtZXRlclZhbHVlOiAnQS12YWx1ZScgfSxcbiAgICAgIHsgUGFyYW1ldGVyS2V5OiAnQicsIFBhcmFtZXRlclZhbHVlOiAnQj12YWx1ZScgfSxcbiAgICBdLFxuICAgIFRlbXBsYXRlQm9keTogZXhwZWN0LmFueShTdHJpbmcpLFxuICB9IGFzIENyZWF0ZUNoYW5nZVNldENvbW1hbmRJbnB1dCk7XG59KTtcblxudGVzdCgncmV1c2UgcHJldmlvdXMgcGFyYW1ldGVycyBpZiByZXF1ZXN0ZWQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGFja3M6IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICBQYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgeyBQYXJhbWV0ZXJLZXk6ICdIYXNWYWx1ZScsIFBhcmFtZXRlclZhbHVlOiAnVGhlVmFsdWUnIH0sXG4gICAgICAgICAgeyBQYXJhbWV0ZXJLZXk6ICdIYXNEZWZhdWx0JywgUGFyYW1ldGVyVmFsdWU6ICdUaGVPbGRWYWx1ZScgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHN0YWNrOiBGQUtFX1NUQUNLX1dJVEhfUEFSQU1FVEVSUyxcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICBPdGhlclBhcmFtZXRlcjogJ1NvbWVWYWx1ZScsXG4gICAgfSxcbiAgICB1c2VQcmV2aW91c1BhcmFtZXRlcnM6IHRydWUsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgIHsgUGFyYW1ldGVyS2V5OiAnSGFzVmFsdWUnLCBVc2VQcmV2aW91c1ZhbHVlOiB0cnVlIH0sXG4gICAgICB7IFBhcmFtZXRlcktleTogJ0hhc0RlZmF1bHQnLCBVc2VQcmV2aW91c1ZhbHVlOiB0cnVlIH0sXG4gICAgICB7IFBhcmFtZXRlcktleTogJ090aGVyUGFyYW1ldGVyJywgUGFyYW1ldGVyVmFsdWU6ICdTb21lVmFsdWUnIH0sXG4gICAgXSxcbiAgfSBhcyBDcmVhdGVDaGFuZ2VTZXRDb21tYW5kSW5wdXQpO1xufSk7XG5cbmRlc2NyaWJlKCdjaT10cnVlJywgKCkgPT4ge1xuICBsZXQgc3RkZXJyTW9jazogamVzdC5TcHlJbnN0YW5jZTtcbiAgbGV0IHN0ZG91dE1vY2s6IGplc3QuU3B5SW5zdGFuY2U7XG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIHNldENJKHRydWUpO1xuICAgIGplc3QucmVzZXRBbGxNb2NrcygpO1xuICAgIHN0ZGVyck1vY2sgPSBqZXN0LnNweU9uKHByb2Nlc3Muc3RkZXJyLCAnd3JpdGUnKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4ge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gICAgc3Rkb3V0TW9jayA9IGplc3Quc3B5T24ocHJvY2Vzcy5zdGRvdXQsICd3cml0ZScpLm1vY2tJbXBsZW1lbnRhdGlvbigoKSA9PiB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSk7XG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgc2V0Q0koZmFsc2UpO1xuICB9KTtcbiAgdGVzdCgnb3V0cHV0IHdyaXR0ZW4gdG8gc3Rkb3V0JywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG5cbiAgICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHN0ZGVyck1vY2subW9jay5jYWxscykudG9FcXVhbChbXSk7XG4gICAgZXhwZWN0KHN0ZG91dE1vY2subW9jay5jYWxscykubm90LnRvRXF1YWwoW10pO1xuICB9KTtcbn0pO1xuXG50ZXN0KCdkbyBub3QgcmV1c2UgcHJldmlvdXMgcGFyYW1ldGVycyBpZiBub3QgcmVxdWVzdGVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgUGFyYW1ldGVyczogW1xuICAgICAgICAgIHsgUGFyYW1ldGVyS2V5OiAnSGFzVmFsdWUnLCBQYXJhbWV0ZXJWYWx1ZTogJ1RoZVZhbHVlJyB9LFxuICAgICAgICAgIHsgUGFyYW1ldGVyS2V5OiAnSGFzRGVmYXVsdCcsIFBhcmFtZXRlclZhbHVlOiAnVGhlT2xkVmFsdWUnIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBzdGFjazogRkFLRV9TVEFDS19XSVRIX1BBUkFNRVRFUlMsXG4gICAgcGFyYW1ldGVyczoge1xuICAgICAgSGFzVmFsdWU6ICdTb21lVmFsdWUnLFxuICAgICAgT3RoZXJQYXJhbWV0ZXI6ICdTb21lVmFsdWUnLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgIENoYW5nZVNldFR5cGU6IENoYW5nZVNldFR5cGUuVVBEQVRFLFxuICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgIHsgUGFyYW1ldGVyS2V5OiAnSGFzVmFsdWUnLCBQYXJhbWV0ZXJWYWx1ZTogJ1NvbWVWYWx1ZScgfSxcbiAgICAgIHsgUGFyYW1ldGVyS2V5OiAnT3RoZXJQYXJhbWV0ZXInLCBQYXJhbWV0ZXJWYWx1ZTogJ1NvbWVWYWx1ZScgfSxcbiAgICBdLFxuICB9IGFzIENyZWF0ZUNoYW5nZVNldENvbW1hbmRJbnB1dCk7XG59KTtcblxudGVzdCgndGhyb3cgZXhjZXB0aW9uIGlmIG5vdCBlbm91Z2ggcGFyYW1ldGVycyBzdXBwbGllZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAgICB7IFBhcmFtZXRlcktleTogJ0hhc1ZhbHVlJywgUGFyYW1ldGVyVmFsdWU6ICdUaGVWYWx1ZScgfSxcbiAgICAgICAgICB7IFBhcmFtZXRlcktleTogJ0hhc0RlZmF1bHQnLCBQYXJhbWV0ZXJWYWx1ZTogJ1RoZU9sZFZhbHVlJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4cGVjdChcbiAgICBkZXBsb3lTdGFjayh7XG4gICAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgICBzdGFjazogRkFLRV9TVEFDS19XSVRIX1BBUkFNRVRFUlMsXG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIE90aGVyUGFyYW1ldGVyOiAnU29tZVZhbHVlJyxcbiAgICAgIH0sXG4gICAgfSksXG4gICkucmVqZWN0cy50b1Rocm93KC9DbG91ZEZvcm1hdGlvbiBQYXJhbWV0ZXJzIGFyZSBtaXNzaW5nIGEgdmFsdWUvKTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgaXMgc2tpcHBlZCBpZiB0ZW1wbGF0ZSBkaWQgbm90IGNoYW5nZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgaXMgc2tpcHBlZCBpZiBwYXJhbWV0ZXJzIGFyZSB0aGUgc2FtZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgZ2l2ZW5UZW1wbGF0ZUlzKEZBS0VfU1RBQ0tfV0lUSF9QQVJBTUVURVJTLnRlbXBsYXRlKTtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgIFBhcmFtZXRlcnM6IFtcbiAgICAgICAgICB7IFBhcmFtZXRlcktleTogJ0hhc1ZhbHVlJywgUGFyYW1ldGVyVmFsdWU6ICdUaGVWYWx1ZScgfSxcbiAgICAgICAgICB7IFBhcmFtZXRlcktleTogJ0hhc0RlZmF1bHQnLCBQYXJhbWV0ZXJWYWx1ZTogJ1RoZU9sZFZhbHVlJyB9LFxuICAgICAgICAgIHsgUGFyYW1ldGVyS2V5OiAnT3RoZXJQYXJhbWV0ZXInLCBQYXJhbWV0ZXJWYWx1ZTogJ090aGVyUGFyYW1ldGVyJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgc3RhY2s6IEZBS0VfU1RBQ0tfV0lUSF9QQVJBTUVURVJTLFxuICAgIHBhcmFtZXRlcnM6IHt9LFxuICAgIHVzZVByZXZpb3VzUGFyYW1ldGVyczogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ2RlcGxveSBpcyBub3Qgc2tpcHBlZCBpZiBwYXJhbWV0ZXJzIGFyZSBkaWZmZXJlbnQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGdpdmVuVGVtcGxhdGVJcyhGQUtFX1NUQUNLX1dJVEhfUEFSQU1FVEVSUy50ZW1wbGF0ZSk7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGFja3M6IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICBQYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgeyBQYXJhbWV0ZXJLZXk6ICdIYXNWYWx1ZScsIFBhcmFtZXRlclZhbHVlOiAnVGhlVmFsdWUnIH0sXG4gICAgICAgICAgeyBQYXJhbWV0ZXJLZXk6ICdIYXNEZWZhdWx0JywgUGFyYW1ldGVyVmFsdWU6ICdUaGVPbGRWYWx1ZScgfSxcbiAgICAgICAgICB7IFBhcmFtZXRlcktleTogJ090aGVyUGFyYW1ldGVyJywgUGFyYW1ldGVyVmFsdWU6ICdPdGhlclBhcmFtZXRlcicgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHN0YWNrOiBGQUtFX1NUQUNLX1dJVEhfUEFSQU1FVEVSUyxcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICBIYXNWYWx1ZTogJ05ld1ZhbHVlJyxcbiAgICB9LFxuICAgIHVzZVByZXZpb3VzUGFyYW1ldGVyczogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgQ2hhbmdlU2V0VHlwZTogQ2hhbmdlU2V0VHlwZS5VUERBVEUsXG4gICAgUGFyYW1ldGVyczogW1xuICAgICAgeyBQYXJhbWV0ZXJLZXk6ICdIYXNWYWx1ZScsIFBhcmFtZXRlclZhbHVlOiAnTmV3VmFsdWUnIH0sXG4gICAgICB7IFBhcmFtZXRlcktleTogJ0hhc0RlZmF1bHQnLCBVc2VQcmV2aW91c1ZhbHVlOiB0cnVlIH0sXG4gICAgICB7IFBhcmFtZXRlcktleTogJ090aGVyUGFyYW1ldGVyJywgVXNlUHJldmlvdXNWYWx1ZTogdHJ1ZSB9LFxuICAgIF0sXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgaXMgc2tpcHBlZCBpZiBub3RpZmljYXRpb25Bcm5zIGFyZSB0aGUgc2FtZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgZ2l2ZW5UZW1wbGF0ZUlzKEZBS0VfU1RBQ0sudGVtcGxhdGUpO1xuICBnaXZlblN0YWNrRXhpc3RzKHtcbiAgICBOb3RpZmljYXRpb25BUk5zOiBbJ2Fybjphd3M6c25zOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6VGVzdFRvcGljJ10sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBzdGFjazogRkFLRV9TVEFDSyxcbiAgICBub3RpZmljYXRpb25Bcm5zOiBbJ2Fybjphd3M6c25zOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6VGVzdFRvcGljJ10sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgaXMgbm90IHNraXBwZWQgaWYgbm90aWZpY2F0aW9uQXJucyBhcmUgZGlmZmVyZW50JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBnaXZlblRlbXBsYXRlSXMoRkFLRV9TVEFDSy50ZW1wbGF0ZSk7XG4gIGdpdmVuU3RhY2tFeGlzdHMoe1xuICAgIE5vdGlmaWNhdGlvbkFSTnM6IFsnYXJuOmF3czpzbnM6YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpUZXN0VG9waWMnXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHN0YWNrOiBGQUtFX1NUQUNLLFxuICAgIG5vdGlmaWNhdGlvbkFybnM6IFsnYXJuOmF3czpzbnM6YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpNYWdpY1RvcGljJ10sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ2lmIGV4aXN0aW5nIHN0YWNrIGZhaWxlZCB0byBjcmVhdGUsIGl0IGlzIGRlbGV0ZWQgYW5kIHJlY3JlYXRlZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZClcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5ST0xMQkFDS19DT01QTEVURSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5ERUxFVEVfQ09NUExFVEUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICBnaXZlblRlbXBsYXRlSXMoe1xuICAgIERpZmZlcmVudFRoYW46ICdUaGVEZWZhdWx0JyxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChEZWxldGVTdGFja0NvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgQ2hhbmdlU2V0VHlwZTogQ2hhbmdlU2V0VHlwZS5DUkVBVEUsXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbn0pO1xuXG50ZXN0KCdpZiBleGlzdGluZyBzdGFjayBmYWlsZWQgdG8gY3JlYXRlLCBpdCBpcyBkZWxldGVkIGFuZCByZWNyZWF0ZWQgZXZlbiBpZiB0aGUgdGVtcGxhdGUgZGlkIG5vdCBjaGFuZ2UnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudFxuICAgIC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuUk9MTEJBQ0tfQ09NUExFVEUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuREVMRVRFX0NPTVBMRVRFLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKERlbGV0ZVN0YWNrQ29tbWFuZCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCwge1xuICAgIC4uLmV4cGVjdC5hbnl0aGluZyxcbiAgICBDaGFuZ2VTZXRUeXBlOiBDaGFuZ2VTZXRUeXBlLkNSRUFURSxcbiAgfSBhcyBDcmVhdGVDaGFuZ2VTZXRDb21tYW5kSW5wdXQpO1xufSk7XG5cbnRlc3QoJ2RlcGxveSBub3Qgc2tpcHBlZCBpZiB0ZW1wbGF0ZSBkaWQgbm90IGNoYW5nZSBhbmQgLS1mb3JjZSBpcyBhcHBsaWVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbeyAuLi5iYXNlUmVzcG9uc2UgfV0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBmb3JjZTogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCwgMSk7XG59KTtcblxudGVzdCgnZGVwbG95IGlzIHNraXBwZWQgaWYgdGVtcGxhdGUgYW5kIHRhZ3MgZGlkIG5vdCBjaGFuZ2UnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGFja3M6IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVJlc3BvbnNlLFxuICAgICAgICBUYWdzOiBbXG4gICAgICAgICAgeyBLZXk6ICdLZXkxJywgVmFsdWU6ICdWYWx1ZTEnIH0sXG4gICAgICAgICAgeyBLZXk6ICdLZXkyJywgVmFsdWU6ICdWYWx1ZTInIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICB0YWdzOiBbXG4gICAgICB7IEtleTogJ0tleTEnLCBWYWx1ZTogJ1ZhbHVlMScgfSxcbiAgICAgIHsgS2V5OiAnS2V5MicsIFZhbHVlOiAnVmFsdWUyJyB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kKTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTdGFja3NDb21tYW5kLCB7XG4gICAgU3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gIH0pO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldFRlbXBsYXRlQ29tbWFuZCwge1xuICAgIFN0YWNrTmFtZTogJ3dpdGhvdXRlcnJvcnMnLFxuICAgIFRlbXBsYXRlU3RhZ2U6ICdPcmlnaW5hbCcsXG4gIH0pO1xufSk7XG5cbnRlc3QoJ2RlcGxveSBub3Qgc2tpcHBlZCBpZiB0ZW1wbGF0ZSBkaWQgbm90IGNoYW5nZSBidXQgdGFncyBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBnaXZlblN0YWNrRXhpc3RzKHtcbiAgICBUYWdzOiBbeyBLZXk6ICdLZXknLCBWYWx1ZTogJ1ZhbHVlJyB9XSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXNvbHZlZEVudmlyb25tZW50ID0gbW9ja1Jlc29sdmVkRW52aXJvbm1lbnQoKTtcbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIHN0YWNrOiBGQUtFX1NUQUNLLFxuICAgIHNkayxcbiAgICBzZGtQcm92aWRlcixcbiAgICByZXNvbHZlZEVudmlyb25tZW50LFxuICAgIHRhZ3M6IFtcbiAgICAgIHtcbiAgICAgICAgS2V5OiAnS2V5JyxcbiAgICAgICAgVmFsdWU6ICdOZXdWYWx1ZScsXG4gICAgICB9LFxuICAgIF0sXG4gICAgZW52UmVzb3VyY2VzOiBuZXcgTm9Cb290c3RyYXBTdGFja0Vudmlyb25tZW50UmVzb3VyY2VzKHJlc29sdmVkRW52aXJvbm1lbnQsIHNkayksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoRGVzY3JpYmVDaGFuZ2VTZXRDb21tYW5kKTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVN0YWNrc0NvbW1hbmQsIHtcbiAgICBTdGFja05hbWU6ICd3aXRob3V0ZXJyb3JzJyxcbiAgfSk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoR2V0VGVtcGxhdGVDb21tYW5kLCB7XG4gICAgU3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gICAgVGVtcGxhdGVTdGFnZTogJ09yaWdpbmFsJyxcbiAgfSk7XG59KTtcblxudGVzdCgnZGVwbG95U3RhY2sgcmVwb3J0cyBubyBjaGFuZ2UgaWYgZGVzY3JpYmVDaGFuZ2VTZXQgcmV0dXJucyBzcGVjaWZpYyBlcnJvcicsIGFzeW5jICgpID0+IHtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlQ2hhbmdlU2V0Q29tbWFuZCkucmVzb2x2ZXNPbmNlKHtcbiAgICBTdGF0dXM6IENoYW5nZVNldFN0YXR1cy5GQUlMRUQsXG4gICAgU3RhdHVzUmVhc29uOiAnTm8gdXBkYXRlcyBhcmUgdG8gYmUgcGVyZm9ybWVkLicsXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgZGVwbG95UmVzdWx0ID0gYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QoZGVwbG95UmVzdWx0LnR5cGUgPT09ICdkaWQtZGVwbG95LXN0YWNrJyAmJiBkZXBsb3lSZXN1bHQubm9PcCkudG9FcXVhbCh0cnVlKTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgbm90IHNraXBwZWQgaWYgdGVtcGxhdGUgZGlkIG5vdCBjaGFuZ2UgYnV0IG9uZSB0YWcgcmVtb3ZlZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgIFRhZ3M6IFtcbiAgICAgICAgICB7IEtleTogJ0tleTEnLCBWYWx1ZTogJ1ZhbHVlMScgfSxcbiAgICAgICAgICB7IEtleTogJ0tleTInLCBWYWx1ZTogJ1ZhbHVlMicgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHRhZ3M6IFt7IEtleTogJ0tleTEnLCBWYWx1ZTogJ1ZhbHVlMScgfV0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoRGVzY3JpYmVDaGFuZ2VTZXRDb21tYW5kKTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVN0YWNrc0NvbW1hbmQsIHtcbiAgICBTdGFja05hbWU6ICd3aXRob3V0ZXJyb3JzJyxcbiAgfSk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoR2V0VGVtcGxhdGVDb21tYW5kLCB7XG4gICAgU3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gICAgVGVtcGxhdGVTdGFnZTogJ09yaWdpbmFsJyxcbiAgfSk7XG59KTtcblxudGVzdCgnZGVwbG95IGlzIG5vdCBza2lwcGVkIGlmIHN0YWNrIGlzIGluIGEgX0ZBSUxFRCBzdGF0ZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5ERUxFVEVfRkFJTEVELFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgdXNlUHJldmlvdXNQYXJhbWV0ZXJzOiB0cnVlLFxuICB9KS5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG59KTtcblxudGVzdCgnZXhpc3Rpbmcgc3RhY2sgaW4gVVBEQVRFX1JPTExCQUNLX0NPTVBMRVRFIHN0YXRlIGNhbiBiZSB1cGRhdGVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLlVQREFURV9ST0xMQkFDS19DT01QTEVURSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLlVQREFURV9DT01QTEVURSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIGdpdmVuVGVtcGxhdGVJcyh7IGNoYW5nZWQ6IDEyMyB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChEZWxldGVTdGFja0NvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgQ2hhbmdlU2V0VHlwZTogQ2hhbmdlU2V0VHlwZS5VUERBVEUsXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbn0pO1xuXG50ZXN0KCdkZXBsb3kgbm90IHNraXBwZWQgaWYgdGVtcGxhdGUgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW3sgLi4uYmFzZVJlc3BvbnNlIH1dLFxuICB9KTtcbiAgZ2l2ZW5UZW1wbGF0ZUlzKHsgY2hhbmdlZDogMTIzIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmQoQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG59KTtcblxudGVzdCgnbm90IGV4ZWN1dGVkIGFuZCBubyBlcnJvciBpZiAtLW5vLWV4ZWN1dGUgaXMgZ2l2ZW4nLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBkZXBsb3ltZW50TWV0aG9kOiB7IG1ldGhvZDogJ2NoYW5nZS1zZXQnLCBleGVjdXRlOiBmYWxzZSB9LFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ2VtcHR5IGNoYW5nZSBzZXQgaXMgZGVsZXRlZCBpZiAtLWV4ZWN1dGUgaXMgZ2l2ZW4nLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZUNoYW5nZVNldENvbW1hbmQpLnJlc29sdmVzT25jZSh7XG4gICAgU3RhdHVzOiBDaGFuZ2VTZXRTdGF0dXMuRkFJTEVELFxuICAgIFN0YXR1c1JlYXNvbjogJ05vIHVwZGF0ZXMgYXJlIHRvIGJlIHBlcmZvcm1lZC4nLFxuICB9KTtcblxuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbeyAuLi5iYXNlUmVzcG9uc2UgfV0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBkZXBsb3ltZW50TWV0aG9kOiB7IG1ldGhvZDogJ2NoYW5nZS1zZXQnLCBleGVjdXRlOiB0cnVlIH0sXG4gICAgZm9yY2U6IHRydWUsIC8vIE5lY2Vzc2FyeSB0byBieXBhc3MgXCJza2lwIGRlcGxveVwiXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kKTtcblxuICAvL3RoZSBmaXJzdCBkZWxldGlvbiBpcyBmb3IgYW55IGV4aXN0aW5nIGNkayBjaGFuZ2Ugc2V0cywgdGhlIHNlY29uZCBpcyBmb3IgdGhlIGRlbGV0aW5nIHRoZSBuZXcgZW1wdHkgY2hhbmdlIHNldFxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhEZWxldGVDaGFuZ2VTZXRDb21tYW5kLCAyKTtcbn0pO1xuXG50ZXN0KCdlbXB0eSBjaGFuZ2Ugc2V0IGlzIG5vdCBkZWxldGVkIGlmIC0tbm8tZXhlY3V0ZSBpcyBnaXZlbicsIGFzeW5jICgpID0+IHtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlQ2hhbmdlU2V0Q29tbWFuZCkucmVzb2x2ZXNPbmNlKHtcbiAgICBTdGF0dXM6IENoYW5nZVNldFN0YXR1cy5GQUlMRUQsXG4gICAgU3RhdHVzUmVhc29uOiAnTm8gdXBkYXRlcyBhcmUgdG8gYmUgcGVyZm9ybWVkLicsXG4gIH0pO1xuXG4gIC8vIEdJVkVOXG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGFja3M6IFt7IC4uLmJhc2VSZXNwb25zZSB9XSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGRlcGxveW1lbnRNZXRob2Q6IHsgbWV0aG9kOiAnY2hhbmdlLXNldCcsIGV4ZWN1dGU6IGZhbHNlIH0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kKTtcblxuICAvL3RoZSBmaXJzdCBkZWxldGlvbiBpcyBmb3IgYW55IGV4aXN0aW5nIGNkayBjaGFuZ2Ugc2V0c1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhEZWxldGVDaGFuZ2VTZXRDb21tYW5kLCAxKTtcbn0pO1xuXG50ZXN0KCd1c2UgUzMgdXJsIGZvciBzdGFjayBkZXBsb3ltZW50IGlmIHByZXNlbnQgaW4gU3RhY2sgQXJ0aWZhY3QnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICBzdGFjazogdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ3dpdGhvdXRlcnJvcnMnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBzdGFja1RlbXBsYXRlQXNzZXRPYmplY3RVcmw6ICdodHRwczovL3VzZS1tZS11c2UtbWUvJyxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly91c2UtbWUtdXNlLW1lLycsXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCd1c2UgUkVTVCBBUEkgUzMgdXJsIHdpdGggc3Vic3RpdHV0ZWQgcGxhY2Vob2xkZXJzIGlmIG1hbmlmZXN0IHVybCBzdGFydHMgd2l0aCBzMzovLycsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHN0YWNrOiB0ZXN0U3RhY2soe1xuICAgICAgc3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHN0YWNrVGVtcGxhdGVBc3NldE9iamVjdFVybDogJ3MzOi8vdXNlLW1lLXVzZS1tZS0ke0FXUzo6QWNjb3VudElkfS9vYmplY3QnLFxuICAgICAgfSxcbiAgICB9KSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3MzLmJlcm11ZGEtdHJpYW5nbGUtMTMzNy5hbWF6b25hd3MuY29tL3VzZS1tZS11c2UtbWUtMTIzNDU2Nzg5L29iamVjdCcsXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kKTtcbn0pO1xuXG50ZXN0KCdjaGFuZ2VzZXQgaXMgY3JlYXRlZCB3aGVuIHN0YWNrIGV4aXN0cyBpbiBSRVZJRVdfSU5fUFJPR1JFU1Mgc3RhdHVzJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLlJFVklFV19JTl9QUk9HUkVTUyxcbiAgICAgICAgVGFnczogW1xuICAgICAgICAgIHsgS2V5OiAnS2V5MScsIFZhbHVlOiAnVmFsdWUxJyB9LFxuICAgICAgICAgIHsgS2V5OiAnS2V5MicsIFZhbHVlOiAnVmFsdWUyJyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgZGVwbG95bWVudE1ldGhvZDogeyBtZXRob2Q6ICdjaGFuZ2Utc2V0JywgZXhlY3V0ZTogZmFsc2UgfSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgQ2hhbmdlU2V0VHlwZTogQ2hhbmdlU2V0VHlwZS5DUkVBVEUsXG4gICAgU3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCk7XG59KTtcblxudGVzdCgnY2hhbmdlc2V0IGlzIHVwZGF0ZWQgd2hlbiBzdGFjayBleGlzdHMgaW4gQ1JFQVRFX0NPTVBMRVRFIHN0YXR1cycsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW1xuICAgICAge1xuICAgICAgICAuLi5iYXNlUmVzcG9uc2UsXG4gICAgICAgIFRhZ3M6IFtcbiAgICAgICAgICB7IEtleTogJ0tleTEnLCBWYWx1ZTogJ1ZhbHVlMScgfSxcbiAgICAgICAgICB7IEtleTogJ0tleTInLCBWYWx1ZTogJ1ZhbHVlMicgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIGRlcGxveW1lbnRNZXRob2Q6IHsgbWV0aG9kOiAnY2hhbmdlLXNldCcsIGV4ZWN1dGU6IGZhbHNlIH0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChDcmVhdGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgIENoYW5nZVNldFR5cGU6IENoYW5nZVNldFR5cGUuVVBEQVRFLFxuICAgIFN0YWNrTmFtZTogJ3dpdGhvdXRlcnJvcnMnLFxuICB9IGFzIENyZWF0ZUNoYW5nZVNldENvbW1hbmRJbnB1dCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQpO1xufSk7XG5cbnRlc3QoJ2RlcGxveSB3aXRoIHRlcm1pbmF0aW9uIHByb3RlY3Rpb24gZW5hYmxlZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgIHN0YWNrOiBGQUtFX1NUQUNLX1RFUk1JTkFUSU9OX1BST1RFQ1RJT04sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb25Db21tYW5kLCB7XG4gICAgU3RhY2tOYW1lOiAndGVybWluYXRpb24tcHJvdGVjdGlvbicsXG4gICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICB9KTtcbn0pO1xuXG50ZXN0KCd1cGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb24gbm90IGNhbGxlZCB3aGVuIHRlcm1pbmF0aW9uIHByb3RlY3Rpb24gaXMgdW5kZWZpbmVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb25Db21tYW5kKTtcbn0pO1xuXG50ZXN0KCd1cGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb24gY2FsbGVkIHdoZW4gdGVybWluYXRpb24gcHJvdGVjdGlvbiBpcyB1bmRlZmluZWQgYW5kIHN0YWNrIGhhcyB0ZXJtaW5hdGlvbiBwcm90ZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tzOiBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VSZXNwb25zZSxcbiAgICAgICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb25Db21tYW5kLCB7XG4gICAgU3RhY2tOYW1lOiAnd2l0aG91dGVycm9ycycsXG4gICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ2Rpc2FibGUgcm9sbGJhY2snLCAoKSA9PiB7XG4gIHRlc3QoJ2J5IGRlZmF1bHQsIHdlIGRvIG5vdCBkaXNhYmxlIHJvbGxiYWNrIChhbmQgYWxzbyBkbyBub3QgcGFzcyB0aGUgZmxhZyknLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCwgMSk7XG4gICAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICAgIERpc2FibGVSb2xsYmFjazogZXhwZWN0LmFueXRoaW5nLFxuICAgICAgQ2hhbmdlU2V0TmFtZTogZXhwZWN0LmFueShTdHJpbmcpLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdyb2xsYmFjayBjYW4gYmUgZGlzYWJsZWQgYnkgc2V0dGluZyByb2xsYmFjazogZmFsc2UnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICAgIHJvbGxiYWNrOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgICAuLi5leHBlY3QuYW55dGhpbmcsXG4gICAgICBEaXNhYmxlUm9sbGJhY2s6IHRydWUsXG4gICAgfSBhcyBFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ2ltcG9ydC1leGlzdGluZy1yZXNvdXJjZXMnLCAoKSA9PiB7XG4gIHRlc3QoJ2lzIGRpc2FibGVkIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAgIC4uLnN0YW5kYXJkRGVwbG95U3RhY2tBcmd1bWVudHMoKSxcbiAgICAgIGRlcGxveW1lbnRNZXRob2Q6IHtcbiAgICAgICAgbWV0aG9kOiAnY2hhbmdlLXNldCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCwge1xuICAgICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgICAgSW1wb3J0RXhpc3RpbmdSZXNvdXJjZXM6IGZhbHNlLFxuICAgIH0gYXMgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZElucHV0KTtcbiAgfSk7XG5cbiAgdGVzdCgnaXMgYWRkZWQgdG8gdGhlIENyZWF0ZUNoYW5nZVNldENvbW1hbmRJbnB1dCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZGVwbG95U3RhY2soe1xuICAgICAgLi4uc3RhbmRhcmREZXBsb3lTdGFja0FyZ3VtZW50cygpLFxuICAgICAgZGVwbG95bWVudE1ldGhvZDoge1xuICAgICAgICBtZXRob2Q6ICdjaGFuZ2Utc2V0JyxcbiAgICAgICAgaW1wb3J0RXhpc3RpbmdSZXNvdXJjZXM6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCwge1xuICAgICAgLi4uZXhwZWN0LmFueXRoaW5nLFxuICAgICAgSW1wb3J0RXhpc3RpbmdSZXNvdXJjZXM6IHRydWUsXG4gICAgfSBhcyBDcmVhdGVDaGFuZ2VTZXRDb21tYW5kSW5wdXQpO1xuICB9KTtcbn0pO1xuXG50ZXN0LmVhY2goW1xuICAvLyBGcm9tIGEgZmFpbGVkIHN0YXRlLCBhIC0tbm8tcm9sbGJhY2sgaXMgcG9zc2libGUgYXMgbG9uZyBhcyB0aGVyZSBpcyBub3QgYSByZXBsYWNlbWVudFxuICBbU3RhY2tTdGF0dXMuVVBEQVRFX0ZBSUxFRCwgJ25vLXJvbGxiYWNrJywgJ25vLXJlcGxhY2VtZW50JywgJ2RpZC1kZXBsb3ktc3RhY2snXSxcbiAgW1N0YWNrU3RhdHVzLlVQREFURV9GQUlMRUQsICduby1yb2xsYmFjaycsICdyZXBsYWNlbWVudCcsICdmYWlscGF1c2VkLW5lZWQtcm9sbGJhY2stZmlyc3QnXSxcbiAgLy8gQW55IGNvbWJpbmF0aW9uIG9mIFVQREFURV9GQUlMRUQgJiByb2xsYmFjayBhbHdheXMgcmVxdWlyZXMgYSByb2xsYmFjayBmaXJzdFxuICBbU3RhY2tTdGF0dXMuVVBEQVRFX0ZBSUxFRCwgJ3JvbGxiYWNrJywgJ3JlcGxhY2VtZW50JywgJ2ZhaWxwYXVzZWQtbmVlZC1yb2xsYmFjay1maXJzdCddLFxuICBbU3RhY2tTdGF0dXMuVVBEQVRFX0ZBSUxFRCwgJ3JvbGxiYWNrJywgJ25vLXJlcGxhY2VtZW50JywgJ2ZhaWxwYXVzZWQtbmVlZC1yb2xsYmFjay1maXJzdCddLFxuICAvLyBGcm9tIGEgc3RhYmxlIHN0YXRlLCBhbnkgZGVwbG95bWVudCBjb250YWluaW5nIGEgcmVwbGFjZW1lbnQgcmVxdWlyZXMgYSByZWd1bGFyIGRlcGxveW1lbnQgKC0tcm9sbGJhY2spXG4gIFtTdGFja1N0YXR1cy5VUERBVEVfQ09NUExFVEUsICduby1yb2xsYmFjaycsICdyZXBsYWNlbWVudCcsICdyZXBsYWNlbWVudC1yZXF1aXJlcy1yb2xsYmFjayddLFxuXSBzYXRpc2ZpZXMgQXJyYXk8W1N0YWNrU3RhdHVzLCAncm9sbGJhY2snIHwgJ25vLXJvbGxiYWNrJywgJ3JlcGxhY2VtZW50JyB8ICduby1yZXBsYWNlbWVudCcsIHN0cmluZ10+KVxuKCduby1yb2xsYmFjayBhbmQgcmVwbGFjZW1lbnQgaXMgZGlzYWR2aXNlZDogJXMgJXMgJXMgLT4gJXMnLCBhc3luYyAoc3RhY2tTdGF0dXMsIHJvbGxiYWNrLCByZXBsYWNlbWVudCwgZXhwZWN0ZWRUeXBlKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGdpdmVuVGVtcGxhdGVJcyhGQUtFX1NUQUNLLnRlbXBsYXRlKTtcbiAgZ2l2ZW5TdGFja0V4aXN0cyh7XG4gICAgLy8gRmlyc3QgY2FsbFxuICAgIFN0YWNrU3RhdHVzOiBzdGFja1N0YXR1cyxcbiAgfSwge1xuICAgIC8vIExhdGVyIGNhbGxzXG4gICAgU3RhY2tTdGF0dXM6ICdVUERBVEVfQ09NUExFVEUnLFxuICB9KTtcbiAgZ2l2ZW5DaGFuZ2VTZXRDb250YWluc1JlcGxhY2VtZW50KHJlcGxhY2VtZW50ID09PSAncmVwbGFjZW1lbnQnKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRlcGxveVN0YWNrKHtcbiAgICAuLi5zdGFuZGFyZERlcGxveVN0YWNrQXJndW1lbnRzKCksXG4gICAgc3RhY2s6IEZBS0VfU1RBQ0ssXG4gICAgcm9sbGJhY2s6IHJvbGxiYWNrID09PSAncm9sbGJhY2snLFxuICAgIGZvcmNlOiB0cnVlLCAvLyBCeXBhc3MgJ2NhblNraXBEZXBsb3knXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHJlc3VsdC50eXBlKS50b0VxdWFsKGV4cGVjdGVkVHlwZSk7XG59KTtcblxudGVzdCgnYXNzZXJ0SXNTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQgZG9lcyB3aGF0IGl0IHNheXMnLCAoKSA9PiB7XG4gIGV4cGVjdCgoKSA9PiBhc3NlcnRJc1N1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdCh7IHR5cGU6ICdyZXBsYWNlbWVudC1yZXF1aXJlcy1yb2xsYmFjaycgfSkpLnRvVGhyb3coKTtcbn0pO1xuLyoqXG4gKiBTZXQgdXAgdGhlIG1vY2tzIHNvIHRoYXQgaXQgbG9va3MgbGlrZSB0aGUgc3RhY2sgZXhpc3RzIHRvIHN0YXJ0IHdpdGhcbiAqXG4gKiBUaGUgbGFzdCBlbGVtZW50IG9mIHRoaXMgYXJyYXkgd2lsbCBiZSBjb250aW51b3VzbHkgcmVwZWF0ZWQuXG4gKi9cbmZ1bmN0aW9uIGdpdmVuU3RhY2tFeGlzdHMoLi4ub3ZlcnJpZGVzOiBBcnJheTxQYXJ0aWFsPFN0YWNrPj4pIHtcbiAgaWYgKG92ZXJyaWRlcy5sZW5ndGggPT09IDApIHtcbiAgICBvdmVycmlkZXMgPSBbe31dO1xuICB9XG5cbiAgbGV0IGhhbmRsZXIgPSBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKTtcblxuICBmb3IgKGNvbnN0IG92ZXJyaWRlIG9mIG92ZXJyaWRlcy5zbGljZSgwLCBvdmVycmlkZXMubGVuZ3RoIC0gMSkpIHtcbiAgICBoYW5kbGVyID0gaGFuZGxlci5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbeyAuLi5iYXNlUmVzcG9uc2UsIC4uLm92ZXJyaWRlIH1dLFxuICAgIH0pO1xuICB9XG4gIGhhbmRsZXIucmVzb2x2ZXMoe1xuICAgIFN0YWNrczogW3sgLi4uYmFzZVJlc3BvbnNlLCAuLi5vdmVycmlkZXNbb3ZlcnJpZGVzLmxlbmd0aCAtIDFdIH1dLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2l2ZW5UZW1wbGF0ZUlzKHRlbXBsYXRlOiBhbnkpIHtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKEdldFRlbXBsYXRlQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFRlbXBsYXRlQm9keTogSlNPTi5zdHJpbmdpZnkodGVtcGxhdGUpLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2l2ZW5DaGFuZ2VTZXRDb250YWluc1JlcGxhY2VtZW50KHJlcGxhY2VtZW50OiBib29sZWFuKSB7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZUNoYW5nZVNldENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBTdGF0dXM6ICdDUkVBVEVfQ09NUExFVEUnLFxuICAgIENoYW5nZXM6IHJlcGxhY2VtZW50ID8gW1xuICAgICAge1xuICAgICAgICBUeXBlOiAnUmVzb3VyY2UnLFxuICAgICAgICBSZXNvdXJjZUNoYW5nZToge1xuICAgICAgICAgIFBvbGljeUFjdGlvbjogJ1JlcGxhY2VBbmREZWxldGUnLFxuICAgICAgICAgIEFjdGlvbjogJ01vZGlmeScsXG4gICAgICAgICAgTG9naWNhbFJlc291cmNlSWQ6ICdRdWV1ZTRBN0UzNTU1JyxcbiAgICAgICAgICBQaHlzaWNhbFJlc291cmNlSWQ6ICdodHRwczovL3Nxcy5ldS13ZXN0LTEuYW1hem9uYXdzLmNvbS8xMTExMTExMTExMTEvUXVldWU0QTdFMzU1NS1QOUM4bkszdXY4djYuZmlmbycsXG4gICAgICAgICAgUmVzb3VyY2VUeXBlOiAnQVdTOjpTUVM6OlF1ZXVlJyxcbiAgICAgICAgICBSZXBsYWNlbWVudDogJ1RydWUnLFxuICAgICAgICAgIFNjb3BlOiBbJ1Byb3BlcnRpZXMnXSxcbiAgICAgICAgICBEZXRhaWxzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIFRhcmdldDoge1xuICAgICAgICAgICAgICAgIEF0dHJpYnV0ZTogJ1Byb3BlcnRpZXMnLFxuICAgICAgICAgICAgICAgIE5hbWU6ICdGaWZvUXVldWUnLFxuICAgICAgICAgICAgICAgIFJlcXVpcmVzUmVjcmVhdGlvbjogJ0Fsd2F5cycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEV2YWx1YXRpb246ICdTdGF0aWMnLFxuICAgICAgICAgICAgICBDaGFuZ2VTb3VyY2U6ICdEaXJlY3RNb2RpZmljYXRpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdIDogW10sXG4gIH0pO1xufVxuIl19