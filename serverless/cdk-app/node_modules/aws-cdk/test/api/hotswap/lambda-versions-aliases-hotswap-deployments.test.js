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
        waitUntilFunctionUpdated: jest.fn(),
    };
});
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('hotswaps a Version if it points to a changed Function, even if it itself is unchanged', async () => {
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
                },
                Version: {
                    Type: 'AWS::Lambda::Version',
                    Properties: {
                        FunctionName: { Ref: 'Func' },
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
                    },
                    Version: {
                        Type: 'AWS::Lambda::Version',
                        Properties: {
                            FunctionName: { Ref: 'Func' },
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.PublishVersionCommand, {
            FunctionName: 'my-function',
        });
    });
    (0, silent_1.silentTest)('hotswaps a Version if it points to a changed Function, even if it itself is replaced', async () => {
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
                },
                Version1: {
                    Type: 'AWS::Lambda::Version',
                    Properties: {
                        FunctionName: { Ref: 'Func' },
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
                    },
                    Version2: {
                        Type: 'AWS::Lambda::Version',
                        Properties: {
                            FunctionName: { Ref: 'Func' },
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.PublishVersionCommand, {
            FunctionName: 'my-function',
        });
    });
    (0, silent_1.silentTest)('hotswaps a Version and an Alias if the Function they point to changed', async () => {
        // GIVEN
        mock_sdk_1.mockLambdaClient.on(client_lambda_1.PublishVersionCommand).resolves({
            Version: 'v2',
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
                },
                Version1: {
                    Type: 'AWS::Lambda::Version',
                    Properties: {
                        FunctionName: { Ref: 'Func' },
                    },
                },
                Alias: {
                    Type: 'AWS::Lambda::Alias',
                    Properties: {
                        FunctionName: { Ref: 'Func' },
                        FunctionVersion: { 'Fn::GetAtt': ['Version1', 'Version'] },
                        Name: 'dev',
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
                    },
                    Version2: {
                        Type: 'AWS::Lambda::Version',
                        Properties: {
                            FunctionName: { Ref: 'Func' },
                        },
                    },
                    Alias: {
                        Type: 'AWS::Lambda::Alias',
                        Properties: {
                            FunctionName: { Ref: 'Func' },
                            FunctionVersion: { 'Fn::GetAtt': ['Version2', 'Version'] },
                            Name: 'dev',
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockLambdaClient).toHaveReceivedCommandWith(client_lambda_1.UpdateAliasCommand, {
            FunctionName: 'my-function',
            FunctionVersion: 'v2',
            Name: 'dev',
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXZlcnNpb25zLWFsaWFzZXMtaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXZlcnNpb25zLWFsaWFzZXMtaG90c3dhcC1kZXBsb3ltZW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMERBQW1GO0FBQ25GLDhDQUE4QztBQUM5Qyw0REFBOEQ7QUFDOUQsa0RBQXVEO0FBQ3ZELDhDQUErQztBQUUvQyxJQUFJLENBQUMsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtJQUN2QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFFOUQsT0FBTztRQUNMLEdBQUcsUUFBUTtRQUNYLHdCQUF3QixFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7S0FDcEMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxzQkFBb0QsQ0FBQztBQUV6RCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2Qsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFBQyx1RkFBdUYsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM3RyxRQUFRO1FBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDO1lBQy9CLFNBQVMsRUFBRTtnQkFDVCxJQUFJLEVBQUU7b0JBQ0osSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsVUFBVSxFQUFFO3dCQUNWLElBQUksRUFBRTs0QkFDSixRQUFRLEVBQUUsZ0JBQWdCOzRCQUMxQixLQUFLLEVBQUUsYUFBYTt5QkFDckI7d0JBQ0QsWUFBWSxFQUFFLGFBQWE7cUJBQzVCO2lCQUNGO2dCQUNELE9BQU8sRUFBRTtvQkFDUCxJQUFJLEVBQUUsc0JBQXNCO29CQUM1QixVQUFVLEVBQUU7d0JBQ1YsWUFBWSxFQUFFLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTtxQkFDOUI7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSx1QkFBdUI7d0JBQzdCLFVBQVUsRUFBRTs0QkFDVixJQUFJLEVBQUU7Z0NBQ0osUUFBUSxFQUFFLGdCQUFnQjtnQ0FDMUIsS0FBSyxFQUFFLFNBQVM7NkJBQ2pCOzRCQUNELFlBQVksRUFBRSxhQUFhO3lCQUM1QjtxQkFDRjtvQkFDRCxPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLHNCQUFzQjt3QkFDNUIsVUFBVSxFQUFFOzRCQUNWLFlBQVksRUFBRSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7eUJBQzlCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTNHLE9BQU87UUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDOUMsTUFBTSxDQUFDLDJCQUFnQixDQUFDLENBQUMseUJBQXlCLENBQUMscUNBQXFCLEVBQUU7WUFDeEUsWUFBWSxFQUFFLGFBQWE7U0FDNUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFBLG1CQUFVLEVBQUMsc0ZBQXNGLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDNUcsUUFBUTtRQUNSLEtBQUssQ0FBQywwQkFBMEIsQ0FBQztZQUMvQixTQUFTLEVBQUU7Z0JBQ1QsSUFBSSxFQUFFO29CQUNKLElBQUksRUFBRSx1QkFBdUI7b0JBQzdCLFVBQVUsRUFBRTt3QkFDVixJQUFJLEVBQUU7NEJBQ0osUUFBUSxFQUFFLGdCQUFnQjs0QkFDMUIsS0FBSyxFQUFFLGFBQWE7eUJBQ3JCO3dCQUNELFlBQVksRUFBRSxhQUFhO3FCQUM1QjtpQkFDRjtnQkFDRCxRQUFRLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLHNCQUFzQjtvQkFDNUIsVUFBVSxFQUFFO3dCQUNWLFlBQVksRUFBRSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7cUJBQzlCO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFO29CQUNULElBQUksRUFBRTt3QkFDSixJQUFJLEVBQUUsdUJBQXVCO3dCQUM3QixVQUFVLEVBQUU7NEJBQ1YsSUFBSSxFQUFFO2dDQUNKLFFBQVEsRUFBRSxnQkFBZ0I7Z0NBQzFCLEtBQUssRUFBRSxTQUFTOzZCQUNqQjs0QkFDRCxZQUFZLEVBQUUsYUFBYTt5QkFDNUI7cUJBQ0Y7b0JBQ0QsUUFBUSxFQUFFO3dCQUNSLElBQUksRUFBRSxzQkFBc0I7d0JBQzVCLFVBQVUsRUFBRTs0QkFDVixZQUFZLEVBQUUsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFO3lCQUM5QjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUUzRyxPQUFPO1FBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzlDLE1BQU0sQ0FBQywyQkFBZ0IsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLHFDQUFxQixFQUFFO1lBQ3hFLFlBQVksRUFBRSxhQUFhO1NBQzVCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBQSxtQkFBVSxFQUFDLHVFQUF1RSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdGLFFBQVE7UUFDUiwyQkFBZ0IsQ0FBQyxFQUFFLENBQUMscUNBQXFCLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDbEQsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDLENBQUM7UUFDSCxLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsU0FBUyxFQUFFO2dCQUNULElBQUksRUFBRTtvQkFDSixJQUFJLEVBQUUsdUJBQXVCO29CQUM3QixVQUFVLEVBQUU7d0JBQ1YsSUFBSSxFQUFFOzRCQUNKLFFBQVEsRUFBRSxnQkFBZ0I7NEJBQzFCLEtBQUssRUFBRSxhQUFhO3lCQUNyQjt3QkFDRCxZQUFZLEVBQUUsYUFBYTtxQkFDNUI7aUJBQ0Y7Z0JBQ0QsUUFBUSxFQUFFO29CQUNSLElBQUksRUFBRSxzQkFBc0I7b0JBQzVCLFVBQVUsRUFBRTt3QkFDVixZQUFZLEVBQUUsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFO3FCQUM5QjtpQkFDRjtnQkFDRCxLQUFLLEVBQUU7b0JBQ0wsSUFBSSxFQUFFLG9CQUFvQjtvQkFDMUIsVUFBVSxFQUFFO3dCQUNWLFlBQVksRUFBRSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7d0JBQzdCLGVBQWUsRUFBRSxFQUFFLFlBQVksRUFBRSxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsRUFBRTt3QkFDMUQsSUFBSSxFQUFFLEtBQUs7cUJBQ1o7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ2hELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUU7b0JBQ1QsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSx1QkFBdUI7d0JBQzdCLFVBQVUsRUFBRTs0QkFDVixJQUFJLEVBQUU7Z0NBQ0osUUFBUSxFQUFFLGdCQUFnQjtnQ0FDMUIsS0FBSyxFQUFFLFNBQVM7NkJBQ2pCOzRCQUNELFlBQVksRUFBRSxhQUFhO3lCQUM1QjtxQkFDRjtvQkFDRCxRQUFRLEVBQUU7d0JBQ1IsSUFBSSxFQUFFLHNCQUFzQjt3QkFDNUIsVUFBVSxFQUFFOzRCQUNWLFlBQVksRUFBRSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7eUJBQzlCO3FCQUNGO29CQUNELEtBQUssRUFBRTt3QkFDTCxJQUFJLEVBQUUsb0JBQW9CO3dCQUMxQixVQUFVLEVBQUU7NEJBQ1YsWUFBWSxFQUFFLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRTs0QkFDN0IsZUFBZSxFQUFFLEVBQUUsWUFBWSxFQUFFLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxFQUFFOzRCQUMxRCxJQUFJLEVBQUUsS0FBSzt5QkFDWjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUUzRyxPQUFPO1FBQ1AsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzlDLE1BQU0sQ0FBQywyQkFBZ0IsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLGtDQUFrQixFQUFFO1lBQ3JFLFlBQVksRUFBRSxhQUFhO1lBQzNCLGVBQWUsRUFBRSxJQUFJO1lBQ3JCLElBQUksRUFBRSxLQUFLO1NBQ1osQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFB1Ymxpc2hWZXJzaW9uQ29tbWFuZCwgVXBkYXRlQWxpYXNDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBIb3Rzd2FwTW9kZSB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgbW9ja0xhbWJkYUNsaWVudCB9IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHsgc2lsZW50VGVzdCB9IGZyb20gJy4uLy4uL3V0aWwvc2lsZW50JztcblxuamVzdC5tb2NrKCdAYXdzLXNkay9jbGllbnQtbGFtYmRhJywgKCkgPT4ge1xuICBjb25zdCBvcmlnaW5hbCA9IGplc3QucmVxdWlyZUFjdHVhbCgnQGF3cy1zZGsvY2xpZW50LWxhbWJkYScpO1xuXG4gIHJldHVybiB7XG4gICAgLi4ub3JpZ2luYWwsXG4gICAgd2FpdFVudGlsRnVuY3Rpb25VcGRhdGVkOiBqZXN0LmZuKCksXG4gIH07XG59KTtcblxubGV0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXI6IHNldHVwLkhvdHN3YXBNb2NrU2RrUHJvdmlkZXI7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyID0gc2V0dXAuc2V0dXBIb3Rzd2FwVGVzdHMoKTtcbn0pO1xuXG5kZXNjcmliZS5lYWNoKFtIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssIEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWV0pKCclcCBtb2RlJywgKGhvdHN3YXBNb2RlKSA9PiB7XG4gIHNpbGVudFRlc3QoJ2hvdHN3YXBzIGEgVmVyc2lvbiBpZiBpdCBwb2ludHMgdG8gYSBjaGFuZ2VkIEZ1bmN0aW9uLCBldmVuIGlmIGl0IGl0c2VsZiBpcyB1bmNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRnVuYzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgIFMzS2V5OiAnY3VycmVudC1rZXknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBWZXJzaW9uOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpWZXJzaW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6IHsgUmVmOiAnRnVuYycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgICAgUzNCdWNrZXQ6ICdjdXJyZW50LWJ1Y2tldCcsXG4gICAgICAgICAgICAgICAgUzNLZXk6ICduZXcta2V5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFZlcnNpb246IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6VmVyc2lvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogeyBSZWY6ICdGdW5jJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChQdWJsaXNoVmVyc2lvbkNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnaG90c3dhcHMgYSBWZXJzaW9uIGlmIGl0IHBvaW50cyB0byBhIGNoYW5nZWQgRnVuY3Rpb24sIGV2ZW4gaWYgaXQgaXRzZWxmIGlzIHJlcGxhY2VkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgVmVyc2lvbjE6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OlZlcnNpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogeyBSZWY6ICdGdW5jJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgRnVuYzoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvZGU6IHtcbiAgICAgICAgICAgICAgICBTM0J1Y2tldDogJ2N1cnJlbnQtYnVja2V0JyxcbiAgICAgICAgICAgICAgICBTM0tleTogJ25ldy1rZXknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgVmVyc2lvbjI6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6VmVyc2lvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogeyBSZWY6ICdGdW5jJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICBleHBlY3QobW9ja0xhbWJkYUNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChQdWJsaXNoVmVyc2lvbkNvbW1hbmQsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgc2lsZW50VGVzdCgnaG90c3dhcHMgYSBWZXJzaW9uIGFuZCBhbiBBbGlhcyBpZiB0aGUgRnVuY3Rpb24gdGhleSBwb2ludCB0byBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja0xhbWJkYUNsaWVudC5vbihQdWJsaXNoVmVyc2lvbkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFZlcnNpb246ICd2MicsXG4gICAgfSk7XG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBDb2RlOiB7XG4gICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICBTM0tleTogJ2N1cnJlbnQta2V5JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgVmVyc2lvbjE6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OlZlcnNpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogeyBSZWY6ICdGdW5jJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIEFsaWFzOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpBbGlhcycsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7IFJlZjogJ0Z1bmMnIH0sXG4gICAgICAgICAgICBGdW5jdGlvblZlcnNpb246IHsgJ0ZuOjpHZXRBdHQnOiBbJ1ZlcnNpb24xJywgJ1ZlcnNpb24nXSB9LFxuICAgICAgICAgICAgTmFtZTogJ2RldicsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICB0ZW1wbGF0ZToge1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQ29kZToge1xuICAgICAgICAgICAgICAgIFMzQnVja2V0OiAnY3VycmVudC1idWNrZXQnLFxuICAgICAgICAgICAgICAgIFMzS2V5OiAnbmV3LWtleScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBWZXJzaW9uMjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpWZXJzaW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiB7IFJlZjogJ0Z1bmMnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQWxpYXM6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6QWxpYXMnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBGdW5jdGlvbk5hbWU6IHsgUmVmOiAnRnVuYycgfSxcbiAgICAgICAgICAgICAgRnVuY3Rpb25WZXJzaW9uOiB7ICdGbjo6R2V0QXR0JzogWydWZXJzaW9uMicsICdWZXJzaW9uJ10gfSxcbiAgICAgICAgICAgICAgTmFtZTogJ2RldicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrTGFtYmRhQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZUFsaWFzQ29tbWFuZCwge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgRnVuY3Rpb25WZXJzaW9uOiAndjInLFxuICAgICAgTmFtZTogJ2RldicsXG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXX0=