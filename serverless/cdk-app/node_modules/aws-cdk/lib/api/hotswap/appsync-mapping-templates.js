"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHotswappableAppSyncChange = isHotswappableAppSyncChange;
const common_1 = require("./common");
const error_1 = require("../../toolkit/error");
async function isHotswappableAppSyncChange(logicalId, change, evaluateCfnTemplate) {
    const isResolver = change.newValue.Type === 'AWS::AppSync::Resolver';
    const isFunction = change.newValue.Type === 'AWS::AppSync::FunctionConfiguration';
    const isGraphQLSchema = change.newValue.Type === 'AWS::AppSync::GraphQLSchema';
    const isAPIKey = change.newValue.Type === 'AWS::AppSync::ApiKey';
    if (!isResolver && !isFunction && !isGraphQLSchema && !isAPIKey) {
        return [];
    }
    const ret = [];
    const classifiedChanges = (0, common_1.classifyChanges)(change, [
        'RequestMappingTemplate',
        'RequestMappingTemplateS3Location',
        'ResponseMappingTemplate',
        'ResponseMappingTemplateS3Location',
        'Code',
        'CodeS3Location',
        'Definition',
        'DefinitionS3Location',
        'Expires',
    ]);
    classifiedChanges.reportNonHotswappablePropertyChanges(ret);
    const namesOfHotswappableChanges = Object.keys(classifiedChanges.hotswappableProps);
    if (namesOfHotswappableChanges.length > 0) {
        let physicalName = undefined;
        const arn = await evaluateCfnTemplate.establishResourcePhysicalName(logicalId, isFunction ? change.newValue.Properties?.Name : undefined);
        if (isResolver) {
            const arnParts = arn?.split('/');
            physicalName = arnParts ? `${arnParts[3]}.${arnParts[5]}` : undefined;
        }
        else {
            physicalName = arn;
        }
        ret.push({
            hotswappable: true,
            resourceType: change.newValue.Type,
            propsChanged: namesOfHotswappableChanges,
            service: 'appsync',
            resourceNames: [`${change.newValue.Type} '${physicalName}'`],
            apply: async (sdk) => {
                if (!physicalName) {
                    return;
                }
                const sdkProperties = {
                    ...change.oldValue.Properties,
                    Definition: change.newValue.Properties?.Definition,
                    DefinitionS3Location: change.newValue.Properties?.DefinitionS3Location,
                    requestMappingTemplate: change.newValue.Properties?.RequestMappingTemplate,
                    requestMappingTemplateS3Location: change.newValue.Properties?.RequestMappingTemplateS3Location,
                    responseMappingTemplate: change.newValue.Properties?.ResponseMappingTemplate,
                    responseMappingTemplateS3Location: change.newValue.Properties?.ResponseMappingTemplateS3Location,
                    code: change.newValue.Properties?.Code,
                    codeS3Location: change.newValue.Properties?.CodeS3Location,
                    expires: change.newValue.Properties?.Expires,
                };
                const evaluatedResourceProperties = await evaluateCfnTemplate.evaluateCfnExpression(sdkProperties);
                const sdkRequestObject = (0, common_1.transformObjectKeys)(evaluatedResourceProperties, common_1.lowerCaseFirstCharacter);
                // resolve s3 location files as SDK doesn't take in s3 location but inline code
                if (sdkRequestObject.requestMappingTemplateS3Location) {
                    sdkRequestObject.requestMappingTemplate = await fetchFileFromS3(sdkRequestObject.requestMappingTemplateS3Location, sdk);
                    delete sdkRequestObject.requestMappingTemplateS3Location;
                }
                if (sdkRequestObject.responseMappingTemplateS3Location) {
                    sdkRequestObject.responseMappingTemplate = await fetchFileFromS3(sdkRequestObject.responseMappingTemplateS3Location, sdk);
                    delete sdkRequestObject.responseMappingTemplateS3Location;
                }
                if (sdkRequestObject.definitionS3Location) {
                    sdkRequestObject.definition = await fetchFileFromS3(sdkRequestObject.definitionS3Location, sdk);
                    delete sdkRequestObject.definitionS3Location;
                }
                if (sdkRequestObject.codeS3Location) {
                    sdkRequestObject.code = await fetchFileFromS3(sdkRequestObject.codeS3Location, sdk);
                    delete sdkRequestObject.codeS3Location;
                }
                if (isResolver) {
                    await sdk.appsync().updateResolver(sdkRequestObject);
                }
                else if (isFunction) {
                    // Function version is only applicable when using VTL and mapping templates
                    // Runtime only applicable when using code (JS mapping templates)
                    if (sdkRequestObject.code) {
                        delete sdkRequestObject.functionVersion;
                    }
                    else {
                        delete sdkRequestObject.runtime;
                    }
                    const functions = await sdk.appsync().listFunctions({ apiId: sdkRequestObject.apiId });
                    const { functionId } = functions.find((fn) => fn.name === physicalName) ?? {};
                    // Updating multiple functions at the same time or along with graphql schema results in `ConcurrentModificationException`
                    await exponentialBackOffRetry(() => sdk.appsync().updateFunction({
                        ...sdkRequestObject,
                        functionId: functionId,
                    }), 6, 1000, 'ConcurrentModificationException');
                }
                else if (isGraphQLSchema) {
                    let schemaCreationResponse = await sdk
                        .appsync()
                        .startSchemaCreation(sdkRequestObject);
                    while (schemaCreationResponse.status &&
                        ['PROCESSING', 'DELETING'].some((status) => status === schemaCreationResponse.status)) {
                        await sleep(1000); // poll every second
                        const getSchemaCreationStatusRequest = {
                            apiId: sdkRequestObject.apiId,
                        };
                        schemaCreationResponse = await sdk.appsync().getSchemaCreationStatus(getSchemaCreationStatusRequest);
                    }
                    if (schemaCreationResponse.status === 'FAILED') {
                        throw new error_1.ToolkitError(schemaCreationResponse.details ?? 'Schema creation has failed.');
                    }
                }
                else {
                    //isApiKey
                    if (!sdkRequestObject.id) {
                        // ApiKeyId is optional in CFN but required in SDK. Grab the KeyId from physicalArn if not available as part of CFN template
                        const arnParts = physicalName?.split('/');
                        if (arnParts && arnParts.length === 4) {
                            sdkRequestObject.id = arnParts[3];
                        }
                    }
                    await sdk.appsync().updateApiKey(sdkRequestObject);
                }
            },
        });
    }
    return ret;
}
async function fetchFileFromS3(s3Url, sdk) {
    const s3PathParts = s3Url.split('/');
    const s3Bucket = s3PathParts[2]; // first two are "s3:" and "" due to s3://
    const s3Key = s3PathParts.splice(3).join('/'); // after removing first three we reconstruct the key
    return (await sdk.s3().getObject({ Bucket: s3Bucket, Key: s3Key })).Body?.transformToString();
}
async function exponentialBackOffRetry(fn, numOfRetries, backOff, errorCodeToRetry) {
    try {
        await fn();
    }
    catch (error) {
        if (error && error.name === errorCodeToRetry && numOfRetries > 0) {
            await sleep(backOff); // time to wait doubles everytime function fails, starts at 1 second
            await exponentialBackOffRetry(fn, numOfRetries - 1, backOff * 2, errorCodeToRetry);
        }
        else {
            throw error;
        }
    }
}
async function sleep(ms) {
    return new Promise((ok) => setTimeout(ok, ms));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1tYXBwaW5nLXRlbXBsYXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtbWFwcGluZy10ZW1wbGF0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnQkEsa0VBb0pDO0FBaEtELHFDQU1rQjtBQUNsQiwrQ0FBbUQ7QUFLNUMsS0FBSyxVQUFVLDJCQUEyQixDQUMvQyxTQUFpQixFQUNqQixNQUFtQyxFQUNuQyxtQkFBbUQ7SUFFbkQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssd0JBQXdCLENBQUM7SUFDckUsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUsscUNBQXFDLENBQUM7SUFDbEYsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssNkJBQTZCLENBQUM7SUFDL0UsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssc0JBQXNCLENBQUM7SUFDakUsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2hFLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE1BQU0sR0FBRyxHQUF3QixFQUFFLENBQUM7SUFFcEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLHdCQUFlLEVBQUMsTUFBTSxFQUFFO1FBQ2hELHdCQUF3QjtRQUN4QixrQ0FBa0M7UUFDbEMseUJBQXlCO1FBQ3pCLG1DQUFtQztRQUNuQyxNQUFNO1FBQ04sZ0JBQWdCO1FBQ2hCLFlBQVk7UUFDWixzQkFBc0I7UUFDdEIsU0FBUztLQUNWLENBQUMsQ0FBQztJQUNILGlCQUFpQixDQUFDLG9DQUFvQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTVELE1BQU0sMEJBQTBCLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxpQkFB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QUFLLGdCQUFnQixJQUFJLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqRSxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLG9FQUFvRTtZQUMxRixNQUFNLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxZQUFZLEdBQUcsQ0FBQyxFQUFFLE9BQU8sR0FBRyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNyRixDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQsS0FBSyxVQUFVLEtBQUssQ0FBQyxFQUFVO0lBQzdCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNqRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUge1xuICBHZXRTY2hlbWFDcmVhdGlvblN0YXR1c0NvbW1hbmRPdXRwdXQsXG4gIEdldFNjaGVtYUNyZWF0aW9uU3RhdHVzQ29tbWFuZElucHV0LFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtYXBwc3luYyc7XG5pbXBvcnQge1xuICB0eXBlIENoYW5nZUhvdHN3YXBSZXN1bHQsXG4gIGNsYXNzaWZ5Q2hhbmdlcyxcbiAgdHlwZSBIb3Rzd2FwcGFibGVDaGFuZ2VDYW5kaWRhdGUsXG4gIGxvd2VyQ2FzZUZpcnN0Q2hhcmFjdGVyLFxuICB0cmFuc2Zvcm1PYmplY3RLZXlzLFxufSBmcm9tICcuL2NvbW1vbic7XG5pbXBvcnQgeyBUb29sa2l0RXJyb3IgfSBmcm9tICcuLi8uLi90b29sa2l0L2Vycm9yJztcbmltcG9ydCB0eXBlIHsgU0RLIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuXG5pbXBvcnQgdHlwZSB7IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSB9IGZyb20gJy4uL2V2YWx1YXRlLWNsb3VkZm9ybWF0aW9uLXRlbXBsYXRlJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGlzSG90c3dhcHBhYmxlQXBwU3luY0NoYW5nZShcbiAgbG9naWNhbElkOiBzdHJpbmcsXG4gIGNoYW5nZTogSG90c3dhcHBhYmxlQ2hhbmdlQ2FuZGlkYXRlLFxuICBldmFsdWF0ZUNmblRlbXBsYXRlOiBFdmFsdWF0ZUNsb3VkRm9ybWF0aW9uVGVtcGxhdGUsXG4pOiBQcm9taXNlPENoYW5nZUhvdHN3YXBSZXN1bHQ+IHtcbiAgY29uc3QgaXNSZXNvbHZlciA9IGNoYW5nZS5uZXdWYWx1ZS5UeXBlID09PSAnQVdTOjpBcHBTeW5jOjpSZXNvbHZlcic7XG4gIGNvbnN0IGlzRnVuY3Rpb24gPSBjaGFuZ2UubmV3VmFsdWUuVHlwZSA9PT0gJ0FXUzo6QXBwU3luYzo6RnVuY3Rpb25Db25maWd1cmF0aW9uJztcbiAgY29uc3QgaXNHcmFwaFFMU2NoZW1hID0gY2hhbmdlLm5ld1ZhbHVlLlR5cGUgPT09ICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxTY2hlbWEnO1xuICBjb25zdCBpc0FQSUtleSA9IGNoYW5nZS5uZXdWYWx1ZS5UeXBlID09PSAnQVdTOjpBcHBTeW5jOjpBcGlLZXknO1xuICBpZiAoIWlzUmVzb2x2ZXIgJiYgIWlzRnVuY3Rpb24gJiYgIWlzR3JhcGhRTFNjaGVtYSAmJiAhaXNBUElLZXkpIHtcbiAgICByZXR1cm4gW107XG4gIH1cblxuICBjb25zdCByZXQ6IENoYW5nZUhvdHN3YXBSZXN1bHQgPSBbXTtcblxuICBjb25zdCBjbGFzc2lmaWVkQ2hhbmdlcyA9IGNsYXNzaWZ5Q2hhbmdlcyhjaGFuZ2UsIFtcbiAgICAnUmVxdWVzdE1hcHBpbmdUZW1wbGF0ZScsXG4gICAgJ1JlcXVlc3RNYXBwaW5nVGVtcGxhdGVTM0xvY2F0aW9uJyxcbiAgICAnUmVzcG9uc2VNYXBwaW5nVGVtcGxhdGUnLFxuICAgICdSZXNwb25zZU1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb24nLFxuICAgICdDb2RlJyxcbiAgICAnQ29kZVMzTG9jYXRpb24nLFxuICAgICdEZWZpbml0aW9uJyxcbiAgICAnRGVmaW5pdGlvblMzTG9jYXRpb24nLFxuICAgICdFeHBpcmVzJyxcbiAgXSk7XG4gIGNsYXNzaWZpZWRDaGFuZ2VzLnJlcG9ydE5vbkhvdHN3YXBwYWJsZVByb3BlcnR5Q2hhbmdlcyhyZXQpO1xuXG4gIGNvbnN0IG5hbWVzT2ZIb3Rzd2FwcGFibGVDaGFuZ2VzID0gT2JqZWN0LmtleXMoY2xhc3NpZmllZENoYW5nZXMuaG90c3dhcHBhYmxlUHJvcHMpO1xuICBpZiAobmFtZXNPZkhvdHN3YXBwYWJsZUNoYW5nZXMubGVuZ3RoID4gMCkge1xuICAgIGxldCBwaHlzaWNhbE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCBhcm4gPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmVzdGFibGlzaFJlc291cmNlUGh5c2ljYWxOYW1lKFxuICAgICAgbG9naWNhbElkLFxuICAgICAgaXNGdW5jdGlvbiA/IGNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzPy5OYW1lIDogdW5kZWZpbmVkLFxuICAgICk7XG4gICAgaWYgKGlzUmVzb2x2ZXIpIHtcbiAgICAgIGNvbnN0IGFyblBhcnRzID0gYXJuPy5zcGxpdCgnLycpO1xuICAgICAgcGh5c2ljYWxOYW1lID0gYXJuUGFydHMgPyBgJHthcm5QYXJ0c1szXX0uJHthcm5QYXJ0c1s1XX1gIDogdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBwaHlzaWNhbE5hbWUgPSBhcm47XG4gICAgfVxuICAgIHJldC5wdXNoKHtcbiAgICAgIGhvdHN3YXBwYWJsZTogdHJ1ZSxcbiAgICAgIHJlc291cmNlVHlwZTogY2hhbmdlLm5ld1ZhbHVlLlR5cGUsXG4gICAgICBwcm9wc0NoYW5nZWQ6IG5hbWVzT2ZIb3Rzd2FwcGFibGVDaGFuZ2VzLFxuICAgICAgc2VydmljZTogJ2FwcHN5bmMnLFxuICAgICAgcmVzb3VyY2VOYW1lczogW2Ake2NoYW5nZS5uZXdWYWx1ZS5UeXBlfSAnJHtwaHlzaWNhbE5hbWV9J2BdLFxuICAgICAgYXBwbHk6IGFzeW5jIChzZGs6IFNESykgPT4ge1xuICAgICAgICBpZiAoIXBoeXNpY2FsTmFtZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNka1Byb3BlcnRpZXM6IHsgW25hbWU6IHN0cmluZ106IGFueSB9ID0ge1xuICAgICAgICAgIC4uLmNoYW5nZS5vbGRWYWx1ZS5Qcm9wZXJ0aWVzLFxuICAgICAgICAgIERlZmluaXRpb246IGNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzPy5EZWZpbml0aW9uLFxuICAgICAgICAgIERlZmluaXRpb25TM0xvY2F0aW9uOiBjaGFuZ2UubmV3VmFsdWUuUHJvcGVydGllcz8uRGVmaW5pdGlvblMzTG9jYXRpb24sXG4gICAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZTogY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/LlJlcXVlc3RNYXBwaW5nVGVtcGxhdGUsXG4gICAgICAgICAgcmVxdWVzdE1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb246IGNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzPy5SZXF1ZXN0TWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbixcbiAgICAgICAgICByZXNwb25zZU1hcHBpbmdUZW1wbGF0ZTogY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/LlJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlLFxuICAgICAgICAgIHJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbjogY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/LlJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbixcbiAgICAgICAgICBjb2RlOiBjaGFuZ2UubmV3VmFsdWUuUHJvcGVydGllcz8uQ29kZSxcbiAgICAgICAgICBjb2RlUzNMb2NhdGlvbjogY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/LkNvZGVTM0xvY2F0aW9uLFxuICAgICAgICAgIGV4cGlyZXM6IGNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzPy5FeHBpcmVzLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBldmFsdWF0ZWRSZXNvdXJjZVByb3BlcnRpZXMgPSBhd2FpdCBldmFsdWF0ZUNmblRlbXBsYXRlLmV2YWx1YXRlQ2ZuRXhwcmVzc2lvbihzZGtQcm9wZXJ0aWVzKTtcbiAgICAgICAgY29uc3Qgc2RrUmVxdWVzdE9iamVjdCA9IHRyYW5zZm9ybU9iamVjdEtleXMoZXZhbHVhdGVkUmVzb3VyY2VQcm9wZXJ0aWVzLCBsb3dlckNhc2VGaXJzdENoYXJhY3Rlcik7XG5cbiAgICAgICAgLy8gcmVzb2x2ZSBzMyBsb2NhdGlvbiBmaWxlcyBhcyBTREsgZG9lc24ndCB0YWtlIGluIHMzIGxvY2F0aW9uIGJ1dCBpbmxpbmUgY29kZVxuICAgICAgICBpZiAoc2RrUmVxdWVzdE9iamVjdC5yZXF1ZXN0TWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbikge1xuICAgICAgICAgIHNka1JlcXVlc3RPYmplY3QucmVxdWVzdE1hcHBpbmdUZW1wbGF0ZSA9IGF3YWl0IGZldGNoRmlsZUZyb21TMyhcbiAgICAgICAgICAgIHNka1JlcXVlc3RPYmplY3QucmVxdWVzdE1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb24sXG4gICAgICAgICAgICBzZGssXG4gICAgICAgICAgKTtcbiAgICAgICAgICBkZWxldGUgc2RrUmVxdWVzdE9iamVjdC5yZXF1ZXN0TWFwcGluZ1RlbXBsYXRlUzNMb2NhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2RrUmVxdWVzdE9iamVjdC5yZXNwb25zZU1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb24pIHtcbiAgICAgICAgICBzZGtSZXF1ZXN0T2JqZWN0LnJlc3BvbnNlTWFwcGluZ1RlbXBsYXRlID0gYXdhaXQgZmV0Y2hGaWxlRnJvbVMzKFxuICAgICAgICAgICAgc2RrUmVxdWVzdE9iamVjdC5yZXNwb25zZU1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb24sXG4gICAgICAgICAgICBzZGssXG4gICAgICAgICAgKTtcbiAgICAgICAgICBkZWxldGUgc2RrUmVxdWVzdE9iamVjdC5yZXNwb25zZU1hcHBpbmdUZW1wbGF0ZVMzTG9jYXRpb247XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNka1JlcXVlc3RPYmplY3QuZGVmaW5pdGlvblMzTG9jYXRpb24pIHtcbiAgICAgICAgICBzZGtSZXF1ZXN0T2JqZWN0LmRlZmluaXRpb24gPSBhd2FpdCBmZXRjaEZpbGVGcm9tUzMoc2RrUmVxdWVzdE9iamVjdC5kZWZpbml0aW9uUzNMb2NhdGlvbiwgc2RrKTtcbiAgICAgICAgICBkZWxldGUgc2RrUmVxdWVzdE9iamVjdC5kZWZpbml0aW9uUzNMb2NhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2RrUmVxdWVzdE9iamVjdC5jb2RlUzNMb2NhdGlvbikge1xuICAgICAgICAgIHNka1JlcXVlc3RPYmplY3QuY29kZSA9IGF3YWl0IGZldGNoRmlsZUZyb21TMyhzZGtSZXF1ZXN0T2JqZWN0LmNvZGVTM0xvY2F0aW9uLCBzZGspO1xuICAgICAgICAgIGRlbGV0ZSBzZGtSZXF1ZXN0T2JqZWN0LmNvZGVTM0xvY2F0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzUmVzb2x2ZXIpIHtcbiAgICAgICAgICBhd2FpdCBzZGsuYXBwc3luYygpLnVwZGF0ZVJlc29sdmVyKHNka1JlcXVlc3RPYmplY3QpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24pIHtcbiAgICAgICAgICAvLyBGdW5jdGlvbiB2ZXJzaW9uIGlzIG9ubHkgYXBwbGljYWJsZSB3aGVuIHVzaW5nIFZUTCBhbmQgbWFwcGluZyB0ZW1wbGF0ZXNcbiAgICAgICAgICAvLyBSdW50aW1lIG9ubHkgYXBwbGljYWJsZSB3aGVuIHVzaW5nIGNvZGUgKEpTIG1hcHBpbmcgdGVtcGxhdGVzKVxuICAgICAgICAgIGlmIChzZGtSZXF1ZXN0T2JqZWN0LmNvZGUpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBzZGtSZXF1ZXN0T2JqZWN0LmZ1bmN0aW9uVmVyc2lvbjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHNka1JlcXVlc3RPYmplY3QucnVudGltZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBmdW5jdGlvbnMgPSBhd2FpdCBzZGsuYXBwc3luYygpLmxpc3RGdW5jdGlvbnMoeyBhcGlJZDogc2RrUmVxdWVzdE9iamVjdC5hcGlJZCB9KTtcbiAgICAgICAgICBjb25zdCB7IGZ1bmN0aW9uSWQgfSA9IGZ1bmN0aW9ucy5maW5kKChmbikgPT4gZm4ubmFtZSA9PT0gcGh5c2ljYWxOYW1lKSA/PyB7fTtcbiAgICAgICAgICAvLyBVcGRhdGluZyBtdWx0aXBsZSBmdW5jdGlvbnMgYXQgdGhlIHNhbWUgdGltZSBvciBhbG9uZyB3aXRoIGdyYXBocWwgc2NoZW1hIHJlc3VsdHMgaW4gYENvbmN1cnJlbnRNb2RpZmljYXRpb25FeGNlcHRpb25gXG4gICAgICAgICAgYXdhaXQgZXhwb25lbnRpYWxCYWNrT2ZmUmV0cnkoXG4gICAgICAgICAgICAoKSA9PlxuICAgICAgICAgICAgICBzZGsuYXBwc3luYygpLnVwZGF0ZUZ1bmN0aW9uKHtcbiAgICAgICAgICAgICAgICAuLi5zZGtSZXF1ZXN0T2JqZWN0LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uSWQ6IGZ1bmN0aW9uSWQsXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgNixcbiAgICAgICAgICAgIDEwMDAsXG4gICAgICAgICAgICAnQ29uY3VycmVudE1vZGlmaWNhdGlvbkV4Y2VwdGlvbicsXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0dyYXBoUUxTY2hlbWEpIHtcbiAgICAgICAgICBsZXQgc2NoZW1hQ3JlYXRpb25SZXNwb25zZTogR2V0U2NoZW1hQ3JlYXRpb25TdGF0dXNDb21tYW5kT3V0cHV0ID0gYXdhaXQgc2RrXG4gICAgICAgICAgICAuYXBwc3luYygpXG4gICAgICAgICAgICAuc3RhcnRTY2hlbWFDcmVhdGlvbihzZGtSZXF1ZXN0T2JqZWN0KTtcbiAgICAgICAgICB3aGlsZSAoXG4gICAgICAgICAgICBzY2hlbWFDcmVhdGlvblJlc3BvbnNlLnN0YXR1cyAmJlxuICAgICAgICAgICAgWydQUk9DRVNTSU5HJywgJ0RFTEVUSU5HJ10uc29tZSgoc3RhdHVzKSA9PiBzdGF0dXMgPT09IHNjaGVtYUNyZWF0aW9uUmVzcG9uc2Uuc3RhdHVzKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgYXdhaXQgc2xlZXAoMTAwMCk7IC8vIHBvbGwgZXZlcnkgc2Vjb25kXG4gICAgICAgICAgICBjb25zdCBnZXRTY2hlbWFDcmVhdGlvblN0YXR1c1JlcXVlc3Q6IEdldFNjaGVtYUNyZWF0aW9uU3RhdHVzQ29tbWFuZElucHV0ID0ge1xuICAgICAgICAgICAgICBhcGlJZDogc2RrUmVxdWVzdE9iamVjdC5hcGlJZCxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2hlbWFDcmVhdGlvblJlc3BvbnNlID0gYXdhaXQgc2RrLmFwcHN5bmMoKS5nZXRTY2hlbWFDcmVhdGlvblN0YXR1cyhnZXRTY2hlbWFDcmVhdGlvblN0YXR1c1JlcXVlc3QpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2NoZW1hQ3JlYXRpb25SZXNwb25zZS5zdGF0dXMgPT09ICdGQUlMRUQnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKHNjaGVtYUNyZWF0aW9uUmVzcG9uc2UuZGV0YWlscyA/PyAnU2NoZW1hIGNyZWF0aW9uIGhhcyBmYWlsZWQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vaXNBcGlLZXlcbiAgICAgICAgICBpZiAoIXNka1JlcXVlc3RPYmplY3QuaWQpIHtcbiAgICAgICAgICAgIC8vIEFwaUtleUlkIGlzIG9wdGlvbmFsIGluIENGTiBidXQgcmVxdWlyZWQgaW4gU0RLLiBHcmFiIHRoZSBLZXlJZCBmcm9tIHBoeXNpY2FsQXJuIGlmIG5vdCBhdmFpbGFibGUgYXMgcGFydCBvZiBDRk4gdGVtcGxhdGVcbiAgICAgICAgICAgIGNvbnN0IGFyblBhcnRzID0gcGh5c2ljYWxOYW1lPy5zcGxpdCgnLycpO1xuICAgICAgICAgICAgaWYgKGFyblBhcnRzICYmIGFyblBhcnRzLmxlbmd0aCA9PT0gNCkge1xuICAgICAgICAgICAgICBzZGtSZXF1ZXN0T2JqZWN0LmlkID0gYXJuUGFydHNbM107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGF3YWl0IHNkay5hcHBzeW5jKCkudXBkYXRlQXBpS2V5KHNka1JlcXVlc3RPYmplY3QpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hGaWxlRnJvbVMzKHMzVXJsOiBzdHJpbmcsIHNkazogU0RLKSB7XG4gIGNvbnN0IHMzUGF0aFBhcnRzID0gczNVcmwuc3BsaXQoJy8nKTtcbiAgY29uc3QgczNCdWNrZXQgPSBzM1BhdGhQYXJ0c1syXTsgLy8gZmlyc3QgdHdvIGFyZSBcInMzOlwiIGFuZCBcIlwiIGR1ZSB0byBzMzovL1xuICBjb25zdCBzM0tleSA9IHMzUGF0aFBhcnRzLnNwbGljZSgzKS5qb2luKCcvJyk7IC8vIGFmdGVyIHJlbW92aW5nIGZpcnN0IHRocmVlIHdlIHJlY29uc3RydWN0IHRoZSBrZXlcbiAgcmV0dXJuIChhd2FpdCBzZGsuczMoKS5nZXRPYmplY3QoeyBCdWNrZXQ6IHMzQnVja2V0LCBLZXk6IHMzS2V5IH0pKS5Cb2R5Py50cmFuc2Zvcm1Ub1N0cmluZygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleHBvbmVudGlhbEJhY2tPZmZSZXRyeShmbjogKCkgPT4gUHJvbWlzZTxhbnk+LCBudW1PZlJldHJpZXM6IG51bWJlciwgYmFja09mZjogbnVtYmVyLCBlcnJvckNvZGVUb1JldHJ5OiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmbigpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgaWYgKGVycm9yICYmIGVycm9yLm5hbWUgPT09IGVycm9yQ29kZVRvUmV0cnkgJiYgbnVtT2ZSZXRyaWVzID4gMCkge1xuICAgICAgYXdhaXQgc2xlZXAoYmFja09mZik7IC8vIHRpbWUgdG8gd2FpdCBkb3VibGVzIGV2ZXJ5dGltZSBmdW5jdGlvbiBmYWlscywgc3RhcnRzIGF0IDEgc2Vjb25kXG4gICAgICBhd2FpdCBleHBvbmVudGlhbEJhY2tPZmZSZXRyeShmbiwgbnVtT2ZSZXRyaWVzIC0gMSwgYmFja09mZiAqIDIsIGVycm9yQ29kZVRvUmV0cnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlcikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKG9rKSA9PiBzZXRUaW1lb3V0KG9rLCBtcykpO1xufVxuIl19