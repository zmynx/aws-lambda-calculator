"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHotswappableStateMachineChange = isHotswappableStateMachineChange;
const common_1 = require("./common");
async function isHotswappableStateMachineChange(logicalId, change, evaluateCfnTemplate) {
    if (change.newValue.Type !== 'AWS::StepFunctions::StateMachine') {
        return [];
    }
    const ret = [];
    const classifiedChanges = (0, common_1.classifyChanges)(change, ['DefinitionString']);
    classifiedChanges.reportNonHotswappablePropertyChanges(ret);
    const namesOfHotswappableChanges = Object.keys(classifiedChanges.hotswappableProps);
    if (namesOfHotswappableChanges.length > 0) {
        const stateMachineNameInCfnTemplate = change.newValue?.Properties?.StateMachineName;
        const stateMachineArn = stateMachineNameInCfnTemplate
            ? await evaluateCfnTemplate.evaluateCfnExpression({
                'Fn::Sub': 'arn:${AWS::Partition}:states:${AWS::Region}:${AWS::AccountId}:stateMachine:' +
                    stateMachineNameInCfnTemplate,
            })
            : await evaluateCfnTemplate.findPhysicalNameFor(logicalId);
        ret.push({
            hotswappable: true,
            resourceType: change.newValue.Type,
            propsChanged: namesOfHotswappableChanges,
            service: 'stepfunctions-service',
            resourceNames: [`${change.newValue.Type} '${stateMachineArn?.split(':')[6]}'`],
            apply: async (sdk) => {
                if (!stateMachineArn) {
                    return;
                }
                // not passing the optional properties leaves them unchanged
                await sdk.stepFunctions().updateStateMachine({
                    stateMachineArn,
                    definition: await evaluateCfnTemplate.evaluateCfnExpression(change.propertyUpdates.DefinitionString.newValue),
                });
            },
        });
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcGZ1bmN0aW9ucy1zdGF0ZS1tYWNoaW5lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0ZXBmdW5jdGlvbnMtc3RhdGUtbWFjaGluZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFJQSw0RUEyQ0M7QUEvQ0QscUNBQXVHO0FBSWhHLEtBQUssVUFBVSxnQ0FBZ0MsQ0FDcEQsU0FBaUIsRUFDakIsTUFBbUMsRUFDbkMsbUJBQW1EO0lBRW5ELElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssa0NBQWtDLEVBQUUsQ0FBQztRQUNoRSxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFDRCxNQUFNLEdBQUcsR0FBd0IsRUFBRSxDQUFDO0lBQ3BDLE1BQU0saUJBQWlCLEdBQUcsSUFBQSx3QkFBZSxFQUFDLE1BQU0sRUFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztJQUN4RSxpQkFBaUIsQ0FBQyxvQ0FBb0MsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUU1RCxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwRixJQUFJLDBCQUEwQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUMxQyxNQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLGdCQUFnQixDQUFDO1FBQ3BGLE1BQU0sZUFBZSxHQUFHLDZCQUE2QjtZQUNuRCxDQUFDLENBQUMsTUFBTSxtQkFBbUIsQ0FBQyxxQkFBcUIsQ0FBQztnQkFDaEQsU0FBUyxFQUNMLDZFQUE2RTtvQkFDN0UsNkJBQTZCO2FBQ2xDLENBQUM7WUFDRixDQUFDLENBQUMsTUFBTSxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3RCxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ1AsWUFBWSxFQUFFLElBQUk7WUFDbEIsWUFBWSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSTtZQUNsQyxZQUFZLEVBQUUsMEJBQTBCO1lBQ3hDLE9BQU8sRUFBRSx1QkFBdUI7WUFDaEMsYUFBYSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxlQUFlLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDOUUsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFRLEVBQUUsRUFBRTtnQkFDeEIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUNyQixPQUFPO2dCQUNULENBQUM7Z0JBRUQsNERBQTREO2dCQUM1RCxNQUFNLEdBQUcsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztvQkFDM0MsZUFBZTtvQkFDZixVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQztpQkFDOUcsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0eXBlIENoYW5nZUhvdHN3YXBSZXN1bHQsIGNsYXNzaWZ5Q2hhbmdlcywgdHlwZSBIb3Rzd2FwcGFibGVDaGFuZ2VDYW5kaWRhdGUgfSBmcm9tICcuL2NvbW1vbic7XG5pbXBvcnQgdHlwZSB7IFNESyB9IGZyb20gJy4uL2F3cy1hdXRoJztcbmltcG9ydCB0eXBlIHsgRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlIH0gZnJvbSAnLi4vZXZhbHVhdGUtY2xvdWRmb3JtYXRpb24tdGVtcGxhdGUnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNIb3Rzd2FwcGFibGVTdGF0ZU1hY2hpbmVDaGFuZ2UoXG4gIGxvZ2ljYWxJZDogc3RyaW5nLFxuICBjaGFuZ2U6IEhvdHN3YXBwYWJsZUNoYW5nZUNhbmRpZGF0ZSxcbiAgZXZhbHVhdGVDZm5UZW1wbGF0ZTogRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlLFxuKTogUHJvbWlzZTxDaGFuZ2VIb3Rzd2FwUmVzdWx0PiB7XG4gIGlmIChjaGFuZ2UubmV3VmFsdWUuVHlwZSAhPT0gJ0FXUzo6U3RlcEZ1bmN0aW9uczo6U3RhdGVNYWNoaW5lJykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBjb25zdCByZXQ6IENoYW5nZUhvdHN3YXBSZXN1bHQgPSBbXTtcbiAgY29uc3QgY2xhc3NpZmllZENoYW5nZXMgPSBjbGFzc2lmeUNoYW5nZXMoY2hhbmdlLCBbJ0RlZmluaXRpb25TdHJpbmcnXSk7XG4gIGNsYXNzaWZpZWRDaGFuZ2VzLnJlcG9ydE5vbkhvdHN3YXBwYWJsZVByb3BlcnR5Q2hhbmdlcyhyZXQpO1xuXG4gIGNvbnN0IG5hbWVzT2ZIb3Rzd2FwcGFibGVDaGFuZ2VzID0gT2JqZWN0LmtleXMoY2xhc3NpZmllZENoYW5nZXMuaG90c3dhcHBhYmxlUHJvcHMpO1xuICBpZiAobmFtZXNPZkhvdHN3YXBwYWJsZUNoYW5nZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHN0YXRlTWFjaGluZU5hbWVJbkNmblRlbXBsYXRlID0gY2hhbmdlLm5ld1ZhbHVlPy5Qcm9wZXJ0aWVzPy5TdGF0ZU1hY2hpbmVOYW1lO1xuICAgIGNvbnN0IHN0YXRlTWFjaGluZUFybiA9IHN0YXRlTWFjaGluZU5hbWVJbkNmblRlbXBsYXRlXG4gICAgICA/IGF3YWl0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUuZXZhbHVhdGVDZm5FeHByZXNzaW9uKHtcbiAgICAgICAgJ0ZuOjpTdWInOlxuICAgICAgICAgICAgJ2Fybjoke0FXUzo6UGFydGl0aW9ufTpzdGF0ZXM6JHtBV1M6OlJlZ2lvbn06JHtBV1M6OkFjY291bnRJZH06c3RhdGVNYWNoaW5lOicgK1xuICAgICAgICAgICAgc3RhdGVNYWNoaW5lTmFtZUluQ2ZuVGVtcGxhdGUsXG4gICAgICB9KVxuICAgICAgOiBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmZpbmRQaHlzaWNhbE5hbWVGb3IobG9naWNhbElkKTtcbiAgICByZXQucHVzaCh7XG4gICAgICBob3Rzd2FwcGFibGU6IHRydWUsXG4gICAgICByZXNvdXJjZVR5cGU6IGNoYW5nZS5uZXdWYWx1ZS5UeXBlLFxuICAgICAgcHJvcHNDaGFuZ2VkOiBuYW1lc09mSG90c3dhcHBhYmxlQ2hhbmdlcyxcbiAgICAgIHNlcnZpY2U6ICdzdGVwZnVuY3Rpb25zLXNlcnZpY2UnLFxuICAgICAgcmVzb3VyY2VOYW1lczogW2Ake2NoYW5nZS5uZXdWYWx1ZS5UeXBlfSAnJHtzdGF0ZU1hY2hpbmVBcm4/LnNwbGl0KCc6JylbNl19J2BdLFxuICAgICAgYXBwbHk6IGFzeW5jIChzZGs6IFNESykgPT4ge1xuICAgICAgICBpZiAoIXN0YXRlTWFjaGluZUFybikge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdCBwYXNzaW5nIHRoZSBvcHRpb25hbCBwcm9wZXJ0aWVzIGxlYXZlcyB0aGVtIHVuY2hhbmdlZFxuICAgICAgICBhd2FpdCBzZGsuc3RlcEZ1bmN0aW9ucygpLnVwZGF0ZVN0YXRlTWFjaGluZSh7XG4gICAgICAgICAgc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgICAgIGRlZmluaXRpb246IGF3YWl0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUuZXZhbHVhdGVDZm5FeHByZXNzaW9uKGNoYW5nZS5wcm9wZXJ0eVVwZGF0ZXMuRGVmaW5pdGlvblN0cmluZy5uZXdWYWx1ZSksXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG4iXX0=