"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const util_1 = require("../../util");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('can hotswap a lambda function in a 1-level nested stack', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('LambdaRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'LambdaRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.amazoff.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack.nested.template.json',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('LambdaRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        // WHEN
        oldRootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        const newRootStack = (0, util_1.testStack)({ stackName: 'LambdaRoot', template: oldRootStack.template });
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('hotswappable changes do not override hotswappable changes in their ancestors', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('TwoLevelLambdaRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'TwoLevelLambdaRoot',
            template: {
                Resources: {
                    ChildStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.amazoff.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-one-stack-stack.nested.template.json',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        const oldChildStack = (0, util_1.testStack)({
            stackName: 'ChildStack',
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'child-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                    GrandChildStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.amazoff.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack.nested.template.json',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldChildStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'GrandChildStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('TwoLevelLambdaRoot', setup.stackSummaryOf('ChildStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/ChildStack/abcd'));
        setup.pushNestedStackResourceSummaries('ChildStack', setup.stackSummaryOf('GrandChildStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStack/abcd'));
        // WHEN
        oldRootStack.template.Resources.ChildStack.Properties.TemplateURL = 'https://www.amazon.com';
        oldChildStack.template.Resources.GrandChildStack.Properties.TemplateURL = 'https://www.amazon.com';
        // write the new templates to disk
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        (0, util_1.testStack)({ stackName: oldChildStack.stackName, template: oldChildStack.template });
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'child-function',
            S3Bucket: 'new-bucket',
            S3Key: 'current-key',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('hotswappable changes in nested stacks do not override hotswappable changes in their parent stack', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('SiblingLambdaRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'SiblingLambdaRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack.nested.template.json',
                        },
                    },
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'root-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('SiblingLambdaRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        // WHEN
        oldRootStack.template.Resources.Func.Properties.Code.S3Bucket = 'new-bucket';
        oldRootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        // write the updated templates to disk
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'root-function',
            S3Bucket: 'new-bucket',
            S3Key: 'current-key',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)(`non-hotswappable changes in nested stacks result in a full deployment, even if their parent contains a hotswappable change in CLASSIC mode,
        but perform a hotswap deployment in HOTSWAP_ONLY`, async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('NonHotswappableRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'NonHotswappableRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack.nested.template.json',
                        },
                    },
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'root-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
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
                            FunctionName: 'my-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('NonHotswappableRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        oldRootStack.template.Resources.Func.Properties.Code.S3Bucket = 'new-bucket';
        oldRootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'root-function',
                S3Bucket: 'new-bucket',
                S3Key: 'current-key',
            });
        }
    });
    (0, silent_1.silentTest)(`deleting a nested stack results in a full deployment in CLASSIC mode, even if their parent contains a hotswappable change,
        but results in a hotswap deployment in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('NestedStackDeletionRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'NestedStackDeletionRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack.nested.template.json',
                        },
                    },
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'root-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('NestedStackDeletionRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        oldRootStack.template.Resources.Func.Properties.Code.S3Bucket = 'new-bucket';
        delete oldRootStack.template.Resources.NestedStack;
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'root-function',
                S3Bucket: 'new-bucket',
                S3Key: 'current-key',
            });
        }
    });
    (0, silent_1.silentTest)(`creating a nested stack results in a full deployment in CLASSIC mode, even if their parent contains a hotswappable change,
        but results in a hotswap deployment in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('NestedStackCreationRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'NestedStackCreationRoot',
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'root-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        oldRootStack.template.Resources.Func.Properties.Code.S3Bucket = 'new-bucket';
        oldRootStack.template.Resources.NestedStack = {
            Type: 'AWS::CloudFormation::Stack',
            Properties: {
                TemplateURL: 'https://www.amazon.com',
            },
            Metadata: {
                'aws:asset:path': 'one-lambda-stack.nested.template.json',
            },
        };
        // we need this because testStack() immediately writes the template to disk, so changing the template afterwards is not going to update the file.
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'root-function',
                S3Bucket: 'new-bucket',
                S3Key: 'current-key',
            });
        }
    });
    (0, silent_1.silentTest)(`attempting to hotswap a newly created nested stack with the same logical ID as a resource with a different type results in a full deployment in CLASSIC mode
        and a hotswap deployment in HOTSWAP_ONLY mode`, async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('NestedStackTypeChangeRoot');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'NestedStackTypeChangeRoot',
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'current-key',
                            },
                            FunctionName: 'root-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                    FutureNestedStack: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                S3Bucket: 'current-bucket',
                                S3Key: 'new-key',
                            },
                            FunctionName: 'spooky-function',
                        },
                        Metadata: {
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        oldRootStack.template.Resources.Func.Properties.Code.S3Bucket = 'new-bucket';
        oldRootStack.template.Resources.FutureNestedStack = {
            Type: 'AWS::CloudFormation::Stack',
            Properties: {
                TemplateURL: 'https://www.amazon.com',
            },
            Metadata: {
                'aws:asset:path': 'one-lambda-stack.nested.template.json',
            },
        };
        // write the updated template to disk
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        if (hotswapMode === common_1.HotswapMode.FALL_BACK) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).not.toHaveReceivedCommand(client_lambda_1.UpdateFunctionCodeCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
                FunctionName: 'root-function',
                S3Bucket: 'new-bucket',
                S3Key: 'current-key',
            });
        }
    });
    (0, silent_1.silentTest)('multi-sibling + 3-layer nested stack structure is hotswappable', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('MultiLayerRoot');
        const lambdaFunctionResource = {
            Type: 'AWS::Lambda::Function',
            Properties: {
                Code: {
                    S3Bucket: 'current-bucket',
                    S3Key: 'current-key',
                },
            },
            Metadata: {
                'aws:asset:path': 'old-lambda-path',
            },
        };
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'MultiLayerRoot',
            template: {
                Resources: {
                    ChildStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-unnamed-lambda-two-stacks-stack.nested.template.json',
                        },
                    },
                    Func: lambdaFunctionResource,
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        const oldChildStack = (0, util_1.testStack)({
            stackName: 'ChildStack',
            template: {
                Resources: {
                    GrandChildStackA: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-unnamed-lambda-stack.nested.template.json',
                        },
                    },
                    GrandChildStackB: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-unnamed-lambda-stack.nested.template.json',
                        },
                    },
                    Func: lambdaFunctionResource,
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldChildStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'GrandChildStackA',
            template: {
                Resources: {
                    Func: lambdaFunctionResource,
                },
            },
        }));
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'GrandChildStackB',
            template: {
                Resources: {
                    Func: lambdaFunctionResource,
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('MultiLayerRoot', setup.stackSummaryOf('ChildStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/ChildStack/abcd'), setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'root-function'));
        setup.pushNestedStackResourceSummaries('ChildStack', setup.stackSummaryOf('GrandChildStackA', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStackA/abcd'), setup.stackSummaryOf('GrandChildStackB', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStackB/abcd'), setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'child-function'));
        setup.pushNestedStackResourceSummaries('GrandChildStackA', setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'grandchild-A-function'));
        setup.pushNestedStackResourceSummaries('GrandChildStackB', setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'grandchild-B-function'));
        // WHEN
        oldRootStack.template.Resources.Func.Properties.Code.S3Key = 'new-key';
        oldRootStack.template.Resources.ChildStack.Properties.TemplateURL = 'https://www.amazon.com';
        oldChildStack.template.Resources.GrandChildStackA.Properties.TemplateURL = 'https://www.amazon.com';
        oldChildStack.template.Resources.GrandChildStackB.Properties.TemplateURL = 'https://www.amazon.com';
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        //testStack({ stackName: oldChildStack.stackName, template: oldChildStack.template });
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'root-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'child-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'grandchild-A-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'grandchild-B-function',
            S3Bucket: 'current-bucket',
            S3Key: 'new-key',
        });
    });
    (0, silent_1.silentTest)('can hotswap a lambda function in a 1-level nested stack with asset parameters', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('LambdaRoot');
        const rootStack = (0, util_1.testStack)({
            stackName: 'LambdaRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                            Parameters: {
                                referencetoS3BucketParam: {
                                    Ref: 'S3BucketParam',
                                },
                                referencetoS3KeyParam: {
                                    Ref: 'S3KeyParam',
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack-with-asset-parameters.nested.template.json',
                        },
                    },
                },
                Parameters: {
                    S3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                    S3KeyParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(rootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('LambdaRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        rootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, rootStack, {
            S3BucketParam: 'bucket-param-value',
            S3KeyParam: 'key-param-value',
        });
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'bucket-param-value',
            S3Key: 'key-param-value',
        });
    });
    (0, silent_1.silentTest)('can hotswap a lambda function in a 2-level nested stack with dependency on an output of 2nd level sibling stack', async () => {
        // GIVEN: RootStack has one child stack `FirstLevelNestedStack` which further has two child stacks
        // `NestedLambdaStack` and `NestedSiblingStack`. `NestedLambdaStack` takes two parameters s3Key
        // and s3Bucket and use them for a Lambda function.
        // RootStack resolves s3Bucket from a root template parameter and passed to FirstLevelRootStack which
        // resolves s3Key through output of `NestedSiblingStack`
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('RootStack');
        const oldRootStack = (0, util_1.testStack)({
            stackName: 'RootStack',
            template: {
                Resources: {
                    FirstLevelNestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                            Parameters: {
                                S3BucketParam: {
                                    Ref: 'S3BucketParam',
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'one-stack-with-two-nested-stacks-stack.template.json',
                        },
                    },
                },
                Parameters: {
                    S3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                },
            },
        });
        const oldFirstLevelNestedStack = (0, util_1.testStack)({
            stackName: 'FirstLevelNestedStack',
            template: {
                Resources: {
                    NestedLambdaStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                            Parameters: {
                                referenceToS3BucketParam: {
                                    Ref: 'S3BucketParam',
                                },
                                referenceToS3StackKeyOutput: {
                                    'Fn::GetAtt': ['NestedSiblingStack', 'Outputs.NestedOutput'],
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack-with-dependency-on-sibling-stack-output.nested.template.json',
                        },
                    },
                    NestedSiblingStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-output-stack.nested.template.json',
                        },
                    },
                },
                Parameters: {
                    S3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                },
            },
        });
        const nestedLambdaStack = (0, util_1.testStack)({
            stackName: 'NestedLambdaStack',
            template: {
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
                    },
                },
                Metadata: {
                    'aws:asset:path': 'old-lambda-path',
                },
            },
        });
        const nestedSiblingStack = (0, util_1.testStack)({
            stackName: 'NestedSiblingStack',
            template: {
                Outputs: {
                    NestedOutput: { Value: 's3-key-value-from-output' },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(oldRootStack);
        setup.addTemplateToCloudFormationLookupMock(oldFirstLevelNestedStack);
        setup.addTemplateToCloudFormationLookupMock(nestedLambdaStack);
        setup.addTemplateToCloudFormationLookupMock(nestedSiblingStack);
        setup.pushNestedStackResourceSummaries(oldRootStack.stackName, setup.stackSummaryOf(oldFirstLevelNestedStack.stackName, 'AWS::CloudFormation::Stack', `arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/${oldFirstLevelNestedStack.stackName}/abcd`));
        setup.pushNestedStackResourceSummaries(oldFirstLevelNestedStack.stackName, setup.stackSummaryOf(nestedLambdaStack.stackName, 'AWS::CloudFormation::Stack', `arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/${nestedLambdaStack.stackName}/abcd`), setup.stackSummaryOf(nestedSiblingStack.stackName, 'AWS::CloudFormation::Stack', `arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/${nestedSiblingStack.stackName}/abcd`));
        setup.pushNestedStackResourceSummaries(nestedLambdaStack.stackName, setup.stackSummaryOf('Func', 'AWS::Lambda::Function', 'nested-lambda-function'));
        setup.pushNestedStackResourceSummaries(nestedSiblingStack.stackName);
        oldRootStack.template.Resources.FirstLevelNestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        oldFirstLevelNestedStack.template.Resources.NestedLambdaStack.Properties.TemplateURL = 'https://www.amazon.com';
        oldFirstLevelNestedStack.template.Resources.NestedSiblingStack.Properties.TemplateURL = 'https://www.amazon.com';
        const newRootStack = (0, util_1.testStack)({ stackName: oldRootStack.stackName, template: oldRootStack.template });
        (0, util_1.testStack)({ stackName: oldFirstLevelNestedStack.stackName, template: oldFirstLevelNestedStack.template });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, newRootStack, {
            S3BucketParam: 'new-bucket',
        });
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'new-bucket',
            S3Key: 's3-key-value-from-output',
        });
    });
    (0, silent_1.silentTest)('can hotswap a lambda function in a 1-level nested stack and read default parameters value if not provided', async () => {
        // GIVEN: RootStack has one child stack `NestedStack`. `NestedStack` takes two
        // parameters s3Key and s3Bucket and use them for a Lambda function.
        // RootStack resolves both parameters from root template parameters. Current/old change
        // has hardcoded resolved values and the new change doesn't provide parameters through
        // root stack forcing the evaluation of default parameter values.
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('LambdaRoot');
        const rootStack = (0, util_1.testStack)({
            stackName: 'LambdaRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                            Parameters: {
                                referencetoS3BucketParam: {
                                    Ref: 'S3BucketParam',
                                },
                                referencetoS3KeyParam: {
                                    Ref: 'S3KeyParam',
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack-with-asset-parameters.nested.template.json',
                        },
                    },
                },
                Parameters: {
                    S3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                        Default: 'default-s3-bucket',
                    },
                    S3KeyParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                        Default: 'default-s3-key',
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(rootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('LambdaRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        rootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, rootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'default-s3-bucket',
            S3Key: 'default-s3-key',
        });
    });
    (0, silent_1.silentTest)('can hotswap a lambda function in a 2-level nested stack with asset parameters', async () => {
        // GIVEN
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('LambdaRoot');
        const rootStack = (0, util_1.testStack)({
            stackName: 'LambdaRoot',
            template: {
                Resources: {
                    ChildStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                            Parameters: {
                                referencetoGrandChildS3BucketParam: {
                                    Ref: 'GrandChildS3BucketParam',
                                },
                                referencetoGrandChildS3KeyParam: {
                                    Ref: 'GrandChildS3KeyParam',
                                },
                                referencetoChildS3BucketParam: {
                                    Ref: 'ChildS3BucketParam',
                                },
                                referencetoChildS3KeyParam: {
                                    Ref: 'ChildS3KeyParam',
                                },
                            },
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-one-stack-stack-with-asset-parameters.nested.template.json',
                        },
                    },
                },
                Parameters: {
                    GrandChildS3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                    GrandChildS3KeyParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                    ChildS3BucketParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                    ChildS3KeyParam: {
                        Type: 'String',
                        Description: 'S3 bucket for asset',
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(rootStack);
        const childStack = (0, util_1.testStack)({
            stackName: 'ChildStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                    GrandChildStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.magic-url.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-stack-with-asset-parameters.nested.template.json',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(childStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'GrandChildStack',
            template: {
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
                            'aws:asset:path': 'old-lambda-path',
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('LambdaRoot', setup.stackSummaryOf('ChildStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/ChildStack/abcd'));
        setup.pushNestedStackResourceSummaries('ChildStack', setup.stackSummaryOf('GrandChildStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/GrandChildStack/abcd'));
        rootStack.template.Resources.ChildStack.Properties.TemplateURL = 'https://www.amazon.com';
        childStack.template.Resources.GrandChildStack.Properties.TemplateURL = 'https://www.amazon.com';
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, rootStack, {
            GrandChildS3BucketParam: 'child-bucket-param-value',
            GrandChildS3KeyParam: 'child-key-param-value',
            ChildS3BucketParam: 'bucket-param-value',
            ChildS3KeyParam: 'key-param-value',
        });
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'bucket-param-value',
            S3Key: 'key-param-value',
        });
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateFunctionCodeCommand, {
            FunctionName: 'my-function',
            S3Bucket: 'child-bucket-param-value',
            S3Key: 'child-key-param-value',
        });
    });
    (0, silent_1.silentTest)('looking up objects in nested stacks works', async () => {
        hotswapMockSdkProvider = setup.setupHotswapNestedStackTests('LambdaRoot');
        const rootStack = (0, util_1.testStack)({
            stackName: 'LambdaRoot',
            template: {
                Resources: {
                    NestedStack: {
                        Type: 'AWS::CloudFormation::Stack',
                        Properties: {
                            TemplateURL: 'https://www.amazoff.com',
                        },
                        Metadata: {
                            'aws:asset:path': 'one-lambda-version-stack.nested.template.json',
                        },
                    },
                },
            },
        });
        setup.addTemplateToCloudFormationLookupMock(rootStack);
        setup.addTemplateToCloudFormationLookupMock((0, util_1.testStack)({
            stackName: 'NestedStack',
            template: {
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
                    },
                    Version: {
                        Type: 'AWS::Lambda::Version',
                        Properties: {
                            FunctionName: { Ref: 'Func' },
                        },
                    },
                },
            },
        }));
        setup.pushNestedStackResourceSummaries('LambdaRoot', setup.stackSummaryOf('NestedStack', 'AWS::CloudFormation::Stack', 'arn:aws:cloudformation:bermuda-triangle-1337:123456789012:stack/NestedStack/abcd'));
        // WHEN
        rootStack.template.Resources.NestedStack.Properties.TemplateURL = 'https://www.amazon.com';
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, rootStack);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.PublishVersionCommand, {
            FunctionName: 'my-function',
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmVzdGVkLXN0YWNrcy1ob3Rzd2FwLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJuZXN0ZWQtc3RhY2tzLWhvdHN3YXAudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBEQUEwRjtBQUMxRiw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELHFDQUF1QztBQUN2QyxrREFBdUQ7QUFDdkQsOENBQStDO0FBRS9DLElBQUksc0JBQW9ELENBQUM7QUFFekQsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLG9CQUFXLENBQUMsU0FBUyxFQUFFLG9CQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtJQUMxRixJQUFBLG1CQUFVLEVBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDL0UsUUFBUTtRQUNSLHNCQUFzQixHQUFHLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUUxRSxNQUFNLFlBQVksR0FBRyxJQUFBLGdCQUFTLEVBQUM7WUFDN0IsU0FBUyxFQUFFLFlBQVk7WUFDdkIsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxXQUFXLEVBQUU7d0JBQ1gsSUFBSSxFQUFFLDRCQUE0Qjt3QkFDbEMsVUFBVSxFQUFFOzRCQUNWLFdBQVcsRUFBRSx5QkFBeUI7eUJBQ3ZDO3dCQUNELFFBQVEsRUFBRTs0QkFDUixnQkFBZ0IsRUFBRSx1Q0FBdUM7eUJBQzFEO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMscUNBQXFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDMUQsS0FBSyxDQUFDLHFDQUFxQyxDQUN6QyxJQUFBLGdCQUFTLEVBQUM7WUFDUixTQUFTLEVBQUUsYUFBYTtZQUN4QixRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFO29CQUNULElBQUksRUFBRTt3QkFDSixJQUFJLEVBQUUsdUJBQXVCO3dC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SCxDQUFDO1FBRUYsS0FBSyxDQUFDLGdDQUFnQyxDQUNwQyxZQUFZLEVBQ1osS0FBSyxDQUFDLGNBQWMsQ0FDbEIsYUFBYSxFQUNiLDRCQUE0QixFQUM1QixrRkFBa0YsQ0FDbkYsQ0FDRixDQUFDO1FBRUYsT0FBTztRQUNQLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsV0FBVyxHQUFHLHdCQUF3QixDQUFDO1FBQzNGLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFcEcsT0FBTztRQUNQLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM5QyxNQUFNLENBQUMsMkJBQWdCLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxxQ0FBcUIsRUFBRTtZQUN4RSxZQUFZLEVBQUUsYUFBYTtTQUM1QixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHVibGlzaFZlcnNpb25Db21tYW5kLCBVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgdGVzdFN0YWNrIH0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgeyBtb2NrTGFtYmRhQ2xpZW50IH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuZGVzY3JpYmUuZWFjaChbSG90c3dhcE1vZGUuRkFMTF9CQUNLLCBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFldKSgnJXAgbW9kZScsIChob3Rzd2FwTW9kZSkgPT4ge1xuICBzaWxlbnRUZXN0KCdjYW4gaG90c3dhcCBhIGxhbWJkYSBmdW5jdGlvbiBpbiBhIDEtbGV2ZWwgbmVzdGVkIHN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcE5lc3RlZFN0YWNrVGVzdHMoJ0xhbWJkYVJvb3QnKTtcblxuICAgIGNvbnN0IG9sZFJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdMYW1iZGFSb290JyxcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3LmFtYXpvZmYuY29tJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLWxhbWJkYS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhvbGRSb290U3RhY2spO1xuICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICdMYW1iZGFSb290JyxcbiAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAnTmVzdGVkU3RhY2snLFxuICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL05lc3RlZFN0YWNrL2FiY2QnLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgLy8gV0hFTlxuICAgIG9sZFJvb3RTdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuTmVzdGVkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcbiAgICBjb25zdCBuZXdSb290U3RhY2sgPSB0ZXN0U3RhY2soeyBzdGFja05hbWU6ICdMYW1iZGFSb290JywgdGVtcGxhdGU6IG9sZFJvb3RTdGFjay50ZW1wbGF0ZSB9KTtcbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIG5ld1Jvb3RTdGFjayk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnaG90c3dhcHBhYmxlIGNoYW5nZXMgZG8gbm90IG92ZXJyaWRlIGhvdHN3YXBwYWJsZSBjaGFuZ2VzIGluIHRoZWlyIGFuY2VzdG9ycycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBOZXN0ZWRTdGFja1Rlc3RzKCdUd29MZXZlbExhbWJkYVJvb3QnKTtcblxuICAgIGNvbnN0IG9sZFJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdUd29MZXZlbExhbWJkYVJvb3QnLFxuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgQ2hpbGRTdGFjazoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5hbWF6b2ZmLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtb25lLXN0YWNrLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKG9sZFJvb3RTdGFjayk7XG5cbiAgICBjb25zdCBvbGRDaGlsZFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ0NoaWxkU3RhY2snLFxuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnY2hpbGQtZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtbGFtYmRhLXBhdGgnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEdyYW5kQ2hpbGRTdGFjazoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5hbWF6b2ZmLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKG9sZENoaWxkU3RhY2spO1xuXG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhcbiAgICAgIHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ0dyYW5kQ2hpbGRTdGFjaycsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICdUd29MZXZlbExhbWJkYVJvb3QnLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICdDaGlsZFN0YWNrJyxcbiAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgJ2Fybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay9DaGlsZFN0YWNrL2FiY2QnLFxuICAgICAgKSxcbiAgICApO1xuICAgIHNldHVwLnB1c2hOZXN0ZWRTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgJ0NoaWxkU3RhY2snLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICdHcmFuZENoaWxkU3RhY2snLFxuICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL0dyYW5kQ2hpbGRTdGFjay9hYmNkJyxcbiAgICAgICksXG4gICAgKTtcblxuICAgIC8vIFdIRU5cbiAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkNoaWxkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcbiAgICBvbGRDaGlsZFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5HcmFuZENoaWxkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcblxuICAgIC8vIHdyaXRlIHRoZSBuZXcgdGVtcGxhdGVzIHRvIGRpc2tcbiAgICBjb25zdCBuZXdSb290U3RhY2sgPSB0ZXN0U3RhY2soeyBzdGFja05hbWU6IG9sZFJvb3RTdGFjay5zdGFja05hbWUsIHRlbXBsYXRlOiBvbGRSb290U3RhY2sudGVtcGxhdGUgfSk7XG4gICAgdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRDaGlsZFN0YWNrLnN0YWNrTmFtZSwgdGVtcGxhdGU6IG9sZENoaWxkU3RhY2sudGVtcGxhdGUgfSk7XG5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIG5ld1Jvb3RTdGFjayk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ2NoaWxkLWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2hvdHN3YXBwYWJsZSBjaGFuZ2VzIGluIG5lc3RlZCBzdGFja3MgZG8gbm90IG92ZXJyaWRlIGhvdHN3YXBwYWJsZSBjaGFuZ2VzIGluIHRoZWlyIHBhcmVudCBzdGFjaycsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBOZXN0ZWRTdGFja1Rlc3RzKCdTaWJsaW5nTGFtYmRhUm9vdCcpO1xuXG4gICAgICBjb25zdCBvbGRSb290U3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdTaWJsaW5nTGFtYmRhUm9vdCcsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLWxhbWJkYS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdyb290LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKG9sZFJvb3RTdGFjayk7XG4gICAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKFxuICAgICAgICB0ZXN0U3RhY2soe1xuICAgICAgICAgIHN0YWNrTmFtZTogJ05lc3RlZFN0YWNrJyxcbiAgICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1sYW1iZGEtcGF0aCcsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICApO1xuXG4gICAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgJ1NpYmxpbmdMYW1iZGFSb290JyxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ05lc3RlZFN0YWNrJyxcbiAgICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svTmVzdGVkU3RhY2svYWJjZCcsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkZ1bmMuUHJvcGVydGllcy5Db2RlLlMzQnVja2V0ID0gJ25ldy1idWNrZXQnO1xuICAgICAgb2xkUm9vdFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5OZXN0ZWRTdGFjay5Qcm9wZXJ0aWVzLlRlbXBsYXRlVVJMID0gJ2h0dHBzOi8vd3d3LmFtYXpvbi5jb20nO1xuICAgICAgLy8gd3JpdGUgdGhlIHVwZGF0ZWQgdGVtcGxhdGVzIHRvIGRpc2tcbiAgICAgIGNvbnN0IG5ld1Jvb3RTdGFjayA9IHRlc3RTdGFjayh7IHN0YWNrTmFtZTogb2xkUm9vdFN0YWNrLnN0YWNrTmFtZSwgdGVtcGxhdGU6IG9sZFJvb3RTdGFjay50ZW1wbGF0ZSB9KTtcbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdyb290LWZ1bmN0aW9uJyxcbiAgICAgICAgUzNCdWNrZXQ6ICduZXctYnVja2V0JyxcbiAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICB9KTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgbm9uLWhvdHN3YXBwYWJsZSBjaGFuZ2VzIGluIG5lc3RlZCBzdGFja3MgcmVzdWx0IGluIGEgZnVsbCBkZXBsb3ltZW50LCBldmVuIGlmIHRoZWlyIHBhcmVudCBjb250YWlucyBhIGhvdHN3YXBwYWJsZSBjaGFuZ2UgaW4gQ0xBU1NJQyBtb2RlLFxuICAgICAgICBidXQgcGVyZm9ybSBhIGhvdHN3YXAgZGVwbG95bWVudCBpbiBIT1RTV0FQX09OTFlgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwTmVzdGVkU3RhY2tUZXN0cygnTm9uSG90c3dhcHBhYmxlUm9vdCcpO1xuXG4gICAgICBjb25zdCBvbGRSb290U3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdOb25Ib3Rzd2FwcGFibGVSb290JyxcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIE5lc3RlZFN0YWNrOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtbGFtYmRhLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3Jvb3QtZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtbGFtYmRhLXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2sob2xkUm9vdFN0YWNrKTtcbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICAgIHRlc3RTdGFjayh7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnTmVzdGVkU3RhY2snLFxuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIFBhY2thZ2VUeXBlOiAnSW1hZ2UnLFxuICAgICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtbGFtYmRhLXBhdGgnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgc2V0dXAucHVzaE5lc3RlZFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgICdOb25Ib3Rzd2FwcGFibGVSb290JyxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ05lc3RlZFN0YWNrJyxcbiAgICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svTmVzdGVkU3RhY2svYWJjZCcsXG4gICAgICAgICksXG4gICAgICApO1xuXG4gICAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkZ1bmMuUHJvcGVydGllcy5Db2RlLlMzQnVja2V0ID0gJ25ldy1idWNrZXQnO1xuICAgICAgb2xkUm9vdFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5OZXN0ZWRTdGFjay5Qcm9wZXJ0aWVzLlRlbXBsYXRlVVJMID0gJ2h0dHBzOi8vd3d3LmFtYXpvbi5jb20nO1xuICAgICAgY29uc3QgbmV3Um9vdFN0YWNrID0gdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRSb290U3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkUm9vdFN0YWNrLnRlbXBsYXRlIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3Jvb3QtZnVuY3Rpb24nLFxuICAgICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgZGVsZXRpbmcgYSBuZXN0ZWQgc3RhY2sgcmVzdWx0cyBpbiBhIGZ1bGwgZGVwbG95bWVudCBpbiBDTEFTU0lDIG1vZGUsIGV2ZW4gaWYgdGhlaXIgcGFyZW50IGNvbnRhaW5zIGEgaG90c3dhcHBhYmxlIGNoYW5nZSxcbiAgICAgICAgYnV0IHJlc3VsdHMgaW4gYSBob3Rzd2FwIGRlcGxveW1lbnQgaW4gSE9UU1dBUF9PTkxZIG1vZGVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwTmVzdGVkU3RhY2tUZXN0cygnTmVzdGVkU3RhY2tEZWxldGlvblJvb3QnKTtcblxuICAgICAgY29uc3Qgb2xkUm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgICAgc3RhY2tOYW1lOiAnTmVzdGVkU3RhY2tEZWxldGlvblJvb3QnLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAncm9vdC1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1sYW1iZGEtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhvbGRSb290U3RhY2spO1xuICAgICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhcbiAgICAgICAgdGVzdFN0YWNrKHtcbiAgICAgICAgICBzdGFja05hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtbGFtYmRhLXBhdGgnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgKTtcblxuICAgICAgc2V0dXAucHVzaE5lc3RlZFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgICdOZXN0ZWRTdGFja0RlbGV0aW9uUm9vdCcsXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdOZXN0ZWRTdGFjaycsXG4gICAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL05lc3RlZFN0YWNrL2FiY2QnLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgb2xkUm9vdFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5GdW5jLlByb3BlcnRpZXMuQ29kZS5TM0J1Y2tldCA9ICduZXctYnVja2V0JztcbiAgICAgIGRlbGV0ZSBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLk5lc3RlZFN0YWNrO1xuICAgICAgY29uc3QgbmV3Um9vdFN0YWNrID0gdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRSb290U3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkUm9vdFN0YWNrLnRlbXBsYXRlIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3Jvb3QtZnVuY3Rpb24nLFxuICAgICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgY3JlYXRpbmcgYSBuZXN0ZWQgc3RhY2sgcmVzdWx0cyBpbiBhIGZ1bGwgZGVwbG95bWVudCBpbiBDTEFTU0lDIG1vZGUsIGV2ZW4gaWYgdGhlaXIgcGFyZW50IGNvbnRhaW5zIGEgaG90c3dhcHBhYmxlIGNoYW5nZSxcbiAgICAgICAgYnV0IHJlc3VsdHMgaW4gYSBob3Rzd2FwIGRlcGxveW1lbnQgaW4gSE9UU1dBUF9PTkxZIG1vZGVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwTmVzdGVkU3RhY2tUZXN0cygnTmVzdGVkU3RhY2tDcmVhdGlvblJvb3QnKTtcblxuICAgICAgY29uc3Qgb2xkUm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgICAgc3RhY2tOYW1lOiAnTmVzdGVkU3RhY2tDcmVhdGlvblJvb3QnLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdyb290LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKG9sZFJvb3RTdGFjayk7XG5cbiAgICAgIG9sZFJvb3RTdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuRnVuYy5Qcm9wZXJ0aWVzLkNvZGUuUzNCdWNrZXQgPSAnbmV3LWJ1Y2tldCc7XG4gICAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLk5lc3RlZFN0YWNrID0ge1xuICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5hbWF6b24uY29tJyxcbiAgICAgICAgfSxcbiAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLWxhbWJkYS1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgLy8gd2UgbmVlZCB0aGlzIGJlY2F1c2UgdGVzdFN0YWNrKCkgaW1tZWRpYXRlbHkgd3JpdGVzIHRoZSB0ZW1wbGF0ZSB0byBkaXNrLCBzbyBjaGFuZ2luZyB0aGUgdGVtcGxhdGUgYWZ0ZXJ3YXJkcyBpcyBub3QgZ29pbmcgdG8gdXBkYXRlIHRoZSBmaWxlLlxuICAgICAgY29uc3QgbmV3Um9vdFN0YWNrID0gdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRSb290U3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkUm9vdFN0YWNrLnRlbXBsYXRlIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3Jvb3QtZnVuY3Rpb24nLFxuICAgICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICBgYXR0ZW1wdGluZyB0byBob3Rzd2FwIGEgbmV3bHkgY3JlYXRlZCBuZXN0ZWQgc3RhY2sgd2l0aCB0aGUgc2FtZSBsb2dpY2FsIElEIGFzIGEgcmVzb3VyY2Ugd2l0aCBhIGRpZmZlcmVudCB0eXBlIHJlc3VsdHMgaW4gYSBmdWxsIGRlcGxveW1lbnQgaW4gQ0xBU1NJQyBtb2RlXG4gICAgICAgIGFuZCBhIGhvdHN3YXAgZGVwbG95bWVudCBpbiBIT1RTV0FQX09OTFkgbW9kZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBOZXN0ZWRTdGFja1Rlc3RzKCdOZXN0ZWRTdGFja1R5cGVDaGFuZ2VSb290Jyk7XG5cbiAgICAgIGNvbnN0IG9sZFJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ05lc3RlZFN0YWNrVHlwZUNoYW5nZVJvb3QnLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdyb290LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdXR1cmVOZXN0ZWRTdGFjazoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ3Nwb29reS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1sYW1iZGEtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhvbGRSb290U3RhY2spO1xuXG4gICAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkZ1bmMuUHJvcGVydGllcy5Db2RlLlMzQnVja2V0ID0gJ25ldy1idWNrZXQnO1xuICAgICAgb2xkUm9vdFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5GdXR1cmVOZXN0ZWRTdGFjayA9IHtcbiAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cuYW1hem9uLmNvbScsXG4gICAgICAgIH0sXG4gICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICAgIC8vIHdyaXRlIHRoZSB1cGRhdGVkIHRlbXBsYXRlIHRvIGRpc2tcbiAgICAgIGNvbnN0IG5ld1Jvb3RTdGFjayA9IHRlc3RTdGFjayh7IHN0YWNrTmFtZTogb2xkUm9vdFN0YWNrLnN0YWNrTmFtZSwgdGVtcGxhdGU6IG9sZFJvb3RTdGFjay50ZW1wbGF0ZSB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIG5ld1Jvb3RTdGFjayk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIG5ld1Jvb3RTdGFjayk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdyb290LWZ1bmN0aW9uJyxcbiAgICAgICAgICBTM0J1Y2tldDogJ25ldy1idWNrZXQnLFxuICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoJ211bHRpLXNpYmxpbmcgKyAzLWxheWVyIG5lc3RlZCBzdGFjayBzdHJ1Y3R1cmUgaXMgaG90c3dhcHBhYmxlJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcE5lc3RlZFN0YWNrVGVzdHMoJ011bHRpTGF5ZXJSb290Jyk7XG5cbiAgICBjb25zdCBsYW1iZGFGdW5jdGlvblJlc291cmNlID0ge1xuICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgIENvZGU6IHtcbiAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBNZXRhZGF0YToge1xuICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IG9sZFJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdNdWx0aUxheWVyUm9vdCcsXG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBDaGlsZFN0YWNrOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtdW5uYW1lZC1sYW1iZGEtdHdvLXN0YWNrcy1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgRnVuYzogbGFtYmRhRnVuY3Rpb25SZXNvdXJjZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKG9sZFJvb3RTdGFjayk7XG5cbiAgICBjb25zdCBvbGRDaGlsZFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ0NoaWxkU3RhY2snLFxuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgR3JhbmRDaGlsZFN0YWNrQToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXVubmFtZWQtbGFtYmRhLXN0YWNrLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBHcmFuZENoaWxkU3RhY2tCOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUZW1wbGF0ZVVSTDogJ2h0dHBzOi8vd3d3Lm1hZ2ljLXVybC5jb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtdW5uYW1lZC1sYW1iZGEtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEZ1bmM6IGxhbWJkYUZ1bmN0aW9uUmVzb3VyY2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2sob2xkQ2hpbGRTdGFjayk7XG5cbiAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKFxuICAgICAgdGVzdFN0YWNrKHtcbiAgICAgICAgc3RhY2tOYW1lOiAnR3JhbmRDaGlsZFN0YWNrQScsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiBsYW1iZGFGdW5jdGlvblJlc291cmNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdHcmFuZENoaWxkU3RhY2tCJyxcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEZ1bmM6IGxhbWJkYUZ1bmN0aW9uUmVzb3VyY2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICdNdWx0aUxheWVyUm9vdCcsXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgJ0NoaWxkU3RhY2snLFxuICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL0NoaWxkU3RhY2svYWJjZCcsXG4gICAgICApLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ3Jvb3QtZnVuY3Rpb24nKSxcbiAgICApO1xuICAgIHNldHVwLnB1c2hOZXN0ZWRTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgJ0NoaWxkU3RhY2snLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICdHcmFuZENoaWxkU3RhY2tBJyxcbiAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgJ2Fybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay9HcmFuZENoaWxkU3RhY2tBL2FiY2QnLFxuICAgICAgKSxcbiAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAnR3JhbmRDaGlsZFN0YWNrQicsXG4gICAgICAgICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svR3JhbmRDaGlsZFN0YWNrQi9hYmNkJyxcbiAgICAgICksXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnY2hpbGQtZnVuY3Rpb24nKSxcbiAgICApO1xuICAgIHNldHVwLnB1c2hOZXN0ZWRTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgJ0dyYW5kQ2hpbGRTdGFja0EnLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ2dyYW5kY2hpbGQtQS1mdW5jdGlvbicpLFxuICAgICk7XG4gICAgc2V0dXAucHVzaE5lc3RlZFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAnR3JhbmRDaGlsZFN0YWNrQicsXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnZ3JhbmRjaGlsZC1CLWZ1bmN0aW9uJyksXG4gICAgKTtcblxuICAgIC8vIFdIRU5cbiAgICBvbGRSb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkZ1bmMuUHJvcGVydGllcy5Db2RlLlMzS2V5ID0gJ25ldy1rZXknO1xuICAgIG9sZFJvb3RTdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuQ2hpbGRTdGFjay5Qcm9wZXJ0aWVzLlRlbXBsYXRlVVJMID0gJ2h0dHBzOi8vd3d3LmFtYXpvbi5jb20nO1xuICAgIG9sZENoaWxkU3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkdyYW5kQ2hpbGRTdGFja0EuUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcbiAgICBvbGRDaGlsZFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5HcmFuZENoaWxkU3RhY2tCLlByb3BlcnRpZXMuVGVtcGxhdGVVUkwgPSAnaHR0cHM6Ly93d3cuYW1hem9uLmNvbSc7XG5cbiAgICBjb25zdCBuZXdSb290U3RhY2sgPSB0ZXN0U3RhY2soeyBzdGFja05hbWU6IG9sZFJvb3RTdGFjay5zdGFja05hbWUsIHRlbXBsYXRlOiBvbGRSb290U3RhY2sudGVtcGxhdGUgfSk7XG4gICAgLy90ZXN0U3RhY2soeyBzdGFja05hbWU6IG9sZENoaWxkU3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkQ2hpbGRTdGFjay50ZW1wbGF0ZSB9KTtcblxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgbmV3Um9vdFN0YWNrKTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAncm9vdC1mdW5jdGlvbicsXG4gICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnY2hpbGQtZnVuY3Rpb24nLFxuICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgIH0pO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ2dyYW5kY2hpbGQtQS1mdW5jdGlvbicsXG4gICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ3JhbmRjaGlsZC1CLWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnY2FuIGhvdHN3YXAgYSBsYW1iZGEgZnVuY3Rpb24gaW4gYSAxLWxldmVsIG5lc3RlZCBzdGFjayB3aXRoIGFzc2V0IHBhcmFtZXRlcnMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwTmVzdGVkU3RhY2tUZXN0cygnTGFtYmRhUm9vdCcpO1xuXG4gICAgY29uc3Qgcm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgIHN0YWNrTmFtZTogJ0xhbWJkYVJvb3QnLFxuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2V0b1MzQnVja2V0UGFyYW06IHtcbiAgICAgICAgICAgICAgICAgIFJlZjogJ1MzQnVja2V0UGFyYW0nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVmZXJlbmNldG9TM0tleVBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICBSZWY6ICdTM0tleVBhcmFtJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtbGFtYmRhLXN0YWNrLXdpdGgtYXNzZXQtcGFyYW1ldGVycy5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBTM0J1Y2tldFBhcmFtOiB7XG4gICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciBhc3NldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBTM0tleVBhcmFtOiB7XG4gICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciBhc3NldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBzZXR1cC5hZGRUZW1wbGF0ZVRvQ2xvdWRGb3JtYXRpb25Mb29rdXBNb2NrKHJvb3RTdGFjayk7XG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhcbiAgICAgIHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ05lc3RlZFN0YWNrJyxcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbGQtbGFtYmRhLXBhdGgnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIHNldHVwLnB1c2hOZXN0ZWRTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgJ0xhbWJkYVJvb3QnLFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICdOZXN0ZWRTdGFjaycsXG4gICAgICAgICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICdhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svTmVzdGVkU3RhY2svYWJjZCcsXG4gICAgICApLFxuICAgICk7XG5cbiAgICByb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLk5lc3RlZFN0YWNrLlByb3BlcnRpZXMuVGVtcGxhdGVVUkwgPSAnaHR0cHM6Ly93d3cuYW1hem9uLmNvbSc7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCByb290U3RhY2ssIHtcbiAgICAgIFMzQnVja2V0UGFyYW06ICdidWNrZXQtcGFyYW0tdmFsdWUnLFxuICAgICAgUzNLZXlQYXJhbTogJ2tleS1wYXJhbS12YWx1ZScsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnYnVja2V0LXBhcmFtLXZhbHVlJyxcbiAgICAgIFMzS2V5OiAna2V5LXBhcmFtLXZhbHVlJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FuIGhvdHN3YXAgYSBsYW1iZGEgZnVuY3Rpb24gaW4gYSAyLWxldmVsIG5lc3RlZCBzdGFjayB3aXRoIGRlcGVuZGVuY3kgb24gYW4gb3V0cHV0IG9mIDJuZCBsZXZlbCBzaWJsaW5nIHN0YWNrJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTjogUm9vdFN0YWNrIGhhcyBvbmUgY2hpbGQgc3RhY2sgYEZpcnN0TGV2ZWxOZXN0ZWRTdGFja2Agd2hpY2ggZnVydGhlciBoYXMgdHdvIGNoaWxkIHN0YWNrc1xuICAgICAgLy8gYE5lc3RlZExhbWJkYVN0YWNrYCBhbmQgYE5lc3RlZFNpYmxpbmdTdGFja2AuIGBOZXN0ZWRMYW1iZGFTdGFja2AgdGFrZXMgdHdvIHBhcmFtZXRlcnMgczNLZXlcbiAgICAgIC8vIGFuZCBzM0J1Y2tldCBhbmQgdXNlIHRoZW0gZm9yIGEgTGFtYmRhIGZ1bmN0aW9uLlxuICAgICAgLy8gUm9vdFN0YWNrIHJlc29sdmVzIHMzQnVja2V0IGZyb20gYSByb290IHRlbXBsYXRlIHBhcmFtZXRlciBhbmQgcGFzc2VkIHRvIEZpcnN0TGV2ZWxSb290U3RhY2sgd2hpY2hcbiAgICAgIC8vIHJlc29sdmVzIHMzS2V5IHRocm91Z2ggb3V0cHV0IG9mIGBOZXN0ZWRTaWJsaW5nU3RhY2tgXG4gICAgICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwTmVzdGVkU3RhY2tUZXN0cygnUm9vdFN0YWNrJyk7XG5cbiAgICAgIGNvbnN0IG9sZFJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICAgIHN0YWNrTmFtZTogJ1Jvb3RTdGFjaycsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGaXJzdExldmVsTmVzdGVkU3RhY2s6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgICAgICAgICBSZWY6ICdTM0J1Y2tldFBhcmFtJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb25lLXN0YWNrLXdpdGgtdHdvLW5lc3RlZC1zdGFja3Mtc3RhY2sudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgICAgRGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIGFzc2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBvbGRGaXJzdExldmVsTmVzdGVkU3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdGaXJzdExldmVsTmVzdGVkU3RhY2snLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgTmVzdGVkTGFtYmRhU3RhY2s6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlVG9TM0J1Y2tldFBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICAgIFJlZjogJ1MzQnVja2V0UGFyYW0nLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHJlZmVyZW5jZVRvUzNTdGFja0tleU91dHB1dDoge1xuICAgICAgICAgICAgICAgICAgICAnRm46OkdldEF0dCc6IFsnTmVzdGVkU2libGluZ1N0YWNrJywgJ091dHB1dHMuTmVzdGVkT3V0cHV0J10sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtc3RhY2std2l0aC1kZXBlbmRlbmN5LW9uLXNpYmxpbmctc3RhY2stb3V0cHV0Lm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBOZXN0ZWRTaWJsaW5nU3RhY2s6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1vdXRwdXQtc3RhY2submVzdGVkLnRlbXBsYXRlLmpzb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgIFMzQnVja2V0UGFyYW06IHtcbiAgICAgICAgICAgICAgVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciBhc3NldCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgbmVzdGVkTGFtYmRhU3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdOZXN0ZWRMYW1iZGFTdGFjaycsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1sYW1iZGEtcGF0aCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBuZXN0ZWRTaWJsaW5nU3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdOZXN0ZWRTaWJsaW5nU3RhY2snLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIE91dHB1dHM6IHtcbiAgICAgICAgICAgIE5lc3RlZE91dHB1dDogeyBWYWx1ZTogJ3MzLWtleS12YWx1ZS1mcm9tLW91dHB1dCcgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2sob2xkUm9vdFN0YWNrKTtcbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2sob2xkRmlyc3RMZXZlbE5lc3RlZFN0YWNrKTtcbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2sobmVzdGVkTGFtYmRhU3RhY2spO1xuICAgICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhuZXN0ZWRTaWJsaW5nU3RhY2spO1xuXG4gICAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgb2xkUm9vdFN0YWNrLnN0YWNrTmFtZSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgb2xkRmlyc3RMZXZlbE5lc3RlZFN0YWNrLnN0YWNrTmFtZSxcbiAgICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgIGBhcm46YXdzOmNsb3VkZm9ybWF0aW9uOmJlcm11ZGEtdHJpYW5nbGUtMTMzNzoxMjM0NTY3ODkwMTI6c3RhY2svJHtvbGRGaXJzdExldmVsTmVzdGVkU3RhY2suc3RhY2tOYW1lfS9hYmNkYCxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgb2xkRmlyc3RMZXZlbE5lc3RlZFN0YWNrLnN0YWNrTmFtZSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgbmVzdGVkTGFtYmRhU3RhY2suc3RhY2tOYW1lLFxuICAgICAgICAgICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgYGFybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay8ke25lc3RlZExhbWJkYVN0YWNrLnN0YWNrTmFtZX0vYWJjZGAsXG4gICAgICAgICksXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgIG5lc3RlZFNpYmxpbmdTdGFjay5zdGFja05hbWUsXG4gICAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICBgYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrLyR7bmVzdGVkU2libGluZ1N0YWNrLnN0YWNrTmFtZX0vYWJjZGAsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgc2V0dXAucHVzaE5lc3RlZFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIG5lc3RlZExhbWJkYVN0YWNrLnN0YWNrTmFtZSxcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ0Z1bmMnLCAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywgJ25lc3RlZC1sYW1iZGEtZnVuY3Rpb24nKSxcbiAgICAgICk7XG4gICAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhuZXN0ZWRTaWJsaW5nU3RhY2suc3RhY2tOYW1lKTtcbiAgICAgIG9sZFJvb3RTdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuRmlyc3RMZXZlbE5lc3RlZFN0YWNrLlByb3BlcnRpZXMuVGVtcGxhdGVVUkwgPSAnaHR0cHM6Ly93d3cuYW1hem9uLmNvbSc7XG4gICAgICBvbGRGaXJzdExldmVsTmVzdGVkU3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLk5lc3RlZExhbWJkYVN0YWNrLlByb3BlcnRpZXMuVGVtcGxhdGVVUkwgPSAnaHR0cHM6Ly93d3cuYW1hem9uLmNvbSc7XG4gICAgICBvbGRGaXJzdExldmVsTmVzdGVkU3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLk5lc3RlZFNpYmxpbmdTdGFjay5Qcm9wZXJ0aWVzLlRlbXBsYXRlVVJMID0gJ2h0dHBzOi8vd3d3LmFtYXpvbi5jb20nO1xuICAgICAgY29uc3QgbmV3Um9vdFN0YWNrID0gdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRSb290U3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkUm9vdFN0YWNrLnRlbXBsYXRlIH0pO1xuICAgICAgdGVzdFN0YWNrKHsgc3RhY2tOYW1lOiBvbGRGaXJzdExldmVsTmVzdGVkU3RhY2suc3RhY2tOYW1lLCB0ZW1wbGF0ZTogb2xkRmlyc3RMZXZlbE5lc3RlZFN0YWNrLnRlbXBsYXRlIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIG5ld1Jvb3RTdGFjaywge1xuICAgICAgICBTM0J1Y2tldFBhcmFtOiAnbmV3LWJ1Y2tldCcsXG4gICAgICB9KTtcblxuICAgICAgLy8gVEhFTlxuICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgIFMzQnVja2V0OiAnbmV3LWJ1Y2tldCcsXG4gICAgICAgIFMzS2V5OiAnczMta2V5LXZhbHVlLWZyb20tb3V0cHV0JyxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnY2FuIGhvdHN3YXAgYSBsYW1iZGEgZnVuY3Rpb24gaW4gYSAxLWxldmVsIG5lc3RlZCBzdGFjayBhbmQgcmVhZCBkZWZhdWx0IHBhcmFtZXRlcnMgdmFsdWUgaWYgbm90IHByb3ZpZGVkJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTjogUm9vdFN0YWNrIGhhcyBvbmUgY2hpbGQgc3RhY2sgYE5lc3RlZFN0YWNrYC4gYE5lc3RlZFN0YWNrYCB0YWtlcyB0d29cbiAgICAgIC8vIHBhcmFtZXRlcnMgczNLZXkgYW5kIHMzQnVja2V0IGFuZCB1c2UgdGhlbSBmb3IgYSBMYW1iZGEgZnVuY3Rpb24uXG4gICAgICAvLyBSb290U3RhY2sgcmVzb2x2ZXMgYm90aCBwYXJhbWV0ZXJzIGZyb20gcm9vdCB0ZW1wbGF0ZSBwYXJhbWV0ZXJzLiBDdXJyZW50L29sZCBjaGFuZ2VcbiAgICAgIC8vIGhhcyBoYXJkY29kZWQgcmVzb2x2ZWQgdmFsdWVzIGFuZCB0aGUgbmV3IGNoYW5nZSBkb2Vzbid0IHByb3ZpZGUgcGFyYW1ldGVycyB0aHJvdWdoXG4gICAgICAvLyByb290IHN0YWNrIGZvcmNpbmcgdGhlIGV2YWx1YXRpb24gb2YgZGVmYXVsdCBwYXJhbWV0ZXIgdmFsdWVzLlxuICAgICAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcE5lc3RlZFN0YWNrVGVzdHMoJ0xhbWJkYVJvb3QnKTtcblxuICAgICAgY29uc3Qgcm9vdFN0YWNrID0gdGVzdFN0YWNrKHtcbiAgICAgICAgc3RhY2tOYW1lOiAnTGFtYmRhUm9vdCcsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5tYWdpYy11cmwuY29tJyxcbiAgICAgICAgICAgICAgICBQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICByZWZlcmVuY2V0b1MzQnVja2V0UGFyYW06IHtcbiAgICAgICAgICAgICAgICAgICAgUmVmOiAnUzNCdWNrZXRQYXJhbScsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgcmVmZXJlbmNldG9TM0tleVBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICAgIFJlZjogJ1MzS2V5UGFyYW0nLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAgICdhd3M6YXNzZXQ6cGF0aCc6ICdvbmUtbGFtYmRhLXN0YWNrLXdpdGgtYXNzZXQtcGFyYW1ldGVycy5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgICAgRGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIGFzc2V0JyxcbiAgICAgICAgICAgICAgRGVmYXVsdDogJ2RlZmF1bHQtczMtYnVja2V0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBTM0tleVBhcmFtOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdTdHJpbmcnLFxuICAgICAgICAgICAgICBEZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgYXNzZXQnLFxuICAgICAgICAgICAgICBEZWZhdWx0OiAnZGVmYXVsdC1zMy1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2socm9vdFN0YWNrKTtcbiAgICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICAgIHRlc3RTdGFjayh7XG4gICAgICAgICAgc3RhY2tOYW1lOiAnTmVzdGVkU3RhY2snLFxuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICk7XG5cbiAgICAgIHNldHVwLnB1c2hOZXN0ZWRTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICAnTGFtYmRhUm9vdCcsXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdOZXN0ZWRTdGFjaycsXG4gICAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL05lc3RlZFN0YWNrL2FiY2QnLFxuICAgICAgICApLFxuICAgICAgKTtcblxuICAgICAgcm9vdFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5OZXN0ZWRTdGFjay5Qcm9wZXJ0aWVzLlRlbXBsYXRlVVJMID0gJ2h0dHBzOi8vd3d3LmFtYXpvbi5jb20nO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIHJvb3RTdGFjayk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICBTM0J1Y2tldDogJ2RlZmF1bHQtczMtYnVja2V0JyxcbiAgICAgICAgUzNLZXk6ICdkZWZhdWx0LXMzLWtleScsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoJ2NhbiBob3Rzd2FwIGEgbGFtYmRhIGZ1bmN0aW9uIGluIGEgMi1sZXZlbCBuZXN0ZWQgc3RhY2sgd2l0aCBhc3NldCBwYXJhbWV0ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgaG90c3dhcE1vY2tTZGtQcm92aWRlciA9IHNldHVwLnNldHVwSG90c3dhcE5lc3RlZFN0YWNrVGVzdHMoJ0xhbWJkYVJvb3QnKTtcblxuICAgIGNvbnN0IHJvb3RTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdMYW1iZGFSb290JyxcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIENoaWxkU3RhY2s6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICByZWZlcmVuY2V0b0dyYW5kQ2hpbGRTM0J1Y2tldFBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICBSZWY6ICdHcmFuZENoaWxkUzNCdWNrZXRQYXJhbScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZWZlcmVuY2V0b0dyYW5kQ2hpbGRTM0tleVBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICBSZWY6ICdHcmFuZENoaWxkUzNLZXlQYXJhbScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZWZlcmVuY2V0b0NoaWxkUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgICAgICAgUmVmOiAnQ2hpbGRTM0J1Y2tldFBhcmFtJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlZmVyZW5jZXRvQ2hpbGRTM0tleVBhcmFtOiB7XG4gICAgICAgICAgICAgICAgICBSZWY6ICdDaGlsZFMzS2V5UGFyYW0nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtb25lLXN0YWNrLXN0YWNrLXdpdGgtYXNzZXQtcGFyYW1ldGVycy5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBHcmFuZENoaWxkUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICBEZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgYXNzZXQnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgR3JhbmRDaGlsZFMzS2V5UGFyYW06IHtcbiAgICAgICAgICAgIFR5cGU6ICdTdHJpbmcnLFxuICAgICAgICAgICAgRGVzY3JpcHRpb246ICdTMyBidWNrZXQgZm9yIGFzc2V0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIENoaWxkUzNCdWNrZXRQYXJhbToge1xuICAgICAgICAgICAgVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICBEZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgYXNzZXQnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQ2hpbGRTM0tleVBhcmFtOiB7XG4gICAgICAgICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIERlc2NyaXB0aW9uOiAnUzMgYnVja2V0IGZvciBhc3NldCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhyb290U3RhY2spO1xuXG4gICAgY29uc3QgY2hpbGRTdGFjayA9IHRlc3RTdGFjayh7XG4gICAgICBzdGFja05hbWU6ICdDaGlsZFN0YWNrJyxcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBNZXRhZGF0YToge1xuICAgICAgICAgICAgICAnYXdzOmFzc2V0OnBhdGgnOiAnb2xkLWxhbWJkYS1wYXRoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBHcmFuZENoaWxkU3RhY2s6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkNsb3VkRm9ybWF0aW9uOjpTdGFjaycsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRlbXBsYXRlVVJMOiAnaHR0cHM6Ly93d3cubWFnaWMtdXJsLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtc3RhY2std2l0aC1hc3NldC1wYXJhbWV0ZXJzLm5lc3RlZC50ZW1wbGF0ZS5qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhjaGlsZFN0YWNrKTtcblxuICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdHcmFuZENoaWxkU3RhY2snLFxuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgICAgUzNLZXk6ICdjdXJyZW50LWtleScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIE1ldGFkYXRhOiB7XG4gICAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29sZC1sYW1iZGEtcGF0aCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgc2V0dXAucHVzaE5lc3RlZFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAnTGFtYmRhUm9vdCcsXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgJ0NoaWxkU3RhY2snLFxuICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL0NoaWxkU3RhY2svYWJjZCcsXG4gICAgICApLFxuICAgICk7XG5cbiAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICdDaGlsZFN0YWNrJyxcbiAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAnR3JhbmRDaGlsZFN0YWNrJyxcbiAgICAgICAgJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgJ2Fybjphd3M6Y2xvdWRmb3JtYXRpb246YmVybXVkYS10cmlhbmdsZS0xMzM3OjEyMzQ1Njc4OTAxMjpzdGFjay9HcmFuZENoaWxkU3RhY2svYWJjZCcsXG4gICAgICApLFxuICAgICk7XG5cbiAgICByb290U3RhY2sudGVtcGxhdGUuUmVzb3VyY2VzLkNoaWxkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcbiAgICBjaGlsZFN0YWNrLnRlbXBsYXRlLlJlc291cmNlcy5HcmFuZENoaWxkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIHJvb3RTdGFjaywge1xuICAgICAgR3JhbmRDaGlsZFMzQnVja2V0UGFyYW06ICdjaGlsZC1idWNrZXQtcGFyYW0tdmFsdWUnLFxuICAgICAgR3JhbmRDaGlsZFMzS2V5UGFyYW06ICdjaGlsZC1rZXktcGFyYW0tdmFsdWUnLFxuICAgICAgQ2hpbGRTM0J1Y2tldFBhcmFtOiAnYnVja2V0LXBhcmFtLXZhbHVlJyxcbiAgICAgIENoaWxkUzNLZXlQYXJhbTogJ2tleS1wYXJhbS12YWx1ZScsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgIFMzQnVja2V0OiAnYnVja2V0LXBhcmFtLXZhbHVlJyxcbiAgICAgIFMzS2V5OiAna2V5LXBhcmFtLXZhbHVlJyxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVGdW5jdGlvbkNvZGVDb21tYW5kLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICBTM0J1Y2tldDogJ2NoaWxkLWJ1Y2tldC1wYXJhbS12YWx1ZScsXG4gICAgICBTM0tleTogJ2NoaWxkLWtleS1wYXJhbS12YWx1ZScsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHNpbGVudFRlc3QoJ2xvb2tpbmcgdXAgb2JqZWN0cyBpbiBuZXN0ZWQgc3RhY2tzIHdvcmtzJywgYXN5bmMgKCkgPT4ge1xuICAgIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBOZXN0ZWRTdGFja1Rlc3RzKCdMYW1iZGFSb290Jyk7XG5cbiAgICBjb25zdCByb290U3RhY2sgPSB0ZXN0U3RhY2soe1xuICAgICAgc3RhY2tOYW1lOiAnTGFtYmRhUm9vdCcsXG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBOZXN0ZWRTdGFjazoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6Q2xvdWRGb3JtYXRpb246OlN0YWNrJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGVtcGxhdGVVUkw6ICdodHRwczovL3d3dy5hbWF6b2ZmLmNvbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgTWV0YWRhdGE6IHtcbiAgICAgICAgICAgICAgJ2F3czphc3NldDpwYXRoJzogJ29uZS1sYW1iZGEtdmVyc2lvbi1zdGFjay5uZXN0ZWQudGVtcGxhdGUuanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgc2V0dXAuYWRkVGVtcGxhdGVUb0Nsb3VkRm9ybWF0aW9uTG9va3VwTW9jayhyb290U3RhY2spO1xuICAgIHNldHVwLmFkZFRlbXBsYXRlVG9DbG91ZEZvcm1hdGlvbkxvb2t1cE1vY2soXG4gICAgICB0ZXN0U3RhY2soe1xuICAgICAgICBzdGFja05hbWU6ICdOZXN0ZWRTdGFjaycsXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBWZXJzaW9uOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6VmVyc2lvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6IHsgUmVmOiAnRnVuYycgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICBzZXR1cC5wdXNoTmVzdGVkU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICdMYW1iZGFSb290JyxcbiAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAnTmVzdGVkU3RhY2snLFxuICAgICAgICAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snLFxuICAgICAgICAnYXJuOmF3czpjbG91ZGZvcm1hdGlvbjpiZXJtdWRhLXRyaWFuZ2xlLTEzMzc6MTIzNDU2Nzg5MDEyOnN0YWNrL05lc3RlZFN0YWNrL2FiY2QnLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgLy8gV0hFTlxuICAgIHJvb3RTdGFjay50ZW1wbGF0ZS5SZXNvdXJjZXMuTmVzdGVkU3RhY2suUHJvcGVydGllcy5UZW1wbGF0ZVVSTCA9ICdodHRwczovL3d3dy5hbWF6b24uY29tJztcbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIHJvb3RTdGFjayk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFB1Ymxpc2hWZXJzaW9uQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgIH0pO1xuICB9KTtcbn0pO1xuIl19