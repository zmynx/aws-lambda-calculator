"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const yaml_1 = require("yaml");
const bootstrap_1 = require("../../lib/api/bootstrap");
const legacy_template_1 = require("../../lib/api/bootstrap/legacy-template");
const serialize_1 = require("../../lib/serialize");
const mock_sdk_1 = require("../util/mock-sdk");
const env = {
    account: '123456789012',
    region: 'us-east-1',
    name: 'mock',
};
const templateBody = (0, serialize_1.toYAML)((0, serialize_1.deserializeStructure)((0, serialize_1.serializeStructure)((0, legacy_template_1.legacyBootstrapTemplate)({}), true)));
const changeSetName = 'cdk-deploy-change-set';
jest.mock('../../lib/api/util/checks', () => ({
    determineAllowCrossAccountAssetPublishing: jest.fn().mockResolvedValue(true),
}));
let sdk;
let changeSetTemplate;
let bootstrapper;
beforeEach(() => {
    sdk = new mock_sdk_1.MockSdkProvider();
    bootstrapper = new bootstrap_1.Bootstrapper({ source: 'legacy' });
    mock_sdk_1.mockCloudFormationClient.reset();
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    // First two calls, no stacks exist (first is for version checking, second is in deploy-stack.ts)
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.CreateChangeSetCommand).callsFake((input) => {
        changeSetTemplate = (0, serialize_1.deserializeStructure)(input.TemplateBody);
        return {};
    });
    mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeChangeSetCommand).callsFake((input) => {
        return {
            ChangeSetName: input.ChangeSetName,
            StackName: input.StackName,
            Status: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
        };
    });
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [],
    })
        .resolvesOnce({
        Stacks: [],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                StackStatusReason: 'It is magic',
                EnableTerminationProtection: false,
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    });
});
test('do bootstrap', async () => {
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, { toolkitStackName: 'mockStack' });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(changeSetTemplate.Conditions.UsePublicAccessBlockConfiguration['Fn::Equals'][0]).toBe('true');
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('do bootstrap using custom bucket name', async () => {
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        parameters: {
            bucketName: 'foobar',
        },
    });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBe('foobar');
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(changeSetTemplate.Conditions.UsePublicAccessBlockConfiguration['Fn::Equals'][0]).toBe('true');
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('do bootstrap using KMS CMK', async () => {
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        parameters: {
            kmsKeyId: 'myKmsKey',
        },
    });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBe('myKmsKey');
    expect(changeSetTemplate.Conditions.UsePublicAccessBlockConfiguration['Fn::Equals'][0]).toBe('true');
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('bootstrap disable bucket Public Access Block Configuration', async () => {
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        parameters: {
            publicAccessBlockConfiguration: false,
        },
    });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(changeSetTemplate.Conditions.UsePublicAccessBlockConfiguration['Fn::Equals'][0]).toBe('false');
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('do bootstrap with custom tags for toolkit stack', async () => {
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        tags: [{ Key: 'Foo', Value: 'Bar' }],
    });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(changeSetTemplate.Conditions.UsePublicAccessBlockConfiguration['Fn::Equals'][0]).toBe('true');
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('passing trusted accounts to the old bootstrapping results in an error', async () => {
    await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        parameters: {
            trustedAccounts: ['0123456789012'],
        },
    })).rejects.toThrow('--trust can only be passed for the modern bootstrap experience.');
});
test('passing CFN execution policies to the old bootstrapping results in an error', async () => {
    await expect(bootstrapper.bootstrapEnvironment(env, sdk, {
        toolkitStackName: 'mockStack',
        parameters: {
            cloudFormationExecutionPolicies: ['arn:aws:iam::aws:policy/AdministratorAccess'],
        },
    })).rejects.toThrow('--cloudformation-execution-policies can only be passed for the modern bootstrap experience.');
});
test('even if the bootstrap stack is in a rollback state, can still retry bootstrapping it', async () => {
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.UPDATE_ROLLBACK_COMPLETE,
                StackStatusReason: 'It is magic',
                Outputs: [
                    { OutputKey: 'BucketName', OutputValue: 'bucket' },
                    { OutputKey: 'BucketDomainName', OutputValue: 'aws.com' },
                ],
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.UPDATE_ROLLBACK_COMPLETE,
                StackStatusReason: 'It is magic',
                Outputs: [
                    { OutputKey: 'BucketName', OutputValue: 'bucket' },
                    { OutputKey: 'BucketDomainName', OutputValue: 'aws.com' },
                ],
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                StackStatusReason: 'It is magic',
                EnableTerminationProtection: false,
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    });
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, { toolkitStackName: 'MagicalStack' });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.GetTemplateCommand, {
        StackName: 'MagicalStack',
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
});
test('even if the bootstrap stack failed to create, can still retry bootstrapping it', async () => {
    mock_sdk_1.mockCloudFormationClient
        .on(client_cloudformation_1.DescribeStacksCommand)
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE,
                StackStatusReason: 'It is magic',
                Outputs: [{ OutputKey: 'BucketName', OutputValue: 'bucket' }],
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE,
                StackStatusReason: 'It is magic',
                Outputs: [{ OutputKey: 'BucketName', OutputValue: 'bucket' }],
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    })
        .resolvesOnce({
        Stacks: [],
    })
        .resolvesOnce({
        Stacks: [
            {
                StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                StackStatusReason: 'It is magic',
                EnableTerminationProtection: false,
                StackName: 'MagicalStack',
                CreationTime: new Date(),
            },
        ],
    });
    // WHEN
    const ret = await bootstrapper.bootstrapEnvironment(env, sdk, { toolkitStackName: 'MagicalStack' });
    // THEN
    const bucketProperties = changeSetTemplate.Resources.StagingBucket.Properties;
    expect(bucketProperties.BucketName).toBeUndefined();
    expect(bucketProperties.BucketEncryption.ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault.KMSMasterKeyID).toBeUndefined();
    expect(ret.noOp).toBeFalsy();
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.DeleteStackCommand, {
        StackName: 'MagicalStack',
    });
});
test('stack is not termination protected by default', async () => {
    // WHEN
    // Seems silly, but we process the template multiple times to get the templateBody that goes into the call
    await bootstrapper.bootstrapEnvironment(env, sdk);
    // THEN
    // There are only two ways that termination can be set: either through calling CreateStackCommand
    // or by calling UpdateTerminationProtectionCommand, which is not done by default
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommand(client_cloudformation_1.CreateStackCommand);
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.CreateChangeSetCommand, {
        StackName: 'CDKToolkit',
        ChangeSetType: 'CREATE',
        ClientToken: expect.any(String),
        Description: expect.any(String),
        Parameters: [],
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
        ChangeSetName: changeSetName,
        TemplateBody: templateBody,
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
    expect(mock_sdk_1.mockCloudFormationClient).not.toHaveReceivedCommandWith(client_cloudformation_1.UpdateTerminationProtectionCommand, {
        EnableTerminationProtection: true,
        StackName: 'CDKToolkit',
    });
});
test('stack is termination protected when set', async () => {
    // WHEN
    await bootstrapper.bootstrapEnvironment(env, sdk, {
        terminationProtection: true,
    });
    // THEN
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ExecuteChangeSetCommand, {
        ChangeSetName: changeSetName,
    });
    expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.UpdateTerminationProtectionCommand, {
        EnableTerminationProtection: true,
        StackName: 'CDKToolkit',
    });
});
test('do showTemplate YAML', async () => {
    process.stdout.write = jest.fn().mockImplementationOnce((template) => {
        // THEN
        expect((0, yaml_1.parse)(template)).toHaveProperty('Description', 'The CDK Toolkit Stack. It was created by `cdk bootstrap` and manages resources necessary for managing your Cloud Applications with AWS CDK.');
    });
    // WHEN
    await bootstrapper.showTemplate(false);
});
test('do showTemplate JSON', async () => {
    process.stdout.write = jest.fn().mockImplementationOnce((template) => {
        // THEN
        expect(JSON.parse(template)).toHaveProperty('Description', 'The CDK Toolkit Stack. It was created by `cdk bootstrap` and manages resources necessary for managing your Cloud Applications with AWS CDK.');
    });
    // WHEN
    await bootstrapper.showTemplate(true);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJib290c3RyYXAudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBFQVV3QztBQUN4QywrQkFBNkI7QUFDN0IsdURBQXVEO0FBQ3ZELDZFQUFrRjtBQUNsRixtREFBdUY7QUFDdkYsK0NBQXVHO0FBRXZHLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLGNBQWM7SUFDdkIsTUFBTSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxFQUFFLE1BQU07Q0FDYixDQUFDO0FBRUYsTUFBTSxZQUFZLEdBQUcsSUFBQSxrQkFBTSxFQUFDLElBQUEsZ0NBQW9CLEVBQUMsSUFBQSw4QkFBa0IsRUFBQyxJQUFBLHlDQUF1QixFQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RyxNQUFNLGFBQWEsR0FBRyx1QkFBdUIsQ0FBQztBQUU5QyxJQUFJLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDNUMseUNBQXlDLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztDQUM3RSxDQUFDLENBQUMsQ0FBQztBQUNKLElBQUksR0FBb0IsQ0FBQztBQUN6QixJQUFJLGlCQUFrQyxDQUFDO0FBQ3ZDLElBQUksWUFBMEIsQ0FBQztBQUMvQixVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsR0FBRyxHQUFHLElBQUksMEJBQWUsRUFBRSxDQUFDO0lBQzVCLFlBQVksR0FBRyxJQUFJLHdCQUFZLENBQUMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN0RCxtQ0FBd0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNqQyxJQUFBLG1DQUF3QixHQUFFLENBQUM7SUFDM0IsaUdBQWlHO0lBQ2pHLG1DQUF3QixDQUFDLEVBQUUsQ0FBQyw4Q0FBc0IsQ0FBQyxDQUFD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SSxDQUFDLEVBQUUsRUFBRSxDQUFDLHNCQUFzQixDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7UUFDbkUsT0FBTztRQUNQLE1BQU0sQ0FBQyxJQUFBLFlBQUssRUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FDcEMsYUFBYSxFQUNiLDZJQUE2SSxDQUM5SSxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPO0lBQ1AsTUFBTSxZQUFZLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pDLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEtBQUssSUFBSSxFQUFFO0lBQ3RDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFO1FBQ25FLE9BQU87UUFDUCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FDekMsYUFBYSxFQUNiLDZJQUE2SSxDQUM5SSxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPO0lBQ1AsTUFBTSxZQUFZLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hDLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ3JlYXRlQ2hhbmdlU2V0Q29tbWFuZCxcbiAgQ3JlYXRlU3RhY2tDb21tYW5kLFxuICBEZWxldGVTdGFja0NvbW1hbmQsXG4gIERlc2NyaWJlQ2hhbmdlU2V0Q29tbWFuZCxcbiAgRGVzY3JpYmVTdGFja3NDb21tYW5kLFxuICBFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCxcbiAgR2V0VGVtcGxhdGVDb21tYW5kLFxuICBTdGFja1N0YXR1cyxcbiAgVXBkYXRlVGVybWluYXRpb25Qcm90ZWN0aW9uQ29tbWFuZCxcbn0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSAneWFtbCc7XG5pbXBvcnQgeyBCb290c3RyYXBwZXIgfSBmcm9tICcuLi8uLi9saWIvYXBpL2Jvb3RzdHJhcCc7XG5pbXBvcnQgeyBsZWdhY3lCb290c3RyYXBUZW1wbGF0ZSB9IGZyb20gJy4uLy4uL2xpYi9hcGkvYm9vdHN0cmFwL2xlZ2FjeS10ZW1wbGF0ZSc7XG5pbXBvcnQgeyBkZXNlcmlhbGl6ZVN0cnVjdHVyZSwgc2VyaWFsaXplU3RydWN0dXJlLCB0b1lBTUwgfSBmcm9tICcuLi8uLi9saWIvc2VyaWFsaXplJztcbmltcG9ydCB7IE1vY2tTZGtQcm92aWRlciwgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LCByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgbmFtZTogJ21vY2snLFxufTtcblxuY29uc3QgdGVtcGxhdGVCb2R5ID0gdG9ZQU1MKGRlc2VyaWFsaXplU3RydWN0dXJlKHNlcmlhbGl6ZVN0cnVjdHVyZShsZWdhY3lCb290c3RyYXBUZW1wbGF0ZSh7fSksIHRydWUpKSk7XG5jb25zdCBjaGFuZ2VTZXROYW1lID0gJ2Nkay1kZXBsb3ktY2hhbmdlLXNldCc7XG5cbmplc3QubW9jaygnLi4vLi4vbGliL2FwaS91dGlsL2NoZWNrcycsICgpID0+ICh7XG4gIGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nOiBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUodHJ1ZSksXG59KSk7XG5sZXQgc2RrOiBNb2NrU2RrUHJvdmlkZXI7XG5sZXQgY2hhbmdlU2V0VGVtcGxhdGU6IGFueSB8IHVuZGVmaW5lZDtcbmxldCBib290c3RyYXBwZXI6IEJvb3RzdHJhcHBlcjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICBzZGsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gIGJvb3RzdHJhcHBlciA9IG5ldyBCb290c3RyYXBwZXIoeyBzb3VyY2U6ICdsZWdhY3knIH0pO1xuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQucmVzZXQoKTtcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0KCk7XG4gIC8vIEZpcnN0IHR3byBjYWxscywgbm8gc3RhY2tzIGV4aXN0IChmaXJzdCBpcyBmb3IgdmVyc2lvbiBjaGVja2luZywgc2Vjb25kIGlzIGluIGRlcGxveS1zdGFjay50cylcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKENyZWF0ZUNoYW5nZVNldENvbW1hbmQpLmNhbGxzRmFrZSgoaW5wdXQpID0+IHtcbiAgICBjaGFuZ2VTZXRUZW1wbGF0ZSA9IGRlc2VyaWFsaXplU3RydWN0dXJlKGlucHV0LlRlbXBsYXRlQm9keSk7XG4gICAgcmV0dXJuIHt9O1xuICB9KTtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlQ2hhbmdlU2V0Q29tbWFuZCkuY2FsbHNGYWtlKChpbnB1dCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBDaGFuZ2VTZXROYW1lOiBpbnB1dC5DaGFuZ2VTZXROYW1lLFxuICAgICAgU3RhY2tOYW1lOiBpbnB1dC5TdGFja05hbWUsXG4gICAgICBTdGF0dXM6IFN0YWNrU3RhdHVzLkNSRUFURV9DT01QTEVURSxcbiAgICB9O1xuICB9KTtcbiAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZClcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW10sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW10sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLkNSRUFURV9DT01QTEVURSxcbiAgICAgICAgICBTdGFja1N0YXR1c1JlYXNvbjogJ0l0IGlzIG1hZ2ljJyxcbiAgICAgICAgICBFbmFibGVUZXJtaW5hdGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgICAgIFN0YWNrTmFtZTogJ01hZ2ljYWxTdGFjaycsXG4gICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbn0pO1xuXG50ZXN0KCdkbyBib290c3RyYXAnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgY29uc3QgcmV0ID0gYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7IHRvb2xraXRTdGFja05hbWU6ICdtb2NrU3RhY2snIH0pO1xuXG4gIC8vIFRIRU5cbiAgY29uc3QgYnVja2V0UHJvcGVydGllcyA9IGNoYW5nZVNldFRlbXBsYXRlLlJlc291cmNlcy5TdGFnaW5nQnVja2V0LlByb3BlcnRpZXM7XG4gIGV4cGVjdChidWNrZXRQcm9wZXJ0aWVzLkJ1Y2tldE5hbWUpLnRvQmVVbmRlZmluZWQoKTtcbiAgZXhwZWN0KFxuICAgIGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0RW5jcnlwdGlvbi5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25bMF0uU2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQuS01TTWFzdGVyS2V5SUQsXG4gICkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoY2hhbmdlU2V0VGVtcGxhdGUuQ29uZGl0aW9ucy5Vc2VQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb25bJ0ZuOjpFcXVhbHMnXVswXSkudG9CZSgndHJ1ZScpO1xuICBleHBlY3QocmV0Lm5vT3ApLnRvQmVGYWxzeSgpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgQ2hhbmdlU2V0TmFtZTogY2hhbmdlU2V0TmFtZSxcbiAgfSk7XG59KTtcblxudGVzdCgnZG8gYm9vdHN0cmFwIHVzaW5nIGN1c3RvbSBidWNrZXQgbmFtZScsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBjb25zdCByZXQgPSBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICB0b29sa2l0U3RhY2tOYW1lOiAnbW9ja1N0YWNrJyxcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICBidWNrZXROYW1lOiAnZm9vYmFyJyxcbiAgICB9LFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGNvbnN0IGJ1Y2tldFByb3BlcnRpZXMgPSBjaGFuZ2VTZXRUZW1wbGF0ZS5SZXNvdXJjZXMuU3RhZ2luZ0J1Y2tldC5Qcm9wZXJ0aWVzO1xuICBleHBlY3QoYnVja2V0UHJvcGVydGllcy5CdWNrZXROYW1lKS50b0JlKCdmb29iYXInKTtcbiAgZXhwZWN0KFxuICAgIGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0RW5jcnlwdGlvbi5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25bMF0uU2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQuS01TTWFzdGVyS2V5SUQsXG4gICkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoY2hhbmdlU2V0VGVtcGxhdGUuQ29uZGl0aW9ucy5Vc2VQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb25bJ0ZuOjpFcXVhbHMnXVswXSkudG9CZSgndHJ1ZScpO1xuICBleHBlY3QocmV0Lm5vT3ApLnRvQmVGYWxzeSgpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgQ2hhbmdlU2V0TmFtZTogY2hhbmdlU2V0TmFtZSxcbiAgfSk7XG59KTtcblxudGVzdCgnZG8gYm9vdHN0cmFwIHVzaW5nIEtNUyBDTUsnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgY29uc3QgcmV0ID0gYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgdG9vbGtpdFN0YWNrTmFtZTogJ21vY2tTdGFjaycsXG4gICAgcGFyYW1ldGVyczoge1xuICAgICAga21zS2V5SWQ6ICdteUttc0tleScsXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBjb25zdCBidWNrZXRQcm9wZXJ0aWVzID0gY2hhbmdlU2V0VGVtcGxhdGUuUmVzb3VyY2VzLlN0YWdpbmdCdWNrZXQuUHJvcGVydGllcztcbiAgZXhwZWN0KGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0TmFtZSkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoXG4gICAgYnVja2V0UHJvcGVydGllcy5CdWNrZXRFbmNyeXB0aW9uLlNlcnZlclNpZGVFbmNyeXB0aW9uQ29uZmlndXJhdGlvblswXS5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdC5LTVNNYXN0ZXJLZXlJRCxcbiAgKS50b0JlKCdteUttc0tleScpO1xuICBleHBlY3QoY2hhbmdlU2V0VGVtcGxhdGUuQ29uZGl0aW9ucy5Vc2VQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb25bJ0ZuOjpFcXVhbHMnXVswXSkudG9CZSgndHJ1ZScpO1xuICBleHBlY3QocmV0Lm5vT3ApLnRvQmVGYWxzeSgpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgQ2hhbmdlU2V0TmFtZTogY2hhbmdlU2V0TmFtZSxcbiAgfSk7XG59KTtcblxudGVzdCgnYm9vdHN0cmFwIGRpc2FibGUgYnVja2V0IFB1YmxpYyBBY2Nlc3MgQmxvY2sgQ29uZmlndXJhdGlvbicsIGFzeW5jICgpID0+IHtcbiAgLy8gV0hFTlxuICBjb25zdCByZXQgPSBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICB0b29sa2l0U3RhY2tOYW1lOiAnbW9ja1N0YWNrJyxcbiAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICBwdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb246IGZhbHNlLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgY29uc3QgYnVja2V0UHJvcGVydGllcyA9IGNoYW5nZVNldFRlbXBsYXRlLlJlc291cmNlcy5TdGFnaW5nQnVja2V0LlByb3BlcnRpZXM7XG4gIGV4cGVjdChidWNrZXRQcm9wZXJ0aWVzLkJ1Y2tldE5hbWUpLnRvQmVVbmRlZmluZWQoKTtcbiAgZXhwZWN0KFxuICAgIGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0RW5jcnlwdGlvbi5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25bMF0uU2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQuS01TTWFzdGVyS2V5SUQsXG4gICkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoY2hhbmdlU2V0VGVtcGxhdGUuQ29uZGl0aW9ucy5Vc2VQdWJsaWNBY2Nlc3NCbG9ja0NvbmZpZ3VyYXRpb25bJ0ZuOjpFcXVhbHMnXVswXSkudG9CZSgnZmFsc2UnKTtcbiAgZXhwZWN0KHJldC5ub09wKS50b0JlRmFsc3koKTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCwge1xuICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gIH0pO1xufSk7XG5cbnRlc3QoJ2RvIGJvb3RzdHJhcCB3aXRoIGN1c3RvbSB0YWdzIGZvciB0b29sa2l0IHN0YWNrJywgYXN5bmMgKCkgPT4ge1xuICAvLyBXSEVOXG4gIGNvbnN0IHJldCA9IGF3YWl0IGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgIHRvb2xraXRTdGFja05hbWU6ICdtb2NrU3RhY2snLFxuICAgIHRhZ3M6IFt7IEtleTogJ0ZvbycsIFZhbHVlOiAnQmFyJyB9XSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBjb25zdCBidWNrZXRQcm9wZXJ0aWVzID0gY2hhbmdlU2V0VGVtcGxhdGUuUmVzb3VyY2VzLlN0YWdpbmdCdWNrZXQuUHJvcGVydGllcztcbiAgZXhwZWN0KGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0TmFtZSkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoXG4gICAgYnVja2V0UHJvcGVydGllcy5CdWNrZXRFbmNyeXB0aW9uLlNlcnZlclNpZGVFbmNyeXB0aW9uQ29uZmlndXJhdGlvblswXS5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdC5LTVNNYXN0ZXJLZXlJRCxcbiAgKS50b0JlVW5kZWZpbmVkKCk7XG4gIGV4cGVjdChjaGFuZ2VTZXRUZW1wbGF0ZS5Db25kaXRpb25zLlVzZVB1YmxpY0FjY2Vzc0Jsb2NrQ29uZmlndXJhdGlvblsnRm46OkVxdWFscyddWzBdKS50b0JlKCd0cnVlJyk7XG4gIGV4cGVjdChyZXQubm9PcCkudG9CZUZhbHN5KCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICBDaGFuZ2VTZXROYW1lOiBjaGFuZ2VTZXROYW1lLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdwYXNzaW5nIHRydXN0ZWQgYWNjb3VudHMgdG8gdGhlIG9sZCBib290c3RyYXBwaW5nIHJlc3VsdHMgaW4gYW4gZXJyb3InLCBhc3luYyAoKSA9PiB7XG4gIGF3YWl0IGV4cGVjdChcbiAgICBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHtcbiAgICAgIHRvb2xraXRTdGFja05hbWU6ICdtb2NrU3RhY2snLFxuICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICB0cnVzdGVkQWNjb3VudHM6IFsnMDEyMzQ1Njc4OTAxMiddLFxuICAgICAgfSxcbiAgICB9KSxcbiAgKS5yZWplY3RzLnRvVGhyb3coJy0tdHJ1c3QgY2FuIG9ubHkgYmUgcGFzc2VkIGZvciB0aGUgbW9kZXJuIGJvb3RzdHJhcCBleHBlcmllbmNlLicpO1xufSk7XG5cbnRlc3QoJ3Bhc3NpbmcgQ0ZOIGV4ZWN1dGlvbiBwb2xpY2llcyB0byB0aGUgb2xkIGJvb3RzdHJhcHBpbmcgcmVzdWx0cyBpbiBhbiBlcnJvcicsIGFzeW5jICgpID0+IHtcbiAgYXdhaXQgZXhwZWN0KFxuICAgIGJvb3RzdHJhcHBlci5ib290c3RyYXBFbnZpcm9ubWVudChlbnYsIHNkaywge1xuICAgICAgdG9vbGtpdFN0YWNrTmFtZTogJ21vY2tTdGFjaycsXG4gICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgIGNsb3VkRm9ybWF0aW9uRXhlY3V0aW9uUG9saWNpZXM6IFsnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQWRtaW5pc3RyYXRvckFjY2VzcyddLFxuICAgICAgfSxcbiAgICB9KSxcbiAgKS5yZWplY3RzLnRvVGhyb3coJy0tY2xvdWRmb3JtYXRpb24tZXhlY3V0aW9uLXBvbGljaWVzIGNhbiBvbmx5IGJlIHBhc3NlZCBmb3IgdGhlIG1vZGVybiBib290c3RyYXAgZXhwZXJpZW5jZS4nKTtcbn0pO1xuXG50ZXN0KCdldmVuIGlmIHRoZSBib290c3RyYXAgc3RhY2sgaXMgaW4gYSByb2xsYmFjayBzdGF0ZSwgY2FuIHN0aWxsIHJldHJ5IGJvb3RzdHJhcHBpbmcgaXQnLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudFxuICAgIC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5VUERBVEVfUk9MTEJBQ0tfQ09NUExFVEUsXG4gICAgICAgICAgU3RhY2tTdGF0dXNSZWFzb246ICdJdCBpcyBtYWdpYycsXG4gICAgICAgICAgT3V0cHV0czogW1xuICAgICAgICAgICAgeyBPdXRwdXRLZXk6ICdCdWNrZXROYW1lJywgT3V0cHV0VmFsdWU6ICdidWNrZXQnIH0sXG4gICAgICAgICAgICB7IE91dHB1dEtleTogJ0J1Y2tldERvbWFpbk5hbWUnLCBPdXRwdXRWYWx1ZTogJ2F3cy5jb20nIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snLFxuICAgICAgICAgIENyZWF0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLlVQREFURV9ST0xMQkFDS19DT01QTEVURSxcbiAgICAgICAgICBTdGFja1N0YXR1c1JlYXNvbjogJ0l0IGlzIG1hZ2ljJyxcbiAgICAgICAgICBPdXRwdXRzOiBbXG4gICAgICAgICAgICB7IE91dHB1dEtleTogJ0J1Y2tldE5hbWUnLCBPdXRwdXRWYWx1ZTogJ2J1Y2tldCcgfSxcbiAgICAgICAgICAgIHsgT3V0cHV0S2V5OiAnQnVja2V0RG9tYWluTmFtZScsIE91dHB1dFZhbHVlOiAnYXdzLmNvbScgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIFN0YWNrTmFtZTogJ01hZ2ljYWxTdGFjaycsXG4gICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICAgIFN0YWNrU3RhdHVzUmVhc29uOiAnSXQgaXMgbWFnaWMnLFxuICAgICAgICAgIEVuYWJsZVRlcm1pbmF0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICAgICAgU3RhY2tOYW1lOiAnTWFnaWNhbFN0YWNrJyxcbiAgICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmV0ID0gYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7IHRvb2xraXRTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snIH0pO1xuXG4gIC8vIFRIRU5cbiAgY29uc3QgYnVja2V0UHJvcGVydGllcyA9IGNoYW5nZVNldFRlbXBsYXRlLlJlc291cmNlcy5TdGFnaW5nQnVja2V0LlByb3BlcnRpZXM7XG4gIGV4cGVjdChidWNrZXRQcm9wZXJ0aWVzLkJ1Y2tldE5hbWUpLnRvQmVVbmRlZmluZWQoKTtcbiAgZXhwZWN0KFxuICAgIGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0RW5jcnlwdGlvbi5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25bMF0uU2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQuS01TTWFzdGVyS2V5SUQsXG4gICkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QocmV0Lm5vT3ApLnRvQmVGYWxzeSgpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEdldFRlbXBsYXRlQ29tbWFuZCwge1xuICAgIFN0YWNrTmFtZTogJ01hZ2ljYWxTdGFjaycsXG4gIH0pO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEV4ZWN1dGVDaGFuZ2VTZXRDb21tYW5kLCB7XG4gICAgQ2hhbmdlU2V0TmFtZTogY2hhbmdlU2V0TmFtZSxcbiAgfSk7XG59KTtcblxudGVzdCgnZXZlbiBpZiB0aGUgYm9vdHN0cmFwIHN0YWNrIGZhaWxlZCB0byBjcmVhdGUsIGNhbiBzdGlsbCByZXRyeSBib290c3RyYXBwaW5nIGl0JywgYXN5bmMgKCkgPT4ge1xuICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKVxuICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuUk9MTEJBQ0tfQ09NUExFVEUsXG4gICAgICAgICAgU3RhY2tTdGF0dXNSZWFzb246ICdJdCBpcyBtYWdpYycsXG4gICAgICAgICAgT3V0cHV0czogW3sgT3V0cHV0S2V5OiAnQnVja2V0TmFtZScsIE91dHB1dFZhbHVlOiAnYnVja2V0JyB9XSxcbiAgICAgICAgICBTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snLFxuICAgICAgICAgIENyZWF0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgIFN0YWNrczogW1xuICAgICAgICB7XG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLlJPTExCQUNLX0NPTVBMRVRFLFxuICAgICAgICAgIFN0YWNrU3RhdHVzUmVhc29uOiAnSXQgaXMgbWFnaWMnLFxuICAgICAgICAgIE91dHB1dHM6IFt7IE91dHB1dEtleTogJ0J1Y2tldE5hbWUnLCBPdXRwdXRWYWx1ZTogJ2J1Y2tldCcgfV0sXG4gICAgICAgICAgU3RhY2tOYW1lOiAnTWFnaWNhbFN0YWNrJyxcbiAgICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtdLFxuICAgIH0pXG4gICAgLnJlc29sdmVzT25jZSh7XG4gICAgICBTdGFja3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgICAgU3RhY2tTdGF0dXNSZWFzb246ICdJdCBpcyBtYWdpYycsXG4gICAgICAgICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICBTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snLFxuICAgICAgICAgIENyZWF0aW9uVGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXQgPSBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGssIHsgdG9vbGtpdFN0YWNrTmFtZTogJ01hZ2ljYWxTdGFjaycgfSk7XG5cbiAgLy8gVEhFTlxuICBjb25zdCBidWNrZXRQcm9wZXJ0aWVzID0gY2hhbmdlU2V0VGVtcGxhdGUuUmVzb3VyY2VzLlN0YWdpbmdCdWNrZXQuUHJvcGVydGllcztcbiAgZXhwZWN0KGJ1Y2tldFByb3BlcnRpZXMuQnVja2V0TmFtZSkudG9CZVVuZGVmaW5lZCgpO1xuICBleHBlY3QoXG4gICAgYnVja2V0UHJvcGVydGllcy5CdWNrZXRFbmNyeXB0aW9uLlNlcnZlclNpZGVFbmNyeXB0aW9uQ29uZmlndXJhdGlvblswXS5TZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdC5LTVNNYXN0ZXJLZXlJRCxcbiAgKS50b0JlVW5kZWZpbmVkKCk7XG4gIGV4cGVjdChyZXQubm9PcCkudG9CZUZhbHN5KCk7XG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICBDaGFuZ2VTZXROYW1lOiBjaGFuZ2VTZXROYW1lLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZWxldGVTdGFja0NvbW1hbmQsIHtcbiAgICBTdGFja05hbWU6ICdNYWdpY2FsU3RhY2snLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdzdGFjayBpcyBub3QgdGVybWluYXRpb24gcHJvdGVjdGVkIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgLy8gU2VlbXMgc2lsbHksIGJ1dCB3ZSBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSBtdWx0aXBsZSB0aW1lcyB0byBnZXQgdGhlIHRlbXBsYXRlQm9keSB0aGF0IGdvZXMgaW50byB0aGUgY2FsbFxuICBhd2FpdCBib290c3RyYXBwZXIuYm9vdHN0cmFwRW52aXJvbm1lbnQoZW52LCBzZGspO1xuXG4gIC8vIFRIRU5cbiAgLy8gVGhlcmUgYXJlIG9ubHkgdHdvIHdheXMgdGhhdCB0ZXJtaW5hdGlvbiBjYW4gYmUgc2V0OiBlaXRoZXIgdGhyb3VnaCBjYWxsaW5nIENyZWF0ZVN0YWNrQ29tbWFuZFxuICAvLyBvciBieSBjYWxsaW5nIFVwZGF0ZVRlcm1pbmF0aW9uUHJvdGVjdGlvbkNvbW1hbmQsIHdoaWNoIGlzIG5vdCBkb25lIGJ5IGRlZmF1bHRcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkubm90LnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChDcmVhdGVTdGFja0NvbW1hbmQpO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKENyZWF0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICBTdGFja05hbWU6ICdDREtUb29sa2l0JyxcbiAgICBDaGFuZ2VTZXRUeXBlOiAnQ1JFQVRFJyxcbiAgICBDbGllbnRUb2tlbjogZXhwZWN0LmFueShTdHJpbmcpLFxuICAgIERlc2NyaXB0aW9uOiBleHBlY3QuYW55KFN0cmluZyksXG4gICAgUGFyYW1ldGVyczogW10sXG4gICAgQ2FwYWJpbGl0aWVzOiBbJ0NBUEFCSUxJVFlfSUFNJywgJ0NBUEFCSUxJVFlfTkFNRURfSUFNJywgJ0NBUEFCSUxJVFlfQVVUT19FWFBBTkQnXSxcbiAgICBDaGFuZ2VTZXROYW1lOiBjaGFuZ2VTZXROYW1lLFxuICAgIFRlbXBsYXRlQm9keTogdGVtcGxhdGVCb2R5LFxuICB9KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChFeGVjdXRlQ2hhbmdlU2V0Q29tbWFuZCwge1xuICAgIENoYW5nZVNldE5hbWU6IGNoYW5nZVNldE5hbWUsXG4gIH0pO1xuICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS5ub3QudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb25Db21tYW5kLCB7XG4gICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgIFN0YWNrTmFtZTogJ0NES1Rvb2xraXQnLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdzdGFjayBpcyB0ZXJtaW5hdGlvbiBwcm90ZWN0ZWQgd2hlbiBzZXQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIFdIRU5cbiAgYXdhaXQgYm9vdHN0cmFwcGVyLmJvb3RzdHJhcEVudmlyb25tZW50KGVudiwgc2RrLCB7XG4gICAgdGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRXhlY3V0ZUNoYW5nZVNldENvbW1hbmQsIHtcbiAgICBDaGFuZ2VTZXROYW1lOiBjaGFuZ2VTZXROYW1lLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChVcGRhdGVUZXJtaW5hdGlvblByb3RlY3Rpb25Db21tYW5kLCB7XG4gICAgRW5hYmxlVGVybWluYXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgIFN0YWNrTmFtZTogJ0NES1Rvb2xraXQnLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdkbyBzaG93VGVtcGxhdGUgWUFNTCcsIGFzeW5jICgpID0+IHtcbiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUgPSBqZXN0LmZuKCkubW9ja0ltcGxlbWVudGF0aW9uT25jZSgodGVtcGxhdGUpID0+IHtcbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHBhcnNlKHRlbXBsYXRlKSkudG9IYXZlUHJvcGVydHkoXG4gICAgICAnRGVzY3JpcHRpb24nLFxuICAgICAgJ1RoZSBDREsgVG9vbGtpdCBTdGFjay4gSXQgd2FzIGNyZWF0ZWQgYnkgYGNkayBib290c3RyYXBgIGFuZCBtYW5hZ2VzIHJlc291cmNlcyBuZWNlc3NhcnkgZm9yIG1hbmFnaW5nIHlvdXIgQ2xvdWQgQXBwbGljYXRpb25zIHdpdGggQVdTIENESy4nLFxuICAgICk7XG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgYm9vdHN0cmFwcGVyLnNob3dUZW1wbGF0ZShmYWxzZSk7XG59KTtcblxudGVzdCgnZG8gc2hvd1RlbXBsYXRlIEpTT04nLCBhc3luYyAoKSA9PiB7XG4gIHByb2Nlc3Muc3Rkb3V0LndyaXRlID0gamVzdC5mbigpLm1vY2tJbXBsZW1lbnRhdGlvbk9uY2UoKHRlbXBsYXRlKSA9PiB7XG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChKU09OLnBhcnNlKHRlbXBsYXRlKSkudG9IYXZlUHJvcGVydHkoXG4gICAgICAnRGVzY3JpcHRpb24nLFxuICAgICAgJ1RoZSBDREsgVG9vbGtpdCBTdGFjay4gSXQgd2FzIGNyZWF0ZWQgYnkgYGNkayBib290c3RyYXBgIGFuZCBtYW5hZ2VzIHJlc291cmNlcyBuZWNlc3NhcnkgZm9yIG1hbmFnaW5nIHlvdXIgQ2xvdWQgQXBwbGljYXRpb25zIHdpdGggQVdTIENESy4nLFxuICAgICk7XG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgYm9vdHN0cmFwcGVyLnNob3dUZW1wbGF0ZSh0cnVlKTtcbn0pO1xuIl19