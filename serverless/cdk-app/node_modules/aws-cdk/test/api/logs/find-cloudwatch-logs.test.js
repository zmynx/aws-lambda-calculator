"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const find_cloudwatch_logs_1 = require("../../../lib/api/logs/find-cloudwatch-logs");
const util_1 = require("../../util");
const mock_sdk_1 = require("../../util/mock-sdk");
let sdk;
let logsMockSdkProvider;
beforeEach(() => {
    logsMockSdkProvider = new mock_sdk_1.MockSdkProvider();
    sdk = new mock_sdk_1.MockSdk();
    sdk.getUrlSuffix = () => Promise.resolve('amazonaws.com');
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    (0, mock_sdk_1.setDefaultSTSMocks)();
    jest.resetAllMocks();
    // clear the array
    currentCfnStackResources.splice(0);
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListStackResourcesCommand).callsFake((input) => {
        if (input.StackName !== STACK_NAME) {
            throw new Error(`Expected Stack name in listStackResources() call to be: '${STACK_NAME}', but received: ${input.StackName}'`);
        }
        return {
            StackResourceSummaries: currentCfnStackResources,
        };
    });
});
test('add log groups from lambda function', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'my-function',
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-function'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['/aws/lambda/my-function']);
});
test('add log groups from lambda function when using custom LoggingConfig', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'my-function',
                        LoggingConfig: {
                            LogGroup: '/this/custom/my-custom-log-group',
                        },
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-function'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['/this/custom/my-custom-log-group']);
});
test('add log groups from lambda function when using custom LoggingConfig using Ref', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                MyCustomLogGroupLogicalId: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: '/this/custom/my-custom-log-group',
                    },
                },
                Func: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        FunctionName: 'my-function',
                        LoggingConfig: {
                            LogGroup: {
                                Ref: 'MyCustomLogGroupLogicalId',
                            },
                        },
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-function'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['/this/custom/my-custom-log-group']);
});
test('add log groups from lambda function without physical name', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                Func: {
                    Type: 'AWS::Lambda::Function',
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('Func', 'AWS::Lambda::Function', 'my-function'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['/aws/lambda/my-function']);
});
test('empty template', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {},
    });
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual([]);
});
test('add log groups from ECS Task Definitions', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                LogGroup: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: 'log_group',
                    },
                },
                Def: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'app',
                        ContainerDefinitions: [
                            {
                                LogConfiguration: {
                                    LogDriver: 'awslogs',
                                    Options: {
                                        'awslogs-group': { Ref: 'LogGroup' },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('LogGroup', 'AWS::Logs::LogGroup', 'log_group'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['log_group']);
});
test('add log groups from State Machines', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                LogGroup: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: 'log_group',
                    },
                },
                Def: {
                    Type: 'AWS::StepFunctions::StateMachine',
                    Properties: {
                        LoggingConfiguration: {
                            Destinations: [
                                {
                                    CloudWatchLogsLogGroup: {
                                        LogGroupArn: {
                                            'Fn::GetAtt': ['LogGroup', 'Arn'],
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('LogGroup', 'AWS::Logs::LogGroup', 'log_group'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['log_group']);
});
test('excluded log groups are not added', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                LogGroup: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: 'log_group',
                    },
                },
                LogGroup2: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: 'log_group2',
                    },
                },
                Def: {
                    Type: 'AWS::CodeBuild::Project',
                    Properties: {
                        PojectName: 'project',
                        LogsConfig: {
                            CloudWatchLogs: {
                                GroupName: { Ref: 'LogGroup' },
                            },
                        },
                    },
                },
                FlowLog: {
                    Type: 'AWS::EC2::FlowLog',
                    Properties: {
                        LogDestination: { Ref: 'LogGroup' },
                    },
                },
                FlowLog2: {
                    Type: 'AWS::EC2::FlowLog',
                    Properties: {
                        LogDestination: {
                            'Fn::GetAtt': ['LogGroup2', 'Arn'],
                        },
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('LogGroup', 'AWS::Logs::LogGroup', 'log_group'));
    pushStackResourceSummaries(stackSummaryOf('LogGroup2', 'AWS::Logs::LogGroup', 'log_group2'));
    pushStackResourceSummaries(stackSummaryOf('FlowLog', 'AWS::EC2::FlowLog', 'flow_log'));
    pushStackResourceSummaries(stackSummaryOf('FlowLog2', 'AWS::EC2::FlowLog', 'flow_log2'));
    pushStackResourceSummaries(stackSummaryOf('Def', 'AWS::CodeBuild:Project', 'project'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual([]);
});
test('unassociated log groups are added', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                LogGroup: {
                    Type: 'AWS::Logs::LogGroup',
                    Properties: {
                        LogGroupName: 'log_group',
                    },
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('LogGroup', 'AWS::Logs::LogGroup', 'log_group'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['log_group']);
});
test('log groups without physical names are added', async () => {
    // GIVEN
    const cdkStackArtifact = cdkStackArtifactOf({
        template: {
            Resources: {
                LogGroup: {
                    Type: 'AWS::Logs::LogGroup',
                },
            },
        },
    });
    pushStackResourceSummaries(stackSummaryOf('LogGroup', 'AWS::Logs::LogGroup', 'log_group'));
    // WHEN
    const result = await (0, find_cloudwatch_logs_1.findCloudWatchLogGroups)(logsMockSdkProvider, cdkStackArtifact);
    // THEN
    expect(result.logGroupNames).toEqual(['log_group']);
});
const STACK_NAME = 'withouterrors';
const currentCfnStackResources = [];
function pushStackResourceSummaries(...items) {
    currentCfnStackResources.push(...items);
}
function stackSummaryOf(logicalId, resourceType, physicalResourceId) {
    return {
        LogicalResourceId: logicalId,
        PhysicalResourceId: physicalResourceId,
        ResourceType: resourceType,
        ResourceStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
        LastUpdatedTimestamp: new Date(),
    };
}
function cdkStackArtifactOf(testStackArtifact = {}) {
    return (0, util_1.testStack)({
        stackName: STACK_NAME,
        ...testStackArtifact,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZC1jbG91ZHdhdGNoLWxvZ3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImZpbmQtY2xvdWR3YXRjaC1sb2dzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSwwRUFLd0M7QUFFeEMscUZBQXFGO0FBQ3JGLHFDQUEwRDtBQUMxRCxrREFNNkI7QUFFN0IsSUFBSSxHQUFZLENBQUM7QUFDakIsSUFBSSxtQkFBZ0MsQ0FBQztBQUVyQyxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsbUJBQW1CLEdBQUcsSUFBSSwwQkFBZSxFQUFFLENBQUM7SUFDNUMsR0FBRyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO0lBQ3BCLEdBQUcsQ0FBQyxZQUFZLEdBQUcsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMxRCxJQUFBLG1DQUF3QixHQUFFLENBQUM7SUFDM0IsSUFBQSw2QkFBa0IsR0FBRSxDQUFDO0lBQ3JCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUNyQixrQkFBa0I7SUFDbEIsd0JBQXdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25DLG1DQUF3QixDQUFDLEVBQUUsQ0FBQyxpREFBeUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQXFDLEVBQUUsRUFBRTtRQUN6RyxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDbkMsTUFBTSxJQUFJLEtBQUssQ0FDYiw0REFBNEQsVUFBVSxvQkFBb0IsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUM3RyxDQUFDO1FBQ0osQ0FBQztRQUNELE9BQU87WUFDTCxzQkFBc0IsRUFBRSx3QkFBd0I7U0FDakQsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDckQsUUFBUTtJQUNS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QUUsWUFBWTtRQUMxQixjQUFjLEVBQUUsbUNBQVcsQ0FBQyxlQUFlO1FBQzNDLG9CQUFvQixFQUFFLElBQUksSUFBSSxFQUFFO0tBQ2pDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxvQkFBZ0QsRUFBRTtJQUM1RSxPQUFPLElBQUEsZ0JBQVMsRUFBQztRQUNmLFNBQVMsRUFBRSxVQUFVO1FBQ3JCLEdBQUcsaUJBQWlCO0tBQ3JCLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjeGFwaSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0IHtcbiAgTGlzdFN0YWNrUmVzb3VyY2VzQ29tbWFuZCxcbiAgTGlzdFN0YWNrUmVzb3VyY2VzQ29tbWFuZElucHV0LFxuICBTdGFja1Jlc291cmNlU3VtbWFyeSxcbiAgU3RhY2tTdGF0dXMsXG59IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBTZGtQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL2xpYic7XG5pbXBvcnQgeyBmaW5kQ2xvdWRXYXRjaExvZ0dyb3VwcyB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvbG9ncy9maW5kLWNsb3Vkd2F0Y2gtbG9ncyc7XG5pbXBvcnQgeyB0ZXN0U3RhY2ssIFRlc3RTdGFja0FydGlmYWN0IH0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge1xuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQsXG4gIE1vY2tTZGssXG4gIE1vY2tTZGtQcm92aWRlcixcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0LFxuICBzZXREZWZhdWx0U1RTTW9ja3MsXG59IGZyb20gJy4uLy4uL3V0aWwvbW9jay1zZGsnO1xuXG5sZXQgc2RrOiBNb2NrU2RrO1xubGV0IGxvZ3NNb2NrU2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyO1xuXG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgbG9nc01vY2tTZGtQcm92aWRlciA9IG5ldyBNb2NrU2RrUHJvdmlkZXIoKTtcbiAgc2RrID0gbmV3IE1vY2tTZGsoKTtcbiAgc2RrLmdldFVybFN1ZmZpeCA9ICgpID0+IFByb21pc2UucmVzb2x2ZSgnYW1hem9uYXdzLmNvbScpO1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgc2V0RGVmYXVsdFNUU01vY2tzKCk7XG4gIGplc3QucmVzZXRBbGxNb2NrcygpO1xuICAvLyBjbGVhciB0aGUgYXJyYXlcbiAgY3VycmVudENmblN0YWNrUmVzb3VyY2VzLnNwbGljZSgwKTtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKExpc3RTdGFja1Jlc291cmNlc0NvbW1hbmQpLmNhbGxzRmFrZSgoaW5wdXQ6IExpc3RTdGFja1Jlc291cmNlc0NvbW1hbmRJbnB1dCkgPT4ge1xuICAgIGlmIChpbnB1dC5TdGFja05hbWUgIT09IFNUQUNLX05BTUUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEV4cGVjdGVkIFN0YWNrIG5hbWUgaW4gbGlzdFN0YWNrUmVzb3VyY2VzKCkgY2FsbCB0byBiZTogJyR7U1RBQ0tfTkFNRX0nLCBidXQgcmVjZWl2ZWQ6ICR7aW5wdXQuU3RhY2tOYW1lfSdgLFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIFN0YWNrUmVzb3VyY2VTdW1tYXJpZXM6IGN1cnJlbnRDZm5TdGFja1Jlc291cmNlcyxcbiAgICB9O1xuICB9KTtcbn0pO1xuXG50ZXN0KCdhZGQgbG9nIGdyb3VwcyBmcm9tIGxhbWJkYSBmdW5jdGlvbicsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IGNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgdGVtcGxhdGU6IHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiAnbXktZnVuY3Rpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZnVuY3Rpb24nKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJy9hd3MvbGFtYmRhL215LWZ1bmN0aW9uJ10pO1xufSk7XG5cbnRlc3QoJ2FkZCBsb2cgZ3JvdXBzIGZyb20gbGFtYmRhIGZ1bmN0aW9uIHdoZW4gdXNpbmcgY3VzdG9tIExvZ2dpbmdDb25maWcnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBjZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgIHRlbXBsYXRlOiB7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgRnVuYzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIEZ1bmN0aW9uTmFtZTogJ215LWZ1bmN0aW9uJyxcbiAgICAgICAgICAgIExvZ2dpbmdDb25maWc6IHtcbiAgICAgICAgICAgICAgTG9nR3JvdXA6ICcvdGhpcy9jdXN0b20vbXktY3VzdG9tLWxvZy1ncm91cCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZnVuY3Rpb24nKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJy90aGlzL2N1c3RvbS9teS1jdXN0b20tbG9nLWdyb3VwJ10pO1xufSk7XG5cbnRlc3QoJ2FkZCBsb2cgZ3JvdXBzIGZyb20gbGFtYmRhIGZ1bmN0aW9uIHdoZW4gdXNpbmcgY3VzdG9tIExvZ2dpbmdDb25maWcgdXNpbmcgUmVmJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIE15Q3VzdG9tTG9nR3JvdXBMb2dpY2FsSWQ6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMb2dzOjpMb2dHcm91cCcsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgTG9nR3JvdXBOYW1lOiAnL3RoaXMvY3VzdG9tL215LWN1c3RvbS1sb2ctZ3JvdXAnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIEZ1bmM6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBGdW5jdGlvbk5hbWU6ICdteS1mdW5jdGlvbicsXG4gICAgICAgICAgICBMb2dnaW5nQ29uZmlnOiB7XG4gICAgICAgICAgICAgIExvZ0dyb3VwOiB7XG4gICAgICAgICAgICAgICAgUmVmOiAnTXlDdXN0b21Mb2dHcm91cExvZ2ljYWxJZCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZnVuY3Rpb24nKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJy90aGlzL2N1c3RvbS9teS1jdXN0b20tbG9nLWdyb3VwJ10pO1xufSk7XG5cbnRlc3QoJ2FkZCBsb2cgZ3JvdXBzIGZyb20gbGFtYmRhIGZ1bmN0aW9uIHdpdGhvdXQgcGh5c2ljYWwgbmFtZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IGNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgdGVtcGxhdGU6IHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBGdW5jOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignRnVuYycsICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCAnbXktZnVuY3Rpb24nKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJy9hd3MvbGFtYmRhL215LWZ1bmN0aW9uJ10pO1xufSk7XG5cbnRlc3QoJ2VtcHR5IHRlbXBsYXRlJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICB0ZW1wbGF0ZToge30sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmluZENsb3VkV2F0Y2hMb2dHcm91cHMobG9nc01vY2tTZGtQcm92aWRlciwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmVzdWx0LmxvZ0dyb3VwTmFtZXMpLnRvRXF1YWwoW10pO1xufSk7XG5cbnRlc3QoJ2FkZCBsb2cgZ3JvdXBzIGZyb20gRUNTIFRhc2sgRGVmaW5pdGlvbnMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBjZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgIHRlbXBsYXRlOiB7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTG9nR3JvdXA6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMb2dzOjpMb2dHcm91cCcsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgTG9nR3JvdXBOYW1lOiAnbG9nX2dyb3VwJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBEZWY6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBGYW1pbHk6ICdhcHAnLFxuICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIExvZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIExvZ0RyaXZlcjogJ2F3c2xvZ3MnLFxuICAgICAgICAgICAgICAgICAgT3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICAnYXdzbG9ncy1ncm91cCc6IHsgUmVmOiAnTG9nR3JvdXAnIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignTG9nR3JvdXAnLCAnQVdTOjpMb2dzOjpMb2dHcm91cCcsICdsb2dfZ3JvdXAnKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJ2xvZ19ncm91cCddKTtcbn0pO1xuXG50ZXN0KCdhZGQgbG9nIGdyb3VwcyBmcm9tIFN0YXRlIE1hY2hpbmVzJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIExvZ0dyb3VwOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TG9nczo6TG9nR3JvdXAnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIExvZ0dyb3VwTmFtZTogJ2xvZ19ncm91cCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgRGVmOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBMb2dnaW5nQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBDbG91ZFdhdGNoTG9nc0xvZ0dyb3VwOiB7XG4gICAgICAgICAgICAgICAgICAgIExvZ0dyb3VwQXJuOiB7XG4gICAgICAgICAgICAgICAgICAgICAgJ0ZuOjpHZXRBdHQnOiBbJ0xvZ0dyb3VwJywgJ0FybiddLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbiAgcHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoc3RhY2tTdW1tYXJ5T2YoJ0xvZ0dyb3VwJywgJ0FXUzo6TG9nczo6TG9nR3JvdXAnLCAnbG9nX2dyb3VwJykpO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmluZENsb3VkV2F0Y2hMb2dHcm91cHMobG9nc01vY2tTZGtQcm92aWRlciwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmVzdWx0LmxvZ0dyb3VwTmFtZXMpLnRvRXF1YWwoWydsb2dfZ3JvdXAnXSk7XG59KTtcblxudGVzdCgnZXhjbHVkZWQgbG9nIGdyb3VwcyBhcmUgbm90IGFkZGVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIExvZ0dyb3VwOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TG9nczo6TG9nR3JvdXAnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIExvZ0dyb3VwTmFtZTogJ2xvZ19ncm91cCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgTG9nR3JvdXAyOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TG9nczo6TG9nR3JvdXAnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIExvZ0dyb3VwTmFtZTogJ2xvZ19ncm91cDInLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIERlZjoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkNvZGVCdWlsZDo6UHJvamVjdCcsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgUG9qZWN0TmFtZTogJ3Byb2plY3QnLFxuICAgICAgICAgICAgTG9nc0NvbmZpZzoge1xuICAgICAgICAgICAgICBDbG91ZFdhdGNoTG9nczoge1xuICAgICAgICAgICAgICAgIEdyb3VwTmFtZTogeyBSZWY6ICdMb2dHcm91cCcgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgRmxvd0xvZzoge1xuICAgICAgICAgIFR5cGU6ICdBV1M6OkVDMjo6Rmxvd0xvZycsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgTG9nRGVzdGluYXRpb246IHsgUmVmOiAnTG9nR3JvdXAnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgRmxvd0xvZzI6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpFQzI6OkZsb3dMb2cnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIExvZ0Rlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgICAgICdGbjo6R2V0QXR0JzogWydMb2dHcm91cDInLCAnQXJuJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignTG9nR3JvdXAnLCAnQVdTOjpMb2dzOjpMb2dHcm91cCcsICdsb2dfZ3JvdXAnKSk7XG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKHN0YWNrU3VtbWFyeU9mKCdMb2dHcm91cDInLCAnQVdTOjpMb2dzOjpMb2dHcm91cCcsICdsb2dfZ3JvdXAyJykpO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignRmxvd0xvZycsICdBV1M6OkVDMjo6Rmxvd0xvZycsICdmbG93X2xvZycpKTtcbiAgcHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoc3RhY2tTdW1tYXJ5T2YoJ0Zsb3dMb2cyJywgJ0FXUzo6RUMyOjpGbG93TG9nJywgJ2Zsb3dfbG9nMicpKTtcbiAgcHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoc3RhY2tTdW1tYXJ5T2YoJ0RlZicsICdBV1M6OkNvZGVCdWlsZDpQcm9qZWN0JywgJ3Byb2plY3QnKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbXSk7XG59KTtcblxudGVzdCgndW5hc3NvY2lhdGVkIGxvZyBncm91cHMgYXJlIGFkZGVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICB0ZW1wbGF0ZToge1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIExvZ0dyb3VwOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6TG9nczo6TG9nR3JvdXAnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIExvZ0dyb3VwTmFtZTogJ2xvZ19ncm91cCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG4gIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKHN0YWNrU3VtbWFyeU9mKCdMb2dHcm91cCcsICdBV1M6OkxvZ3M6OkxvZ0dyb3VwJywgJ2xvZ19ncm91cCcpKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZpbmRDbG91ZFdhdGNoTG9nR3JvdXBzKGxvZ3NNb2NrU2RrUHJvdmlkZXIsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHJlc3VsdC5sb2dHcm91cE5hbWVzKS50b0VxdWFsKFsnbG9nX2dyb3VwJ10pO1xufSk7XG5cbnRlc3QoJ2xvZyBncm91cHMgd2l0aG91dCBwaHlzaWNhbCBuYW1lcyBhcmUgYWRkZWQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBjZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgIHRlbXBsYXRlOiB7XG4gICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgTG9nR3JvdXA6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpMb2dzOjpMb2dHcm91cCcsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0pO1xuICBwdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhzdGFja1N1bW1hcnlPZignTG9nR3JvdXAnLCAnQVdTOjpMb2dzOjpMb2dHcm91cCcsICdsb2dfZ3JvdXAnKSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmaW5kQ2xvdWRXYXRjaExvZ0dyb3Vwcyhsb2dzTW9ja1Nka1Byb3ZpZGVyLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQubG9nR3JvdXBOYW1lcykudG9FcXVhbChbJ2xvZ19ncm91cCddKTtcbn0pO1xuXG5jb25zdCBTVEFDS19OQU1FID0gJ3dpdGhvdXRlcnJvcnMnO1xuY29uc3QgY3VycmVudENmblN0YWNrUmVzb3VyY2VzOiBTdGFja1Jlc291cmNlU3VtbWFyeVtdID0gW107XG5cbmZ1bmN0aW9uIHB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKC4uLml0ZW1zOiBTdGFja1Jlc291cmNlU3VtbWFyeVtdKSB7XG4gIGN1cnJlbnRDZm5TdGFja1Jlc291cmNlcy5wdXNoKC4uLml0ZW1zKTtcbn1cblxuZnVuY3Rpb24gc3RhY2tTdW1tYXJ5T2YobG9naWNhbElkOiBzdHJpbmcsIHJlc291cmNlVHlwZTogc3RyaW5nLCBwaHlzaWNhbFJlc291cmNlSWQ6IHN0cmluZyk6IFN0YWNrUmVzb3VyY2VTdW1tYXJ5IHtcbiAgcmV0dXJuIHtcbiAgICBMb2dpY2FsUmVzb3VyY2VJZDogbG9naWNhbElkLFxuICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogcGh5c2ljYWxSZXNvdXJjZUlkLFxuICAgIFJlc291cmNlVHlwZTogcmVzb3VyY2VUeXBlLFxuICAgIFJlc291cmNlU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgTGFzdFVwZGF0ZWRUaW1lc3RhbXA6IG5ldyBEYXRlKCksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNka1N0YWNrQXJ0aWZhY3RPZih0ZXN0U3RhY2tBcnRpZmFjdDogUGFydGlhbDxUZXN0U3RhY2tBcnRpZmFjdD4gPSB7fSk6IGN4YXBpLkNsb3VkRm9ybWF0aW9uU3RhY2tBcnRpZmFjdCB7XG4gIHJldHVybiB0ZXN0U3RhY2soe1xuICAgIHN0YWNrTmFtZTogU1RBQ0tfTkFNRSxcbiAgICAuLi50ZXN0U3RhY2tBcnRpZmFjdCxcbiAgfSk7XG59XG4iXX0=