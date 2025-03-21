"use strict";
/* eslint-disable import/order */
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const api_1 = require("../../lib/api");
const mock_sdk_1 = require("../util/mock-sdk");
const client_s3_1 = require("@aws-sdk/client-s3");
const stack_refresh_1 = require("../../lib/api/garbage-collection/stack-refresh");
const client_ecr_1 = require("@aws-sdk/client-ecr");
let garbageCollector;
let stderrMock;
const cfnClient = mock_sdk_1.mockCloudFormationClient;
const s3Client = mock_sdk_1.mockS3Client;
const ecrClient = mock_sdk_1.mockECRClient;
const DAY = 24 * 60 * 60 * 1000; // Number of milliseconds in a day
beforeEach(() => {
    // By default, we'll return a non-found toolkit info
    jest.spyOn(api_1.ToolkitInfo, 'lookup').mockResolvedValue(api_1.ToolkitInfo.bootstrapStackNotFoundInfo('GarbageStack'));
    // Suppress stderr to not spam output during tests
    stderrMock = jest.spyOn(process.stderr, 'write').mockImplementation(() => {
        return true;
    });
    prepareDefaultCfnMock();
    prepareDefaultS3Mock();
    prepareDefaultEcrMock();
});
afterEach(() => {
    stderrMock.mockReset();
});
function mockTheToolkitInfo(stackProps) {
    jest.spyOn(api_1.ToolkitInfo, 'lookup').mockResolvedValue(api_1.ToolkitInfo.fromStack((0, mock_sdk_1.mockBootstrapStack)(stackProps)));
}
function gc(props) {
    return new api_1.GarbageCollector({
        sdkProvider: new mock_sdk_1.MockSdkProvider(),
        action: props.action,
        resolvedEnvironment: {
            account: '123456789012',
            region: 'us-east-1',
            name: 'mock',
        },
        bootstrapStackName: 'GarbageStack',
        rollbackBufferDays: props.rollbackBufferDays ?? 0,
        createdBufferDays: props.createdAtBufferDays ?? 0,
        type: props.type,
        confirm: false,
    });
}
describe('S3 Garbage Collection', () => {
    test('rollbackBufferDays = 0 -- assets to be deleted', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // no tagging
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 0);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 0);
        // assets are to be deleted
        expect(s3Client).toHaveReceivedCommandWith(client_s3_1.DeleteObjectsCommand, {
            Bucket: 'BUCKET_NAME',
            Delete: {
                Objects: [
                    { Key: 'asset1' },
                    { Key: 'asset2' },
                    { Key: 'asset3' },
                ],
                Quiet: true,
            },
        });
    });
    test('rollbackBufferDays > 0 -- assets to be tagged', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 3,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // assets tagged
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 3);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 2);
        // no deleting
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.DeleteObjectsCommand, 0);
    });
    test('createdAtBufferDays > 0', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 0,
            createdAtBufferDays: 5,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(s3Client).toHaveReceivedCommandWith(client_s3_1.DeleteObjectsCommand, {
            Bucket: 'BUCKET_NAME',
            Delete: {
                Objects: [
                    // asset1 not deleted because it is too young
                    { Key: 'asset2' },
                    { Key: 'asset3' },
                ],
                Quiet: true,
            },
        });
    });
    test('action = print -- does not tag or delete', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 3,
            action: 'print',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // get tags, but dont put tags
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 3);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 0);
        // no deleting
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.DeleteObjectsCommand, 0);
    });
    test('action = tag -- does not delete', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 3,
            action: 'tag',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // tags objects
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 3);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 2); // one object already has the tag
        // no deleting
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.DeleteObjectsCommand, 0);
    });
    test('action = delete-tagged -- does not tag', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 3,
            action: 'delete-tagged',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // get tags, but dont put tags
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 3);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 0);
    });
    test('ignore objects that are modified after gc start', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        s3Client.on(client_s3_1.ListObjectsV2Command).resolves({
            Contents: [
                { Key: 'asset1', LastModified: new Date(0) },
                { Key: 'asset2', LastModified: new Date(0) },
                { Key: 'asset3', LastModified: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) }, // future date ignored everywhere
            ],
            KeyCount: 3,
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        // assets are to be deleted
        expect(s3Client).toHaveReceivedCommandWith(client_s3_1.DeleteObjectsCommand, {
            Bucket: 'BUCKET_NAME',
            Delete: {
                Objects: [
                    { Key: 'asset1' },
                    { Key: 'asset2' },
                    // no asset3
                ],
                Quiet: true,
            },
        });
    });
});
describe('ECR Garbage Collection', () => {
    test('rollbackBufferDays = 0 -- assets to be deleted', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.DescribeImagesCommand, 1);
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.ListImagesCommand, 2);
        // no tagging
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 0);
        // assets are to be deleted
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.BatchDeleteImageCommand, {
            repositoryName: 'REPO_NAME',
            imageIds: [
                { imageDigest: 'digest3' },
                { imageDigest: 'digest2' },
            ],
        });
    });
    test('rollbackBufferDays > 0 -- assets to be tagged', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 3,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        // assets tagged
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 2);
        // no deleting
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.BatchDeleteImageCommand, 0);
    });
    test('createdAtBufferDays > 0', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 0,
            createdAtBufferDays: 5,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.BatchDeleteImageCommand, {
            repositoryName: 'REPO_NAME',
            imageIds: [
                // digest3 is too young to be deleted
                { imageDigest: 'digest2' },
            ],
        });
    });
    test('action = print -- does not tag or delete', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 3,
            action: 'print',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        // dont put tags
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 0);
        // no deleting
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.BatchDeleteImageCommand, 0);
    });
    test('action = tag -- does not delete', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 3,
            action: 'tag',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        // tags objects
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 2);
        // no deleting
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.BatchDeleteImageCommand, 0);
    });
    test('action = delete-tagged -- does not tag', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 3,
            action: 'delete-tagged',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        // dont put tags
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 0);
    });
    test('ignore images that are modified after gc start', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        prepareDefaultEcrMock();
        ecrClient.on(client_ecr_1.DescribeImagesCommand).resolves({
            imageDetails: [
                {
                    imageDigest: 'digest3',
                    imageTags: ['klmno'],
                    imagePushedAt: daysInThePast(2),
                    imageSizeInBytes: 100,
                },
                {
                    imageDigest: 'digest2',
                    imageTags: ['fghij'],
                    imagePushedAt: yearsInTheFuture(1),
                    imageSizeInBytes: 300000000,
                },
                {
                    imageDigest: 'digest1',
                    imageTags: ['abcde'],
                    imagePushedAt: daysInThePast(100),
                    imageSizeInBytes: 1000000000,
                },
            ],
        });
        prepareDefaultCfnMock();
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        // assets are to be deleted
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.BatchDeleteImageCommand, {
            repositoryName: 'REPO_NAME',
            imageIds: [
                { imageDigest: 'digest3' },
            ],
        });
    });
    test('succeeds when no images are present', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        prepareDefaultEcrMock();
        ecrClient.on(client_ecr_1.ListImagesCommand).resolves({
            imageIds: [],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 0,
            action: 'full',
        });
        // succeeds without hanging
        await garbageCollector.garbageCollect();
    });
    test('tags are unique', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 3,
            action: 'tag',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        // tags objects
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 2);
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.PutImageCommand, {
            repositoryName: 'REPO_NAME',
            imageDigest: 'digest3',
            imageManifest: expect.any(String),
            imageTag: expect.stringContaining(`0-${api_1.ECR_ISOLATED_TAG}`),
        });
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.PutImageCommand, {
            repositoryName: 'REPO_NAME',
            imageDigest: 'digest2',
            imageManifest: expect.any(String),
            imageTag: expect.stringContaining(`1-${api_1.ECR_ISOLATED_TAG}`),
        });
    });
    test('listImagesCommand returns nextToken', async () => {
        // This test is to ensure that the garbage collector can handle paginated responses from the ECR API
        // If not handled correctly, the garbage collector will continue to make requests to the ECR API
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        prepareDefaultEcrMock();
        ecrClient.on(client_ecr_1.ListImagesCommand).resolves({
            imageIds: [
                {
                    imageDigest: 'digest1',
                    imageTag: 'abcde',
                },
                {
                    imageDigest: 'digest2',
                    imageTag: 'fghij',
                },
            ],
            nextToken: 'nextToken',
        }).on(client_ecr_1.ListImagesCommand, {
            repositoryName: 'REPO_NAME',
            nextToken: 'nextToken',
        }).resolves({
            imageIds: [
                {
                    imageDigest: 'digest3',
                    imageTag: 'klmno',
                },
            ],
        });
        ecrClient.on(client_ecr_1.BatchGetImageCommand).resolvesOnce({
            images: [
                { imageId: { imageDigest: 'digest1' } },
                { imageId: { imageDigest: 'digest2' } },
            ],
        }).resolvesOnce({
            images: [
                { imageId: { imageDigest: 'digest3' } },
            ],
        });
        ecrClient.on(client_ecr_1.DescribeImagesCommand).resolvesOnce({
            imageDetails: [
                {
                    imageDigest: 'digest1',
                    imageTags: ['abcde'],
                    imagePushedAt: daysInThePast(100),
                    imageSizeInBytes: 1000000000,
                },
                { imageDigest: 'digest2', imageTags: ['fghij'], imagePushedAt: daysInThePast(10), imageSizeInBytes: 300000000 },
            ],
        }).resolvesOnce({
            imageDetails: [
                { imageDigest: 'digest3', imageTags: ['klmno'], imagePushedAt: daysInThePast(2), imageSizeInBytes: 100 },
            ],
        });
        prepareDefaultCfnMock();
        garbageCollector = gc({
            type: 'ecr',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.DescribeImagesCommand, 2);
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.ListImagesCommand, 4);
        // no tagging
        expect(ecrClient).toHaveReceivedCommandTimes(client_ecr_1.PutImageCommand, 0);
        expect(ecrClient).toHaveReceivedCommandWith(client_ecr_1.BatchDeleteImageCommand, {
            repositoryName: 'REPO_NAME',
            imageIds: [
                { imageDigest: 'digest2' },
                { imageDigest: 'digest3' },
            ],
        });
    });
});
describe('CloudFormation API calls', () => {
    test('bootstrap filters out other bootstrap versions', async () => {
        mockTheToolkitInfo({
            Parameters: [{
                    ParameterKey: 'Qualifier',
                    ParameterValue: 'zzzzzz',
                }],
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 3,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.GetTemplateSummaryCommand, 2);
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.GetTemplateCommand, 0);
    });
    test('parameter hashes are included', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        cfnClient.on(client_cloudformation_1.GetTemplateSummaryCommand).resolves({
            Parameters: [{
                    ParameterKey: 'AssetParametersasset1',
                    DefaultValue: 'asset1',
                }],
        });
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 0,
            action: 'full',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // no tagging
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, 0);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 0);
        // assets are to be deleted
        expect(s3Client).toHaveReceivedCommandWith(client_s3_1.DeleteObjectsCommand, {
            Bucket: 'BUCKET_NAME',
            Delete: {
                Objects: [
                    // no 'asset1'
                    { Key: 'asset2' },
                    { Key: 'asset3' },
                ],
                Quiet: true,
            },
        });
    });
});
function prepareDefaultCfnMock() {
    const client = cfnClient;
    client.reset();
    client.on(client_cloudformation_1.ListStacksCommand).resolves({
        StackSummaries: [
            { StackName: 'Stack1', StackStatus: 'CREATE_COMPLETE', CreationTime: new Date() },
            { StackName: 'Stack2', StackStatus: 'UPDATE_COMPLETE', CreationTime: new Date() },
        ],
    });
    client.on(client_cloudformation_1.GetTemplateSummaryCommand).resolves({
        Parameters: [{
                ParameterKey: 'BootstrapVersion',
                DefaultValue: '/cdk-bootstrap/abcde/version',
            }],
    });
    client.on(client_cloudformation_1.GetTemplateCommand).resolves({
        TemplateBody: 'abcde',
    });
    return client;
}
function prepareDefaultS3Mock() {
    const client = s3Client;
    client.reset();
    client.on(client_s3_1.ListObjectsV2Command).resolves({
        Contents: [
            { Key: 'asset1', LastModified: new Date(Date.now() - (2 * DAY)) },
            { Key: 'asset2', LastModified: new Date(Date.now() - (10 * DAY)) },
            { Key: 'asset3', LastModified: new Date(Date.now() - (100 * DAY)) },
        ],
        KeyCount: 3,
    });
    client.on(client_s3_1.GetObjectTaggingCommand).callsFake((params) => ({
        TagSet: params.Key === 'asset2' ? [{ Key: api_1.S3_ISOLATED_TAG, Value: new Date().toISOString() }] : [],
    }));
    return client;
}
function prepareDefaultEcrMock() {
    const client = ecrClient;
    client.reset();
    client.on(client_ecr_1.BatchGetImageCommand).resolves({
        images: [
            { imageId: { imageDigest: 'digest1' } },
            { imageId: { imageDigest: 'digest2' } },
            { imageId: { imageDigest: 'digest3' } },
        ],
    });
    client.on(client_ecr_1.DescribeImagesCommand).resolves({
        imageDetails: [
            { imageDigest: 'digest3', imageTags: ['klmno'], imagePushedAt: daysInThePast(2), imageSizeInBytes: 100 },
            { imageDigest: 'digest2', imageTags: ['fghij'], imagePushedAt: daysInThePast(10), imageSizeInBytes: 300000000 },
            {
                imageDigest: 'digest1',
                imageTags: ['abcde'],
                imagePushedAt: daysInThePast(100),
                imageSizeInBytes: 1000000000,
            },
        ],
    });
    client.on(client_ecr_1.ListImagesCommand).resolves({
        imageIds: [
            { imageDigest: 'digest1', imageTag: 'abcde' }, // inuse
            { imageDigest: 'digest2', imageTag: 'fghij' },
            { imageDigest: 'digest3', imageTag: 'klmno' },
        ],
    });
    return client;
}
describe('Garbage Collection with large # of objects', () => {
    const keyCount = 10000;
    test('tag only', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        mockClientsForLargeObjects();
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 1,
            action: 'tag',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // tagging is performed
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, keyCount);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.DeleteObjectTaggingCommand, 1000); // 1000 in use assets are erroneously tagged
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.PutObjectTaggingCommand, 5000); // 8000-4000 assets need to be tagged, + 1000 (since untag also calls this)
    });
    test('delete-tagged only', async () => {
        mockTheToolkitInfo({
            Outputs: [
                {
                    OutputKey: 'BootstrapVersion',
                    OutputValue: '999',
                },
            ],
        });
        mockClientsForLargeObjects();
        garbageCollector = gc({
            type: 's3',
            rollbackBufferDays: 1,
            action: 'delete-tagged',
        });
        await garbageCollector.garbageCollect();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.ListObjectsV2Command, 2);
        // delete previously tagged objects
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.GetObjectTaggingCommand, keyCount);
        expect(s3Client).toHaveReceivedCommandTimes(client_s3_1.DeleteObjectsCommand, 4); // 4000 isolated assets are already tagged, deleted in batches of 1000
    });
    function mockClientsForLargeObjects() {
        cfnClient.on(client_cloudformation_1.ListStacksCommand).resolves({
            StackSummaries: [
                { StackName: 'Stack1', StackStatus: 'CREATE_COMPLETE', CreationTime: new Date() },
            ],
        });
        cfnClient.on(client_cloudformation_1.GetTemplateSummaryCommand).resolves({
            Parameters: [{
                    ParameterKey: 'BootstrapVersion',
                    DefaultValue: '/cdk-bootstrap/abcde/version',
                }],
        });
        // add every 5th asset hash to the mock template body: 8000 assets are isolated
        const mockTemplateBody = [];
        for (let i = 0; i < keyCount; i += 5) {
            mockTemplateBody.push(`asset${i}hash`);
        }
        cfnClient.on(client_cloudformation_1.GetTemplateCommand).resolves({
            TemplateBody: mockTemplateBody.join('-'),
        });
        const contents = [];
        for (let i = 0; i < keyCount; i++) {
            contents.push({
                Key: `asset${i}hash`,
                LastModified: new Date(0),
            });
        }
        s3Client.on(client_s3_1.ListObjectsV2Command).resolves({
            Contents: contents,
            KeyCount: keyCount,
        });
        // every other object has the isolated tag: of the 8000 isolated assets, 4000 already are tagged.
        // of the 2000 in use assets, 1000 are tagged.
        s3Client.on(client_s3_1.GetObjectTaggingCommand).callsFake((params) => ({
            TagSet: Number(params.Key[params.Key.length - 5]) % 2 === 0
                ? [{ Key: api_1.S3_ISOLATED_TAG, Value: new Date(2000, 1, 1).toISOString() }]
                : [],
        }));
    }
});
describe('BackgroundStackRefresh', () => {
    let backgroundRefresh;
    let refreshProps;
    let setTimeoutSpy;
    beforeEach(() => {
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const foo = new mock_sdk_1.MockSdk();
        refreshProps = {
            cfn: foo.cloudFormation(),
            activeAssets: new stack_refresh_1.ActiveAssetCache(),
        };
        backgroundRefresh = new stack_refresh_1.BackgroundStackRefresh(refreshProps);
    });
    afterEach(() => {
        jest.clearAllTimers();
        setTimeoutSpy.mockRestore();
    });
    test('should start after a delay', () => {
        void backgroundRefresh.start();
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 300000);
    });
    test('should refresh stacks and schedule next refresh', async () => {
        void backgroundRefresh.start();
        // Run the first timer (which should trigger the first refresh)
        await jest.runOnlyPendingTimersAsync();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 1);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(2); // Once for start, once for next refresh
        expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 300000);
        // Run the first timer (which triggers the first refresh)
        await jest.runOnlyPendingTimersAsync();
        expect(cfnClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListStacksCommand, 2);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(3); // Two refreshes plus one more scheduled
    });
    test('should wait for the next refresh if called within time frame', async () => {
        void backgroundRefresh.start();
        // Run the first timer (which triggers the first refresh)
        await jest.runOnlyPendingTimersAsync();
        const waitPromise = backgroundRefresh.noOlderThan(180000); // 3 minutes
        jest.advanceTimersByTime(120000); // Advance time by 2 minutes
        await expect(waitPromise).resolves.toBeUndefined();
    });
    test('should wait for the next refresh if refresh lands before the timeout', async () => {
        void backgroundRefresh.start();
        // Run the first timer (which triggers the first refresh)
        await jest.runOnlyPendingTimersAsync();
        jest.advanceTimersByTime(24000); // Advance time by 4 minutes
        const waitPromise = backgroundRefresh.noOlderThan(300000); // 5 minutes
        jest.advanceTimersByTime(120000); // Advance time by 2 minutes, refresh should fire
        await expect(waitPromise).resolves.toBeUndefined();
    });
    test('should reject if the refresh takes too long', async () => {
        void backgroundRefresh.start();
        // Run the first timer (which triggers the first refresh)
        await jest.runOnlyPendingTimersAsync();
        jest.advanceTimersByTime(120000); // Advance time by 2 minutes
        const waitPromise = backgroundRefresh.noOlderThan(0); // 0 seconds
        jest.advanceTimersByTime(120000); // Advance time by 2 minutes
        await expect(waitPromise).rejects.toThrow('refreshStacks took too long; the background thread likely threw an error');
    });
});
function daysInThePast(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
}
function yearsInTheFuture(years) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FyYmFnZS1jb2xsZWN0aW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJnYXJiYWdlLWNvbGxlY3Rpb24udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUNBQWlDOztBQUVqQywwRUFLd0M7QUFDeEMsdUNBQWlHO0FBQ2pHLCtDQUF1STtBQUN2SSxrREFNNEI7QUFDNUIsa0ZBSXdEO0FBQ3hELG9EQU02QjtBQUU3QixJQUFJLGdCQUFrQyxDQUFDO0FBRXZDLElBQUksVUFBNEIsQ0FBQztBQUNqQyxNQUFNLFNBQVMsR0FBRyxtQ0FBd0IsQ0FBQztBQUMzQyxNQUFNLFFBQVEsR0FBRyx1QkFBWSxDQUFDO0FBQzlCLE1BQU0sU0FBUyxHQUFHLHdCQUFhLENBQUM7QUFFaEMsTUFBTSxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsa0NBQWtDO0FBRW5FLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxvREFBb0Q7SUFDcEQsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLGlCQUFXLENBQUMsMEJBQTBCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztJQUU1RyxrREFBa0Q7SUFDbEQsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7UUFDdkUsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDLENBQUMsQ0FBQztJQUVILHFCQUFxQixFQUFFLENBQUM7SUFDeEIsb0JBQW9CLEVBQUUsQ0FBQztJQUN2QixxQkFBcUIsRUFBRSxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxDQUFDLEdBQUcsRUFBRTtJQUNiLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUN6QixDQUFDLENBQUMsQ0FBQztBQUVILFNB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LE1BQU0sQ0FBQyxDQUFDLENBQUMsNEJBQTRCO1FBRTlELE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVk7UUFDbEUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsNEJBQTRCO1FBRTlELE1BQU0sTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsMEVBQTBFLENBQUMsQ0FBQztJQUN4SCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxhQUFhLENBQUMsSUFBWTtJQUNqQyxNQUFNLENBQUMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3JCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzlCLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsS0FBYTtJQUNyQyxNQUFNLENBQUMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3JCLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlIGltcG9ydC9vcmRlciAqL1xuXG5pbXBvcnQge1xuICBHZXRUZW1wbGF0ZUNvbW1hbmQsXG4gIEdldFRlbXBsYXRlU3VtbWFyeUNvbW1hbmQsXG4gIExpc3RTdGFja3NDb21tYW5kLFxuICBTdGFjayxcbn0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IEVDUl9JU09MQVRFRF9UQUcsIEdhcmJhZ2VDb2xsZWN0b3IsIFMzX0lTT0xBVEVEX1RBRywgVG9vbGtpdEluZm8gfSBmcm9tICcuLi8uLi9saWIvYXBpJztcbmltcG9ydCB7IG1vY2tCb290c3RyYXBTdGFjaywgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LCBtb2NrRUNSQ2xpZW50LCBtb2NrUzNDbGllbnQsIE1vY2tTZGssIE1vY2tTZGtQcm92aWRlciB9IGZyb20gJy4uL3V0aWwvbW9jay1zZGsnO1xuaW1wb3J0IHtcbiAgRGVsZXRlT2JqZWN0c0NvbW1hbmQsXG4gIERlbGV0ZU9iamVjdFRhZ2dpbmdDb21tYW5kLFxuICBHZXRPYmplY3RUYWdnaW5nQ29tbWFuZCxcbiAgTGlzdE9iamVjdHNWMkNvbW1hbmQsXG4gIFB1dE9iamVjdFRhZ2dpbmdDb21tYW5kLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtczMnO1xuaW1wb3J0IHtcbiAgQWN0aXZlQXNzZXRDYWNoZSxcbiAgQmFja2dyb3VuZFN0YWNrUmVmcmVzaCxcbiAgQmFja2dyb3VuZFN0YWNrUmVmcmVzaFByb3BzLFxufSBmcm9tICcuLi8uLi9saWIvYXBpL2dhcmJhZ2UtY29sbGVjdGlvbi9zdGFjay1yZWZyZXNoJztcbmltcG9ydCB7XG4gIEJhdGNoRGVsZXRlSW1hZ2VDb21tYW5kLFxuICBCYXRjaEdldEltYWdlQ29tbWFuZCxcbiAgRGVzY3JpYmVJbWFnZXNDb21tYW5kLFxuICBMaXN0SW1hZ2VzQ29tbWFuZCxcbiAgUHV0SW1hZ2VDb21tYW5kLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtZWNyJztcblxubGV0IGdhcmJhZ2VDb2xsZWN0b3I6IEdhcmJhZ2VDb2xsZWN0b3I7XG5cbmxldCBzdGRlcnJNb2NrOiBqZXN0LlNweUluc3RhbmNlO1xuY29uc3QgY2ZuQ2xpZW50ID0gbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50O1xuY29uc3QgczNDbGllbnQgPSBtb2NrUzNDbGllbnQ7XG5jb25zdCBlY3JDbGllbnQgPSBtb2NrRUNSQ2xpZW50O1xuXG5jb25zdCBEQVkgPSAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIGluIGEgZGF5XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICAvLyBCeSBkZWZhdWx0LCB3ZSdsbCByZXR1cm4gYSBub24tZm91bmQgdG9vbGtpdCBpbmZvXG4gIGplc3Quc3B5T24oVG9vbGtpdEluZm8sICdsb29rdXAnKS5tb2NrUmVzb2x2ZWRWYWx1ZShUb29sa2l0SW5mby5ib290c3RyYXBTdGFja05vdEZvdW5kSW5mbygnR2FyYmFnZVN0YWNrJykpO1xuXG4gIC8vIFN1cHByZXNzIHN0ZGVyciB0byBub3Qgc3BhbSBvdXRwdXQgZHVyaW5nIHRlc3RzXG4gIHN0ZGVyck1vY2sgPSBqZXN0LnNweU9uKHByb2Nlc3Muc3RkZXJyLCAnd3JpdGUnKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4ge1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcblxuICBwcmVwYXJlRGVmYXVsdENmbk1vY2soKTtcbiAgcHJlcGFyZURlZmF1bHRTM01vY2soKTtcbiAgcHJlcGFyZURlZmF1bHRFY3JNb2NrKCk7XG59KTtcblxuYWZ0ZXJFYWNoKCgpID0+IHtcbiAgc3RkZXJyTW9jay5tb2NrUmVzZXQoKTtcbn0pO1xuXG5mdW5jdGlvbiBtb2NrVGhlVG9vbGtpdEluZm8oc3RhY2tQcm9wczogUGFydGlhbDxTdGFjaz4pIHtcbiAgamVzdC5zcHlPbihUb29sa2l0SW5mbywgJ2xvb2t1cCcpLm1vY2tSZXNvbHZlZFZhbHVlKFRvb2xraXRJbmZvLmZyb21TdGFjayhtb2NrQm9vdHN0cmFwU3RhY2soc3RhY2tQcm9wcykpKTtcbn1cblxuZnVuY3Rpb24gZ2MocHJvcHM6IHtcbiAgdHlwZTogJ3MzJyB8ICdlY3InIHwgJ2FsbCc7XG4gIHJvbGxiYWNrQnVmZmVyRGF5cz86IG51bWJlcjtcbiAgY3JlYXRlZEF0QnVmZmVyRGF5cz86IG51bWJlcjtcbiAgYWN0aW9uOiAnZnVsbCcgfCAncHJpbnQnIHwgJ3RhZycgfCAnZGVsZXRlLXRhZ2dlZCc7XG59KTogR2FyYmFnZUNvbGxlY3RvciB7XG4gIHJldHVybiBuZXcgR2FyYmFnZUNvbGxlY3Rvcih7XG4gICAgc2RrUHJvdmlkZXI6IG5ldyBNb2NrU2RrUHJvdmlkZXIoKSxcbiAgICBhY3Rpb246IHByb3BzLmFjdGlvbixcbiAgICByZXNvbHZlZEVudmlyb25tZW50OiB7XG4gICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBuYW1lOiAnbW9jaycsXG4gICAgfSxcbiAgICBib290c3RyYXBTdGFja05hbWU6ICdHYXJiYWdlU3RhY2snLFxuICAgIHJvbGxiYWNrQnVmZmVyRGF5czogcHJvcHMucm9sbGJhY2tCdWZmZXJEYXlzID8/IDAsXG4gICAgY3JlYXRlZEJ1ZmZlckRheXM6IHByb3BzLmNyZWF0ZWRBdEJ1ZmZlckRheXMgPz8gMCxcbiAgICB0eXBlOiBwcm9wcy50eXBlLFxuICAgIGNvbmZpcm06IGZhbHNlLFxuICB9KTtcbn1cblxuZGVzY3JpYmUoJ1MzIEdhcmJhZ2UgQ29sbGVjdGlvbicsICgpID0+IHtcbiAgdGVzdCgncm9sbGJhY2tCdWZmZXJEYXlzID0gMCAtLSBhc3NldHMgdG8gYmUgZGVsZXRlZCcsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAwLFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdE9iamVjdHNWMkNvbW1hbmQsIDIpO1xuXG4gICAgLy8gbm8gdGFnZ2luZ1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoR2V0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDApO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDApO1xuXG4gICAgLy8gYXNzZXRzIGFyZSB0byBiZSBkZWxldGVkXG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlbGV0ZU9iamVjdHNDb21tYW5kLCB7XG4gICAgICBCdWNrZXQ6ICdCVUNLRVRfTkFNRScsXG4gICAgICBEZWxldGU6IHtcbiAgICAgICAgT2JqZWN0czogW1xuICAgICAgICAgIHsgS2V5OiAnYXNzZXQxJyB9LFxuICAgICAgICAgIHsgS2V5OiAnYXNzZXQyJyB9LFxuICAgICAgICAgIHsgS2V5OiAnYXNzZXQzJyB9LFxuICAgICAgICBdLFxuICAgICAgICBRdWlldDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3JvbGxiYWNrQnVmZmVyRGF5cyA+IDAgLS0gYXNzZXRzIHRvIGJlIHRhZ2dlZCcsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdE9iamVjdHNWMkNvbW1hbmQsIDIpO1xuXG4gICAgLy8gYXNzZXRzIHRhZ2dlZFxuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoR2V0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDMpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDIpO1xuXG4gICAgLy8gbm8gZGVsZXRpbmdcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKERlbGV0ZU9iamVjdHNDb21tYW5kLCAwKTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlZEF0QnVmZmVyRGF5cyA+IDAnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ3MzJyxcbiAgICAgIHJvbGxiYWNrQnVmZmVyRGF5czogMCxcbiAgICAgIGNyZWF0ZWRBdEJ1ZmZlckRheXM6IDUsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVsZXRlT2JqZWN0c0NvbW1hbmQsIHtcbiAgICAgIEJ1Y2tldDogJ0JVQ0tFVF9OQU1FJyxcbiAgICAgIERlbGV0ZToge1xuICAgICAgICBPYmplY3RzOiBbXG4gICAgICAgICAgLy8gYXNzZXQxIG5vdCBkZWxldGVkIGJlY2F1c2UgaXQgaXMgdG9vIHlvdW5nXG4gICAgICAgICAgeyBLZXk6ICdhc3NldDInIH0sXG4gICAgICAgICAgeyBLZXk6ICdhc3NldDMnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIFF1aWV0OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnYWN0aW9uID0gcHJpbnQgLS0gZG9lcyBub3QgdGFnIG9yIGRlbGV0ZScsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAncHJpbnQnLFxuICAgIH0pO1xuICAgIGF3YWl0IGdhcmJhZ2VDb2xsZWN0b3IuZ2FyYmFnZUNvbGxlY3QoKTtcblxuICAgIGV4cGVjdChjZm5DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RTdGFja3NDb21tYW5kLCAxKTtcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RPYmplY3RzVjJDb21tYW5kLCAyKTtcblxuICAgIC8vIGdldCB0YWdzLCBidXQgZG9udCBwdXQgdGFnc1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoR2V0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDMpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDApO1xuXG4gICAgLy8gbm8gZGVsZXRpbmdcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKERlbGV0ZU9iamVjdHNDb21tYW5kLCAwKTtcbiAgfSk7XG5cbiAgdGVzdCgnYWN0aW9uID0gdGFnIC0tIGRvZXMgbm90IGRlbGV0ZScsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAndGFnJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICBleHBlY3QoY2ZuQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0U3RhY2tzQ29tbWFuZCwgMSk7XG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0T2JqZWN0c1YyQ29tbWFuZCwgMik7XG5cbiAgICAvLyB0YWdzIG9iamVjdHNcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKEdldE9iamVjdFRhZ2dpbmdDb21tYW5kLCAzKTtcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKFB1dE9iamVjdFRhZ2dpbmdDb21tYW5kLCAyKTsgLy8gb25lIG9iamVjdCBhbHJlYWR5IGhhcyB0aGUgdGFnXG5cbiAgICAvLyBubyBkZWxldGluZ1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoRGVsZXRlT2JqZWN0c0NvbW1hbmQsIDApO1xuICB9KTtcblxuICB0ZXN0KCdhY3Rpb24gPSBkZWxldGUtdGFnZ2VkIC0tIGRvZXMgbm90IHRhZycsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAnZGVsZXRlLXRhZ2dlZCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdE9iamVjdHNWMkNvbW1hbmQsIDIpO1xuXG4gICAgLy8gZ2V0IHRhZ3MsIGJ1dCBkb250IHB1dCB0YWdzXG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhHZXRPYmplY3RUYWdnaW5nQ29tbWFuZCwgMyk7XG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhQdXRPYmplY3RUYWdnaW5nQ29tbWFuZCwgMCk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lnbm9yZSBvYmplY3RzIHRoYXQgYXJlIG1vZGlmaWVkIGFmdGVyIGdjIHN0YXJ0JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgczNDbGllbnQub24oTGlzdE9iamVjdHNWMkNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIENvbnRlbnRzOiBbXG4gICAgICAgIHsgS2V5OiAnYXNzZXQxJywgTGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgwKSB9LFxuICAgICAgICB7IEtleTogJ2Fzc2V0MicsIExhc3RNb2RpZmllZDogbmV3IERhdGUoMCkgfSxcbiAgICAgICAgeyBLZXk6ICdhc3NldDMnLCBMYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKG5ldyBEYXRlKCkuc2V0RnVsbFllYXIobmV3IERhdGUoKS5nZXRGdWxsWWVhcigpICsgMSkpIH0sIC8vIGZ1dHVyZSBkYXRlIGlnbm9yZWQgZXZlcnl3aGVyZVxuICAgICAgXSxcbiAgICAgIEtleUNvdW50OiAzLFxuICAgIH0pO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdzMycsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICAvLyBhc3NldHMgYXJlIHRvIGJlIGRlbGV0ZWRcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVsZXRlT2JqZWN0c0NvbW1hbmQsIHtcbiAgICAgIEJ1Y2tldDogJ0JVQ0tFVF9OQU1FJyxcbiAgICAgIERlbGV0ZToge1xuICAgICAgICBPYmplY3RzOiBbXG4gICAgICAgICAgeyBLZXk6ICdhc3NldDEnIH0sXG4gICAgICAgICAgeyBLZXk6ICdhc3NldDInIH0sXG4gICAgICAgICAgLy8gbm8gYXNzZXQzXG4gICAgICAgIF0sXG4gICAgICAgIFF1aWV0OiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ0VDUiBHYXJiYWdlIENvbGxlY3Rpb24nLCAoKSA9PiB7XG4gIHRlc3QoJ3JvbGxiYWNrQnVmZmVyRGF5cyA9IDAgLS0gYXNzZXRzIHRvIGJlIGRlbGV0ZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ2VjcicsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhEZXNjcmliZUltYWdlc0NvbW1hbmQsIDEpO1xuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RJbWFnZXNDb21tYW5kLCAyKTtcblxuICAgIC8vIG5vIHRhZ2dpbmdcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhQdXRJbWFnZUNvbW1hbmQsIDApO1xuXG4gICAgLy8gYXNzZXRzIGFyZSB0byBiZSBkZWxldGVkXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChCYXRjaERlbGV0ZUltYWdlQ29tbWFuZCwge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6ICdSRVBPX05BTUUnLFxuICAgICAgaW1hZ2VJZHM6IFtcbiAgICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnIH0sXG4gICAgICAgIHsgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QyJyB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgncm9sbGJhY2tCdWZmZXJEYXlzID4gMCAtLSBhc3NldHMgdG8gYmUgdGFnZ2VkJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdlY3InLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgLy8gYXNzZXRzIHRhZ2dlZFxuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKFB1dEltYWdlQ29tbWFuZCwgMik7XG5cbiAgICAvLyBubyBkZWxldGluZ1xuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKEJhdGNoRGVsZXRlSW1hZ2VDb21tYW5kLCAwKTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlZEF0QnVmZmVyRGF5cyA+IDAnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ2VjcicsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBjcmVhdGVkQXRCdWZmZXJEYXlzOiA1LFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChCYXRjaERlbGV0ZUltYWdlQ29tbWFuZCwge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6ICdSRVBPX05BTUUnLFxuICAgICAgaW1hZ2VJZHM6IFtcbiAgICAgICAgLy8gZGlnZXN0MyBpcyB0b28geW91bmcgdG8gYmUgZGVsZXRlZFxuICAgICAgICB7IGltYWdlRGlnZXN0OiAnZGlnZXN0MicgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2FjdGlvbiA9IHByaW50IC0tIGRvZXMgbm90IHRhZyBvciBkZWxldGUnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ2VjcicsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDMsXG4gICAgICBhY3Rpb246ICdwcmludCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuXG4gICAgLy8gZG9udCBwdXQgdGFnc1xuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKFB1dEltYWdlQ29tbWFuZCwgMCk7XG5cbiAgICAvLyBubyBkZWxldGluZ1xuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKEJhdGNoRGVsZXRlSW1hZ2VDb21tYW5kLCAwKTtcbiAgfSk7XG5cbiAgdGVzdCgnYWN0aW9uID0gdGFnIC0tIGRvZXMgbm90IGRlbGV0ZScsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnZWNyJyxcbiAgICAgIHJvbGxiYWNrQnVmZmVyRGF5czogMyxcbiAgICAgIGFjdGlvbjogJ3RhZycsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuXG4gICAgLy8gdGFncyBvYmplY3RzXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0SW1hZ2VDb21tYW5kLCAyKTtcblxuICAgIC8vIG5vIGRlbGV0aW5nXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoQmF0Y2hEZWxldGVJbWFnZUNvbW1hbmQsIDApO1xuICB9KTtcblxuICB0ZXN0KCdhY3Rpb24gPSBkZWxldGUtdGFnZ2VkIC0tIGRvZXMgbm90IHRhZycsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnZWNyJyxcbiAgICAgIHJvbGxiYWNrQnVmZmVyRGF5czogMyxcbiAgICAgIGFjdGlvbjogJ2RlbGV0ZS10YWdnZWQnLFxuICAgIH0pO1xuICAgIGF3YWl0IGdhcmJhZ2VDb2xsZWN0b3IuZ2FyYmFnZUNvbGxlY3QoKTtcblxuICAgIGV4cGVjdChjZm5DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RTdGFja3NDb21tYW5kLCAxKTtcblxuICAgIC8vIGRvbnQgcHV0IHRhZ3NcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhQdXRJbWFnZUNvbW1hbmQsIDApO1xuICB9KTtcblxuICB0ZXN0KCdpZ25vcmUgaW1hZ2VzIHRoYXQgYXJlIG1vZGlmaWVkIGFmdGVyIGdjIHN0YXJ0JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgcHJlcGFyZURlZmF1bHRFY3JNb2NrKCk7XG4gICAgZWNyQ2xpZW50Lm9uKERlc2NyaWJlSW1hZ2VzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgaW1hZ2VEZXRhaWxzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnLFxuICAgICAgICAgIGltYWdlVGFnczogWydrbG1ubyddLFxuICAgICAgICAgIGltYWdlUHVzaGVkQXQ6IGRheXNJblRoZVBhc3QoMiksXG4gICAgICAgICAgaW1hZ2VTaXplSW5CeXRlczogMTAwLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QyJyxcbiAgICAgICAgICBpbWFnZVRhZ3M6IFsnZmdoaWonXSxcbiAgICAgICAgICBpbWFnZVB1c2hlZEF0OiB5ZWFyc0luVGhlRnV0dXJlKDEpLFxuICAgICAgICAgIGltYWdlU2l6ZUluQnl0ZXM6IDMwMF8wMDBfMDAwLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QxJyxcbiAgICAgICAgICBpbWFnZVRhZ3M6IFsnYWJjZGUnXSxcbiAgICAgICAgICBpbWFnZVB1c2hlZEF0OiBkYXlzSW5UaGVQYXN0KDEwMCksXG4gICAgICAgICAgaW1hZ2VTaXplSW5CeXRlczogMV8wMDBfMDAwXzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgcHJlcGFyZURlZmF1bHRDZm5Nb2NrKCk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ2VjcicsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICAvLyBhc3NldHMgYXJlIHRvIGJlIGRlbGV0ZWRcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKEJhdGNoRGVsZXRlSW1hZ2VDb21tYW5kLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogJ1JFUE9fTkFNRScsXG4gICAgICBpbWFnZUlkczogW1xuICAgICAgICB7IGltYWdlRGlnZXN0OiAnZGlnZXN0MycgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3N1Y2NlZWRzIHdoZW4gbm8gaW1hZ2VzIGFyZSBwcmVzZW50JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgcHJlcGFyZURlZmF1bHRFY3JNb2NrKCk7XG4gICAgZWNyQ2xpZW50Lm9uKExpc3RJbWFnZXNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBpbWFnZUlkczogW10sXG4gICAgfSk7XG5cbiAgICBnYXJiYWdlQ29sbGVjdG9yID0gZ2Moe1xuICAgICAgdHlwZTogJ2VjcicsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcblxuICAgIC8vIHN1Y2NlZWRzIHdpdGhvdXQgaGFuZ2luZ1xuICAgIGF3YWl0IGdhcmJhZ2VDb2xsZWN0b3IuZ2FyYmFnZUNvbGxlY3QoKTtcbiAgfSk7XG5cbiAgdGVzdCgndGFncyBhcmUgdW5pcXVlJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdlY3InLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAndGFnJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICBleHBlY3QoY2ZuQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0U3RhY2tzQ29tbWFuZCwgMSk7XG5cbiAgICAvLyB0YWdzIG9iamVjdHNcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhQdXRJbWFnZUNvbW1hbmQsIDIpO1xuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoUHV0SW1hZ2VDb21tYW5kLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogJ1JFUE9fTkFNRScsXG4gICAgICBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnLFxuICAgICAgaW1hZ2VNYW5pZmVzdDogZXhwZWN0LmFueShTdHJpbmcpLFxuICAgICAgaW1hZ2VUYWc6IGV4cGVjdC5zdHJpbmdDb250YWluaW5nKGAwLSR7RUNSX0lTT0xBVEVEX1RBR31gKSxcbiAgICB9KTtcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKFB1dEltYWdlQ29tbWFuZCwge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6ICdSRVBPX05BTUUnLFxuICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QyJyxcbiAgICAgIGltYWdlTWFuaWZlc3Q6IGV4cGVjdC5hbnkoU3RyaW5nKSxcbiAgICAgIGltYWdlVGFnOiBleHBlY3Quc3RyaW5nQ29udGFpbmluZyhgMS0ke0VDUl9JU09MQVRFRF9UQUd9YCksXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xpc3RJbWFnZXNDb21tYW5kIHJldHVybnMgbmV4dFRva2VuJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIFRoaXMgdGVzdCBpcyB0byBlbnN1cmUgdGhhdCB0aGUgZ2FyYmFnZSBjb2xsZWN0b3IgY2FuIGhhbmRsZSBwYWdpbmF0ZWQgcmVzcG9uc2VzIGZyb20gdGhlIEVDUiBBUElcbiAgICAvLyBJZiBub3QgaGFuZGxlZCBjb3JyZWN0bHksIHRoZSBnYXJiYWdlIGNvbGxlY3RvciB3aWxsIGNvbnRpbnVlIHRvIG1ha2UgcmVxdWVzdHMgdG8gdGhlIEVDUiBBUElcbiAgICBtb2NrVGhlVG9vbGtpdEluZm8oe1xuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHByZXBhcmVEZWZhdWx0RWNyTW9jaygpO1xuICAgIGVjckNsaWVudC5vbihMaXN0SW1hZ2VzQ29tbWFuZCkucmVzb2x2ZXMoeyAvLyBkZWZhdWx0IHJlc3BvbnNlXG4gICAgICBpbWFnZUlkczogW1xuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QxJyxcbiAgICAgICAgICBpbWFnZVRhZzogJ2FiY2RlJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGltYWdlRGlnZXN0OiAnZGlnZXN0MicsXG4gICAgICAgICAgaW1hZ2VUYWc6ICdmZ2hpaicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgbmV4dFRva2VuOiAnbmV4dFRva2VuJyxcbiAgICB9KS5vbihMaXN0SW1hZ2VzQ29tbWFuZCwgeyAvLyByZXNwb25zZSB3aGVuIG5leHRUb2tlbiBpcyBwcm92aWRlZFxuICAgICAgcmVwb3NpdG9yeU5hbWU6ICdSRVBPX05BTUUnLFxuICAgICAgbmV4dFRva2VuOiAnbmV4dFRva2VuJyxcbiAgICB9KS5yZXNvbHZlcyh7XG4gICAgICBpbWFnZUlkczogW1xuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QzJyxcbiAgICAgICAgICBpbWFnZVRhZzogJ2tsbW5vJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZWNyQ2xpZW50Lm9uKEJhdGNoR2V0SW1hZ2VDb21tYW5kKS5yZXNvbHZlc09uY2Uoe1xuICAgICAgaW1hZ2VzOiBbXG4gICAgICAgIHsgaW1hZ2VJZDogeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDEnIH0gfSxcbiAgICAgICAgeyBpbWFnZUlkOiB7IGltYWdlRGlnZXN0OiAnZGlnZXN0MicgfSB9LFxuICAgICAgXSxcbiAgICB9KS5yZXNvbHZlc09uY2Uoe1xuICAgICAgaW1hZ2VzOiBbXG4gICAgICAgIHsgaW1hZ2VJZDogeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnIH0gfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgZWNyQ2xpZW50Lm9uKERlc2NyaWJlSW1hZ2VzQ29tbWFuZCkucmVzb2x2ZXNPbmNlKHtcbiAgICAgIGltYWdlRGV0YWlsczogW1xuICAgICAgICB7XG4gICAgICAgICAgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QxJyxcbiAgICAgICAgICBpbWFnZVRhZ3M6IFsnYWJjZGUnXSxcbiAgICAgICAgICBpbWFnZVB1c2hlZEF0OiBkYXlzSW5UaGVQYXN0KDEwMCksXG4gICAgICAgICAgaW1hZ2VTaXplSW5CeXRlczogMV8wMDBfMDAwXzAwMCxcbiAgICAgICAgfSxcbiAgICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDInLCBpbWFnZVRhZ3M6IFsnZmdoaWonXSwgaW1hZ2VQdXNoZWRBdDogZGF5c0luVGhlUGFzdCgxMCksIGltYWdlU2l6ZUluQnl0ZXM6IDMwMF8wMDBfMDAwIH0sXG4gICAgICBdLFxuICAgIH0pLnJlc29sdmVzT25jZSh7XG4gICAgICBpbWFnZURldGFpbHM6IFtcbiAgICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnLCBpbWFnZVRhZ3M6IFsna2xtbm8nXSwgaW1hZ2VQdXNoZWRBdDogZGF5c0luVGhlUGFzdCgyKSwgaW1hZ2VTaXplSW5CeXRlczogMTAwIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHByZXBhcmVEZWZhdWx0Q2ZuTW9jaygpO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdlY3InLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAwLFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoRGVzY3JpYmVJbWFnZXNDb21tYW5kLCAyKTtcbiAgICBleHBlY3QoZWNyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0SW1hZ2VzQ29tbWFuZCwgNCk7XG5cbiAgICAvLyBubyB0YWdnaW5nXG4gICAgZXhwZWN0KGVjckNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0SW1hZ2VDb21tYW5kLCAwKTtcblxuICAgIGV4cGVjdChlY3JDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoQmF0Y2hEZWxldGVJbWFnZUNvbW1hbmQsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiAnUkVQT19OQU1FJyxcbiAgICAgIGltYWdlSWRzOiBbXG4gICAgICAgIHsgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QyJyB9LFxuICAgICAgICB7IGltYWdlRGlnZXN0OiAnZGlnZXN0MycgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdDbG91ZEZvcm1hdGlvbiBBUEkgY2FsbHMnLCAoKSA9PiB7XG4gIHRlc3QoJ2Jvb3RzdHJhcCBmaWx0ZXJzIG91dCBvdGhlciBib290c3RyYXAgdmVyc2lvbnMnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIFBhcmFtZXRlcnM6IFt7XG4gICAgICAgIFBhcmFtZXRlcktleTogJ1F1YWxpZmllcicsXG4gICAgICAgIFBhcmFtZXRlclZhbHVlOiAnenp6enp6JyxcbiAgICAgIH1dLFxuICAgICAgT3V0cHV0czogW1xuICAgICAgICB7XG4gICAgICAgICAgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsXG4gICAgICAgICAgT3V0cHV0VmFsdWU6ICc5OTknLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAzLFxuICAgICAgYWN0aW9uOiAnZnVsbCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoR2V0VGVtcGxhdGVTdW1tYXJ5Q29tbWFuZCwgMik7XG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoR2V0VGVtcGxhdGVDb21tYW5kLCAwKTtcbiAgfSk7XG5cbiAgdGVzdCgncGFyYW1ldGVyIGhhc2hlcyBhcmUgaW5jbHVkZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjZm5DbGllbnQub24oR2V0VGVtcGxhdGVTdW1tYXJ5Q29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgUGFyYW1ldGVyczogW3tcbiAgICAgICAgUGFyYW1ldGVyS2V5OiAnQXNzZXRQYXJhbWV0ZXJzYXNzZXQxJyxcbiAgICAgICAgRGVmYXVsdFZhbHVlOiAnYXNzZXQxJyxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdzMycsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDAsXG4gICAgICBhY3Rpb246ICdmdWxsJyxcbiAgICB9KTtcbiAgICBhd2FpdCBnYXJiYWdlQ29sbGVjdG9yLmdhcmJhZ2VDb2xsZWN0KCk7XG5cbiAgICBleHBlY3QoY2ZuQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0U3RhY2tzQ29tbWFuZCwgMSk7XG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0T2JqZWN0c1YyQ29tbWFuZCwgMik7XG5cbiAgICAvLyBubyB0YWdnaW5nXG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhHZXRPYmplY3RUYWdnaW5nQ29tbWFuZCwgMCk7XG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhQdXRPYmplY3RUYWdnaW5nQ29tbWFuZCwgMCk7XG5cbiAgICAvLyBhc3NldHMgYXJlIHRvIGJlIGRlbGV0ZWRcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVsZXRlT2JqZWN0c0NvbW1hbmQsIHtcbiAgICAgIEJ1Y2tldDogJ0JVQ0tFVF9OQU1FJyxcbiAgICAgIERlbGV0ZToge1xuICAgICAgICBPYmplY3RzOiBbXG4gICAgICAgICAgLy8gbm8gJ2Fzc2V0MSdcbiAgICAgICAgICB7IEtleTogJ2Fzc2V0MicgfSxcbiAgICAgICAgICB7IEtleTogJ2Fzc2V0MycgfSxcbiAgICAgICAgXSxcbiAgICAgICAgUXVpZXQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5mdW5jdGlvbiBwcmVwYXJlRGVmYXVsdENmbk1vY2soKSB7XG4gIGNvbnN0IGNsaWVudCA9IGNmbkNsaWVudDtcbiAgY2xpZW50LnJlc2V0KCk7XG5cbiAgY2xpZW50Lm9uKExpc3RTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3RhY2tTdW1tYXJpZXM6IFtcbiAgICAgIHsgU3RhY2tOYW1lOiAnU3RhY2sxJywgU3RhY2tTdGF0dXM6ICdDUkVBVEVfQ09NUExFVEUnLCBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCkgfSxcbiAgICAgIHsgU3RhY2tOYW1lOiAnU3RhY2syJywgU3RhY2tTdGF0dXM6ICdVUERBVEVfQ09NUExFVEUnLCBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCkgfSxcbiAgICBdLFxuICB9KTtcblxuICBjbGllbnQub24oR2V0VGVtcGxhdGVTdW1tYXJ5Q29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFBhcmFtZXRlcnM6IFt7XG4gICAgICBQYXJhbWV0ZXJLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgIERlZmF1bHRWYWx1ZTogJy9jZGstYm9vdHN0cmFwL2FiY2RlL3ZlcnNpb24nLFxuICAgIH1dLFxuICB9KTtcblxuICBjbGllbnQub24oR2V0VGVtcGxhdGVDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgVGVtcGxhdGVCb2R5OiAnYWJjZGUnLFxuICB9KTtcblxuICByZXR1cm4gY2xpZW50O1xufVxuXG5mdW5jdGlvbiBwcmVwYXJlRGVmYXVsdFMzTW9jaygpIHtcbiAgY29uc3QgY2xpZW50ID0gczNDbGllbnQ7XG4gIGNsaWVudC5yZXNldCgpO1xuXG4gIGNsaWVudC5vbihMaXN0T2JqZWN0c1YyQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIENvbnRlbnRzOiBbXG4gICAgICB7IEtleTogJ2Fzc2V0MScsIExhc3RNb2RpZmllZDogbmV3IERhdGUoRGF0ZS5ub3coKSAtICgyICogREFZKSkgfSxcbiAgICAgIHsgS2V5OiAnYXNzZXQyJywgTGFzdE1vZGlmaWVkOiBuZXcgRGF0ZShEYXRlLm5vdygpIC0gKDEwICogREFZKSkgfSxcbiAgICAgIHsgS2V5OiAnYXNzZXQzJywgTGFzdE1vZGlmaWVkOiBuZXcgRGF0ZShEYXRlLm5vdygpIC0gKDEwMCAqIERBWSkpIH0sXG4gICAgXSxcbiAgICBLZXlDb3VudDogMyxcbiAgfSk7XG5cbiAgY2xpZW50Lm9uKEdldE9iamVjdFRhZ2dpbmdDb21tYW5kKS5jYWxsc0Zha2UoKHBhcmFtcykgPT4gKHtcbiAgICBUYWdTZXQ6IHBhcmFtcy5LZXkgPT09ICdhc3NldDInID8gW3sgS2V5OiBTM19JU09MQVRFRF9UQUcsIFZhbHVlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfV0gOiBbXSxcbiAgfSkpO1xuXG4gIHJldHVybiBjbGllbnQ7XG59XG5cbmZ1bmN0aW9uIHByZXBhcmVEZWZhdWx0RWNyTW9jaygpIHtcbiAgY29uc3QgY2xpZW50ID0gZWNyQ2xpZW50O1xuICBjbGllbnQucmVzZXQoKTtcblxuICBjbGllbnQub24oQmF0Y2hHZXRJbWFnZUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBpbWFnZXM6IFtcbiAgICAgIHsgaW1hZ2VJZDogeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDEnIH0gfSxcbiAgICAgIHsgaW1hZ2VJZDogeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDInIH0gfSxcbiAgICAgIHsgaW1hZ2VJZDogeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnIH0gfSxcbiAgICBdLFxuICB9KTtcblxuICBjbGllbnQub24oRGVzY3JpYmVJbWFnZXNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgaW1hZ2VEZXRhaWxzOiBbXG4gICAgICB7IGltYWdlRGlnZXN0OiAnZGlnZXN0MycsIGltYWdlVGFnczogWydrbG1ubyddLCBpbWFnZVB1c2hlZEF0OiBkYXlzSW5UaGVQYXN0KDIpLCBpbWFnZVNpemVJbkJ5dGVzOiAxMDAgfSxcbiAgICAgIHsgaW1hZ2VEaWdlc3Q6ICdkaWdlc3QyJywgaW1hZ2VUYWdzOiBbJ2ZnaGlqJ10sIGltYWdlUHVzaGVkQXQ6IGRheXNJblRoZVBhc3QoMTApLCBpbWFnZVNpemVJbkJ5dGVzOiAzMDBfMDAwXzAwMCB9LFxuICAgICAge1xuICAgICAgICBpbWFnZURpZ2VzdDogJ2RpZ2VzdDEnLFxuICAgICAgICBpbWFnZVRhZ3M6IFsnYWJjZGUnXSxcbiAgICAgICAgaW1hZ2VQdXNoZWRBdDogZGF5c0luVGhlUGFzdCgxMDApLFxuICAgICAgICBpbWFnZVNpemVJbkJ5dGVzOiAxXzAwMF8wMDBfMDAwLFxuICAgICAgfSxcbiAgICBdLFxuICB9KTtcblxuICBjbGllbnQub24oTGlzdEltYWdlc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBpbWFnZUlkczogW1xuICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDEnLCBpbWFnZVRhZzogJ2FiY2RlJyB9LCAvLyBpbnVzZVxuICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDInLCBpbWFnZVRhZzogJ2ZnaGlqJyB9LFxuICAgICAgeyBpbWFnZURpZ2VzdDogJ2RpZ2VzdDMnLCBpbWFnZVRhZzogJ2tsbW5vJyB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIHJldHVybiBjbGllbnQ7XG59XG5cbmRlc2NyaWJlKCdHYXJiYWdlIENvbGxlY3Rpb24gd2l0aCBsYXJnZSAjIG9mIG9iamVjdHMnLCAoKSA9PiB7XG4gIGNvbnN0IGtleUNvdW50ID0gMTAwMDA7XG5cbiAgdGVzdCgndGFnIG9ubHknLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja1RoZVRvb2xraXRJbmZvKHtcbiAgICAgIE91dHB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICAgIE91dHB1dFZhbHVlOiAnOTk5JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBtb2NrQ2xpZW50c0ZvckxhcmdlT2JqZWN0cygpO1xuXG4gICAgZ2FyYmFnZUNvbGxlY3RvciA9IGdjKHtcbiAgICAgIHR5cGU6ICdzMycsXG4gICAgICByb2xsYmFja0J1ZmZlckRheXM6IDEsXG4gICAgICBhY3Rpb246ICd0YWcnLFxuICAgIH0pO1xuICAgIGF3YWl0IGdhcmJhZ2VDb2xsZWN0b3IuZ2FyYmFnZUNvbGxlY3QoKTtcblxuICAgIGV4cGVjdChjZm5DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RTdGFja3NDb21tYW5kLCAxKTtcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RPYmplY3RzVjJDb21tYW5kLCAyKTtcblxuICAgIC8vIHRhZ2dpbmcgaXMgcGVyZm9ybWVkXG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhHZXRPYmplY3RUYWdnaW5nQ29tbWFuZCwga2V5Q291bnQpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoRGVsZXRlT2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDEwMDApOyAvLyAxMDAwIGluIHVzZSBhc3NldHMgYXJlIGVycm9uZW91c2x5IHRhZ2dlZFxuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoUHV0T2JqZWN0VGFnZ2luZ0NvbW1hbmQsIDUwMDApOyAvLyA4MDAwLTQwMDAgYXNzZXRzIG5lZWQgdG8gYmUgdGFnZ2VkLCArIDEwMDAgKHNpbmNlIHVudGFnIGFsc28gY2FsbHMgdGhpcylcbiAgfSk7XG5cbiAgdGVzdCgnZGVsZXRlLXRhZ2dlZCBvbmx5JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tUaGVUb29sa2l0SW5mbyh7XG4gICAgICBPdXRwdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJyxcbiAgICAgICAgICBPdXRwdXRWYWx1ZTogJzk5OScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgbW9ja0NsaWVudHNGb3JMYXJnZU9iamVjdHMoKTtcblxuICAgIGdhcmJhZ2VDb2xsZWN0b3IgPSBnYyh7XG4gICAgICB0eXBlOiAnczMnLFxuICAgICAgcm9sbGJhY2tCdWZmZXJEYXlzOiAxLFxuICAgICAgYWN0aW9uOiAnZGVsZXRlLXRhZ2dlZCcsXG4gICAgfSk7XG4gICAgYXdhaXQgZ2FyYmFnZUNvbGxlY3Rvci5nYXJiYWdlQ29sbGVjdCgpO1xuXG4gICAgZXhwZWN0KGNmbkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdFN0YWNrc0NvbW1hbmQsIDEpO1xuICAgIGV4cGVjdChzM0NsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kVGltZXMoTGlzdE9iamVjdHNWMkNvbW1hbmQsIDIpO1xuXG4gICAgLy8gZGVsZXRlIHByZXZpb3VzbHkgdGFnZ2VkIG9iamVjdHNcbiAgICBleHBlY3QoczNDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKEdldE9iamVjdFRhZ2dpbmdDb21tYW5kLCBrZXlDb3VudCk7XG4gICAgZXhwZWN0KHMzQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhEZWxldGVPYmplY3RzQ29tbWFuZCwgNCk7IC8vIDQwMDAgaXNvbGF0ZWQgYXNzZXRzIGFyZSBhbHJlYWR5IHRhZ2dlZCwgZGVsZXRlZCBpbiBiYXRjaGVzIG9mIDEwMDBcbiAgfSk7XG5cbiAgZnVuY3Rpb24gbW9ja0NsaWVudHNGb3JMYXJnZU9iamVjdHMoKSB7XG4gICAgY2ZuQ2xpZW50Lm9uKExpc3RTdGFja3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBTdGFja1N1bW1hcmllczogW1xuICAgICAgICB7IFN0YWNrTmFtZTogJ1N0YWNrMScsIFN0YWNrU3RhdHVzOiAnQ1JFQVRFX0NPTVBMRVRFJywgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY2ZuQ2xpZW50Lm9uKEdldFRlbXBsYXRlU3VtbWFyeUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFBhcmFtZXRlcnM6IFt7XG4gICAgICAgIFBhcmFtZXRlcktleTogJ0Jvb3RzdHJhcFZlcnNpb24nLFxuICAgICAgICBEZWZhdWx0VmFsdWU6ICcvY2RrLWJvb3RzdHJhcC9hYmNkZS92ZXJzaW9uJyxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gYWRkIGV2ZXJ5IDV0aCBhc3NldCBoYXNoIHRvIHRoZSBtb2NrIHRlbXBsYXRlIGJvZHk6IDgwMDAgYXNzZXRzIGFyZSBpc29sYXRlZFxuICAgIGNvbnN0IG1vY2tUZW1wbGF0ZUJvZHkgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleUNvdW50OyBpKz01KSB7XG4gICAgICBtb2NrVGVtcGxhdGVCb2R5LnB1c2goYGFzc2V0JHtpfWhhc2hgKTtcbiAgICB9XG4gICAgY2ZuQ2xpZW50Lm9uKEdldFRlbXBsYXRlQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgVGVtcGxhdGVCb2R5OiBtb2NrVGVtcGxhdGVCb2R5LmpvaW4oJy0nKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnRlbnRzOiB7IEtleTogc3RyaW5nOyBMYXN0TW9kaWZpZWQ6IERhdGUgfVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlDb3VudDsgaSsrKSB7XG4gICAgICBjb250ZW50cy5wdXNoKHtcbiAgICAgICAgS2V5OiBgYXNzZXQke2l9aGFzaGAsXG4gICAgICAgIExhc3RNb2RpZmllZDogbmV3IERhdGUoMCksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzM0NsaWVudC5vbihMaXN0T2JqZWN0c1YyQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgQ29udGVudHM6IGNvbnRlbnRzLFxuICAgICAgS2V5Q291bnQ6IGtleUNvdW50LFxuICAgIH0pO1xuXG4gICAgLy8gZXZlcnkgb3RoZXIgb2JqZWN0IGhhcyB0aGUgaXNvbGF0ZWQgdGFnOiBvZiB0aGUgODAwMCBpc29sYXRlZCBhc3NldHMsIDQwMDAgYWxyZWFkeSBhcmUgdGFnZ2VkLlxuICAgIC8vIG9mIHRoZSAyMDAwIGluIHVzZSBhc3NldHMsIDEwMDAgYXJlIHRhZ2dlZC5cbiAgICBzM0NsaWVudC5vbihHZXRPYmplY3RUYWdnaW5nQ29tbWFuZCkuY2FsbHNGYWtlKChwYXJhbXMpID0+ICh7XG4gICAgICBUYWdTZXQ6IE51bWJlcihwYXJhbXMuS2V5W3BhcmFtcy5LZXkubGVuZ3RoIC0gNV0pICUgMiA9PT0gMFxuICAgICAgICA/IFt7IEtleTogUzNfSVNPTEFURURfVEFHLCBWYWx1ZTogbmV3IERhdGUoMjAwMCwgMSwgMSkudG9JU09TdHJpbmcoKSB9XVxuICAgICAgICA6IFtdLFxuICAgIH0pKTtcbiAgfVxufSk7XG5cbmRlc2NyaWJlKCdCYWNrZ3JvdW5kU3RhY2tSZWZyZXNoJywgKCkgPT4ge1xuICBsZXQgYmFja2dyb3VuZFJlZnJlc2g6IEJhY2tncm91bmRTdGFja1JlZnJlc2g7XG4gIGxldCByZWZyZXNoUHJvcHM6IEJhY2tncm91bmRTdGFja1JlZnJlc2hQcm9wcztcbiAgbGV0IHNldFRpbWVvdXRTcHk6IGplc3QuU3B5SW5zdGFuY2U7XG5cbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgamVzdC51c2VGYWtlVGltZXJzKCk7XG4gICAgc2V0VGltZW91dFNweSA9IGplc3Quc3B5T24oZ2xvYmFsLCAnc2V0VGltZW91dCcpO1xuXG4gICAgY29uc3QgZm9vID0gbmV3IE1vY2tTZGsoKTtcblxuICAgIHJlZnJlc2hQcm9wcyA9IHtcbiAgICAgIGNmbjogZm9vLmNsb3VkRm9ybWF0aW9uKCksXG4gICAgICBhY3RpdmVBc3NldHM6IG5ldyBBY3RpdmVBc3NldENhY2hlKCksXG4gICAgfTtcblxuICAgIGJhY2tncm91bmRSZWZyZXNoID0gbmV3IEJhY2tncm91bmRTdGFja1JlZnJlc2gocmVmcmVzaFByb3BzKTtcbiAgfSk7XG5cbiAgYWZ0ZXJFYWNoKCgpID0+IHtcbiAgICBqZXN0LmNsZWFyQWxsVGltZXJzKCk7XG4gICAgc2V0VGltZW91dFNweS5tb2NrUmVzdG9yZSgpO1xuICB9KTtcblxuICB0ZXN0KCdzaG91bGQgc3RhcnQgYWZ0ZXIgYSBkZWxheScsICgpID0+IHtcbiAgICB2b2lkIGJhY2tncm91bmRSZWZyZXNoLnN0YXJ0KCk7XG4gICAgZXhwZWN0KHNldFRpbWVvdXRTcHkpLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygxKTtcbiAgICBleHBlY3Qoc2V0VGltZW91dFNweSkudG9IYXZlQmVlbkxhc3RDYWxsZWRXaXRoKGV4cGVjdC5hbnkoRnVuY3Rpb24pLCAzMDAwMDApO1xuICB9KTtcblxuICB0ZXN0KCdzaG91bGQgcmVmcmVzaCBzdGFja3MgYW5kIHNjaGVkdWxlIG5leHQgcmVmcmVzaCcsIGFzeW5jICgpID0+IHtcbiAgICB2b2lkIGJhY2tncm91bmRSZWZyZXNoLnN0YXJ0KCk7XG5cbiAgICAvLyBSdW4gdGhlIGZpcnN0IHRpbWVyICh3aGljaCBzaG91bGQgdHJpZ2dlciB0aGUgZmlyc3QgcmVmcmVzaClcbiAgICBhd2FpdCBqZXN0LnJ1bk9ubHlQZW5kaW5nVGltZXJzQXN5bmMoKTtcblxuICAgIGV4cGVjdChjZm5DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RTdGFja3NDb21tYW5kLCAxKTtcblxuICAgIGV4cGVjdChzZXRUaW1lb3V0U3B5KS50b0hhdmVCZWVuQ2FsbGVkVGltZXMoMik7IC8vIE9uY2UgZm9yIHN0YXJ0LCBvbmNlIGZvciBuZXh0IHJlZnJlc2hcbiAgICBleHBlY3Qoc2V0VGltZW91dFNweSkudG9IYXZlQmVlbkxhc3RDYWxsZWRXaXRoKGV4cGVjdC5hbnkoRnVuY3Rpb24pLCAzMDAwMDApO1xuXG4gICAgLy8gUnVuIHRoZSBmaXJzdCB0aW1lciAod2hpY2ggdHJpZ2dlcnMgdGhlIGZpcnN0IHJlZnJlc2gpXG4gICAgYXdhaXQgamVzdC5ydW5Pbmx5UGVuZGluZ1RpbWVyc0FzeW5jKCk7XG5cbiAgICBleHBlY3QoY2ZuQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0U3RhY2tzQ29tbWFuZCwgMik7XG4gICAgZXhwZWN0KHNldFRpbWVvdXRTcHkpLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygzKTsgLy8gVHdvIHJlZnJlc2hlcyBwbHVzIG9uZSBtb3JlIHNjaGVkdWxlZFxuICB9KTtcblxuICB0ZXN0KCdzaG91bGQgd2FpdCBmb3IgdGhlIG5leHQgcmVmcmVzaCBpZiBjYWxsZWQgd2l0aGluIHRpbWUgZnJhbWUnLCBhc3luYyAoKSA9PiB7XG4gICAgdm9pZCBiYWNrZ3JvdW5kUmVmcmVzaC5zdGFydCgpO1xuXG4gICAgLy8gUnVuIHRoZSBmaXJzdCB0aW1lciAod2hpY2ggdHJpZ2dlcnMgdGhlIGZpcnN0IHJlZnJlc2gpXG4gICAgYXdhaXQgamVzdC5ydW5Pbmx5UGVuZGluZ1RpbWVyc0FzeW5jKCk7XG5cbiAgICBjb25zdCB3YWl0UHJvbWlzZSA9IGJhY2tncm91bmRSZWZyZXNoLm5vT2xkZXJUaGFuKDE4MDAwMCk7IC8vIDMgbWludXRlc1xuICAgIGplc3QuYWR2YW5jZVRpbWVyc0J5VGltZSgxMjAwMDApOyAvLyBBZHZhbmNlIHRpbWUgYnkgMiBtaW51dGVzXG5cbiAgICBhd2FpdCBleHBlY3Qod2FpdFByb21pc2UpLnJlc29sdmVzLnRvQmVVbmRlZmluZWQoKTtcbiAgfSk7XG5cbiAgdGVzdCgnc2hvdWxkIHdhaXQgZm9yIHRoZSBuZXh0IHJlZnJlc2ggaWYgcmVmcmVzaCBsYW5kcyBiZWZvcmUgdGhlIHRpbWVvdXQnLCBhc3luYyAoKSA9PiB7XG4gICAgdm9pZCBiYWNrZ3JvdW5kUmVmcmVzaC5zdGFydCgpO1xuXG4gICAgLy8gUnVuIHRoZSBmaXJzdCB0aW1lciAod2hpY2ggdHJpZ2dlcnMgdGhlIGZpcnN0IHJlZnJlc2gpXG4gICAgYXdhaXQgamVzdC5ydW5Pbmx5UGVuZGluZ1RpbWVyc0FzeW5jKCk7XG4gICAgamVzdC5hZHZhbmNlVGltZXJzQnlUaW1lKDI0MDAwKTsgLy8gQWR2YW5jZSB0aW1lIGJ5IDQgbWludXRlc1xuXG4gICAgY29uc3Qgd2FpdFByb21pc2UgPSBiYWNrZ3JvdW5kUmVmcmVzaC5ub09sZGVyVGhhbigzMDAwMDApOyAvLyA1IG1pbnV0ZXNcbiAgICBqZXN0LmFkdmFuY2VUaW1lcnNCeVRpbWUoMTIwMDAwKTsgLy8gQWR2YW5jZSB0aW1lIGJ5IDIgbWludXRlcywgcmVmcmVzaCBzaG91bGQgZmlyZVxuXG4gICAgYXdhaXQgZXhwZWN0KHdhaXRQcm9taXNlKS5yZXNvbHZlcy50b0JlVW5kZWZpbmVkKCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Nob3VsZCByZWplY3QgaWYgdGhlIHJlZnJlc2ggdGFrZXMgdG9vIGxvbmcnLCBhc3luYyAoKSA9PiB7XG4gICAgdm9pZCBiYWNrZ3JvdW5kUmVmcmVzaC5zdGFydCgpO1xuXG4gICAgLy8gUnVuIHRoZSBmaXJzdCB0aW1lciAod2hpY2ggdHJpZ2dlcnMgdGhlIGZpcnN0IHJlZnJlc2gpXG4gICAgYXdhaXQgamVzdC5ydW5Pbmx5UGVuZGluZ1RpbWVyc0FzeW5jKCk7XG4gICAgamVzdC5hZHZhbmNlVGltZXJzQnlUaW1lKDEyMDAwMCk7IC8vIEFkdmFuY2UgdGltZSBieSAyIG1pbnV0ZXNcblxuICAgIGNvbnN0IHdhaXRQcm9taXNlID0gYmFja2dyb3VuZFJlZnJlc2gubm9PbGRlclRoYW4oMCk7IC8vIDAgc2Vjb25kc1xuICAgIGplc3QuYWR2YW5jZVRpbWVyc0J5VGltZSgxMjAwMDApOyAvLyBBZHZhbmNlIHRpbWUgYnkgMiBtaW51dGVzXG5cbiAgICBhd2FpdCBleHBlY3Qod2FpdFByb21pc2UpLnJlamVjdHMudG9UaHJvdygncmVmcmVzaFN0YWNrcyB0b29rIHRvbyBsb25nOyB0aGUgYmFja2dyb3VuZCB0aHJlYWQgbGlrZWx5IHRocmV3IGFuIGVycm9yJyk7XG4gIH0pO1xufSk7XG5cbmZ1bmN0aW9uIGRheXNJblRoZVBhc3QoZGF5czogbnVtYmVyKTogRGF0ZSB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZSgpO1xuICBkLnNldERhdGUoZC5nZXREYXRlKCkgLSBkYXlzKTtcbiAgcmV0dXJuIGQ7XG59XG5cbmZ1bmN0aW9uIHllYXJzSW5UaGVGdXR1cmUoeWVhcnM6IG51bWJlcik6IERhdGUge1xuICBjb25zdCBkID0gbmV3IERhdGUoKTtcbiAgZC5zZXRGdWxsWWVhcihkLmdldEZ1bGxZZWFyKCkgKyB5ZWFycyk7XG4gIHJldHVybiBkO1xufVxuIl19