"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const s3_bucket_deployments_1 = require("../../../lib/api/hotswap/s3-bucket-deployments");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
const payloadWithoutCustomResProps = {
    RequestType: 'Update',
    ResponseURL: s3_bucket_deployments_1.REQUIRED_BY_CFN,
    PhysicalResourceId: s3_bucket_deployments_1.REQUIRED_BY_CFN,
    StackId: s3_bucket_deployments_1.REQUIRED_BY_CFN,
    RequestId: s3_bucket_deployments_1.REQUIRED_BY_CFN,
    LogicalResourceId: s3_bucket_deployments_1.REQUIRED_BY_CFN,
};
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('calls the lambdaInvoke() API when it receives only an asset difference in an S3 bucket deployment and evaluates CFN expressions in S3 Deployment Properties', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                S3Deployment: {
                    Type: 'Custom::CDKBucketDeployment',
                    Properties: {
                        ServiceToken: 'a-lambda-arn',
                        SourceBucketNames: ['src-bucket'],
                        SourceObjectKeys: ['src-key-old'],
                        DestinationBucketName: 'dest-bucket',
                        DestinationBucketKeyPrefix: 'my-key/some-old-prefix',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    S3Deployment: {
                        Type: 'Custom::CDKBucketDeployment',
                        Properties: {
                            ServiceToken: 'a-lambda-arn',
                            SourceBucketNames: ['src-bucket'],
                            SourceObjectKeys: {
                                'Fn::Split': ['-', 'key1-key2-key3'],
                            },
                            DestinationBucketName: 'dest-bucket',
                            DestinationBucketKeyPrefix: 'my-key/some-new-prefix',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
            FunctionName: 'a-lambda-arn',
            Payload: JSON.stringify({
                ...payloadWithoutCustomResProps,
                ResourceProperties: {
                    SourceBucketNames: ['src-bucket'],
                    SourceObjectKeys: ['key1', 'key2', 'key3'],
                    DestinationBucketName: 'dest-bucket',
                    DestinationBucketKeyPrefix: 'my-key/some-new-prefix',
                },
            }),
        });
    });
    (0, silent_1.silentTest)('does not call the invoke() API when a resource with type that is not Custom::CDKBucketDeployment but has the same properties is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                S3Deployment: {
                    Type: 'Custom::NotCDKBucketDeployment',
                    Properties: {
                        SourceObjectKeys: ['src-key-old'],
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    S3Deployment: {
                        Type: 'Custom::NotCDKBucketDeployment',
                        Properties: {
                            SourceObjectKeys: ['src-key-new'],
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
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
        }
    });
    (0, silent_1.silentTest)('does not call the invokeLambda() api if the updated Policy has no Roles in CLASSIC mode but does in HOTSWAP_ONLY mode', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                WebsiteBucketParamOld: { Type: 'String' },
                WebsiteBucketParamNew: { Type: 'String' },
            },
            Resources: {
                S3Deployment: {
                    Type: 'Custom::CDKBucketDeployment',
                    Properties: {
                        ServiceToken: 'a-lambda-arn',
                        SourceObjectKeys: ['src-key-old'],
                        SourceBucketNames: ['src-bucket'],
                        DestinationBucketName: 'dest-bucket',
                    },
                },
                Policy: {
                    Type: 'AWS::IAM::Policy',
                    Properties: {
                        PolicyName: 'my-policy',
                        PolicyDocument: {
                            Statement: [
                                {
                                    Action: ['s3:GetObject*'],
                                    Effect: 'Allow',
                                    Resource: {
                                        Ref: 'WebsiteBucketParamOld',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    WebsiteBucketParamOld: { Type: 'String' },
                    WebsiteBucketParamNew: { Type: 'String' },
                },
                Resources: {
                    S3Deployment: {
                        Type: 'Custom::CDKBucketDeployment',
                        Properties: {
                            ServiceToken: 'a-lambda-arn',
                            SourceObjectKeys: ['src-key-new'],
                            SourceBucketNames: ['src-bucket'],
                            DestinationBucketName: 'dest-bucket',
                        },
                    },
                    Policy: {
                        Type: 'AWS::IAM::Policy',
                        Properties: {
                            PolicyName: 'my-policy',
                            PolicyDocument: {
                                Statement: [
                                    {
                                        Action: ['s3:GetObject*'],
                                        Effect: 'Allow',
                                        Resource: {
                                            Ref: 'WebsiteBucketParamNew',
                                        },
                                    },
                                ],
                            },
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
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                FunctionName: 'a-lambda-arn',
                Payload: JSON.stringify({
                    ...payloadWithoutCustomResProps,
                    ResourceProperties: {
                        SourceObjectKeys: ['src-key-new'],
                        SourceBucketNames: ['src-bucket'],
                        DestinationBucketName: 'dest-bucket',
                    },
                }),
            });
        }
    });
    (0, silent_1.silentTest)('throws an error when the serviceToken fails evaluation in the template', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                S3Deployment: {
                    Type: 'Custom::CDKBucketDeployment',
                    Properties: {
                        ServiceToken: {
                            Ref: 'BadLamba',
                        },
                        SourceBucketNames: ['src-bucket'],
                        SourceObjectKeys: ['src-key-old'],
                        DestinationBucketName: 'dest-bucket',
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    S3Deployment: {
                        Type: 'Custom::CDKBucketDeployment',
                        Properties: {
                            ServiceToken: {
                                Ref: 'BadLamba',
                            },
                            SourceBucketNames: ['src-bucket'],
                            SourceObjectKeys: ['src-key-new'],
                            DestinationBucketName: 'dest-bucket',
                        },
                    },
                },
            },
        });
        // WHEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow(/Parameter or resource 'BadLamba' could not be found for evaluation/);
        expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
    });
    describe('old-style synthesis', () => {
        const parameters = {
            WebsiteBucketParamOld: { Type: 'String' },
            WebsiteBucketParamNew: { Type: 'String' },
            DifferentBucketParamNew: { Type: 'String' },
        };
        const serviceRole = {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Statement: [
                        {
                            Action: 'sts:AssumeRole',
                            Effect: 'Allow',
                            Principal: {
                                Service: 'lambda.amazonaws.com',
                            },
                        },
                    ],
                    Version: '2012-10-17',
                },
            },
        };
        const policyOld = {
            Type: 'AWS::IAM::Policy',
            Properties: {
                PolicyName: 'my-policy-old',
                Roles: [{ Ref: 'ServiceRole' }],
                PolicyDocument: {
                    Statement: [
                        {
                            Action: ['s3:GetObject*'],
                            Effect: 'Allow',
                            Resource: {
                                Ref: 'WebsiteBucketParamOld',
                            },
                        },
                    ],
                },
            },
        };
        const policyNew = {
            Type: 'AWS::IAM::Policy',
            Properties: {
                PolicyName: 'my-policy-new',
                Roles: [{ Ref: 'ServiceRole' }],
                PolicyDocument: {
                    Statement: [
                        {
                            Action: ['s3:GetObject*'],
                            Effect: 'Allow',
                            Resource: {
                                Ref: 'WebsiteBucketParamNew',
                            },
                        },
                    ],
                },
            },
        };
        const policy2Old = {
            Type: 'AWS::IAM::Policy',
            Properties: {
                PolicyName: 'my-policy-old-2',
                Roles: [{ Ref: 'ServiceRole' }],
                PolicyDocument: {
                    Statement: [
                        {
                            Action: ['s3:GetObject*'],
                            Effect: 'Allow',
                            Resource: {
                                Ref: 'WebsiteBucketParamOld',
                            },
                        },
                    ],
                },
            },
        };
        const policy2New = {
            Type: 'AWS::IAM::Policy',
            Properties: {
                PolicyName: 'my-policy-new-2',
                Roles: [{ Ref: 'ServiceRole2' }],
                PolicyDocument: {
                    Statement: [
                        {
                            Action: ['s3:GetObject*'],
                            Effect: 'Allow',
                            Resource: {
                                Ref: 'DifferentBucketParamOld',
                            },
                        },
                    ],
                },
            },
        };
        const deploymentLambda = {
            Type: 'AWS::Lambda::Function',
            Role: {
                'Fn::GetAtt': ['ServiceRole', 'Arn'],
            },
        };
        const s3DeploymentOld = {
            Type: 'Custom::CDKBucketDeployment',
            Properties: {
                ServiceToken: {
                    'Fn::GetAtt': ['S3DeploymentLambda', 'Arn'],
                },
                SourceBucketNames: ['src-bucket-old'],
                SourceObjectKeys: ['src-key-old'],
                DestinationBucketName: 'WebsiteBucketOld',
            },
        };
        const s3DeploymentNew = {
            Type: 'Custom::CDKBucketDeployment',
            Properties: {
                ServiceToken: {
                    'Fn::GetAtt': ['S3DeploymentLambda', 'Arn'],
                },
                SourceBucketNames: ['src-bucket-new'],
                SourceObjectKeys: ['src-key-new'],
                DestinationBucketName: 'WebsiteBucketNew',
            },
        };
        beforeEach(() => {
            setup.pushStackResourceSummaries(setup.stackSummaryOf('S3DeploymentLambda', 'AWS::Lambda::Function', 'my-deployment-lambda'), setup.stackSummaryOf('ServiceRole', 'AWS::IAM::Role', 'my-service-role'));
        });
        (0, silent_1.silentTest)('calls the lambdaInvoke() API when it receives an asset difference in an S3 bucket deployment and an IAM Policy difference using old-style synthesis', async () => {
            // GIVEN
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    Parameters: parameters,
                    ServiceRole: serviceRole,
                    Policy: policyOld,
                    S3DeploymentLambda: deploymentLambda,
                    S3Deployment: s3DeploymentOld,
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        Parameters: parameters,
                        ServiceRole: serviceRole,
                        Policy: policyNew,
                        S3DeploymentLambda: deploymentLambda,
                        S3Deployment: s3DeploymentNew,
                    },
                },
            });
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact, {
                WebsiteBucketParamOld: 'WebsiteBucketOld',
                WebsiteBucketParamNew: 'WebsiteBucketNew',
            });
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                Payload: JSON.stringify({
                    ...payloadWithoutCustomResProps,
                    ResourceProperties: {
                        SourceBucketNames: ['src-bucket-new'],
                        SourceObjectKeys: ['src-key-new'],
                        DestinationBucketName: 'WebsiteBucketNew',
                    },
                }),
            });
        });
        (0, silent_1.silentTest)(`does not call the lambdaInvoke() API when the difference in the S3 deployment is referred to in one IAM policy change but not another
          in CLASSIC mode but does in HOTSWAP_ONLY`, async () => {
            // GIVEN
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    ServiceRole: serviceRole,
                    Policy1: policyOld,
                    Policy2: policy2Old,
                    S3DeploymentLambda: deploymentLambda,
                    S3Deployment: s3DeploymentOld,
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        ServiceRole: serviceRole,
                        Policy1: policyNew,
                        Policy2: {
                            Properties: {
                                Roles: [{ Ref: 'ServiceRole' }, 'different-role'],
                                PolicyDocument: {
                                    Statement: [
                                        {
                                            Action: ['s3:GetObject*'],
                                            Effect: 'Allow',
                                            Resource: {
                                                'Fn::GetAtt': ['DifferentBucketNew', 'Arn'],
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                        S3DeploymentLambda: deploymentLambda,
                        S3Deployment: s3DeploymentNew,
                    },
                },
            });
            if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
            }
            else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).not.toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                    FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                    Payload: JSON.stringify({
                        ...payloadWithoutCustomResProps,
                        ResourceProperties: {
                            SourceBucketNames: ['src-bucket-new'],
                            SourceObjectKeys: ['src-key-new'],
                            DestinationBucketName: 'WebsiteBucketNew',
                        },
                    }),
                });
            }
        });
        (0, silent_1.silentTest)(`does not call the lambdaInvoke() API when the lambda that references the role is referred to by something other than an S3 deployment
          in CLASSIC mode but does in HOTSWAP_ONLY mode`, async () => {
            // GIVEN
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    ServiceRole: serviceRole,
                    Policy: policyOld,
                    S3DeploymentLambda: deploymentLambda,
                    S3Deployment: s3DeploymentOld,
                    Endpoint: {
                        Type: 'AWS::Lambda::Permission',
                        Properties: {
                            Action: 'lambda:InvokeFunction',
                            FunctionName: {
                                'Fn::GetAtt': ['S3DeploymentLambda', 'Arn'],
                            },
                            Principal: 'apigateway.amazonaws.com',
                        },
                    },
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        ServiceRole: serviceRole,
                        Policy: policyNew,
                        S3DeploymentLambda: deploymentLambda,
                        S3Deployment: s3DeploymentNew,
                        Endpoint: {
                            Type: 'AWS::Lambda::Permission',
                            Properties: {
                                Action: 'lambda:InvokeFunction',
                                FunctionName: {
                                    'Fn::GetAtt': ['S3DeploymentLambda', 'Arn'],
                                },
                                Principal: 'apigateway.amazonaws.com',
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
                expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
            }
            else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).not.toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                    FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                    Payload: JSON.stringify({
                        ...payloadWithoutCustomResProps,
                        ResourceProperties: {
                            SourceBucketNames: ['src-bucket-new'],
                            SourceObjectKeys: ['src-key-new'],
                            DestinationBucketName: 'WebsiteBucketNew',
                        },
                    }),
                });
            }
        });
        (0, silent_1.silentTest)('calls the lambdaInvoke() API when it receives an asset difference in two S3 bucket deployments and IAM Policy differences using old-style synthesis', async () => {
            // GIVEN
            const deploymentLambda2Old = {
                Type: 'AWS::Lambda::Function',
                Role: {
                    'Fn::GetAtt': ['ServiceRole', 'Arn'],
                },
            };
            const deploymentLambda2New = {
                Type: 'AWS::Lambda::Function',
                Role: {
                    'Fn::GetAtt': ['ServiceRole2', 'Arn'],
                },
            };
            const s3Deployment2Old = {
                Type: 'Custom::CDKBucketDeployment',
                Properties: {
                    ServiceToken: {
                        'Fn::GetAtt': ['S3DeploymentLambda2', 'Arn'],
                    },
                    SourceBucketNames: ['src-bucket-old'],
                    SourceObjectKeys: ['src-key-old'],
                    DestinationBucketName: 'DifferentBucketOld',
                },
            };
            const s3Deployment2New = {
                Type: 'Custom::CDKBucketDeployment',
                Properties: {
                    ServiceToken: {
                        'Fn::GetAtt': ['S3DeploymentLambda2', 'Arn'],
                    },
                    SourceBucketNames: ['src-bucket-new'],
                    SourceObjectKeys: ['src-key-new'],
                    DestinationBucketName: 'DifferentBucketNew',
                },
            };
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    ServiceRole: serviceRole,
                    ServiceRole2: serviceRole,
                    Policy1: policyOld,
                    Policy2: policy2Old,
                    S3DeploymentLambda: deploymentLambda,
                    S3DeploymentLambda2: deploymentLambda2Old,
                    S3Deployment: s3DeploymentOld,
                    S3Deployment2: s3Deployment2Old,
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        Parameters: parameters,
                        ServiceRole: serviceRole,
                        ServiceRole2: serviceRole,
                        Policy1: policyNew,
                        Policy2: policy2New,
                        S3DeploymentLambda: deploymentLambda,
                        S3DeploymentLambda2: deploymentLambda2New,
                        S3Deployment: s3DeploymentNew,
                        S3Deployment2: s3Deployment2New,
                    },
                },
            });
            // WHEN
            setup.pushStackResourceSummaries(setup.stackSummaryOf('S3DeploymentLambda2', 'AWS::Lambda::Function', 'my-deployment-lambda-2'), setup.stackSummaryOf('ServiceRole2', 'AWS::IAM::Role', 'my-service-role-2'));
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact, {
                WebsiteBucketParamOld: 'WebsiteBucketOld',
                WebsiteBucketParamNew: 'WebsiteBucketNew',
                DifferentBucketParamNew: 'WebsiteBucketNew',
            });
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                Payload: JSON.stringify({
                    ...payloadWithoutCustomResProps,
                    ResourceProperties: {
                        SourceBucketNames: ['src-bucket-new'],
                        SourceObjectKeys: ['src-key-new'],
                        DestinationBucketName: 'WebsiteBucketNew',
                    },
                }),
            });
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda-2',
                Payload: JSON.stringify({
                    ...payloadWithoutCustomResProps,
                    ResourceProperties: {
                        SourceBucketNames: ['src-bucket-new'],
                        SourceObjectKeys: ['src-key-new'],
                        DestinationBucketName: 'DifferentBucketNew',
                    },
                }),
            });
        });
        (0, silent_1.silentTest)(`does not call the lambdaInvoke() API when it receives an asset difference in an S3 bucket deployment that references two different policies
          in CLASSIC mode but does in HOTSWAP_ONLY mode`, async () => {
            // GIVEN
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    ServiceRole: serviceRole,
                    Policy1: policyOld,
                    Policy2: policy2Old,
                    S3DeploymentLambda: deploymentLambda,
                    S3Deployment: s3DeploymentOld,
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        ServiceRole: serviceRole,
                        Policy1: policyNew,
                        Policy2: {
                            Properties: {
                                Roles: [{ Ref: 'ServiceRole' }],
                                PolicyDocument: {
                                    Statement: [
                                        {
                                            Action: ['s3:GetObject*'],
                                            Effect: 'Allow',
                                            Resource: {
                                                'Fn::GetAtt': ['DifferentBucketNew', 'Arn'],
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                        S3DeploymentLambda: deploymentLambda,
                        S3Deployment: s3DeploymentNew,
                    },
                },
            });
            if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
            }
            else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).not.toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                    FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                    Payload: JSON.stringify({
                        ...payloadWithoutCustomResProps,
                        ResourceProperties: {
                            SourceBucketNames: ['src-bucket-new'],
                            SourceObjectKeys: ['src-key-new'],
                            DestinationBucketName: 'WebsiteBucketNew',
                        },
                    }),
                });
            }
        });
        (0, silent_1.silentTest)(`does not call the lambdaInvoke() API when a policy is referenced by a resource that is not an S3 deployment
          in CLASSIC mode but does in HOTSWAP_ONLY mode`, async () => {
            // GIVEN
            setup.setCurrentCfnStackTemplate({
                Resources: {
                    ServiceRole: serviceRole,
                    Policy1: policyOld,
                    S3DeploymentLambda: deploymentLambda,
                    S3Deployment: s3DeploymentOld,
                    NotADeployment: {
                        Type: 'AWS::Not::S3Deployment',
                        Properties: {
                            Prop: {
                                Ref: 'ServiceRole',
                            },
                        },
                    },
                },
            });
            const cdkStackArtifact = setup.cdkStackArtifactOf({
                template: {
                    Resources: {
                        ServiceRole: serviceRole,
                        Policy1: policyNew,
                        S3DeploymentLambda: deploymentLambda,
                        S3Deployment: s3DeploymentNew,
                        NotADeployment: {
                            Type: 'AWS::Not::S3Deployment',
                            Properties: {
                                Prop: {
                                    Ref: 'ServiceRole',
                                },
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
                expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.InvokeCommand);
            }
            else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
                // WHEN
                const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
                // THEN
                expect(deployStackResult).not.toBeUndefined();
                expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.InvokeCommand, {
                    FunctionName: 'arn:swa:lambda:here:123456789012:function:my-deployment-lambda',
                    Payload: JSON.stringify({
                        ...payloadWithoutCustomResProps,
                        ResourceProperties: {
                            SourceBucketNames: ['src-bucket-new'],
                            SourceObjectKeys: ['src-key-new'],
                            DestinationBucketName: 'WebsiteBucketNew',
                        },
                    }),
                });
            }
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiczMtYnVja2V0LWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInMzLWJ1Y2tldC1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwwREFBdUQ7QUFDdkQsOENBQThDO0FBQzlDLDREQUE4RDtBQUM5RCwwRkFBaUY7QUFDakYsa0RBQXVEO0FBQ3ZELDhDQUErQztBQUUvQyxJQUFJLHNCQUFvRCxDQUFDO0FBRXpELE1BQU0sNEJBQTRCLEdBQUc7SUFDbkMsV0FBVyxFQUFFLFFBQVE7SUFDckIsV0FBVyxFQUFFLHVDQUFlO0lBQzVCLGtCQUFrQixFQUFFLHVDQUFlO0lBQ25DLE9BQU8sRUFBRSx1Q0FBZTtJQUN4QixTQUFTLEVBQUUsdUNBQWU7SUFDMUIsaUJBQWlCLEVBQUUsdUNBQWU7Q0FDbkMsQ0FBQztBQUVGLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxzQkFBc0IsR0FBRyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxvQkFBVyxDQUFDLFNBQVMsRUFBRSxvQkFBVyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7SUFDMUYsSUFBQSxtQkFBVSxFQUNSLDZKQUE2SixFQUM3SixLQUFLLElBQUksRUFBRTtRQUNULFFBQVE7UUFDUixLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsU0FBUyxFQUFFO2dCQUNULFlBQVksRUFBRTtvQkFDWixJQUFJLEVBQUUsNkJBQTZCO29CQUNuQyxVQUFVLEVBQUU7d0JBQ1YsWUFBWSxFQUFFLGNBQWM7d0JBQzVCLGlCQUFpQixFQUFFLENBQUMsWUFBWSxDQUFDO3dCQUNqQyxnQkFBZ0IsRUFBRSxDQUFDLGFBQWEsQ0FBQzt3QkFDakMscUJBQXFCLEVBQUUsYUFBYTt3QkFD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QUFDO2lCQUFNLElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ3BELE9BQU87Z0JBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUUzRyxPQUFPO2dCQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDOUMsTUFBTSxDQUFDLDJCQUFnQixDQUFDLENBQUMseUJBQXlCLENBQUMsNkJBQWEsRUFBRTtvQkFDaEUsWUFBWSxFQUFFLGdFQUFnRTtvQkFDOUUsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7d0JBQ3RCLEdBQUcsNEJBQTRCO3dCQUMvQixrQkFBa0IsRUFBRTs0QkFDbEIsaUJBQWlCLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQzs0QkFDckMsZ0JBQWdCLEVBQUUsQ0FBQyxhQUFhLENBQUM7NEJBQ2pDLHFCQUFxQixFQUFFLGtCQUFrQjt5QkFDMUM7cUJBQ0YsQ0FBQztpQkFDSCxDQUFDLENBQUM7WUFDTCxDQUFDO1FBQ0gsQ0FBQyxDQUNGLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW52b2tlQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc2V0dXAgZnJvbSAnLi9ob3Rzd2FwLXRlc3Qtc2V0dXAnO1xuaW1wb3J0IHsgSG90c3dhcE1vZGUgfSBmcm9tICcuLi8uLi8uLi9saWIvYXBpL2hvdHN3YXAvY29tbW9uJztcbmltcG9ydCB7IFJFUVVJUkVEX0JZX0NGTiB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9zMy1idWNrZXQtZGVwbG95bWVudHMnO1xuaW1wb3J0IHsgbW9ja0xhbWJkYUNsaWVudCB9IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHsgc2lsZW50VGVzdCB9IGZyb20gJy4uLy4uL3V0aWwvc2lsZW50JztcblxubGV0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXI6IHNldHVwLkhvdHN3YXBNb2NrU2RrUHJvdmlkZXI7XG5cbmNvbnN0IHBheWxvYWRXaXRob3V0Q3VzdG9tUmVzUHJvcHMgPSB7XG4gIFJlcXVlc3RUeXBlOiAnVXBkYXRlJyxcbiAgUmVzcG9uc2VVUkw6IFJFUVVJUkVEX0JZX0NGTixcbiAgUGh5c2ljYWxSZXNvdXJjZUlkOiBSRVFVSVJFRF9CWV9DRk4sXG4gIFN0YWNrSWQ6IFJFUVVJUkVEX0JZX0NGTixcbiAgUmVxdWVzdElkOiBSRVFVSVJFRF9CWV9DRk4sXG4gIExvZ2ljYWxSZXNvdXJjZUlkOiBSRVFVSVJFRF9CWV9DRk4sXG59O1xuXG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcFRlc3RzKCk7XG59KTtcblxuZGVzY3JpYmUuZWFjaChbSG90c3dhcE1vZGUuRkFMTF9CQUNLLCBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFldKSgnJXAgbW9kZScsIChob3Rzd2FwTW9kZSkgPT4ge1xuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgbGFtYmRhSW52b2tlKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhbiBhc3NldCBkaWZmZXJlbmNlIGluIGFuIFMzIGJ1Y2tldCBkZXBsb3ltZW50IGFuZCBldmFsdWF0ZXMgQ0ZOIGV4cHJlc3Npb25zIGluIFMzIERlcGxveW1lbnQgUHJvcGVydGllcycsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgUzNEZXBsb3ltZW50OiB7XG4gICAgICAgICAgICBUeXBlOiAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU2VydmljZVRva2VuOiAnYS1sYW1iZGEtYXJuJyxcbiAgICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldCddLFxuICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktb2xkJ10sXG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ2Rlc3QtYnVja2V0JyxcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXRLZXlQcmVmaXg6ICdteS1rZXkvc29tZS1vbGQtcHJlZml4JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0N1c3RvbTo6Q0RLQnVja2V0RGVwbG95bWVudCcsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBTZXJ2aWNlVG9rZW46ICdhLWxhbWJkYS1hcm4nLFxuICAgICAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQnXSxcbiAgICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiB7XG4gICAgICAgICAgICAgICAgICAnRm46OlNwbGl0JzogWyctJywgJ2tleTEta2V5Mi1rZXkzJ10sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBEZXN0aW5hdGlvbkJ1Y2tldE5hbWU6ICdkZXN0LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXRLZXlQcmVmaXg6ICdteS1rZXkvc29tZS1uZXctcHJlZml4JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChJbnZva2VDb21tYW5kLCB7XG4gICAgICAgIEZ1bmN0aW9uTmFtZTogJ2EtbGFtYmRhLWFybicsXG4gICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAuLi5wYXlsb2FkV2l0aG91dEN1c3RvbVJlc1Byb3BzLFxuICAgICAgICAgIFJlc291cmNlUHJvcGVydGllczoge1xuICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldCddLFxuICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydrZXkxJywgJ2tleTInLCAna2V5MyddLFxuICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnZGVzdC1idWNrZXQnLFxuICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXRLZXlQcmVmaXg6ICdteS1rZXkvc29tZS1uZXctcHJlZml4JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnZG9lcyBub3QgY2FsbCB0aGUgaW52b2tlKCkgQVBJIHdoZW4gYSByZXNvdXJjZSB3aXRoIHR5cGUgdGhhdCBpcyBub3QgQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50IGJ1dCBoYXMgdGhlIHNhbWUgcHJvcGVydGllcyBpcyBjaGFuZ2VkJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBTM0RlcGxveW1lbnQ6IHtcbiAgICAgICAgICAgIFR5cGU6ICdDdXN0b206Ok5vdENES0J1Y2tldERlcGxveW1lbnQnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktb2xkJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgUzNEZXBsb3ltZW50OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdDdXN0b206Ok5vdENES0J1Y2tldERlcGxveW1lbnQnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW5ldyddLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChJbnZva2VDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoSW52b2tlQ29tbWFuZCk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdkb2VzIG5vdCBjYWxsIHRoZSBpbnZva2VMYW1iZGEoKSBhcGkgaWYgdGhlIHVwZGF0ZWQgUG9saWN5IGhhcyBubyBSb2xlcyBpbiBDTEFTU0lDIG1vZGUgYnV0IGRvZXMgaW4gSE9UU1dBUF9PTkxZIG1vZGUnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBXZWJzaXRlQnVja2V0UGFyYW1PbGQ6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICBXZWJzaXRlQnVja2V0UGFyYW1OZXc6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgfSxcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgUzNEZXBsb3ltZW50OiB7XG4gICAgICAgICAgICBUeXBlOiAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU2VydmljZVRva2VuOiAnYS1sYW1iZGEtYXJuJyxcbiAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW9sZCddLFxuICAgICAgICAgICAgICBTb3VyY2VCdWNrZXROYW1lczogWydzcmMtYnVja2V0J10sXG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ2Rlc3QtYnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBQb2xpY3k6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OklBTTo6UG9saWN5JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUG9saWN5TmFtZTogJ215LXBvbGljeScsXG4gICAgICAgICAgICAgIFBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIEFjdGlvbjogWydzMzpHZXRPYmplY3QqJ10sXG4gICAgICAgICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgICAgICAgUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICBSZWY6ICdXZWJzaXRlQnVja2V0UGFyYW1PbGQnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBXZWJzaXRlQnVja2V0UGFyYW1PbGQ6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU5ldzogeyBUeXBlOiAnU3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0N1c3RvbTo6Q0RLQnVja2V0RGVwbG95bWVudCcsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBTZXJ2aWNlVG9rZW46ICdhLWxhbWJkYS1hcm4nLFxuICAgICAgICAgICAgICAgIFNvdXJjZU9iamVjdEtleXM6IFsnc3JjLWtleS1uZXcnXSxcbiAgICAgICAgICAgICAgICBTb3VyY2VCdWNrZXROYW1lczogWydzcmMtYnVja2V0J10sXG4gICAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnZGVzdC1idWNrZXQnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFBvbGljeToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpJQU06OlBvbGljeScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBQb2xpY3lOYW1lOiAnbXktcG9saWN5JyxcbiAgICAgICAgICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBBY3Rpb246IFsnczM6R2V0T2JqZWN0KiddLFxuICAgICAgICAgICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgICAgICAgICBSZXNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgUmVmOiAnV2Vic2l0ZUJ1Y2tldFBhcmFtTmV3JyxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChJbnZva2VDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEludm9rZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdhLWxhbWJkYS1hcm4nLFxuICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLnBheWxvYWRXaXRob3V0Q3VzdG9tUmVzUHJvcHMsXG4gICAgICAgICAgICBSZXNvdXJjZVByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW5ldyddLFxuICAgICAgICAgICAgICBTb3VyY2VCdWNrZXROYW1lczogWydzcmMtYnVja2V0J10sXG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ2Rlc3QtYnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdCgndGhyb3dzIGFuIGVycm9yIHdoZW4gdGhlIHNlcnZpY2VUb2tlbiBmYWlscyBldmFsdWF0aW9uIGluIHRoZSB0ZW1wbGF0ZScsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBTM0RlcGxveW1lbnQ6IHtcbiAgICAgICAgICBUeXBlOiAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50JyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBTZXJ2aWNlVG9rZW46IHtcbiAgICAgICAgICAgICAgUmVmOiAnQmFkTGFtYmEnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQnXSxcbiAgICAgICAgICAgIFNvdXJjZU9iamVjdEtleXM6IFsnc3JjLWtleS1vbGQnXSxcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ2Rlc3QtYnVja2V0JyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFMzRGVwbG95bWVudDoge1xuICAgICAgICAgICAgVHlwZTogJ0N1c3RvbTo6Q0RLQnVja2V0RGVwbG95bWVudCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNlcnZpY2VUb2tlbjoge1xuICAgICAgICAgICAgICAgIFJlZjogJ0JhZExhbWJhJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldCddLFxuICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktbmV3J10sXG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ2Rlc3QtYnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KCgpID0+IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICAvUGFyYW1ldGVyIG9yIHJlc291cmNlICdCYWRMYW1iYScgY291bGQgbm90IGJlIGZvdW5kIGZvciBldmFsdWF0aW9uLyxcbiAgICApO1xuXG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoSW52b2tlQ29tbWFuZCk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKCdvbGQtc3R5bGUgc3ludGhlc2lzJywgKCkgPT4ge1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSB7XG4gICAgICBXZWJzaXRlQnVja2V0UGFyYW1PbGQ6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU5ldzogeyBUeXBlOiAnU3RyaW5nJyB9LFxuICAgICAgRGlmZmVyZW50QnVja2V0UGFyYW1OZXc6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICB9O1xuXG4gICAgY29uc3Qgc2VydmljZVJvbGUgPSB7XG4gICAgICBUeXBlOiAnQVdTOjpJQU06OlJvbGUnLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICBBc3N1bWVSb2xlUG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgQWN0aW9uOiAnc3RzOkFzc3VtZVJvbGUnLFxuICAgICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgICAgIFByaW5jaXBhbDoge1xuICAgICAgICAgICAgICAgIFNlcnZpY2U6ICdsYW1iZGEuYW1hem9uYXdzLmNvbScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgVmVyc2lvbjogJzIwMTItMTAtMTcnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcG9saWN5T2xkID0ge1xuICAgICAgVHlwZTogJ0FXUzo6SUFNOjpQb2xpY3knLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICBQb2xpY3lOYW1lOiAnbXktcG9saWN5LW9sZCcsXG4gICAgICAgIFJvbGVzOiBbeyBSZWY6ICdTZXJ2aWNlUm9sZScgfV0sXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIEFjdGlvbjogWydzMzpHZXRPYmplY3QqJ10sXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBSZWY6ICdXZWJzaXRlQnVja2V0UGFyYW1PbGQnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcG9saWN5TmV3ID0ge1xuICAgICAgVHlwZTogJ0FXUzo6SUFNOjpQb2xpY3knLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICBQb2xpY3lOYW1lOiAnbXktcG9saWN5LW5ldycsXG4gICAgICAgIFJvbGVzOiBbeyBSZWY6ICdTZXJ2aWNlUm9sZScgfV0sXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIEFjdGlvbjogWydzMzpHZXRPYmplY3QqJ10sXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBSZWY6ICdXZWJzaXRlQnVja2V0UGFyYW1OZXcnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcG9saWN5Mk9sZCA9IHtcbiAgICAgIFR5cGU6ICdBV1M6OklBTTo6UG9saWN5JyxcbiAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgUG9saWN5TmFtZTogJ215LXBvbGljeS1vbGQtMicsXG4gICAgICAgIFJvbGVzOiBbeyBSZWY6ICdTZXJ2aWNlUm9sZScgfV0sXG4gICAgICAgIFBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIEFjdGlvbjogWydzMzpHZXRPYmplY3QqJ10sXG4gICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBSZWY6ICdXZWJzaXRlQnVja2V0UGFyYW1PbGQnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgcG9saWN5Mk5ldyA9IHtcbiAgICAgIFR5cGU6ICdBV1M6OklBTTo6UG9saWN5JyxcbiAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgUG9saWN5TmFtZTogJ215LXBvbGljeS1uZXctMicsXG4gICAgICAgIFJvbGVzOiBbeyBSZWY6ICdTZXJ2aWNlUm9sZTInIH1dLFxuICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgIFN0YXRlbWVudDogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBBY3Rpb246IFsnczM6R2V0T2JqZWN0KiddLFxuICAgICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgICAgIFJlc291cmNlOiB7XG4gICAgICAgICAgICAgICAgUmVmOiAnRGlmZmVyZW50QnVja2V0UGFyYW1PbGQnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgZGVwbG95bWVudExhbWJkYSA9IHtcbiAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgUm9sZToge1xuICAgICAgICAnRm46OkdldEF0dCc6IFsnU2VydmljZVJvbGUnLCAnQXJuJ10sXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBzM0RlcGxveW1lbnRPbGQgPSB7XG4gICAgICBUeXBlOiAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50JyxcbiAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgU2VydmljZVRva2VuOiB7XG4gICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1MzRGVwbG95bWVudExhbWJkYScsICdBcm4nXSxcbiAgICAgICAgfSxcbiAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldC1vbGQnXSxcbiAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW9sZCddLFxuICAgICAgICBEZXN0aW5hdGlvbkJ1Y2tldE5hbWU6ICdXZWJzaXRlQnVja2V0T2xkJyxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IHMzRGVwbG95bWVudE5ldyA9IHtcbiAgICAgIFR5cGU6ICdDdXN0b206OkNES0J1Y2tldERlcGxveW1lbnQnLFxuICAgICAgUHJvcGVydGllczoge1xuICAgICAgICBTZXJ2aWNlVG9rZW46IHtcbiAgICAgICAgICAnRm46OkdldEF0dCc6IFsnUzNEZXBsb3ltZW50TGFtYmRhJywgJ0FybiddLFxuICAgICAgICB9LFxuICAgICAgICBTb3VyY2VCdWNrZXROYW1lczogWydzcmMtYnVja2V0LW5ldyddLFxuICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktbmV3J10sXG4gICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ1dlYnNpdGVCdWNrZXROZXcnLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ1MzRGVwbG95bWVudExhbWJkYScsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZGVwbG95bWVudC1sYW1iZGEnKSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ1NlcnZpY2VSb2xlJywgJ0FXUzo6SUFNOjpSb2xlJywgJ215LXNlcnZpY2Utcm9sZScpLFxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHNpbGVudFRlc3QoXG4gICAgICAnY2FsbHMgdGhlIGxhbWJkYUludm9rZSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIGFuIGFzc2V0IGRpZmZlcmVuY2UgaW4gYW4gUzMgYnVja2V0IGRlcGxveW1lbnQgYW5kIGFuIElBTSBQb2xpY3kgZGlmZmVyZW5jZSB1c2luZyBvbGQtc3R5bGUgc3ludGhlc2lzJyxcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgUGFyYW1ldGVyczogcGFyYW1ldGVycyxcbiAgICAgICAgICAgIFNlcnZpY2VSb2xlOiBzZXJ2aWNlUm9sZSxcbiAgICAgICAgICAgIFBvbGljeTogcG9saWN5T2xkLFxuICAgICAgICAgICAgUzNEZXBsb3ltZW50TGFtYmRhOiBkZXBsb3ltZW50TGFtYmRhLFxuICAgICAgICAgICAgUzNEZXBsb3ltZW50OiBzM0RlcGxveW1lbnRPbGQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgICBQYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICAgICAgICBTZXJ2aWNlUm9sZTogc2VydmljZVJvbGUsXG4gICAgICAgICAgICAgIFBvbGljeTogcG9saWN5TmV3LFxuICAgICAgICAgICAgICBTM0RlcGxveW1lbnRMYW1iZGE6IGRlcGxveW1lbnRMYW1iZGEsXG4gICAgICAgICAgICAgIFMzRGVwbG95bWVudDogczNEZXBsb3ltZW50TmV3LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCwge1xuICAgICAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU9sZDogJ1dlYnNpdGVCdWNrZXRPbGQnLFxuICAgICAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU5ldzogJ1dlYnNpdGVCdWNrZXROZXcnLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoSW52b2tlQ29tbWFuZCwge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ2Fybjpzd2E6bGFtYmRhOmhlcmU6MTIzNDU2Nzg5MDEyOmZ1bmN0aW9uOm15LWRlcGxveW1lbnQtbGFtYmRhJyxcbiAgICAgICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5wYXlsb2FkV2l0aG91dEN1c3RvbVJlc1Byb3BzLFxuICAgICAgICAgICAgUmVzb3VyY2VQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQtbmV3J10sXG4gICAgICAgICAgICAgIFNvdXJjZU9iamVjdEtleXM6IFsnc3JjLWtleS1uZXcnXSxcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnV2Vic2l0ZUJ1Y2tldE5ldycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHNpbGVudFRlc3QoXG4gICAgICBgZG9lcyBub3QgY2FsbCB0aGUgbGFtYmRhSW52b2tlKCkgQVBJIHdoZW4gdGhlIGRpZmZlcmVuY2UgaW4gdGhlIFMzIGRlcGxveW1lbnQgaXMgcmVmZXJyZWQgdG8gaW4gb25lIElBTSBwb2xpY3kgY2hhbmdlIGJ1dCBub3QgYW5vdGhlclxuICAgICAgICAgIGluIENMQVNTSUMgbW9kZSBidXQgZG9lcyBpbiBIT1RTV0FQX09OTFlgLFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTZXJ2aWNlUm9sZTogc2VydmljZVJvbGUsXG4gICAgICAgICAgICBQb2xpY3kxOiBwb2xpY3lPbGQsXG4gICAgICAgICAgICBQb2xpY3kyOiBwb2xpY3kyT2xkLFxuICAgICAgICAgICAgUzNEZXBsb3ltZW50TGFtYmRhOiBkZXBsb3ltZW50TGFtYmRhLFxuICAgICAgICAgICAgUzNEZXBsb3ltZW50OiBzM0RlcGxveW1lbnRPbGQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgICBTZXJ2aWNlUm9sZTogc2VydmljZVJvbGUsXG4gICAgICAgICAgICAgIFBvbGljeTE6IHBvbGljeU5ldyxcbiAgICAgICAgICAgICAgUG9saWN5Mjoge1xuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIFJvbGVzOiBbeyBSZWY6ICdTZXJ2aWNlUm9sZScgfSwgJ2RpZmZlcmVudC1yb2xlJ10sXG4gICAgICAgICAgICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICAgICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBBY3Rpb246IFsnczM6R2V0T2JqZWN0KiddLFxuICAgICAgICAgICAgICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ0RpZmZlcmVudEJ1Y2tldE5ldycsICdBcm4nXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgUzNEZXBsb3ltZW50TGFtYmRhOiBkZXBsb3ltZW50TGFtYmRhLFxuICAgICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHMzRGVwbG95bWVudE5ldyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgICAvLyBXSEVOXG4gICAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAgIC8vIFRIRU5cbiAgICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChJbnZva2VDb21tYW5kKTtcbiAgICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgICAgLy8gV0hFTlxuICAgICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgICAvLyBUSEVOXG4gICAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEludm9rZUNvbW1hbmQsIHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ2Fybjpzd2E6bGFtYmRhOmhlcmU6MTIzNDU2Nzg5MDEyOmZ1bmN0aW9uOm15LWRlcGxveW1lbnQtbGFtYmRhJyxcbiAgICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgLi4ucGF5bG9hZFdpdGhvdXRDdXN0b21SZXNQcm9wcyxcbiAgICAgICAgICAgICAgUmVzb3VyY2VQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldC1uZXcnXSxcbiAgICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktbmV3J10sXG4gICAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnV2Vic2l0ZUJ1Y2tldE5ldycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuXG4gICAgc2lsZW50VGVzdChcbiAgICAgIGBkb2VzIG5vdCBjYWxsIHRoZSBsYW1iZGFJbnZva2UoKSBBUEkgd2hlbiB0aGUgbGFtYmRhIHRoYXQgcmVmZXJlbmNlcyB0aGUgcm9sZSBpcyByZWZlcnJlZCB0byBieSBzb21ldGhpbmcgb3RoZXIgdGhhbiBhbiBTMyBkZXBsb3ltZW50XG4gICAgICAgICAgaW4gQ0xBU1NJQyBtb2RlIGJ1dCBkb2VzIGluIEhPVFNXQVBfT05MWSBtb2RlYCxcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgU2VydmljZVJvbGU6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgUG9saWN5OiBwb2xpY3lPbGQsXG4gICAgICAgICAgICBTM0RlcGxveW1lbnRMYW1iZGE6IGRlcGxveW1lbnRMYW1iZGEsXG4gICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHMzRGVwbG95bWVudE9sZCxcbiAgICAgICAgICAgIEVuZHBvaW50OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6UGVybWlzc2lvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBBY3Rpb246ICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZToge1xuICAgICAgICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1MzRGVwbG95bWVudExhbWJkYScsICdBcm4nXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFByaW5jaXBhbDogJ2FwaWdhdGV3YXkuYW1hem9uYXdzLmNvbScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgU2VydmljZVJvbGU6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgICBQb2xpY3k6IHBvbGljeU5ldyxcbiAgICAgICAgICAgICAgUzNEZXBsb3ltZW50TGFtYmRhOiBkZXBsb3ltZW50TGFtYmRhLFxuICAgICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHMzRGVwbG95bWVudE5ldyxcbiAgICAgICAgICAgICAgRW5kcG9pbnQ6IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OlBlcm1pc3Npb24nLFxuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIEFjdGlvbjogJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1MzRGVwbG95bWVudExhbWJkYScsICdBcm4nXSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBQcmluY2lwYWw6ICdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgICAgLy8gV0hFTlxuICAgICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgICAvLyBUSEVOXG4gICAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoSW52b2tlQ29tbWFuZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAgIC8vIFdIRU5cbiAgICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgICAgLy8gVEhFTlxuICAgICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChJbnZva2VDb21tYW5kLCB7XG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdhcm46c3dhOmxhbWJkYTpoZXJlOjEyMzQ1Njc4OTAxMjpmdW5jdGlvbjpteS1kZXBsb3ltZW50LWxhbWJkYScsXG4gICAgICAgICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIC4uLnBheWxvYWRXaXRob3V0Q3VzdG9tUmVzUHJvcHMsXG4gICAgICAgICAgICAgIFJlc291cmNlUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQtbmV3J10sXG4gICAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW5ldyddLFxuICAgICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ1dlYnNpdGVCdWNrZXROZXcnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHNpbGVudFRlc3QoXG4gICAgICAnY2FsbHMgdGhlIGxhbWJkYUludm9rZSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIGFuIGFzc2V0IGRpZmZlcmVuY2UgaW4gdHdvIFMzIGJ1Y2tldCBkZXBsb3ltZW50cyBhbmQgSUFNIFBvbGljeSBkaWZmZXJlbmNlcyB1c2luZyBvbGQtc3R5bGUgc3ludGhlc2lzJyxcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgY29uc3QgZGVwbG95bWVudExhbWJkYTJPbGQgPSB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUm9sZToge1xuICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1NlcnZpY2VSb2xlJywgJ0FybiddLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZGVwbG95bWVudExhbWJkYTJOZXcgPSB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUm9sZToge1xuICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1NlcnZpY2VSb2xlMicsICdBcm4nXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHMzRGVwbG95bWVudDJPbGQgPSB7XG4gICAgICAgICAgVHlwZTogJ0N1c3RvbTo6Q0RLQnVja2V0RGVwbG95bWVudCcsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgU2VydmljZVRva2VuOiB7XG4gICAgICAgICAgICAgICdGbjo6R2V0QXR0JzogWydTM0RlcGxveW1lbnRMYW1iZGEyJywgJ0FybiddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQtb2xkJ10sXG4gICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktb2xkJ10sXG4gICAgICAgICAgICBEZXN0aW5hdGlvbkJ1Y2tldE5hbWU6ICdEaWZmZXJlbnRCdWNrZXRPbGQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgczNEZXBsb3ltZW50Mk5ldyA9IHtcbiAgICAgICAgICBUeXBlOiAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50JyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBTZXJ2aWNlVG9rZW46IHtcbiAgICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ1MzRGVwbG95bWVudExhbWJkYTInLCAnQXJuJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldC1uZXcnXSxcbiAgICAgICAgICAgIFNvdXJjZU9iamVjdEtleXM6IFsnc3JjLWtleS1uZXcnXSxcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ0RpZmZlcmVudEJ1Y2tldE5ldycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTZXJ2aWNlUm9sZTogc2VydmljZVJvbGUsXG4gICAgICAgICAgICBTZXJ2aWNlUm9sZTI6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgUG9saWN5MTogcG9saWN5T2xkLFxuICAgICAgICAgICAgUG9saWN5MjogcG9saWN5Mk9sZCxcbiAgICAgICAgICAgIFMzRGVwbG95bWVudExhbWJkYTogZGVwbG95bWVudExhbWJkYSxcbiAgICAgICAgICAgIFMzRGVwbG95bWVudExhbWJkYTI6IGRlcGxveW1lbnRMYW1iZGEyT2xkLFxuICAgICAgICAgICAgUzNEZXBsb3ltZW50OiBzM0RlcGxveW1lbnRPbGQsXG4gICAgICAgICAgICBTM0RlcGxveW1lbnQyOiBzM0RlcGxveW1lbnQyT2xkLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgUGFyYW1ldGVyczogcGFyYW1ldGVycyxcbiAgICAgICAgICAgICAgU2VydmljZVJvbGU6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgICBTZXJ2aWNlUm9sZTI6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgICBQb2xpY3kxOiBwb2xpY3lOZXcsXG4gICAgICAgICAgICAgIFBvbGljeTI6IHBvbGljeTJOZXcsXG4gICAgICAgICAgICAgIFMzRGVwbG95bWVudExhbWJkYTogZGVwbG95bWVudExhbWJkYSxcbiAgICAgICAgICAgICAgUzNEZXBsb3ltZW50TGFtYmRhMjogZGVwbG95bWVudExhbWJkYTJOZXcsXG4gICAgICAgICAgICAgIFMzRGVwbG95bWVudDogczNEZXBsb3ltZW50TmV3LFxuICAgICAgICAgICAgICBTM0RlcGxveW1lbnQyOiBzM0RlcGxveW1lbnQyTmV3LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKCdTM0RlcGxveW1lbnRMYW1iZGEyJywgJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsICdteS1kZXBsb3ltZW50LWxhbWJkYS0yJyksXG4gICAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ1NlcnZpY2VSb2xlMicsICdBV1M6OklBTTo6Um9sZScsICdteS1zZXJ2aWNlLXJvbGUtMicpLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCwge1xuICAgICAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU9sZDogJ1dlYnNpdGVCdWNrZXRPbGQnLFxuICAgICAgICAgIFdlYnNpdGVCdWNrZXRQYXJhbU5ldzogJ1dlYnNpdGVCdWNrZXROZXcnLFxuICAgICAgICAgIERpZmZlcmVudEJ1Y2tldFBhcmFtTmV3OiAnV2Vic2l0ZUJ1Y2tldE5ldycsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChJbnZva2VDb21tYW5kLCB7XG4gICAgICAgICAgRnVuY3Rpb25OYW1lOiAnYXJuOnN3YTpsYW1iZGE6aGVyZToxMjM0NTY3ODkwMTI6ZnVuY3Rpb246bXktZGVwbG95bWVudC1sYW1iZGEnLFxuICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLnBheWxvYWRXaXRob3V0Q3VzdG9tUmVzUHJvcHMsXG4gICAgICAgICAgICBSZXNvdXJjZVByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldC1uZXcnXSxcbiAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW5ldyddLFxuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkJ1Y2tldE5hbWU6ICdXZWJzaXRlQnVja2V0TmV3JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEludm9rZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdhcm46c3dhOmxhbWJkYTpoZXJlOjEyMzQ1Njc4OTAxMjpmdW5jdGlvbjpteS1kZXBsb3ltZW50LWxhbWJkYS0yJyxcbiAgICAgICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5wYXlsb2FkV2l0aG91dEN1c3RvbVJlc1Byb3BzLFxuICAgICAgICAgICAgUmVzb3VyY2VQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQtbmV3J10sXG4gICAgICAgICAgICAgIFNvdXJjZU9iamVjdEtleXM6IFsnc3JjLWtleS1uZXcnXSxcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnRGlmZmVyZW50QnVja2V0TmV3JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgc2lsZW50VGVzdChcbiAgICAgIGBkb2VzIG5vdCBjYWxsIHRoZSBsYW1iZGFJbnZva2UoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBhbiBhc3NldCBkaWZmZXJlbmNlIGluIGFuIFMzIGJ1Y2tldCBkZXBsb3ltZW50IHRoYXQgcmVmZXJlbmNlcyB0d28gZGlmZmVyZW50IHBvbGljaWVzXG4gICAgICAgICAgaW4gQ0xBU1NJQyBtb2RlIGJ1dCBkb2VzIGluIEhPVFNXQVBfT05MWSBtb2RlYCxcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgU2VydmljZVJvbGU6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgUG9saWN5MTogcG9saWN5T2xkLFxuICAgICAgICAgICAgUG9saWN5MjogcG9saWN5Mk9sZCxcbiAgICAgICAgICAgIFMzRGVwbG95bWVudExhbWJkYTogZGVwbG95bWVudExhbWJkYSxcbiAgICAgICAgICAgIFMzRGVwbG95bWVudDogczNEZXBsb3ltZW50T2xkLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgU2VydmljZVJvbGU6IHNlcnZpY2VSb2xlLFxuICAgICAgICAgICAgICBQb2xpY3kxOiBwb2xpY3lOZXcsXG4gICAgICAgICAgICAgIFBvbGljeTI6IHtcbiAgICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBSb2xlczogW3sgUmVmOiAnU2VydmljZVJvbGUnIH1dLFxuICAgICAgICAgICAgICAgICAgUG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgQWN0aW9uOiBbJ3MzOkdldE9iamVjdConXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlc291cmNlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICdGbjo6R2V0QXR0JzogWydEaWZmZXJlbnRCdWNrZXROZXcnLCAnQXJuJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIFMzRGVwbG95bWVudExhbWJkYTogZGVwbG95bWVudExhbWJkYSxcbiAgICAgICAgICAgICAgUzNEZXBsb3ltZW50OiBzM0RlcGxveW1lbnROZXcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgICAgLy8gV0hFTlxuICAgICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgICAvLyBUSEVOXG4gICAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoSW52b2tlQ29tbWFuZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAgIC8vIFdIRU5cbiAgICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgICAgLy8gVEhFTlxuICAgICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChJbnZva2VDb21tYW5kLCB7XG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdhcm46c3dhOmxhbWJkYTpoZXJlOjEyMzQ1Njc4OTAxMjpmdW5jdGlvbjpteS1kZXBsb3ltZW50LWxhbWJkYScsXG4gICAgICAgICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIC4uLnBheWxvYWRXaXRob3V0Q3VzdG9tUmVzUHJvcHMsXG4gICAgICAgICAgICAgIFJlc291cmNlUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFNvdXJjZUJ1Y2tldE5hbWVzOiBbJ3NyYy1idWNrZXQtbmV3J10sXG4gICAgICAgICAgICAgICAgU291cmNlT2JqZWN0S2V5czogWydzcmMta2V5LW5ldyddLFxuICAgICAgICAgICAgICAgIERlc3RpbmF0aW9uQnVja2V0TmFtZTogJ1dlYnNpdGVCdWNrZXROZXcnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHNpbGVudFRlc3QoXG4gICAgICBgZG9lcyBub3QgY2FsbCB0aGUgbGFtYmRhSW52b2tlKCkgQVBJIHdoZW4gYSBwb2xpY3kgaXMgcmVmZXJlbmNlZCBieSBhIHJlc291cmNlIHRoYXQgaXMgbm90IGFuIFMzIGRlcGxveW1lbnRcbiAgICAgICAgICBpbiBDTEFTU0lDIG1vZGUgYnV0IGRvZXMgaW4gSE9UU1dBUF9PTkxZIG1vZGVgLFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBTZXJ2aWNlUm9sZTogc2VydmljZVJvbGUsXG4gICAgICAgICAgICBQb2xpY3kxOiBwb2xpY3lPbGQsXG4gICAgICAgICAgICBTM0RlcGxveW1lbnRMYW1iZGE6IGRlcGxveW1lbnRMYW1iZGEsXG4gICAgICAgICAgICBTM0RlcGxveW1lbnQ6IHMzRGVwbG95bWVudE9sZCxcbiAgICAgICAgICAgIE5vdEFEZXBsb3ltZW50OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6Ok5vdDo6UzNEZXBsb3ltZW50JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFByb3A6IHtcbiAgICAgICAgICAgICAgICAgIFJlZjogJ1NlcnZpY2VSb2xlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgIFNlcnZpY2VSb2xlOiBzZXJ2aWNlUm9sZSxcbiAgICAgICAgICAgICAgUG9saWN5MTogcG9saWN5TmV3LFxuICAgICAgICAgICAgICBTM0RlcGxveW1lbnRMYW1iZGE6IGRlcGxveW1lbnRMYW1iZGEsXG4gICAgICAgICAgICAgIFMzRGVwbG95bWVudDogczNEZXBsb3ltZW50TmV3LFxuICAgICAgICAgICAgICBOb3RBRGVwbG95bWVudDoge1xuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6Ok5vdDo6UzNEZXBsb3ltZW50JyxcbiAgICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBQcm9wOiB7XG4gICAgICAgICAgICAgICAgICAgIFJlZjogJ1NlcnZpY2VSb2xlJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgICAvLyBXSEVOXG4gICAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAgIC8vIFRIRU5cbiAgICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChJbnZva2VDb21tYW5kKTtcbiAgICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgICAgLy8gV0hFTlxuICAgICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgICAvLyBUSEVOXG4gICAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEludm9rZUNvbW1hbmQsIHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ2Fybjpzd2E6bGFtYmRhOmhlcmU6MTIzNDU2Nzg5MDEyOmZ1bmN0aW9uOm15LWRlcGxveW1lbnQtbGFtYmRhJyxcbiAgICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgLi4ucGF5bG9hZFdpdGhvdXRDdXN0b21SZXNQcm9wcyxcbiAgICAgICAgICAgICAgUmVzb3VyY2VQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlQnVja2V0TmFtZXM6IFsnc3JjLWJ1Y2tldC1uZXcnXSxcbiAgICAgICAgICAgICAgICBTb3VyY2VPYmplY3RLZXlzOiBbJ3NyYy1rZXktbmV3J10sXG4gICAgICAgICAgICAgICAgRGVzdGluYXRpb25CdWNrZXROYW1lOiAnV2Vic2l0ZUJ1Y2tldE5ldycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuICB9KTtcbn0pO1xuIl19