"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const setup = require("./hotswap-test-setup");
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
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('these tests do not depend on the hotswap type', (hotswapMode) => {
    (0, silent_1.silentTest)('calls the updateLambdaCode() API when it receives only a code difference in a Lambda function (Inline Node.js code)', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            ZipFile: 'exports.handler = () => {return true}',
                        },
                        Runtime: aws_lambda_1.Runtime.NODEJS_LATEST.name,
                        FunctionName: 'my-function',
                    },
                },
            },
        });
        const newCode = 'exports.handler = () => {return false}';
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    Func: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Code: {
                                ZipFile: newCode,
                            },
                            Runtime: aws_lambda_1.Runtime.NODEJS_LATEST.name,
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
            ZipFile: expect.any(Buffer),
        });
    });
    (0, silent_1.silentTest)('calls the updateLambdaCode() API when it receives only a code difference in a Lambda function (Inline Python code)', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            ZipFile: 'def handler(event, context):\n  return True',
                        },
                        Runtime: 'python3.9',
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
                                ZipFile: 'def handler(event, context):\n  return False',
                            },
                            Runtime: 'python3.9',
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
            ZipFile: expect.any(Buffer),
        });
    });
    (0, silent_1.silentTest)('throw a CfnEvaluationException when it receives an unsupported function runtime', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Code: {
                            ZipFile: 'def handler(event:, context:) true end',
                        },
                        Runtime: 'ruby2.7',
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
                                ZipFile: 'def handler(event:, context:) false end',
                            },
                            Runtime: 'ruby2.7',
                            FunctionName: 'my-function',
                        },
                    },
                },
            },
        });
        // WHEN
        const tryHotswap = hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        await expect(tryHotswap).rejects.toThrow('runtime ruby2.7 is unsupported, only node.js and python runtimes are currently supported.');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLWZ1bmN0aW9ucy1pbmxpbmUtaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLWZ1bmN0aW9ucy1pbmxpbmUtaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMERBQW1FO0FBQ25FLHVEQUFpRDtBQUNqRCw4Q0FBOEM7QUFDOUMsNERBQThEO0FBQzlELGtEQUF1RDtBQUN2RCw4Q0FBK0M7QUFFL0MsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7SUFDdkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBRTlELE9BQU87UUFDTCxHQUFHLFFBQVE7UUFDWCx3QkFBd0IsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO0tBQ3BDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksc0JBQW9ELENBQUM7QUFFekQsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLHNCQUFzQixHQUFHLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0FBQ3JELENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLG9CQUFXLENBQUMsU0FBUyxFQUFFLG9CQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FDOUQsK0NBQStDLEVBQy9DLENBQUMsV0FBVyxFQUFFLEVBQUU7SUFDZCxJQUFBLG1CQUFVLEVBQ1IscUhBQXFILEVBQ3JILEtBQUssSUFBSSxFQUFFO1FBQ1QsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsSUFBSSxFQUFFO29CQUNKLElBQUksRUFBRSx1QkFBdUI7b0JBQzdCLFVBQVUsRUFBRTt3QkFDVixJQUFJLEVBQUU7NEJBQ0osT0FBTyxFQUFFLHVDQUF1Qzt5QkFDakQ7d0JBQ0QsT0FB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Q2xCLFlBQVksRUFBRSxhQUFhO3FCQUM1QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUM7WUFDaEQsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRTtvQkFDVCxJQUFJLEVBQUU7d0JBQ0osSUFBSSxFQUFFLHVCQUF1Qjt3QkFDN0IsVUFBVSxFQUFFOzRCQUNWLElBQUksRUFBRTtnQ0FDSixPQUFPLEVBQUUseUNBQXlDOzZCQUNuRDs0QkFDRCxPQUFPLEVBQUUsU0FBUzs0QkFDbEIsWUFBWSxFQUFFLGFBQWE7eUJBQzVCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxVQUFVLEdBQUcsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFOUYsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3RDLDJGQUEyRixDQUM1RixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtbGFtYmRhJztcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIHNldHVwIGZyb20gJy4vaG90c3dhcC10ZXN0LXNldHVwJztcbmltcG9ydCB7IEhvdHN3YXBNb2RlIH0gZnJvbSAnLi4vLi4vLi4vbGliL2FwaS9ob3Rzd2FwL2NvbW1vbic7XG5pbXBvcnQgeyBtb2NrTGFtYmRhQ2xpZW50IH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5qZXN0Lm1vY2soJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnLCAoKSA9PiB7XG4gIGNvbnN0IG9yaWdpbmFsID0gamVzdC5yZXF1aXJlQWN0dWFsKCdAYXdzLXNkay9jbGllbnQtbGFtYmRhJyk7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi5vcmlnaW5hbCxcbiAgICB3YWl0VW50aWxGdW5jdGlvblVwZGF0ZWQ6IGplc3QuZm4oKSxcbiAgfTtcbn0pO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBUZXN0cygpO1xufSk7XG5cbmRlc2NyaWJlLmVhY2goW0hvdHN3YXBNb2RlLkZBTExfQkFDSywgSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZXSkoXG4gICd0aGVzZSB0ZXN0cyBkbyBub3QgZGVwZW5kIG9uIHRoZSBob3Rzd2FwIHR5cGUnLFxuICAoaG90c3dhcE1vZGUpID0+IHtcbiAgICBzaWxlbnRUZXN0KFxuICAgICAgJ2NhbGxzIHRoZSB1cGRhdGVMYW1iZGFDb2RlKCkgQVBJIHdoZW4gaXQgcmVjZWl2ZXMgb25seSBhIGNvZGUgZGlmZmVyZW5jZSBpbiBhIExhbWJkYSBmdW5jdGlvbiAoSW5saW5lIE5vZGUuanMgY29kZSknLFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBHSVZFTlxuICAgICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgICAgWmlwRmlsZTogJ2V4cG9ydHMuaGFuZGxlciA9ICgpID0+IHtyZXR1cm4gdHJ1ZX0nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgUnVudGltZTogUnVudGltZS5OT0RFSlNfTEFURVNULm5hbWUsXG4gICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbmV3Q29kZSA9ICdleHBvcnRzLmhhbmRsZXIgPSAoKSA9PiB7cmV0dXJuIGZhbHNlfSc7XG4gICAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgICAgWmlwRmlsZTogbmV3Q29kZSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBSdW50aW1lOiBSdW50aW1lLk5PREVKU19MQVRFU1QubmFtZSxcbiAgICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUZ1bmN0aW9uQ29kZUNvbW1hbmQsIHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgWmlwRmlsZTogZXhwZWN0LmFueShCdWZmZXIpLFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHNpbGVudFRlc3QoXG4gICAgICAnY2FsbHMgdGhlIHVwZGF0ZUxhbWJkYUNvZGUoKSBBUEkgd2hlbiBpdCByZWNlaXZlcyBvbmx5IGEgY29kZSBkaWZmZXJlbmNlIGluIGEgTGFtYmRhIGZ1bmN0aW9uIChJbmxpbmUgUHl0aG9uIGNvZGUpJyxcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gR0lWRU5cbiAgICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFppcEZpbGU6ICdkZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XFxuICByZXR1cm4gVHJ1ZScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBSdW50aW1lOiAncHl0aG9uMy45JyxcbiAgICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgICAgIFppcEZpbGU6ICdkZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XFxuICByZXR1cm4gRmFsc2UnLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIFJ1bnRpbWU6ICdweXRob24zLjknLFxuICAgICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tMYW1iZGFDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlRnVuY3Rpb25Db2RlQ29tbWFuZCwge1xuICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICBaaXBGaWxlOiBleHBlY3QuYW55KEJ1ZmZlciksXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgc2lsZW50VGVzdCgndGhyb3cgYSBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uIHdoZW4gaXQgcmVjZWl2ZXMgYW4gdW5zdXBwb3J0ZWQgZnVuY3Rpb24gcnVudGltZScsIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgWmlwRmlsZTogJ2RlZiBoYW5kbGVyKGV2ZW50OiwgY29udGV4dDopIHRydWUgZW5kJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgUnVudGltZTogJ3J1YnkyLjcnLFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICAgIFppcEZpbGU6ICdkZWYgaGFuZGxlcihldmVudDosIGNvbnRleHQ6KSBmYWxzZSBlbmQnLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgUnVudGltZTogJ3J1YnkyLjcnLFxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCB0cnlIb3Rzd2FwID0gaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGF3YWl0IGV4cGVjdCh0cnlIb3Rzd2FwKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICAgICdydW50aW1lIHJ1YnkyLjcgaXMgdW5zdXBwb3J0ZWQsIG9ubHkgbm9kZS5qcyBhbmQgcHl0aG9uIHJ1bnRpbWVzIGFyZSBjdXJyZW50bHkgc3VwcG9ydGVkLicsXG4gICAgICApO1xuICAgIH0pO1xuICB9LFxuKTtcbiJdfQ==