"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_BY_CFN = void 0;
exports.isHotswappableS3BucketDeploymentChange = isHotswappableS3BucketDeploymentChange;
exports.skipChangeForS3DeployCustomResourcePolicy = skipChangeForS3DeployCustomResourcePolicy;
/**
 * This means that the value is required to exist by CloudFormation's Custom Resource API (or our S3 Bucket Deployment Lambda's API)
 * but the actual value specified is irrelevant
 */
exports.REQUIRED_BY_CFN = 'required-to-be-present-by-cfn';
async function isHotswappableS3BucketDeploymentChange(_logicalId, change, evaluateCfnTemplate) {
    // In old-style synthesis, the policy used by the lambda to copy assets Ref's the assets directly,
    // meaning that the changes made to the Policy are artifacts that can be safely ignored
    const ret = [];
    if (change.newValue.Type !== 'Custom::CDKBucketDeployment') {
        return [];
    }
    // no classification to be done here; all the properties of this custom resource thing are hotswappable
    const customResourceProperties = await evaluateCfnTemplate.evaluateCfnExpression({
        ...change.newValue.Properties,
        ServiceToken: undefined,
    });
    ret.push({
        hotswappable: true,
        resourceType: change.newValue.Type,
        propsChanged: ['*'],
        service: 'custom-s3-deployment',
        resourceNames: [`Contents of S3 Bucket '${customResourceProperties.DestinationBucketName}'`],
        apply: async (sdk) => {
            // note that this gives the ARN of the lambda, not the name. This is fine though, the invoke() sdk call will take either
            const functionName = await evaluateCfnTemplate.evaluateCfnExpression(change.newValue.Properties?.ServiceToken);
            if (!functionName) {
                return;
            }
            await sdk.lambda().invokeCommand({
                FunctionName: functionName,
                // Lambda refuses to take a direct JSON object and requires it to be stringify()'d
                Payload: JSON.stringify({
                    RequestType: 'Update',
                    ResponseURL: exports.REQUIRED_BY_CFN,
                    PhysicalResourceId: exports.REQUIRED_BY_CFN,
                    StackId: exports.REQUIRED_BY_CFN,
                    RequestId: exports.REQUIRED_BY_CFN,
                    LogicalResourceId: exports.REQUIRED_BY_CFN,
                    ResourceProperties: stringifyObject(customResourceProperties), // JSON.stringify() doesn't turn the actual objects to strings, but the lambda expects strings
                }),
            });
        },
    });
    return ret;
}
async function skipChangeForS3DeployCustomResourcePolicy(iamPolicyLogicalId, change, evaluateCfnTemplate) {
    if (change.newValue.Type !== 'AWS::IAM::Policy') {
        return false;
    }
    const roles = change.newValue.Properties?.Roles;
    // If no roles are referenced, the policy is definitely not used for a S3Deployment
    if (!roles || !roles.length) {
        return false;
    }
    // Check if every role this policy is referenced by is only used for a S3Deployment
    for (const role of roles) {
        const roleArn = await evaluateCfnTemplate.evaluateCfnExpression(role);
        const roleLogicalId = await evaluateCfnTemplate.findLogicalIdForPhysicalName(roleArn);
        // We must assume this role is used for something else, because we can't check it
        if (!roleLogicalId) {
            return false;
        }
        // Find all interesting reference to the role
        const roleRefs = evaluateCfnTemplate
            .findReferencesTo(roleLogicalId)
            // we are not interested in the reference from the original policy - it always exists
            .filter((roleRef) => !(roleRef.Type == 'AWS::IAM::Policy' && roleRef.LogicalId === iamPolicyLogicalId));
        // Check if the role is only used for S3Deployment
        // We know this is the case, if S3Deployment -> Lambda -> Role is satisfied for every reference
        // And we have at least one reference.
        const isRoleOnlyForS3Deployment = roleRefs.length >= 1 &&
            roleRefs.every((roleRef) => {
                if (roleRef.Type === 'AWS::Lambda::Function') {
                    const lambdaRefs = evaluateCfnTemplate.findReferencesTo(roleRef.LogicalId);
                    // Every reference must be to the custom resource and at least one reference must be present
                    return (lambdaRefs.length >= 1 && lambdaRefs.every((lambdaRef) => lambdaRef.Type === 'Custom::CDKBucketDeployment'));
                }
                return false;
            });
        // We have determined this role is used for something else, so we can't skip the change
        if (!isRoleOnlyForS3Deployment) {
            return false;
        }
    }
    // We have checked that any use of this policy is only for S3Deployment and we can safely skip it
    return true;
}
function stringifyObject(obj) {
    if (obj == null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(stringifyObject);
    }
    if (typeof obj !== 'object') {
        return obj.toString();
    }
    const ret = {};
    for (const [k, v] of Object.entries(obj)) {
        ret[k] = stringifyObject(v);
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiczMtYnVja2V0LWRlcGxveW1lbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiczMtYnVja2V0LWRlcGxveW1lbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQVVBLHdGQWlEQztBQUVELDhGQXVEQztBQWhIRDs7O0dBR0c7QUFDVSxRQUFBLGVBQWUsR0FBRywrQkFBK0IsQ0FBQztBQUV4RCxLQUFLLFVBQVUsc0NBQXNDLENBQzFELFVBQWtCLEVBQ2xCLE1BQW1DLEVBQ25DLG1CQUFtRDtJQUVuRCxrR0FBa0c7SUFDbEcsdUZBQXVGO0lBQ3ZGLE1BQU0sR0FBRyxHQUF3QixFQUFFLENBQUM7SUFFcEMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyw2QkFBNkIsRUFBRSxDQUFDO1FBQzNELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELHVHQUF1RztJQUN2RyxNQUFNLHdCQUF3QixHQUFHLE1BQU0sbUJBQW1CLENBQUMscUJBQXFCLENBQUM7UUFDL0UsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVU7UUFDN0IsWUFBWSxFQUFFLFNBQVM7S0FDeEIsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNQLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFlBQVksRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUk7UUFDbEMsWUFBWSxFQUFFLENBQUMsR0FBRyxDQUFDO1FBQ25CLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsYUFBYSxFQUFFLENBQUMsMEJBQTBCLHdCQUF3QixDQUFDLHFCQUFxQixHQUFHLENBQUM7UUFDNUYsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFRLEVBQUUsRUFBRTtZQUN4Qix3SEFBd0g7WUFDeEgsTUFBTSxZQUFZLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztZQUMvRyxJQUFJLENB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LGVBQWUsQ0FBQyxHQUFRO0lBQy9CLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ2hCLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUNELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBQ0QsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM1QixPQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRUQsTUFBTSxHQUFHLEdBQXlCLEVBQUUsQ0FBQztJQUNyQyxLQUFLLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3pDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQ2hhbmdlSG90c3dhcFJlc3VsdCwgSG90c3dhcHBhYmxlQ2hhbmdlQ2FuZGlkYXRlIH0gZnJvbSAnLi9jb21tb24nO1xuaW1wb3J0IHR5cGUgeyBTREsgfSBmcm9tICcuLi9hd3MtYXV0aCc7XG5pbXBvcnQgdHlwZSB7IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSB9IGZyb20gJy4uL2V2YWx1YXRlLWNsb3VkZm9ybWF0aW9uLXRlbXBsYXRlJztcblxuLyoqXG4gKiBUaGlzIG1lYW5zIHRoYXQgdGhlIHZhbHVlIGlzIHJlcXVpcmVkIHRvIGV4aXN0IGJ5IENsb3VkRm9ybWF0aW9uJ3MgQ3VzdG9tIFJlc291cmNlIEFQSSAob3Igb3VyIFMzIEJ1Y2tldCBEZXBsb3ltZW50IExhbWJkYSdzIEFQSSlcbiAqIGJ1dCB0aGUgYWN0dWFsIHZhbHVlIHNwZWNpZmllZCBpcyBpcnJlbGV2YW50XG4gKi9cbmV4cG9ydCBjb25zdCBSRVFVSVJFRF9CWV9DRk4gPSAncmVxdWlyZWQtdG8tYmUtcHJlc2VudC1ieS1jZm4nO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNIb3Rzd2FwcGFibGVTM0J1Y2tldERlcGxveW1lbnRDaGFuZ2UoXG4gIF9sb2dpY2FsSWQ6IHN0cmluZyxcbiAgY2hhbmdlOiBIb3Rzd2FwcGFibGVDaGFuZ2VDYW5kaWRhdGUsXG4gIGV2YWx1YXRlQ2ZuVGVtcGxhdGU6IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSxcbik6IFByb21pc2U8Q2hhbmdlSG90c3dhcFJlc3VsdD4ge1xuICAvLyBJbiBvbGQtc3R5bGUgc3ludGhlc2lzLCB0aGUgcG9saWN5IHVzZWQgYnkgdGhlIGxhbWJkYSB0byBjb3B5IGFzc2V0cyBSZWYncyB0aGUgYXNzZXRzIGRpcmVjdGx5LFxuICAvLyBtZWFuaW5nIHRoYXQgdGhlIGNoYW5nZXMgbWFkZSB0byB0aGUgUG9saWN5IGFyZSBhcnRpZmFjdHMgdGhhdCBjYW4gYmUgc2FmZWx5IGlnbm9yZWRcbiAgY29uc3QgcmV0OiBDaGFuZ2VIb3Rzd2FwUmVzdWx0ID0gW107XG5cbiAgaWYgKGNoYW5nZS5uZXdWYWx1ZS5UeXBlICE9PSAnQ3VzdG9tOjpDREtCdWNrZXREZXBsb3ltZW50Jykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8vIG5vIGNsYXNzaWZpY2F0aW9uIHRvIGJlIGRvbmUgaGVyZTsgYWxsIHRoZSBwcm9wZXJ0aWVzIG9mIHRoaXMgY3VzdG9tIHJlc291cmNlIHRoaW5nIGFyZSBob3Rzd2FwcGFibGVcbiAgY29uc3QgY3VzdG9tUmVzb3VyY2VQcm9wZXJ0aWVzID0gYXdhaXQgZXZhbHVhdGVDZm5UZW1wbGF0ZS5ldmFsdWF0ZUNmbkV4cHJlc3Npb24oe1xuICAgIC4uLmNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzLFxuICAgIFNlcnZpY2VUb2tlbjogdW5kZWZpbmVkLFxuICB9KTtcblxuICByZXQucHVzaCh7XG4gICAgaG90c3dhcHBhYmxlOiB0cnVlLFxuICAgIHJlc291cmNlVHlwZTogY2hhbmdlLm5ld1ZhbHVlLlR5cGUsXG4gICAgcHJvcHNDaGFuZ2VkOiBbJyonXSxcbiAgICBzZXJ2aWNlOiAnY3VzdG9tLXMzLWRlcGxveW1lbnQnLFxuICAgIHJlc291cmNlTmFtZXM6IFtgQ29udGVudHMgb2YgUzMgQnVja2V0ICcke2N1c3RvbVJlc291cmNlUHJvcGVydGllcy5EZXN0aW5hdGlvbkJ1Y2tldE5hbWV9J2BdLFxuICAgIGFwcGx5OiBhc3luYyAoc2RrOiBTREspID0+IHtcbiAgICAgIC8vIG5vdGUgdGhhdCB0aGlzIGdpdmVzIHRoZSBBUk4gb2YgdGhlIGxhbWJkYSwgbm90IHRoZSBuYW1lLiBUaGlzIGlzIGZpbmUgdGhvdWdoLCB0aGUgaW52b2tlKCkgc2RrIGNhbGwgd2lsbCB0YWtlIGVpdGhlclxuICAgICAgY29uc3QgZnVuY3Rpb25OYW1lID0gYXdhaXQgZXZhbHVhdGVDZm5UZW1wbGF0ZS5ldmFsdWF0ZUNmbkV4cHJlc3Npb24oY2hhbmdlLm5ld1ZhbHVlLlByb3BlcnRpZXM/LlNlcnZpY2VUb2tlbik7XG4gICAgICBpZiAoIWZ1bmN0aW9uTmFtZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHNkay5sYW1iZGEoKS5pbnZva2VDb21tYW5kKHtcbiAgICAgICAgRnVuY3Rpb25OYW1lOiBmdW5jdGlvbk5hbWUsXG4gICAgICAgIC8vIExhbWJkYSByZWZ1c2VzIHRvIHRha2UgYSBkaXJlY3QgSlNPTiBvYmplY3QgYW5kIHJlcXVpcmVzIGl0IHRvIGJlIHN0cmluZ2lmeSgpJ2RcbiAgICAgICAgUGF5bG9hZDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIFJlcXVlc3RUeXBlOiAnVXBkYXRlJyxcbiAgICAgICAgICBSZXNwb25zZVVSTDogUkVRVUlSRURfQllfQ0ZOLFxuICAgICAgICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogUkVRVUlSRURfQllfQ0ZOLFxuICAgICAgICAgIFN0YWNrSWQ6IFJFUVVJUkVEX0JZX0NGTixcbiAgICAgICAgICBSZXF1ZXN0SWQ6IFJFUVVJUkVEX0JZX0NGTixcbiAgICAgICAgICBMb2dpY2FsUmVzb3VyY2VJZDogUkVRVUlSRURfQllfQ0ZOLFxuICAgICAgICAgIFJlc291cmNlUHJvcGVydGllczogc3RyaW5naWZ5T2JqZWN0KGN1c3RvbVJlc291cmNlUHJvcGVydGllcyksIC8vIEpTT04uc3RyaW5naWZ5KCkgZG9lc24ndCB0dXJuIHRoZSBhY3R1YWwgb2JqZWN0cyB0byBzdHJpbmdzLCBidXQgdGhlIGxhbWJkYSBleHBlY3RzIHN0cmluZ3NcbiAgICAgICAgfSksXG4gICAgICB9KTtcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gcmV0O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2tpcENoYW5nZUZvclMzRGVwbG95Q3VzdG9tUmVzb3VyY2VQb2xpY3koXG4gIGlhbVBvbGljeUxvZ2ljYWxJZDogc3RyaW5nLFxuICBjaGFuZ2U6IEhvdHN3YXBwYWJsZUNoYW5nZUNhbmRpZGF0ZSxcbiAgZXZhbHVhdGVDZm5UZW1wbGF0ZTogRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChjaGFuZ2UubmV3VmFsdWUuVHlwZSAhPT0gJ0FXUzo6SUFNOjpQb2xpY3knKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHJvbGVzOiBzdHJpbmdbXSA9IGNoYW5nZS5uZXdWYWx1ZS5Qcm9wZXJ0aWVzPy5Sb2xlcztcblxuICAvLyBJZiBubyByb2xlcyBhcmUgcmVmZXJlbmNlZCwgdGhlIHBvbGljeSBpcyBkZWZpbml0ZWx5IG5vdCB1c2VkIGZvciBhIFMzRGVwbG95bWVudFxuICBpZiAoIXJvbGVzIHx8ICFyb2xlcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBDaGVjayBpZiBldmVyeSByb2xlIHRoaXMgcG9saWN5IGlzIHJlZmVyZW5jZWQgYnkgaXMgb25seSB1c2VkIGZvciBhIFMzRGVwbG95bWVudFxuICBmb3IgKGNvbnN0IHJvbGUgb2Ygcm9sZXMpIHtcbiAgICBjb25zdCByb2xlQXJuID0gYXdhaXQgZXZhbHVhdGVDZm5UZW1wbGF0ZS5ldmFsdWF0ZUNmbkV4cHJlc3Npb24ocm9sZSk7XG4gICAgY29uc3Qgcm9sZUxvZ2ljYWxJZCA9IGF3YWl0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUuZmluZExvZ2ljYWxJZEZvclBoeXNpY2FsTmFtZShyb2xlQXJuKTtcblxuICAgIC8vIFdlIG11c3QgYXNzdW1lIHRoaXMgcm9sZSBpcyB1c2VkIGZvciBzb21ldGhpbmcgZWxzZSwgYmVjYXVzZSB3ZSBjYW4ndCBjaGVjayBpdFxuICAgIGlmICghcm9sZUxvZ2ljYWxJZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEZpbmQgYWxsIGludGVyZXN0aW5nIHJlZmVyZW5jZSB0byB0aGUgcm9sZVxuICAgIGNvbnN0IHJvbGVSZWZzID0gZXZhbHVhdGVDZm5UZW1wbGF0ZVxuICAgICAgLmZpbmRSZWZlcmVuY2VzVG8ocm9sZUxvZ2ljYWxJZClcbiAgICAgIC8vIHdlIGFyZSBub3QgaW50ZXJlc3RlZCBpbiB0aGUgcmVmZXJlbmNlIGZyb20gdGhlIG9yaWdpbmFsIHBvbGljeSAtIGl0IGFsd2F5cyBleGlzdHNcbiAgICAgIC5maWx0ZXIoKHJvbGVSZWYpID0+ICEocm9sZVJlZi5UeXBlID09ICdBV1M6OklBTTo6UG9saWN5JyAmJiByb2xlUmVmLkxvZ2ljYWxJZCA9PT0gaWFtUG9saWN5TG9naWNhbElkKSk7XG5cbiAgICAvLyBDaGVjayBpZiB0aGUgcm9sZSBpcyBvbmx5IHVzZWQgZm9yIFMzRGVwbG95bWVudFxuICAgIC8vIFdlIGtub3cgdGhpcyBpcyB0aGUgY2FzZSwgaWYgUzNEZXBsb3ltZW50IC0+IExhbWJkYSAtPiBSb2xlIGlzIHNhdGlzZmllZCBmb3IgZXZlcnkgcmVmZXJlbmNlXG4gICAgLy8gQW5kIHdlIGhhdmUgYXQgbGVhc3Qgb25lIHJlZmVyZW5jZS5cbiAgICBjb25zdCBpc1JvbGVPbmx5Rm9yUzNEZXBsb3ltZW50ID1cbiAgICAgIHJvbGVSZWZzLmxlbmd0aCA+PSAxICYmXG4gICAgICByb2xlUmVmcy5ldmVyeSgocm9sZVJlZikgPT4ge1xuICAgICAgICBpZiAocm9sZVJlZi5UeXBlID09PSAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJykge1xuICAgICAgICAgIGNvbnN0IGxhbWJkYVJlZnMgPSBldmFsdWF0ZUNmblRlbXBsYXRlLmZpbmRSZWZlcmVuY2VzVG8ocm9sZVJlZi5Mb2dpY2FsSWQpO1xuICAgICAgICAgIC8vIEV2ZXJ5IHJlZmVyZW5jZSBtdXN0IGJlIHRvIHRoZSBjdXN0b20gcmVzb3VyY2UgYW5kIGF0IGxlYXN0IG9uZSByZWZlcmVuY2UgbXVzdCBiZSBwcmVzZW50XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIGxhbWJkYVJlZnMubGVuZ3RoID49IDEgJiYgbGFtYmRhUmVmcy5ldmVyeSgobGFtYmRhUmVmKSA9PiBsYW1iZGFSZWYuVHlwZSA9PT0gJ0N1c3RvbTo6Q0RLQnVja2V0RGVwbG95bWVudCcpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9KTtcblxuICAgIC8vIFdlIGhhdmUgZGV0ZXJtaW5lZCB0aGlzIHJvbGUgaXMgdXNlZCBmb3Igc29tZXRoaW5nIGVsc2UsIHNvIHdlIGNhbid0IHNraXAgdGhlIGNoYW5nZVxuICAgIGlmICghaXNSb2xlT25seUZvclMzRGVwbG95bWVudCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vIFdlIGhhdmUgY2hlY2tlZCB0aGF0IGFueSB1c2Ugb2YgdGhpcyBwb2xpY3kgaXMgb25seSBmb3IgUzNEZXBsb3ltZW50IGFuZCB3ZSBjYW4gc2FmZWx5IHNraXAgaXRcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeU9iamVjdChvYmo6IGFueSk6IGFueSB7XG4gIGlmIChvYmogPT0gbnVsbCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIHJldHVybiBvYmoubWFwKHN0cmluZ2lmeU9iamVjdCk7XG4gIH1cbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9iai50b1N0cmluZygpO1xuICB9XG5cbiAgY29uc3QgcmV0OiB7IFtrOiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhvYmopKSB7XG4gICAgcmV0W2tdID0gc3RyaW5naWZ5T2JqZWN0KHYpO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG4iXX0=