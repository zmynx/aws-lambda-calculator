"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
jest.mock('@aws-sdk/client-lambda', () => {
    const original = jest.requireActual('@aws-sdk/client-lambda');
    return {
        ...original,
        waitUntilFunctionUpdatedV2: jest.fn(),
    };
});
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('returns undefined when a new Lambda function is added to the Stack', async () => {
        // GIVEN
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)('calls the updateLambdaCode() API when it receives only a code difference in a Lambda function', async () => {
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
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)("correctly evaluates the function's name when it references a different resource from the template", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Bucket: {
                    Type: 'AWS::S3::Bucket',
                },
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
                        },
                        FunctionName: {
                            'Fn::Join': ['-', ['lambda', { Ref: 'Bucket' }, 'function']],
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Bucket', 'AWS::S3::Bucket', 'mybucket'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Bucket: {
                        Type: 'AWS::S3::Bucket',
                    },
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: {
                                'Fn::Join': ['-', ['lambda', { Ref: 'Bucket' }, 'function']],
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'old-path',
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
            FunctionName: 'lambda-mybucket-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)("correctly falls back to taking the function's name from the current stack if it can't evaluate it in the template", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                Param1: { Type: 'String' },
                AssetBucketParam: { Type: 'String' },
            },
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: { Ref: 'AssetBucketParam' },
                            S3Key: 'current-key',
                        },
                        FunctionName: { Ref: 'Param1' },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-function'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    Param1: { Type: 'String' },
                    AssetBucketParam: { Type: 'String' },
                },
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: { Ref: 'AssetBucketParam' },
                                S3Key: 'new-key',
                            },
                            FunctionName: { Ref: 'Param1' },
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact, {
            AssetBucketParam: 'asset-bucket',
        });
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'asset-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it cannot find a Ref target (outside the function's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                Param1: { Type: 'String' },
            },
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: { 'Fn::Sub': '${Param1}' },
                            S3Key: 'current-key',
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-func'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    Param1: { Type: 'String' },
                },
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: { 'Fn::Sub': '${Param1}' },
                                S3Key: 'new-key',
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // THEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow(/Parameter or resource 'Param1' could not be found for evaluation/);
    });
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it doesn't know how to handle a specific attribute (outside the function's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Bucket: {
                    Type: 'AWS::S3::Bucket',
                },
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                            S3Key: 'current-key',
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-func'), setup.stackSummaryOf('Bucket', 'AWS::S3::Bucket', 'my-bucket'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Bucket: {
                        Type: 'AWS::S3::Bucket',
                    },
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                                S3Key: 'new-key',
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // THEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow("We don't support the 'UnknownAttribute' attribute of the 'AWS::S3::Bucket' resource. This is a CDK limitation. Please report it at https://github.com/aws/aws-cdk/issues/new/choose");
    });
    (0, silent_1.silentTest)('calls the updateLambdaCode() API when it receives a code difference in a Lambda function with no name', async () => {
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
                    },
                    Metadata: {
                        'aws:asset:path': 'current-path',
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
                        },
                        Metadata: {
                            'aws:asset:path': 'current-path',
                        },
                    },
                },
            },
        });
        // WHEN
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'mock-function-resource-id'));
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'mock-function-resource-id',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('does not call the updateLambdaCode() API when it receives a change that is not a code difference in a Lambda function', async () => {
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
                        PackageType: 'Zip',
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
                                S3Key: 'current-key',
                            },
                            PackageType: 'Image',
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
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)(`when it receives a non-hotswappable change that includes a code difference in a Lambda function, it does not call the updateLambdaCode()
        API in CLASSIC mode but does in HOTSWAP_ONLY mode`, async () => {
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
                        PackageType: 'Zip',
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
                            PackageType: 'Image',
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
        }
    });
    (0, silent_1.silentTest)('does not call the updateLambdaCode() API when a resource with type that is not AWS::Lambda::Function but has the same properties is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::NotLambda::NotAFunction',
                    Properties: {
                        Code: {
                            S3Bucket: 'current-bucket',
                            S3Key: 'current-key',
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
                        Type: 'AWS::NotLambda::NotAFunction',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'old-path',
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
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
    });
    (0, silent_1.silentTest)('calls waiter after function code is updated with delay 1', async () => {
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
        // WHEN
        await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        expect(client_lambda_1.waitUntilFunctionUpdatedV2).toHaveBeenCalledWith(expect.objectContaining({
            minDelay: 1,
            maxDelay: 1,
            maxWaitTime: 1 * 60,
        }), { FunctionName: 'my-function' });
    });
    (0, silent_1.silentTest)('calls waiter after function code is updated and VpcId is empty string with delay 1', async () => {
        // GIVEN
        mock_sdk_1.mockLambdaClient.on(client_lambda_1.UpdateFunctionCodeCommand).resolves({
            VpcConfig: {
                VpcId: '',
            },
        });
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
        // WHEN
        await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(client_lambda_1.waitUntilFunctionUpdatedV2).toHaveBeenCalledWith(expect.objectContaining({
            minDelay: 1,
            maxDelay: 1,
            maxWaitTime: 1 * 60,
        }), { FunctionName: 'my-function' });
    });
    (0, silent_1.silentTest)('calls getFunction() after function code is updated on a VPC function with delay 5', async () => {
        // GIVEN
        mock_sdk_1.mockLambdaClient.on(client_lambda_1.UpdateFunctionCodeCommand).resolves({
            VpcConfig: {
                VpcId: 'abc',
            },
        });
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
        // WHEN
        await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(client_lambda_1.waitUntilFunctionUpdatedV2).toHaveBeenCalledWith(expect.objectContaining({
            minDelay: 5,
            maxDelay: 5,
            maxWaitTime: 5 * 60,
        }), { FunctionName: 'my-function' });
    });
    (0, silent_1.silentTest)('calls the updateLambdaConfiguration() API when it receives difference in Description field of a Lambda function', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 's3-bucket',
                            S3Key: 's3-key',
                        },
                        FunctionName: 'my-function',
                        Description: 'Old Description',
                    },
                    Metadata: {
                        'aws:asset:path': 'asset-path',
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
                                S3Bucket: 's3-bucket',
                                S3Key: 's3-key',
                            },
                            FunctionName: 'my-function',
                            Description: 'New Description',
                        },
                        Metadata: {
                            'aws:asset:path': 'asset-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionConfigurationCommand, {
            FunctionName: 'my-function',
            Description: 'New Description',
        });
    });
    (0, silent_1.silentTest)('calls the updateLambdaConfiguration() API when it receives difference in Environment field of a Lambda function', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 's3-bucket',
                            S3Key: 's3-key',
                        },
                        FunctionName: 'my-function',
                        Environment: {
                            Variables: {
                                Key1: 'Value1',
                                Key2: 'Value2',
                            },
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'asset-path',
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
                                S3Bucket: 's3-bucket',
                                S3Key: 's3-key',
                            },
                            FunctionName: 'my-function',
                            Environment: {
                                Variables: {
                                    Key1: 'Value1',
                                    Key2: 'Value2',
                                    NewKey: 'NewValue',
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'asset-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionConfigurationCommand, {
            FunctionName: 'my-function',
            Environment: {
                Variables: {
                    Key1: 'Value1',
                    Key2: 'Value2',
                    NewKey: 'NewValue',
                },
            },
        });
    });
    (0, silent_1.silentTest)('calls both updateLambdaCode() and updateLambdaConfiguration() API when it receives both code and configuration change', async () => {
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
                        Description: 'Old Description',
                    },
                    Metadata: {
                        'aws:asset:path': 'asset-path',
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
                                S3Bucket: 'new-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: 'my-function',
                            Description: 'New Description',
                        },
                        Metadata: {
                            'aws:asset:path': 'asset-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionConfigurationCommand, {
            FunctionName: 'my-function',
            Description: 'New Description',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'new-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('Lambda hotswap works properly with changes of environment variables and description with tokens', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                EventBus: {
                    Type: 'AWS::Events::EventBus',
                    Properties: {
                        Name: 'my-event-bus',
                    },
                },
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Bucket: 's3-bucket',
                            S3Key: 's3-key',
                        },
                        FunctionName: 'my-function',
                        Environment: {
                            Variables: {
                                token: { 'Fn::GetAtt': ['EventBus', 'Arn'] },
                                literal: 'oldValue',
                            },
                        },
                        Description: {
                            'Fn::Join': ['', ['oldValue', { 'Fn::GetAtt': ['EventBus', 'Arn'] }]],
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'asset-path',
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
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 's3-bucket',
                                S3Key: 's3-key',
                            },
                            FunctionName: 'my-function',
                            Environment: {
                                Variables: {
                                    token: { 'Fn::GetAtt': ['EventBus', 'Arn'] },
                                    literal: 'newValue',
                                },
                            },
                            Description: {
                                'Fn::Join': ['', ['newValue', { 'Fn::GetAtt': ['EventBus', 'Arn'] }]],
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'asset-path',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionConfigurationCommand, {
            FunctionName: 'my-function',
            Environment: {
                Variables: {
                    token: 'arn:swa:events:here:123456789012:event-bus/my-event-bus',
                    literal: 'newValue',
                },
            },
            Description: 'newValuearn:swa:events:here:123456789012:event-bus/my-event-bus',
        });
    });
    (0, silent_1.silentTest)('S3ObjectVersion is hotswappable', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            S3Key: 'current-key',
                            S3ObjectVersion: 'current-obj',
                        },
                        FunctionName: 'my-function',
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
                                S3Key: 'new-key',
                                S3ObjectVersion: 'new-obj',
                            },
                            FunctionName: 'my-function',
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
            FunctionName: 'my-function',
            S3Key: 'new-key',
            S3ObjectVersion: 'new-obj',
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWZ1bmN0aW9ucy1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYW1iZGEtZnVuY3Rpb25zLWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBEQUlnQztBQUNoQyw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELGtEQUF1RDtBQUN2RCw4Q0FBK0M7QUFFL0MsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7SUFDdkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQzlELE9BQU87UUFDTCxHQUFHLFFBQVE7UUFDWCwwQkFBMEIsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO0tBQ3RDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksc0JBQW9ELENBQUM7QUFFekQsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLHNCQUFzQixHQUFHLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0FBQ3JELENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLG9CQUFXLENBQUMsU0FBUyxFQUFFLG9CQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtJQUMxRixJQUFBLG1CQUFVLEVBQUMsb0VBQW9FLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDMUYsUUFBUTtRQUNSLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSx1QkFBdUI7cUJBQzlCO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLFdBQVcsS0FBSyxvQkFBVyxDQUFDLFNBQVMs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ZUFBZSxFQUFFLFNBQVM7U0FDM0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsXG4gIFVwZGF0ZUZ1bmN0aW9uQ29uZmlndXJhdGlvbkNvbW1hbmQsXG4gIHdhaXRVbnRpbEZ1bmN0aW9uVXBkYXRlZFYyLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtbGFtYmRhJztcbmltcG9ydCAqIGFzIHNldHVwIGZyb20gJy4vaG90c3dhcC10ZXN0LXNldHVwJztcbmltcG9ydCB7IEhvdHN3YXBNb2RlIH0gZnJvbSAnLi4vLi4vLi4vbGliL2FwaS9ob3Rzd2FwL2NvbW1vbic7XG5pbXBvcnQgeyBtb2NrTGFtYmRhQ2xpZW50IH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5qZXN0Lm1vY2soJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnLCAoKSA9PiB7XG4gIGNvbnN0IG9yaWdpbmFsID0gamVzdC5yZXF1aXJlQWN0dWFsKCdAYXdzLXNkay9jbGllbnQtbGFtYmRhJyk7XG4gIHJldHVybiB7XG4gICAgLi4ub3JpZ2luYWwsXG4gICAgd2FpdFVudGlsRnVuY3Rpb25VcGRhdGVkVjI6IGplc3QuZm4oKSxcbiAgfTtcbn0pO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBUZXN0cygpO1xufSk7XG5cbmRlc2NyaWJlLmVhY2goW0hvdHN3YXBNb2RlLkZBTExfQkFDSywgSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZXSkoJyVwIG1vZGUnLCAoaG90c3dhcE1vZGUpID0+IHtcbiAgc2lsZW50VGVzdCgncmV0dXJucyB1bmRlZmluZWQgd2hlbiBhIG5ldyBMYW1iZGEgZnVuY3Rpb24gaXMgYWRkZWQgdG8gdGhlIFN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgIH1cbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZUxhbWJkYUNvZGUoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgY29kZSBkaWZmZXJlbmNlIGluIGEgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwiY29ycmVjdGx5IGV2YWx1YXRlcyB0aGUgZnVuY3Rpb24ncyBuYW1lIHdoZW4gaXQgcmVmZXJlbmNlcyBhIGRpZmZlcmVudCByZXNvdXJjZSBmcm9tIHRoZSB0ZW1wbGF0ZVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6IHtcbiAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJy0nLCBbJ2xhbWJkYScsIHsgUmVmOiAnQnVja2V0JyB9LCAnZnVuY3Rpb24nXV0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0J1Y2tldCcsICdBV1M6OlMzOjpCdWNrZXQnLCAnbXlidWNrZXQnKSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7XG4gICAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJy0nLCBbJ2xhbWJkYScsIHsgUmVmOiAnQnVja2V0JyB9LCAnZnVuY3Rpb24nXV0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiAnbGFtYmRhLW15YnVja2V0LWZ1bmN0aW9uJyxcbiAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgXCJjb3JyZWN0bHkgZmFsbHMgYmFjayB0byB0YWtpbmcgdGhlIGZ1bmN0aW9uJ3MgbmFtZSBmcm9tIHRoZSBjdXJyZW50IHN0YWNrIGlmIGl0IGNhbid0IGV2YWx1YXRlIGl0IGluIHRoZSB0ZW1wbGF0ZVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICBBc3NldEJ1Y2tldFBhcmFtOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6IHsgUmVmOiAnQXNzZXRCdWNrZXRQYXJhbScgfSxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7IFJlZjogJ1BhcmFtMScgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzZXR1cC5zdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZnVuY3Rpb24nKSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICAgIEFzc2V0QnVja2V0UGFyYW06IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiB7IFJlZjogJ0Fzc2V0QnVja2V0UGFyYW0nIH0sXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7IFJlZjogJ1BhcmFtMScgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCwge1xuICAgICAgICBBc3NldEJ1Y2tldFBhcmFtOiAnYXNzZXQtYnVja2V0JyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgUzNCdWNrZXQ6ICdhc3NldC1idWNrZXQnLFxuICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwid2lsbCBub3QgcGVyZm9ybSBhIGhvdHN3YXAgZGVwbG95bWVudCBpZiBpdCBjYW5ub3QgZmluZCBhIFJlZiB0YXJnZXQgKG91dHNpZGUgdGhlIGZ1bmN0aW9uJ3MgbmFtZSlcIixcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgUGFyYW0xOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6IHsgJ0ZuOjpTdWInOiAnJHtQYXJhbTF9JyB9LFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKHNldHVwLnN0YWNrU3VtbWFyeU9mKCdGdW5jJywgJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsICdteS1mdW5jJykpO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgUGFyYW0xOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICBTM0J1Y2tldDogeyAnRm46OlN1Yic6ICcke1BhcmFtMX0nIH0sXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBhd2FpdCBleHBlY3QoKCkgPT4gaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCkpLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICAgL1BhcmFtZXRlciBvciByZXNvdXJjZSAnUGFyYW0xJyBjb3VsZCBub3QgYmUgZm91bmQgZm9yIGV2YWx1YXRpb24vLFxuICAgICAgKTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgXCJ3aWxsIG5vdCBwZXJmb3JtIGEgaG90c3dhcCBkZXBsb3ltZW50IGlmIGl0IGRvZXNuJ3Qga25vdyBob3cgdG8gaGFuZGxlIGEgc3BlY2lmaWMgYXR0cmlidXRlIChvdXRzaWRlIHRoZSBmdW5jdGlvbidzIG5hbWUpXCIsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQnVja2V0OiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6IHsgJ0ZuOjpHZXRBdHQnOiBbJ0J1Y2tldCcsICdVbmtub3duQXR0cmlidXRlJ10gfSxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ215LWZ1bmMnKSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0J1Y2tldCcsICdBV1M6OlMzOjpCdWNrZXQnLCAnbXktYnVja2V0JyksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBCdWNrZXQ6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiB7ICdGbjo6R2V0QXR0JzogWydCdWNrZXQnLCAnVW5rbm93bkF0dHJpYnV0ZSddIH0sXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBhd2FpdCBleHBlY3QoKCkgPT4gaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCkpLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICAgXCJXZSBkb24ndCBzdXBwb3J0IHRoZSAnVW5rbm93bkF0dHJpYnV0ZScgYXR0cmlidXRlIG9mIHRoZSAnQVdTOjpTMzo6QnVja2V0JyByZXNvdXJjZS4gVGhpcyBpcyBhIENESyBsaW1pdGF0aW9uLiBQbGVhc2UgcmVwb3J0IGl0IGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvbmV3L2Nob29zZVwiLFxuICAgICAgKTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVMYW1iZGFDb2RlKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgYSBjb2RlIGRpZmZlcmVuY2UgaW4gYSBMYW1iZGEgZnVuY3Rpb24gd2l0aCBubyBuYW1lJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdjdXJyZW50LXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnY3VycmVudC1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ21vY2stZnVuY3Rpb24tcmVzb3VyY2UtaWQnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICAgIEZ1bmN0aW9uTmFtZTogJ21vY2stZnVuY3Rpb24tcmVzb3VyY2UtaWQnLFxuICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnZG9lcyBub3QgY2FsbCB0aGUgdXBkYXRlTGFtYmRhQ29kZSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIGEgY2hhbmdlIHRoYXQgaXMgbm90IGEgY29kZSBkaWZmZXJlbmNlIGluIGEgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBQYWNrYWdlVHlwZTogJ1ppcCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBQYWNrYWdlVHlwZTogJ0ltYWdlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgd2hlbiBpdCByZWNlaXZlcyBhIG5vbi1ob3Rzd2FwcGFibGUgY2hhbmdlIHRoYXQgaW5jbHVkZXMgYSBjb2RlIGRpZmZlcmVuY2UgaW4gYSBMYW1iZGEgZnVuY3Rpb24sIGl0IGRvZXMgbm90IGNhbGwgdGhlIHVwZGF0ZUxhbWJkYUNvZGUoKVxuICAgICAgICBBUEkgaW4gQ0xBU1NJQyBtb2RlIGJ1dCBkb2VzIGluIEhPVFNXQVBfT05MWSBtb2RlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIFBhY2thZ2VUeXBlOiAnWmlwJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIFBhY2thZ2VUeXBlOiAnSW1hZ2UnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdkb2VzIG5vdCBjYWxsIHRoZSB1cGRhdGVMYW1iZGFDb2RlKCkgQVBJIHdoZW4gYSByZXNvdXJjZSB3aXRoIHR5cGUgdGhhdCBpcyBub3QgQVdTOjpMYW1iZGE6OkZ1bmN0aW9uIGJ1dCBoYXMgdGhlIHNhbWUgcHJvcGVydGllcyBpcyBjaGFuZ2VkJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpOb3RMYW1iZGE6Ok5vdEFGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Tm90TGFtYmRhOjpOb3RBRnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdCgnY2FsbHMgd2FpdGVyIGFmdGVyIGZ1bmN0aW9uIGNvZGUgaXMgdXBkYXRlZCB3aXRoIGRlbGF5IDEnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRnVuYzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICBleHBlY3Qod2FpdFVudGlsRnVuY3Rpb25VcGRhdGVkVjIpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBtaW5EZWxheTogMSxcbiAgICAgICAgbWF4RGVsYXk6IDEsXG4gICAgICAgIG1heFdhaXRUaW1lOiAxICogNjAsXG4gICAgICB9KSxcbiAgICAgIHsgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nIH0sXG4gICAgKTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnY2FsbHMgd2FpdGVyIGFmdGVyIGZ1bmN0aW9uIGNvZGUgaXMgdXBkYXRlZCBhbmQgVnBjSWQgaXMgZW1wdHkgc3RyaW5nIHdpdGggZGVsYXkgMScsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tMYW1iZGFDbGllbnQub24oVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgVnBjQ29uZmlnOiB7XG4gICAgICAgIFZwY0lkOiAnJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdCh3YWl0VW50aWxGdW5jdGlvblVwZGF0ZWRWMikudG9IYXZlQmVlbkNhbGxlZFdpdGgoXG4gICAgICBleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgICAgIG1pbkRlbGF5OiAxLFxuICAgICAgICBtYXhEZWxheTogMSxcbiAgICAgICAgbWF4V2FpdFRpbWU6IDEgKiA2MCxcbiAgICAgIH0pLFxuICAgICAgeyBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicgfSxcbiAgICApO1xuICB9KTtcblxuICBzaWxlbnRUZXN0KCdjYWxscyBnZXRGdW5jdGlvbigpIGFmdGVyIGZ1bmN0aW9uIGNvZGUgaXMgdXBkYXRlZCBvbiBhIFZQQyBmdW5jdGlvbiB3aXRoIGRlbGF5IDUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrTGFtYmRhQ2xpZW50Lm9uKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFZwY0NvbmZpZzoge1xuICAgICAgICBWcGNJZDogJ2FiYycsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3Qod2FpdFVudGlsRnVuY3Rpb25VcGRhdGVkVjIpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKFxuICAgICAgZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xuICAgICAgICBtaW5EZWxheTogNSxcbiAgICAgICAgbWF4RGVsYXk6IDUsXG4gICAgICAgIG1heFdhaXRUaW1lOiA1ICogNjAsXG4gICAgICB9KSxcbiAgICAgIHsgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nIH0sXG4gICAgKTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZUxhbWJkYUNvbmZpZ3VyYXRpb24oKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBkaWZmZXJlbmNlIGluIERlc2NyaXB0aW9uIGZpZWxkIG9mIGEgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnczMtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ3MzLWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgRGVzY3JpcHRpb246ICdPbGQgRGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdhc3NldC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdzMy1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdzMy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnTmV3IERlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnYXNzZXQtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db25maWd1cmF0aW9uQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIERlc2NyaXB0aW9uOiAnTmV3IERlc2NyaXB0aW9uJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZUxhbWJkYUNvbmZpZ3VyYXRpb24oKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBkaWZmZXJlbmNlIGluIEVudmlyb25tZW50IGZpZWxkIG9mIGEgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnczMtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ3MzLWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICAgICAgICAgIEtleTE6ICdWYWx1ZTEnLFxuICAgICAgICAgICAgICAgICAgS2V5MjogJ1ZhbHVlMicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnYXNzZXQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnczMtYnVja2V0JyxcbiAgICAgICAgICAgICAgICAgIFMzS2V5OiAnczMta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICBFbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgICAgICAgICAgIEtleTE6ICdWYWx1ZTEnLFxuICAgICAgICAgICAgICAgICAgICBLZXkyOiAnVmFsdWUyJyxcbiAgICAgICAgICAgICAgICAgICAgTmV3S2V5OiAnTmV3VmFsdWUnLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdhc3NldC1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvbmZpZ3VyYXRpb25Db21tYW5kLCB7XG4gICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICAgIEtleTE6ICdWYWx1ZTEnLFxuICAgICAgICAgICAgS2V5MjogJ1ZhbHVlMicsXG4gICAgICAgICAgICBOZXdLZXk6ICdOZXdWYWx1ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgYm90aCB1cGRhdGVMYW1iZGFDb2RlKCkgYW5kIHVwZGF0ZUxhbWJkYUNvbmZpZ3VyYXRpb24oKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBib3RoIGNvZGUgYW5kIGNvbmZpZ3VyYXRpb24gY2hhbmdlJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnT2xkIERlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnYXNzZXQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnTmV3IERlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnYXNzZXQtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db25maWd1cmF0aW9uQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIERlc2NyaXB0aW9uOiAnTmV3IERlc2NyaXB0aW9uJyxcbiAgICAgIH0pO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ0xhbWJkYSBob3Rzd2FwIHdvcmtzIHByb3Blcmx5IHdpdGggY2hhbmdlcyBvZiBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYW5kIGRlc2NyaXB0aW9uIHdpdGggdG9rZW5zJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBFdmVudEJ1czoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RXZlbnRzOjpFdmVudEJ1cycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIE5hbWU6ICdteS1ldmVudC1idXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdzMy1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnczMta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICBFbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgICAgICAgdG9rZW46IHsgJ0ZuOjpHZXRBdHQnOiBbJ0V2ZW50QnVzJywgJ0FybiddIH0sXG4gICAgICAgICAgICAgICAgICBsaXRlcmFsOiAnb2xkVmFsdWUnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIERlc2NyaXB0aW9uOiB7XG4gICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogWycnLCBbJ29sZFZhbHVlJywgeyAnRm46OkdldEF0dCc6IFsnRXZlbnRCdXMnLCAnQXJuJ10gfV1dLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdhc3NldC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzZXR1cC5zdGFja1N1bW1hcnlPZignRXZlbnRCdXMnLCAnQVdTOjpFdmVudHM6OkV2ZW50QnVzJywgJ215LWV2ZW50LWJ1cycpKTtcblxuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBFdmVudEJ1czoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpFdmVudHM6OkV2ZW50QnVzJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1ldmVudC1idXMnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ3MzLWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ3MzLWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgICAgICAgICB0b2tlbjogeyAnRm46OkdldEF0dCc6IFsnRXZlbnRCdXMnLCAnQXJuJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgbGl0ZXJhbDogJ25ld1ZhbHVlJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBEZXNjcmlwdGlvbjoge1xuICAgICAgICAgICAgICAgICAgJ0ZuOjpKb2luJzogWycnLCBbJ25ld1ZhbHVlJywgeyAnRm46OkdldEF0dCc6IFsnRXZlbnRCdXMnLCAnQXJuJ10gfV1dLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ2Fzc2V0LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29uZmlndXJhdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICBFbnZpcm9ubWVudDoge1xuICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgdG9rZW46ICdhcm46c3dhOmV2ZW50czpoZXJlOjEyMzQ1Njc4OTAxMjpldmVudC1idXMvbXktZXZlbnQtYnVzJyxcbiAgICAgICAgICAgIGxpdGVyYWw6ICduZXdWYWx1ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgRGVzY3JpcHRpb246ICduZXdWYWx1ZWFybjpzd2E6ZXZlbnRzOmhlcmU6MTIzNDU2Nzg5MDEyOmV2ZW50LWJ1cy9teS1ldmVudC1idXMnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KCdTM09iamVjdFZlcnNpb24gaXMgaG90c3dhcHBhYmxlJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICBTM09iamVjdFZlcnNpb246ICdjdXJyZW50LW9iaicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICAgIFMzT2JqZWN0VmVyc2lvbjogJ25ldy1vYmonLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICBTM09iamVjdFZlcnNpb246ICduZXctb2JqJyxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==