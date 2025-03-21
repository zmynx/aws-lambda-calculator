"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const setup = require("./hotswap-test-setup");
const evaluate_cloudformation_template_1 = require("../../../lib/api/evaluate-cloudformation-template");
const common_1 = require("../../../lib/api/hotswap/common");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
jest.mock('@aws-sdk/client-lambda', () => {
    const original = jest.requireActual('@aws-sdk/client-lambda');
    return {
        ...original,
        waitUntilFunctionUpdated: jest.fn(),
    };
});
let hotswapMockSdkProvider;
let sdk;
beforeEach(() => {
    sdk = new mock_sdk_1.MockSdk();
    sdk.getUrlSuffix = () => Promise.resolve('amazonaws.com');
    jest.resetAllMocks();
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('returns a deployStackResult with noOp=true when it receives an empty set of changes', async () => {
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, setup.cdkStackArtifactOf());
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(deployStackResult?.noOp).toBeTruthy();
        expect(deployStackResult?.stackArn).toEqual(setup.STACK_ID);
    });
    (0, silent_1.silentTest)('A change to only a non-hotswappable resource results in a full deployment for HOTSWAP and a noOp for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                SomethingElse: {
                    Type: 'AWS::CloudFormation::SomethingElse',
                    Properties: {
                        Prop: 'old-value',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    SomethingElse: {
                        Type: 'AWS::CloudFormation::SomethingElse',
                        Properties: {
                            Prop: 'new-value',
                        },
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)('A change to both a hotswappable resource and a non-hotswappable resource results in a full deployment for HOTSWAP and a noOp for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: 'my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
                SomethingElse: {
                    Type: 'AWS::CloudFormation::SomethingElse',
                    Properties: {
                        Prop: 'old-value',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                    SomethingElse: {
                        Type: 'AWS::CloudFormation::SomethingElse',
                        Properties: {
                            Prop: 'new-value',
                        },
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'my-function',
                S3Bucket: 'current-bucket',
                S3Key: 'new-key',
            });
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        }
    });
    (0, silent_1.silentTest)('changes only to CDK::Metadata result in a noOp', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                MetaData: {
                    Type: 'AWS::CDK::Metadata',
                    Properties: {
                        Prop: 'old-value',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    MetaData: {
                        Type: 'AWS::CDK::Metadata',
                        Properties: {
                            Prop: 'new-value',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(deployStackResult?.noOp).toEqual(true);
        expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
    });
    (0, silent_1.silentTest)('resource deletions require full deployments for HOTSWAP and a noOp for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf();
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)('can correctly reference AWS::Partition in hotswappable changes', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: {
                            'Fn::Join': ['', [{ Ref: 'AWS::Partition' }, '-', 'my-function']],
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'new-path',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: {
                                'Fn::Join': ['', [{ Ref: 'AWS::Partition' }, '-', 'my-function']],
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'swa-my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('can correctly reference AWS::URLSuffix in hotswappable changes', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: {
                            'Fn::Join': ['', ['my-function-', { Ref: 'AWS::URLSuffix' }, '-', { Ref: 'AWS::URLSuffix' }]],
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: {
                                'Fn::Join': ['', ['my-function-', { Ref: 'AWS::URLSuffix' }, '-', { Ref: 'AWS::URLSuffix' }]],
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function-amazonaws.com-amazonaws.com',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('changing the type of a deployed resource always results in a full deployment for HOTSWAP and a noOp for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                SharedLogicalId: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'new-key',
                        },
                        FunctionName: 'my-function',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    SharedLogicalId: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: '{ Prop: "new-value" }',
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)('A change to both a hotswappable resource and a stack output results in a full deployment for HOTSWAP and a hotswap deployment for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: 'my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
            Outputs: {
                SomeOutput: {
                    Value: 'old-value',
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
                Outputs: {
                    SomeOutput: {
                        Value: 'new-value',
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'my-function',
                S3Bucket: 'current-bucket',
                S3Key: 'new-key',
            });
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        }
    });
    (0, silent_1.silentTest)('Multiple CfnEvaluationException will not cause unhandled rejections', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func1: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        Environment: {
                            key: 'old',
                        },
                        FunctionName: 'my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
                Func2: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        Environment: {
                            key: 'old',
                        },
                        FunctionName: 'my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func1: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            Environment: {
                                key: { Ref: 'ErrorResource' },
                            },
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                    Func2: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            Environment: {
                                key: { Ref: 'ErrorResource' },
                            },
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        await expect(deployStackResult).rejects.toThrow(evaluate_cloudformation_template_1.CfnEvaluationException);
        expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
    });
    (0, silent_1.silentTest)('deleting a resource and making a hotswappable change results in full deployments for HOTSWAP and a hotswap deployment for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                },
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: 'my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'my-function',
                S3Bucket: 'current-bucket',
                S3Key: 'new-key',
            });
        }
    });
    (0, silent_1.silentTest)('can correctly reference Fn::ImportValue in hotswappable changes', async () => {
        // GIVEN
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListExportsCommand).resolves({
            Exports: [
                {
                    ExportingStackId: 'test-exporting-stack-id',
                    Name: 'test-import',
                    Value: 'new-key',
                },
            ],
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'old-key',
                        },
                        FunctionName: 'swa-my-function',
                    },
                    Metadata: {
                        'aws:asset:path': 'new-path',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: {
                                    'Fn::ImportValue': 'test-import',
                                },
                            },
                            FunctionName: 'swa-my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'swa-my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMEVBQW9FO0FBQ3BFLDBEQUFtRTtBQUNuRSxvREFBZ0U7QUFDaEUsOENBQThDO0FBQzlDLHdHQUEyRjtBQUMzRiw0REFBOEQ7QUFDOUQsa0RBQW1IO0FBQ25ILDhDQUErQztBQUUvQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtJQUN2QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFFOUQsT0FBTztRQUNMLEdBQUcsUUFBUTtRQUNYLHdCQUF3QixFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7S0FDcEMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxzQkFBb0QsQ0FBQztBQUN6RCxJQUFJLEdBQVksQ0FBQztBQUVqQixVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsR0FBRyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO0lBQ3BCLEdBQUcsQ0FBQyxZQUFZLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMxRCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDckIsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFBQyxxRkFBcUYsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMzRyxPQUFPO1FBQ1AsTUFBTSxpQkFB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RUFBRTs0QkFDSixRQUFRLEVBQUUsZ0JBQWdCOzRCQUMxQixLQUFLLEVBQUUsU0FBUzt5QkFDakI7d0JBQ0QsWUFBWSxFQUFFLGlCQUFpQjtxQkFDaEM7b0JBQ0QsUUFBUSxFQUFFO3dCQUNSLGdCQUFnQixFQUFFLFVBQVU7cUJBQzdCO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFO29CQUNULElBQUksRUFBRTt3QkFDSixJQUFJLEVBQUUsdUJBQXVCO3dCQUM3QixVQUFVLEVBQUU7NEJBQ1YsSUFBSSxFQUFFO2dDQUNKLFFBQVEsRUFBRSxnQkFBZ0I7Z0NBQzFCLEtBQUssRUFBRTtvQ0FDTCxpQkFBaUIsRUFBRSxhQUFhO2lDQUNqQzs2QkFDRjs0QkFDRCxZQUFZLEVBQUUsaUJBQWlCO3lCQUNoQzt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsVUFBVTt5QkFDN0I7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFM0csT0FBTztRQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM5QyxNQUFNLENBQUMsMkJBQWdCLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyx5Q0FBeUIsRUFBRTtZQUM1RSxZQUFZLEVBQUUsaUJBQWlCO1lBQy9CLFFBQVEsRUFBRSxnQkFBZ0I7WUFDMUIsS0FBSyxFQUFFLFNBQVM7U0FDakIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExpc3RFeHBvcnRzQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWxhbWJkYSc7XG5pbXBvcnQgeyBVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXNmbic7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vbGliL2FwaS9ldmFsdWF0ZS1jbG91ZGZvcm1hdGlvbi10ZW1wbGF0ZSc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgTW9ja1NkaywgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LCBtb2NrTGFtYmRhQ2xpZW50LCBtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCB9IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHsgc2lsZW50VGVzdCB9IGZyb20gJy4uLy4uL3V0aWwvc2lsZW50JztcblxuamVzdC5tb2NrKCdAYXdzLXNkay9jbGllbnQtbGFtYmRhJywgKCkgPT4ge1xuICBjb25zdCBvcmlnaW5hbCA9IGplc3QucmVxdWlyZUFjdHVhbCgnQGF3cy1zZGsvY2xpZW50LWxhbWJkYScpO1xuXG4gIHJldHVybiB7XG4gICAgLi4ub3JpZ2luYWwsXG4gICAgd2FpdFVudGlsRnVuY3Rpb25VcGRhdGVkOiBqZXN0LmZuKCksXG4gIH07XG59KTtcblxubGV0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXI6IHNldHVwLkhvdHN3YXBNb2NrU2RrUHJvdmlkZXI7XG5sZXQgc2RrOiBNb2NrU2RrO1xuXG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgc2RrID0gbmV3IE1vY2tTZGsoKTtcbiAgc2RrLmdldFVybFN1ZmZpeCA9ICgpID0+IFByb21pc2UucmVzb2x2ZSgnYW1hem9uYXdzLmNvbScpO1xuICBqZXN0LnJlc2V0QWxsTW9ja3MoKTtcbiAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcFRlc3RzKCk7XG59KTtcblxuZGVzY3JpYmUuZWFjaChbSG90c3dhcE1vZGUuRkFMTF9CQUNLLCBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFldKSgnJXAgbW9kZScsIChob3Rzd2FwTW9kZSkgPT4ge1xuICBzaWxlbnRUZXN0KCdyZXR1cm5zIGEgZGVwbG95U3RhY2tSZXN1bHQgd2l0aCBub09wPXRydWUgd2hlbiBpdCByZWNlaXZlcyBhbiBlbXB0eSBzZXQgb2YgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBXSEVOXG4gICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KFxuICAgICAgaG90c3dhcE1vZGUsXG4gICAgICBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2YoKSxcbiAgICApO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvQmVUcnV0aHkoKTtcbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/LnN0YWNrQXJuKS50b0VxdWFsKHNldHVwLlNUQUNLX0lEKTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnQSBjaGFuZ2UgdG8gb25seSBhIG5vbi1ob3Rzd2FwcGFibGUgcmVzb3VyY2UgcmVzdWx0cyBpbiBhIGZ1bGwgZGVwbG95bWVudCBmb3IgSE9UU1dBUCBhbmQgYSBub09wIGZvciBIT1RTV0FQX09OTFknLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFNvbWV0aGluZ0Vsc2U6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTb21ldGhpbmdFbHNlJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcDogJ29sZC12YWx1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgU29tZXRoaW5nRWxzZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U29tZXRoaW5nRWxzZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBQcm9wOiAnbmV3LXZhbHVlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH1cbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ0EgY2hhbmdlIHRvIGJvdGggYSBob3Rzd2FwcGFibGUgcmVzb3VyY2UgYW5kIGEgbm9uLWhvdHN3YXBwYWJsZSByZXNvdXJjZSByZXN1bHRzIGluIGEgZnVsbCBkZXBsb3ltZW50IGZvciBIT1RTV0FQIGFuZCBhIG5vT3AgZm9yIEhPVFNXQVBfT05MWScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgU29tZXRoaW5nRWxzZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlNvbWV0aGluZ0Vsc2UnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBQcm9wOiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgU29tZXRoaW5nRWxzZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U29tZXRoaW5nRWxzZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBQcm9wOiAnbmV3LXZhbHVlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgfSk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgIH1cbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoJ2NoYW5nZXMgb25seSB0byBDREs6Ok1ldGFkYXRhIHJlc3VsdCBpbiBhIG5vT3AnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTWV0YURhdGE6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpDREs6Ok1ldGFkYXRhJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBQcm9wOiAnb2xkLXZhbHVlJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE1ldGFEYXRhOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDREs6Ok1ldGFkYXRhJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUHJvcDogJ25ldy12YWx1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gIH0pO1xuXG4gIHNpbGVudFRlc3QoJ3Jlc291cmNlIGRlbGV0aW9ucyByZXF1aXJlIGZ1bGwgZGVwbG95bWVudHMgZm9yIEhPVFNXQVAgYW5kIGEgbm9PcCBmb3IgSE9UU1dBUF9PTkxZJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKCk7XG5cbiAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgIH1cbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnY2FuIGNvcnJlY3RseSByZWZlcmVuY2UgQVdTOjpQYXJ0aXRpb24gaW4gaG90c3dhcHBhYmxlIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRnVuYzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZToge1xuICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJycsIFt7IFJlZjogJ0FXUzo6UGFydGl0aW9uJyB9LCAnLScsICdteS1mdW5jdGlvbiddXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7XG4gICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogWycnLCBbeyBSZWY6ICdBV1M6OlBhcnRpdGlvbicgfSwgJy0nLCAnbXktZnVuY3Rpb24nXV0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnc3dhLW15LWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnY2FuIGNvcnJlY3RseSByZWZlcmVuY2UgQVdTOjpVUkxTdWZmaXggaW4gaG90c3dhcHBhYmxlIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRnVuYzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZToge1xuICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJycsIFsnbXktZnVuY3Rpb24tJywgeyBSZWY6ICdBV1M6OlVSTFN1ZmZpeCcgfSwgJy0nLCB7IFJlZjogJ0FXUzo6VVJMU3VmZml4JyB9XV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZToge1xuICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFsnJywgWydteS1mdW5jdGlvbi0nLCB7IFJlZjogJ0FXUzo6VVJMU3VmZml4JyB9LCAnLScsIHsgUmVmOiAnQVdTOjpVUkxTdWZmaXgnIH1dXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbi1hbWF6b25hd3MuY29tLWFtYXpvbmF3cy5jb20nLFxuICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgIH0pO1xuICB9KTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjaGFuZ2luZyB0aGUgdHlwZSBvZiBhIGRlcGxveWVkIHJlc291cmNlIGFsd2F5cyByZXN1bHRzIGluIGEgZnVsbCBkZXBsb3ltZW50IGZvciBIT1RTV0FQIGFuZCBhIG5vT3AgZm9yIEhPVFNXQVBfT05MWScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgU2hhcmVkTG9naWNhbElkOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTaGFyZWRMb2dpY2FsSWQ6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFByb3A6IFwibmV3LXZhbHVlXCIgfScsXG4gICAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0Py5ub09wKS50b0VxdWFsKHRydWUpO1xuICAgICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnQSBjaGFuZ2UgdG8gYm90aCBhIGhvdHN3YXBwYWJsZSByZXNvdXJjZSBhbmQgYSBzdGFjayBvdXRwdXQgcmVzdWx0cyBpbiBhIGZ1bGwgZGVwbG95bWVudCBmb3IgSE9UU1dBUCBhbmQgYSBob3Rzd2FwIGRlcGxveW1lbnQgZm9yIEhPVFNXQVBfT05MWScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIE91dHB1dHM6IHtcbiAgICAgICAgICBTb21lT3V0cHV0OiB7XG4gICAgICAgICAgICBWYWx1ZTogJ29sZC12YWx1ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgT3V0cHV0czoge1xuICAgICAgICAgICAgU29tZU91dHB1dDoge1xuICAgICAgICAgICAgICBWYWx1ZTogJ25ldy12YWx1ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgIH0pO1xuICAgICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KCdNdWx0aXBsZSBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uIHdpbGwgbm90IGNhdXNlIHVuaGFuZGxlZCByZWplY3Rpb25zJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmMxOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAga2V5OiAnb2xkJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBGdW5jMjoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgIGtleTogJ29sZCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jMToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBrZXk6IHsgUmVmOiAnRXJyb3JSZXNvdXJjZScgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgRnVuYzI6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAga2V5OiB7IFJlZjogJ0Vycm9yUmVzb3VyY2UnIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGF3YWl0IGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkucmVqZWN0cy50b1Rocm93KENmbkV2YWx1YXRpb25FeGNlcHRpb24pO1xuICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnZGVsZXRpbmcgYSByZXNvdXJjZSBhbmQgbWFraW5nIGEgaG90c3dhcHBhYmxlIGNoYW5nZSByZXN1bHRzIGluIGZ1bGwgZGVwbG95bWVudHMgZm9yIEhPVFNXQVAgYW5kIGEgaG90c3dhcCBkZXBsb3ltZW50IGZvciBIT1RTV0FQX09OTFknLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KCdjYW4gY29ycmVjdGx5IHJlZmVyZW5jZSBGbjo6SW1wb3J0VmFsdWUgaW4gaG90c3dhcHBhYmxlIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oTGlzdEV4cG9ydHNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBFeHBvcnRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBFeHBvcnRpbmdTdGFja0lkOiAndGVzdC1leHBvcnRpbmctc3RhY2staWQnLFxuICAgICAgICAgIE5hbWU6ICd0ZXN0LWltcG9ydCcsXG4gICAgICAgICAgVmFsdWU6ICduZXcta2V5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICBTM0tleTogJ29sZC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3N3YS1teS1mdW5jdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6IHtcbiAgICAgICAgICAgICAgICAgICdGbjo6SW1wb3J0VmFsdWUnOiAndGVzdC1pbXBvcnQnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3N3YS1teS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnc3dhLW15LWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==