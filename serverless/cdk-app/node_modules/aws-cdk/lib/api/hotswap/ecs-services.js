"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHotswappableEcsServiceChange = isHotswappableEcsServiceChange;
const common_1 = require("./common");
async function isHotswappableEcsServiceChange(logicalId, change, evaluateCfnTemplate, hotswapPropertyOverrides) {
    // the only resource change we can evaluate here is an ECS TaskDefinition
    if (change.newValue.Type !== 'AWS::ECS::TaskDefinition') {
        return [];
    }
    const ret = [];
    // We only allow a change in the ContainerDefinitions of the TaskDefinition for now -
    // it contains the image and environment variables, so seems like a safe bet for now.
    // We might revisit this decision in the future though!
    const classifiedChanges = (0, common_1.classifyChanges)(change, ['ContainerDefinitions']);
    classifiedChanges.reportNonHotswappablePropertyChanges(ret);
    // find all ECS Services that reference the TaskDefinition that changed
    const resourcesReferencingTaskDef = evaluateCfnTemplate.findReferencesTo(logicalId);
    const ecsServiceResourcesReferencingTaskDef = resourcesReferencingTaskDef.filter((r) => r.Type === 'AWS::ECS::Service');
    const ecsServicesReferencingTaskDef = new Array();
    for (const ecsServiceResource of ecsServiceResourcesReferencingTaskDef) {
        const serviceArn = await evaluateCfnTemplate.findPhysicalNameFor(ecsServiceResource.LogicalId);
        if (serviceArn) {
            ecsServicesReferencingTaskDef.push({ serviceArn });
        }
    }
    if (ecsServicesReferencingTaskDef.length === 0) {
        // if there are no resources referencing the TaskDefinition,
        // hotswap is not possible in FALL_BACK mode
        (0, common_1.reportNonHotswappableChange)(ret, change, undefined, 'No ECS services reference the changed task definition', false);
    }
    if (resourcesReferencingTaskDef.length > ecsServicesReferencingTaskDef.length) {
        // if something besides an ECS Service is referencing the TaskDefinition,
        // hotswap is not possible in FALL_BACK mode
        const nonEcsServiceTaskDefRefs = resourcesReferencingTaskDef.filter((r) => r.Type !== 'AWS::ECS::Service');
        for (const taskRef of nonEcsServiceTaskDefRefs) {
            (0, common_1.reportNonHotswappableChange)(ret, change, undefined, `A resource '${taskRef.LogicalId}' with Type '${taskRef.Type}' that is not an ECS Service was found referencing the changed TaskDefinition '${logicalId}'`);
        }
    }
    const namesOfHotswappableChanges = Object.keys(classifiedChanges.hotswappableProps);
    if (namesOfHotswappableChanges.length > 0) {
        const taskDefinitionResource = await prepareTaskDefinitionChange(evaluateCfnTemplate, logicalId, change);
        ret.push({
            hotswappable: true,
            resourceType: change.newValue.Type,
            propsChanged: namesOfHotswappableChanges,
            service: 'ecs-service',
            resourceNames: [
                `ECS Task Definition '${await taskDefinitionResource.Family}'`,
                ...ecsServicesReferencingTaskDef.map((ecsService) => `ECS Service '${ecsService.serviceArn.split('/')[2]}'`),
            ],
            apply: async (sdk) => {
                // Step 1 - update the changed TaskDefinition, creating a new TaskDefinition Revision
                // we need to lowercase the evaluated TaskDef from CloudFormation,
                // as the AWS SDK uses lowercase property names for these
                // The SDK requires more properties here than its worth doing explicit typing for
                // instead, just use all the old values in the diff to fill them in implicitly
                const lowercasedTaskDef = (0, common_1.transformObjectKeys)(taskDefinitionResource, common_1.lowerCaseFirstCharacter, {
                    // All the properties that take arbitrary string as keys i.e. { "string" : "string" }
                    // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_RegisterTaskDefinition.html#API_RegisterTaskDefinition_RequestSyntax
                    ContainerDefinitions: {
                        DockerLabels: true,
                        FirelensConfiguration: {
                            Options: true,
                        },
                        LogConfiguration: {
                            Options: true,
                        },
                    },
                    Volumes: {
                        DockerVolumeConfiguration: {
                            DriverOpts: true,
                            Labels: true,
                        },
                    },
                });
                const registerTaskDefResponse = await sdk.ecs().registerTaskDefinition(lowercasedTaskDef);
                const taskDefRevArn = registerTaskDefResponse.taskDefinition?.taskDefinitionArn;
                let ecsHotswapProperties = hotswapPropertyOverrides.ecsHotswapProperties;
                let minimumHealthyPercent = ecsHotswapProperties?.minimumHealthyPercent;
                let maximumHealthyPercent = ecsHotswapProperties?.maximumHealthyPercent;
                // Step 2 - update the services using that TaskDefinition to point to the new TaskDefinition Revision
                // Forcing New Deployment and setting Minimum Healthy Percent to 0.
                // As CDK HotSwap is development only, this seems the most efficient way to ensure all tasks are replaced immediately, regardless of original amount
                // eslint-disable-next-line @cdklabs/promiseall-no-unbounded-parallelism
                await Promise.all(ecsServicesReferencingTaskDef.map(async (service) => {
                    const cluster = service.serviceArn.split('/')[1];
                    const update = await sdk.ecs().updateService({
                        service: service.serviceArn,
                        taskDefinition: taskDefRevArn,
                        cluster,
                        forceNewDeployment: true,
                        deploymentConfiguration: {
                            minimumHealthyPercent: minimumHealthyPercent !== undefined ? minimumHealthyPercent : 0,
                            maximumPercent: maximumHealthyPercent !== undefined ? maximumHealthyPercent : undefined,
                        },
                    });
                    await sdk.ecs().waitUntilServicesStable({
                        cluster: update.service?.clusterArn,
                        services: [service.serviceArn],
                    });
                }));
            },
        });
    }
    return ret;
}
async function prepareTaskDefinitionChange(evaluateCfnTemplate, logicalId, change) {
    const taskDefinitionResource = {
        ...change.oldValue.Properties,
        ContainerDefinitions: change.newValue.Properties?.ContainerDefinitions,
    };
    // first, let's get the name of the family
    const familyNameOrArn = await evaluateCfnTemplate.establishResourcePhysicalName(logicalId, taskDefinitionResource?.Family);
    if (!familyNameOrArn) {
        // if the Family property has not been provided, and we can't find it in the current Stack,
        // this means hotswapping is not possible
        return;
    }
    // the physical name of the Task Definition in CloudFormation includes its current revision number at the end,
    // remove it if needed
    const familyNameOrArnParts = familyNameOrArn.split(':');
    const family = familyNameOrArnParts.length > 1
        ? // familyNameOrArn is actually an ARN, of the format 'arn:aws:ecs:region:account:task-definition/<family-name>:<revision-nr>'
            // so, take the 6th element, at index 5, and split it on '/'
            familyNameOrArnParts[5].split('/')[1]
        : // otherwise, familyNameOrArn is just the simple name evaluated from the CloudFormation template
            familyNameOrArn;
    // then, let's evaluate the body of the remainder of the TaskDef (without the Family property)
    return {
        ...(await evaluateCfnTemplate.evaluateCfnExpression({
            ...(taskDefinitionResource ?? {}),
            Family: undefined,
        })),
        Family: family,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXNlcnZpY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWNzLXNlcnZpY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBV0Esd0VBNEhDO0FBdklELHFDQU9rQjtBQUlYLEtBQUssVUFBVSw4QkFBOEIsQ0FDbEQsU0FBaUIsRUFDakIsTUFBbUMsRUFDbkMsbUJBQW1ELEVBQ25ELHdCQUFrRDtJQUVsRCx5RUFBeUU7SUFDekUsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSywwQkFBMEIsRUFBRSxDQUFDO1FBQ3hELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE1BQU0sR0FBRyxHQUF3QixFQUFFLENBQUM7SUFFcEMscUZBQXFGO0lBQ3JGLHFGQUFxRjtJQUNyRix1REFBdUQ7SUFDdkQsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHdCQUFlLEVBQUMsTUFBTSxFQUFFLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO0lBQzVFLGlCQUFpQixDQUFDLG9DQUFvQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTVELHVFQUF1RTtJQUN2RSxNQUFNLDJCQUEyQixHQUFHLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3BGLE1BQU0scUNBQXFDLEdBQUcsMkJBQTJCLENBQUMsTUFBTSxDQUM5RSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxtQkFBbUIsQ0FDdEMsQ0FBQztJQUNGLE1BQU0sNkJBQTZCLEdBQUcsSUFBSSxLQUFLLEVBQWMsQ0FBQztJQUM5RCxLQUFLLE1BQU0sa0JBQWtCLElBQUkscUNBQXFDLEVBQUUsQ0FBQztRQUN2RSxNQUFNLFVBQVUsR0FBRyxNQUFNLG1CQUFtQixDQUFDLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9GLElBQUksVUFBVSxFQUFFLENBQUM7WUFDZiw2QkFBNkIsQ0FBQyxJQUFJLENBQUMs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bUM7SUFFbkMsTUFBTSxzQkFBc0IsR0FBNEI7UUFDdEQsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVU7UUFDN0Isb0JBQW9CLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsb0JBQW9CO0tBQ3ZFLENBQUM7SUFDRiwwQ0FBMEM7SUFDMUMsTUFBTSxlQUFlLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyw2QkFBNkIsQ0FDN0UsU0FBUyxFQUNULHNCQUFzQixFQUFFLE1BQU0sQ0FDL0IsQ0FBQztJQUNGLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNyQiwyRkFBMkY7UUFDM0YseUNBQXlDO1FBQ3pDLE9BQU87SUFDVCxDQUFDO0lBQ0QsOEdBQThHO0lBQzlHLHNCQUFzQjtJQUN0QixNQUFNLG9CQUFvQixHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEQsTUFBTSxNQUFNLEdBQ1Ysb0JBQW9CLENBQUMsTUFBTSxHQUFHLENBQUM7UUFDN0IsQ0FBQyxDQUFDLDZIQUE2SDtZQUNqSSw0REFBNEQ7WUFDMUQsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsZ0dBQWdHO1lBQ2xHLGVBQWUsQ0FBQztJQUNwQiw4RkFBOEY7SUFDOUYsT0FBTztRQUNMLEdBQUcsQ0FBQyxNQUFNLG1CQUFtQixDQUFDLHFCQUFxQixDQUFDO1lBQ2xELEdBQUcsQ0FBQyxzQkFBc0IsSUFBSSxFQUFFLENBQUM7WUFDakMsTUFBTSxFQUFFLFNBQVM7U0FDbEIsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxFQUFFLE1BQU07S0FDZixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIHR5cGUgQ2hhbmdlSG90c3dhcFJlc3VsdCxcbiAgY2xhc3NpZnlDaGFuZ2VzLFxuICB0eXBlIEhvdHN3YXBwYWJsZUNoYW5nZUNhbmRpZGF0ZSxcbiAgSG90c3dhcFByb3BlcnR5T3ZlcnJpZGVzLCBsb3dlckNhc2VGaXJzdENoYXJhY3RlcixcbiAgcmVwb3J0Tm9uSG90c3dhcHBhYmxlQ2hhbmdlLFxuICB0cmFuc2Zvcm1PYmplY3RLZXlzLFxufSBmcm9tICcuL2NvbW1vbic7XG5pbXBvcnQgdHlwZSB7IFNESyB9IGZyb20gJy4uL2F3cy1hdXRoJztcbmltcG9ydCB0eXBlIHsgRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlIH0gZnJvbSAnLi4vZXZhbHVhdGUtY2xvdWRmb3JtYXRpb24tdGVtcGxhdGUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNIb3Rzd2FwcGFibGVFY3NTZXJ2aWNlQ2hhbmdlKFxuICBsb2dpY2FsSWQ6IHN0cmluZyxcbiAgY2hhbmdlOiBIb3Rzd2FwcGFibGVDaGFuZ2VDYW5kaWRhdGUsXG4gIGV2YWx1YXRlQ2ZuVGVtcGxhdGU6IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSxcbiAgaG90c3dhcFByb3BlcnR5T3ZlcnJpZGVzOiBIb3Rzd2FwUHJvcGVydHlPdmVycmlkZXMsXG4pOiBQcm9taXNlPENoYW5nZUhvdHN3YXBSZXN1bHQ+IHtcbiAgLy8gdGhlIG9ubHkgcmVzb3VyY2UgY2hhbmdlIHdlIGNhbiBldmFsdWF0ZSBoZXJlIGlzIGFuIEVDUyBUYXNrRGVmaW5pdGlvblxuICBpZiAoY2hhbmdlLm5ld1ZhbHVlLlR5cGUgIT09ICdBV1M6OkVDUzo6VGFza0RlZmluaXRpb24nKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgY29uc3QgcmV0OiBDaGFuZ2VIb3Rzd2FwUmVzdWx0ID0gW107XG5cbiAgLy8gV2Ugb25seSBhbGxvdyBhIGNoYW5nZSBpbiB0aGUgQ29udGFpbmVyRGVmaW5pdGlvbnMgb2YgdGhlIFRhc2tEZWZpbml0aW9uIGZvciBub3cgLVxuICAvLyBpdCBjb250YWlucyB0aGUgaW1hZ2UgYW5kIGVudmlyb25tZW50IHZhcmlhYmxlcywgc28gc2VlbXMgbGlrZSBhIHNhZmUgYmV0IGZvciBub3cuXG4gIC8vIFdlIG1pZ2h0IHJldmlzaXQgdGhpcyBkZWNpc2lvbiBpbiB0aGUgZnV0dXJlIHRob3VnaCFcbiAgY29uc3QgY2xhc3NpZmllZENoYW5nZXMgPSBjbGFzc2lmeUNoYW5nZXMoY2hhbmdlLCBbJ0NvbnRhaW5lckRlZmluaXRpb25zJ10pO1xuICBjbGFzc2lmaWVkQ2hhbmdlcy5yZXBvcnROb25Ib3Rzd2FwcGFibGVQcm9wZXJ0eUNoYW5nZXMocmV0KTtcblxuICAvLyBmaW5kIGFsbCBFQ1MgU2VydmljZXMgdGhhdCByZWZlcmVuY2UgdGhlIFRhc2tEZWZpbml0aW9uIHRoYXQgY2hhbmdlZFxuICBjb25zdCByZXNvdXJjZXNSZWZlcmVuY2luZ1Rhc2tEZWYgPSBldmFsdWF0ZUNmblRlbXBsYXRlLmZpbmRSZWZlcmVuY2VzVG8obG9naWNhbElkKTtcbiAgY29uc3QgZWNzU2VydmljZVJlc291cmNlc1JlZmVyZW5jaW5nVGFza0RlZiA9IHJlc291cmNlc1JlZmVyZW5jaW5nVGFza0RlZi5maWx0ZXIoXG4gICAgKHIpID0+IHIuVHlwZSA9PT0gJ0FXUzo6RUNTOjpTZXJ2aWNlJyxcbiAgKTtcbiAgY29uc3QgZWNzU2VydmljZXNSZWZlcmVuY2luZ1Rhc2tEZWYgPSBuZXcgQXJyYXk8RWNzU2VydmljZT4oKTtcbiAgZm9yIChjb25zdCBlY3NTZXJ2aWNlUmVzb3VyY2Ugb2YgZWNzU2VydmljZVJlc291cmNlc1JlZmVyZW5jaW5nVGFza0RlZikge1xuICAgIGNvbnN0IHNlcnZpY2VBcm4gPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmZpbmRQaHlzaWNhbE5hbWVGb3IoZWNzU2VydmljZVJlc291cmNlLkxvZ2ljYWxJZCk7XG4gICAgaWYgKHNlcnZpY2VBcm4pIHtcbiAgICAgIGVjc1NlcnZpY2VzUmVmZXJlbmNpbmdUYXNrRGVmLnB1c2goeyBzZXJ2aWNlQXJuIH0pO1xuICAgIH1cbiAgfVxuICBpZiAoZWNzU2VydmljZXNSZWZlcmVuY2luZ1Rhc2tEZWYubGVuZ3RoID09PSAwKSB7XG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIHJlc291cmNlcyByZWZlcmVuY2luZyB0aGUgVGFza0RlZmluaXRpb24sXG4gICAgLy8gaG90c3dhcCBpcyBub3QgcG9zc2libGUgaW4gRkFMTF9CQUNLIG1vZGVcbiAgICByZXBvcnROb25Ib3Rzd2FwcGFibGVDaGFuZ2UocmV0LCBjaGFuZ2UsIHVuZGVmaW5lZCwgJ05vIEVDUyBzZXJ2aWNlcyByZWZlcmVuY2UgdGhlIGNoYW5nZWQgdGFzayBkZWZpbml0aW9uJywgZmFsc2UpO1xuICB9XG4gIGlmIChyZXNvdXJjZXNSZWZlcmVuY2luZ1Rhc2tEZWYubGVuZ3RoID4gZWNzU2VydmljZXNSZWZlcmVuY2luZ1Rhc2tEZWYubGVuZ3RoKSB7XG4gICAgLy8gaWYgc29tZXRoaW5nIGJlc2lkZXMgYW4gRUNTIFNlcnZpY2UgaXMgcmVmZXJlbmNpbmcgdGhlIFRhc2tEZWZpbml0aW9uLFxuICAgIC8vIGhvdHN3YXAgaXMgbm90IHBvc3NpYmxlIGluIEZBTExfQkFDSyBtb2RlXG4gICAgY29uc3Qgbm9uRWNzU2VydmljZVRhc2tEZWZSZWZzID0gcmVzb3VyY2VzUmVmZXJlbmNpbmdUYXNrRGVmLmZpbHRlcigocikgPT4gci5UeXBlICE9PSAnQVdTOjpFQ1M6OlNlcnZpY2UnKTtcbiAgICBmb3IgKGNvbnN0IHRhc2tSZWYgb2Ygbm9uRWNzU2VydmljZVRhc2tEZWZSZWZzKSB7XG4gICAgICByZXBvcnROb25Ib3Rzd2FwcGFibGVDaGFuZ2UoXG4gICAgICAgIHJldCxcbiAgICAgICAgY2hhbmdlLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGBBIHJlc291cmNlICcke3Rhc2tSZWYuTG9naWNhbElkfScgd2l0aCBUeXBlICcke3Rhc2tSZWYuVHlwZX0nIHRoYXQgaXMgbm90IGFuIEVDUyBTZXJ2aWNlIHdhcyBmb3VuZCByZWZlcmVuY2luZyB0aGUgY2hhbmdlZCBUYXNrRGVmaW5pdGlvbiAnJHtsb2dpY2FsSWR9J2AsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG5hbWVzT2ZIb3Rzd2FwcGFibGVDaGFuZ2VzID0gT2JqZWN0LmtleXMoY2xhc3NpZmllZENoYW5nZXMuaG90c3dhcHBhYmxlUHJvcHMpO1xuICBpZiAobmFtZXNPZkhvdHN3YXBwYWJsZUNoYW5nZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uUmVzb3VyY2UgPSBhd2FpdCBwcmVwYXJlVGFza0RlZmluaXRpb25DaGFuZ2UoZXZhbHVhdGVDZm5UZW1wbGF0ZSwgbG9naWNhbElkLCBjaGFuZ2UpO1xuICAgIHJldC5wdXNoKHtcbiAgICAgIGhvdHN3YXBwYWJsZTogdHJ1ZSxcbiAgICAgIHJlc291cmNlVHlwZTogY2hhbmdlLm5ld1ZhbHVlLlR5cGUsXG4gICAgICBwcm9wc0NoYW5nZWQ6IG5hbWVzT2ZIb3Rzd2FwcGFibGVDaGFuZ2VzLFxuICAgICAgc2VydmljZTogJ2Vjcy1zZXJ2aWNlJyxcbiAgICAgIHJlc291cmNlTmFtZXM6IFtcbiAgICAgICAgYEVDUyBUYXNrIERlZmluaXRpb24gJyR7YXdhaXQgdGFza0RlZmluaXRpb25SZXNvdXJjZS5GYW1pbHl9J2AsXG4gICAgICAgIC4uLmVjc1NlcnZpY2VzUmVmZXJlbmNpbmdUYXNrRGVmLm1hcCgoZWNzU2VydmljZSkgPT4gYEVDUyBTZXJ2aWNlICcke2Vjc1NlcnZpY2Uuc2VydmljZUFybi5zcGxpdCgnLycpWzJdfSdgKSxcbiAgICAgIF0sXG4gICAgICBhcHBseTogYXN5bmMgKHNkazogU0RLKSA9PiB7XG4gICAgICAgIC8vIFN0ZXAgMSAtIHVwZGF0ZSB0aGUgY2hhbmdlZCBUYXNrRGVmaW5pdGlvbiwgY3JlYXRpbmcgYSBuZXcgVGFza0RlZmluaXRpb24gUmV2aXNpb25cbiAgICAgICAgLy8gd2UgbmVlZCB0byBsb3dlcmNhc2UgdGhlIGV2YWx1YXRlZCBUYXNrRGVmIGZyb20gQ2xvdWRGb3JtYXRpb24sXG4gICAgICAgIC8vIGFzIHRoZSBBV1MgU0RLIHVzZXMgbG93ZXJjYXNlIHByb3BlcnR5IG5hbWVzIGZvciB0aGVzZVxuXG4gICAgICAgIC8vIFRoZSBTREsgcmVxdWlyZXMgbW9yZSBwcm9wZXJ0aWVzIGhlcmUgdGhhbiBpdHMgd29ydGggZG9pbmcgZXhwbGljaXQgdHlwaW5nIGZvclxuICAgICAgICAvLyBpbnN0ZWFkLCBqdXN0IHVzZSBhbGwgdGhlIG9sZCB2YWx1ZXMgaW4gdGhlIGRpZmYgdG8gZmlsbCB0aGVtIGluIGltcGxpY2l0bHlcbiAgICAgICAgY29uc3QgbG93ZXJjYXNlZFRhc2tEZWYgPSB0cmFuc2Zvcm1PYmplY3RLZXlzKHRhc2tEZWZpbml0aW9uUmVzb3VyY2UsIGxvd2VyQ2FzZUZpcnN0Q2hhcmFjdGVyLCB7XG4gICAgICAgICAgLy8gQWxsIHRoZSBwcm9wZXJ0aWVzIHRoYXQgdGFrZSBhcmJpdHJhcnkgc3RyaW5nIGFzIGtleXMgaS5lLiB7IFwic3RyaW5nXCIgOiBcInN0cmluZ1wiIH1cbiAgICAgICAgICAvLyBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vQW1hem9uRUNTL2xhdGVzdC9BUElSZWZlcmVuY2UvQVBJX1JlZ2lzdGVyVGFza0RlZmluaXRpb24uaHRtbCNBUElfUmVnaXN0ZXJUYXNrRGVmaW5pdGlvbl9SZXF1ZXN0U3ludGF4XG4gICAgICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IHtcbiAgICAgICAgICAgIERvY2tlckxhYmVsczogdHJ1ZSxcbiAgICAgICAgICAgIEZpcmVsZW5zQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICBPcHRpb25zOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIExvZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgT3B0aW9uczogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBWb2x1bWVzOiB7XG4gICAgICAgICAgICBEb2NrZXJWb2x1bWVDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgIERyaXZlck9wdHM6IHRydWUsXG4gICAgICAgICAgICAgIExhYmVsczogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyVGFza0RlZlJlc3BvbnNlID0gYXdhaXQgc2RrLmVjcygpLnJlZ2lzdGVyVGFza0RlZmluaXRpb24obG93ZXJjYXNlZFRhc2tEZWYpO1xuICAgICAgICBjb25zdCB0YXNrRGVmUmV2QXJuID0gcmVnaXN0ZXJUYXNrRGVmUmVzcG9uc2UudGFza0RlZmluaXRpb24/LnRhc2tEZWZpbml0aW9uQXJuO1xuXG4gICAgICAgIGxldCBlY3NIb3Rzd2FwUHJvcGVydGllcyA9IGhvdHN3YXBQcm9wZXJ0eU92ZXJyaWRlcy5lY3NIb3Rzd2FwUHJvcGVydGllcztcbiAgICAgICAgbGV0IG1pbmltdW1IZWFsdGh5UGVyY2VudCA9IGVjc0hvdHN3YXBQcm9wZXJ0aWVzPy5taW5pbXVtSGVhbHRoeVBlcmNlbnQ7XG4gICAgICAgIGxldCBtYXhpbXVtSGVhbHRoeVBlcmNlbnQgPSBlY3NIb3Rzd2FwUHJvcGVydGllcz8ubWF4aW11bUhlYWx0aHlQZXJjZW50O1xuXG4gICAgICAgIC8vIFN0ZXAgMiAtIHVwZGF0ZSB0aGUgc2VydmljZXMgdXNpbmcgdGhhdCBUYXNrRGVmaW5pdGlvbiB0byBwb2ludCB0byB0aGUgbmV3IFRhc2tEZWZpbml0aW9uIFJldmlzaW9uXG4gICAgICAgIC8vIEZvcmNpbmcgTmV3IERlcGxveW1lbnQgYW5kIHNldHRpbmcgTWluaW11bSBIZWFsdGh5IFBlcmNlbnQgdG8gMC5cbiAgICAgICAgLy8gQXMgQ0RLIEhvdFN3YXAgaXMgZGV2ZWxvcG1lbnQgb25seSwgdGhpcyBzZWVtcyB0aGUgbW9zdCBlZmZpY2llbnQgd2F5IHRvIGVuc3VyZSBhbGwgdGFza3MgYXJlIHJlcGxhY2VkIGltbWVkaWF0ZWx5LCByZWdhcmRsZXNzIG9mIG9yaWdpbmFsIGFtb3VudFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQGNka2xhYnMvcHJvbWlzZWFsbC1uby11bmJvdW5kZWQtcGFyYWxsZWxpc21cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgZWNzU2VydmljZXNSZWZlcmVuY2luZ1Rhc2tEZWYubWFwKGFzeW5jIChzZXJ2aWNlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjbHVzdGVyID0gc2VydmljZS5zZXJ2aWNlQXJuLnNwbGl0KCcvJylbMV07XG4gICAgICAgICAgICBjb25zdCB1cGRhdGUgPSBhd2FpdCBzZGsuZWNzKCkudXBkYXRlU2VydmljZSh7XG4gICAgICAgICAgICAgIHNlcnZpY2U6IHNlcnZpY2Uuc2VydmljZUFybixcbiAgICAgICAgICAgICAgdGFza0RlZmluaXRpb246IHRhc2tEZWZSZXZBcm4sXG4gICAgICAgICAgICAgIGNsdXN0ZXIsXG4gICAgICAgICAgICAgIGZvcmNlTmV3RGVwbG95bWVudDogdHJ1ZSxcbiAgICAgICAgICAgICAgZGVwbG95bWVudENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICBtaW5pbXVtSGVhbHRoeVBlcmNlbnQ6IG1pbmltdW1IZWFsdGh5UGVyY2VudCAhPT0gdW5kZWZpbmVkID8gbWluaW11bUhlYWx0aHlQZXJjZW50IDogMCxcbiAgICAgICAgICAgICAgICBtYXhpbXVtUGVyY2VudDogbWF4aW11bUhlYWx0aHlQZXJjZW50ICE9PSB1bmRlZmluZWQgPyBtYXhpbXVtSGVhbHRoeVBlcmNlbnQgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgYXdhaXQgc2RrLmVjcygpLndhaXRVbnRpbFNlcnZpY2VzU3RhYmxlKHtcbiAgICAgICAgICAgICAgY2x1c3RlcjogdXBkYXRlLnNlcnZpY2U/LmNsdXN0ZXJBcm4sXG4gICAgICAgICAgICAgIHNlcnZpY2VzOiBbc2VydmljZS5zZXJ2aWNlQXJuXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmludGVyZmFjZSBFY3NTZXJ2aWNlIHtcbiAgcmVhZG9ubHkgc2VydmljZUFybjogc3RyaW5nO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwcmVwYXJlVGFza0RlZmluaXRpb25DaGFuZ2UoXG4gIGV2YWx1YXRlQ2ZuVGVtcGxhdGU6IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSxcbiAgbG9naWNhbElkOiBzdHJpbmcsXG4gIGNoYW5nZTogSG90c3dhcHBhYmxlQ2hhbmdlQ2FuZGlkYXRlLFxuKSB7XG4gIGNvbnN0IHRhc2tEZWZpbml0aW9uUmVzb3VyY2U6IHsgW25hbWU6IHN0cmluZ106IGFueSB9ID0ge1xuICAgIC4uLmNoYW5nZS5vbGRWYWx1ZS5Qcm9wZXJ0aWVzLFxuICAgIENvbnRhaW5lckRlZmluaXRpb25zOiBjaGFuZ2UubmV3VmFsdWUuUHJvcGVydGllcz8uQ29udGFpbmVyRGVmaW5pdGlvbnMsXG4gIH07XG4gIC8vIGZpcnN0LCBsZXQncyBnZXQgdGhlIG5hbWUgb2YgdGhlIGZhbWlseVxuICBjb25zdCBmYW1pbHlOYW1lT3JBcm4gPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmVzdGFibGlzaFJlc291cmNlUGh5c2ljYWxOYW1lKFxuICAgIGxvZ2ljYWxJZCxcbiAgICB0YXNrRGVmaW5pdGlvblJlc291cmNlPy5GYW1pbHksXG4gICk7XG4gIGlmICghZmFtaWx5TmFtZU9yQXJuKSB7XG4gICAgLy8gaWYgdGhlIEZhbWlseSBwcm9wZXJ0eSBoYXMgbm90IGJlZW4gcHJvdmlkZWQsIGFuZCB3ZSBjYW4ndCBmaW5kIGl0IGluIHRoZSBjdXJyZW50IFN0YWNrLFxuICAgIC8vIHRoaXMgbWVhbnMgaG90c3dhcHBpbmcgaXMgbm90IHBvc3NpYmxlXG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIHRoZSBwaHlzaWNhbCBuYW1lIG9mIHRoZSBUYXNrIERlZmluaXRpb24gaW4gQ2xvdWRGb3JtYXRpb24gaW5jbHVkZXMgaXRzIGN1cnJlbnQgcmV2aXNpb24gbnVtYmVyIGF0IHRoZSBlbmQsXG4gIC8vIHJlbW92ZSBpdCBpZiBuZWVkZWRcbiAgY29uc3QgZmFtaWx5TmFtZU9yQXJuUGFydHMgPSBmYW1pbHlOYW1lT3JBcm4uc3BsaXQoJzonKTtcbiAgY29uc3QgZmFtaWx5ID1cbiAgICBmYW1pbHlOYW1lT3JBcm5QYXJ0cy5sZW5ndGggPiAxXG4gICAgICA/IC8vIGZhbWlseU5hbWVPckFybiBpcyBhY3R1YWxseSBhbiBBUk4sIG9mIHRoZSBmb3JtYXQgJ2Fybjphd3M6ZWNzOnJlZ2lvbjphY2NvdW50OnRhc2stZGVmaW5pdGlvbi88ZmFtaWx5LW5hbWU+OjxyZXZpc2lvbi1ucj4nXG4gICAgLy8gc28sIHRha2UgdGhlIDZ0aCBlbGVtZW50LCBhdCBpbmRleCA1LCBhbmQgc3BsaXQgaXQgb24gJy8nXG4gICAgICBmYW1pbHlOYW1lT3JBcm5QYXJ0c1s1XS5zcGxpdCgnLycpWzFdXG4gICAgICA6IC8vIG90aGVyd2lzZSwgZmFtaWx5TmFtZU9yQXJuIGlzIGp1c3QgdGhlIHNpbXBsZSBuYW1lIGV2YWx1YXRlZCBmcm9tIHRoZSBDbG91ZEZvcm1hdGlvbiB0ZW1wbGF0ZVxuICAgICAgZmFtaWx5TmFtZU9yQXJuO1xuICAvLyB0aGVuLCBsZXQncyBldmFsdWF0ZSB0aGUgYm9keSBvZiB0aGUgcmVtYWluZGVyIG9mIHRoZSBUYXNrRGVmICh3aXRob3V0IHRoZSBGYW1pbHkgcHJvcGVydHkpXG4gIHJldHVybiB7XG4gICAgLi4uKGF3YWl0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUuZXZhbHVhdGVDZm5FeHByZXNzaW9uKHtcbiAgICAgIC4uLih0YXNrRGVmaW5pdGlvblJlc291cmNlID8/IHt9KSxcbiAgICAgIEZhbWlseTogdW5kZWZpbmVkLFxuICAgIH0pKSxcbiAgICBGYW1pbHk6IGZhbWlseSxcbiAgfTtcbn1cbiJdfQ==