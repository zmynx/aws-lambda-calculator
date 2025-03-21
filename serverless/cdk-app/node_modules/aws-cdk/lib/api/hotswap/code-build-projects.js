"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHotswappableCodeBuildProjectChange = isHotswappableCodeBuildProjectChange;
const common_1 = require("./common");
async function isHotswappableCodeBuildProjectChange(logicalId, change, evaluateCfnTemplate) {
    if (change.newValue.Type !== 'AWS::CodeBuild::Project') {
        return [];
    }
    const ret = [];
    const classifiedChanges = (0, common_1.classifyChanges)(change, ['Source', 'Environment', 'SourceVersion']);
    classifiedChanges.reportNonHotswappablePropertyChanges(ret);
    if (classifiedChanges.namesOfHotswappableProps.length > 0) {
        const updateProjectInput = {
            name: '',
        };
        const projectName = await evaluateCfnTemplate.establishResourcePhysicalName(logicalId, change.newValue.Properties?.Name);
        ret.push({
            hotswappable: true,
            resourceType: change.newValue.Type,
            propsChanged: classifiedChanges.namesOfHotswappableProps,
            service: 'codebuild',
            resourceNames: [`CodeBuild Project '${projectName}'`],
            apply: async (sdk) => {
                if (!projectName) {
                    return;
                }
                updateProjectInput.name = projectName;
                for (const updatedPropName in change.propertyUpdates) {
                    const updatedProp = change.propertyUpdates[updatedPropName];
                    switch (updatedPropName) {
                        case 'Source':
                            updateProjectInput.source = (0, common_1.transformObjectKeys)(await evaluateCfnTemplate.evaluateCfnExpression(updatedProp.newValue), convertSourceCloudformationKeyToSdkKey);
                            break;
                        case 'Environment':
                            updateProjectInput.environment = await (0, common_1.transformObjectKeys)(await evaluateCfnTemplate.evaluateCfnExpression(updatedProp.newValue), common_1.lowerCaseFirstCharacter);
                            break;
                        case 'SourceVersion':
                            updateProjectInput.sourceVersion = await evaluateCfnTemplate.evaluateCfnExpression(updatedProp.newValue);
                            break;
                    }
                }
                await sdk.codeBuild().updateProject(updateProjectInput);
            },
        });
    }
    return ret;
}
function convertSourceCloudformationKeyToSdkKey(key) {
    if (key.toLowerCase() === 'buildspec') {
        return key.toLowerCase();
    }
    return (0, common_1.lowerCaseFirstCharacter)(key);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZS1idWlsZC1wcm9qZWN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvZGUtYnVpbGQtcHJvamVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFXQSxvRkE0REM7QUF0RUQscUNBTWtCO0FBSVgsS0FBSyxVQUFVLG9DQUFvQyxDQUN4RCxTQUFpQixFQUNqQixNQUFtQyxFQUNuQyxtQkFBbUQ7SUFFbkQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyx5QkFBeUIsRUFBRSxDQUFDO1FBQ3ZELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE1BQU0sR0FBRyxHQUF3QixFQUFFLENBQUM7SUFFcEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHdCQUFlLEVBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDO0lBQzlGLGlCQUFpQixDQUFDLG9DQUFvQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzVELElBQUksaUJBQWlCLENBQUMsd0JBQXdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzFELE1BQU0sa0JBQWtCLEdBQThCO1lBQ3BELElBQUksRUFBRSxFQUFFO1NBQ1QsQ0FBQztRQUNGLE1BQU0sV0FBVyxHQUFHLE1BQU0sbUJBQW1CLENBQUMsNkJBQTZCLENBQ3pFLFNBQVMsRUFDVCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQ2pDLENBQUM7UUFDRixHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ1AsWUFBWSxFQUFFLElBQUk7WUFDbEIsWUFBWSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSTtZQUNsQyxZQUFZLEVBQUUsaUJBQWlCLENBQUMsd0JBQXdCO1lBQ3hELE9BQU8sRUFBRSxXQUFXO1lBQ3BCLGFBQWEsRUFBRSxDQUFDLHNCQUFzQixXQUFXLEdBQUcsQ0FBQztZQUNyRCxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQVEsRUFBRSxFQUFFO2dCQUN4QixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ2pCLE9BQU87Z0JBQ1QsQ0FBQztnQkFDRCxrQkFBa0IsQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO2dCQUV0QyxLQUFLLE1BQU0sZUFBZSxJQUFJLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDckQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDNUQsUUFBUSxlQUFlLEVBQUUsQ0FBQzt3QkFDeEIsS0FBSyxRQUFROzRCQUNYLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxJQUFBLDRCQUFtQixFQUM3QyxNQUFNLG1CQUFtQixDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFDckUsc0NBQXNDLENBQ3ZDLENBQUM7NEJBQ0YsTUFBTTt3QkFDUixLQUFLLGFBQWE7NEJBQ2hCLGtCQUFrQixDQUFDLFdBQVcsR0FBRyxNQUFNLElBQUEsNEJBQW1CLEVBQ3hELE1BQU0sbUJBQW1CLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUNyRSxnQ0FBdUIsQ0FDeEIsQ0FBQzs0QkFDRixNQUFNO3dCQUNSLEtBQUssZUFBZTs0QkFDbEIsa0JBQWtCLENBQUMsYUFBYSxHQUFHLE1BQU0sbUJBQW1CLENBQUMscUJBQXFCLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDOzRCQUN6RyxNQUFNO29CQUNWLENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCxNQUFNLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUMxRCxDQUFDO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsc0NBQXNDLENBQUMsR0FBVztJQUN6RCxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUN0QyxPQUFPLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBQ0QsT0FBTyxJQUFBLGdDQUF1QixFQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFVwZGF0ZVByb2plY3RDb21tYW5kSW5wdXQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY29kZWJ1aWxkJztcbmltcG9ydCB7XG4gIHR5cGUgQ2hhbmdlSG90c3dhcFJlc3VsdCxcbiAgY2xhc3NpZnlDaGFuZ2VzLFxuICB0eXBlIEhvdHN3YXBwYWJsZUNoYW5nZUNhbmRpZGF0ZSxcbiAgbG93ZXJDYXNlRmlyc3RDaGFyYWN0ZXIsXG4gIHRyYW5zZm9ybU9iamVjdEtleXMsXG59IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB0eXBlIHsgU0RLIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuaW1wb3J0IHR5cGUgeyBFdmFsdWF0ZUNsb3VkRm9ybWF0aW9uVGVtcGxhdGUgfSBmcm9tICcuLi9ldmFsdWF0ZS1jbG91ZGZvcm1hdGlvbi10ZW1wbGF0ZSc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpc0hvdHN3YXBwYWJsZUNvZGVCdWlsZFByb2plY3RDaGFuZ2UoXG4gIGxvZ2ljYWxJZDogc3RyaW5nLFxuICBjaGFuZ2U6IEhvdHN3YXBwYWJsZUNoYW5nZUNhbmRpZGF0ZSxcbiAgZXZhbHVhdGVDZm5UZW1wbGF0ZTogRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlLFxuKTogUHJvbWlzZTxDaGFuZ2VIb3Rzd2FwUmVzdWx0PiB7XG4gIGlmIChjaGFuZ2UubmV3VmFsdWUuVHlwZSAhPT0gJ0FXUzo6Q29kZUJ1aWxkOjpQcm9qZWN0Jykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IHJldDogQ2hhbmdlSG90c3dhcFJlc3VsdCA9IFtdO1xuXG4gIGNvbnN0IGNsYXNzaWZpZWRDaGFuZ2VzID0gY2xhc3NpZnlDaGFuZ2VzKGNoYW5nZSwgWydTb3VyY2UnLCAnRW52aXJvbm1lbnQnLCAnU291cmNlVmVyc2lvbiddKTtcbiAgY2xhc3NpZmllZENoYW5nZXMucmVwb3J0Tm9uSG90c3dhcHBhYmxlUHJvcGVydHlDaGFuZ2VzKHJldCk7XG4gIGlmIChjbGFzc2lmaWVkQ2hhbmdlcy5uYW1lc09mSG90c3dhcHBhYmxlUHJvcHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHVwZGF0ZVByb2plY3RJbnB1dDogVXBkYXRlUHJvamVjdENvbW1hbmRJbnB1dCA9IHtcbiAgICAgIG5hbWU6ICcnLFxuICAgIH07XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmVzdGFibGlzaFJlc291cmNlUGh5c2ljYWxOYW1lKFxuICAgICAgbG9naWNhbElkLFxuICAgICAgY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/Lk5hbWUsXG4gICAgKTtcbiAgICByZXQucHVzaCh7XG4gICAgICBob3Rzd2FwcGFibGU6IHRydWUsXG4gICAgICByZXNvdXJjZVR5cGU6IGNoYW5nZS5uZXdWYWx1ZS5UeXBlLFxuICAgICAgcHJvcHNDaGFuZ2VkOiBjbGFzc2lmaWVkQ2hhbmdlcy5uYW1lc09mSG90c3dhcHBhYmxlUHJvcHMsXG4gICAgICBzZXJ2aWNlOiAnY29kZWJ1aWxkJyxcbiAgICAgIHJlc291cmNlTmFtZXM6IFtgQ29kZUJ1aWxkIFByb2plY3QgJyR7cHJvamVjdE5hbWV9J2BdLFxuICAgICAgYXBwbHk6IGFzeW5jIChzZGs6IFNESykgPT4ge1xuICAgICAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZVByb2plY3RJbnB1dC5uYW1lID0gcHJvamVjdE5hbWU7XG5cbiAgICAgICAgZm9yIChjb25zdCB1cGRhdGVkUHJvcE5hbWUgaW4gY2hhbmdlLnByb3BlcnR5VXBkYXRlcykge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRQcm9wID0gY2hhbmdlLnByb3BlcnR5VXBkYXRlc1t1cGRhdGVkUHJvcE5hbWVdO1xuICAgICAgICAgIHN3aXRjaCAodXBkYXRlZFByb3BOYW1lKSB7XG4gICAgICAgICAgICBjYXNlICdTb3VyY2UnOlxuICAgICAgICAgICAgICB1cGRhdGVQcm9qZWN0SW5wdXQuc291cmNlID0gdHJhbnNmb3JtT2JqZWN0S2V5cyhcbiAgICAgICAgICAgICAgICBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmV2YWx1YXRlQ2ZuRXhwcmVzc2lvbih1cGRhdGVkUHJvcC5uZXdWYWx1ZSksXG4gICAgICAgICAgICAgICAgY29udmVydFNvdXJjZUNsb3VkZm9ybWF0aW9uS2V5VG9TZGtLZXksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnRW52aXJvbm1lbnQnOlxuICAgICAgICAgICAgICB1cGRhdGVQcm9qZWN0SW5wdXQuZW52aXJvbm1lbnQgPSBhd2FpdCB0cmFuc2Zvcm1PYmplY3RLZXlzKFxuICAgICAgICAgICAgICAgIGF3YWl0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUuZXZhbHVhdGVDZm5FeHByZXNzaW9uKHVwZGF0ZWRQcm9wLm5ld1ZhbHVlKSxcbiAgICAgICAgICAgICAgICBsb3dlckNhc2VGaXJzdENoYXJhY3RlcixcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdTb3VyY2VWZXJzaW9uJzpcbiAgICAgICAgICAgICAgdXBkYXRlUHJvamVjdElucHV0LnNvdXJjZVZlcnNpb24gPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmV2YWx1YXRlQ2ZuRXhwcmVzc2lvbih1cGRhdGVkUHJvcC5uZXdWYWx1ZSk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHNkay5jb2RlQnVpbGQoKS51cGRhdGVQcm9qZWN0KHVwZGF0ZVByb2plY3RJbnB1dCk7XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gY29udmVydFNvdXJjZUNsb3VkZm9ybWF0aW9uS2V5VG9TZGtLZXkoa2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoa2V5LnRvTG93ZXJDYXNlKCkgPT09ICdidWlsZHNwZWMnKSB7XG4gICAgcmV0dXJuIGtleS50b0xvd2VyQ2FzZSgpO1xuICB9XG4gIHJldHVybiBsb3dlckNhc2VGaXJzdENoYXJhY3RlcihrZXkpO1xufVxuIl19