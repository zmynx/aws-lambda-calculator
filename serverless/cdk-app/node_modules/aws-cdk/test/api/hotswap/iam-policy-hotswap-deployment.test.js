"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('A change to an IAM Policy results in a full deployment for HOTSWAP and a noOp for HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                RoleOne: {
                    Type: 'AWS::IAM::Role',
                    Properties: {
                        AssumeRolePolicyDocument: {
                            Statement: [
                                {
                                    Action: 'sts:AssumeRole',
                                    Effect: 'Allow',
                                    Principal: {
                                        Service: 'sqs.amazonaws.com',
                                    },
                                },
                            ],
                            Version: '2012-10-17',
                        },
                    },
                },
                RoleDefaultPolicy: {
                    Type: 'AWS::IAM::Policy',
                    Properties: {
                        PolicyDocument: {
                            Statement: [
                                {
                                    Action: [
                                        'sqs:ChangeMessageVisibility',
                                        'sqs:DeleteMessage',
                                        'sqs:GetQueueAttributes',
                                        'sqs:GetQueueUrl',
                                        'sqs:ReceiveMessage',
                                    ],
                                    Effect: 'Allow',
                                    Resource: '*',
                                },
                            ],
                            Version: '2012-10-17',
                        },
                        PolicyName: 'roleDefaultPolicy',
                        Roles: [
                            {
                                Ref: 'RoleOne',
                            },
                        ],
                    },
                },
            },
        });
        setup.pushStackResourceSummaries({
            LogicalResourceId: 'RoleOne',
            PhysicalResourceId: 'RoleOne',
            ResourceType: 'AWS::IAM::Role',
            ResourceStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
            LastUpdatedTimestamp: new Date(),
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    RoleOne: {
                        Type: 'AWS::IAM::Role',
                        Properties: {
                            AssumeRolePolicyDocument: {
                                Statement: [
                                    {
                                        Action: 'sts:AssumeRole',
                                        Effect: 'Allow',
                                        Principal: {
                                            Service: 'sqs.amazonaws.com',
                                        },
                                    },
                                ],
                                Version: '2012-10-17',
                            },
                        },
                    },
                    RoleDefaultPolicy: {
                        Type: 'AWS::IAM::Policy',
                        Properties: {
                            PolicyDocument: {
                                Statement: [
                                    {
                                        Action: ['sqs:DeleteMessage'],
                                        Effect: 'Allow',
                                        Resource: '*',
                                    },
                                ],
                                Version: '2012-10-17',
                            },
                            PolicyName: 'roleDefaultPolicy',
                            Roles: [
                                {
                                    Ref: 'RoleOne',
                                },
                            ],
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
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(deployStackResult?.noOp).toEqual(true);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWFtLXBvbGljeS1ob3Rzd2FwLWRlcGxveW1lbnQudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImlhbS1wb2xpY3ktaG90c3dhcC1kZXBsb3ltZW50LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwwRUFBNkQ7QUFDN0QsOENBQThDO0FBQzlDLDREQUE4RDtBQUM5RCw4Q0FBK0M7QUFFL0MsSUFBSSxzQkFBb0QsQ0FBQztBQUV6RCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2Qsc0JBQXNCLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFDckQsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFDUixnR0FBZ0csRUFDaEcsS0FBSyxJQUFJLEVBQUU7UUFDVCxRQUFRO1FBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDO1lBQy9CLFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLGdCQUFnQjtvQkFDdEIsVUFBVSxFQUFFO3dCQUNWLHdCQUF3QixFQUFFOzRCQUN4QixTQUFTLEVBQUU7Z0NBQ1Q7b0NBQ0UsTUFBTSxFQUFFLGdCQUFnQjtvQ0FDeEIsTUFBTSxFQUFFLE9BQU87b0NBQ2YsU0FBUyxFQUFFO3dDQUNULE9BQU8sRUFBRSxtQkFBbUI7cUNBQzdCO2lDQUNGOzZCQUNGOzRCQUNELE9BQU8sRUFBRSxZQUFZO3lCQUN0QjtxQkFDRjtpQkFDRjtnQkFDRCxpQkFBaUIsRUFBRTtvQkFDakIsSUFBSSxFQUFFLGtCQUFrQjtvQkFDeEIsVUFBVSxFQUFFO3dCQUNWLGNBQWMsRUFBRTs0QkFDZCxTQUFTLEVBQUU7Z0NBQ1Q7b0NBQ0UsTUFBTSxFQUFFO3dDQUNOLDZCQUE2Qjt3Q0FDN0IsbUJBQW1CO3dDQUNuQix3QkFBd0I7d0NBQ3hCLGlCQUFpQjt3Q0FDakIsb0JBQW9CO3FDQUNyQjtvQ0FDRCxNQUFNLEVBQUUsT0FBTztvQ0FDZixRQUFRLEVBQUUsR0FBRztpQ0FDZDs2QkFDRjs0QkFDRCxPQUFPLEVBQUUsWUFBWTt5QkFDdEI7d0JBQ0QsVUFBVSxFQUFFLG1CQUFtQjt3QkFDL0IsS0FBSyxFQUFFOzRCQUNMO2dDQUNFLEdBQUcsRUFBRSxTQUFTOzZCQUNmO3lCQUNGO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxLQUFLLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsaUJBQWlCLEVBQUUsU0FBUztZQUM1QixrQkFBa0IsRUFBRSxTQUFTO1lBQzdCLFlBQVksRUFBRSxnQkFBZ0I7WUFDOUIsY0FBYyxFQUFFLG1DQUFXLENBQUMsZUFBZTtZQUMzQyxvQkFBb0IsRUFBRSxJQUFJLElBQUksRUFBRTtTQUNqQyxDQUFDLENBQUM7UUFDSCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztZQUNoRCxRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsZ0JBQWdCO3dCQUN0QixVQUFVLEVBQUU7NEJBQ1Ysd0JBQXdCLEVBQUU7Z0NBQ3hCLFNBQVMsRUFBRTtvQ0FDVDt3Q0FDRSxNQUFNLEVBQUUsZ0JBQWdCO3dDQUN4QixNQUFNLEVBQUUsT0FBTzt3Q0FDZixTQUFTLEVBQUU7NENBQ1QsT0FBTyxFQUFFLG1CQUFtQjt5Q0FDN0I7cUNBQ0Y7aUNBQ0Y7Z0NBQ0QsT0FBTyxFQUFFLFlBQVk7NkJBQ3RCO3lCQUNGO3FCQUNGO29CQUNELGlCQUFpQixFQUFFO3dCQUNqQixJQUFJLEVBQUUsa0JBQWtCO3dCQUN4QixVQUFVLEVBQUU7NEJBQ1YsY0FBYyxFQUFFO2dDQUNkLFNBQVMsRUFBRTtvQ0FDVDt3Q0FDRSxNQUFNLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQzt3Q0FDN0IsTUFBTSxFQUFFLE9BQU87d0NBQ2YsUUFBUSxFQUFFLEdBQUc7cUNBQ2Q7aUNBQ0Y7Z0NBQ0QsT0FBTyxFQUFFLFlBQVk7NkJBQ3RCOzRCQUNELFVBQVUsRUFBRSxtQkFBbUI7NEJBQy9CLEtBQUssRUFBRTtnQ0FDTDtvQ0FDRSxHQUFHLEVBQUUsU0FBUztpQ0FDZjs2QkFDRjt5QkFDRjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUMxQyxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUM1QyxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssb0JBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwRCxPQUFPO1lBQ1AsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTNHLE9BQU87WUFDUCxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDOUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRCxDQUFDO0lBQ0gsQ0FBQyxDQUNGLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrU3RhdHVzIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3VkZm9ybWF0aW9uJztcbmltcG9ydCAqIGFzIHNldHVwIGZyb20gJy4vaG90c3dhcC10ZXN0LXNldHVwJztcbmltcG9ydCB7IEhvdHN3YXBNb2RlIH0gZnJvbSAnLi4vLi4vLi4vbGliL2FwaS9ob3Rzd2FwL2NvbW1vbic7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBUZXN0cygpO1xufSk7XG5cbmRlc2NyaWJlLmVhY2goW0hvdHN3YXBNb2RlLkZBTExfQkFDSywgSG90c3dhcE1vZGUuSE9UU1dBUF9PTkxZXSkoJyVwIG1vZGUnLCAoaG90c3dhcE1vZGUpID0+IHtcbiAgc2lsZW50VGVzdChcbiAgICAnQSBjaGFuZ2UgdG8gYW4gSUFNIFBvbGljeSByZXN1bHRzIGluIGEgZnVsbCBkZXBsb3ltZW50IGZvciBIT1RTV0FQIGFuZCBhIG5vT3AgZm9yIEhPVFNXQVBfT05MWScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgUm9sZU9uZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6SUFNOjpSb2xlJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgQXNzdW1lUm9sZVBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIEFjdGlvbjogJ3N0czpBc3N1bWVSb2xlJyxcbiAgICAgICAgICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgICAgICAgICBQcmluY2lwYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgICBTZXJ2aWNlOiAnc3FzLmFtYXpvbmF3cy5jb20nLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBSb2xlRGVmYXVsdFBvbGljeToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6SUFNOjpQb2xpY3knLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICAgIFN0YXRlbWVudDogW1xuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBBY3Rpb246IFtcbiAgICAgICAgICAgICAgICAgICAgICAnc3FzOkNoYW5nZU1lc3NhZ2VWaXNpYmlsaXR5JyxcbiAgICAgICAgICAgICAgICAgICAgICAnc3FzOkRlbGV0ZU1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgICAgICAgICdzcXM6R2V0UXVldWVBdHRyaWJ1dGVzJyxcbiAgICAgICAgICAgICAgICAgICAgICAnc3FzOkdldFF1ZXVlVXJsJyxcbiAgICAgICAgICAgICAgICAgICAgICAnc3FzOlJlY2VpdmVNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgICAgICAgICBSZXNvdXJjZTogJyonLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgUG9saWN5TmFtZTogJ3JvbGVEZWZhdWx0UG9saWN5JyxcbiAgICAgICAgICAgICAgUm9sZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBSZWY6ICdSb2xlT25lJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyh7XG4gICAgICAgIExvZ2ljYWxSZXNvdXJjZUlkOiAnUm9sZU9uZScsXG4gICAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogJ1JvbGVPbmUnLFxuICAgICAgICBSZXNvdXJjZVR5cGU6ICdBV1M6OklBTTo6Um9sZScsXG4gICAgICAgIFJlc291cmNlU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIExhc3RVcGRhdGVkVGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIFJvbGVPbmU6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6SUFNOjpSb2xlJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBBY3Rpb246ICdzdHM6QXNzdW1lUm9sZScsXG4gICAgICAgICAgICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgICAgICAgICAgIFByaW5jaXBhbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgU2VydmljZTogJ3Nxcy5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFJvbGVEZWZhdWx0UG9saWN5OiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OklBTTo6UG9saWN5JyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIFBvbGljeURvY3VtZW50OiB7XG4gICAgICAgICAgICAgICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIEFjdGlvbjogWydzcXM6RGVsZXRlTWVzc2FnZSddLFxuICAgICAgICAgICAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgICAgICAgICAgICBSZXNvdXJjZTogJyonLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIFZlcnNpb246ICcyMDEyLTEwLTE3JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFBvbGljeU5hbWU6ICdyb2xlRGVmYXVsdFBvbGljeScsXG4gICAgICAgICAgICAgICAgUm9sZXM6IFtcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgUmVmOiAnUm9sZU9uZScsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5GQUxMX0JBQ0spIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS50b0JlVW5kZWZpbmVkKCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQ/Lm5vT3ApLnRvRXF1YWwodHJ1ZSk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcbn0pO1xuIl19