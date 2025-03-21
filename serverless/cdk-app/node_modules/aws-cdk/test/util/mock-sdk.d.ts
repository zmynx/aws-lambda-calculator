import 'aws-sdk-client-mock-jest';
import { Environment } from '@aws-cdk/cx-api';
import { Stack } from '@aws-sdk/client-cloudformation';
import { AwsCredentialIdentity } from '@smithy/types';
import { Account } from 'cdk-assets';
import { SDK, SdkProvider } from '../../lib';
import { CloudFormationStack } from '../../lib/api/util/cloudformation';
export declare const FAKE_CREDENTIALS: AwsCredentialIdentity;
export declare const FAKE_CREDENTIAL_CHAIN: import("@smithy/types").AwsCredentialIdentityProvider & import("@aws-sdk/credential-providers").CustomCredentialChainOptions;
export declare const mockAppSyncClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-appsync").ServiceInputTypes, import("@aws-sdk/client-appsync").ServiceOutputTypes, import("@aws-sdk/client-appsync").AppSyncClientResolvedConfig>;
export declare const mockCloudFormationClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-cloudformation").ServiceInputTypes, import("@aws-sdk/client-cloudformation").ServiceOutputTypes, import("@aws-sdk/client-cloudformation").CloudFormationClientResolvedConfig>;
export declare const mockCloudWatchClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-cloudwatch-logs").ServiceInputTypes, import("@aws-sdk/client-cloudwatch-logs").ServiceOutputTypes, import("@aws-sdk/client-cloudwatch-logs").CloudWatchLogsClientResolvedConfig>;
export declare const mockCodeBuildClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-codebuild").ServiceInputTypes, import("@aws-sdk/client-codebuild").ServiceOutputTypes, import("@aws-sdk/client-codebuild").CodeBuildClientResolvedConfig>;
export declare const mockEC2Client: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-ec2").ServiceInputTypes, import("@aws-sdk/client-ec2").ServiceOutputTypes, import("@aws-sdk/client-ec2").EC2ClientResolvedConfig>;
export declare const mockECRClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-ecr").ServiceInputTypes, import("@aws-sdk/client-ecr").ServiceOutputTypes, import("@aws-sdk/client-ecr").ECRClientResolvedConfig>;
export declare const mockECSClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-ecs").ServiceInputTypes, import("@aws-sdk/client-ecs").ServiceOutputTypes, import("@aws-sdk/client-ecs").ECSClientResolvedConfig>;
export declare const mockElasticLoadBalancingV2Client: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-elastic-load-balancing-v2").ServiceInputTypes, import("@aws-sdk/client-elastic-load-balancing-v2").ServiceOutputTypes, import("@aws-sdk/client-elastic-load-balancing-v2").ElasticLoadBalancingV2ClientResolvedConfig>;
export declare const mockIAMClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-iam").ServiceInputTypes, import("@aws-sdk/client-iam").ServiceOutputTypes, import("@aws-sdk/client-iam").IAMClientResolvedConfig>;
export declare const mockKMSClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-kms").ServiceInputTypes, import("@aws-sdk/client-kms").ServiceOutputTypes, import("@aws-sdk/client-kms").KMSClientResolvedConfig>;
export declare const mockLambdaClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-lambda").ServiceInputTypes, import("@aws-sdk/client-lambda").ServiceOutputTypes, import("@aws-sdk/client-lambda").LambdaClientResolvedConfig>;
export declare const mockRoute53Client: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-route-53").ServiceInputTypes, import("@aws-sdk/client-route-53").ServiceOutputTypes, import("@aws-sdk/client-route-53").Route53ClientResolvedConfig>;
export declare const mockS3Client: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-s3").ServiceInputTypes, import("@aws-sdk/client-s3").ServiceOutputTypes, import("@aws-sdk/client-s3").S3ClientResolvedConfig>;
export declare const mockSecretsManagerClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-secrets-manager").ServiceInputTypes, import("@aws-sdk/client-secrets-manager").ServiceOutputTypes, import("@aws-sdk/client-secrets-manager").SecretsManagerClientResolvedConfig>;
export declare const mockSSMClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-ssm").ServiceInputTypes, import("@aws-sdk/client-ssm").ServiceOutputTypes, import("@aws-sdk/client-ssm").SSMClientResolvedConfig>;
export declare const mockStepFunctionsClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-sfn").ServiceInputTypes, import("@aws-sdk/client-sfn").ServiceOutputTypes, import("@aws-sdk/client-sfn").SFNClientResolvedConfig>;
export declare const mockSTSClient: import("aws-sdk-client-mock").AwsStub<import("@aws-sdk/client-sts").ServiceInputTypes, import("@aws-sdk/client-sts").ServiceOutputTypes, import("@aws-sdk/client-sts").STSClientResolvedConfig>;
/**
 * Resets clients back to defaults and resets the history
 * of usage of the mock.
 */
export declare const restoreSdkMocksToDefault: () => void;
export declare const setDefaultSTSMocks: () => void;
/**
 * MockSdkProvider that is mostly SdkProvider but
 * with fake credentials and account information.
 *
 * For mocking the actual clients, the above mocking
 * clients may be used.
 */
export declare class MockSdkProvider extends SdkProvider {
    constructor();
    defaultAccount(): Promise<Account | undefined>;
}
/**
 * MockSdk that is mostly just the SDK but with fake
 * credentials and a full set of default client mocks.
 * These individual functions within those clients can be
 * customized in the test file that uses it.
 */
export declare class MockSdk extends SDK {
    constructor();
}
export declare function mockBootstrapStack(stack?: Partial<Stack>): CloudFormationStack;
export declare function mockResolvedEnvironment(): Environment;
