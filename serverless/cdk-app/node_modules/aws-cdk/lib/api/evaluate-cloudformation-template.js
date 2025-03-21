"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluateCloudFormationTemplate = exports.CfnEvaluationException = exports.LazyLookupExport = exports.LookupExportError = exports.LazyListStackResources = void 0;
class LazyListStackResources {
    constructor(sdk, stackName) {
        this.sdk = sdk;
        this.stackName = stackName;
    }
    async listStackResources() {
        if (this.stackResources === undefined) {
            this.stackResources = this.sdk.cloudFormation().listStackResources({
                StackName: this.stackName,
            });
        }
        return this.stackResources;
    }
}
exports.LazyListStackResources = LazyListStackResources;
class LookupExportError extends Error {
}
exports.LookupExportError = LookupExportError;
class LazyLookupExport {
    constructor(sdk) {
        this.sdk = sdk;
        this.cachedExports = {};
    }
    async lookupExport(name) {
        if (this.cachedExports[name]) {
            return this.cachedExports[name];
        }
        for await (const cfnExport of this.listExports()) {
            if (!cfnExport.Name) {
                continue; // ignore any result that omits a name
            }
            this.cachedExports[cfnExport.Name] = cfnExport;
            if (cfnExport.Name === name) {
                return cfnExport;
            }
        }
        return undefined; // export not found
    }
    // TODO: Paginate
    async *listExports() {
        let nextToken = undefined;
        while (true) {
            const response = await this.sdk.cloudFormation().listExports({ NextToken: nextToken });
            for (const cfnExport of response.Exports ?? []) {
                yield cfnExport;
            }
            if (!response.NextToken) {
                return;
            }
            nextToken = response.NextToken;
        }
    }
}
exports.LazyLookupExport = LazyLookupExport;
class CfnEvaluationException extends Error {
}
exports.CfnEvaluationException = CfnEvaluationException;
class EvaluateCloudFormationTemplate {
    constructor(props) {
        this.stackName = props.stackName;
        this.template = props.template;
        this.context = {
            'AWS::AccountId': props.account,
            'AWS::Region': props.region,
            'AWS::Partition': props.partition,
            ...props.parameters,
        };
        this.account = props.account;
        this.region = props.region;
        this.partition = props.partition;
        this.sdk = props.sdk;
        // We need names of nested stack so we can evaluate cross stack references
        this.nestedStacks = props.nestedStacks ?? {};
        // The current resources of the Stack.
        // We need them to figure out the physical name of a resource in case it wasn't specified by the user.
        // We fetch it lazily, to save a service call, in case all hotswapped resources have their physical names set.
        this.stackResources = new LazyListStackResources(this.sdk, this.stackName);
        // CloudFormation Exports lookup to be able to resolve Fn::ImportValue intrinsics in template
        this.lookupExport = new LazyLookupExport(this.sdk);
    }
    // clones current EvaluateCloudFormationTemplate object, but updates the stack name
    async createNestedEvaluateCloudFormationTemplate(stackName, nestedTemplate, nestedStackParameters) {
        const evaluatedParams = await this.evaluateCfnExpression(nestedStackParameters);
        return new EvaluateCloudFormationTemplate({
            stackName,
            template: nestedTemplate,
            parameters: evaluatedParams,
            account: this.account,
            region: this.region,
            partition: this.partition,
            sdk: this.sdk,
            nestedStacks: this.nestedStacks,
        });
    }
    async establishResourcePhysicalName(logicalId, physicalNameInCfnTemplate) {
        if (physicalNameInCfnTemplate != null) {
            try {
                return await this.evaluateCfnExpression(physicalNameInCfnTemplate);
            }
            catch (e) {
                // If we can't evaluate the resource's name CloudFormation expression,
                // just look it up in the currently deployed Stack
                if (!(e instanceof CfnEvaluationException)) {
                    throw e;
                }
            }
        }
        return this.findPhysicalNameFor(logicalId);
    }
    async findPhysicalNameFor(logicalId) {
        const stackResources = await this.stackResources.listStackResources();
        return stackResources.find((sr) => sr.LogicalResourceId === logicalId)?.PhysicalResourceId;
    }
    async findLogicalIdForPhysicalName(physicalName) {
        const stackResources = await this.stackResources.listStackResources();
        return stackResources.find((sr) => sr.PhysicalResourceId === physicalName)?.LogicalResourceId;
    }
    findReferencesTo(logicalId) {
        const ret = new Array();
        for (const [resourceLogicalId, resourceDef] of Object.entries(this.template?.Resources ?? {})) {
            if (logicalId !== resourceLogicalId && this.references(logicalId, resourceDef)) {
                ret.push({
                    ...resourceDef,
                    LogicalId: resourceLogicalId,
                });
            }
        }
        return ret;
    }
    async evaluateCfnExpression(cfnExpression) {
        const self = this;
        /**
         * Evaluates CloudFormation intrinsic functions
         *
         * Note that supported intrinsic functions are documented in README.md -- please update
         * list of supported functions when adding new evaluations
         *
         * See: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html
         */
        class CfnIntrinsics {
            evaluateIntrinsic(intrinsic) {
                const intrinsicFunc = this[intrinsic.name];
                if (!intrinsicFunc) {
                    throw new CfnEvaluationException(`CloudFormation function ${intrinsic.name} is not supported`);
                }
                const argsAsArray = Array.isArray(intrinsic.args) ? intrinsic.args : [intrinsic.args];
                return intrinsicFunc.apply(this, argsAsArray);
            }
            async 'Fn::Join'(separator, args) {
                const evaluatedArgs = await self.evaluateCfnExpression(args);
                return evaluatedArgs.join(separator);
            }
            async 'Fn::Split'(separator, args) {
                const evaluatedArgs = await self.evaluateCfnExpression(args);
                return evaluatedArgs.split(separator);
            }
            async 'Fn::Select'(index, args) {
                const evaluatedArgs = await self.evaluateCfnExpression(args);
                return evaluatedArgs[index];
            }
            async Ref(logicalId) {
                const refTarget = await self.findRefTarget(logicalId);
                if (refTarget) {
                    return refTarget;
                }
                else {
                    throw new CfnEvaluationException(`Parameter or resource '${logicalId}' could not be found for evaluation`);
                }
            }
            async 'Fn::GetAtt'(logicalId, attributeName) {
                // ToDo handle the 'logicalId.attributeName' form of Fn::GetAtt
                const attrValue = await self.findGetAttTarget(logicalId, attributeName);
                if (attrValue) {
                    return attrValue;
                }
                else {
                    throw new CfnEvaluationException(`Attribute '${attributeName}' of resource '${logicalId}' could not be found for evaluation`);
                }
            }
            async 'Fn::Sub'(template, explicitPlaceholders) {
                const placeholders = explicitPlaceholders ? await self.evaluateCfnExpression(explicitPlaceholders) : {};
                return asyncGlobalReplace(template, /\${([^}]*)}/g, (key) => {
                    if (key in placeholders) {
                        return placeholders[key];
                    }
                    else {
                        const splitKey = key.split('.');
                        return splitKey.length === 1 ? this.Ref(key) : this['Fn::GetAtt'](splitKey[0], splitKey.slice(1).join('.'));
                    }
                });
            }
            async 'Fn::ImportValue'(name) {
                const exported = await self.lookupExport.lookupExport(name);
                if (!exported) {
                    throw new CfnEvaluationException(`Export '${name}' could not be found for evaluation`);
                }
                if (!exported.Value) {
                    throw new CfnEvaluationException(`Export '${name}' exists without a value`);
                }
                return exported.Value;
            }
        }
        if (cfnExpression == null) {
            return cfnExpression;
        }
        if (Array.isArray(cfnExpression)) {
            // Small arrays in practice
            // eslint-disable-next-line @cdklabs/promiseall-no-unbounded-parallelism
            return Promise.all(cfnExpression.map((expr) => this.evaluateCfnExpression(expr)));
        }
        if (typeof cfnExpression === 'object') {
            const intrinsic = this.parseIntrinsic(cfnExpression);
            if (intrinsic) {
                return new CfnIntrinsics().evaluateIntrinsic(intrinsic);
            }
            else {
                const ret = {};
                for (const [key, val] of Object.entries(cfnExpression)) {
                    ret[key] = await this.evaluateCfnExpression(val);
                }
                return ret;
            }
        }
        return cfnExpression;
    }
    getResourceProperty(logicalId, propertyName) {
        return this.template.Resources?.[logicalId]?.Properties?.[propertyName];
    }
    references(logicalId, templateElement) {
        if (typeof templateElement === 'string') {
            return logicalId === templateElement;
        }
        if (templateElement == null) {
            return false;
        }
        if (Array.isArray(templateElement)) {
            return templateElement.some((el) => this.references(logicalId, el));
        }
        if (typeof templateElement === 'object') {
            return Object.values(templateElement).some((el) => this.references(logicalId, el));
        }
        return false;
    }
    parseIntrinsic(x) {
        const keys = Object.keys(x);
        if (keys.length === 1 && (keys[0].startsWith('Fn::') || keys[0] === 'Ref')) {
            return {
                name: keys[0],
                args: x[keys[0]],
            };
        }
        return undefined;
    }
    async findRefTarget(logicalId) {
        // first, check to see if the Ref is a Parameter who's value we have
        if (logicalId === 'AWS::URLSuffix') {
            if (!this.cachedUrlSuffix) {
                this.cachedUrlSuffix = await this.sdk.getUrlSuffix(this.region);
            }
            return this.cachedUrlSuffix;
        }
        // Try finding the ref in the passed in parameters
        const parameterTarget = this.context[logicalId];
        if (parameterTarget) {
            return parameterTarget;
        }
        // If not in the passed in parameters, see if there is a default value in the template parameter that was not passed in
        const defaultParameterValue = this.template.Parameters?.[logicalId]?.Default;
        if (defaultParameterValue) {
            return defaultParameterValue;
        }
        // if it's not a Parameter, we need to search in the current Stack resources
        return this.findGetAttTarget(logicalId);
    }
    async findGetAttTarget(logicalId, attribute) {
        // Handle case where the attribute is referencing a stack output (used in nested stacks to share parameters)
        // See https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/quickref-cloudformation.html#w2ab1c17c23c19b5
        if (logicalId === 'Outputs' && attribute) {
            return this.evaluateCfnExpression(this.template.Outputs[attribute]?.Value);
        }
        const stackResources = await this.stackResources.listStackResources();
        const foundResource = stackResources.find((sr) => sr.LogicalResourceId === logicalId);
        if (!foundResource) {
            return undefined;
        }
        if (foundResource.ResourceType == 'AWS::CloudFormation::Stack' && attribute?.startsWith('Outputs.')) {
            const dependantStack = this.findNestedStack(logicalId, this.nestedStacks);
            if (!dependantStack || !dependantStack.physicalName) {
                //this is a newly created nested stack and cannot be hotswapped
                return undefined;
            }
            const evaluateCfnTemplate = await this.createNestedEvaluateCloudFormationTemplate(dependantStack.physicalName, dependantStack.generatedTemplate, dependantStack.generatedTemplate.Parameters);
            // Split Outputs.<refName> into 'Outputs' and '<refName>' and recursively call evaluate
            return evaluateCfnTemplate.evaluateCfnExpression({
                'Fn::GetAtt': attribute.split(/\.(.*)/s),
            });
        }
        // now, we need to format the appropriate identifier depending on the resource type,
        // and the requested attribute name
        return this.formatResourceAttribute(foundResource, attribute);
    }
    findNestedStack(logicalId, nestedStacks) {
        for (const nestedStackLogicalId of Object.keys(nestedStacks)) {
            if (nestedStackLogicalId === logicalId) {
                return nestedStacks[nestedStackLogicalId];
            }
            const checkInNestedChildStacks = this.findNestedStack(logicalId, nestedStacks[nestedStackLogicalId].nestedStackTemplates);
            if (checkInNestedChildStacks)
                return checkInNestedChildStacks;
        }
        return undefined;
    }
    formatResourceAttribute(resource, attribute) {
        const physicalId = resource.PhysicalResourceId;
        // no attribute means Ref expression, for which we use the physical ID directly
        if (!attribute) {
            return physicalId;
        }
        const resourceTypeFormats = RESOURCE_TYPE_ATTRIBUTES_FORMATS[resource.ResourceType];
        if (!resourceTypeFormats) {
            throw new CfnEvaluationException(`We don't support attributes of the '${resource.ResourceType}' resource. This is a CDK limitation. ` +
                'Please report it at https://github.com/aws/aws-cdk/issues/new/choose');
        }
        const attributeFmtFunc = resourceTypeFormats[attribute];
        if (!attributeFmtFunc) {
            throw new CfnEvaluationException(`We don't support the '${attribute}' attribute of the '${resource.ResourceType}' resource. This is a CDK limitation. ` +
                'Please report it at https://github.com/aws/aws-cdk/issues/new/choose');
        }
        const service = this.getServiceOfResource(resource);
        const resourceTypeArnPart = this.getResourceTypeArnPartOfResource(resource);
        return attributeFmtFunc({
            partition: this.partition,
            service,
            region: this.region,
            account: this.account,
            resourceType: resourceTypeArnPart,
            resourceName: physicalId,
        });
    }
    getServiceOfResource(resource) {
        return resource.ResourceType.split('::')[1].toLowerCase();
    }
    getResourceTypeArnPartOfResource(resource) {
        const resourceType = resource.ResourceType;
        const specialCaseResourceType = RESOURCE_TYPE_SPECIAL_NAMES[resourceType]?.resourceType;
        return specialCaseResourceType
            ? specialCaseResourceType
            : // this is the default case
                resourceType.split('::')[2].toLowerCase();
    }
}
exports.EvaluateCloudFormationTemplate = EvaluateCloudFormationTemplate;
/**
 * Usually, we deduce the names of the service and the resource type used to format the ARN from the CloudFormation resource type.
 * For a CFN type like AWS::Service::ResourceType, the second segment becomes the service name, and the third the resource type
 * (after converting both of them to lowercase).
 * However, some resource types break this simple convention, and we need to special-case them.
 * This map is for storing those cases.
 */
