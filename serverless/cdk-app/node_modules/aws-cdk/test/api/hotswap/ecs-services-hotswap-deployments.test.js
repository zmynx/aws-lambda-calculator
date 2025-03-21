"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ecs_1 = require("@aws-sdk/client-ecs");
const setup = require("./hotswap-test-setup");
const common_1 = require("../../../lib/api/hotswap/common");
const settings_1 = require("../../../lib/settings");
const mock_sdk_1 = require("../../util/mock-sdk");
const silent_1 = require("../../util/silent");
let hotswapMockSdkProvider;
beforeEach(() => {
    hotswapMockSdkProvider = setup.setupHotswapTests();
    mock_sdk_1.mockECSClient
        .on(client_ecs_1.UpdateServiceCommand)
        .resolves({
        service: {
            clusterArn: 'arn:aws:ecs:region:account:service/my-cluster',
            serviceArn: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
        },
    })
        .on(client_ecs_1.DescribeServicesCommand)
        .resolves({
        services: [
            {
                deployments: [
                    {
                        desiredCount: 1,
                        runningCount: 1,
                    },
                ],
            },
        ],
    });
});
describe.each([common_1.HotswapMode.FALL_BACK, common_1.HotswapMode.HOTSWAP_ONLY])('%p mode', (hotswapMode) => {
    (0, silent_1.silentTest)('should call registerTaskDefinition and updateService for a difference only in the TaskDefinition with a Family property', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [{ Image: 'image1' }],
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [{ Image: 'image2' }],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
            family: 'my-task-def',
            containerDefinitions: [{ image: 'image2' }],
        });
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
            service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
            cluster: 'my-cluster',
            taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            deploymentConfiguration: {
                minimumHealthyPercent: 0,
            },
            forceNewDeployment: true,
        });
    });
    (0, silent_1.silentTest)('any other TaskDefinition property change besides ContainerDefinition cannot be hotswapped in CLASSIC mode but does not block HOTSWAP_ONLY mode deployments', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [{ Image: 'image1' }],
                        Cpu: '256',
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [{ Image: 'image2' }],
                            Cpu: '512',
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
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
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.RegisterTaskDefinitionCommand);
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.UpdateServiceCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
                family: 'my-task-def',
                containerDefinitions: [{ image: 'image2' }],
                cpu: '256', // this uses the old value because a new value could cause a service replacement
            });
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
                service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
                cluster: 'my-cluster',
                taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
                deploymentConfiguration: {
                    minimumHealthyPercent: 0,
                },
                forceNewDeployment: true,
            });
        }
    });
    (0, silent_1.silentTest)('deleting any other TaskDefinition property besides ContainerDefinition results in a full deployment in CLASSIC mode and a hotswap deployment in HOTSWAP_ONLY mode', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [{ Image: 'image1' }],
                        Cpu: '256',
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [{ Image: 'image2' }],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
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
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.RegisterTaskDefinitionCommand);
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.UpdateServiceCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
                family: 'my-task-def',
                containerDefinitions: [{ image: 'image2' }],
                cpu: '256', // this uses the old value because a new value could cause a service replacement
            });
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
                service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
                cluster: 'my-cluster',
                taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
                deploymentConfiguration: {
                    minimumHealthyPercent: 0,
                },
                forceNewDeployment: true,
            });
        }
    });
    (0, silent_1.silentTest)('should call registerTaskDefinition and updateService for a difference only in the TaskDefinition without a Family property', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        ContainerDefinitions: [{ Image: 'image1' }],
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('TaskDef', 'AWS::ECS::TaskDefinition', 'arn:aws:ecs:region:account:task-definition/my-task-def:2'), setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            ContainerDefinitions: [{ Image: 'image2' }],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
            family: 'my-task-def',
            containerDefinitions: [{ image: 'image2' }],
        });
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
            service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
            cluster: 'my-cluster',
            taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            deploymentConfiguration: {
                minimumHealthyPercent: 0,
            },
            forceNewDeployment: true,
        });
    });
    (0, silent_1.silentTest)('a difference just in a TaskDefinition, without any services using it, is not hotswappable in FALL_BACK mode', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        ContainerDefinitions: [{ Image: 'image1' }],
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('TaskDef', 'AWS::ECS::TaskDefinition', 'arn:aws:ecs:region:account:task-definition/my-task-def:2'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            ContainerDefinitions: [{ Image: 'image2' }],
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
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.RegisterTaskDefinitionCommand);
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.UpdateServiceCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
                family: 'my-task-def',
                containerDefinitions: [{ image: 'image2' }],
            });
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.UpdateServiceCommand);
        }
    });
    (0, silent_1.silentTest)('if anything besides an ECS Service references the changed TaskDefinition, hotswapping is not possible in CLASSIC mode but is possible in HOTSWAP_ONLY', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [{ Image: 'image1' }],
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
                Function: {
                    Type: 'AWS::Lambda::Function',
                    Properties: {
                        Environment: {
                            Variables: {
                                TaskDefRevArn: { Ref: 'TaskDef' },
                            },
                        },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [{ Image: 'image2' }],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
                        },
                    },
                    Function: {
                        Type: 'AWS::Lambda::Function',
                        Properties: {
                            Environment: {
                                Variables: {
                                    TaskDefRevArn: { Ref: 'TaskDef' },
                                },
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
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.RegisterTaskDefinitionCommand);
            expect(mock_sdk_1.mockECSClient).not.toHaveReceivedCommand(client_ecs_1.UpdateServiceCommand);
        }
        else if (hotswapMode === common_1.HotswapMode.HOTSWAP_ONLY) {
            // WHEN
            const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
            // THEN
            expect(deployStackResult).not.toBeUndefined();
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
                family: 'my-task-def',
                containerDefinitions: [{ image: 'image2' }],
            });
            expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
                service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
                cluster: 'my-cluster',
                taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
                deploymentConfiguration: {
                    minimumHealthyPercent: 0,
                },
                forceNewDeployment: true,
            });
        }
    });
    (0, silent_1.silentTest)('should call registerTaskDefinition with certain properties not lowercased', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [{ Image: 'image1' }],
                        Volumes: [
                            {
                                DockerVolumeConfiguration: {
                                    DriverOpts: { Option1: 'option1' },
                                    Labels: { Label1: 'label1' },
                                },
                            },
                        ],
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [
                                {
                                    Image: 'image2',
                                    DockerLabels: { Label1: 'label1' },
                                    FirelensConfiguration: {
                                        Options: { Name: 'cloudwatch' },
                                    },
                                    LogConfiguration: {
                                        Options: { Option1: 'option1' },
                                    },
                                },
                            ],
                            Volumes: [
                                {
                                    DockerVolumeConfiguration: {
                                        DriverOpts: { Option1: 'option1' },
                                        Labels: { Label1: 'label1' },
                                    },
                                },
                            ],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
                        },
                    },
                },
            },
        });
        // WHEN
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(hotswapMode, cdkStackArtifact);
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
            family: 'my-task-def',
            containerDefinitions: [
                {
                    image: 'image2',
                    dockerLabels: { Label1: 'label1' },
                    firelensConfiguration: {
                        options: {
                            Name: 'cloudwatch',
                        },
                    },
                    logConfiguration: {
                        options: { Option1: 'option1' },
                    },
                },
            ],
            volumes: [
                {
                    dockerVolumeConfiguration: {
                        driverOpts: { Option1: 'option1' },
                        labels: { Label1: 'label1' },
                    },
                },
            ],
        });
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
            service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
            cluster: 'my-cluster',
            taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            deploymentConfiguration: {
                minimumHealthyPercent: 0,
            },
            forceNewDeployment: true,
        });
    });
});
describe.each([
    new settings_1.Configuration().settings.set(['hotswap'], { ecs: { minimumHealthyPercent: 10 } }),
    new settings_1.Configuration().settings.set(['hotswap'], { ecs: { minimumHealthyPercent: 10, maximumHealthyPercent: 100 } }),
])('hotswap properties', (settings) => {
    test('should handle all possible hotswap properties', async () => {
        // GIVEN
        setup.setCurrentCfnStackTemplate({
            Resources: {
                TaskDef: {
                    Type: 'AWS::ECS::TaskDefinition',
                    Properties: {
                        Family: 'my-task-def',
                        ContainerDefinitions: [
                            { Image: 'image1' },
                        ],
                    },
                },
                Service: {
                    Type: 'AWS::ECS::Service',
                    Properties: {
                        TaskDefinition: { Ref: 'TaskDef' },
                    },
                },
            },
        });
        setup.pushStackResourceSummaries(setup.stackSummaryOf('Service', 'AWS::ECS::Service', 'arn:aws:ecs:region:account:service/my-cluster/my-service'));
        mock_sdk_1.mockECSClient.on(client_ecs_1.RegisterTaskDefinitionCommand).resolves({
            taskDefinition: {
                taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            },
        });
        const cdkStackArtifact = setup.cdkStackArtifactOf({
            template: {
                Resources: {
                    TaskDef: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: 'my-task-def',
                            ContainerDefinitions: [
                                { Image: 'image2' },
                            ],
                        },
                    },
                    Service: {
                        Type: 'AWS::ECS::Service',
                        Properties: {
                            TaskDefinition: { Ref: 'TaskDef' },
                        },
                    },
                },
            },
        });
        // WHEN
        let ecsHotswapProperties = new common_1.EcsHotswapProperties(settings.get(['hotswap']).ecs.minimumHealthyPercent, settings.get(['hotswap']).ecs.maximumHealthyPercent);
        const deployStackResult = await hotswapMockSdkProvider.tryHotswapDeployment(common_1.HotswapMode.HOTSWAP_ONLY, cdkStackArtifact, {}, new common_1.HotswapPropertyOverrides(ecsHotswapProperties));
        // THEN
        expect(deployStackResult).not.toBeUndefined();
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.RegisterTaskDefinitionCommand, {
            family: 'my-task-def',
            containerDefinitions: [
                { image: 'image2' },
            ],
        });
        expect(mock_sdk_1.mockECSClient).toHaveReceivedCommandWith(client_ecs_1.UpdateServiceCommand, {
            service: 'arn:aws:ecs:region:account:service/my-cluster/my-service',
            cluster: 'my-cluster',
            taskDefinition: 'arn:aws:ecs:region:account:task-definition/my-task-def:3',
            deploymentConfiguration: {
                minimumHealthyPercent: settings.get(['hotswap']).ecs?.minimumHealthyPercent == undefined ?
                    0 : settings.get(['hotswap']).ecs?.minimumHealthyPercent,
                maximumPercent: settings.get(['hotswap']).ecs?.maximumHealthyPercent,
            },
            forceNewDeployment: true,
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXNlcnZpY2VzLWhvdHN3YXAtZGVwbG95bWVudHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVjcy1zZXJ2aWNlcy1ob3Rzd2FwLWRlcGxveW1lbnRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxvREFBbUg7QUFDbkgsOENBQThDO0FBQzlDLDREQUE4RztBQUM5RyxvREFBc0Q7QUFDdEQsa0RBQW9EO0FBQ3BELDhDQUErQztBQUUvQyxJQUFJLHNCQUFvRCxDQUFDO0FBRXpELFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxzQkFBc0IsR0FBRyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUNuRCx3QkFBYTtTQUNWLEVBQUUsQ0FBQyxpQ0FBb0IsQ0FBQztTQUN4QixRQUFRLENBQUM7UUFDUixPQUFPLEVBQUU7WUFDUCxVQUFVLEVBQUUsK0NBQStDO1lBQzNELFVBQVUsRUFBRSwwREFBMEQ7U0FDdkU7S0FDRixDQUFDO1NBQ0QsRUFBRSxDQUFDLG9DQUF1QixDQUFDO1NBQzNCLFFBQVEsQ0FBQztRQUNSLFFBQVEsRUFBRTtZQUNSO2dCQUNFLFdBQVcsRUFBRTtvQkFDWDt3QkFDRSxZQUFZLEVBQUUsQ0FBQzt3QkFDZixZQUFZLEVBQUUsQ0FBQztxQkFDaEI7aUJBQ0Y7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQVcsQ0FBQyxTQUFTLEVBQUUsb0JBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO0lBQzFGLElBQUEsbUJBQVUsRUFDUix5SEFBeUgsRUFDekgsS0FBSyxJQUFJLEVBQUU7UUFDVCxRQUFRO1FBQ1IsS0FBSyxDQUFDLDBCQUEwQixDQUFDO1lBQy9CLFNBQVMsRUFBRTtnQkFDVCxPQUFPLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLDBCQUEwQjtv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LGFBQWE7WUFDckIsb0JBQW9CLEVBQUU7Z0JBQ3BCLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTthQUNwQjtTQUNGLENBQUMsQ0FBQztRQUNILE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMseUJBQXlCLENBQUMsaUNBQW9CLEVBQUU7WUFDcEUsT0FBTyxFQUFFLDBEQUEwRDtZQUNuRSxPQUFPLEVBQUUsWUFBWTtZQUNyQixjQUFjLEVBQUUsMERBQTBEO1lBQzFFLHVCQUF1QixFQUFFO2dCQUN2QixxQkFBcUIsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUscUJBQXFCLElBQUksU0FBUyxDQUFDLENBQUM7b0JBQ3hGLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLHFCQUFxQjtnQkFDMUQsY0FBYyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxxQkFBcUI7YUFDckU7WUFDRCxrQkFBa0IsRUFBRSxJQUFJO1NBQ3pCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZXNjcmliZVNlcnZpY2VzQ29tbWFuZCwgUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQsIFVwZGF0ZVNlcnZpY2VDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWVjcyc7XG5pbXBvcnQgKiBhcyBzZXR1cCBmcm9tICcuL2hvdHN3YXAtdGVzdC1zZXR1cCc7XG5pbXBvcnQgeyBFY3NIb3Rzd2FwUHJvcGVydGllcywgSG90c3dhcE1vZGUsIEhvdHN3YXBQcm9wZXJ0eU92ZXJyaWRlcyB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvaG90c3dhcC9jb21tb24nO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2xpYi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBtb2NrRUNTQ2xpZW50IH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBzaWxlbnRUZXN0IH0gZnJvbSAnLi4vLi4vdXRpbC9zaWxlbnQnO1xuXG5sZXQgaG90c3dhcE1vY2tTZGtQcm92aWRlcjogc2V0dXAuSG90c3dhcE1vY2tTZGtQcm92aWRlcjtcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIgPSBzZXR1cC5zZXR1cEhvdHN3YXBUZXN0cygpO1xuICBtb2NrRUNTQ2xpZW50XG4gICAgLm9uKFVwZGF0ZVNlcnZpY2VDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBzZXJ2aWNlOiB7XG4gICAgICAgIGNsdXN0ZXJBcm46ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXInLFxuICAgICAgICBzZXJ2aWNlQXJuOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6c2VydmljZS9teS1jbHVzdGVyL215LXNlcnZpY2UnLFxuICAgICAgfSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVNlcnZpY2VzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgc2VydmljZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGRlcGxveW1lbnRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGRlc2lyZWRDb3VudDogMSxcbiAgICAgICAgICAgICAgcnVubmluZ0NvdW50OiAxLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbn0pO1xuXG5kZXNjcmliZS5lYWNoKFtIb3Rzd2FwTW9kZS5GQUxMX0JBQ0ssIEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWV0pKCclcCBtb2RlJywgKGhvdHN3YXBNb2RlKSA9PiB7XG4gIHNpbGVudFRlc3QoXG4gICAgJ3Nob3VsZCBjYWxsIHJlZ2lzdGVyVGFza0RlZmluaXRpb24gYW5kIHVwZGF0ZVNlcnZpY2UgZm9yIGEgZGlmZmVyZW5jZSBvbmx5IGluIHRoZSBUYXNrRGVmaW5pdGlvbiB3aXRoIGEgRmFtaWx5IHByb3BlcnR5JyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW3sgSW1hZ2U6ICdpbWFnZTEnIH1dLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFNlcnZpY2U6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRhc2tEZWZpbml0aW9uOiB7IFJlZjogJ1Rhc2tEZWYnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6c2VydmljZS9teS1jbHVzdGVyL215LXNlcnZpY2UnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIG1vY2tFQ1NDbGllbnQub24oUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgdGFza0RlZmluaXRpb246IHtcbiAgICAgICAgICB0YXNrRGVmaW5pdGlvbkFybjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgRmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgICAgICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBbeyBJbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgU2VydmljZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGFza0RlZmluaXRpb246IHsgUmVmOiAnVGFza0RlZicgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBXSEVOXG4gICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAvLyBUSEVOXG4gICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCwge1xuICAgICAgICBmYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICAgIGNvbnRhaW5lckRlZmluaXRpb25zOiBbeyBpbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICB9KTtcblxuICAgICAgZXhwZWN0KG1vY2tFQ1NDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU2VydmljZUNvbW1hbmQsIHtcbiAgICAgICAgc2VydmljZTogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnNlcnZpY2UvbXktY2x1c3Rlci9teS1zZXJ2aWNlJyxcbiAgICAgICAgY2x1c3RlcjogJ215LWNsdXN0ZXInLFxuICAgICAgICB0YXNrRGVmaW5pdGlvbjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgICAgZGVwbG95bWVudENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBtaW5pbXVtSGVhbHRoeVBlcmNlbnQ6IDAsXG4gICAgICAgIH0sXG4gICAgICAgIGZvcmNlTmV3RGVwbG95bWVudDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnYW55IG90aGVyIFRhc2tEZWZpbml0aW9uIHByb3BlcnR5IGNoYW5nZSBiZXNpZGVzIENvbnRhaW5lckRlZmluaXRpb24gY2Fubm90IGJlIGhvdHN3YXBwZWQgaW4gQ0xBU1NJQyBtb2RlIGJ1dCBkb2VzIG5vdCBibG9jayBIT1RTV0FQX09OTFkgbW9kZSBkZXBsb3ltZW50cycsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgVGFza0RlZjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEZhbWlseTogJ215LXRhc2stZGVmJyxcbiAgICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFt7IEltYWdlOiAnaW1hZ2UxJyB9XSxcbiAgICAgICAgICAgICAgQ3B1OiAnMjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBTZXJ2aWNlOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUYXNrRGVmaW5pdGlvbjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ1NlcnZpY2UnLFxuICAgICAgICAgICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnNlcnZpY2UvbXktY2x1c3Rlci9teS1zZXJ2aWNlJyxcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgICBtb2NrRUNTQ2xpZW50Lm9uKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICAgIHRhc2tEZWZpbml0aW9uOiB7XG4gICAgICAgICAgdGFza0RlZmluaXRpb25Bcm46ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDp0YXNrLWRlZmluaXRpb24vbXktdGFzay1kZWY6MycsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgICAgVGFza0RlZjoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEZhbWlseTogJ215LXRhc2stZGVmJyxcbiAgICAgICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW3sgSW1hZ2U6ICdpbWFnZTInIH1dLFxuICAgICAgICAgICAgICAgIENwdTogJzUxMicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgU2VydmljZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGFza0RlZmluaXRpb246IHsgUmVmOiAnVGFza0RlZicgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkZBTExfQkFDSykge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KG1vY2tFQ1NDbGllbnQpLm5vdC50b0hhdmVSZWNlaXZlZENvbW1hbmQoUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQpO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChVcGRhdGVTZXJ2aWNlQ29tbWFuZCk7XG4gICAgICB9IGVsc2UgaWYgKGhvdHN3YXBNb2RlID09PSBIb3Rzd2FwTW9kZS5IT1RTV0FQX09OTFkpIHtcbiAgICAgICAgLy8gV0hFTlxuICAgICAgICBjb25zdCBkZXBsb3lTdGFja1Jlc3VsdCA9IGF3YWl0IGhvdHN3YXBNb2NrU2RrUHJvdmlkZXIudHJ5SG90c3dhcERlcGxveW1lbnQoaG90c3dhcE1vZGUsIGNka1N0YWNrQXJ0aWZhY3QpO1xuXG4gICAgICAgIC8vIFRIRU5cbiAgICAgICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCwge1xuICAgICAgICAgIGZhbWlseTogJ215LXRhc2stZGVmJyxcbiAgICAgICAgICBjb250YWluZXJEZWZpbml0aW9uczogW3sgaW1hZ2U6ICdpbWFnZTInIH1dLFxuICAgICAgICAgIGNwdTogJzI1NicsIC8vIHRoaXMgdXNlcyB0aGUgb2xkIHZhbHVlIGJlY2F1c2UgYSBuZXcgdmFsdWUgY291bGQgY2F1c2UgYSBzZXJ2aWNlIHJlcGxhY2VtZW50XG4gICAgICAgIH0pO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVTZXJ2aWNlQ29tbWFuZCwge1xuICAgICAgICAgIHNlcnZpY2U6ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXIvbXktc2VydmljZScsXG4gICAgICAgICAgY2x1c3RlcjogJ215LWNsdXN0ZXInLFxuICAgICAgICAgIHRhc2tEZWZpbml0aW9uOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgICAgIGRlcGxveW1lbnRDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBtaW5pbXVtSGVhbHRoeVBlcmNlbnQ6IDAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JjZU5ld0RlcGxveW1lbnQ6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnZGVsZXRpbmcgYW55IG90aGVyIFRhc2tEZWZpbml0aW9uIHByb3BlcnR5IGJlc2lkZXMgQ29udGFpbmVyRGVmaW5pdGlvbiByZXN1bHRzIGluIGEgZnVsbCBkZXBsb3ltZW50IGluIENMQVNTSUMgbW9kZSBhbmQgYSBob3Rzd2FwIGRlcGxveW1lbnQgaW4gSE9UU1dBUF9PTkxZIG1vZGUnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBGYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICAgICAgICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBbeyBJbWFnZTogJ2ltYWdlMScgfV0sXG4gICAgICAgICAgICAgIENwdTogJzI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgU2VydmljZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGFza0RlZmluaXRpb246IHsgUmVmOiAnVGFza0RlZicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXIvbXktc2VydmljZScsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgbW9ja0VDU0NsaWVudC5vbihSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgICB0YXNrRGVmaW5pdGlvbjoge1xuICAgICAgICAgIHRhc2tEZWZpbml0aW9uQXJuOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBGYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFt7IEltYWdlOiAnaW1hZ2UyJyB9XSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBTZXJ2aWNlOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBUYXNrRGVmaW5pdGlvbjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVNlcnZpY2VDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICAgICAgZmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgIGNvbnRhaW5lckRlZmluaXRpb25zOiBbeyBpbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICAgICAgY3B1OiAnMjU2JywgLy8gdGhpcyB1c2VzIHRoZSBvbGQgdmFsdWUgYmVjYXVzZSBhIG5ldyB2YWx1ZSBjb3VsZCBjYXVzZSBhIHNlcnZpY2UgcmVwbGFjZW1lbnRcbiAgICAgICAgfSk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFVwZGF0ZVNlcnZpY2VDb21tYW5kLCB7XG4gICAgICAgICAgc2VydmljZTogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnNlcnZpY2UvbXktY2x1c3Rlci9teS1zZXJ2aWNlJyxcbiAgICAgICAgICBjbHVzdGVyOiAnbXktY2x1c3RlcicsXG4gICAgICAgICAgdGFza0RlZmluaXRpb246ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDp0YXNrLWRlZmluaXRpb24vbXktdGFzay1kZWY6MycsXG4gICAgICAgICAgZGVwbG95bWVudENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgIG1pbmltdW1IZWFsdGh5UGVyY2VudDogMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGZvcmNlTmV3RGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcbiAgKTtcblxuICBzaWxlbnRUZXN0KFxuICAgICdzaG91bGQgY2FsbCByZWdpc3RlclRhc2tEZWZpbml0aW9uIGFuZCB1cGRhdGVTZXJ2aWNlIGZvciBhIGRpZmZlcmVuY2Ugb25seSBpbiB0aGUgVGFza0RlZmluaXRpb24gd2l0aG91dCBhIEZhbWlseSBwcm9wZXJ0eScsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gR0lWRU5cbiAgICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgVGFza0RlZjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBbeyBJbWFnZTogJ2ltYWdlMScgfV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgU2VydmljZToge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgVGFza0RlZmluaXRpb246IHsgUmVmOiAnVGFza0RlZicgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICAgIHNldHVwLnN0YWNrU3VtbWFyeU9mKFxuICAgICAgICAgICdUYXNrRGVmJyxcbiAgICAgICAgICAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjInLFxuICAgICAgICApLFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6c2VydmljZS9teS1jbHVzdGVyL215LXNlcnZpY2UnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIG1vY2tFQ1NDbGllbnQub24oUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgdGFza0RlZmluaXRpb246IHtcbiAgICAgICAgICB0YXNrRGVmaW5pdGlvbkFybjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFt7IEltYWdlOiAnaW1hZ2UyJyB9XSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBTZXJ2aWNlOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBUYXNrRGVmaW5pdGlvbjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFdIRU5cbiAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgIC8vIFRIRU5cbiAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkubm90LnRvQmVVbmRlZmluZWQoKTtcbiAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICAgIGZhbWlseTogJ215LXRhc2stZGVmJyxcbiAgICAgICAgY29udGFpbmVyRGVmaW5pdGlvbnM6IFt7IGltYWdlOiAnaW1hZ2UyJyB9XSxcbiAgICAgIH0pO1xuICAgICAgZXhwZWN0KG1vY2tFQ1NDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU2VydmljZUNvbW1hbmQsIHtcbiAgICAgICAgc2VydmljZTogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnNlcnZpY2UvbXktY2x1c3Rlci9teS1zZXJ2aWNlJyxcbiAgICAgICAgY2x1c3RlcjogJ215LWNsdXN0ZXInLFxuICAgICAgICB0YXNrRGVmaW5pdGlvbjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgICAgZGVwbG95bWVudENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBtaW5pbXVtSGVhbHRoeVBlcmNlbnQ6IDAsXG4gICAgICAgIH0sXG4gICAgICAgIGZvcmNlTmV3RGVwbG95bWVudDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdChcbiAgICAnYSBkaWZmZXJlbmNlIGp1c3QgaW4gYSBUYXNrRGVmaW5pdGlvbiwgd2l0aG91dCBhbnkgc2VydmljZXMgdXNpbmcgaXQsIGlzIG5vdCBob3Rzd2FwcGFibGUgaW4gRkFMTF9CQUNLIG1vZGUnLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIC8vIEdJVkVOXG4gICAgICBzZXR1cC5zZXRDdXJyZW50Q2ZuU3RhY2tUZW1wbGF0ZSh7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW3sgSW1hZ2U6ICdpbWFnZTEnIH1dLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzZXR1cC5wdXNoU3RhY2tSZXNvdXJjZVN1bW1hcmllcyhcbiAgICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoXG4gICAgICAgICAgJ1Rhc2tEZWYnLFxuICAgICAgICAgICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDp0YXNrLWRlZmluaXRpb24vbXktdGFzay1kZWY6MicsXG4gICAgICAgICksXG4gICAgICApO1xuICAgICAgbW9ja0VDU0NsaWVudC5vbihSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgICB0YXNrRGVmaW5pdGlvbjoge1xuICAgICAgICAgIHRhc2tEZWZpbml0aW9uQXJuOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW3sgSW1hZ2U6ICdpbWFnZTInIH1dLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVNlcnZpY2VDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICAgICAgZmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgIGNvbnRhaW5lckRlZmluaXRpb25zOiBbeyBpbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVNlcnZpY2VDb21tYW5kKTtcbiAgICAgIH1cbiAgICB9LFxuICApO1xuXG4gIHNpbGVudFRlc3QoXG4gICAgJ2lmIGFueXRoaW5nIGJlc2lkZXMgYW4gRUNTIFNlcnZpY2UgcmVmZXJlbmNlcyB0aGUgY2hhbmdlZCBUYXNrRGVmaW5pdGlvbiwgaG90c3dhcHBpbmcgaXMgbm90IHBvc3NpYmxlIGluIENMQVNTSUMgbW9kZSBidXQgaXMgcG9zc2libGUgaW4gSE9UU1dBUF9PTkxZJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBHSVZFTlxuICAgICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgICBSZXNvdXJjZXM6IHtcbiAgICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgRmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW3sgSW1hZ2U6ICdpbWFnZTEnIH1dLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFNlcnZpY2U6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRhc2tEZWZpbml0aW9uOiB7IFJlZjogJ1Rhc2tEZWYnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgRnVuY3Rpb246IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBFbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgICAgICAgVGFza0RlZlJldkFybjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZihcbiAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6c2VydmljZS9teS1jbHVzdGVyL215LXNlcnZpY2UnLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIG1vY2tFQ1NDbGllbnQub24oUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgdGFza0RlZmluaXRpb246IHtcbiAgICAgICAgICB0YXNrRGVmaW5pdGlvbkFybjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgY2RrU3RhY2tBcnRpZmFjdCA9IHNldHVwLmNka1N0YWNrQXJ0aWZhY3RPZih7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgRmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgICAgICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBbeyBJbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgU2VydmljZToge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgVGFza0RlZmluaXRpb246IHsgUmVmOiAnVGFza0RlZicgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBGdW5jdGlvbjoge1xuICAgICAgICAgICAgICBUeXBlOiAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIEVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgVGFza0RlZlJldkFybjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChob3Rzd2FwTW9kZSA9PT0gSG90c3dhcE1vZGUuRkFMTF9CQUNLKSB7XG4gICAgICAgIC8vIFdIRU5cbiAgICAgICAgY29uc3QgZGVwbG95U3RhY2tSZXN1bHQgPSBhd2FpdCBob3Rzd2FwTW9ja1Nka1Byb3ZpZGVyLnRyeUhvdHN3YXBEZXBsb3ltZW50KGhvdHN3YXBNb2RlLCBjZGtTdGFja0FydGlmYWN0KTtcblxuICAgICAgICAvLyBUSEVOXG4gICAgICAgIGV4cGVjdChkZXBsb3lTdGFja1Jlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kKFVwZGF0ZVNlcnZpY2VDb21tYW5kKTtcbiAgICAgIH0gZWxzZSBpZiAoaG90c3dhcE1vZGUgPT09IEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSkge1xuICAgICAgICAvLyBXSEVOXG4gICAgICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAgICAgLy8gVEhFTlxuICAgICAgICBleHBlY3QoZGVwbG95U3RhY2tSZXN1bHQpLm5vdC50b0JlVW5kZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICAgICAgZmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgIGNvbnRhaW5lckRlZmluaXRpb25zOiBbeyBpbWFnZTogJ2ltYWdlMicgfV0sXG4gICAgICAgIH0pO1xuICAgICAgICBleHBlY3QobW9ja0VDU0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVTZXJ2aWNlQ29tbWFuZCwge1xuICAgICAgICAgIHNlcnZpY2U6ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXIvbXktc2VydmljZScsXG4gICAgICAgICAgY2x1c3RlcjogJ215LWNsdXN0ZXInLFxuICAgICAgICAgIHRhc2tEZWZpbml0aW9uOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgICAgIGRlcGxveW1lbnRDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBtaW5pbXVtSGVhbHRoeVBlcmNlbnQ6IDAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBmb3JjZU5ld0RlcGxveW1lbnQ6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICk7XG5cbiAgc2lsZW50VGVzdCgnc2hvdWxkIGNhbGwgcmVnaXN0ZXJUYXNrRGVmaW5pdGlvbiB3aXRoIGNlcnRhaW4gcHJvcGVydGllcyBub3QgbG93ZXJjYXNlZCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIHNldHVwLnNldEN1cnJlbnRDZm5TdGFja1RlbXBsYXRlKHtcbiAgICAgIFJlc291cmNlczoge1xuICAgICAgICBUYXNrRGVmOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgRmFtaWx5OiAnbXktdGFzay1kZWYnLFxuICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFt7IEltYWdlOiAnaW1hZ2UxJyB9XSxcbiAgICAgICAgICAgIFZvbHVtZXM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIERvY2tlclZvbHVtZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIERyaXZlck9wdHM6IHsgT3B0aW9uMTogJ29wdGlvbjEnIH0sXG4gICAgICAgICAgICAgICAgICBMYWJlbHM6IHsgTGFiZWwxOiAnbGFiZWwxJyB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFNlcnZpY2U6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgIFByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIFRhc2tEZWZpbml0aW9uOiB7IFJlZjogJ1Rhc2tEZWYnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgc2V0dXAucHVzaFN0YWNrUmVzb3VyY2VTdW1tYXJpZXMoXG4gICAgICBzZXR1cC5zdGFja1N1bW1hcnlPZignU2VydmljZScsICdBV1M6OkVDUzo6U2VydmljZScsICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXIvbXktc2VydmljZScpLFxuICAgICk7XG4gICAgbW9ja0VDU0NsaWVudC5vbihSZWdpc3RlclRhc2tEZWZpbml0aW9uQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgdGFza0RlZmluaXRpb246IHtcbiAgICAgICAgdGFza0RlZmluaXRpb25Bcm46ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDp0YXNrLWRlZmluaXRpb24vbXktdGFzay1kZWY6MycsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNvbnN0IGNka1N0YWNrQXJ0aWZhY3QgPSBzZXR1cC5jZGtTdGFja0FydGlmYWN0T2Yoe1xuICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgICAgVGFza0RlZjoge1xuICAgICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpUYXNrRGVmaW5pdGlvbicsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIEZhbWlseTogJ215LXRhc2stZGVmJyxcbiAgICAgICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBJbWFnZTogJ2ltYWdlMicsXG4gICAgICAgICAgICAgICAgICBEb2NrZXJMYWJlbHM6IHsgTGFiZWwxOiAnbGFiZWwxJyB9LFxuICAgICAgICAgICAgICAgICAgRmlyZWxlbnNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIE9wdGlvbnM6IHsgTmFtZTogJ2Nsb3Vkd2F0Y2gnIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgTG9nQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBPcHRpb25zOiB7IE9wdGlvbjE6ICdvcHRpb24xJyB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBWb2x1bWVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgRG9ja2VyVm9sdW1lQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBEcml2ZXJPcHRzOiB7IE9wdGlvbjE6ICdvcHRpb24xJyB9LFxuICAgICAgICAgICAgICAgICAgICBMYWJlbHM6IHsgTGFiZWwxOiAnbGFiZWwxJyB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFNlcnZpY2U6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6U2VydmljZScsXG4gICAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIFRhc2tEZWZpbml0aW9uOiB7IFJlZjogJ1Rhc2tEZWYnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChob3Rzd2FwTW9kZSwgY2RrU3RhY2tBcnRpZmFjdCk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICBmYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICBjb250YWluZXJEZWZpbml0aW9uczogW1xuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2U6ICdpbWFnZTInLFxuICAgICAgICAgIGRvY2tlckxhYmVsczogeyBMYWJlbDE6ICdsYWJlbDEnIH0sXG4gICAgICAgICAgZmlyZWxlbnNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIE5hbWU6ICdjbG91ZHdhdGNoJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBsb2dDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBvcHRpb25zOiB7IE9wdGlvbjE6ICdvcHRpb24xJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgdm9sdW1lczogW1xuICAgICAgICB7XG4gICAgICAgICAgZG9ja2VyVm9sdW1lQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgZHJpdmVyT3B0czogeyBPcHRpb24xOiAnb3B0aW9uMScgfSxcbiAgICAgICAgICAgIGxhYmVsczogeyBMYWJlbDE6ICdsYWJlbDEnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tFQ1NDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoVXBkYXRlU2VydmljZUNvbW1hbmQsIHtcbiAgICAgIHNlcnZpY2U6ICdhcm46YXdzOmVjczpyZWdpb246YWNjb3VudDpzZXJ2aWNlL215LWNsdXN0ZXIvbXktc2VydmljZScsXG4gICAgICBjbHVzdGVyOiAnbXktY2x1c3RlcicsXG4gICAgICB0YXNrRGVmaW5pdGlvbjogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi9teS10YXNrLWRlZjozJyxcbiAgICAgIGRlcGxveW1lbnRDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIG1pbmltdW1IZWFsdGh5UGVyY2VudDogMCxcbiAgICAgIH0sXG4gICAgICBmb3JjZU5ld0RlcGxveW1lbnQ6IHRydWUsXG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlLmVhY2goW1xuICBuZXcgQ29uZmlndXJhdGlvbigpLnNldHRpbmdzLnNldChbJ2hvdHN3YXAnXSwgeyBlY3M6IHsgbWluaW11bUhlYWx0aHlQZXJjZW50OiAxMCB9IH0pLFxuICBuZXcgQ29uZmlndXJhdGlvbigpLnNldHRpbmdzLnNldChbJ2hvdHN3YXAnXSwgeyBlY3M6IHsgbWluaW11bUhlYWx0aHlQZXJjZW50OiAxMCwgbWF4aW11bUhlYWx0aHlQZXJjZW50OiAxMDAgfSB9KSxcbl0pKCdob3Rzd2FwIHByb3BlcnRpZXMnLCAoc2V0dGluZ3MpID0+IHtcbiAgdGVzdCgnc2hvdWxkIGhhbmRsZSBhbGwgcG9zc2libGUgaG90c3dhcCBwcm9wZXJ0aWVzJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgc2V0dXAuc2V0Q3VycmVudENmblN0YWNrVGVtcGxhdGUoe1xuICAgICAgUmVzb3VyY2VzOiB7XG4gICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlRhc2tEZWZpbml0aW9uJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBGYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICAgICAgICBDb250YWluZXJEZWZpbml0aW9uczogW1xuICAgICAgICAgICAgICB7IEltYWdlOiAnaW1hZ2UxJyB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBTZXJ2aWNlOiB7XG4gICAgICAgICAgVHlwZTogJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgICAgICAgICBQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBUYXNrRGVmaW5pdGlvbjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHNldHVwLnB1c2hTdGFja1Jlc291cmNlU3VtbWFyaWVzKFxuICAgICAgc2V0dXAuc3RhY2tTdW1tYXJ5T2YoJ1NlcnZpY2UnLCAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6c2VydmljZS9teS1jbHVzdGVyL215LXNlcnZpY2UnKSxcbiAgICApO1xuICAgIG1vY2tFQ1NDbGllbnQub24oUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIHRhc2tEZWZpbml0aW9uOiB7XG4gICAgICAgIHRhc2tEZWZpbml0aW9uQXJuOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjb25zdCBjZGtTdGFja0FydGlmYWN0ID0gc2V0dXAuY2RrU3RhY2tBcnRpZmFjdE9mKHtcbiAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgIFJlc291cmNlczoge1xuICAgICAgICAgIFRhc2tEZWY6IHtcbiAgICAgICAgICAgIFR5cGU6ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBGYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICAgICAgICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBbXG4gICAgICAgICAgICAgICAgeyBJbWFnZTogJ2ltYWdlMicgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBTZXJ2aWNlOiB7XG4gICAgICAgICAgICBUeXBlOiAnQVdTOjpFQ1M6OlNlcnZpY2UnLFxuICAgICAgICAgICAgUHJvcGVydGllczoge1xuICAgICAgICAgICAgICBUYXNrRGVmaW5pdGlvbjogeyBSZWY6ICdUYXNrRGVmJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFdIRU5cbiAgICBsZXQgZWNzSG90c3dhcFByb3BlcnRpZXMgPSBuZXcgRWNzSG90c3dhcFByb3BlcnRpZXMoc2V0dGluZ3MuZ2V0KFsnaG90c3dhcCddKS5lY3MubWluaW11bUhlYWx0aHlQZXJjZW50LCBzZXR0aW5ncy5nZXQoWydob3Rzd2FwJ10pLmVjcy5tYXhpbXVtSGVhbHRoeVBlcmNlbnQpO1xuICAgIGNvbnN0IGRlcGxveVN0YWNrUmVzdWx0ID0gYXdhaXQgaG90c3dhcE1vY2tTZGtQcm92aWRlci50cnlIb3Rzd2FwRGVwbG95bWVudChcbiAgICAgIEhvdHN3YXBNb2RlLkhPVFNXQVBfT05MWSxcbiAgICAgIGNka1N0YWNrQXJ0aWZhY3QsXG4gICAgICB7fSxcbiAgICAgIG5ldyBIb3Rzd2FwUHJvcGVydHlPdmVycmlkZXMoZWNzSG90c3dhcFByb3BlcnRpZXMpLFxuICAgICk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KGRlcGxveVN0YWNrUmVzdWx0KS5ub3QudG9CZVVuZGVmaW5lZCgpO1xuICAgIGV4cGVjdChtb2NrRUNTQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFJlZ2lzdGVyVGFza0RlZmluaXRpb25Db21tYW5kLCB7XG4gICAgICBmYW1pbHk6ICdteS10YXNrLWRlZicsXG4gICAgICBjb250YWluZXJEZWZpbml0aW9uczogW1xuICAgICAgICB7IGltYWdlOiAnaW1hZ2UyJyB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0VDU0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVTZXJ2aWNlQ29tbWFuZCwge1xuICAgICAgc2VydmljZTogJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnNlcnZpY2UvbXktY2x1c3Rlci9teS1zZXJ2aWNlJyxcbiAgICAgIGNsdXN0ZXI6ICdteS1jbHVzdGVyJyxcbiAgICAgIHRhc2tEZWZpbml0aW9uOiAnYXJuOmF3czplY3M6cmVnaW9uOmFjY291bnQ6dGFzay1kZWZpbml0aW9uL215LXRhc2stZGVmOjMnLFxuICAgICAgZGVwbG95bWVudENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgbWluaW11bUhlYWx0aHlQZXJjZW50OiBzZXR0aW5ncy5nZXQoWydob3Rzd2FwJ10pLmVjcz8ubWluaW11bUhlYWx0aHlQZXJjZW50ID09IHVuZGVmaW5lZCA/XG4gICAgICAgICAgMCA6IHNldHRpbmdzLmdldChbJ2hvdHN3YXAnXSkuZWNzPy5taW5pbXVtSGVhbHRoeVBlcmNlbnQsXG4gICAgICAgIG1heGltdW1QZXJjZW50OiBzZXR0aW5ncy5nZXQoWydob3Rzd2FwJ10pLmVjcz8ubWF4aW11bUhlYWx0aHlQZXJjZW50LFxuICAgICAgfSxcbiAgICAgIGZvcmNlTmV3RGVwbG95bWVudDogdHJ1ZSxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==