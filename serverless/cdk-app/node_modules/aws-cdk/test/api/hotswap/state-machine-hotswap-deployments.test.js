"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_sfn_1 = require("@aws-sdk/client-sfn");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('returns undefined when a new StateMachine is added to the Stack', async () => {
        // GIVEN
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
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
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        }
    });
    (0, silent_1.silentTest)('calls the updateStateMachine() API when it receives only a definitionString change without Fn::Join in a state machine', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{ Prop: "old-value" }',
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: '{ Prop: "new-value" }',
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            definition: '{ Prop: "new-value" }',
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
        });
    });
    (0, silent_1.silentTest)('calls the updateStateMachine() API when it receives only a definitionString change with Fn::Join in a state machine', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: {
                            'Fn::Join': [
                                '\n',
                                [
                                    '{',
                                    '  "StartAt" : "SuccessState"',
                                    '  "States" : {',
                                    '    "SuccessState": {',
                                    '      "Type": "Pass"',
                                    '      "Result": "Success"',
                                    '      "End": true',
                                    '    }',
                                    '  }',
                                    '}',
                                ],
                            ],
                        },
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': [
                                    '\n',
                                    [
                                        '{',
                                        '  "StartAt": "SuccessState",',
                                        '  "States": {',
                                        '    "SuccessState": {',
                                        '      "Type": "Succeed"',
                                        '    }',
                                        '  }',
                                        '}',
                                    ],
                                ],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            definition: JSON.stringify({
                StartAt: 'SuccessState',
                States: {
                    SuccessState: {
                        Type: 'Succeed',
                    },
                },
            }, null, 2),
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
        });
    });
    (0, silent_1.silentTest)('calls the updateStateMachine() API when it receives a change to the definitionString in a state machine that has no name', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{ "Prop" : "old-value" }',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: '{ "Prop" : "new-value" }',
                        },
                    },
                },
            },
        });
        // WHEN
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'arn:swa:states:here:123456789012:stateMachine:my-machine'));
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            definition: '{ "Prop" : "new-value" }',
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
        });
    });
    (0, silent_1.silentTest)(`does not call the updateStateMachine() API when it receives a change to a property that is not the definitionString in a state machine
        alongside a hotswappable change in CLASSIC mode but does in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{ "Prop" : "old-value" }',
                        LoggingConfiguration: {
                            // non-definitionString property
                            IncludeExecutionData: true,
                        },
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: '{ "Prop" : "new-value" }',
                            LoggingConfiguration: {
                                IncludeExecutionData: false,
                            },
                        },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'arn:swa:states:here:123456789012:stateMachine:my-machine'));
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
                definition: '{ "Prop" : "new-value" }',
                stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
            });
        }
    });
    (0, silent_1.silentTest)('does not call the updateStateMachine() API when a resource has a DefinitionString property but is not an AWS::StepFunctions::StateMachine is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::NotStepFunctions::NotStateMachine',
                    Properties: {
                        DefinitionString: '{ Prop: "old-value" }',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::NotStepFunctions::NotStateMachine',
                        Properties: {
                            DefinitionString: '{ Prop: "new-value" }',
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
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
        }
    });
    (0, silent_1.silentTest)('can correctly hotswap old style synth changes', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: { AssetParam1: { Type: 'String' } },
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: { Ref: 'AssetParam1' },
                        StateMachineName: 'machine-name',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: { AssetParam2: { Type: String } },
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: { Ref: 'AssetParam2' },
                            StateMachineName: 'machine-name',
                        },
                    },
                },
            },
        });
        // WHEN
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'arn:swa:states:here:123456789012:stateMachine:my-machine'));
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact, {
            AssetParam2: 'asset-param-2',
        });
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            definition: 'asset-param-2',
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:machine-name',
        });
    });
    (0, silent_1.silentTest)('calls the updateStateMachine() API when it receives a change to the definitionString that uses Attributes in a state machine', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                },
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: {
                            'Fn::Join': [
                                '\n',
                                [
                                    '{',
                                    '  "StartAt" : "SuccessState"',
                                    '  "States" : {',
                                    '    "SuccessState": {',
                                    '      "Type": "Succeed"',
                                    '    }',
                                    '  }',
                                    '}',
                                ],
                            ],
                        },
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                    },
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': ['', ['"Resource": ', { 'Fn::GetAtt': ['Func', 'Arn'] }]],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // WHEN
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'arn:swa:states:here:123456789012:stateMachine:my-machine'), setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-func'));
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            definition: '"Resource": arn:swa:lambda:here:123456789012:function:my-func',
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
        });
    });
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it cannot find a Ref target (outside the state machine's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                Param1: { Type: 'String' },
            },
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: {
                            'Fn::Join': ['', ['{ Prop: "old-value" }, ', '{ "Param" : ', { 'Fn::Sub': '${Param1}' }, ' }']],
                        },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'my-machine'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    Param1: { Type: 'String' },
                },
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': ['', ['{ Prop: "new-value" }, ', '{ "Param" : ', { 'Fn::Sub': '${Param1}' }, ' }']],
                            },
                        },
                    },
                },
            },
        });
        // THEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow(/Parameter or resource 'Param1' could not be found for evaluation/);
    });
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it doesn't know how to handle a specific attribute (outside the state machines's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Bucket: {
                    Type: 'AWS::S3::Bucket',
                },
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: {
                            'Fn::Join': [
                                '',
                                [
                                    '{ Prop: "old-value" }, ',
                                    '{ "S3Bucket" : ',
                                    { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                                    ' }',
                                ],
                            ],
                        },
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Machine', 'AWS::StepFunctions::StateMachine', 'arn:swa:states:here:123456789012:stateMachine:my-machine'), setup.stackSummaryOf('Bucket', 'AWS::S3::Bucket', 'my-bucket'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Bucket: {
                        Type: 'AWS::S3::Bucket',
                    },
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': [
                                    '',
                                    [
                                        '{ Prop: "new-value" }, ',
                                        '{ "S3Bucket" : ',
                                        { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                                        ' }',
                                    ],
                                ],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // THEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow("We don't support the 'UnknownAttribute' attribute of the 'AWS::S3::Bucket' resource. This is a CDK limitation. Please report it at https://github.com/aws/aws-cdk/issues/new/choose");
    });
    (0, silent_1.silentTest)('knows how to handle attributes of the AWS::Events::EventBus resource', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                EventBus: {
                    Type: 'AWS::Events::EventBus',
                    Properties: {
                        Name: 'my-event-bus',
                    },
                },
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: {
                            'Fn::Join': [
                                '',
                                [
                                    '{"EventBus1Arn":"',
                                    { 'Fn::GetAtt': ['EventBus', 'Arn'] },
                                    '","EventBus1Name":"',
                                    { 'Fn::GetAtt': ['EventBus', 'Name'] },
                                    '","EventBus1Ref":"',
                                    { Ref: 'EventBus' },
                                    '"}',
                                ],
                            ],
                        },
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('EventBus', 'AWS::Events::EventBus', 'my-event-bus'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    EventBus: {
                        Type: 'AWS::Events::EventBus',
                        Properties: {
                            Name: 'my-event-bus',
                        },
                    },
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': [
                                    '',
                                    [
                                        '{"EventBus2Arn":"',
                                        { 'Fn::GetAtt': ['EventBus', 'Arn'] },
                                        '","EventBus2Name":"',
                                        { 'Fn::GetAtt': ['EventBus', 'Name'] },
                                        '","EventBus2Ref":"',
                                        { Ref: 'EventBus' },
                                        '"}',
                                    ],
                                ],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // THEN
        const result = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        expect(result).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
            definition: JSON.stringify({
                EventBus2Arn: 'arn:swa:events:here:123456789012:event-bus/my-event-bus',
                EventBus2Name: 'my-event-bus',
                EventBus2Ref: 'my-event-bus',
            }),
        });
    });
    (0, silent_1.silentTest)('knows how to handle attributes of the AWS::DynamoDB::Table resource', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Table: {
                    Type: 'AWS::DynamoDB::Table',
                    Properties: {
                        KeySchema: [
                            {
                                AttributeName: 'name',
                                KeyType: 'HASH',
                            },
                        ],
                        AttributeDefinitions: [
                            {
                                AttributeName: 'name',
                                AttributeType: 'S',
                            },
                        ],
                        BillingMode: 'PAY_PER_REQUEST',
                    },
                },
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{}',
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Table', 'AWS::DynamoDB::Table', 'my-dynamodb-table'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Table: {
                        Type: 'AWS::DynamoDB::Table',
                        Properties: {
                            KeySchema: [
                                {
                                    AttributeName: 'name',
                                    KeyType: 'HASH',
                                },
                            ],
                            AttributeDefinitions: [
                                {
                                    AttributeName: 'name',
                                    AttributeType: 'S',
                                },
                            ],
                            BillingMode: 'PAY_PER_REQUEST',
                        },
                    },
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': [
                                    '',
                                    ['{"TableName":"', { Ref: 'Table' }, '","TableArn":"', { 'Fn::GetAtt': ['Table', 'Arn'] }, '"}'],
                                ],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // THEN
        const result = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        expect(result).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
            definition: JSON.stringify({
                TableName: 'my-dynamodb-table',
                TableArn: 'arn:swa:dynamodb:here:123456789012:table/my-dynamodb-table',
            }),
        });
    });
    (0, silent_1.silentTest)('knows how to handle attributes of the AWS::KMS::Key resource', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Key: {
                    Type: 'AWS::KMS::Key',
                    Properties: {
                        Description: 'magic-key',
                    },
                },
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{}',
                        StateMachineName: 'my-machine',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Key', 'AWS::KMS::Key', 'a-key'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Key: {
                        Type: 'AWS::KMS::Key',
                        Properties: {
                            Description: 'magic-key',
                        },
                    },
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: {
                                'Fn::Join': [
                                    '',
                                    ['{"KeyId":"', { Ref: 'Key' }, '","KeyArn":"', { 'Fn::GetAtt': ['Key', 'Arn'] }, '"}'],
                                ],
                            },
                            StateMachineName: 'my-machine',
                        },
                    },
                },
            },
        });
        // THEN
        const result = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        expect(result).not.toBeUndefined();
        expect(mock_sdk_1.mockStepFunctionsClient).toHaveReceivedCommandWith(client_sfn_1.UpdateStateMachineCommand, {
            stateMachineArn: 'arn:swa:states:here:123456789012:stateMachine:my-machine',
            definition: JSON.stringify({
                KeyId: 'a-key',
                KeyArn: 'arn:swa:kms:here:123456789012:key/a-key',
            }),
        });
    });
    (0, silent_1.silentTest)('does not explode if the DependsOn changes', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Machine: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        DefinitionString: '{ Prop: "old-value" }',
                        StateMachineName: 'my-machine',
                    },
                    DependsOn: ['abc'],
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Machine: {
                        Type: 'AWS::StepFunctions::StateMachine',
                        Properties: {
                            DefinitionString: '{ Prop: "old-value" }',
                            StateMachineName: 'my-machine',
                        },
                    },
                    DependsOn: ['xyz'],
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(deployStackResult?.noOp).toEqual(true);
        expect(mock_sdk_1.mockStepFunctionsClient).not.toHaveReceivedCommand(client_sfn_1.UpdateStateMachineCommand);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGUtbWFjaGluZS1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzdGF0ZS1tYWNoaW5lLWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUFnRTtBQUNoRSw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELGtEQUE4RDtBQUM5RCw4Q0FBK0M7QUFFL0MsSUFBSSxzQkFBb0QsQ0FBQztBQUV6RCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2Qsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFBQyxpRUFBaUUsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN2RixRQUFRO1FBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLGtDQUFrQztxQkFDekM7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDMUMsT0FBTztZQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUUzRyxPQUFPO1lBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDMUMsTUFBTSxDQUFDLGtDQUF1QixDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFx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LEVBQUU7d0JBQ1YsZ0JBQWdCLEVBQUUsdUJBQXVCO3dCQUN6QyxnQkFBZ0IsRUFBRSxZQUFZO3FCQUMvQjtvQkFDRCxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUM7aUJBQ25CO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsa0NBQWtDO3dCQUN4QyxVQUFVLEVBQUU7NEJBQ1YsZ0JBQWdCLEVBQUUsdUJBQXVCOzRCQUN6QyxnQkFBZ0IsRUFBRSxZQUFZO3lCQUMvQjtxQkFDRjtvQkFDRCxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUM7aUJBQ25CO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNHLE9BQU87UUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDOUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QyxNQUFNLENBQUMsa0NBQXVCLENBQUMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsc0NBQXlCLENBQUMsQ0FBQztJQUN2RixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zZm4nO1xuaW1wb3J0ICogYXMgc2V0dXAgZnJvbSAnLi9ob3Rzd2FwLXRlc3Qtc2V0dXAnO1xuaW1wb3J0IHsgSG90c3dhcE1vZGUgfSBmcm9tICcuLi8uLi8uLi9saWIvYXBpL2hvdHN3YXAvY29tbW9uJztcbmltcG9ydCB7IG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50IH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBUZXN0cygpO1xufSk7XG5cbmRlc2NyaWJlLmVhY2goW0hvdHN3YXBNb2RlLkZBTExfQkFDSywgSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZXSkoJyVwIG1vZGUnLCAoaG90c3dhcE1vZGUpID0+IHtcbiAgc2lsZW50VGVzdCgncmV0dXJucyB1bmRlZmluZWQgd2hlbiBhIG5ldyBTdGF0ZU1hY2hpbmUgaXMgYWRkZWQgdG8gdGhlIFN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0Py5ub09wKS50b0VxdWFsKHRydWUpO1xuICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgIH1cbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZVN0YXRlTWFjaGluZSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBkZWZpbml0aW9uU3RyaW5nIGNoYW5nZSB3aXRob3V0IEZuOjpKb2luIGluIGEgc3RhdGUgbWFjaGluZScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogJ3sgUHJvcDogXCJvbGQtdmFsdWVcIiB9JyxcbiAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFByb3A6IFwibmV3LXZhbHVlXCIgfScsXG4gICAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kLCB7XG4gICAgICAgIGRlZmluaXRpb246ICd7IFByb3A6IFwibmV3LXZhbHVlXCIgfScsXG4gICAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZVN0YXRlTWFjaGluZSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBkZWZpbml0aW9uU3RyaW5nIGNoYW5nZSB3aXRoIEZuOjpKb2luIGluIGEgc3RhdGUgbWFjaGluZScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzoge1xuICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFtcbiAgICAgICAgICAgICAgICAgICdcXG4nLFxuICAgICAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICAneycsXG4gICAgICAgICAgICAgICAgICAgICcgIFwiU3RhcnRBdFwiIDogXCJTdWNjZXNzU3RhdGVcIicsXG4gICAgICAgICAgICAgICAgICAgICcgIFwiU3RhdGVzXCIgOiB7JyxcbiAgICAgICAgICAgICAgICAgICAgJyAgICBcIlN1Y2Nlc3NTdGF0ZVwiOiB7JyxcbiAgICAgICAgICAgICAgICAgICAgJyAgICAgIFwiVHlwZVwiOiBcIlBhc3NcIicsXG4gICAgICAgICAgICAgICAgICAgICcgICAgICBcIlJlc3VsdFwiOiBcIlN1Y2Nlc3NcIicsXG4gICAgICAgICAgICAgICAgICAgICcgICAgICBcIkVuZFwiOiB0cnVlJyxcbiAgICAgICAgICAgICAgICAgICAgJyAgICB9JyxcbiAgICAgICAgICAgICAgICAgICAgJyAgfScsXG4gICAgICAgICAgICAgICAgICAgICd9JyxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6IHtcbiAgICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFtcbiAgICAgICAgICAgICAgICAgICAgJ1xcbicsXG4gICAgICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgICAneycsXG4gICAgICAgICAgICAgICAgICAgICAgJyAgXCJTdGFydEF0XCI6IFwiU3VjY2Vzc1N0YXRlXCIsJyxcbiAgICAgICAgICAgICAgICAgICAgICAnICBcIlN0YXRlc1wiOiB7JyxcbiAgICAgICAgICAgICAgICAgICAgICAnICAgIFwiU3VjY2Vzc1N0YXRlXCI6IHsnLFxuICAgICAgICAgICAgICAgICAgICAgICcgICAgICBcIlR5cGVcIjogXCJTdWNjZWVkXCInLFxuICAgICAgICAgICAgICAgICAgICAgICcgICAgfScsXG4gICAgICAgICAgICAgICAgICAgICAgJyAgfScsXG4gICAgICAgICAgICAgICAgICAgICAgJ30nLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCwge1xuICAgICAgICBkZWZpbml0aW9uOiBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICB7XG4gICAgICAgICAgICBTdGFydEF0OiAnU3VjY2Vzc1N0YXRlJyxcbiAgICAgICAgICAgIFN0YXRlczoge1xuICAgICAgICAgICAgICBTdWNjZXNzU3RhdGU6IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnU3VjY2VlZCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbnVsbCxcbiAgICAgICAgICAyLFxuICAgICAgICApLFxuICAgICAgICBzdGF0ZU1hY2hpbmVBcm46ICdhcm46c3dhOnN0YXRlczpoZXJlOjEyMzQ1Njc4OTAxMjpzdGF0ZU1hY2hpbmU6bXktbWFjaGluZScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVTdGF0ZU1hY2hpbmUoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBhIGNoYW5nZSB0byB0aGUgZGVmaW5pdGlvblN0cmluZyBpbiBhIHN0YXRlIG1hY2hpbmUgdGhhdCBoYXMgbm8gbmFtZScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogJ3sgXCJQcm9wXCIgOiBcIm9sZC12YWx1ZVwiIH0nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFwiUHJvcFwiIDogXCJuZXctdmFsdWVcIiB9JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ01hY2hpbmUnLFxuICAgICAgICAgICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCwge1xuICAgICAgICBkZWZpbml0aW9uOiAneyBcIlByb3BcIiA6IFwibmV3LXZhbHVlXCIgfScsXG4gICAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgZG9lcyBub3QgY2FsbCB0aGUgdXBkYXRlU3RhdGVNYWNoaW5lKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgYSBjaGFuZ2UgdG8gYSBwcm9wZXJ0eSB0aGF0IGlzIG5vdCB0aGUgZGVmaW5pdGlvblN0cmluZyBpbiBhIHN0YXRlIG1hY2hpbmVcbiAgICAgICAgYWxvbmdzaWRlIGEgaG90c3dhcHBhYmxlIGNoYW5nZSBpbiBDTEFTU0lDIG1vZGUgYnV0IGRvZXMgaW4gSE9UU1dBUF9PTkxZIG1vZGVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFwiUHJvcFwiIDogXCJvbGQtdmFsdWVcIiB9JyxcbiAgICAgICAgICAgICAgTG9nZ2luZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICAvLyBub24tZGVmaW5pdGlvblN0cmluZyBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgIEluY2x1ZGVFeGVjdXRpb25EYXRhOiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFwiUHJvcFwiIDogXCJuZXctdmFsdWVcIiB9JyxcbiAgICAgICAgICAgICAgICBMb2dnaW5nQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgSW5jbHVkZUV4ZWN1dGlvbkRhdGE6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdNYWNoaW5lJyxcbiAgICAgICAgICAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICdhcm46c3dhOnN0YXRlczpoZXJlOjEyMzQ1Njc4OTAxMjpzdGF0ZU1hY2hpbmU6bXktbWFjaGluZScsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kLCB7XG4gICAgICAgICAgZGVmaW5pdGlvbjogJ3sgXCJQcm9wXCIgOiBcIm5ldy12YWx1ZVwiIH0nLFxuICAgICAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdkb2VzIG5vdCBjYWxsIHRoZSB1cGRhdGVTdGF0ZU1hY2hpbmUoKSBBUEkgd2hlbiBhIHJlc291cmNlIGhhcyBhIERlZmluaXRpb25TdHJpbmcgcHJvcGVydHkgYnV0IGlzIG5vdCBhbiBBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZSBpcyBjaGFuZ2VkJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpOb3RTdGVwRnVuY3Rpb25zOjpOb3RTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiAneyBQcm9wOiBcIm9sZC12YWx1ZVwiIH0nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Tm90U3RlcEZ1bmN0aW9uczo6Tm90U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6ICd7IFByb3A6IFwibmV3LXZhbHVlXCIgfScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrU3RlcEZ1bmN0aW9uc0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTdGF0ZU1hY2hpbmVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdCgnY2FuIGNvcnJlY3RseSBob3Rzd2FwIG9sZCBzdHlsZSBzeW50aCBjaGFuZ2VzJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUGFyYW1ldGVyczogeyBBc3NldFBhcmFtMTogeyBUeXBlOiAnU3RyaW5nJyB9IH0sXG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogeyBSZWY6ICdBc3NldFBhcmFtMScgfSxcbiAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdtYWNoaW5lLW5hbWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUGFyYW1ldGVyczogeyBBc3NldFBhcmFtMjogeyBUeXBlOiBTdHJpbmcgfSB9LFxuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7IFJlZjogJ0Fzc2V0UGFyYW0yJyB9LFxuICAgICAgICAgICAgICBTdGF0ZU1hY2hpbmVOYW1lOiAnbWFjaGluZS1uYW1lJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgJ01hY2hpbmUnLFxuICAgICAgICAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAnYXJuOnN3YTpzdGF0ZXM6aGVyZToxMjM0NTY3ODkwMTI6c3RhdGVNYWNoaW5lOm15LW1hY2hpbmUnLFxuICAgICAgKSxcbiAgICApO1xuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCwge1xuICAgICAgQXNzZXRQYXJhbTI6ICdhc3NldC1wYXJhbS0yJyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQsIHtcbiAgICAgIGRlZmluaXRpb246ICdhc3NldC1wYXJhbS0yJyxcbiAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTptYWNoaW5lLW5hbWUnLFxuICAgIH0pO1xuICB9KTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlU3RhdGVNYWNoaW5lKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgYSBjaGFuZ2UgdG8gdGhlIGRlZmluaXRpb25TdHJpbmcgdGhhdCB1c2VzIEF0dHJpYnV0ZXMgaW4gYSBzdGF0ZSBtYWNoaW5lJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6IHtcbiAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbXG4gICAgICAgICAgICAgICAgICAnXFxuJyxcbiAgICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgJ3snLFxuICAgICAgICAgICAgICAgICAgICAnICBcIlN0YXJ0QXRcIiA6IFwiU3VjY2Vzc1N0YXRlXCInLFxuICAgICAgICAgICAgICAgICAgICAnICBcIlN0YXRlc1wiIDogeycsXG4gICAgICAgICAgICAgICAgICAgICcgICAgXCJTdWNjZXNzU3RhdGVcIjogeycsXG4gICAgICAgICAgICAgICAgICAgICcgICAgICBcIlR5cGVcIjogXCJTdWNjZWVkXCInLFxuICAgICAgICAgICAgICAgICAgICAnICAgIH0nLFxuICAgICAgICAgICAgICAgICAgICAnICB9JyxcbiAgICAgICAgICAgICAgICAgICAgJ30nLFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBTdGF0ZU1hY2hpbmVOYW1lOiAnbXktbWFjaGluZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJycsIFsnXCJSZXNvdXJjZVwiOiAnLCB7ICdGbjo6R2V0QXR0JzogWydGdW5jJywgJ0FybiddIH1dXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ01hY2hpbmUnLFxuICAgICAgICAgICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgICAgKSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ215LWZ1bmMnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCwge1xuICAgICAgICBkZWZpbml0aW9uOiAnXCJSZXNvdXJjZVwiOiBhcm46c3dhOmxhbWJkYTpoZXJlOjEyMzQ1Njc4OTAxMjpmdW5jdGlvbjpteS1mdW5jJyxcbiAgICAgICAgc3RhdGVNYWNoaW5lQXJuOiAnYXJuOnN3YTpzdGF0ZXM6aGVyZToxMjM0NTY3ODkwMTI6c3RhdGVNYWNoaW5lOm15LW1hY2hpbmUnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwid2lsbCBub3QgcGVyZm9ybSBhIGhvdHN3YXAgZGVwbG95bWVudCBpZiBpdCBjYW5ub3QgZmluZCBhIFJlZiB0YXJnZXQgKG91dHNpZGUgdGhlIHN0YXRlIG1hY2hpbmUncyBuYW1lKVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgfSxcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzoge1xuICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFsnJywgWyd7IFByb3A6IFwib2xkLXZhbHVlXCIgfSwgJywgJ3sgXCJQYXJhbVwiIDogJywgeyAnRm46OlN1Yic6ICcke1BhcmFtMX0nIH0sICcgfSddXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKCdNYWNoaW5lJywgJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJywgJ215LW1hY2hpbmUnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzoge1xuICAgICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogWycnLCBbJ3sgUHJvcDogXCJuZXctdmFsdWVcIiB9LCAnLCAneyBcIlBhcmFtXCIgOiAnLCB7ICdGbjo6U3ViJzogJyR7UGFyYW0xfScgfSwgJyB9J11dLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgYXdhaXQgZXhwZWN0KCgpID0+IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICAgIC9QYXJhbWV0ZXIgb3IgcmVzb3VyY2UgJ1BhcmFtMScgY291bGQgbm90IGJlIGZvdW5kIGZvciBldmFsdWF0aW9uLyxcbiAgICAgICk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwid2lsbCBub3QgcGVyZm9ybSBhIGhvdHN3YXAgZGVwbG95bWVudCBpZiBpdCBkb2Vzbid0IGtub3cgaG93IHRvIGhhbmRsZSBhIHNwZWNpZmljIGF0dHJpYnV0ZSAob3V0c2lkZSB0aGUgc3RhdGUgbWFjaGluZXMncyBuYW1lKVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogW1xuICAgICAgICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgICd7IFByb3A6IFwib2xkLXZhbHVlXCIgfSwgJyxcbiAgICAgICAgICAgICAgICAgICAgJ3sgXCJTM0J1Y2tldFwiIDogJyxcbiAgICAgICAgICAgICAgICAgICAgeyAnRm46OkdldEF0dCc6IFsnQnVja2V0JywgJ1Vua25vd25BdHRyaWJ1dGUnXSB9LFxuICAgICAgICAgICAgICAgICAgICAnIH0nLFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBTdGF0ZU1hY2hpbmVOYW1lOiAnbXktbWFjaGluZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnTWFjaGluZScsXG4gICAgICAgICAgJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAnYXJuOnN3YTpzdGF0ZXM6aGVyZToxMjM0NTY3ODkwMTI6c3RhdGVNYWNoaW5lOm15LW1hY2hpbmUnLFxuICAgICAgICApLFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignQnVja2V0JywgJ0FXUzo6UzM6OkJ1Y2tldCcsICdteS1idWNrZXQnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbXG4gICAgICAgICAgICAgICAgICAgICcnLFxuICAgICAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAgICAgJ3sgUHJvcDogXCJuZXctdmFsdWVcIiB9LCAnLFxuICAgICAgICAgICAgICAgICAgICAgICd7IFwiUzNCdWNrZXRcIiA6ICcsXG4gICAgICAgICAgICAgICAgICAgICAgeyAnRm46OkdldEF0dCc6IFsnQnVja2V0JywgJ1Vua25vd25BdHRyaWJ1dGUnXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICcgfScsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGF3YWl0IGV4cGVjdCgoKSA9PiBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgICBcIldlIGRvbid0IHN1cHBvcnQgdGhlICdVbmtub3duQXR0cmlidXRlJyBhdHRyaWJ1dGUgb2YgdGhlICdBV1M6OlMzOjpCdWNrZXQnIHJlc291cmNlLiBUaGlzIGlzIGEgQ0RLIGxpbWl0YXRpb24uIFBsZWFzZSByZXBvcnQgaXQgYXQgaHR0cHM6Ly9naXRodWIuY29tL2F3cy9hd3MtY2RrL2lzc3Vlcy9uZXcvY2hvb3NlXCIsXG4gICAgICApO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdCgna25vd3MgaG93IHRvIGhhbmRsZSBhdHRyaWJ1dGVzIG9mIHRoZSBBV1M6OkV2ZW50czo6RXZlbnRCdXMgcmVzb3VyY2UnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRXZlbnRCdXM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpFdmVudHM6OkV2ZW50QnVzJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBOYW1lOiAnbXktZXZlbnQtYnVzJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgICAgICdGbjo6Sm9pbic6IFtcbiAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAne1wiRXZlbnRCdXMxQXJuXCI6XCInLFxuICAgICAgICAgICAgICAgICAgeyAnRm46OkdldEF0dCc6IFsnRXZlbnRCdXMnLCAnQXJuJ10gfSxcbiAgICAgICAgICAgICAgICAgICdcIixcIkV2ZW50QnVzMU5hbWVcIjpcIicsXG4gICAgICAgICAgICAgICAgICB7ICdGbjo6R2V0QXR0JzogWydFdmVudEJ1cycsICdOYW1lJ10gfSxcbiAgICAgICAgICAgICAgICAgICdcIixcIkV2ZW50QnVzMVJlZlwiOlwiJyxcbiAgICAgICAgICAgICAgICAgIHsgUmVmOiAnRXZlbnRCdXMnIH0sXG4gICAgICAgICAgICAgICAgICAnXCJ9JyxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzZXR1cC5zdGFja1N1bW1hcnlPZignRXZlbnRCdXMnLCAnQVdTOjpFdmVudHM6OkV2ZW50QnVzJywgJ215LWV2ZW50LWJ1cycpKTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEV2ZW50QnVzOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpFdmVudHM6OkV2ZW50QnVzJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgTmFtZTogJ215LWV2ZW50LWJ1cycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzoge1xuICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFtcbiAgICAgICAgICAgICAgICAgICcnLFxuICAgICAgICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgICAgICAne1wiRXZlbnRCdXMyQXJuXCI6XCInLFxuICAgICAgICAgICAgICAgICAgICB7ICdGbjo6R2V0QXR0JzogWydFdmVudEJ1cycsICdBcm4nXSB9LFxuICAgICAgICAgICAgICAgICAgICAnXCIsXCJFdmVudEJ1czJOYW1lXCI6XCInLFxuICAgICAgICAgICAgICAgICAgICB7ICdGbjo6R2V0QXR0JzogWydFdmVudEJ1cycsICdOYW1lJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgJ1wiLFwiRXZlbnRCdXMyUmVmXCI6XCInLFxuICAgICAgICAgICAgICAgICAgICB7IFJlZjogJ0V2ZW50QnVzJyB9LFxuICAgICAgICAgICAgICAgICAgICAnXCJ9JyxcbiAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgIGV4cGVjdChyZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQsIHtcbiAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgIGRlZmluaXRpb246IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgRXZlbnRCdXMyQXJuOiAnYXJuOnN3YTpldmVudHM6aGVyZToxMjM0NTY3ODkwMTI6ZXZlbnQtYnVzL215LWV2ZW50LWJ1cycsXG4gICAgICAgIEV2ZW50QnVzMk5hbWU6ICdteS1ldmVudC1idXMnLFxuICAgICAgICBFdmVudEJ1czJSZWY6ICdteS1ldmVudC1idXMnLFxuICAgICAgfSksXG4gICAgfSk7XG4gIH0pO1xuXG4gIHNpbGVudFRlc3QoJ2tub3dzIGhvdyB0byBoYW5kbGUgYXR0cmlidXRlcyBvZiB0aGUgQVdTOjpEeW5hbW9EQjo6VGFibGUgcmVzb3VyY2UnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgVGFibGU6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpEeW5hbW9EQjo6VGFibGUnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIEtleVNjaGVtYTogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ25hbWUnLFxuICAgICAgICAgICAgICAgIEtleVR5cGU6ICdIQVNIJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBBdHRyaWJ1dGVEZWZpbml0aW9uczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ25hbWUnLFxuICAgICAgICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBCaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogJ3t9JyxcbiAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzZXR1cC5zdGFja1N1bW1hcnlPZignVGFibGUnLCAnQVdTOjpEeW5hbW9EQjo6VGFibGUnLCAnbXktZHluYW1vZGItdGFibGUnKSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBUYWJsZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RHluYW1vREI6OlRhYmxlJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ25hbWUnLFxuICAgICAgICAgICAgICAgICAgS2V5VHlwZTogJ0hBU0gnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIEF0dHJpYnV0ZURlZmluaXRpb25zOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ25hbWUnLFxuICAgICAgICAgICAgICAgICAgQXR0cmlidXRlVHlwZTogJ1MnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIEJpbGxpbmdNb2RlOiAnUEFZX1BFUl9SRVFVRVNUJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiB7XG4gICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogW1xuICAgICAgICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAgICAgICBbJ3tcIlRhYmxlTmFtZVwiOlwiJywgeyBSZWY6ICdUYWJsZScgfSwgJ1wiLFwiVGFibGVBcm5cIjpcIicsIHsgJ0ZuOjpHZXRBdHQnOiBbJ1RhYmxlJywgJ0FybiddIH0sICdcIn0nXSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBTdGF0ZU1hY2hpbmVOYW1lOiAnbXktbWFjaGluZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgZXhwZWN0KHJlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QobW9ja1N0ZXBGdW5jdGlvbnNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU3RhdGVNYWNoaW5lQ29tbWFuZCwge1xuICAgICAgc3RhdGVNYWNoaW5lQXJuOiAnYXJuOnN3YTpzdGF0ZXM6aGVyZToxMjM0NTY3ODkwMTI6c3RhdGVNYWNoaW5lOm15LW1hY2hpbmUnLFxuICAgICAgZGVmaW5pdGlvbjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBUYWJsZU5hbWU6ICdteS1keW5hbW9kYi10YWJsZScsXG4gICAgICAgIFRhYmxlQXJuOiAnYXJuOnN3YTpkeW5hbW9kYjpoZXJlOjEyMzQ1Njc4OTAxMjp0YWJsZS9teS1keW5hbW9kYi10YWJsZScsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgna25vd3MgaG93IHRvIGhhbmRsZSBhdHRyaWJ1dGVzIG9mIHRoZSBBV1M6OktNUzo6S2V5IHJlc291cmNlJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEtleToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OktNUzo6S2V5JyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBEZXNjcmlwdGlvbjogJ21hZ2ljLWtleScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogJ3t9JyxcbiAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzZXR1cC5zdGFja1N1bW1hcnlPZignS2V5JywgJ0FXUzo6S01TOjpLZXknLCAnYS1rZXknKSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBLZXk6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OktNUzo6S2V5JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRGVzY3JpcHRpb246ICdtYWdpYy1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1hY2hpbmU6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIERlZmluaXRpb25TdHJpbmc6IHtcbiAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbXG4gICAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICAgIFsne1wiS2V5SWRcIjpcIicsIHsgUmVmOiAnS2V5JyB9LCAnXCIsXCJLZXlBcm5cIjpcIicsIHsgJ0ZuOjpHZXRBdHQnOiBbJ0tleScsICdBcm4nXSB9LCAnXCJ9J10sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgU3RhdGVNYWNoaW5lTmFtZTogJ215LW1hY2hpbmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgIGV4cGVjdChyZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQsIHtcbiAgICAgIHN0YXRlTWFjaGluZUFybjogJ2Fybjpzd2E6c3RhdGVzOmhlcmU6MTIzNDU2Nzg5MDEyOnN0YXRlTWFjaGluZTpteS1tYWNoaW5lJyxcbiAgICAgIGRlZmluaXRpb246IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgS2V5SWQ6ICdhLWtleScsXG4gICAgICAgIEtleUFybjogJ2Fybjpzd2E6a21zOmhlcmU6MTIzNDU2Nzg5MDEyOmtleS9hLWtleScsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnZG9lcyBub3QgZXhwbG9kZSBpZiB0aGUgRGVwZW5kc09uIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTWFjaGluZToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OlN0ZXBGdW5jdGlvbnM6OlN0YXRlTWFjaGluZScsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRGVmaW5pdGlvblN0cmluZzogJ3sgUHJvcDogXCJvbGQtdmFsdWVcIiB9JyxcbiAgICAgICAgICAgIFN0YXRlTWFjaGluZU5hbWU6ICdteS1tYWNoaW5lJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIERlcGVuZHNPbjogWydhYmMnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBNYWNoaW5lOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTdGVwRnVuY3Rpb25zOjpTdGF0ZU1hY2hpbmUnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBEZWZpbml0aW9uU3RyaW5nOiAneyBQcm9wOiBcIm9sZC12YWx1ZVwiIH0nLFxuICAgICAgICAgICAgICBTdGF0ZU1hY2hpbmVOYW1lOiAnbXktbWFjaGluZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgRGVwZW5kc09uOiBbJ3h5eiddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gICAgZXhwZWN0KG1vY2tTdGVwRnVuY3Rpb25zQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVN0YXRlTWFjaGluZUNvbW1hbmQpO1xuICB9KTtcbn0pO1xuIl19