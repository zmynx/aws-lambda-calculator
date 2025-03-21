"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const client_appsync_1 = require("@aws-sdk/client-appsync");
const client_s3_1 = require("@aws-sdk/client-s3");
const util_stream_1 = require("@smithy/util-stream");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
const getBodyStream = (input) => {
    const stream = new stream_1.Readable();
    stream._read = () => { };
    stream.push(input);
    stream.push(null); // close the stream
    return (0, util_stream_1.sdkStreamMixin)(stream);
};
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)(`A new Resolver being added to the Stack returns undefined in CLASSIC mode and
        returns a noOp in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
        }
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateFunctionCommand);
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateResolverCommand);
    });
    (0, silent_1.silentTest)('calls the updateResolver() API when it receives only a mapping template difference in a Unit Resolver', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ApiId: 'apiId',
                        FieldName: 'myField',
                        TypeName: 'Query',
                        DataSourceName: 'my-datasource',
                        Kind: 'UNIT',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ApiId: 'apiId',
                            FieldName: 'myField',
                            TypeName: 'Query',
                            DataSourceName: 'my-datasource',
                            Kind: 'UNIT',
                            RequestMappingTemplate: '## new request template',
                            ResponseMappingTemplate: '## original response template',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            typeName: 'Query',
            fieldName: 'myField',
            kind: 'UNIT',
            requestMappingTemplate: '## new request template',
            responseMappingTemplate: '## original response template',
        });
    });
    (0, silent_1.silentTest)('calls the updateResolver() API when it receives only a mapping template difference s3 location in a Unit Resolver', async () => {
        // GIVEN
        const body = getBodyStream('template defined in s3');
        mock_sdk_1.mockS3Client.on(client_s3_1.GetObjectCommand).resolves({
            Body: body,
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ApiId: 'apiId',
                        FieldName: 'myField',
                        TypeName: 'Query',
                        DataSourceName: 'my-datasource',
                        Kind: 'UNIT',
                        RequestMappingTemplateS3Location: 's3://test-bucket/old_location',
                        ResponseMappingTemplate: '## original response template',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ApiId: 'apiId',
                            FieldName: 'myField',
                            TypeName: 'Query',
                            DataSourceName: 'my-datasource',
                            Kind: 'UNIT',
                            RequestMappingTemplateS3Location: 's3://test-bucket/path/to/key',
                            ResponseMappingTemplate: '## original response template',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            typeName: 'Query',
            fieldName: 'myField',
            kind: 'UNIT',
            requestMappingTemplate: 'template defined in s3',
            responseMappingTemplate: '## original response template',
        });
        expect(mock_sdk_1.mockS3Client).toHaveReceivedCommandWith(client_s3_1.GetObjectCommand, {
            Bucket: 'test-bucket',
            Key: 'path/to/key',
        });
    });
    (0, silent_1.silentTest)('calls the updateResolver() API when it receives only a code s3 location in a Pipeline Resolver', async () => {
        // GIVEN
        const body = getBodyStream('code defined in s3');
        mock_sdk_1.mockS3Client.on(client_s3_1.GetObjectCommand).resolves({
            Body: body,
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ApiId: 'apiId',
                        FieldName: 'myField',
                        TypeName: 'Query',
                        DataSourceName: 'my-datasource',
                        PipelineConfig: ['function1'],
                        CodeS3Location: 's3://test-bucket/old_location',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ApiId: 'apiId',
                            FieldName: 'myField',
                            TypeName: 'Query',
                            DataSourceName: 'my-datasource',
                            PipelineConfig: ['function1'],
                            CodeS3Location: 's3://test-bucket/path/to/key',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            typeName: 'Query',
            fieldName: 'myField',
            pipelineConfig: ['function1'],
            code: 'code defined in s3',
        });
        expect(mock_sdk_1.mockS3Client).toHaveReceivedCommandWith(client_s3_1.GetObjectCommand, {
            Bucket: 'test-bucket',
            Key: 'path/to/key',
        });
    });
    (0, silent_1.silentTest)('calls the updateResolver() API when it receives only a code difference in a Pipeline Resolver', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ApiId: 'apiId',
                        FieldName: 'myField',
                        TypeName: 'Query',
                        DataSourceName: 'my-datasource',
                        PipelineConfig: ['function1'],
                        Code: 'old code',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ApiId: 'apiId',
                            FieldName: 'myField',
                            TypeName: 'Query',
                            DataSourceName: 'my-datasource',
                            PipelineConfig: ['function1'],
                            Code: 'new code',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            typeName: 'Query',
            fieldName: 'myField',
            pipelineConfig: ['function1'],
            code: 'new code',
        });
    });
    (0, silent_1.silentTest)('calls the updateResolver() API when it receives only a mapping template difference in a Pipeline Resolver', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ApiId: 'apiId',
                        FieldName: 'myField',
                        TypeName: 'Query',
                        DataSourceName: 'my-datasource',
                        Kind: 'PIPELINE',
                        PipelineConfig: ['function1'],
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ApiId: 'apiId',
                            FieldName: 'myField',
                            TypeName: 'Query',
                            DataSourceName: 'my-datasource',
                            Kind: 'PIPELINE',
                            PipelineConfig: ['function1'],
                            RequestMappingTemplate: '## new request template',
                            ResponseMappingTemplate: '## original response template',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            typeName: 'Query',
            fieldName: 'myField',
            kind: 'PIPELINE',
            pipelineConfig: ['function1'],
            requestMappingTemplate: '## new request template',
            responseMappingTemplate: '## original response template',
        });
    });
    (0, silent_1.silentTest)(`when it receives a change that is not a mapping template difference in a Resolver, it does not call the updateResolver() API in CLASSIC mode
        but does call the updateResolver() API in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::Resolver',
                    Properties: {
                        ResponseMappingTemplate: '## original response template',
                        RequestMappingTemplate: '## original request template',
                        FieldName: 'oldField',
                        ApiId: 'apiId',
                        TypeName: 'Query',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncResolver', 'AWS::AppSync::Resolver', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/types/Query/resolvers/myField'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::Resolver',
                        Properties: {
                            ResponseMappingTemplate: '## original response template',
                            RequestMappingTemplate: '## new request template',
                            FieldName: 'newField',
                            ApiId: 'apiId',
                            TypeName: 'Query',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateResolverCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateResolverCommand, {
                apiId: 'apiId',
                typeName: 'Query',
                fieldName: 'oldField',
                requestMappingTemplate: '## new request template',
                responseMappingTemplate: '## original response template',
            });
        }
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateFunctionCommand);
    });
    (0, silent_1.silentTest)('does not call the updateResolver() API when a resource with type that is not AWS::AppSync::Resolver but has the same properties is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncResolver: {
                    Type: 'AWS::AppSync::NotAResolver',
                    Properties: {
                        RequestMappingTemplate: '## original template',
                        FieldName: 'oldField',
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
                    AppSyncResolver: {
                        Type: 'AWS::AppSync::NotAResolver',
                        Properties: {
                            RequestMappingTemplate: '## new template',
                            FieldName: 'newField',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
        }
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateFunctionCommand);
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateResolverCommand);
    });
    (0, silent_1.silentTest)('calls the updateFunction() API when it receives only a mapping template difference in a Function', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolves({ functions: [{ name: 'my-function', functionId: 'functionId' }] });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            RequestMappingTemplate: '## original request template',
                            ResponseMappingTemplate: '## new response template',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            functionVersion: '2018-05-29',
            name: 'my-function',
            requestMappingTemplate: '## original request template',
            responseMappingTemplate: '## new response template',
        });
    });
    (0, silent_1.silentTest)('calls the updateFunction() API with function version when it receives both function version and runtime with a mapping template in a Function', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolves({ functions: [{ name: 'my-function', functionId: 'functionId' }] });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        Runtime: 'APPSYNC_JS',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            Runtime: 'APPSYNC_JS',
                            RequestMappingTemplate: '## original request template',
                            ResponseMappingTemplate: '## new response template',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            functionVersion: '2018-05-29',
            name: 'my-function',
            requestMappingTemplate: '## original request template',
            responseMappingTemplate: '## new response template',
        });
    });
    (0, silent_1.silentTest)('calls the updateFunction() API with runtime when it receives both function version and runtime with code in a Function', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolves({ functions: [{ name: 'my-function', functionId: 'functionId' }] });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        Runtime: 'APPSYNC_JS',
                        Code: 'old test code',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            Runtime: 'APPSYNC_JS',
                            Code: 'new test code',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            runtime: 'APPSYNC_JS',
            name: 'my-function',
            code: 'new test code',
        });
    });
    (0, silent_1.silentTest)('calls the updateFunction() API when it receives only a mapping template s3 location difference in a Function', async () => {
        // GIVEN
        mock_sdk_1.mockS3Client.on(client_s3_1.GetObjectCommand).resolves({
            Body: getBodyStream('template defined in s3'),
        });
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolves({ functions: [{ name: 'my-function', functionId: 'functionId' }] });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplateS3Location: 's3://test-bucket/old_location',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            RequestMappingTemplate: '## original request template',
                            ResponseMappingTemplateS3Location: 's3://test-bucket/path/to/key',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            functionVersion: '2018-05-29',
            name: 'my-function',
            requestMappingTemplate: '## original request template',
            responseMappingTemplate: 'template defined in s3',
        });
        expect(mock_sdk_1.mockS3Client).toHaveReceivedCommandWith(client_s3_1.GetObjectCommand, {
            Bucket: 'test-bucket',
            Key: 'path/to/key',
        });
    });
    (0, silent_1.silentTest)(`when it receives a change that is not a mapping template difference in a Function, it does not call the updateFunction() API in CLASSIC mode
        but does in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolves({ functions: [{ name: 'my-function', functionId: 'functionId' }] });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            RequestMappingTemplate: '## new request template',
                            ResponseMappingTemplate: '## original response template',
                            ApiId: 'apiId',
                            Name: 'my-function',
                            DataSourceName: 'new-datasource',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
                apiId: 'apiId',
                dataSourceName: 'my-datasource',
                functionId: 'functionId',
                name: 'my-function',
                requestMappingTemplate: '## new request template',
                responseMappingTemplate: '## original response template',
            });
            expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateResolverCommand);
        }
    });
    (0, silent_1.silentTest)('does not call the updateFunction() API when a resource with type that is not AWS::AppSync::FunctionConfiguration but has the same properties is changed', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::NotAFunctionConfiguration',
                    Properties: {
                        RequestMappingTemplate: '## original template',
                        Name: 'my-function',
                        DataSourceName: 'my-datasource',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::NotAFunctionConfiguration',
                        Properties: {
                            RequestMappingTemplate: '## new template',
                            Name: 'my-resolver',
                            DataSourceName: 'my-datasource',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
        }
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateFunctionCommand);
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.UpdateResolverCommand);
    });
    (0, silent_1.silentTest)('calls the startSchemaCreation() API when it receives only a definition difference in a graphql schema', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.StartSchemaCreationCommand).resolvesOnce({
            status: 'SUCCESS',
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::GraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        Definition: 'original graphqlSchema',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::GraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            Definition: 'new graphqlSchema',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.StartSchemaCreationCommand, {
            apiId: 'apiId',
            definition: 'new graphqlSchema',
        });
    });
    (0, silent_1.silentTest)('updateFunction() API recovers from failed update attempt through retry logic', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolvesOnce({
            functions: [{ name: 'my-function', functionId: 'functionId' }],
        });
        const ConcurrentModError = new Error('ConcurrentModificationException: Schema is currently being altered, please wait until that is complete.');
        ConcurrentModError.name = 'ConcurrentModificationException';
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.UpdateFunctionCommand)
            .rejectsOnce(ConcurrentModError)
            .resolvesOnce({ functionConfiguration: { name: 'my-function', dataSourceName: 'my-datasource', functionId: 'functionId' } });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            RequestMappingTemplate: '## original request template',
                            ResponseMappingTemplate: '## new response template',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandTimes(client_appsync_1.UpdateFunctionCommand, 2); // 1st failure then success on retry
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            functionVersion: '2018-05-29',
            name: 'my-function',
            requestMappingTemplate: '## original request template',
            responseMappingTemplate: '## new response template',
        });
    });
    (0, silent_1.silentTest)('updateFunction() API fails if it recieves 7 failed attempts in a row - this is a long running test', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolvesOnce({
            functions: [{ name: 'my-function', functionId: 'functionId' }],
        });
        const ConcurrentModError = new Error('ConcurrentModificationException: Schema is currently being altered, please wait until that is complete.');
        ConcurrentModError.name = 'ConcurrentModificationException';
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.UpdateFunctionCommand)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .rejectsOnce(ConcurrentModError)
            .resolvesOnce({ functionConfiguration: { name: 'my-function', dataSourceName: 'my-datasource', functionId: 'functionId' } });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        RequestMappingTemplate: '## original request template',
                        ResponseMappingTemplate: '## original response template',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            RequestMappingTemplate: '## original request template',
                            ResponseMappingTemplate: '## new response template',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow('ConcurrentModificationException');
        // THEN
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandTimes(client_appsync_1.UpdateFunctionCommand, 7); // 1st attempt and then 6 retries before bailing
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            functionVersion: '2018-05-29',
            name: 'my-function',
            requestMappingTemplate: '## original request template',
            responseMappingTemplate: '## new response template',
        });
    }, 320000);
    (0, silent_1.silentTest)('calls the updateFunction() API with functionId when function is listed on second page', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient
            .on(client_appsync_1.ListFunctionsCommand)
            .resolvesOnce({
            functions: [{ name: 'other-function', functionId: 'other-functionId' }],
            nextToken: 'nextToken',
        })
            .resolvesOnce({
            functions: [{ name: 'my-function', functionId: 'functionId' }],
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncFunction: {
                    Type: 'AWS::AppSync::FunctionConfiguration',
                    Properties: {
                        Name: 'my-function',
                        ApiId: 'apiId',
                        DataSourceName: 'my-datasource',
                        FunctionVersion: '2018-05-29',
                        Runtime: 'APPSYNC_JS',
                        Code: 'old test code',
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
                    AppSyncFunction: {
                        Type: 'AWS::AppSync::FunctionConfiguration',
                        Properties: {
                            Name: 'my-function',
                            ApiId: 'apiId',
                            DataSourceName: 'my-datasource',
                            FunctionVersion: '2018-05-29',
                            Runtime: 'APPSYNC_JS',
                            Code: 'new test code',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandTimes(client_appsync_1.ListFunctionsCommand, 2);
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedNthCommandWith(1, client_appsync_1.ListFunctionsCommand, {
            apiId: 'apiId',
            nextToken: 'nextToken',
        });
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedNthCommandWith(2, client_appsync_1.ListFunctionsCommand, {
            apiId: 'apiId',
        });
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateFunctionCommand, {
            apiId: 'apiId',
            dataSourceName: 'my-datasource',
            functionId: 'functionId',
            runtime: 'APPSYNC_JS',
            name: 'my-function',
            code: 'new test code',
        });
    });
    (0, silent_1.silentTest)('calls the startSchemaCreation() API when it receives only a definition difference in a graphql schema', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.StartSchemaCreationCommand).resolves({ status: 'SUCCESS' });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::GraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        Definition: 'original graphqlSchema',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::GraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            Definition: 'new graphqlSchema',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.StartSchemaCreationCommand, {
            apiId: 'apiId',
            definition: 'new graphqlSchema',
        });
    });
    (0, silent_1.silentTest)('calls the startSchemaCreation() API when it receives only a definition s3 location difference in a graphql schema', async () => {
        // GIVEN
        mock_sdk_1.mockS3Client.on(client_s3_1.GetObjectCommand).resolves({
            Body: getBodyStream('schema defined in s3'),
        });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::GraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        DefinitionS3Location: 's3://test-bucket/old_location',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::GraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            DefinitionS3Location: 's3://test-bucket/path/to/key',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.StartSchemaCreationCommand, {
            apiId: 'apiId',
            definition: 'schema defined in s3',
        });
        expect(mock_sdk_1.mockS3Client).toHaveReceivedCommandWith(client_s3_1.GetObjectCommand, {
            Bucket: 'test-bucket',
            Key: 'path/to/key',
        });
    });
    (0, silent_1.silentTest)('does not call startSchemaCreation() API when a resource with type that is not AWS::AppSync::GraphQLSchema but has the same properties is change', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::NotGraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        Definition: 'original graphqlSchema',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::NotGraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            Definition: 'new graphqlSchema',
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
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            expect(deployStackResult).toBeUndefined();
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
        }
        expect(mock_sdk_1.mockAppSyncClient).not.toHaveReceivedCommand(client_appsync_1.StartSchemaCreationCommand);
    });
    (0, silent_1.silentTest)('calls the startSchemaCreation() and waits for schema creation to stabilize before finishing', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.StartSchemaCreationCommand).resolvesOnce({ status: 'PROCESSING' });
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.GetSchemaCreationStatusCommand).resolvesOnce({ status: 'SUCCESS' });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::GraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        Definition: 'original graphqlSchema',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::GraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            Definition: 'new graphqlSchema',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.StartSchemaCreationCommand, {
            apiId: 'apiId',
            definition: 'new graphqlSchema',
        });
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.GetSchemaCreationStatusCommand, {
            apiId: 'apiId',
        });
    });
    (0, silent_1.silentTest)('calls the startSchemaCreation() and throws if schema creation fails', async () => {
        // GIVEN
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.StartSchemaCreationCommand).resolvesOnce({ status: 'PROCESSING' });
        mock_sdk_1.mockAppSyncClient.on(client_appsync_1.GetSchemaCreationStatusCommand).resolvesOnce({ status: 'FAILED', details: 'invalid schema' });
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncGraphQLSchema: {
                    Type: 'AWS::AppSync::GraphQLSchema',
                    Properties: {
                        ApiId: 'apiId',
                        Definition: 'original graphqlSchema',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncGraphQLSchema', 'AWS::AppSync::GraphQLSchema', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/schema/my-schema'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncGraphQLSchema: {
                        Type: 'AWS::AppSync::GraphQLSchema',
                        Properties: {
                            ApiId: 'apiId',
                            Definition: 'new graphqlSchema',
                        },
                        Metadata: {
                            'aws:asset:path': 'new-path',
                        },
                    },
                },
            },
        });
        // WHEN
        await expect(() => hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact)).rejects.toThrow('invalid schema');
        // THEN
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.StartSchemaCreationCommand, {
            apiId: 'apiId',
            definition: 'new graphqlSchema',
        });
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.GetSchemaCreationStatusCommand, {
            apiId: 'apiId',
        });
    });
    (0, silent_1.silentTest)('calls the updateApiKey() API when it receives only a expires property difference in an AppSync ApiKey', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncApiKey: {
                    Type: 'AWS::AppSync::ApiKey',
                    Properties: {
                        ApiId: 'apiId',
                        Expires: 1000,
                        Id: 'key-id',
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncApiKey', 'AWS::AppSync::ApiKey', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/apikeys/api-key-id'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncApiKey: {
                        Type: 'AWS::AppSync::ApiKey',
                        Properties: {
                            ApiId: 'apiId',
                            Expires: 1001,
                            Id: 'key-id',
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateApiKeyCommand, {
            apiId: 'apiId',
            expires: 1001,
            id: 'key-id',
        });
    });
    (0, silent_1.silentTest)('calls the updateApiKey() API when it receives only a expires property difference and no api-key-id in an AppSync ApiKey', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                AppSyncApiKey: {
                    Type: 'AWS::AppSync::ApiKey',
                    Properties: {
                        ApiId: 'apiId',
                        Expires: 1000,
                    },
                    Metadata: {
                        'aws:asset:path': 'old-path',
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('AppSyncApiKey', 'AWS::AppSync::ApiKey', 'arn:aws:appsync:us-east-1:111111111111:apis/apiId/apikeys/api-key-id'));
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    AppSyncApiKey: {
                        Type: 'AWS::AppSync::ApiKey',
                        Properties: {
                            ApiId: 'apiId',
                            Expires: 1001,
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
        expect(mock_sdk_1.mockAppSyncClient).toHaveReceivedCommandWith(client_appsync_1.UpdateApiKeyCommand, {
            apiId: 'apiId',
            expires: 1001,
            id: 'api-key-id',
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1tYXBwaW5nLXRlbXBsYXRlcy1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcHBzeW5jLW1hcHBpbmctdGVtcGxhdGVzLWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1DQUFrQztBQUNsQyw0REFPaUM7QUFDakMsa0RBQXNEO0FBQ3RELHFEQUFxRDtBQUNyRCw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELGtEQUFzRTtBQUN0RSw4Q0FBK0M7QUFFL0MsSUFBSSxzQkFBb0QsQ0FBQztBQUV6RCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2Qsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxNQUFNLGFBQWEsR0FBRyxDQUFDLEtBQWEsRUFBRSxFQUFFO0lBQ3RDLE1BQU0sTUFBTSxHQUFHLElBQUksaUJBQVEsRUFBRSxDQUFDO0lBQzlCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtJQUN0QyxPQUFPLElBQUEsNEJBQWMsRUFBQyxNQUFNLENBQUMsQ0FBQztBQUNoQyxDQUFDLENBQUM7QUFFRixRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFDUjs0Q0FDd0MsRUFDeEMsS0FBSyxJQUFJLEVBQUU7UUFDVCxRQUFRO1FBQ1IsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENB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TyxFQUFFLElBQUk7WUFDYixFQUFFLEVBQUUsWUFBWTtTQUNqQixDQUFDLENBQUM7SUFDTCxDQUFDLENBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUmVhZGFibGUgfSBmcm9tICdzdHJlYW0nO1xuaW1wb3J0IHtcbiAgR2V0U2NoZW1hQ3JlYXRpb25TdGF0dXNDb21tYW5kLFxuICBMaXN0RnVuY3Rpb25zQ29tbWFuZCxcbiAgU3RhcnRTY2hlbWFDcmVhdGlvbkNvbW1hbmQsXG4gIFVwZGF0ZUFwaUtleUNvbW1hbmQsXG4gIFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCxcbiAgVXBkYXRlUmVzb2x2ZXJDb21tYW5kLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtYXBwc3luYyc7XG5pbXBvcnQgeyBHZXRPYmplY3RDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXMzJztcbmltcG9ydCB7IHNka1N0cmVhbU1peGluIH0gZnJvbSAnQHNtaXRoeS91dGlsLXN0cmVhbSc7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgbW9ja0FwcFN5bmNDbGllbnQsIG1vY2tTM0NsaWVudCB9IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHsgc2lsZW50VGVzdCB9IGZyb20gJy4uLy4uL3V0aWwvc2lsZW50JztcblxubGV0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXI6IHNldHVwLkhvdHN3YXBNb2NrU2RrUHJvdmlkZXI7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwVGVzdHMoKTtcbn0pO1xuXG5jb25zdCBnZXRCb2R5U3RyZWFtID0gKGlucHV0OiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgc3RyZWFtID0gbmV3IFJlYWRhYmxlKCk7XG4gIHN0cmVhbS5fcmVhZCA9ICgpID0+IHt9O1xuICBzdHJlYW0ucHVzaChpbnB1dCk7XG4gIHN0cmVhbS5wdXNoKG51bGwpOyAvLyBjbG9zZSB0aGUgc3RyZWFtXG4gIHJldHVybiBzZGtTdHJlYW1NaXhpbihzdHJlYW0pO1xufTtcblxuZGVzY3JpYmUuZWFjaChbSG90c3dhcE1vZGUuRkFMTF9CQUNLLCBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFldKSgnJXAgbW9kZScsIChob3Rzd2FwTW9kZSkgPT4ge1xuICBzaWxlbnRUZXN0KFxuICAgIGBBIG5ldyBSZXNvbHZlciBiZWluZyBhZGRlZCB0byB0aGUgU3RhY2sgcmV0dXJucyB1bmRlZmluZWQgaW4gQ0xBU1NJQyBtb2RlIGFuZFxuICAgICAgICByZXR1cm5zIGEgbm9PcCBpbiBIT1RTV0FQX09OTFkgbW9kZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUmVzb2x2ZXJDb21tYW5kKTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVSZXNvbHZlcigpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBtYXBwaW5nIHRlbXBsYXRlIGRpZmZlcmVuY2UgaW4gYSBVbml0IFJlc29sdmVyJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jUmVzb2x2ZXI6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICBUeXBlTmFtZTogJ1F1ZXJ5JyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgS2luZDogJ1VOSVQnLFxuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY1Jlc29sdmVyJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvdHlwZXMvUXVlcnkvcmVzb2x2ZXJzL215RmllbGQnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICAgIFR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgS2luZDogJ1VOSVQnLFxuICAgICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlUmVzb2x2ZXJDb21tYW5kLCB7XG4gICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICBkYXRhU291cmNlTmFtZTogJ215LWRhdGFzb3VyY2UnLFxuICAgICAgICB0eXBlTmFtZTogJ1F1ZXJ5JyxcbiAgICAgICAgZmllbGROYW1lOiAnbXlGaWVsZCcsXG4gICAgICAgIGtpbmQ6ICdVTklUJyxcbiAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVSZXNvbHZlcigpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBtYXBwaW5nIHRlbXBsYXRlIGRpZmZlcmVuY2UgczMgbG9jYXRpb24gaW4gYSBVbml0IFJlc29sdmVyJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgY29uc3QgYm9keSA9IGdldEJvZHlTdHJlYW0oJ3RlbXBsYXRlIGRlZmluZWQgaW4gczMnKTtcbiAgICAgIG1vY2tTM0NsaWVudC5vbihHZXRPYmplY3RDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICAgIEJvZHk6IGJvZHksXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBGaWVsZE5hbWU6ICdteUZpZWxkJyxcbiAgICAgICAgICAgICAgVHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEtpbmQ6ICdVTklUJyxcbiAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb246ICdzMzovL3Rlc3QtYnVja2V0L29sZF9sb2NhdGlvbicsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY1Jlc29sdmVyJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvdHlwZXMvUXVlcnkvcmVzb2x2ZXJzL215RmllbGQnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICAgIFR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgS2luZDogJ1VOSVQnLFxuICAgICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGVTM0xvY2F0aW9uOiAnczM6Ly90ZXN0LWJ1Y2tldC9wYXRoL3RvL2tleScsXG4gICAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlUmVzb2x2ZXJDb21tYW5kLCB7XG4gICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICBkYXRhU291cmNlTmFtZTogJ215LWRhdGFzb3VyY2UnLFxuICAgICAgICB0eXBlTmFtZTogJ1F1ZXJ5JyxcbiAgICAgICAgZmllbGROYW1lOiAnbXlGaWVsZCcsXG4gICAgICAgIGtpbmQ6ICdVTklUJyxcbiAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJ3RlbXBsYXRlIGRlZmluZWQgaW4gczMnLFxuICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgIH0pO1xuICAgICAgZXhwZWN0KG1vY2tTM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChHZXRPYmplY3RDb21tYW5kLCB7XG4gICAgICAgIEJ1Y2tldDogJ3Rlc3QtYnVja2V0JyxcbiAgICAgICAgS2V5OiAncGF0aC90by9rZXknLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlUmVzb2x2ZXIoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgY29kZSBzMyBsb2NhdGlvbiBpbiBhIFBpcGVsaW5lIFJlc29sdmVyJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgY29uc3QgYm9keSA9IGdldEJvZHlTdHJlYW0oJ2NvZGUgZGVmaW5lZCBpbiBzMycpO1xuICAgICAgbW9ja1MzQ2xpZW50Lm9uKEdldE9iamVjdENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgQm9keTogYm9keSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jUmVzb2x2ZXI6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICBUeXBlTmFtZTogJ1F1ZXJ5JyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgUGlwZWxpbmVDb25maWc6IFsnZnVuY3Rpb24xJ10sXG4gICAgICAgICAgICAgIENvZGVTM0xvY2F0aW9uOiAnczM6Ly90ZXN0LWJ1Y2tldC9vbGRfbG9jYXRpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY1Jlc29sdmVyJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvdHlwZXMvUXVlcnkvcmVzb2x2ZXJzL215RmllbGQnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICAgIFR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgUGlwZWxpbmVDb25maWc6IFsnZnVuY3Rpb24xJ10sXG4gICAgICAgICAgICAgICAgQ29kZVMzTG9jYXRpb246ICdzMzovL3Rlc3QtYnVja2V0L3BhdGgvdG8va2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVSZXNvbHZlckNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIHR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICBmaWVsZE5hbWU6ICdteUZpZWxkJyxcbiAgICAgICAgcGlwZWxpbmVDb25maWc6IFsnZnVuY3Rpb24xJ10sXG4gICAgICAgIGNvZGU6ICdjb2RlIGRlZmluZWQgaW4gczMnLFxuICAgICAgfSk7XG4gICAgICBleHBlY3QobW9ja1MzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldE9iamVjdENvbW1hbmQsIHtcbiAgICAgICAgQnVja2V0OiAndGVzdC1idWNrZXQnLFxuICAgICAgICBLZXk6ICdwYXRoL3RvL2tleScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVSZXNvbHZlcigpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBjb2RlIGRpZmZlcmVuY2UgaW4gYSBQaXBlbGluZSBSZXNvbHZlcicsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBGaWVsZE5hbWU6ICdteUZpZWxkJyxcbiAgICAgICAgICAgICAgVHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIFBpcGVsaW5lQ29uZmlnOiBbJ2Z1bmN0aW9uMSddLFxuICAgICAgICAgICAgICBDb2RlOiAnb2xkIGNvZGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY1Jlc29sdmVyJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvdHlwZXMvUXVlcnkvcmVzb2x2ZXJzL215RmllbGQnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICAgIFR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgUGlwZWxpbmVDb25maWc6IFsnZnVuY3Rpb24xJ10sXG4gICAgICAgICAgICAgICAgQ29kZTogJ25ldyBjb2RlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVSZXNvbHZlckNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIHR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICBmaWVsZE5hbWU6ICdteUZpZWxkJyxcbiAgICAgICAgcGlwZWxpbmVDb25maWc6IFsnZnVuY3Rpb24xJ10sXG4gICAgICAgIGNvZGU6ICduZXcgY29kZScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVSZXNvbHZlcigpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBtYXBwaW5nIHRlbXBsYXRlIGRpZmZlcmVuY2UgaW4gYSBQaXBlbGluZSBSZXNvbHZlcicsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBGaWVsZE5hbWU6ICdteUZpZWxkJyxcbiAgICAgICAgICAgICAgVHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEtpbmQ6ICdQSVBFTElORScsXG4gICAgICAgICAgICAgIFBpcGVsaW5lQ29uZmlnOiBbJ2Z1bmN0aW9uMSddLFxuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY1Jlc29sdmVyJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcicsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvdHlwZXMvUXVlcnkvcmVzb2x2ZXJzL215RmllbGQnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICAgICAgICAgIFR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgS2luZDogJ1BJUEVMSU5FJyxcbiAgICAgICAgICAgICAgICBQaXBlbGluZUNvbmZpZzogWydmdW5jdGlvbjEnXSxcbiAgICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVJlc29sdmVyQ29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgdHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgIGZpZWxkTmFtZTogJ215RmllbGQnLFxuICAgICAgICBraW5kOiAnUElQRUxJTkUnLFxuICAgICAgICBwaXBlbGluZUNvbmZpZzogWydmdW5jdGlvbjEnXSxcbiAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgYHdoZW4gaXQgcmVjZWl2ZXMgYSBjaGFuZ2UgdGhhdCBpcyBub3QgYSBtYXBwaW5nIHRlbXBsYXRlIGRpZmZlcmVuY2UgaW4gYSBSZXNvbHZlciwgaXQgZG9lcyBub3QgY2FsbCB0aGUgdXBkYXRlUmVzb2x2ZXIoKSBBUEkgaW4gQ0xBU1NJQyBtb2RlXG4gICAgICAgIGJ1dCBkb2VzIGNhbGwgdGhlIHVwZGF0ZVJlc29sdmVyKCkgQVBJIGluIEhPVFNXQVBfT05MWSBtb2RlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jUmVzb2x2ZXI6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgRmllbGROYW1lOiAnb2xkRmllbGQnLFxuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgVHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdBcHBTeW5jUmVzb2x2ZXInLFxuICAgICAgICAgICdBV1M6OkFwcFN5bmM6OlJlc29sdmVyJyxcbiAgICAgICAgICAnYXJuOmF3czphcHBzeW5jOnVzLWVhc3QtMToxMTExMTExMTExMTE6YXBpcy9hcGlJZC90eXBlcy9RdWVyeS9yZXNvbHZlcnMvbXlGaWVsZCcsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jUmVzb2x2ZXI6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6UmVzb2x2ZXInLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgICBGaWVsZE5hbWU6ICduZXdGaWVsZCcsXG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgVHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVSZXNvbHZlckNvbW1hbmQpO1xuICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVJlc29sdmVyQ29tbWFuZCwge1xuICAgICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgIHR5cGVOYW1lOiAnUXVlcnknLFxuICAgICAgICAgIGZpZWxkTmFtZTogJ29sZEZpZWxkJyxcbiAgICAgICAgICByZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICAgIHJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdkb2VzIG5vdCBjYWxsIHRoZSB1cGRhdGVSZXNvbHZlcigpIEFQSSB3aGVuIGEgcmVzb3VyY2Ugd2l0aCB0eXBlIHRoYXQgaXMgbm90IEFXUzo6QXBwU3luYzo6UmVzb2x2ZXIgYnV0IGhhcyB0aGUgc2FtZSBwcm9wZXJ0aWVzIGlzIGNoYW5nZWQnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNSZXNvbHZlcjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6Tm90QVJlc29sdmVyJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgRmllbGROYW1lOiAnb2xkRmllbGQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY1Jlc29sdmVyOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6Ok5vdEFSZXNvbHZlcicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgICBGaWVsZE5hbWU6ICduZXdGaWVsZCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvbW1hbmQpO1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVJlc29sdmVyQ29tbWFuZCk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlRnVuY3Rpb24oKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgbWFwcGluZyB0ZW1wbGF0ZSBkaWZmZXJlbmNlIGluIGEgRnVuY3Rpb24nLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBtb2NrQXBwU3luY0NsaWVudFxuICAgICAgICAub24oTGlzdEZ1bmN0aW9uc0NvbW1hbmQpXG4gICAgICAgIC5yZXNvbHZlcyh7IGZ1bmN0aW9uczogW3sgbmFtZTogJ215LWZ1bmN0aW9uJywgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnIH1dIH0pO1xuXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEZ1bmN0aW9uVmVyc2lvbjogJzIwMTgtMDUtMjknLFxuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkZ1bmN0aW9uQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyxcbiAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlRnVuY3Rpb24oKSBBUEkgd2l0aCBmdW5jdGlvbiB2ZXJzaW9uIHdoZW4gaXQgcmVjZWl2ZXMgYm90aCBmdW5jdGlvbiB2ZXJzaW9uIGFuZCBydW50aW1lIHdpdGggYSBtYXBwaW5nIHRlbXBsYXRlIGluIGEgRnVuY3Rpb24nLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBtb2NrQXBwU3luY0NsaWVudFxuICAgICAgICAub24oTGlzdEZ1bmN0aW9uc0NvbW1hbmQpXG4gICAgICAgIC5yZXNvbHZlcyh7IGZ1bmN0aW9uczogW3sgbmFtZTogJ215LWZ1bmN0aW9uJywgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnIH1dIH0pO1xuXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEZ1bmN0aW9uVmVyc2lvbjogJzIwMTgtMDUtMjknLFxuICAgICAgICAgICAgICBSdW50aW1lOiAnQVBQU1lOQ19KUycsXG4gICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jRnVuY3Rpb246IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgICBGdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgICAgICAgICBSdW50aW1lOiAnQVBQU1lOQ19KUycsXG4gICAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyxcbiAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgdXBkYXRlRnVuY3Rpb24oKSBBUEkgd2l0aCBydW50aW1lIHdoZW4gaXQgcmVjZWl2ZXMgYm90aCBmdW5jdGlvbiB2ZXJzaW9uIGFuZCBydW50aW1lIHdpdGggY29kZSBpbiBhIEZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgbW9ja0FwcFN5bmNDbGllbnRcbiAgICAgICAgLm9uKExpc3RGdW5jdGlvbnNDb21tYW5kKVxuICAgICAgICAucmVzb2x2ZXMoeyBmdW5jdGlvbnM6IFt7IG5hbWU6ICdteS1mdW5jdGlvbicsIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyB9XSB9KTtcblxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jRnVuY3Rpb246IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkZ1bmN0aW9uQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIE5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBEYXRhU291cmNlTmFtZTogJ215LWRhdGFzb3VyY2UnLFxuICAgICAgICAgICAgICBGdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgICAgICAgUnVudGltZTogJ0FQUFNZTkNfSlMnLFxuICAgICAgICAgICAgICBDb2RlOiAnb2xkIHRlc3QgY29kZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jRnVuY3Rpb246IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgICBGdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgICAgICAgICBSdW50aW1lOiAnQVBQU1lOQ19KUycsXG4gICAgICAgICAgICAgICAgQ29kZTogJ25ldyB0ZXN0IGNvZGUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnLFxuICAgICAgICBydW50aW1lOiAnQVBQU1lOQ19KUycsXG4gICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIGNvZGU6ICduZXcgdGVzdCBjb2RlJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZUZ1bmN0aW9uKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhIG1hcHBpbmcgdGVtcGxhdGUgczMgbG9jYXRpb24gZGlmZmVyZW5jZSBpbiBhIEZ1bmN0aW9uJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgbW9ja1MzQ2xpZW50Lm9uKEdldE9iamVjdENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgQm9keTogZ2V0Qm9keVN0cmVhbSgndGVtcGxhdGUgZGVmaW5lZCBpbiBzMycpLFxuICAgICAgfSk7XG4gICAgICBtb2NrQXBwU3luY0NsaWVudFxuICAgICAgICAub24oTGlzdEZ1bmN0aW9uc0NvbW1hbmQpXG4gICAgICAgIC5yZXNvbHZlcyh7IGZ1bmN0aW9uczogW3sgbmFtZTogJ215LWZ1bmN0aW9uJywgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnIH1dIH0pO1xuXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEZ1bmN0aW9uVmVyc2lvbjogJzIwMTgtMDUtMjknLFxuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbjogJ3MzOi8vdGVzdC1idWNrZXQvb2xkX2xvY2F0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgICBEYXRhU291cmNlTmFtZTogJ215LWRhdGFzb3VyY2UnLFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uVmVyc2lvbjogJzIwMTgtMDUtMjknLFxuICAgICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgICBSZXNwb25zZU1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb246ICdzMzovL3Rlc3QtYnVja2V0L3BhdGgvdG8va2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyxcbiAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICd0ZW1wbGF0ZSBkZWZpbmVkIGluIHMzJyxcbiAgICAgIH0pO1xuICAgICAgZXhwZWN0KG1vY2tTM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChHZXRPYmplY3RDb21tYW5kLCB7XG4gICAgICAgIEJ1Y2tldDogJ3Rlc3QtYnVja2V0JyxcbiAgICAgICAgS2V5OiAncGF0aC90by9rZXknLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgIGB3aGVuIGl0IHJlY2VpdmVzIGEgY2hhbmdlIHRoYXQgaXMgbm90IGEgbWFwcGluZyB0ZW1wbGF0ZSBkaWZmZXJlbmNlIGluIGEgRnVuY3Rpb24sIGl0IGRvZXMgbm90IGNhbGwgdGhlIHVwZGF0ZUZ1bmN0aW9uKCkgQVBJIGluIENMQVNTSUMgbW9kZVxuICAgICAgICBidXQgZG9lcyBpbiBIT1RTV0FQX09OTFkgbW9kZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIG1vY2tBcHBTeW5jQ2xpZW50XG4gICAgICAgIC5vbihMaXN0RnVuY3Rpb25zQ29tbWFuZClcbiAgICAgICAgLnJlc29sdmVzKHsgZnVuY3Rpb25zOiBbeyBuYW1lOiAnbXktZnVuY3Rpb24nLCBmdW5jdGlvbklkOiAnZnVuY3Rpb25JZCcgfV0gfSk7XG5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgICBSZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbmV3LWRhdGFzb3VyY2UnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgfSBlbHNlIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZKSB7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCwge1xuICAgICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnLFxuICAgICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgICAgfSk7XG4gICAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVSZXNvbHZlckNvbW1hbmQpO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnZG9lcyBub3QgY2FsbCB0aGUgdXBkYXRlRnVuY3Rpb24oKSBBUEkgd2hlbiBhIHJlc291cmNlIHdpdGggdHlwZSB0aGF0IGlzIG5vdCBBV1M6OkFwcFN5bmM6OkZ1bmN0aW9uQ29uZmlndXJhdGlvbiBidXQgaGFzIHRoZSBzYW1lIHByb3BlcnRpZXMgaXMgY2hhbmdlZCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpOb3RBRnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpOb3RBRnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1yZXNvbHZlcicsXG4gICAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlUmVzb2x2ZXJDb21tYW5kKTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSBzdGFydFNjaGVtYUNyZWF0aW9uKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhIGRlZmluaXRpb24gZGlmZmVyZW5jZSBpbiBhIGdyYXBocWwgc2NoZW1hJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgbW9ja0FwcFN5bmNDbGllbnQub24oU3RhcnRTY2hlbWFDcmVhdGlvbkNvbW1hbmQpLnJlc29sdmVzT25jZSh7XG4gICAgICAgIHN0YXR1czogJ1NVQ0NFU1MnLFxuICAgICAgfSk7XG5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0dyYXBoUUxTY2hlbWE6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRGVmaW5pdGlvbjogJ29yaWdpbmFsIGdyYXBocWxTY2hlbWEnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnQXBwU3luY0dyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICdhcm46YXdzOmFwcHN5bmM6dXMtZWFzdC0xOjExMTExMTExMTExMTphcGlzL2FwaUlkL3NjaGVtYS9teS1zY2hlbWEnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY0dyYXBoUUxTY2hlbWE6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgICBEZWZpbml0aW9uOiAnbmV3IGdyYXBocWxTY2hlbWEnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFN0YXJ0U2NoZW1hQ3JlYXRpb25Db21tYW5kLCB7XG4gICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICBkZWZpbml0aW9uOiAnbmV3IGdyYXBocWxTY2hlbWEnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICd1cGRhdGVGdW5jdGlvbigpIEFQSSByZWNvdmVycyBmcm9tIGZhaWxlZCB1cGRhdGUgYXR0ZW1wdCB0aHJvdWdoIHJldHJ5IGxvZ2ljJyxcbiAgICBhc3luYyAoKSA9PiB7XG5cbiAgICAgIC8vIEdJVkVOXG4gICAgICBtb2NrQXBwU3luY0NsaWVudFxuICAgICAgICAub24oTGlzdEZ1bmN0aW9uc0NvbW1hbmQpXG4gICAgICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgICAgIGZ1bmN0aW9uczogW3sgbmFtZTogJ215LWZ1bmN0aW9uJywgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnIH1dLFxuICAgICAgICB9KTtcblxuICAgICAgY29uc3QgQ29uY3VycmVudE1vZEVycm9yID0gbmV3IEVycm9yKCdDb25jdXJyZW50TW9kaWZpY2F0aW9uRXhjZXB0aW9uOiBTY2hlbWEgaXMgY3VycmVudGx5IGJlaW5nIGFsdGVyZWQsIHBsZWFzZSB3YWl0IHVudGlsIHRoYXQgaXMgY29tcGxldGUuJyk7XG4gICAgICBDb25jdXJyZW50TW9kRXJyb3IubmFtZSA9ICdDb25jdXJyZW50TW9kaWZpY2F0aW9uRXhjZXB0aW9uJztcbiAgICAgIG1vY2tBcHBTeW5jQ2xpZW50XG4gICAgICAgIC5vbihVcGRhdGVGdW5jdGlvbkNvbW1hbmQpXG4gICAgICAgIC5yZWplY3RzT25jZShDb25jdXJyZW50TW9kRXJyb3IpXG4gICAgICAgIC5yZXNvbHZlc09uY2UoeyBmdW5jdGlvbkNvbmZpZ3VyYXRpb246IHsgbmFtZTogJ215LWZ1bmN0aW9uJywgZGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJywgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnIH0gfSk7XG5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgRnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgICAgICAgIFJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jRnVuY3Rpb246IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIE5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgICBGdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgICAgUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gV0hFTlxuICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhVcGRhdGVGdW5jdGlvbkNvbW1hbmQsIDIpOyAvLyAxc3QgZmFpbHVyZSB0aGVuIHN1Y2Nlc3Mgb24gcmV0cnlcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyxcbiAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgIG5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIHJlcXVlc3RNYXBwaW5nVGVtcGxhdGU6ICcjIyBvcmlnaW5hbCByZXF1ZXN0IHRlbXBsYXRlJyxcbiAgICAgICAgcmVzcG9uc2VNYXBwaW5nVGVtcGxhdGU6ICcjIyBuZXcgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgfSk7XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICd1cGRhdGVGdW5jdGlvbigpIEFQSSBmYWlscyBpZiBpdCByZWNpZXZlcyA3IGZhaWxlZCBhdHRlbXB0cyBpbiBhIHJvdyAtIHRoaXMgaXMgYSBsb25nIHJ1bm5pbmcgdGVzdCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuXG4gICAgICAvLyBHSVZFTlxuICAgICAgbW9ja0FwcFN5bmNDbGllbnRcbiAgICAgICAgLm9uKExpc3RGdW5jdGlvbnNDb21tYW5kKVxuICAgICAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgICAgICBmdW5jdGlvbnM6IFt7IG5hbWU6ICdteS1mdW5jdGlvbicsIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyB9XSxcbiAgICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IENvbmN1cnJlbnRNb2RFcnJvciA9IG5ldyBFcnJvcignQ29uY3VycmVudE1vZGlmaWNhdGlvbkV4Y2VwdGlvbjogU2NoZW1hIGlzIGN1cnJlbnRseSBiZWluZyBhbHRlcmVkLCBwbGVhc2Ugd2FpdCB1bnRpbCB0aGF0IGlzIGNvbXBsZXRlLicpO1xuICAgICAgQ29uY3VycmVudE1vZEVycm9yLm5hbWUgPSAnQ29uY3VycmVudE1vZGlmaWNhdGlvbkV4Y2VwdGlvbic7XG4gICAgICBtb2NrQXBwU3luY0NsaWVudFxuICAgICAgICAub24oVXBkYXRlRnVuY3Rpb25Db21tYW5kKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVqZWN0c09uY2UoQ29uY3VycmVudE1vZEVycm9yKVxuICAgICAgICAucmVzb2x2ZXNPbmNlKHsgZnVuY3Rpb25Db25maWd1cmF0aW9uOiB7IG5hbWU6ICdteS1mdW5jdGlvbicsIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsIGZ1bmN0aW9uSWQ6ICdmdW5jdGlvbklkJyB9IH0pO1xuXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNGdW5jdGlvbjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgIEZ1bmN0aW9uVmVyc2lvbjogJzIwMTgtMDUtMjknLFxuICAgICAgICAgICAgICBSZXF1ZXN0TWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVxdWVzdCB0ZW1wbGF0ZScsXG4gICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgb3JpZ2luYWwgcmVzcG9uc2UgdGVtcGxhdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkZ1bmN0aW9uQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgICAgICAgICAgUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICAgICAgICAgIFJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlOiAnIyMgbmV3IHJlc3BvbnNlIHRlbXBsYXRlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGF3YWl0IGV4cGVjdCgoKSA9PiBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgICAnQ29uY3VycmVudE1vZGlmaWNhdGlvbkV4Y2VwdGlvbicsXG4gICAgICApO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCwgNyk7IC8vIDFzdCBhdHRlbXB0IGFuZCB0aGVuIDYgcmV0cmllcyBiZWZvcmUgYmFpbGluZ1xuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgZnVuY3Rpb25JZDogJ2Z1bmN0aW9uSWQnLFxuICAgICAgICBmdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgbmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogJyMjIG9yaWdpbmFsIHJlcXVlc3QgdGVtcGxhdGUnLFxuICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogJyMjIG5ldyByZXNwb25zZSB0ZW1wbGF0ZScsXG4gICAgICB9KTtcbiAgICB9LFxuICAgIDMyMDAwMCxcbiAgKTtcblxuICBzaWxlbnRUZXN0KCdjYWxscyB0aGUgdXBkYXRlRnVuY3Rpb24oKSBBUEkgd2l0aCBmdW5jdGlvbklkIHdoZW4gZnVuY3Rpb24gaXMgbGlzdGVkIG9uIHNlY29uZCBwYWdlJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja0FwcFN5bmNDbGllbnRcbiAgICAgIC5vbihMaXN0RnVuY3Rpb25zQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgICBmdW5jdGlvbnM6IFt7IG5hbWU6ICdvdGhlci1mdW5jdGlvbicsIGZ1bmN0aW9uSWQ6ICdvdGhlci1mdW5jdGlvbklkJyB9XSxcbiAgICAgICAgbmV4dFRva2VuOiAnbmV4dFRva2VuJyxcbiAgICAgIH0pXG4gICAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgICAgZnVuY3Rpb25zOiBbeyBuYW1lOiAnbXktZnVuY3Rpb24nLCBmdW5jdGlvbklkOiAnZnVuY3Rpb25JZCcgfV0sXG4gICAgICB9KTtcblxuICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBBcHBTeW5jRnVuY3Rpb246IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIE5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgIERhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICAgICAgICBGdW5jdGlvblZlcnNpb246ICcyMDE4LTA1LTI5JyxcbiAgICAgICAgICAgIFJ1bnRpbWU6ICdBUFBTWU5DX0pTJyxcbiAgICAgICAgICAgIENvZGU6ICdvbGQgdGVzdCBjb2RlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0Z1bmN0aW9uOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBOYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRGF0YVNvdXJjZU5hbWU6ICdteS1kYXRhc291cmNlJyxcbiAgICAgICAgICAgICAgRnVuY3Rpb25WZXJzaW9uOiAnMjAxOC0wNS0yOScsXG4gICAgICAgICAgICAgIFJ1bnRpbWU6ICdBUFBTWU5DX0pTJyxcbiAgICAgICAgICAgICAgQ29kZTogJ25ldyB0ZXN0IGNvZGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICduZXctcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdEZ1bmN0aW9uc0NvbW1hbmQsIDIpO1xuICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWROdGhDb21tYW5kV2l0aCgxLCBMaXN0RnVuY3Rpb25zQ29tbWFuZCwge1xuICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICBuZXh0VG9rZW46ICduZXh0VG9rZW4nLFxuICAgIH0pO1xuICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWROdGhDb21tYW5kV2l0aCgyLCBMaXN0RnVuY3Rpb25zQ29tbWFuZCwge1xuICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgfSk7XG5cbiAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db21tYW5kLCB7XG4gICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgIGRhdGFTb3VyY2VOYW1lOiAnbXktZGF0YXNvdXJjZScsXG4gICAgICBmdW5jdGlvbklkOiAnZnVuY3Rpb25JZCcsXG4gICAgICBydW50aW1lOiAnQVBQU1lOQ19KUycsXG4gICAgICBuYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgY29kZTogJ25ldyB0ZXN0IGNvZGUnLFxuICAgIH0pO1xuICB9KTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdjYWxscyB0aGUgc3RhcnRTY2hlbWFDcmVhdGlvbigpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBkZWZpbml0aW9uIGRpZmZlcmVuY2UgaW4gYSBncmFwaHFsIHNjaGVtYScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIG1vY2tBcHBTeW5jQ2xpZW50Lm9uKFN0YXJ0U2NoZW1hQ3JlYXRpb25Db21tYW5kKS5yZXNvbHZlcyh7IHN0YXR1czogJ1NVQ0NFU1MnIH0pO1xuXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNHcmFwaFFMU2NoZW1hOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgIERlZmluaXRpb246ICdvcmlnaW5hbCBncmFwaHFsU2NoZW1hJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ0FwcFN5bmNHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAnYXJuOmF3czphcHBzeW5jOnVzLWVhc3QtMToxMTExMTExMTExMTE6YXBpcy9hcGlJZC9zY2hlbWEvbXktc2NoZW1hJyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNHcmFwaFFMU2NoZW1hOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgRGVmaW5pdGlvbjogJ25ldyBncmFwaHFsU2NoZW1hJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChTdGFydFNjaGVtYUNyZWF0aW9uQ29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ25ldyBncmFwaHFsU2NoZW1hJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSBzdGFydFNjaGVtYUNyZWF0aW9uKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhIGRlZmluaXRpb24gczMgbG9jYXRpb24gZGlmZmVyZW5jZSBpbiBhIGdyYXBocWwgc2NoZW1hJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgbW9ja1MzQ2xpZW50Lm9uKEdldE9iamVjdENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgQm9keTogZ2V0Qm9keVN0cmVhbSgnc2NoZW1hIGRlZmluZWQgaW4gczMnKSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBEZWZpbml0aW9uUzNMb2NhdGlvbjogJ3MzOi8vdGVzdC1idWNrZXQvb2xkX2xvY2F0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ0FwcFN5bmNHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAnYXJuOmF3czphcHBzeW5jOnVzLWVhc3QtMToxMTExMTExMTExMTE6YXBpcy9hcGlJZC9zY2hlbWEvbXktc2NoZW1hJyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNHcmFwaFFMU2NoZW1hOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgICAgICAgICAgRGVmaW5pdGlvblMzTG9jYXRpb246ICdzMzovL3Rlc3QtYnVja2V0L3BhdGgvdG8va2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChTdGFydFNjaGVtYUNyZWF0aW9uQ29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ3NjaGVtYSBkZWZpbmVkIGluIHMzJyxcbiAgICAgIH0pO1xuXG4gICAgICBleHBlY3QobW9ja1MzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldE9iamVjdENvbW1hbmQsIHtcbiAgICAgICAgQnVja2V0OiAndGVzdC1idWNrZXQnLFxuICAgICAgICBLZXk6ICdwYXRoL3RvL2tleScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2RvZXMgbm90IGNhbGwgc3RhcnRTY2hlbWFDcmVhdGlvbigpIEFQSSB3aGVuIGEgcmVzb3VyY2Ugd2l0aCB0eXBlIHRoYXQgaXMgbm90IEFXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYSBidXQgaGFzIHRoZSBzYW1lIHByb3BlcnRpZXMgaXMgY2hhbmdlJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6Tm90R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBEZWZpbml0aW9uOiAnb3JpZ2luYWwgZ3JhcGhxbFNjaGVtYScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdBcHBTeW5jR3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvc2NoZW1hL215LXNjaGVtYScsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpOb3RHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIERlZmluaXRpb246ICduZXcgZ3JhcGhxbFNjaGVtYScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdD8ubm9PcCkudG9FcXVhbCh0cnVlKTtcbiAgICAgIH1cblxuICAgICAgZXhwZWN0KG1vY2tBcHBTeW5jQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFN0YXJ0U2NoZW1hQ3JlYXRpb25Db21tYW5kKTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSBzdGFydFNjaGVtYUNyZWF0aW9uKCkgYW5kIHdhaXRzIGZvciBzY2hlbWEgY3JlYXRpb24gdG8gc3RhYmlsaXplIGJlZm9yZSBmaW5pc2hpbmcnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBtb2NrQXBwU3luY0NsaWVudC5vbihTdGFydFNjaGVtYUNyZWF0aW9uQ29tbWFuZCkucmVzb2x2ZXNPbmNlKHsgc3RhdHVzOiAnUFJPQ0VTU0lORycgfSk7XG4gICAgICBtb2NrQXBwU3luY0NsaWVudC5vbihHZXRTY2hlbWFDcmVhdGlvblN0YXR1c0NvbW1hbmQpLnJlc29sdmVzT25jZSh7IHN0YXR1czogJ1NVQ0NFU1MnIH0pO1xuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBEZWZpbml0aW9uOiAnb3JpZ2luYWwgZ3JhcGhxbFNjaGVtYScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdBcHBTeW5jR3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvc2NoZW1hL215LXNjaGVtYScsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIERlZmluaXRpb246ICduZXcgZ3JhcGhxbFNjaGVtYScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoU3RhcnRTY2hlbWFDcmVhdGlvbkNvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICAgIGRlZmluaXRpb246ICduZXcgZ3JhcGhxbFNjaGVtYScsXG4gICAgICB9KTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChHZXRTY2hlbWFDcmVhdGlvblN0YXR1c0NvbW1hbmQsIHtcbiAgICAgICAgYXBpSWQ6ICdhcGlJZCcsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoJ2NhbGxzIHRoZSBzdGFydFNjaGVtYUNyZWF0aW9uKCkgYW5kIHRocm93cyBpZiBzY2hlbWEgY3JlYXRpb24gZmFpbHMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrQXBwU3luY0NsaWVudC5vbihTdGFydFNjaGVtYUNyZWF0aW9uQ29tbWFuZCkucmVzb2x2ZXNPbmNlKHsgc3RhdHVzOiAnUFJPQ0VTU0lORycgfSk7XG4gICAgbW9ja0FwcFN5bmNDbGllbnQub24oR2V0U2NoZW1hQ3JlYXRpb25TdGF0dXNDb21tYW5kKS5yZXNvbHZlc09uY2UoeyBzdGF0dXM6ICdGQUlMRUQnLCBkZXRhaWxzOiAnaW52YWxpZCBzY2hlbWEnIH0pO1xuICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBBcHBTeW5jR3JhcGhRTFNjaGVtYToge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgRGVmaW5pdGlvbjogJ29yaWdpbmFsIGdyYXBocWxTY2hlbWEnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtcGF0aCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgJ0FwcFN5bmNHcmFwaFFMU2NoZW1hJyxcbiAgICAgICAgJ0FXUzo6QXBwU3luYzo6R3JhcGhRTFNjaGVtYScsXG4gICAgICAgICdhcm46YXdzOmFwcHN5bmM6dXMtZWFzdC0xOjExMTExMTExMTExMTphcGlzL2FwaUlkL3NjaGVtYS9teS1zY2hlbWEnLFxuICAgICAgKSxcbiAgICApO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQXBwU3luY0dyYXBoUUxTY2hlbWE6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRGVmaW5pdGlvbjogJ25ldyBncmFwaHFsU2NoZW1hJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoKCkgPT4gaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCkpLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICdpbnZhbGlkIHNjaGVtYScsXG4gICAgKTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoU3RhcnRTY2hlbWFDcmVhdGlvbkNvbW1hbmQsIHtcbiAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgZGVmaW5pdGlvbjogJ25ldyBncmFwaHFsU2NoZW1hJyxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoR2V0U2NoZW1hQ3JlYXRpb25TdGF0dXNDb21tYW5kLCB7XG4gICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FsbHMgdGhlIHVwZGF0ZUFwaUtleSgpIEFQSSB3aGVuIGl0IHJlY2VpdmVzIG9ubHkgYSBleHBpcmVzIHByb3BlcnR5IGRpZmZlcmVuY2UgaW4gYW4gQXBwU3luYyBBcGlLZXknLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEFwcFN5bmNBcGlLZXk6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkFwaUtleScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICBFeHBpcmVzOiAxMDAwLFxuICAgICAgICAgICAgICBJZDogJ2tleS1pZCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdBcHBTeW5jQXBpS2V5JyxcbiAgICAgICAgICAnQVdTOjpBcHBTeW5jOjpBcGlLZXknLFxuICAgICAgICAgICdhcm46YXdzOmFwcHN5bmM6dXMtZWFzdC0xOjExMTExMTExMTExMTphcGlzL2FwaUlkL2FwaWtleXMvYXBpLWtleS1pZCcsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBBcHBTeW5jQXBpS2V5OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkFwcFN5bmM6OkFwaUtleScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgICBFeHBpcmVzOiAxMDAxLFxuICAgICAgICAgICAgICAgIElkOiAna2V5LWlkJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnbmV3LXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrQXBwU3luY0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVBcGlLZXlDb21tYW5kLCB7XG4gICAgICAgIGFwaUlkOiAnYXBpSWQnLFxuICAgICAgICBleHBpcmVzOiAxMDAxLFxuICAgICAgICBpZDogJ2tleS1pZCcsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2NhbGxzIHRoZSB1cGRhdGVBcGlLZXkoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgZXhwaXJlcyBwcm9wZXJ0eSBkaWZmZXJlbmNlIGFuZCBubyBhcGkta2V5LWlkIGluIGFuIEFwcFN5bmMgQXBpS2V5JyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBBcHBTeW5jQXBpS2V5OiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpBcHBTeW5jOjpBcGlLZXknLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBBcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgICAgICAgRXhwaXJlczogMTAwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ0FwcFN5bmNBcGlLZXknLFxuICAgICAgICAgICdBV1M6OkFwcFN5bmM6OkFwaUtleScsXG4gICAgICAgICAgJ2Fybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvYXBpSWQvYXBpa2V5cy9hcGkta2V5LWlkJyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEFwcFN5bmNBcGlLZXk6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6QXBwU3luYzo6QXBpS2V5JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFwaUlkOiAnYXBpSWQnLFxuICAgICAgICAgICAgICAgIEV4cGlyZXM6IDEwMDEsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ25ldy1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0FwcFN5bmNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlQXBpS2V5Q29tbWFuZCwge1xuICAgICAgICBhcGlJZDogJ2FwaUlkJyxcbiAgICAgICAgZXhwaXJlczogMTAwMSxcbiAgICAgICAgaWQ6ICdhcGkta2V5LWlkJyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG59KTtcbiJdfQ==