const RESOURCE_TYPE_SPECIAL_NAMES = {
    'AWS::Events::EventBus': {
        resourceType: 'event-bus',
    },
};
const RESOURCE_TYPE_ATTRIBUTES_FORMATS = {
    'AWS::IAM::Role': { Arn: iamArnFmt },
    'AWS::IAM::User': { Arn: iamArnFmt },
    'AWS::IAM::Group': { Arn: iamArnFmt },
    'AWS::S3::Bucket': { Arn: s3ArnFmt },
    'AWS::Lambda::Function': { Arn: stdColonResourceArnFmt },
    'AWS::Events::EventBus': {
        Arn: stdSlashResourceArnFmt,
        // the name attribute of the EventBus is the same as the Ref
        Name: (parts) => parts.resourceName,
    },
    'AWS::DynamoDB::Table': { Arn: stdSlashResourceArnFmt },
    'AWS::AppSync::GraphQLApi': { ApiId: appsyncGraphQlApiApiIdFmt },
    'AWS::AppSync::FunctionConfiguration': {
        FunctionId: appsyncGraphQlFunctionIDFmt,
    },
    'AWS::AppSync::DataSource': { Name: appsyncGraphQlDataSourceNameFmt },
    'AWS::KMS::Key': { Arn: stdSlashResourceArnFmt },
};
function iamArnFmt(parts) {
    // we skip region for IAM resources
    return `arn:${parts.partition}:${parts.service}::${parts.account}:${parts.resourceType}/${parts.resourceName}`;
}
function s3ArnFmt(parts) {
    // we skip account, region and resourceType for S3 resources
    return `arn:${parts.partition}:${parts.service}:::${parts.resourceName}`;
}
function stdColonResourceArnFmt(parts) {
    // this is a standard format for ARNs like: arn:aws:service:region:account:resourceType:resourceName
    return `arn:${parts.partition}:${parts.service}:${parts.region}:${parts.account}:${parts.resourceType}:${parts.resourceName}`;
}
function stdSlashResourceArnFmt(parts) {
    // this is a standard format for ARNs like: arn:aws:service:region:account:resourceType/resourceName
    return `arn:${parts.partition}:${parts.service}:${parts.region}:${parts.account}:${parts.resourceType}/${parts.resourceName}`;
}
function appsyncGraphQlApiApiIdFmt(parts) {
    // arn:aws:appsync:us-east-1:111111111111:apis/<apiId>
    return parts.resourceName.split('/')[1];
}
function appsyncGraphQlFunctionIDFmt(parts) {
    // arn:aws:appsync:us-east-1:111111111111:apis/<apiId>/functions/<functionId>
    return parts.resourceName.split('/')[3];
}
function appsyncGraphQlDataSourceNameFmt(parts) {
    // arn:aws:appsync:us-east-1:111111111111:apis/<apiId>/datasources/<name>
    return parts.resourceName.split('/')[3];
}
async function asyncGlobalReplace(str, regex, cb) {
    if (!regex.global) {
        throw new Error('Regex must be created with /g flag');
    }
    const ret = new Array();
    let start = 0;
    while (true) {
        const match = regex.exec(str);
        if (!match) {
            break;
        }
        ret.push(str.substring(start, match.index));
        ret.push(await cb(match[1]));
        start = regex.lastIndex;
    }
    ret.push(str.slice(start));
    return ret.join('');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZhbHVhdGUtY2xvdWRmb3JtYXRpb24tdGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJldmFsdWF0ZS1jbG91ZGZvcm1hdGlvbi10ZW1wbGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFRQSxNQUFhLHNCQUFzQjtJQUdqQyxZQUNtQixHQUFRLEVBQ1IsU0FBaUI7UUFEakIsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUNSLGNBQVMsR0FBVCxTQUFTLENBQVE7SUFDakMsQ0FBQztJQUVHLEtBQUssQ0FBQyxrQkFBa0I7UUFDN0IsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3RDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDakUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO2FBQzFCLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDN0IsQ0FBQztDQUNGO0FBaEJELHdEQWdCQztBQU1ELE1BQWEsaUJBQWtCLFNBQVEsS0FBSztDQUFHO0FBQS9DLDhDQUErQztBQUUvQyxNQUFhLGdCQUFnQjtJQUczQixZQUE2QixHQUFRO1FBQVIsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUY3QixrQkFBYSxHQUErQixFQUFFLENBQUM7SUFFZixDQUFDO0lBRXpDLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBWTtRQUM3QixJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUM3QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELElBQUksS0FBSyxFQUFFLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLENB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LENBQUMsQ0FBQztJQUNkLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDWixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE1BQU07UUFDUixDQUFDO1FBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFN0IsS0FBSyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7SUFDMUIsQ0FBQztJQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRTNCLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBFeHBvcnQsIExpc3RFeHBvcnRzQ29tbWFuZE91dHB1dCwgU3RhY2tSZXNvdXJjZVN1bW1hcnkgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWRmb3JtYXRpb24nO1xuaW1wb3J0IHR5cGUgeyBTREsgfSBmcm9tICcuL2F3cy1hdXRoJztcbmltcG9ydCB0eXBlIHsgTmVzdGVkU3RhY2tUZW1wbGF0ZXMgfSBmcm9tICcuL25lc3RlZC1zdGFjay1oZWxwZXJzJztcblxuZXhwb3J0IGludGVyZmFjZSBMaXN0U3RhY2tSZXNvdXJjZXMge1xuICBsaXN0U3RhY2tSZXNvdXJjZXMoKTogUHJvbWlzZTxTdGFja1Jlc291cmNlU3VtbWFyeVtdPjtcbn1cblxuZXhwb3J0IGNsYXNzIExhenlMaXN0U3RhY2tSZXNvdXJjZXMgaW1wbGVtZW50cyBMaXN0U3RhY2tSZXNvdXJjZXMge1xuICBwcml2YXRlIHN0YWNrUmVzb3VyY2VzOiBQcm9taXNlPFN0YWNrUmVzb3VyY2VTdW1tYXJ5W10+IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2RrOiBTREssXG4gICAgcHJpdmF0ZSByZWFkb25seSBzdGFja05hbWU6IHN0cmluZyxcbiAgKSB7fVxuXG4gIHB1YmxpYyBhc3luYyBsaXN0U3RhY2tSZXNvdXJjZXMoKTogUHJvbWlzZTxTdGFja1Jlc291cmNlU3VtbWFyeVtdPiB7XG4gICAgaWYgKHRoaXMuc3RhY2tSZXNvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zdGFja1Jlc291cmNlcyA9IHRoaXMuc2RrLmNsb3VkRm9ybWF0aW9uKCkubGlzdFN0YWNrUmVzb3VyY2VzKHtcbiAgICAgICAgU3RhY2tOYW1lOiB0aGlzLnN0YWNrTmFtZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zdGFja1Jlc291cmNlcztcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIExvb2t1cEV4cG9ydCB7XG4gIGxvb2t1cEV4cG9ydChuYW1lOiBzdHJpbmcpOiBQcm9taXNlPEV4cG9ydCB8IHVuZGVmaW5lZD47XG59XG5cbmV4cG9ydCBjbGFzcyBMb29rdXBFeHBvcnRFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBjbGFzcyBMYXp5TG9va3VwRXhwb3J0IGltcGxlbWVudHMgTG9va3VwRXhwb3J0IHtcbiAgcHJpdmF0ZSBjYWNoZWRFeHBvcnRzOiB7IFtuYW1lOiBzdHJpbmddOiBFeHBvcnQgfSA9IHt9O1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgc2RrOiBTREspIHt9XG5cbiAgYXN5bmMgbG9va3VwRXhwb3J0KG5hbWU6IHN0cmluZyk6IFByb21pc2U8RXhwb3J0IHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKHRoaXMuY2FjaGVkRXhwb3J0c1tuYW1lXSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkRXhwb3J0c1tuYW1lXTtcbiAgICB9XG5cbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNmbkV4cG9ydCBvZiB0aGlzLmxpc3RFeHBvcnRzKCkpIHtcbiAgICAgIGlmICghY2ZuRXhwb3J0Lk5hbWUpIHtcbiAgICAgICAgY29udGludWU7IC8vIGlnbm9yZSBhbnkgcmVzdWx0IHRoYXQgb21pdHMgYSBuYW1lXG4gICAgICB9XG4gICAgICB0aGlzLmNhY2hlZEV4cG9ydHNbY2ZuRXhwb3J0Lk5hbWVdID0gY2ZuRXhwb3J0O1xuXG4gICAgICBpZiAoY2ZuRXhwb3J0Lk5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGNmbkV4cG9ydDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkOyAvLyBleHBvcnQgbm90IGZvdW5kXG4gIH1cblxuICAvLyBUT0RPOiBQYWdpbmF0ZVxuICBwcml2YXRlIGFzeW5jICpsaXN0RXhwb3J0cygpIHtcbiAgICBsZXQgbmV4dFRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlOiBMaXN0RXhwb3J0c0NvbW1hbmRPdXRwdXQgPSBhd2FpdCB0aGlzLnNkay5jbG91ZEZvcm1hdGlvbigpLmxpc3RFeHBvcnRzKHsgTmV4dFRva2VuOiBuZXh0VG9rZW4gfSk7XG4gICAgICBmb3IgKGNvbnN0IGNmbkV4cG9ydCBvZiByZXNwb25zZS5FeHBvcnRzID8/IFtdKSB7XG4gICAgICAgIHlpZWxkIGNmbkV4cG9ydDtcbiAgICAgIH1cblxuICAgICAgaWYgKCFyZXNwb25zZS5OZXh0VG9rZW4pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbmV4dFRva2VuID0gcmVzcG9uc2UuTmV4dFRva2VuO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2ZuRXZhbHVhdGlvbkV4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2VEZWZpbml0aW9uIHtcbiAgcmVhZG9ubHkgTG9naWNhbElkOiBzdHJpbmc7XG4gIHJlYWRvbmx5IFR5cGU6IHN0cmluZztcbiAgcmVhZG9ubHkgUHJvcGVydGllczogeyBbcDogc3RyaW5nXTogYW55IH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlUHJvcHMge1xuICByZWFkb25seSBzdGFja05hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgdGVtcGxhdGU6IFRlbXBsYXRlO1xuICByZWFkb25seSBwYXJhbWV0ZXJzOiB7IFtwYXJhbWV0ZXJOYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgcmVhZG9ubHkgYWNjb3VudDogc3RyaW5nO1xuICByZWFkb25seSByZWdpb246IHN0cmluZztcbiAgcmVhZG9ubHkgcGFydGl0aW9uOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHNkazogU0RLO1xuICByZWFkb25seSBuZXN0ZWRTdGFja3M/OiB7XG4gICAgW25lc3RlZFN0YWNrTG9naWNhbElkOiBzdHJpbmddOiBOZXN0ZWRTdGFja1RlbXBsYXRlcztcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3RhY2tOYW1lOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgdGVtcGxhdGU6IFRlbXBsYXRlO1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHQ6IHsgW2s6IHN0cmluZ106IGFueSB9O1xuICBwcml2YXRlIHJlYWRvbmx5IGFjY291bnQ6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSByZWdpb246IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBwYXJ0aXRpb246IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSBzZGs6IFNESztcbiAgcHJpdmF0ZSByZWFkb25seSBuZXN0ZWRTdGFja3M6IHtcbiAgICBbbmVzdGVkU3RhY2tMb2dpY2FsSWQ6IHN0cmluZ106IE5lc3RlZFN0YWNrVGVtcGxhdGVzO1xuICB9O1xuICBwcml2YXRlIHJlYWRvbmx5IHN0YWNrUmVzb3VyY2VzOiBMaXN0U3RhY2tSZXNvdXJjZXM7XG4gIHByaXZhdGUgcmVhZG9ubHkgbG9va3VwRXhwb3J0OiBMb29rdXBFeHBvcnQ7XG5cbiAgcHJpdmF0ZSBjYWNoZWRVcmxTdWZmaXg6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3Rvcihwcm9wczogRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlUHJvcHMpIHtcbiAgICB0aGlzLnN0YWNrTmFtZSA9IHByb3BzLnN0YWNrTmFtZTtcbiAgICB0aGlzLnRlbXBsYXRlID0gcHJvcHMudGVtcGxhdGU7XG4gICAgdGhpcy5jb250ZXh0ID0ge1xuICAgICAgJ0FXUzo6QWNjb3VudElkJzogcHJvcHMuYWNjb3VudCxcbiAgICAgICdBV1M6OlJlZ2lvbic6IHByb3BzLnJlZ2lvbixcbiAgICAgICdBV1M6OlBhcnRpdGlvbic6IHByb3BzLnBhcnRpdGlvbixcbiAgICAgIC4uLnByb3BzLnBhcmFtZXRlcnMsXG4gICAgfTtcbiAgICB0aGlzLmFjY291bnQgPSBwcm9wcy5hY2NvdW50O1xuICAgIHRoaXMucmVnaW9uID0gcHJvcHMucmVnaW9uO1xuICAgIHRoaXMucGFydGl0aW9uID0gcHJvcHMucGFydGl0aW9uO1xuICAgIHRoaXMuc2RrID0gcHJvcHMuc2RrO1xuXG4gICAgLy8gV2UgbmVlZCBuYW1lcyBvZiBuZXN0ZWQgc3RhY2sgc28gd2UgY2FuIGV2YWx1YXRlIGNyb3NzIHN0YWNrIHJlZmVyZW5jZXNcbiAgICB0aGlzLm5lc3RlZFN0YWNrcyA9IHByb3BzLm5lc3RlZFN0YWNrcyA/PyB7fTtcblxuICAgIC8vIFRoZSBjdXJyZW50IHJlc291cmNlcyBvZiB0aGUgU3RhY2suXG4gICAgLy8gV2UgbmVlZCB0aGVtIHRvIGZpZ3VyZSBvdXQgdGhlIHBoeXNpY2FsIG5hbWUgb2YgYSByZXNvdXJjZSBpbiBjYXNlIGl0IHdhc24ndCBzcGVjaWZpZWQgYnkgdGhlIHVzZXIuXG4gICAgLy8gV2UgZmV0Y2ggaXQgbGF6aWx5LCB0byBzYXZlIGEgc2VydmljZSBjYWxsLCBpbiBjYXNlIGFsbCBob3Rzd2FwcGVkIHJlc291cmNlcyBoYXZlIHRoZWlyIHBoeXNpY2FsIG5hbWVzIHNldC5cbiAgICB0aGlzLnN0YWNrUmVzb3VyY2VzID0gbmV3IExhenlMaXN0U3RhY2tSZXNvdXJjZXModGhpcy5zZGssIHRoaXMuc3RhY2tOYW1lKTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIEV4cG9ydHMgbG9va3VwIHRvIGJlIGFibGUgdG8gcmVzb2x2ZSBGbjo6SW1wb3J0VmFsdWUgaW50cmluc2ljcyBpbiB0ZW1wbGF0ZVxuICAgIHRoaXMubG9va3VwRXhwb3J0ID0gbmV3IExhenlMb29rdXBFeHBvcnQodGhpcy5zZGspO1xuICB9XG5cbiAgLy8gY2xvbmVzIGN1cnJlbnQgRXZhbHVhdGVDbG91ZEZvcm1hdGlvblRlbXBsYXRlIG9iamVjdCwgYnV0IHVwZGF0ZXMgdGhlIHN0YWNrIG5hbWVcbiAgcHVibGljIGFzeW5jIGNyZWF0ZU5lc3RlZEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZShcbiAgICBzdGFja05hbWU6IHN0cmluZyxcbiAgICBuZXN0ZWRUZW1wbGF0ZTogVGVtcGxhdGUsXG4gICAgbmVzdGVkU3RhY2tQYXJhbWV0ZXJzOiB7IFtwYXJhbWV0ZXJOYW1lOiBzdHJpbmddOiBhbnkgfSxcbiAgKSB7XG4gICAgY29uc3QgZXZhbHVhdGVkUGFyYW1zID0gYXdhaXQgdGhpcy5ldmFsdWF0ZUNmbkV4cHJlc3Npb24obmVzdGVkU3RhY2tQYXJhbWV0ZXJzKTtcbiAgICByZXR1cm4gbmV3IEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZSh7XG4gICAgICBzdGFja05hbWUsXG4gICAgICB0ZW1wbGF0ZTogbmVzdGVkVGVtcGxhdGUsXG4gICAgICBwYXJhbWV0ZXJzOiBldmFsdWF0ZWRQYXJhbXMsXG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgcGFydGl0aW9uOiB0aGlzLnBhcnRpdGlvbixcbiAgICAgIHNkazogdGhpcy5zZGssXG4gICAgICBuZXN0ZWRTdGFja3M6IHRoaXMubmVzdGVkU3RhY2tzLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGVzdGFibGlzaFJlc291cmNlUGh5c2ljYWxOYW1lKFxuICAgIGxvZ2ljYWxJZDogc3RyaW5nLFxuICAgIHBoeXNpY2FsTmFtZUluQ2ZuVGVtcGxhdGU6IGFueSxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBpZiAocGh5c2ljYWxOYW1lSW5DZm5UZW1wbGF0ZSAhPSBudWxsKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5ldmFsdWF0ZUNmbkV4cHJlc3Npb24ocGh5c2ljYWxOYW1lSW5DZm5UZW1wbGF0ZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElmIHdlIGNhbid0IGV2YWx1YXRlIHRoZSByZXNvdXJjZSdzIG5hbWUgQ2xvdWRGb3JtYXRpb24gZXhwcmVzc2lvbixcbiAgICAgICAgLy8ganVzdCBsb29rIGl0IHVwIGluIHRoZSBjdXJyZW50bHkgZGVwbG95ZWQgU3RhY2tcbiAgICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIENmbkV2YWx1YXRpb25FeGNlcHRpb24pKSB7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5maW5kUGh5c2ljYWxOYW1lRm9yKGxvZ2ljYWxJZCk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZmluZFBoeXNpY2FsTmFtZUZvcihsb2dpY2FsSWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3Qgc3RhY2tSZXNvdXJjZXMgPSBhd2FpdCB0aGlzLnN0YWNrUmVzb3VyY2VzLmxpc3RTdGFja1Jlc291cmNlcygpO1xuICAgIHJldHVybiBzdGFja1Jlc291cmNlcy5maW5kKChzcikgPT4gc3IuTG9naWNhbFJlc291cmNlSWQgPT09IGxvZ2ljYWxJZCk/LlBoeXNpY2FsUmVzb3VyY2VJZDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBmaW5kTG9naWNhbElkRm9yUGh5c2ljYWxOYW1lKHBoeXNpY2FsTmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zdCBzdGFja1Jlc291cmNlcyA9IGF3YWl0IHRoaXMuc3RhY2tSZXNvdXJjZXMubGlzdFN0YWNrUmVzb3VyY2VzKCk7XG4gICAgcmV0dXJuIHN0YWNrUmVzb3VyY2VzLmZpbmQoKHNyKSA9PiBzci5QaHlzaWNhbFJlc291cmNlSWQgPT09IHBoeXNpY2FsTmFtZSk/LkxvZ2ljYWxSZXNvdXJjZUlkO1xuICB9XG5cbiAgcHVibGljIGZpbmRSZWZlcmVuY2VzVG8obG9naWNhbElkOiBzdHJpbmcpOiBBcnJheTxSZXNvdXJjZURlZmluaXRpb24+IHtcbiAgICBjb25zdCByZXQgPSBuZXcgQXJyYXk8UmVzb3VyY2VEZWZpbml0aW9uPigpO1xuICAgIGZvciAoY29uc3QgW3Jlc291cmNlTG9naWNhbElkLCByZXNvdXJjZURlZl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy50ZW1wbGF0ZT8uUmVzb3VyY2VzID8/IHt9KSkge1xuICAgICAgaWYgKGxvZ2ljYWxJZCAhPT0gcmVzb3VyY2VMb2dpY2FsSWQgJiYgdGhpcy5yZWZlcmVuY2VzKGxvZ2ljYWxJZCwgcmVzb3VyY2VEZWYpKSB7XG4gICAgICAgIHJldC5wdXNoKHtcbiAgICAgICAgICAuLi4ocmVzb3VyY2VEZWYgYXMgYW55KSxcbiAgICAgICAgICBMb2dpY2FsSWQ6IHJlc291cmNlTG9naWNhbElkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBldmFsdWF0ZUNmbkV4cHJlc3Npb24oY2ZuRXhwcmVzc2lvbjogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvKipcbiAgICAgKiBFdmFsdWF0ZXMgQ2xvdWRGb3JtYXRpb24gaW50cmluc2ljIGZ1bmN0aW9uc1xuICAgICAqXG4gICAgICogTm90ZSB0aGF0IHN1cHBvcnRlZCBpbnRyaW5zaWMgZnVuY3Rpb25zIGFyZSBkb2N1bWVudGVkIGluIFJFQURNRS5tZCAtLSBwbGVhc2UgdXBkYXRlXG4gICAgICogbGlzdCBvZiBzdXBwb3J0ZWQgZnVuY3Rpb25zIHdoZW4gYWRkaW5nIG5ldyBldmFsdWF0aW9uc1xuICAgICAqXG4gICAgICogU2VlOiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vQVdTQ2xvdWRGb3JtYXRpb24vbGF0ZXN0L1VzZXJHdWlkZS9pbnRyaW5zaWMtZnVuY3Rpb24tcmVmZXJlbmNlLmh0bWxcbiAgICAgKi9cbiAgICBjbGFzcyBDZm5JbnRyaW5zaWNzIHtcbiAgICAgIHB1YmxpYyBldmFsdWF0ZUludHJpbnNpYyhpbnRyaW5zaWM6IEludHJpbnNpYyk6IGFueSB7XG4gICAgICAgIGNvbnN0IGludHJpbnNpY0Z1bmMgPSAodGhpcyBhcyBhbnkpW2ludHJpbnNpYy5uYW1lXTtcbiAgICAgICAgaWYgKCFpbnRyaW5zaWNGdW5jKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IENmbkV2YWx1YXRpb25FeGNlcHRpb24oYENsb3VkRm9ybWF0aW9uIGZ1bmN0aW9uICR7aW50cmluc2ljLm5hbWV9IGlzIG5vdCBzdXBwb3J0ZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFyZ3NBc0FycmF5ID0gQXJyYXkuaXNBcnJheShpbnRyaW5zaWMuYXJncykgPyBpbnRyaW5zaWMuYXJncyA6IFtpbnRyaW5zaWMuYXJnc107XG5cbiAgICAgICAgcmV0dXJuIGludHJpbnNpY0Z1bmMuYXBwbHkodGhpcywgYXJnc0FzQXJyYXkpO1xuICAgICAgfVxuXG4gICAgICBhc3luYyAnRm46OkpvaW4nKHNlcGFyYXRvcjogc3RyaW5nLCBhcmdzOiBhbnlbXSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIGNvbnN0IGV2YWx1YXRlZEFyZ3MgPSBhd2FpdCBzZWxmLmV2YWx1YXRlQ2ZuRXhwcmVzc2lvbihhcmdzKTtcbiAgICAgICAgcmV0dXJuIGV2YWx1YXRlZEFyZ3Muam9pbihzZXBhcmF0b3IpO1xuICAgICAgfVxuXG4gICAgICBhc3luYyAnRm46OlNwbGl0JyhzZXBhcmF0b3I6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgY29uc3QgZXZhbHVhdGVkQXJncyA9IGF3YWl0IHNlbGYuZXZhbHVhdGVDZm5FeHByZXNzaW9uKGFyZ3MpO1xuICAgICAgICByZXR1cm4gZXZhbHVhdGVkQXJncy5zcGxpdChzZXBhcmF0b3IpO1xuICAgICAgfVxuXG4gICAgICBhc3luYyAnRm46OlNlbGVjdCcoaW5kZXg6IG51bWJlciwgYXJnczogYW55W10pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBjb25zdCBldmFsdWF0ZWRBcmdzID0gYXdhaXQgc2VsZi5ldmFsdWF0ZUNmbkV4cHJlc3Npb24oYXJncyk7XG4gICAgICAgIHJldHVybiBldmFsdWF0ZWRBcmdzW2luZGV4XTtcbiAgICAgIH1cblxuICAgICAgYXN5bmMgUmVmKGxvZ2ljYWxJZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgY29uc3QgcmVmVGFyZ2V0ID0gYXdhaXQgc2VsZi5maW5kUmVmVGFyZ2V0KGxvZ2ljYWxJZCk7XG4gICAgICAgIGlmIChyZWZUYXJnZXQpIHtcbiAgICAgICAgICByZXR1cm4gcmVmVGFyZ2V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uKGBQYXJhbWV0ZXIgb3IgcmVzb3VyY2UgJyR7bG9naWNhbElkfScgY291bGQgbm90IGJlIGZvdW5kIGZvciBldmFsdWF0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgYXN5bmMgJ0ZuOjpHZXRBdHQnKGxvZ2ljYWxJZDogc3RyaW5nLCBhdHRyaWJ1dGVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICAvLyBUb0RvIGhhbmRsZSB0aGUgJ2xvZ2ljYWxJZC5hdHRyaWJ1dGVOYW1lJyBmb3JtIG9mIEZuOjpHZXRBdHRcbiAgICAgICAgY29uc3QgYXR0clZhbHVlID0gYXdhaXQgc2VsZi5maW5kR2V0QXR0VGFyZ2V0KGxvZ2ljYWxJZCwgYXR0cmlidXRlTmFtZSk7XG4gICAgICAgIGlmIChhdHRyVmFsdWUpIHtcbiAgICAgICAgICByZXR1cm4gYXR0clZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uKFxuICAgICAgICAgICAgYEF0dHJpYnV0ZSAnJHthdHRyaWJ1dGVOYW1lfScgb2YgcmVzb3VyY2UgJyR7bG9naWNhbElkfScgY291bGQgbm90IGJlIGZvdW5kIGZvciBldmFsdWF0aW9uYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGFzeW5jICdGbjo6U3ViJyh0ZW1wbGF0ZTogc3RyaW5nLCBleHBsaWNpdFBsYWNlaG9sZGVycz86IHsgW3ZhcmlhYmxlOiBzdHJpbmddOiBzdHJpbmcgfSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGV4cGxpY2l0UGxhY2Vob2xkZXJzID8gYXdhaXQgc2VsZi5ldmFsdWF0ZUNmbkV4cHJlc3Npb24oZXhwbGljaXRQbGFjZWhvbGRlcnMpIDoge307XG5cbiAgICAgICAgcmV0dXJuIGFzeW5jR2xvYmFsUmVwbGFjZSh0ZW1wbGF0ZSwgL1xcJHsoW159XSopfS9nLCAoa2V5KSA9PiB7XG4gICAgICAgICAgaWYgKGtleSBpbiBwbGFjZWhvbGRlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBwbGFjZWhvbGRlcnNba2V5XTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc3BsaXRLZXkgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIHJldHVybiBzcGxpdEtleS5sZW5ndGggPT09IDEgPyB0aGlzLlJlZihrZXkpIDogdGhpc1snRm46OkdldEF0dCddKHNwbGl0S2V5WzBdLCBzcGxpdEtleS5zbGljZSgxKS5qb2luKCcuJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGFzeW5jICdGbjo6SW1wb3J0VmFsdWUnKG5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIGNvbnN0IGV4cG9ydGVkID0gYXdhaXQgc2VsZi5sb29rdXBFeHBvcnQubG9va3VwRXhwb3J0KG5hbWUpO1xuICAgICAgICBpZiAoIWV4cG9ydGVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IENmbkV2YWx1YXRpb25FeGNlcHRpb24oYEV4cG9ydCAnJHtuYW1lfScgY291bGQgbm90IGJlIGZvdW5kIGZvciBldmFsdWF0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFleHBvcnRlZC5WYWx1ZSkge1xuICAgICAgICAgIHRocm93IG5ldyBDZm5FdmFsdWF0aW9uRXhjZXB0aW9uKGBFeHBvcnQgJyR7bmFtZX0nIGV4aXN0cyB3aXRob3V0IGEgdmFsdWVgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXhwb3J0ZWQuVmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNmbkV4cHJlc3Npb24gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGNmbkV4cHJlc3Npb247XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY2ZuRXhwcmVzc2lvbikpIHtcbiAgICAgIC8vIFNtYWxsIGFycmF5cyBpbiBwcmFjdGljZVxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEBjZGtsYWJzL3Byb21pc2VhbGwtbm8tdW5ib3VuZGVkLXBhcmFsbGVsaXNtXG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoY2ZuRXhwcmVzc2lvbi5tYXAoKGV4cHIpID0+IHRoaXMuZXZhbHVhdGVDZm5FeHByZXNzaW9uKGV4cHIpKSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBjZm5FeHByZXNzaW9uID09PSAnb2JqZWN0Jykge1xuICAgICAgY29uc3QgaW50cmluc2ljID0gdGhpcy5wYXJzZUludHJpbnNpYyhjZm5FeHByZXNzaW9uKTtcbiAgICAgIGlmIChpbnRyaW5zaWMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDZm5JbnRyaW5zaWNzKCkuZXZhbHVhdGVJbnRyaW5zaWMoaW50cmluc2ljKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJldDogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgT2JqZWN0LmVudHJpZXMoY2ZuRXhwcmVzc2lvbikpIHtcbiAgICAgICAgICByZXRba2V5XSA9IGF3YWl0IHRoaXMuZXZhbHVhdGVDZm5FeHByZXNzaW9uKHZhbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2ZuRXhwcmVzc2lvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRSZXNvdXJjZVByb3BlcnR5KGxvZ2ljYWxJZDogc3RyaW5nLCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMudGVtcGxhdGUuUmVzb3VyY2VzPy5bbG9naWNhbElkXT8uUHJvcGVydGllcz8uW3Byb3BlcnR5TmFtZV07XG4gIH1cblxuICBwcml2YXRlIHJlZmVyZW5jZXMobG9naWNhbElkOiBzdHJpbmcsIHRlbXBsYXRlRWxlbWVudDogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiB0ZW1wbGF0ZUVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gbG9naWNhbElkID09PSB0ZW1wbGF0ZUVsZW1lbnQ7XG4gICAgfVxuXG4gICAgaWYgKHRlbXBsYXRlRWxlbWVudCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGVtcGxhdGVFbGVtZW50KSkge1xuICAgICAgcmV0dXJuIHRlbXBsYXRlRWxlbWVudC5zb21lKChlbCkgPT4gdGhpcy5yZWZlcmVuY2VzKGxvZ2ljYWxJZCwgZWwpKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRlbXBsYXRlRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRlbXBsYXRlRWxlbWVudCkuc29tZSgoZWwpID0+IHRoaXMucmVmZXJlbmNlcyhsb2dpY2FsSWQsIGVsKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUludHJpbnNpYyh4OiBhbnkpOiBJbnRyaW5zaWMgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh4KTtcbiAgICBpZiAoa2V5cy5sZW5ndGggPT09IDEgJiYgKGtleXNbMF0uc3RhcnRzV2l0aCgnRm46OicpIHx8IGtleXNbMF0gPT09ICdSZWYnKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZToga2V5c1swXSxcbiAgICAgICAgYXJnczogeFtrZXlzWzBdXSxcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZpbmRSZWZUYXJnZXQobG9naWNhbElkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIC8vIGZpcnN0LCBjaGVjayB0byBzZWUgaWYgdGhlIFJlZiBpcyBhIFBhcmFtZXRlciB3aG8ncyB2YWx1ZSB3ZSBoYXZlXG4gICAgaWYgKGxvZ2ljYWxJZCA9PT0gJ0FXUzo6VVJMU3VmZml4Jykge1xuICAgICAgaWYgKCF0aGlzLmNhY2hlZFVybFN1ZmZpeCkge1xuICAgICAgICB0aGlzLmNhY2hlZFVybFN1ZmZpeCA9IGF3YWl0IHRoaXMuc2RrLmdldFVybFN1ZmZpeCh0aGlzLnJlZ2lvbik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLmNhY2hlZFVybFN1ZmZpeDtcbiAgICB9XG5cbiAgICAvLyBUcnkgZmluZGluZyB0aGUgcmVmIGluIHRoZSBwYXNzZWQgaW4gcGFyYW1ldGVyc1xuICAgIGNvbnN0IHBhcmFtZXRlclRhcmdldCA9IHRoaXMuY29udGV4dFtsb2dpY2FsSWRdO1xuICAgIGlmIChwYXJhbWV0ZXJUYXJnZXQpIHtcbiAgICAgIHJldHVybiBwYXJhbWV0ZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLy8gSWYgbm90IGluIHRoZSBwYXNzZWQgaW4gcGFyYW1ldGVycywgc2VlIGlmIHRoZXJlIGlzIGEgZGVmYXVsdCB2YWx1ZSBpbiB0aGUgdGVtcGxhdGUgcGFyYW1ldGVyIHRoYXQgd2FzIG5vdCBwYXNzZWQgaW5cbiAgICBjb25zdCBkZWZhdWx0UGFyYW1ldGVyVmFsdWUgPSB0aGlzLnRlbXBsYXRlLlBhcmFtZXRlcnM/Lltsb2dpY2FsSWRdPy5EZWZhdWx0O1xuICAgIGlmIChkZWZhdWx0UGFyYW1ldGVyVmFsdWUpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0UGFyYW1ldGVyVmFsdWU7XG4gICAgfVxuXG4gICAgLy8gaWYgaXQncyBub3QgYSBQYXJhbWV0ZXIsIHdlIG5lZWQgdG8gc2VhcmNoIGluIHRoZSBjdXJyZW50IFN0YWNrIHJlc291cmNlc1xuICAgIHJldHVybiB0aGlzLmZpbmRHZXRBdHRUYXJnZXQobG9naWNhbElkKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmluZEdldEF0dFRhcmdldChsb2dpY2FsSWQ6IHN0cmluZywgYXR0cmlidXRlPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICAvLyBIYW5kbGUgY2FzZSB3aGVyZSB0aGUgYXR0cmlidXRlIGlzIHJlZmVyZW5jaW5nIGEgc3RhY2sgb3V0cHV0ICh1c2VkIGluIG5lc3RlZCBzdGFja3MgdG8gc2hhcmUgcGFyYW1ldGVycylcbiAgICAvLyBTZWUgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL0FXU0Nsb3VkRm9ybWF0aW9uL2xhdGVzdC9Vc2VyR3VpZGUvcXVpY2tyZWYtY2xvdWRmb3JtYXRpb24uaHRtbCN3MmFiMWMxN2MyM2MxOWI1XG4gICAgaWYgKGxvZ2ljYWxJZCA9PT0gJ091dHB1dHMnICYmIGF0dHJpYnV0ZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVDZm5FeHByZXNzaW9uKHRoaXMudGVtcGxhdGUuT3V0cHV0c1thdHRyaWJ1dGVdPy5WYWx1ZSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhY2tSZXNvdXJjZXMgPSBhd2FpdCB0aGlzLnN0YWNrUmVzb3VyY2VzLmxpc3RTdGFja1Jlc291cmNlcygpO1xuICAgIGNvbnN0IGZvdW5kUmVzb3VyY2UgPSBzdGFja1Jlc291cmNlcy5maW5kKChzcikgPT4gc3IuTG9naWNhbFJlc291cmNlSWQgPT09IGxvZ2ljYWxJZCk7XG4gICAgaWYgKCFmb3VuZFJlc291cmNlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmIChmb3VuZFJlc291cmNlLlJlc291cmNlVHlwZSA9PSAnQVdTOjpDbG91ZEZvcm1hdGlvbjo6U3RhY2snICYmIGF0dHJpYnV0ZT8uc3RhcnRzV2l0aCgnT3V0cHV0cy4nKSkge1xuICAgICAgY29uc3QgZGVwZW5kYW50U3RhY2sgPSB0aGlzLmZpbmROZXN0ZWRTdGFjayhsb2dpY2FsSWQsIHRoaXMubmVzdGVkU3RhY2tzKTtcbiAgICAgIGlmICghZGVwZW5kYW50U3RhY2sgfHwgIWRlcGVuZGFudFN0YWNrLnBoeXNpY2FsTmFtZSkge1xuICAgICAgICAvL3RoaXMgaXMgYSBuZXdseSBjcmVhdGVkIG5lc3RlZCBzdGFjayBhbmQgY2Fubm90IGJlIGhvdHN3YXBwZWRcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV2YWx1YXRlQ2ZuVGVtcGxhdGUgPSBhd2FpdCB0aGlzLmNyZWF0ZU5lc3RlZEV2YWx1YXRlQ2xvdWRGb3JtYXRpb25UZW1wbGF0ZShcbiAgICAgICAgZGVwZW5kYW50U3RhY2sucGh5c2ljYWxOYW1lLFxuICAgICAgICBkZXBlbmRhbnRTdGFjay5nZW5lcmF0ZWRUZW1wbGF0ZSxcbiAgICAgICAgZGVwZW5kYW50U3RhY2suZ2VuZXJhdGVkVGVtcGxhdGUuUGFyYW1ldGVycyEsXG4gICAgICApO1xuXG4gICAgICAvLyBTcGxpdCBPdXRwdXRzLjxyZWZOYW1lPiBpbnRvICdPdXRwdXRzJyBhbmQgJzxyZWZOYW1lPicgYW5kIHJlY3Vyc2l2ZWx5IGNhbGwgZXZhbHVhdGVcbiAgICAgIHJldHVybiBldmFsdWF0ZUNmblRlbXBsYXRlLmV2YWx1YXRlQ2ZuRXhwcmVzc2lvbih7XG4gICAgICAgICdGbjo6R2V0QXR0JzogYXR0cmlidXRlLnNwbGl0KC9cXC4oLiopL3MpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIG5vdywgd2UgbmVlZCB0byBmb3JtYXQgdGhlIGFwcHJvcHJpYXRlIGlkZW50aWZpZXIgZGVwZW5kaW5nIG9uIHRoZSByZXNvdXJjZSB0eXBlLFxuICAgIC8vIGFuZCB0aGUgcmVxdWVzdGVkIGF0dHJpYnV0ZSBuYW1lXG4gICAgcmV0dXJuIHRoaXMuZm9ybWF0UmVzb3VyY2VBdHRyaWJ1dGUoZm91bmRSZXNvdXJjZSwgYXR0cmlidXRlKTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZE5lc3RlZFN0YWNrKFxuICAgIGxvZ2ljYWxJZDogc3RyaW5nLFxuICAgIG5lc3RlZFN0YWNrczoge1xuICAgICAgW25lc3RlZFN0YWNrTG9naWNhbElkOiBzdHJpbmddOiBOZXN0ZWRTdGFja1RlbXBsYXRlcztcbiAgICB9LFxuICApOiBOZXN0ZWRTdGFja1RlbXBsYXRlcyB8IHVuZGVmaW5lZCB7XG4gICAgZm9yIChjb25zdCBuZXN0ZWRTdGFja0xvZ2ljYWxJZCBvZiBPYmplY3Qua2V5cyhuZXN0ZWRTdGFja3MpKSB7XG4gICAgICBpZiAobmVzdGVkU3RhY2tMb2dpY2FsSWQgPT09IGxvZ2ljYWxJZCkge1xuICAgICAgICByZXR1cm4gbmVzdGVkU3RhY2tzW25lc3RlZFN0YWNrTG9naWNhbElkXTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNoZWNrSW5OZXN0ZWRDaGlsZFN0YWNrcyA9IHRoaXMuZmluZE5lc3RlZFN0YWNrKFxuICAgICAgICBsb2dpY2FsSWQsXG4gICAgICAgIG5lc3RlZFN0YWNrc1tuZXN0ZWRTdGFja0xvZ2ljYWxJZF0ubmVzdGVkU3RhY2tUZW1wbGF0ZXMsXG4gICAgICApO1xuICAgICAgaWYgKGNoZWNrSW5OZXN0ZWRDaGlsZFN0YWNrcykgcmV0dXJuIGNoZWNrSW5OZXN0ZWRDaGlsZFN0YWNrcztcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIHByaXZhdGUgZm9ybWF0UmVzb3VyY2VBdHRyaWJ1dGUocmVzb3VyY2U6IFN0YWNrUmVzb3VyY2VTdW1tYXJ5LCBhdHRyaWJ1dGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgcGh5c2ljYWxJZCA9IHJlc291cmNlLlBoeXNpY2FsUmVzb3VyY2VJZDtcblxuICAgIC8vIG5vIGF0dHJpYnV0ZSBtZWFucyBSZWYgZXhwcmVzc2lvbiwgZm9yIHdoaWNoIHdlIHVzZSB0aGUgcGh5c2ljYWwgSUQgZGlyZWN0bHlcbiAgICBpZiAoIWF0dHJpYnV0ZSkge1xuICAgICAgcmV0dXJuIHBoeXNpY2FsSWQ7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb3VyY2VUeXBlRm9ybWF0cyA9IFJFU09VUkNFX1RZUEVfQVRUUklCVVRFU19GT1JNQVRTW3Jlc291cmNlLlJlc291cmNlVHlwZSFdO1xuICAgIGlmICghcmVzb3VyY2VUeXBlRm9ybWF0cykge1xuICAgICAgdGhyb3cgbmV3IENmbkV2YWx1YXRpb25FeGNlcHRpb24oXG4gICAgICAgIGBXZSBkb24ndCBzdXBwb3J0IGF0dHJpYnV0ZXMgb2YgdGhlICcke3Jlc291cmNlLlJlc291cmNlVHlwZX0nIHJlc291cmNlLiBUaGlzIGlzIGEgQ0RLIGxpbWl0YXRpb24uIGAgK1xuICAgICAgICAgICdQbGVhc2UgcmVwb3J0IGl0IGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvbmV3L2Nob29zZScsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBhdHRyaWJ1dGVGbXRGdW5jID0gcmVzb3VyY2VUeXBlRm9ybWF0c1thdHRyaWJ1dGVdO1xuICAgIGlmICghYXR0cmlidXRlRm10RnVuYykge1xuICAgICAgdGhyb3cgbmV3IENmbkV2YWx1YXRpb25FeGNlcHRpb24oXG4gICAgICAgIGBXZSBkb24ndCBzdXBwb3J0IHRoZSAnJHthdHRyaWJ1dGV9JyBhdHRyaWJ1dGUgb2YgdGhlICcke3Jlc291cmNlLlJlc291cmNlVHlwZX0nIHJlc291cmNlLiBUaGlzIGlzIGEgQ0RLIGxpbWl0YXRpb24uIGAgK1xuICAgICAgICAgICdQbGVhc2UgcmVwb3J0IGl0IGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9pc3N1ZXMvbmV3L2Nob29zZScsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBzZXJ2aWNlID0gdGhpcy5nZXRTZXJ2aWNlT2ZSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgY29uc3QgcmVzb3VyY2VUeXBlQXJuUGFydCA9IHRoaXMuZ2V0UmVzb3VyY2VUeXBlQXJuUGFydE9mUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgIHJldHVybiBhdHRyaWJ1dGVGbXRGdW5jKHtcbiAgICAgIHBhcnRpdGlvbjogdGhpcy5wYXJ0aXRpb24sXG4gICAgICBzZXJ2aWNlLFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIHJlc291cmNlVHlwZTogcmVzb3VyY2VUeXBlQXJuUGFydCxcbiAgICAgIHJlc291cmNlTmFtZTogcGh5c2ljYWxJZCEsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldFNlcnZpY2VPZlJlc291cmNlKHJlc291cmNlOiBTdGFja1Jlc291cmNlU3VtbWFyeSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHJlc291cmNlLlJlc291cmNlVHlwZSEuc3BsaXQoJzo6JylbMV0udG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UmVzb3VyY2VUeXBlQXJuUGFydE9mUmVzb3VyY2UocmVzb3VyY2U6IFN0YWNrUmVzb3VyY2VTdW1tYXJ5KTogc3RyaW5nIHtcbiAgICBjb25zdCByZXNvdXJjZVR5cGUgPSByZXNvdXJjZS5SZXNvdXJjZVR5cGUhO1xuICAgIGNvbnN0IHNwZWNpYWxDYXNlUmVzb3VyY2VUeXBlID0gUkVTT1VSQ0VfVFlQRV9TUEVDSUFMX05BTUVTW3Jlc291cmNlVHlwZV0/LnJlc291cmNlVHlwZTtcbiAgICByZXR1cm4gc3BlY2lhbENhc2VSZXNvdXJjZVR5cGVcbiAgICAgID8gc3BlY2lhbENhc2VSZXNvdXJjZVR5cGVcbiAgICAgIDogLy8gdGhpcyBpcyB0aGUgZGVmYXVsdCBjYXNlXG4gICAgICByZXNvdXJjZVR5cGUuc3BsaXQoJzo6JylbMl0udG9Mb3dlckNhc2UoKTtcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBUZW1wbGF0ZSA9IHsgW3NlY3Rpb246IHN0cmluZ106IHsgW2hlYWRpbmdzOiBzdHJpbmddOiBhbnkgfSB9O1xuXG5pbnRlcmZhY2UgQXJuUGFydHMge1xuICByZWFkb25seSBwYXJ0aXRpb246IHN0cmluZztcbiAgcmVhZG9ubHkgc2VydmljZTogc3RyaW5nO1xuICByZWFkb25seSByZWdpb246IHN0cmluZztcbiAgcmVhZG9ubHkgYWNjb3VudDogc3RyaW5nO1xuICByZWFkb25seSByZXNvdXJjZVR5cGU6IHN0cmluZztcbiAgcmVhZG9ubHkgcmVzb3VyY2VOYW1lOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVXN1YWxseSwgd2UgZGVkdWNlIHRoZSBuYW1lcyBvZiB0aGUgc2VydmljZSBhbmQgdGhlIHJlc291cmNlIHR5cGUgdXNlZCB0byBmb3JtYXQgdGhlIEFSTiBmcm9tIHRoZSBDbG91ZEZvcm1hdGlvbiByZXNvdXJjZSB0eXBlLlxuICogRm9yIGEgQ0ZOIHR5cGUgbGlrZSBBV1M6OlNlcnZpY2U6OlJlc291cmNlVHlwZSwgdGhlIHNlY29uZCBzZWdtZW50IGJlY29tZXMgdGhlIHNlcnZpY2UgbmFtZSwgYW5kIHRoZSB0aGlyZCB0aGUgcmVzb3VyY2UgdHlwZVxuICogKGFmdGVyIGNvbnZlcnRpbmcgYm90aCBvZiB0aGVtIHRvIGxvd2VyY2FzZSkuXG4gKiBIb3dldmVyLCBzb21lIHJlc291cmNlIHR5cGVzIGJyZWFrIHRoaXMgc2ltcGxlIGNvbnZlbnRpb24sIGFuZCB3ZSBuZWVkIHRvIHNwZWNpYWwtY2FzZSB0aGVtLlxuICogVGhpcyBtYXAgaXMgZm9yIHN0b3JpbmcgdGhvc2UgY2FzZXMuXG4gKi9cbmNvbnN0IFJFU09VUkNFX1RZUEVfU1BFQ0lBTF9OQU1FUzoge1xuICBbdHlwZTogc3RyaW5nXTogeyByZXNvdXJjZVR5cGU6IHN0cmluZyB9O1xufSA9IHtcbiAgJ0FXUzo6RXZlbnRzOjpFdmVudEJ1cyc6IHtcbiAgICByZXNvdXJjZVR5cGU6ICdldmVudC1idXMnLFxuICB9LFxufTtcblxuY29uc3QgUkVTT1VSQ0VfVFlQRV9BVFRSSUJVVEVTX0ZPUk1BVFM6IHtcbiAgW3R5cGU6IHN0cmluZ106IHsgW2F0dHJpYnV0ZTogc3RyaW5nXTogKHBhcnRzOiBBcm5QYXJ0cykgPT4gc3RyaW5nIH07XG59ID0ge1xuICAnQVdTOjpJQU06OlJvbGUnOiB7IEFybjogaWFtQXJuRm10IH0sXG4gICdBV1M6OklBTTo6VXNlcic6IHsgQXJuOiBpYW1Bcm5GbXQgfSxcbiAgJ0FXUzo6SUFNOjpHcm91cCc6IHsgQXJuOiBpYW1Bcm5GbXQgfSxcbiAgJ0FXUzo6UzM6OkJ1Y2tldCc6IHsgQXJuOiBzM0FybkZtdCB9LFxuICAnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJzogeyBBcm46IHN0ZENvbG9uUmVzb3VyY2VBcm5GbXQgfSxcbiAgJ0FXUzo6RXZlbnRzOjpFdmVudEJ1cyc6IHtcbiAgICBBcm46IHN0ZFNsYXNoUmVzb3VyY2VBcm5GbXQsXG4gICAgLy8gdGhlIG5hbWUgYXR0cmlidXRlIG9mIHRoZSBFdmVudEJ1cyBpcyB0aGUgc2FtZSBhcyB0aGUgUmVmXG4gICAgTmFtZTogKHBhcnRzKSA9PiBwYXJ0cy5yZXNvdXJjZU5hbWUsXG4gIH0sXG4gICdBV1M6OkR5bmFtb0RCOjpUYWJsZSc6IHsgQXJuOiBzdGRTbGFzaFJlc291cmNlQXJuRm10IH0sXG4gICdBV1M6OkFwcFN5bmM6OkdyYXBoUUxBcGknOiB7IEFwaUlkOiBhcHBzeW5jR3JhcGhRbEFwaUFwaUlkRm10IH0sXG4gICdBV1M6OkFwcFN5bmM6OkZ1bmN0aW9uQ29uZmlndXJhdGlvbic6IHtcbiAgICBGdW5jdGlvbklkOiBhcHBzeW5jR3JhcGhRbEZ1bmN0aW9uSURGbXQsXG4gIH0sXG4gICdBV1M6OkFwcFN5bmM6OkRhdGFTb3VyY2UnOiB7IE5hbWU6IGFwcHN5bmNHcmFwaFFsRGF0YVNvdXJjZU5hbWVGbXQgfSxcbiAgJ0FXUzo6S01TOjpLZXknOiB7IEFybjogc3RkU2xhc2hSZXNvdXJjZUFybkZtdCB9LFxufTtcblxuZnVuY3Rpb24gaWFtQXJuRm10KHBhcnRzOiBBcm5QYXJ0cyk6IHN0cmluZyB7XG4gIC8vIHdlIHNraXAgcmVnaW9uIGZvciBJQU0gcmVzb3VyY2VzXG4gIHJldHVybiBgYXJuOiR7cGFydHMucGFydGl0aW9ufToke3BhcnRzLnNlcnZpY2V9Ojoke3BhcnRzLmFjY291bnR9OiR7cGFydHMucmVzb3VyY2VUeXBlfS8ke3BhcnRzLnJlc291cmNlTmFtZX1gO1xufVxuXG5mdW5jdGlvbiBzM0FybkZtdChwYXJ0czogQXJuUGFydHMpOiBzdHJpbmcge1xuICAvLyB3ZSBza2lwIGFjY291bnQsIHJlZ2lvbiBhbmQgcmVzb3VyY2VUeXBlIGZvciBTMyByZXNvdXJjZXNcbiAgcmV0dXJuIGBhcm46JHtwYXJ0cy5wYXJ0aXRpb259OiR7cGFydHMuc2VydmljZX06Ojoke3BhcnRzLnJlc291cmNlTmFtZX1gO1xufVxuXG5mdW5jdGlvbiBzdGRDb2xvblJlc291cmNlQXJuRm10KHBhcnRzOiBBcm5QYXJ0cyk6IHN0cmluZyB7XG4gIC8vIHRoaXMgaXMgYSBzdGFuZGFyZCBmb3JtYXQgZm9yIEFSTnMgbGlrZTogYXJuOmF3czpzZXJ2aWNlOnJlZ2lvbjphY2NvdW50OnJlc291cmNlVHlwZTpyZXNvdXJjZU5hbWVcbiAgcmV0dXJuIGBhcm46JHtwYXJ0cy5wYXJ0aXRpb259OiR7cGFydHMuc2VydmljZX06JHtwYXJ0cy5yZWdpb259OiR7cGFydHMuYWNjb3VudH06JHtwYXJ0cy5yZXNvdXJjZVR5cGV9OiR7cGFydHMucmVzb3VyY2VOYW1lfWA7XG59XG5cbmZ1bmN0aW9uIHN0ZFNsYXNoUmVzb3VyY2VBcm5GbXQocGFydHM6IEFyblBhcnRzKTogc3RyaW5nIHtcbiAgLy8gdGhpcyBpcyBhIHN0YW5kYXJkIGZvcm1hdCBmb3IgQVJOcyBsaWtlOiBhcm46YXdzOnNlcnZpY2U6cmVnaW9uOmFjY291bnQ6cmVzb3VyY2VUeXBlL3Jlc291cmNlTmFtZVxuICByZXR1cm4gYGFybjoke3BhcnRzLnBhcnRpdGlvbn06JHtwYXJ0cy5zZXJ2aWNlfToke3BhcnRzLnJlZ2lvbn06JHtwYXJ0cy5hY2NvdW50fToke3BhcnRzLnJlc291cmNlVHlwZX0vJHtwYXJ0cy5yZXNvdXJjZU5hbWV9YDtcbn1cblxuZnVuY3Rpb24gYXBwc3luY0dyYXBoUWxBcGlBcGlJZEZtdChwYXJ0czogQXJuUGFydHMpOiBzdHJpbmcge1xuICAvLyBhcm46YXdzOmFwcHN5bmM6dXMtZWFzdC0xOjExMTExMTExMTExMTphcGlzLzxhcGlJZD5cbiAgcmV0dXJuIHBhcnRzLnJlc291cmNlTmFtZS5zcGxpdCgnLycpWzFdO1xufVxuXG5mdW5jdGlvbiBhcHBzeW5jR3JhcGhRbEZ1bmN0aW9uSURGbXQocGFydHM6IEFyblBhcnRzKTogc3RyaW5nIHtcbiAgLy8gYXJuOmF3czphcHBzeW5jOnVzLWVhc3QtMToxMTExMTExMTExMTE6YXBpcy88YXBpSWQ+L2Z1bmN0aW9ucy88ZnVuY3Rpb25JZD5cbiAgcmV0dXJuIHBhcnRzLnJlc291cmNlTmFtZS5zcGxpdCgnLycpWzNdO1xufVxuXG5mdW5jdGlvbiBhcHBzeW5jR3JhcGhRbERhdGFTb3VyY2VOYW1lRm10KHBhcnRzOiBBcm5QYXJ0cyk6IHN0cmluZyB7XG4gIC8vIGFybjphd3M6YXBwc3luYzp1cy1lYXN0LTE6MTExMTExMTExMTExOmFwaXMvPGFwaUlkPi9kYXRhc291cmNlcy88bmFtZT5cbiAgcmV0dXJuIHBhcnRzLnJlc291cmNlTmFtZS5zcGxpdCgnLycpWzNdO1xufVxuXG5pbnRlcmZhY2UgSW50cmluc2ljIHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBhcmdzOiBhbnk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFzeW5jR2xvYmFsUmVwbGFjZShzdHI6IHN0cmluZywgcmVnZXg6IFJlZ0V4cCwgY2I6ICh4OiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nPik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGlmICghcmVnZXguZ2xvYmFsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdSZWdleCBtdXN0IGJlIGNyZWF0ZWQgd2l0aCAvZyBmbGFnJyk7XG4gIH1cblxuICBjb25zdCByZXQgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuICBsZXQgc3RhcnQgPSAwO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IG1hdGNoID0gcmVnZXguZXhlYyhzdHIpO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldC5wdXNoKHN0ci5zdWJzdHJpbmcoc3RhcnQsIG1hdGNoLmluZGV4KSk7XG4gICAgcmV0LnB1c2goYXdhaXQgY2IobWF0Y2hbMV0pKTtcblxuICAgIHN0YXJ0ID0gcmVnZXgubGFzdEluZGV4O1xuICB9XG4gIHJldC5wdXNoKHN0ci5zbGljZShzdGFydCkpO1xuXG4gIHJldHVybiByZXQuam9pbignJyk7XG59XG4iXX0=