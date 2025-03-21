"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_codebuild_1 = require("@aws-sdk/client-codebuild");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('returns undefined when a new CodeBuild Project is added to the Stack', async () => {
        // GIVEN
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                    },
                },
            },
        });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
    });
    (0, silent_1.silentTest)('calls the updateProject() API when it receives only a source difference in a CodeBuild project', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        Name: 'my-project',
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
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
                            },
                            Name: 'my-project',
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
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'my-project',
            source: {
                type: 'NO_SOURCE',
                buildspec: 'new-spec',
            },
        });
    });
    (0, silent_1.silentTest)('calls the updateProject() API when it receives only a source version difference in a CodeBuild project', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        Name: 'my-project',
                        SourceVersion: 'v1',
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
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'current-spec',
                                Type: 'NO_SOURCE',
                            },
                            Name: 'my-project',
                            SourceVersion: 'v2',
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
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'my-project',
            sourceVersion: 'v2',
        });
    });
    (0, silent_1.silentTest)('calls the updateProject() API when it receives only an environment difference in a CodeBuild project', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        Name: 'my-project',
                        Environment: {
                            ComputeType: 'BUILD_GENERAL1_SMALL',
                            EnvironmentVariables: [
                                {
                                    Name: 'SUPER_IMPORTANT_ENV_VAR',
                                    Type: 'PLAINTEXT',
                                    Value: 'super cool value',
                                },
                                {
                                    Name: 'SECOND_IMPORTANT_ENV_VAR',
                                    Type: 'PLAINTEXT',
                                    Value: 'yet another super cool value',
                                },
                            ],
                            Image: 'aws/codebuild/standard:1.0',
                            ImagePullCredentialsType: 'CODEBUILD',
                            PrivilegedMode: false,
                            Type: 'LINUX_CONTAINER',
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
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'current-spec',
                                Type: 'NO_SOURCE',
                            },
                            Name: 'my-project',
                            Environment: {
                                ComputeType: 'BUILD_GENERAL1_SMALL',
                                EnvironmentVariables: [
                                    {
                                        Name: 'SUPER_IMPORTANT_ENV_VAR',
                                        Type: 'PLAINTEXT',
                                        Value: 'changed value',
                                    },
                                    {
                                        Name: 'NEW_IMPORTANT_ENV_VAR',
                                        Type: 'PLAINTEXT',
                                        Value: 'new value',
                                    },
                                ],
                                Image: 'aws/codebuild/standard:1.0',
                                ImagePullCredentialsType: 'CODEBUILD',
                                PrivilegedMode: false,
                                Type: 'LINUX_CONTAINER',
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
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'my-project',
            environment: {
                computeType: 'BUILD_GENERAL1_SMALL',
                environmentVariables: [
                    {
                        name: 'SUPER_IMPORTANT_ENV_VAR',
                        type: 'PLAINTEXT',
                        value: 'changed value',
                    },
                    {
                        name: 'NEW_IMPORTANT_ENV_VAR',
                        type: 'PLAINTEXT',
                        value: 'new value',
                    },
                ],
                image: 'aws/codebuild/standard:1.0',
                imagePullCredentialsType: 'CODEBUILD',
                privilegedMode: false,
                type: 'LINUX_CONTAINER',
            },
        });
    });
    (0, silent_1.silentTest)("correctly evaluates the project's name when it references a different resource from the template", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Bucket: {
                    Type: 'AWS::S3::Bucket',
                },
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        Name: {
                            'Fn::Join': ['-', [{ Ref: 'Bucket' }, 'project']],
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
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
                            },
                            Name: {
                                'Fn::Join': ['-', [{ Ref: 'Bucket' }, 'project']],
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
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'mybucket-project',
            source: {
                type: 'NO_SOURCE',
                buildspec: 'new-spec',
            },
        });
    });
    (0, silent_1.silentTest)("correctly falls back to taking the project's name from the current stack if it can't evaluate it in the template", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                Param1: { Type: 'String' },
                AssetBucketParam: { Type: 'String' },
            },
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        Name: { Ref: 'Param1' },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('CodeBuildProject', 'AWS::CodeBuild::Project', 'my-project'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    Param1: { Type: 'String' },
                    AssetBucketParam: { Type: 'String' },
                },
                Resources: {
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
                            },
                            Name: { Ref: 'Param1' },
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
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'my-project',
            source: {
                type: 'NO_SOURCE',
                buildspec: 'new-spec',
            },
        });
    });
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it cannot find a Ref target (outside the project's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Parameters: {
                Param1: { Type: 'String' },
            },
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: { 'Fn::Sub': '${Param1}' },
                            Type: 'NO_SOURCE',
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('CodeBuildProject', 'AWS::CodeBuild::Project', 'my-project'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Parameters: {
                    Param1: { Type: 'String' },
                },
                Resources: {
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: { 'Fn::Sub': '${Param1}' },
                                Type: 'CODEPIPELINE',
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
    (0, silent_1.silentTest)("will not perform a hotswap deployment if it doesn't know how to handle a specific attribute (outside the project's name)", async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Bucket: {
                    Type: 'AWS::S3::Bucket',
                },
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                            Type: 'NO_SOURCE',
                        },
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('CodeBuildProject', 'AWS::CodeBuild::Project', 'my-project'), setup.stackSummaryOf('Bucket', 'AWS::S3::Bucket', 'my-bucket'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Bucket: {
                        Type: 'AWS::S3::Bucket',
                    },
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: { 'Fn::GetAtt': ['Bucket', 'UnknownAttribute'] },
                                Type: 'S3',
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
    (0, silent_1.silentTest)('calls the updateProject() API when it receives a difference in a CodeBuild project with no name', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
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
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
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
        setup.pushStackResourceSummaries(setup.stackSummaryOf('CodeBuildProject', 'AWS::CodeBuild::Project', 'mock-project-resource-id'));
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
            name: 'mock-project-resource-id',
            source: {
                type: 'NO_SOURCE',
                buildspec: 'new-spec',
            },
        });
    });
    (0, silent_1.silentTest)('does not call the updateProject() API when it receives a change that is not Source, SourceVersion, or Environment difference in a CodeBuild project', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        ConcurrentBuildLimit: 1,
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'current-spec',
                                Type: 'NO_SOURCE',
                            },
                            ConcurrentBuildLimit: 2,
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
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
    });
    (0, silent_1.silentTest)(`when it receives a change that is not Source, SourceVersion, or Environment difference in a CodeBuild project alongside a hotswappable change,
        it does not call the updateProject() API in CLASSIC mode, but it does in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
                        },
                        ConcurrentBuildLimit: 1,
                    },
                },
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    CodeBuildProject: {
                        Type: 'AWS::CodeBuild::Project',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
                            },
                            ConcurrentBuildLimit: 2,
                        },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('CodeBuildProject', 'AWS::CodeBuild::Project', 'mock-project-resource-id'));
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockCodeBuildClient).toHaveReceivedCommandWith(client_codebuild_1.UpdateProjectCommand, {
                name: 'mock-project-resource-id',
                source: {
                    type: 'NO_SOURCE',
                    buildspec: 'new-spec',
                },
            });
        }
    });
    (0, silent_1.silentTest)('does not call the updateProject() API when a resource with type that is not AWS::CodeBuild::Project but has the same properties is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                CodeBuildProject: {
                    Type: 'AWS::NotCodeBuild::NotAProject',
                    Properties: {
                        Source: {
                            BuildSpec: 'current-spec',
                            Type: 'NO_SOURCE',
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
                    CodeBuildProject: {
                        Type: 'AWS::NotCodeBuild::NotAProject',
                        Properties: {
                            Source: {
                                BuildSpec: 'new-spec',
                                Type: 'NO_SOURCE',
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
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
            expect(mock_sdk_1.mockCodeBuildClient).not.toHaveReceivedCommand(client_codebuild_1.UpdateProjectCommand);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZS1idWlsZC1wcm9qZWN0cy1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb2RlLWJ1aWxkLXByb2plY3RzLWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGdFQUFpRTtBQUNqRSw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELGtEQUEwRDtBQUMxRCw4Q0FBK0M7QUFFL0MsSUFBSSxzQkFBb0QsQ0FBQztBQUV6RCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2Qsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFBQyxzRUFBc0UsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM1RixRQUFRO1FBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLHlCQUF5QjtxQkFDaEM7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDMUMsT0FBTztZQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUUzRyxPQUFPO1lBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDMUMsTUFBTSxDQUFDLDhCQUFtQixDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLHVDQUFvQixDQUFDLENBQUM7UUFDOUUsQ0FBQzthQUFNLElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEQsT0FBTztZQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUUzRyxPQUFPO1lBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzlDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUMsTUFBTSxDQUFDLDhCQUFtQixDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLHVDQUFvQixDQUFDLENBQUM7UUFDOUUsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBQSxtQkFBVSxFQUNSLGdHQUFnRyxFQUNoRyxLQUFLLElBQUksRUFBRTtRQUNULFFBQVE7UUFDUixLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixFQUFFO29CQUNoQixJQUFJLEVBQUUseUJBQXlCO29CQUMvQixVQUFVLEVBQUU7d0JBQ1YsTUFBTSxFQUFFOzRCQUNOLFNBQVMsRUFBRSxjQUFjOzRCQUN6QixJQUFJLEVBQUUsV0FBVzt5QkFDbEI7d0JBQ0QsSUFBSSxFQUFFLFlBQVk7cUJBQ25CO29CQUNELFFBQVEsRUFBRTt3QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3FCQUM3QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixTQUFTLEVBQUUsVUFBVTtnQ0FDckIsSUFBSSxFQUFFLFdBQVc7NkJBQ2xCOzRCQUNELElBQUksRUFBRSxZQUFZO3lCQUNuQjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsVUFBVTt5QkFDN0I7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFM0csT0FBTztRQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM5QyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyx1Q0FBb0IsRUFBRTtZQUMxRSxJQUFJLEVBQUUsWUFBWTtZQUNsQixNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLFNBQVMsRUFBRSxVQUFVO2FBQ3RCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1Isd0dBQXdHLEVBQ3hHLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7b0JBQy9CLFVBQVUsRUFBRTt3QkFDVixNQUFNLEVBQUU7NEJBQ04sU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLElBQUksRUFBRSxXQUFXO3lCQUNsQjt3QkFDRCxJQUFJLEVBQUUsWUFBWTt3QkFDbEIsYUFBYSxFQUFFLElBQUk7cUJBQ3BCO29CQUNELFFBQVEsRUFBRTt3QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3FCQUM3QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixTQUFTLEVBQUUsY0FBYztnQ0FDekIsSUFBSSxFQUFFLFdBQVc7NkJBQ2xCOzRCQUNELElBQUksRUFBRSxZQUFZOzRCQUNsQixhQUFhLEVBQUUsSUFBSTt5QkFDcEI7d0JBQ0QsUUFBUSxFQUFFOzRCQUNSLGdCQUFnQixFQUFFLFVBQVU7eUJBQzdCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNHLE9BQU87UUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDOUMsTUFBTSxDQUFDLDhCQUFtQixDQUFDLENBQUMseUJBQXlCLENBQUMsdUNBQW9CLEVBQUU7WUFDMUUsSUFBSSxFQUFFLFlBQVk7WUFDbEIsYUFBYSxFQUFFLElBQUk7U0FDcEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1Isc0dBQXNHLEVBQ3RHLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7b0JBQy9CLFVBQVUsRUFBRTt3QkFDVixNQUFNLEVBQUU7NEJBQ04sU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLElBQUksRUFBRSxXQUFXO3lCQUNsQjt3QkFDRCxJQUFJLEVBQUUsWUFBWTt3QkFDbEIsV0FBVyxFQUFFOzRCQUNYLFdBQVcsRUFBRSxzQkFBc0I7NEJBQ25DLG9CQUFvQixFQUFFO2dDQUNwQjtvQ0FDRSxJQUFJLEVBQUUseUJBQXlCO29DQUMvQixJQUFJLEVBQUUsV0FBVztvQ0FDakIsS0FBSyxFQUFFLGtCQUFrQjtpQ0FDMUI7Z0NBQ0Q7b0NBQ0UsSUFBSSxFQUFFLDBCQUEwQjtvQ0FDaEMsSUFBSSxFQUFFLFdBQVc7b0NBQ2pCLEtBQUssRUFBRSw4QkFBOEI7aUNBQ3RDOzZCQUNGOzRCQUNELEtBQUssRUFBRSw0QkFBNEI7NEJBQ25DLHdCQUF3QixFQUFFLFdBQVc7NEJBQ3JDLGNBQWMsRUFBRSxLQUFLOzRCQUNyQixJQUFJLEVBQUUsaUJBQWlCO3lCQUN4QjtxQkFDRjtvQkFDRCxRQUFRLEVBQUU7d0JBQ1IsZ0JBQWdCLEVBQUUsVUFBVTtxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsZ0JBQWdCLEVBQUU7d0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7d0JBQy9CLFVBQVUsRUFBRTs0QkFDVixNQUFNLEVBQUU7Z0NBQ04sU0FBUyxFQUFFLGNBQWM7Z0NBQ3pCLElBQUksRUFBRSxXQUFXOzZCQUNsQjs0QkFDRCxJQUFJLEVBQUUsWUFBWTs0QkFDbEIsV0FBVyxFQUFFO2dDQUNYLFdBQVcsRUFBRSxzQkFBc0I7Z0NBQ25DLG9CQUFvQixFQUFFO29DQUNwQjt3Q0FDRSxJQUFJLEVBQUUseUJBQXlCO3dDQUMvQixJQUFJLEVBQUUsV0FBVzt3Q0FDakIsS0FBSyxFQUFFLGVBQWU7cUNBQ3ZCO29DQUNEO3dDQUNFLElBQUksRUFBRSx1QkFBdUI7d0NBQzdCLElBQUksRUFBRSxXQUFXO3dDQUNqQixLQUFLLEVBQUUsV0FBVztxQ0FDbkI7aUNBQ0Y7Z0NBQ0QsS0FBSyxFQUFFLDRCQUE0QjtnQ0FDbkMsd0JBQXdCLEVBQUUsV0FBVztnQ0FDckMsY0FBYyxFQUFFLEtBQUs7Z0NBQ3JCLElBQUksRUFBRSxpQkFBaUI7NkJBQ3hCO3lCQUNGO3dCQUNELFFBQVEsRUFBRTs0QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3lCQUM3QjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUUzRyxPQUFPO1FBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzlDLE1BQU0sQ0FBQyw4QkFBbUIsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLHVDQUFvQixFQUFFO1lBQzFFLElBQUksRUFBRSxZQUFZO1lBQ2xCLFdBQVcsRUFBRTtnQkFDWCxXQUFXLEVBQUUsc0JBQXNCO2dCQUNuQyxvQkFBb0IsRUFBRTtvQkFDcEI7d0JBQ0UsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsSUFBSSxFQUFFLFdBQVc7d0JBQ2pCLEtBQUssRUFBRSxlQUFlO3FCQUN2QjtvQkFDRDt3QkFDRSxJQUFJLEVBQUUsdUJBQXVCO3dCQUM3QixJQUFJLEVBQUUsV0FBVzt3QkFDakIsS0FBSyxFQUFFLFdBQVc7cUJBQ25CO2lCQUNGO2dCQUNELEtBQUssRUFBRSw0QkFBNEI7Z0JBQ25DLHdCQUF3QixFQUFFLFdBQVc7Z0JBQ3JDLGNBQWMsRUFBRSxLQUFLO2dCQUNyQixJQUFJLEVBQUUsaUJBQWlCO2FBQ3hCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1Isa0dBQWtHLEVBQ2xHLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsTUFBTSxFQUFFO29CQUNOLElBQUksRUFBRSxpQkFBaUI7aUJBQ3hCO2dCQUNELGdCQUFnQixFQUFFO29CQUNoQixJQUFJLEVBQUUseUJBQXlCO29CQUMvQixVQUFVLEVBQUU7d0JBQ1YsTUFBTSxFQUFFOzRCQUNOLFNBQVMsRUFBRSxjQUFjOzRCQUN6QixJQUFJLEVBQUUsV0FBVzt5QkFDbEI7d0JBQ0QsSUFBSSxFQUFFOzRCQUNKLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO3lCQUNsRDtxQkFDRjtvQkFDRCxRQUFRLEVBQUU7d0JBQ1IsZ0JBQWdCLEVBQUUsVUFBVTtxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ2hHLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsTUFBTSxFQUFFO3dCQUNOLElBQUksRUFBRSxpQkFBaUI7cUJBQ3hCO29CQUNELGdCQUFnQixFQUFFO3dCQUNoQixJQUFJLEVBQUUseUJBQXlCO3dCQUMvQixVQUFVLEVBQUU7NEJBQ1YsTUFBTSxFQUFFO2dDQUNOLFNBQVMsRUFBRSxVQUFVO2dDQUNyQixJQUFJLEVBQUUsV0FBVzs2QkFDbEI7NEJBQ0QsSUFBSSxFQUFFO2dDQUNKLFVBQVUsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDOzZCQUNsRDt5QkFDRjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsVUFBVTt5QkFDN0I7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFM0csT0FBTztRQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM5QyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyx1Q0FBb0IsRUFBRTtZQUMxRSxJQUFJLEVBQUUsa0JBQWtCO1lBQ3hCLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsV0FBVztnQkFDakIsU0FBUyxFQUFFLFVBQVU7YUFDdEI7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDLENBQ0YsQ0FBQztJQUVGLElBQUEsbUJBQVUsRUFDUixrSEFBa0gsRUFDbEgsS0FBSyxJQUFJLEVBQUU7UUFDVCxRQUFRO1FBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDO1lBQy9CLFVBQVUsRUFBRTtnQkFDVixNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2dCQUMxQixnQkFBZ0IsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7YUFDckM7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7b0JBQy9CLFVBQVUsRUFBRTt3QkFDVixNQUFNLEVBQUU7NEJBQ04sU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLElBQUksRUFBRSxXQUFXO3lCQUNsQjt3QkFDRCxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO3FCQUN4QjtvQkFDRCxRQUFRLEVBQUU7d0JBQ1IsZ0JBQWdCLEVBQUUsVUFBVTtxQkFDN0I7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILEtBQUssQ0FBQywwQkFBMEIsQ0FDOUIsS0FBSyxDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsRUFBRSx5QkFBeUIsRUFBRSxZQUFZLENBQUMsQ0FDbEYsQ0FBQztRQUNGLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixVQUFVLEVBQUU7b0JBQ1YsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtvQkFDMUIsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2lCQUNyQztnQkFDRCxTQUFTLEVBQUU7b0JBQ1QsZ0JBQWdCLEVBQUU7d0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7d0JBQy9CLFVBQVUsRUFBRTs0QkFDVixNQUFNLEVBQUU7Z0NBQ04sU0FBUyxFQUFFLFVBQVU7Z0NBQ3JCLElBQUksRUFBRSxXQUFXOzZCQUNsQjs0QkFDRCxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO3lCQUN4Qjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsVUFBVTt5QkFDN0I7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixFQUFFO1lBQ3pHLGdCQUFnQixFQUFFLGNBQWM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM5QyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyx1Q0FBb0IsRUFBRTtZQUMxRSxJQUFJLEVBQUUsWUFBWTtZQUNsQixNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLFNBQVMsRUFBRSxVQUFVO2FBQ3RCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1IsbUdBQW1HLEVBQ25HLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixVQUFVLEVBQUU7Z0JBQ1YsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTthQUMzQjtZQUNELFNBQVMsRUFBRTtnQkFDVCxnQkFBZ0IsRUFBRTtvQkFDaEIsSUFBSSxFQUFFLHlCQUF5QjtvQkFDL0IsVUFBVSxFQUFFO3dCQUNWLE1BQU0sRUFBRTs0QkFDTixTQUFTLEVBQUUsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFOzRCQUNyQyxJQUFJLEVBQUUsV0FBVzt5QkFDbEI7cUJBQ0Y7b0JBQ0QsUUFBUSxFQUFFO3dCQUNSLGdCQUFnQixFQUFFLFVBQVU7cUJBQzdCO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxLQUFLLENBQUMsMEJBQTBCLENBQzlCLEtBQUssQ0FBQyxjQUFjLENBQUMsa0JBQWtCLEVBQUUseUJBQXlCLEVBQUUsWUFBWSxDQUFDLENBQ2xGLENBQUM7UUFDRixNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsVUFBVSxFQUFFO29CQUNWLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7aUJBQzNCO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixTQUFTLEVBQUUsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFO2dDQUNyQyxJQUFJLEVBQUUsY0FBYzs2QkFDckI7eUJBQ0Y7d0JBQ0QsUUFBUSxFQUFFOzRCQUNSLGdCQUFnQixFQUFFLFVBQVU7eUJBQzdCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUM1RyxrRUFBa0UsQ0FDbkUsQ0FBQztJQUNKLENBQUMsQ0FDRixDQUFDO0lBRUYsSUFBQSxtQkFBVSxFQUNSLDBIQUEwSCxFQUMxSCxLQUFLLElBQUksRUFBRTtRQUNULFFBQVE7UUFDUixLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsU0FBUyxFQUFFO2dCQUNULE1BQU0sRUFBRTtvQkFDTixJQUFJLEVBQUUsaUJBQWlCO2lCQUN4QjtnQkFDRCxnQkFBZ0IsRUFBRTtvQkFDaEIsSUFBSSxFQUFFLHlCQUF5QjtvQkFDL0IsVUFBVSxFQUFFO3dCQUNWLE1BQU0sRUFBRTs0QkFDTixTQUFTLEVBQUUsRUFBRSxZQUFZLEVBQUUsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsRUFBRTs0QkFDM0QsSUFBSSxFQUFFLFdBQVc7eUJBQ2xCO3FCQUNGO29CQUNELFFBQVEsRUFBRTt3QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3FCQUM3QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsS0FBSyxDQUFDLDBCQUEwQixDQUM5QixLQUFLLENBQUMsY0FBYyxDQUFDLGtCQUFrQixFQUFFLHlCQUF5QixFQUFFLFlBQVksQ0FBQyxFQUNqRixLQUFLLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxXQUFXLENBQUMsQ0FDL0QsQ0FBQztRQUNGLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsTUFBTSxFQUFFO3dCQUNOLElBQUksRUFBRSxpQkFBaUI7cUJBQ3hCO29CQUNELGdCQUFnQixFQUFFO3dCQUNoQixJQUFJLEVBQUUseUJBQXlCO3dCQUMvQixVQUFVLEVBQUU7NEJBQ1YsTUFBTSxFQUFFO2dDQUNOLFNBQVMsRUFBRSxFQUFFLFlBQVksRUFBRSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxFQUFFO2dDQUMzRCxJQUFJLEVBQUUsSUFBSTs2QkFDWDt5QkFDRjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsVUFBVTt5QkFDN0I7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxNQUFNLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQzVHLHFMQUFxTCxDQUN0TCxDQUFDO0lBQ0osQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1IsaUdBQWlHLEVBQ2pHLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7b0JBQy9CLFVBQVUsRUFBRTt3QkFDVixNQUFNLEVBQUU7NEJBQ04sU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLElBQUksRUFBRSxXQUFXO3lCQUNsQjtxQkFDRjtvQkFDRCxRQUFRLEVBQUU7d0JBQ1IsZ0JBQWdCLEVBQUUsY0FBYztxQkFDakM7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsZ0JBQWdCLEVBQUU7d0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7d0JBQy9CLFVBQVUsRUFBRTs0QkFDVixNQUFNLEVBQUU7Z0NBQ04sU0FBUyxFQUFFLFVBQVU7Z0NBQ3JCLElBQUksRUFBRSxXQUFXOzZCQUNsQjt5QkFDRjt3QkFDRCxRQUFRLEVBQUU7NEJBQ1IsZ0JBQWdCLEVBQUUsY0FBYzt5QkFDakM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE9BQU87UUFDUCxLQUFLLENBQUMsMEJBQTBCLENBQzlCLEtBQUssQ0FBQyxjQUFjLENBQUMsa0JBQWtCLEVBQUUseUJBQXlCLEVBQUUsMEJBQTBCLENBQUMsQ0FDaEcsQ0FBQztRQUNGLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUUzRyxPQUFPO1FBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzlDLE1BQU0sQ0FBQyw4QkFBbUIsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLHVDQUFvQixFQUFFO1lBQzFFLElBQUksRUFBRSwwQkFBMEI7WUFDaEMsTUFBTSxFQUFFO2dCQUNOLElBQUksRUFBRSxXQUFXO2dCQUNqQixTQUFTLEVBQUUsVUFBVTthQUN0QjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FDRixDQUFDO0lBRUYsSUFBQSxtQkFBVSxFQUNSLHFKQUFxSixFQUNySixLQUFLLElBQUksRUFBRTtRQUNULFFBQVE7UUFDUixLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixFQUFFO29CQUNoQixJQUFJLEVBQUUseUJBQXlCO29CQUMvQixVQUFVLEVBQUU7d0JBQ1YsTUFBTSxFQUFFOzRCQUNOLFNBQVMsRUFBRSxjQUFjOzRCQUN6QixJQUFJLEVBQUUsV0FBVzt5QkFDbEI7d0JBQ0Qsb0JBQW9CLEVBQUUsQ0FBQztxQkFDeEI7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsZ0JBQWdCLEVBQUU7d0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7d0JBQy9CLFVBQVUsRUFBRTs0QkFDVixNQUFNLEVBQUU7Z0NBQ04sU0FBUyxFQUFFLGNBQWM7Z0NBQ3pCLElBQUksRUFBRSxXQUFXOzZCQUNsQjs0QkFDRCxvQkFBb0IsRUFBRSxDQUFDO3lCQUN4QjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUMxQyxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMxQyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsdUNBQW9CLENBQUMsQ0FBQztRQUM5RSxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwRCxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDOUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM5QyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsdUNBQW9CLENBQUMsQ0FBQztRQUM5RSxDQUFDO0lBQ0gsQ0FBQyxDQUNGLENBQUM7SUFFRixJQUFBLG1CQUFVLEVBQ1I7bUdBQytGLEVBQy9GLEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsZ0JBQWdCLEVBQUU7b0JBQ2hCLElBQUksRUFBRSx5QkFBeUI7b0JBQy9CLFVBQVUsRUFBRTt3QkFDVixNQUFNLEVBQUU7NEJBQ04sU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLElBQUksRUFBRSxXQUFXO3lCQUNsQjt3QkFDRCxvQkFBb0IsRUFBRSxDQUFDO3FCQUN4QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLHlCQUF5Qjt3QkFDL0IsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixTQUFTLEVBQUUsVUFBVTtnQ0FDckIsSUFBSSxFQUFFLFdBQVc7NkJBQ2xCOzRCQUNELG9CQUFvQixFQUFFLENBQUM7eUJBQ3hCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMsMEJBQTBCLENBQzlCLEtBQUssQ0FBQyxjQUFjLENBQUMsa0JBQWtCLEVBQUUseUJBQXlCLEVBQUUsMEJBQTBCLENBQUMsQ0FDaEcsQ0FBQztRQUNGLElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDMUMsT0FBTztZQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUUzRyxPQUFPO1lBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDMUMsTUFBTSxDQUFDLDhCQUFtQixDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLHVDQUFvQixDQUFDLENBQUM7UUFDOUUsQ0FBQzthQUFNLElBQUksV0FBVyxLQUFLLG9CQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEQsT0FBTztZQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUUzRyxPQUFPO1lBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzlDLE1BQU0sQ0FBQyw4QkFBbUIsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLHVDQUFvQixFQUFFO2dCQUMxRSxJQUFJLEVBQUUsMEJBQTBCO2dCQUNoQyxNQUFNLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFdBQVc7b0JBQ2pCLFNBQVMsRUFBRSxVQUFVO2lCQUN0QjthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDLENBQ0YsQ0FBQztJQUNGLElBQUEsbUJBQVUsRUFDUiw0SUFBNEksRUFDNUksS0FBSyxJQUFJLEVBQUU7UUFDVCxRQUFRO1FBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDO1lBQy9CLFNBQVMsRUFBRTtnQkFDVCxnQkFBZ0IsRUFBRTtvQkFDaEIsSUFBSSxFQUFFLGdDQUFnQztvQkFDdEMsVUFBVSxFQUFFO3dCQUNWLE1BQU0sRUFBRTs0QkFDTixTQUFTLEVBQUUsY0FBYzs0QkFDekIsSUFBSSxFQUFFLFdBQVc7eUJBQ2xCO3FCQUNGO29CQUNELFFBQVEsRUFBRTt3QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3FCQUM3QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxnQkFBZ0IsRUFBRTt3QkFDaEIsSUFBSSxFQUFFLGdDQUFnQzt3QkFDdEMsVUFBVSxFQUFFOzRCQUNWLE1BQU0sRUFBRTtnQ0FDTixTQUFTLEVBQUUsVUFBVTtnQ0FDckIsSUFBSSxFQUFFLFdBQVc7NkJBQ2xCO3lCQUNGO3dCQUNELFFBQVEsRUFBRTs0QkFDUixnQkFBZ0IsRUFBRSxVQUFVO3lCQUM3QjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUMxQyxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMxQyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsdUNBQW9CLENBQUMsQ0FBQztRQUM5RSxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwRCxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDOUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM5QyxNQUFNLENBQUMsOEJBQW1CLENBQUMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsdUNBQW9CLENBQUMsQ0FBQztRQUM5RSxDQUFDO0lBQ0gsQ0FBQyxDQUNGLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFVwZGF0ZVByb2plY3RDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgbW9ja0NvZGVCdWlsZENsaWVudCB9IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHsgc2lsZW50VGVzdCB9IGZyb20gJy4uLy4uL3V0aWwvc2lsZW50JztcblxubGV0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXI6IHNldHVwLkhvdHN3YXBNb2NrU2RrUHJvdmlkZXI7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwVGVzdHMoKTtcbn0pO1xuXG5kZXNjcmliZS5lYWNoKFtIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssIEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWV0pKCclcCBtb2RlJywgKGhvdHN3YXBNb2RlKSA9PiB7XG4gIHNpbGVudFRlc3QoJ3JldHVybnMgdW5kZWZpbmVkIHdoZW4gYSBuZXcgQ29kZUJ1aWxkIFByb2plY3QgaXMgYWRkZWQgdG8gdGhlIFN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBDb2RlQnVpbGRQcm9qZWN0OiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUHJvamVjdENvbW1hbmQpO1xuICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0Py5ub09wKS50b0VxdWFsKHRydWUpO1xuICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUHJvamVjdENvbW1hbmQpO1xuICAgIH1cbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZVByb2plY3QoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgc291cmNlIGRpZmZlcmVuY2UgaW4gYSBDb2RlQnVpbGQgcHJvamVjdCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTmFtZTogJ215LXByb2plY3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6ICduZXctc3BlYycsXG4gICAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1wcm9qZWN0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQ29kZUJ1aWxkQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVByb2plY3RDb21tYW5kLCB7XG4gICAgICAgIG5hbWU6ICdteS1wcm9qZWN0JyxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgdHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgYnVpbGRzcGVjOiAnbmV3LXNwZWMnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlUHJvamVjdCgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBzb3VyY2UgdmVyc2lvbiBkaWZmZXJlbmNlIGluIGEgQ29kZUJ1aWxkIHByb2plY3QnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ2N1cnJlbnQtc3BlYycsXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE5hbWU6ICdteS1wcm9qZWN0JyxcbiAgICAgICAgICAgICAgU291cmNlVmVyc2lvbjogJ3YxJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICAgIFR5cGU6ICdOT19TT1VSQ0UnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgTmFtZTogJ215LXByb2plY3QnLFxuICAgICAgICAgICAgICAgIFNvdXJjZVZlcnNpb246ICd2MicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0NvZGVCdWlsZENsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVQcm9qZWN0Q29tbWFuZCwge1xuICAgICAgICBuYW1lOiAnbXktcHJvamVjdCcsXG4gICAgICAgIHNvdXJjZVZlcnNpb246ICd2MicsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVQcm9qZWN0KCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhbiBlbnZpcm9ubWVudCBkaWZmZXJlbmNlIGluIGEgQ29kZUJ1aWxkIHByb2plY3QnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ2N1cnJlbnQtc3BlYycsXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE5hbWU6ICdteS1wcm9qZWN0JyxcbiAgICAgICAgICAgICAgRW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICBDb21wdXRlVHlwZTogJ0JVSUxEX0dFTkVSQUwxX1NNQUxMJyxcbiAgICAgICAgICAgICAgICBFbnZpcm9ubWVudFZhcmlhYmxlczogW1xuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBOYW1lOiAnU1VQRVJfSU1QT1JUQU5UX0VOVl9WQVInLFxuICAgICAgICAgICAgICAgICAgICBUeXBlOiAnUExBSU5URVhUJyxcbiAgICAgICAgICAgICAgICAgICAgVmFsdWU6ICdzdXBlciBjb29sIHZhbHVlJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIE5hbWU6ICdTRUNPTkRfSU1QT1JUQU5UX0VOVl9WQVInLFxuICAgICAgICAgICAgICAgICAgICBUeXBlOiAnUExBSU5URVhUJyxcbiAgICAgICAgICAgICAgICAgICAgVmFsdWU6ICd5ZXQgYW5vdGhlciBzdXBlciBjb29sIHZhbHVlJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBJbWFnZTogJ2F3cy9jb2RlYnVpbGQvc3RhbmRhcmQ6MS4wJyxcbiAgICAgICAgICAgICAgICBJbWFnZVB1bGxDcmVkZW50aWFsc1R5cGU6ICdDT0RFQlVJTEQnLFxuICAgICAgICAgICAgICAgIFByaXZpbGVnZWRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTElOVVhfQ09OVEFJTkVSJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICAgIFR5cGU6ICdOT19TT1VSQ0UnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgTmFtZTogJ215LXByb2plY3QnLFxuICAgICAgICAgICAgICAgIEVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAgICBDb21wdXRlVHlwZTogJ0JVSUxEX0dFTkVSQUwxX1NNQUxMJyxcbiAgICAgICAgICAgICAgICAgIEVudmlyb25tZW50VmFyaWFibGVzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBOYW1lOiAnU1VQRVJfSU1QT1JUQU5UX0VOVl9WQVInLFxuICAgICAgICAgICAgICAgICAgICAgIFR5cGU6ICdQTEFJTlRFWFQnLFxuICAgICAgICAgICAgICAgICAgICAgIFZhbHVlOiAnY2hhbmdlZCB2YWx1ZScsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBOYW1lOiAnTkVXX0lNUE9SVEFOVF9FTlZfVkFSJyxcbiAgICAgICAgICAgICAgICAgICAgICBUeXBlOiAnUExBSU5URVhUJyxcbiAgICAgICAgICAgICAgICAgICAgICBWYWx1ZTogJ25ldyB2YWx1ZScsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgSW1hZ2U6ICdhd3MvY29kZWJ1aWxkL3N0YW5kYXJkOjEuMCcsXG4gICAgICAgICAgICAgICAgICBJbWFnZVB1bGxDcmVkZW50aWFsc1R5cGU6ICdDT0RFQlVJTEQnLFxuICAgICAgICAgICAgICAgICAgUHJpdmlsZWdlZE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgVHlwZTogJ0xJTlVYX0NPTlRBSU5FUicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQ29kZUJ1aWxkQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVByb2plY3RDb21tYW5kLCB7XG4gICAgICAgIG5hbWU6ICdteS1wcm9qZWN0JyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBjb21wdXRlVHlwZTogJ0JVSUxEX0dFTkVSQUwxX1NNQUxMJyxcbiAgICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnU1VQRVJfSU1QT1JUQU5UX0VOVl9WQVInLFxuICAgICAgICAgICAgICB0eXBlOiAnUExBSU5URVhUJyxcbiAgICAgICAgICAgICAgdmFsdWU6ICdjaGFuZ2VkIHZhbHVlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIG5hbWU6ICdORVdfSU1QT1JUQU5UX0VOVl9WQVInLFxuICAgICAgICAgICAgICB0eXBlOiAnUExBSU5URVhUJyxcbiAgICAgICAgICAgICAgdmFsdWU6ICduZXcgdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGltYWdlOiAnYXdzL2NvZGVidWlsZC9zdGFuZGFyZDoxLjAnLFxuICAgICAgICAgIGltYWdlUHVsbENyZWRlbnRpYWxzVHlwZTogJ0NPREVCVUlMRCcsXG4gICAgICAgICAgcHJpdmlsZWdlZE1vZGU6IGZhbHNlLFxuICAgICAgICAgIHR5cGU6ICdMSU5VWF9DT05UQUlORVInLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwiY29ycmVjdGx5IGV2YWx1YXRlcyB0aGUgcHJvamVjdCdzIG5hbWUgd2hlbiBpdCByZWZlcmVuY2VzIGEgZGlmZmVyZW50IHJlc291cmNlIGZyb20gdGhlIHRlbXBsYXRlXCIsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQnVja2V0OiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ2N1cnJlbnQtc3BlYycsXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE5hbWU6IHtcbiAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbJy0nLCBbeyBSZWY6ICdCdWNrZXQnIH0sICdwcm9qZWN0J11dLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKHNldHVwLnN0YWNrU3VtbWFyeU9mKCdCdWNrZXQnLCAnQVdTOjpTMzo6QnVja2V0JywgJ215YnVja2V0JykpO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBCdWNrZXQ6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6ICduZXctc3BlYycsXG4gICAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIE5hbWU6IHtcbiAgICAgICAgICAgICAgICAgICdGbjo6Sm9pbic6IFsnLScsIFt7IFJlZjogJ0J1Y2tldCcgfSwgJ3Byb2plY3QnXV0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQ29kZUJ1aWxkQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVByb2plY3RDb21tYW5kLCB7XG4gICAgICAgIG5hbWU6ICdteWJ1Y2tldC1wcm9qZWN0JyxcbiAgICAgICAgc291cmNlOiB7XG4gICAgICAgICAgdHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgYnVpbGRzcGVjOiAnbmV3LXNwZWMnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIFwiY29ycmVjdGx5IGZhbGxzIGJhY2sgdG8gdGFraW5nIHRoZSBwcm9qZWN0J3MgbmFtZSBmcm9tIHRoZSBjdXJyZW50IHN0YWNrIGlmIGl0IGNhbid0IGV2YWx1YXRlIGl0IGluIHRoZSB0ZW1wbGF0ZVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICBBc3NldEJ1Y2tldFBhcmFtOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ2N1cnJlbnQtc3BlYycsXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE5hbWU6IHsgUmVmOiAnUGFyYW0xJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignQ29kZUJ1aWxkUHJvamVjdCcsICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsICdteS1wcm9qZWN0JyksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgUGFyYW0xOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgICAgICBBc3NldEJ1Y2tldFBhcmFtOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnbmV3LXNwZWMnLFxuICAgICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBOYW1lOiB7IFJlZjogJ1BhcmFtMScgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCwge1xuICAgICAgICBBc3NldEJ1Y2tldFBhcmFtOiAnYXNzZXQtYnVja2V0JyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0NvZGVCdWlsZENsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVQcm9qZWN0Q29tbWFuZCwge1xuICAgICAgICBuYW1lOiAnbXktcHJvamVjdCcsXG4gICAgICAgIHNvdXJjZToge1xuICAgICAgICAgIHR5cGU6ICdOT19TT1VSQ0UnLFxuICAgICAgICAgIGJ1aWxkc3BlYzogJ25ldy1zcGVjJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBcIndpbGwgbm90IHBlcmZvcm0gYSBob3Rzd2FwIGRlcGxveW1lbnQgaWYgaXQgY2Fubm90IGZpbmQgYSBSZWYgdGFyZ2V0IChvdXRzaWRlIHRoZSBwcm9qZWN0J3MgbmFtZSlcIixcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgUGFyYW0xOiB7IFR5cGU6ICdTdHJpbmcnIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIENvZGVCdWlsZFByb2plY3Q6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogeyAnRm46OlN1Yic6ICcke1BhcmFtMX0nIH0sXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKCdDb2RlQnVpbGRQcm9qZWN0JywgJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JywgJ215LXByb2plY3QnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICBQYXJhbTE6IHsgVHlwZTogJ1N0cmluZycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6IHsgJ0ZuOjpTdWInOiAnJHtQYXJhbTF9JyB9LFxuICAgICAgICAgICAgICAgICAgVHlwZTogJ0NPREVQSVBFTElORScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGF3YWl0IGV4cGVjdCgoKSA9PiBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgICAvUGFyYW1ldGVyIG9yIHJlc291cmNlICdQYXJhbTEnIGNvdWxkIG5vdCBiZSBmb3VuZCBmb3IgZXZhbHVhdGlvbi8sXG4gICAgICApO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBcIndpbGwgbm90IHBlcmZvcm0gYSBob3Rzd2FwIGRlcGxveW1lbnQgaWYgaXQgZG9lc24ndCBrbm93IGhvdyB0byBoYW5kbGUgYSBzcGVjaWZpYyBhdHRyaWJ1dGUgKG91dHNpZGUgdGhlIHByb2plY3QncyBuYW1lKVwiLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBDb2RlQnVpbGRQcm9qZWN0OiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBTb3VyY2U6IHtcbiAgICAgICAgICAgICAgICBCdWlsZFNwZWM6IHsgJ0ZuOjpHZXRBdHQnOiBbJ0J1Y2tldCcsICdVbmtub3duQXR0cmlidXRlJ10gfSxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0NvZGVCdWlsZFByb2plY3QnLCAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLCAnbXktcHJvamVjdCcpLFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignQnVja2V0JywgJ0FXUzo6UzM6OkJ1Y2tldCcsICdteS1idWNrZXQnKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEJ1Y2tldDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBDb2RlQnVpbGRQcm9qZWN0OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBTb3VyY2U6IHtcbiAgICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogeyAnRm46OkdldEF0dCc6IFsnQnVja2V0JywgJ1Vua25vd25BdHRyaWJ1dGUnXSB9LFxuICAgICAgICAgICAgICAgICAgVHlwZTogJ1MzJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgYXdhaXQgZXhwZWN0KCgpID0+IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICAgIFwiV2UgZG9uJ3Qgc3VwcG9ydCB0aGUgJ1Vua25vd25BdHRyaWJ1dGUnIGF0dHJpYnV0ZSBvZiB0aGUgJ0FXUzo6UzM6OkJ1Y2tldCcgcmVzb3VyY2UuIFRoaXMgaXMgYSBDREsgbGltaXRhdGlvbi4gUGxlYXNlIHJlcG9ydCBpdCBhdCBodHRwczovL2dpdGh1Yi5jb20vYXdzL2F3cy1jZGsvaXNzdWVzL25ldy9jaG9vc2VcIixcbiAgICAgICk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlUHJvamVjdCgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIGEgZGlmZmVyZW5jZSBpbiBhIENvZGVCdWlsZCBwcm9qZWN0IHdpdGggbm8gbmFtZScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnY3VycmVudC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBDb2RlQnVpbGRQcm9qZWN0OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBTb3VyY2U6IHtcbiAgICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ25ldy1zcGVjJyxcbiAgICAgICAgICAgICAgICAgIFR5cGU6ICdOT19TT1VSQ0UnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ2N1cnJlbnQtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKCdDb2RlQnVpbGRQcm9qZWN0JywgJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JywgJ21vY2stcHJvamVjdC1yZXNvdXJjZS1pZCcpLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQ29kZUJ1aWxkQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVByb2plY3RDb21tYW5kLCB7XG4gICAgICAgIG5hbWU6ICdtb2NrLXByb2plY3QtcmVzb3VyY2UtaWQnLFxuICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICB0eXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICBidWlsZHNwZWM6ICduZXctc3BlYycsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2RvZXMgbm90IGNhbGwgdGhlIHVwZGF0ZVByb2plY3QoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBhIGNoYW5nZSB0aGF0IGlzIG5vdCBTb3VyY2UsIFNvdXJjZVZlcnNpb24sIG9yIEVudmlyb25tZW50IGRpZmZlcmVuY2UgaW4gYSBDb2RlQnVpbGQgcHJvamVjdCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgQ29uY3VycmVudEJ1aWxkTGltaXQ6IDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6ICdjdXJyZW50LXNwZWMnLFxuICAgICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBDb25jdXJyZW50QnVpbGRMaW1pdDogMixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUHJvamVjdENvbW1hbmQpO1xuICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0Py5ub09wKS50b0VxdWFsKHRydWUpO1xuICAgICAgICBleHBlY3QobW9ja0NvZGVCdWlsZENsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVQcm9qZWN0Q29tbWFuZCk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIGB3aGVuIGl0IHJlY2VpdmVzIGEgY2hhbmdlIHRoYXQgaXMgbm90IFNvdXJjZSwgU291cmNlVmVyc2lvbiwgb3IgRW52aXJvbm1lbnQgZGlmZmVyZW5jZSBpbiBhIENvZGVCdWlsZCBwcm9qZWN0IGFsb25nc2lkZSBhIGhvdHN3YXBwYWJsZSBjaGFuZ2UsXG4gICAgICAgIGl0IGRvZXMgbm90IGNhbGwgdGhlIHVwZGF0ZVByb2plY3QoKSBBUEkgaW4gQ0xBU1NJQyBtb2RlLCBidXQgaXQgZG9lcyBpbiBIT1RTV0FQX09OTFkgbW9kZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0JyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgQnVpbGRTcGVjOiAnY3VycmVudC1zcGVjJyxcbiAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgQ29uY3VycmVudEJ1aWxkTGltaXQ6IDEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDb2RlQnVpbGQ6OlByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6ICduZXctc3BlYycsXG4gICAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIENvbmN1cnJlbnRCdWlsZExpbWl0OiAyLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignQ29kZUJ1aWxkUHJvamVjdCcsICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsICdtb2NrLXByb2plY3QtcmVzb3VyY2UtaWQnKSxcbiAgICAgICk7XG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUHJvamVjdENvbW1hbmQpO1xuICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlUHJvamVjdENvbW1hbmQsIHtcbiAgICAgICAgICBuYW1lOiAnbW9jay1wcm9qZWN0LXJlc291cmNlLWlkJyxcbiAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgIHR5cGU6ICdOT19TT1VSQ0UnLFxuICAgICAgICAgICAgYnVpbGRzcGVjOiAnbmV3LXNwZWMnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG4gIHNpbGVudFRlc3QoXG4gICAgJ2RvZXMgbm90IGNhbGwgdGhlIHVwZGF0ZVByb2plY3QoKSBBUEkgd2hlbiBhIHJlc291cmNlIHdpdGggdHlwZSB0aGF0IGlzIG5vdCBBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCBidXQgaGFzIHRoZSBzYW1lIHByb3BlcnRpZXMgaXMgY2hhbmdlZCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ29kZUJ1aWxkUHJvamVjdDoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Tm90Q29kZUJ1aWxkOjpOb3RBUHJvamVjdCcsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFNvdXJjZToge1xuICAgICAgICAgICAgICAgIEJ1aWxkU3BlYzogJ2N1cnJlbnQtc3BlYycsXG4gICAgICAgICAgICAgICAgVHlwZTogJ05PX1NPVVJDRScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBDb2RlQnVpbGRQcm9qZWN0OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6Ok5vdENvZGVCdWlsZDo6Tm90QVByb2plY3QnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgU291cmNlOiB7XG4gICAgICAgICAgICAgICAgICBCdWlsZFNwZWM6ICduZXctc3BlYycsXG4gICAgICAgICAgICAgICAgICBUeXBlOiAnTk9fU09VUkNFJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrQ29kZUJ1aWxkQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVByb2plY3RDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgICAgZXhwZWN0KG1vY2tDb2RlQnVpbGRDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUHJvamVjdENvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG59KTtcbiJdfQ==