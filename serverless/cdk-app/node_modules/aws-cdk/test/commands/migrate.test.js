"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const os = require("os");
const path = require("path");
const util_1 = require("util");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const fs = require("fs-extra");
const migrate_1 = require("../../lib/commands/migrate");
const mock_sdk_1 = require("../util/mock-sdk");
const exec = (0, util_1.promisify)(child_process_1.exec);
describe('Migrate Function Tests', () => {
    let sdkProvider;
    const testResourcePath = [__dirname, 'test-resources'];
    const templatePath = [...testResourcePath, 'templates'];
    const stackPath = [...testResourcePath, 'stacks'];
    const validTemplatePath = path.join(...templatePath, 's3-template.json');
    const emptyTemplatePath = path.join(...templatePath, 'empty-template.yml');
    const invalidTemplatePath = path.join(...templatePath, 'rds-template.json');
    const validTemplate = (0, migrate_1.readFromPath)(validTemplatePath);
    const invalidTemplate = (0, migrate_1.readFromPath)(invalidTemplatePath);
    beforeEach(async () => {
        sdkProvider = new mock_sdk_1.MockSdkProvider();
    });
    test('parseSourceOptions throws if both --from-path and --from-stack is provided', () => {
        expect(() => (0, migrate_1.parseSourceOptions)('any-value', true, 'my-awesome-stack')).toThrow('Only one of `--from-path` or `--from-stack` may be provided.');
    });
    test('parseSourceOptions returns from-scan when neither --from-path or --from-stack are provided', () => {
        expect((0, migrate_1.parseSourceOptions)(undefined, undefined, 'my-stack-name')).toStrictEqual({
            source: migrate_1.TemplateSourceOptions.SCAN,
        });
    });
    test('parseSourceOptions does not throw when only --from-path is supplied', () => {
        expect((0, migrate_1.parseSourceOptions)('my-file-path', undefined, 'my-stack-name')).toStrictEqual({
            source: migrate_1.TemplateSourceOptions.PATH,
            templatePath: 'my-file-path',
        });
    });
    test('parseSourceOptions does now throw when only --from-stack is provided', () => {
        expect((0, migrate_1.parseSourceOptions)(undefined, true, 'my-stack-name')).toStrictEqual({
            source: migrate_1.TemplateSourceOptions.STACK,
            stackName: 'my-stack-name',
        });
    });
    test('readFromPath produces a string representation of the template at a given path', () => {
        expect((0, migrate_1.readFromPath)(validTemplatePath)).toEqual(fs.readFileSync(validTemplatePath, 'utf8'));
    });
    test('readFromPath throws error when template file is empty', () => {
        expect(() => (0, migrate_1.readFromPath)(emptyTemplatePath)).toThrow(`\'${emptyTemplatePath}\' is an empty file.`);
    });
    test('readFromPath throws error when template file does not exist at a given path', () => {
        const badTemplatePath = './not-here.json';
        expect(() => (0, migrate_1.readFromPath)(badTemplatePath)).toThrow(`\'${badTemplatePath}\' is not a valid path.`);
    });
    test('readFromStack produces a string representation of the template retrieved from CloudFormation', async () => {
        const template = fs.readFileSync(validTemplatePath, { encoding: 'utf-8' });
        mock_sdk_1.mockCloudFormationClient
            .on(client_cloudformation_1.GetTemplateCommand)
            .resolves({
            TemplateBody: template,
        })
            .on(client_cloudformation_1.DescribeStacksCommand)
            .resolves({
            Stacks: [
                {
                    StackName: 'this-one',
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    CreationTime: new Date(),
                },
            ],
        });
        expect(await (0, migrate_1.readFromStack)('this-one', sdkProvider, {
            account: '123456789012',
            region: 'here',
            name: 'hello-my-name-is-what...',
        })).toEqual(JSON.stringify(JSON.parse(template)));
    });
    test('readFromStack throws error when no stack exists with the stack name in the account and region', async () => {
        const error = new Error('No stack. This did not go well.');
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).rejects(error);
        await expect(() => (0, migrate_1.readFromStack)('that-one', sdkProvider, {
            account: '123456789012',
            region: 'here',
            name: 'hello-my-name-is-who...',
        })).rejects.toThrow('No stack. This did not go well.');
    });
    test('readFromStack throws error when stack exists but the status is not healthy', async () => {
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [
                {
                    StackName: 'this-one',
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_FAILED,
                    StackStatusReason: 'Something went wrong',
                    CreationTime: new Date(),
                },
            ],
        });
        await expect(() => (0, migrate_1.readFromStack)('that-one', sdkProvider, {
            account: '123456789012',
            region: 'here',
            name: 'hello-my-name-is-chicka-chicka...',
        })).rejects.toThrow("Stack 'that-one' in account 123456789012 and region here has a status of 'CREATE_FAILED' due to 'Something went wrong'. The stack cannot be migrated until it is in a healthy state.");
    });
    test('setEnvironment sets account and region when provided', () => {
        expect((0, migrate_1.setEnvironment)('my-account', 'somewhere')).toEqual({
            account: 'my-account',
            region: 'somewhere',
            name: 'cdk-migrate-env',
        });
    });
    test('serEnvironment uses default account and region when not provided', () => {
        expect((0, migrate_1.setEnvironment)()).toEqual({ account: 'unknown-account', region: 'unknown-region', name: 'cdk-migrate-env' });
    });
    test('generateStack generates the expected stack string when called for typescript', () => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodTypeScript', 'typescript');
        expect(stack).toEqual(fs.readFileSync(path.join(...stackPath, 's3-stack.ts'), 'utf8'));
    });
    test('generateStack generates the expected stack string when called for python', () => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodPython', 'python');
        expect(stack).toEqual(fs.readFileSync(path.join(...stackPath, 's3_stack.py'), 'utf8'));
    });
    test('generateStack generates the expected stack string when called for java', () => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodJava', 'java');
        expect(stack).toEqual(fs.readFileSync(path.join(...stackPath, 'S3Stack.java'), 'utf8'));
    });
    test('generateStack generates the expected stack string when called for csharp', () => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodCSharp', 'csharp');
        expect(stack).toEqual(fs.readFileSync(path.join(...stackPath, 'S3Stack.cs'), 'utf8'));
    });
    // TODO: fix with actual go template
    test('generateStack generates the expected stack string when called for go', () => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodGo', 'go');
        expect(stack).toEqual(fs.readFileSync(path.join(...stackPath, 's3.go'), 'utf8'));
    });
    test('generateStack throws error when called for other language', () => {
        expect(() => (0, migrate_1.generateStack)(validTemplate, 'BadBadBad', 'php')).toThrow('BadBadBadStack could not be generated because php is not a supported language');
    });
    test('generateStack throws error for invalid resource property', () => {
        expect(() => (0, migrate_1.generateStack)(invalidTemplate, 'VeryBad', 'typescript')).toThrow('VeryBadStack could not be generated because ReadEndpoint is not a valid property for resource RDSCluster of type AWS::RDS::DBCluster');
    });
    cliTest('generateCdkApp generates the expected cdk app when called for typescript', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodTypeScript', 'typescript');
        await (0, migrate_1.generateCdkApp)('GoodTypeScript', stack, 'typescript', workDir);
        // Packages exist in the correct spot
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'package.json'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'bin', 'good_type_script.ts'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'lib', 'good_type_script-stack.ts'))).toBeTruthy();
        // Replaced stack file is referenced correctly in app file
        const app = fs.readFileSync(path.join(workDir, 'GoodTypeScript', 'bin', 'good_type_script.ts'), 'utf8').split('\n');
        expect(app
            .map((line) => line.match("import { GoodTypeScriptStack } from '../lib/good_type_script-stack';"))
            .filter((line) => line).length).toEqual(1);
        expect(app.map((line) => line.match(/new GoodTypeScriptStack\(app, \'GoodTypeScript\', \{/)).filter((line) => line)
            .length).toEqual(1);
        // Replaced stack file is correctly generated
        const replacedStack = fs.readFileSync(path.join(workDir, 'GoodTypeScript', 'lib', 'good_type_script-stack.ts'), 'utf8');
        expect(replacedStack).toEqual(fs.readFileSync(path.join(...stackPath, 's3-stack.ts'), 'utf8'));
    });
    cliTest('generateCdkApp adds cdk-migrate key in context', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodTypeScript', 'typescript');
        await (0, migrate_1.generateCdkApp)('GoodTypeScript', stack, 'typescript', workDir);
        // cdk.json exist in the correct spot
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'cdk.json'))).toBeTruthy();
        // cdk.json has "cdk-migrate" : true in context
        const cdkJson = fs.readJsonSync(path.join(workDir, 'GoodTypeScript', 'cdk.json'), 'utf8');
        expect(cdkJson.context['cdk-migrate']).toBeTruthy();
    });
    cliTest('generateCdkApp generates the expected cdk app when called for python', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodPython', 'python');
        await (0, migrate_1.generateCdkApp)('GoodPython', stack, 'python', workDir);
        // Packages exist in the correct spot
        expect(fs.pathExistsSync(path.join(workDir, 'GoodPython', 'requirements.txt'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodPython', 'app.py'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodPython', 'good_python', 'good_python_stack.py'))).toBeTruthy();
        // Replaced stack file is referenced correctly in app file
        const app = fs.readFileSync(path.join(workDir, 'GoodPython', 'app.py'), 'utf8').split('\n');
        expect(app.map((line) => line.match('from good_python.good_python_stack import GoodPythonStack')).filter((line) => line)
            .length).toEqual(1);
        expect(app.map((line) => line.match(/GoodPythonStack\(app, "GoodPython",/)).filter((line) => line).length).toEqual(1);
        // Replaced stack file is correctly generated
        const replacedStack = fs.readFileSync(path.join(workDir, 'GoodPython', 'good_python', 'good_python_stack.py'), 'utf8');
        expect(replacedStack).toEqual(fs.readFileSync(path.join(...stackPath, 's3_stack.py'), 'utf8'));
    });
    cliTest('generateCdkApp generates the expected cdk app when called for java', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodJava', 'java');
        await (0, migrate_1.generateCdkApp)('GoodJava', stack, 'java', workDir);
        // Packages exist in the correct spot
        expect(fs.pathExistsSync(path.join(workDir, 'GoodJava', 'pom.xml'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodJava', 'src', 'main', 'java', 'com', 'myorg', 'GoodJavaApp.java'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodJava', 'src', 'main', 'java', 'com', 'myorg', 'GoodJavaStack.java'))).toBeTruthy();
        // Replaced stack file is referenced correctly in app file
        const app = fs
            .readFileSync(path.join(workDir, 'GoodJava', 'src', 'main', 'java', 'com', 'myorg', 'GoodJavaApp.java'), 'utf8')
            .split('\n');
        expect(app.map((line) => line.match('public class GoodJavaApp {')).filter((line) => line).length).toEqual(1);
        expect(app
            .map((line) => line.match(/        new GoodJavaStack\(app, "GoodJava", StackProps.builder()/))
            .filter((line) => line).length).toEqual(1);
        // Replaced stack file is correctly generated
        const replacedStack = fs.readFileSync(path.join(workDir, 'GoodJava', 'src', 'main', 'java', 'com', 'myorg', 'GoodJavaStack.java'), 'utf8');
        expect(replacedStack).toEqual(fs.readFileSync(path.join(...stackPath, 'S3Stack.java'), 'utf8'));
    });
    cliTest('generateCdkApp generates the expected cdk app when called for csharp', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodCSharp', 'csharp');
        await (0, migrate_1.generateCdkApp)('GoodCSharp', stack, 'csharp', workDir);
        // Packages exist in the correct spot
        expect(fs.pathExistsSync(path.join(workDir, 'GoodCSharp', 'src', 'GoodCSharp.sln'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodCSharp', 'src', 'GoodCSharp', 'Program.cs'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodCSharp', 'src', 'GoodCSharp', 'GoodCSharpStack.cs'))).toBeTruthy();
        // Replaced stack file is referenced correctly in app file
        const app = fs
            .readFileSync(path.join(workDir, 'GoodCSharp', 'src', 'GoodCSharp', 'Program.cs'), 'utf8')
            .split('\n');
        expect(app.map((line) => line.match('namespace GoodCSharp')).filter((line) => line).length).toEqual(1);
        expect(app
            .map((line) => line.match(/        new GoodCSharpStack\(app, "GoodCSharp", new GoodCSharpStackProps/))
            .filter((line) => line).length).toEqual(1);
        // Replaced stack file is correctly generated
        const replacedStack = fs.readFileSync(path.join(workDir, 'GoodCSharp', 'src', 'GoodCSharp', 'GoodCSharpStack.cs'), 'utf8');
        expect(replacedStack).toEqual(fs.readFileSync(path.join(...stackPath, 'S3Stack.cs'), 'utf8'));
    });
    cliTest('generatedCdkApp generates the expected cdk app when called for go', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodGo', 'go');
        await (0, migrate_1.generateCdkApp)('GoodGo', stack, 'go', workDir);
        expect(fs.pathExists(path.join(workDir, 's3.go'))).toBeTruthy();
        const app = fs.readFileSync(path.join(workDir, 'GoodGo', 'good_go.go'), 'utf8').split('\n');
        expect(app
            .map((line) => line.match(/func NewGoodGoStack\(scope constructs.Construct, id string, props \*GoodGoStackProps\) \*GoodGoStack \{/))
            .filter((line) => line).length).toEqual(1);
        expect(app.map((line) => line.match(/    NewGoodGoStack\(app, "GoodGo", &GoodGoStackProps\{/)));
    });
    cliTest('generatedCdkApp generates a zip file when --compress is used', async (workDir) => {
        const stack = (0, migrate_1.generateStack)(validTemplate, 'GoodTypeScript', 'typescript');
        await (0, migrate_1.generateCdkApp)('GoodTypeScript', stack, 'typescript', workDir, true);
        // Packages not in outDir
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'package.json'))).toBeFalsy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'bin', 'good_type_script.ts'))).toBeFalsy();
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript', 'lib', 'good_type_script-stack.ts'))).toBeFalsy();
        // Zip file exists
        expect(fs.pathExistsSync(path.join(workDir, 'GoodTypeScript.zip'))).toBeTruthy();
        // Unzip it
        await exec(`unzip ${path.join(workDir, 'GoodTypeScript.zip')}`, { cwd: workDir });
        // Now the files should be there
        expect(fs.pathExistsSync(path.join(workDir, 'package.json'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'bin', 'good_type_script.ts'))).toBeTruthy();
        expect(fs.pathExistsSync(path.join(workDir, 'lib', 'good_type_script-stack.ts'))).toBeTruthy();
    });
});
function cliTest(name, handler) {
    test(name, () => withTempDir(handler));
}
async function withTempDir(cb) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aws-cdk-test'));
    try {
        await cb(tmpDir);
    }
    finally {
        await fs.remove(tmpDir);
    }
}
describe('generateTemplate', () => {
    let sdkProvider;
    const sampleResource = {
        ResourceType: 'AWS::S3::Bucket',
        ManagedByStack: true,
        ResourceIdentifier: { 'my-key': 'my-bucket' },
        LogicalResourceId: 'my-bucket',
    };
    const sampleResource2 = {
        ResourceType: 'AWS::EC2::Instance',
        ResourceIdentifier: {
            instanceId: 'i-1234567890abcdef0',
        },
        LogicalResourceId: 'my-ec2-instance',
        ManagedByStack: true,
    };
    const stackName = 'my-stack';
    const environment = (0, migrate_1.setEnvironment)('123456789012', 'us-east-1');
    const scanId = 'fake-scan-id';
    const defaultExpectedResult = {
        migrateJson: {
            resources: [
                {
                    LogicalResourceId: 'my-bucket',
                    ResourceIdentifier: { 'my-key': 'my-bucket' },
                    ResourceType: 'AWS::S3::Bucket',
                },
                {
                    LogicalResourceId: 'my-ec2-instance',
                    ResourceIdentifier: { instanceId: 'i-1234567890abcdef0' },
                    ResourceType: 'AWS::EC2::Instance',
                },
            ],
            source: 'template-arn',
            templateBody: 'template-body',
        },
        resources: [
            {
                LogicalResourceId: 'my-bucket',
                ManagedByStack: true,
                ResourceIdentifier: {
                    'my-key': 'my-bucket',
                },
                ResourceType: 'AWS::S3::Bucket',
            },
            {
                LogicalResourceId: 'my-ec2-instance',
                ManagedByStack: true,
                ResourceIdentifier: {
                    instanceId: 'i-1234567890abcdef0',
                },
                ResourceType: 'AWS::EC2::Instance',
            },
        ],
    };
    beforeEach(() => {
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
        sdkProvider = new mock_sdk_1.MockSdkProvider();
        mock_sdk_1.mockCloudFormationClient
            .on(client_cloudformation_1.StartResourceScanCommand)
            .resolves({
            ResourceScanId: scanId,
        })
            .on(client_cloudformation_1.ListResourceScansCommand)
            .resolves({
            ResourceScanSummaries: [
                { ResourceScanId: scanId, Status: client_cloudformation_1.ResourceScanStatus.COMPLETE, PercentageCompleted: 100 },
            ],
        })
            .on(client_cloudformation_1.DescribeResourceScanCommand)
            .resolves({
            Status: 'COMPLETE',
        })
            .on(client_cloudformation_1.ListResourceScanResourcesCommand)
            .resolves({
            Resources: [sampleResource2],
        })
            .on(client_cloudformation_1.CreateGeneratedTemplateCommand)
            .resolves({
            GeneratedTemplateId: 'template-arn',
        })
            .on(client_cloudformation_1.DescribeGeneratedTemplateCommand)
            .resolves({
            Status: 'COMPLETE',
            Resources: [sampleResource, sampleResource2],
        })
            .on(client_cloudformation_1.GetGeneratedTemplateCommand)
            .resolves({
            TemplateBody: 'template-body',
        })
            .on(client_cloudformation_1.ListResourceScanRelatedResourcesCommand)
            .resolves({
            RelatedResources: [sampleResource],
        });
    });
    afterEach(() => {
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
    });
    test('generateTemplate successfully generates template with a new scan', async () => {
        const opts = {
            stackName: stackName,
            filters: [],
            fromScan: migrate_1.FromScan.NEW,
            sdkProvider: sdkProvider,
            environment: environment,
        };
        const template = await (0, migrate_1.generateTemplate)(opts);
        expect(template).toEqual(defaultExpectedResult);
    });
    test('generateTemplate successfully defaults to latest scan instead of starting a new one', async () => {
        mock_sdk_1.mockCloudFormationClient
            .on(client_cloudformation_1.StartResourceScanCommand)
            .rejects('No >:(')
            .on(client_cloudformation_1.ListResourceScansCommand)
            .resolvesOnce({
            ResourceScanSummaries: [{ ResourceScanId: scanId, Status: 'IN_PROGRESS', PercentageCompleted: 50 }],
        })
            .resolves({
            ResourceScanSummaries: [{ ResourceScanId: scanId, Status: 'COMPLETE', PercentageCompleted: 100 }],
        });
        const opts = {
            stackName: stackName,
            filters: [],
            newScan: true,
            sdkProvider: sdkProvider,
            environment: environment,
        };
        const template = await (0, migrate_1.generateTemplate)(opts);
        expect(template).toEqual(defaultExpectedResult);
    });
    test('generateTemplate throws an error when from-scan most-recent is passed but no scans are found.', async () => {
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListResourceScansCommand)
            .resolves({
            ResourceScanSummaries: [],
        });
        const opts = {
            stackName: stackName,
            filters: [],
            fromScan: migrate_1.FromScan.MOST_RECENT,
            sdkProvider: sdkProvider,
            environment: environment,
        };
        await expect((0, migrate_1.generateTemplate)(opts)).rejects.toThrow('No scans found. Please either start a new scan with the `--from-scan` new or do not specify a `--from-scan` option.');
    });
    test('generateTemplate throws an error when an invalid key is passed in the filters', async () => {
        const opts = {
            stackName: stackName,
            filters: ['invalid-key=invalid-value'],
            fromScan: migrate_1.FromScan.MOST_RECENT,
            sdkProvider: sdkProvider,
            environment: environment,
        };
        await expect((0, migrate_1.generateTemplate)(opts)).rejects.toThrow('Invalid filter: invalid-key');
    });
    test('generateTemplate defaults to starting a new scan when no options are provided and no scans are found', async () => {
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListResourceScansCommand)
            // First call: list current scans, there aren't any.
            .resolvesOnce({ ResourceScanSummaries: [] })
            // The generator will then call StartScan and ListResourceScans again which it now will expect to return something
            .resolves({
            ResourceScanSummaries: [{ ResourceScanId: scanId, Status: 'COMPLETE', PercentageCompleted: 100 }],
        });
        const opts = {
            stackName: stackName,
            sdkProvider: sdkProvider,
            environment: environment,
        };
        const template = await (0, migrate_1.generateTemplate)(opts);
        expect(template).toEqual(defaultExpectedResult);
        expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommand(client_cloudformation_1.StartResourceScanCommand);
    });
    test('generateTemplate successfully generates templates with valid filter options', async () => {
        const opts = {
            stackName: stackName,
            filters: ['type=AWS::S3::Bucket,identifier={"my-key":"my-bucket"}', 'type=AWS::EC2::Instance'],
            sdkProvider: sdkProvider,
            environment: environment,
        };
        const template = await (0, migrate_1.generateTemplate)(opts);
        expect(template).toEqual(defaultExpectedResult);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0ZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWlncmF0ZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaURBQThDO0FBQzlDLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFDN0IsK0JBQWlDO0FBQ2pDLDBFQWF3QztBQUN4QywrQkFBK0I7QUFDL0Isd0RBV29DO0FBQ3BDLCtDQUF1RztBQUV2RyxNQUFNLElBQUksR0FBRyxJQUFBLGdCQUFTLEVBQUMsb0JBQUssQ0FBQyxDQUFDO0FBRTlCLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7SUFDdEMsSUFBSSxXQUE0QixDQUFDO0lBRWpDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUN2RCxNQUFNLFlBQVksR0FBRyxDQUFDLEdBQUcsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDeEQsTUFBTSxTQUFTLEdBQUcsQ0FBQyxHQUFHLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRWxELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3pFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQzNFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO0lBQzVFLE1BQU0sYUFBYSxHQUFHLElBQUEsc0JBQVksRUFBQyxpQkFBaUIsQ0FBRSxDQUFDO0lBQ3ZELE1BQU0sZUFBZSxHQUFHLElBQUEsc0JBQVksRUFBQyxtQkFBbUIsQ0FBRSxDQUFDO0lBRTNELFVBQVUsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUNwQixXQUFXLEdBQUcsSUFBSSwwQkFBZSxFQUFFLENBQUM7SUFD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QUM7SUFFSCxJQUFJLENBQUMsNkVBQTZFLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDN0YsTUFBTSxJQUFJLEdBQTRCO1lBQ3BDLFNBQVMsRUFBRSxTQUFTO1lBQ3BCLE9BQU8sRUFBRSxDQUFDLHdEQUF3RCxFQUFFLHlCQUF5QixDQUFDO1lBQzlGLFdBQVcsRUFBRSxXQUFXO1lBQ3hCLFdBQVcsRUFBRSxXQUFXO1NBQ3pCLENBQUM7UUFDRixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUEsMEJBQWdCLEVBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2xELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleGVjIGFzIF9leGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQge1xuICBDcmVhdGVHZW5lcmF0ZWRUZW1wbGF0ZUNvbW1hbmQsXG4gIERlc2NyaWJlR2VuZXJhdGVkVGVtcGxhdGVDb21tYW5kLFxuICBEZXNjcmliZVJlc291cmNlU2NhbkNvbW1hbmQsXG4gIERlc2NyaWJlU3RhY2tzQ29tbWFuZCxcbiAgR2V0R2VuZXJhdGVkVGVtcGxhdGVDb21tYW5kLFxuICBHZXRUZW1wbGF0ZUNvbW1hbmQsXG4gIExpc3RSZXNvdXJjZVNjYW5SZWxhdGVkUmVzb3VyY2VzQ29tbWFuZCxcbiAgTGlzdFJlc291cmNlU2NhblJlc291cmNlc0NvbW1hbmQsXG4gIExpc3RSZXNvdXJjZVNjYW5zQ29tbWFuZCxcbiAgUmVzb3VyY2VTY2FuU3RhdHVzLFxuICBTdGFja1N0YXR1cyxcbiAgU3RhcnRSZXNvdXJjZVNjYW5Db21tYW5kLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWRmb3JtYXRpb24nO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHtcbiAgZ2VuZXJhdGVDZGtBcHAsXG4gIGdlbmVyYXRlU3RhY2ssXG4gIHJlYWRGcm9tUGF0aCxcbiAgcmVhZEZyb21TdGFjayxcbiAgc2V0RW52aXJvbm1lbnQsXG4gIHBhcnNlU291cmNlT3B0aW9ucyxcbiAgZ2VuZXJhdGVUZW1wbGF0ZSxcbiAgVGVtcGxhdGVTb3VyY2VPcHRpb25zLFxuICBHZW5lcmF0ZVRlbXBsYXRlT3B0aW9ucyxcbiAgRnJvbVNjYW4sXG59IGZyb20gJy4uLy4uL2xpYi9jb21tYW5kcy9taWdyYXRlJztcbmltcG9ydCB7IE1vY2tTZGtQcm92aWRlciwgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LCByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuY29uc3QgZXhlYyA9IHByb21pc2lmeShfZXhlYyk7XG5cbmRlc2NyaWJlKCdNaWdyYXRlIEZ1bmN0aW9uIFRlc3RzJywgKCkgPT4ge1xuICBsZXQgc2RrUHJvdmlkZXI6IE1vY2tTZGtQcm92aWRlcjtcblxuICBjb25zdCB0ZXN0UmVzb3VyY2VQYXRoID0gW19fZGlybmFtZSwgJ3Rlc3QtcmVzb3VyY2VzJ107XG4gIGNvbnN0IHRlbXBsYXRlUGF0aCA9IFsuLi50ZXN0UmVzb3VyY2VQYXRoLCAndGVtcGxhdGVzJ107XG4gIGNvbnN0IHN0YWNrUGF0aCA9IFsuLi50ZXN0UmVzb3VyY2VQYXRoLCAnc3RhY2tzJ107XG5cbiAgY29uc3QgdmFsaWRUZW1wbGF0ZVBhdGggPSBwYXRoLmpvaW4oLi4udGVtcGxhdGVQYXRoLCAnczMtdGVtcGxhdGUuanNvbicpO1xuICBjb25zdCBlbXB0eVRlbXBsYXRlUGF0aCA9IHBhdGguam9pbiguLi50ZW1wbGF0ZVBhdGgsICdlbXB0eS10ZW1wbGF0ZS55bWwnKTtcbiAgY29uc3QgaW52YWxpZFRlbXBsYXRlUGF0aCA9IHBhdGguam9pbiguLi50ZW1wbGF0ZVBhdGgsICdyZHMtdGVtcGxhdGUuanNvbicpO1xuICBjb25zdCB2YWxpZFRlbXBsYXRlID0gcmVhZEZyb21QYXRoKHZhbGlkVGVtcGxhdGVQYXRoKSE7XG4gIGNvbnN0IGludmFsaWRUZW1wbGF0ZSA9IHJlYWRGcm9tUGF0aChpbnZhbGlkVGVtcGxhdGVQYXRoKSE7XG5cbiAgYmVmb3JlRWFjaChhc3luYyAoKSA9PiB7XG4gICAgc2RrUHJvdmlkZXIgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3BhcnNlU291cmNlT3B0aW9ucyB0aHJvd3MgaWYgYm90aCAtLWZyb20tcGF0aCBhbmQgLS1mcm9tLXN0YWNrIGlzIHByb3ZpZGVkJywgKCkgPT4ge1xuICAgIGV4cGVjdCgoKSA9PiBwYXJzZVNvdXJjZU9wdGlvbnMoJ2FueS12YWx1ZScsIHRydWUsICdteS1hd2Vzb21lLXN0YWNrJykpLnRvVGhyb3coXG4gICAgICAnT25seSBvbmUgb2YgYC0tZnJvbS1wYXRoYCBvciBgLS1mcm9tLXN0YWNrYCBtYXkgYmUgcHJvdmlkZWQuJyxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdwYXJzZVNvdXJjZU9wdGlvbnMgcmV0dXJucyBmcm9tLXNjYW4gd2hlbiBuZWl0aGVyIC0tZnJvbS1wYXRoIG9yIC0tZnJvbS1zdGFjayBhcmUgcHJvdmlkZWQnLCAoKSA9PiB7XG4gICAgZXhwZWN0KHBhcnNlU291cmNlT3B0aW9ucyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ215LXN0YWNrLW5hbWUnKSkudG9TdHJpY3RFcXVhbCh7XG4gICAgICBzb3VyY2U6IFRlbXBsYXRlU291cmNlT3B0aW9ucy5TQ0FOLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdwYXJzZVNvdXJjZU9wdGlvbnMgZG9lcyBub3QgdGhyb3cgd2hlbiBvbmx5IC0tZnJvbS1wYXRoIGlzIHN1cHBsaWVkJywgKCkgPT4ge1xuICAgIGV4cGVjdChwYXJzZVNvdXJjZU9wdGlvbnMoJ215LWZpbGUtcGF0aCcsIHVuZGVmaW5lZCwgJ215LXN0YWNrLW5hbWUnKSkudG9TdHJpY3RFcXVhbCh7XG4gICAgICBzb3VyY2U6IFRlbXBsYXRlU291cmNlT3B0aW9ucy5QQVRILFxuICAgICAgdGVtcGxhdGVQYXRoOiAnbXktZmlsZS1wYXRoJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgncGFyc2VTb3VyY2VPcHRpb25zIGRvZXMgbm93IHRocm93IHdoZW4gb25seSAtLWZyb20tc3RhY2sgaXMgcHJvdmlkZWQnLCAoKSA9PiB7XG4gICAgZXhwZWN0KHBhcnNlU291cmNlT3B0aW9ucyh1bmRlZmluZWQsIHRydWUsICdteS1zdGFjay1uYW1lJykpLnRvU3RyaWN0RXF1YWwoe1xuICAgICAgc291cmNlOiBUZW1wbGF0ZVNvdXJjZU9wdGlvbnMuU1RBQ0ssXG4gICAgICBzdGFja05hbWU6ICdteS1zdGFjay1uYW1lJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgncmVhZEZyb21QYXRoIHByb2R1Y2VzIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0ZW1wbGF0ZSBhdCBhIGdpdmVuIHBhdGgnLCAoKSA9PiB7XG4gICAgZXhwZWN0KHJlYWRGcm9tUGF0aCh2YWxpZFRlbXBsYXRlUGF0aCkpLnRvRXF1YWwoZnMucmVhZEZpbGVTeW5jKHZhbGlkVGVtcGxhdGVQYXRoLCAndXRmOCcpKTtcbiAgfSk7XG5cbiAgdGVzdCgncmVhZEZyb21QYXRoIHRocm93cyBlcnJvciB3aGVuIHRlbXBsYXRlIGZpbGUgaXMgZW1wdHknLCAoKSA9PiB7XG4gICAgZXhwZWN0KCgpID0+IHJlYWRGcm9tUGF0aChlbXB0eVRlbXBsYXRlUGF0aCkpLnRvVGhyb3coYFxcJyR7ZW1wdHlUZW1wbGF0ZVBhdGh9XFwnIGlzIGFuIGVtcHR5IGZpbGUuYCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3JlYWRGcm9tUGF0aCB0aHJvd3MgZXJyb3Igd2hlbiB0ZW1wbGF0ZSBmaWxlIGRvZXMgbm90IGV4aXN0IGF0IGEgZ2l2ZW4gcGF0aCcsICgpID0+IHtcbiAgICBjb25zdCBiYWRUZW1wbGF0ZVBhdGggPSAnLi9ub3QtaGVyZS5qc29uJztcbiAgICBleHBlY3QoKCkgPT4gcmVhZEZyb21QYXRoKGJhZFRlbXBsYXRlUGF0aCkpLnRvVGhyb3coYFxcJyR7YmFkVGVtcGxhdGVQYXRofVxcJyBpcyBub3QgYSB2YWxpZCBwYXRoLmApO1xuICB9KTtcblxuICB0ZXN0KCdyZWFkRnJvbVN0YWNrIHByb2R1Y2VzIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0ZW1wbGF0ZSByZXRyaWV2ZWQgZnJvbSBDbG91ZEZvcm1hdGlvbicsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IGZzLnJlYWRGaWxlU3luYyh2YWxpZFRlbXBsYXRlUGF0aCwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAgIC5vbihHZXRUZW1wbGF0ZUNvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBUZW1wbGF0ZUJvZHk6IHRlbXBsYXRlLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBTdGFja3M6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBTdGFja05hbWU6ICd0aGlzLW9uZScsXG4gICAgICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgIGV4cGVjdChcbiAgICAgIGF3YWl0IHJlYWRGcm9tU3RhY2soJ3RoaXMtb25lJywgc2RrUHJvdmlkZXIsIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgICBuYW1lOiAnaGVsbG8tbXktbmFtZS1pcy13aGF0Li4uJyxcbiAgICAgIH0pLFxuICAgICkudG9FcXVhbChKU09OLnN0cmluZ2lmeShKU09OLnBhcnNlKHRlbXBsYXRlKSkpO1xuICB9KTtcblxuICB0ZXN0KCdyZWFkRnJvbVN0YWNrIHRocm93cyBlcnJvciB3aGVuIG5vIHN0YWNrIGV4aXN0cyB3aXRoIHRoZSBzdGFjayBuYW1lIGluIHRoZSBhY2NvdW50IGFuZCByZWdpb24nLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ05vIHN0YWNrLiBUaGlzIGRpZCBub3QgZ28gd2VsbC4nKTtcbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZWplY3RzKGVycm9yKTtcbiAgICBhd2FpdCBleHBlY3QoKCkgPT5cbiAgICAgIHJlYWRGcm9tU3RhY2soJ3RoYXQtb25lJywgc2RrUHJvdmlkZXIsIHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIHJlZ2lvbjogJ2hlcmUnLFxuICAgICAgICBuYW1lOiAnaGVsbG8tbXktbmFtZS1pcy13aG8uLi4nLFxuICAgICAgfSksXG4gICAgKS5yZWplY3RzLnRvVGhyb3coJ05vIHN0YWNrLiBUaGlzIGRpZCBub3QgZ28gd2VsbC4nKTtcbiAgfSk7XG5cbiAgdGVzdCgncmVhZEZyb21TdGFjayB0aHJvd3MgZXJyb3Igd2hlbiBzdGFjayBleGlzdHMgYnV0IHRoZSBzdGF0dXMgaXMgbm90IGhlYWx0aHknLCBhc3luYyAoKSA9PiB7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgU3RhY2tzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdGFja05hbWU6ICd0aGlzLW9uZScsXG4gICAgICAgICAgU3RhY2tTdGF0dXM6IFN0YWNrU3RhdHVzLkNSRUFURV9GQUlMRUQsXG4gICAgICAgICAgU3RhY2tTdGF0dXNSZWFzb246ICdTb21ldGhpbmcgd2VudCB3cm9uZycsXG4gICAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGV4cGVjdCgoKSA9PlxuICAgICAgcmVhZEZyb21TdGFjaygndGhhdC1vbmUnLCBzZGtQcm92aWRlciwge1xuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgcmVnaW9uOiAnaGVyZScsXG4gICAgICAgIG5hbWU6ICdoZWxsby1teS1uYW1lLWlzLWNoaWNrYS1jaGlja2EuLi4nLFxuICAgICAgfSksXG4gICAgKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICBcIlN0YWNrICd0aGF0LW9uZScgaW4gYWNjb3VudCAxMjM0NTY3ODkwMTIgYW5kIHJlZ2lvbiBoZXJlIGhhcyBhIHN0YXR1cyBvZiAnQ1JFQVRFX0ZBSUxFRCcgZHVlIHRvICdTb21ldGhpbmcgd2VudCB3cm9uZycuIFRoZSBzdGFjayBjYW5ub3QgYmUgbWlncmF0ZWQgdW50aWwgaXQgaXMgaW4gYSBoZWFsdGh5IHN0YXRlLlwiLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ3NldEVudmlyb25tZW50IHNldHMgYWNjb3VudCBhbmQgcmVnaW9uIHdoZW4gcHJvdmlkZWQnLCAoKSA9PiB7XG4gICAgZXhwZWN0KHNldEVudmlyb25tZW50KCdteS1hY2NvdW50JywgJ3NvbWV3aGVyZScpKS50b0VxdWFsKHtcbiAgICAgIGFjY291bnQ6ICdteS1hY2NvdW50JyxcbiAgICAgIHJlZ2lvbjogJ3NvbWV3aGVyZScsXG4gICAgICBuYW1lOiAnY2RrLW1pZ3JhdGUtZW52JyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnc2VyRW52aXJvbm1lbnQgdXNlcyBkZWZhdWx0IGFjY291bnQgYW5kIHJlZ2lvbiB3aGVuIG5vdCBwcm92aWRlZCcsICgpID0+IHtcbiAgICBleHBlY3Qoc2V0RW52aXJvbm1lbnQoKSkudG9FcXVhbCh7IGFjY291bnQ6ICd1bmtub3duLWFjY291bnQnLCByZWdpb246ICd1bmtub3duLXJlZ2lvbicsIG5hbWU6ICdjZGstbWlncmF0ZS1lbnYnIH0pO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVN0YWNrIGdlbmVyYXRlcyB0aGUgZXhwZWN0ZWQgc3RhY2sgc3RyaW5nIHdoZW4gY2FsbGVkIGZvciB0eXBlc2NyaXB0JywgKCkgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZFR5cGVTY3JpcHQnLCAndHlwZXNjcmlwdCcpO1xuICAgIGV4cGVjdChzdGFjaykudG9FcXVhbChmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKC4uLnN0YWNrUGF0aCwgJ3MzLXN0YWNrLnRzJyksICd1dGY4JykpO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVN0YWNrIGdlbmVyYXRlcyB0aGUgZXhwZWN0ZWQgc3RhY2sgc3RyaW5nIHdoZW4gY2FsbGVkIGZvciBweXRob24nLCAoKSA9PiB7XG4gICAgY29uc3Qgc3RhY2sgPSBnZW5lcmF0ZVN0YWNrKHZhbGlkVGVtcGxhdGUsICdHb29kUHl0aG9uJywgJ3B5dGhvbicpO1xuICAgIGV4cGVjdChzdGFjaykudG9FcXVhbChmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKC4uLnN0YWNrUGF0aCwgJ3MzX3N0YWNrLnB5JyksICd1dGY4JykpO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVN0YWNrIGdlbmVyYXRlcyB0aGUgZXhwZWN0ZWQgc3RhY2sgc3RyaW5nIHdoZW4gY2FsbGVkIGZvciBqYXZhJywgKCkgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZEphdmEnLCAnamF2YScpO1xuICAgIGV4cGVjdChzdGFjaykudG9FcXVhbChmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKC4uLnN0YWNrUGF0aCwgJ1MzU3RhY2suamF2YScpLCAndXRmOCcpKTtcbiAgfSk7XG5cbiAgdGVzdCgnZ2VuZXJhdGVTdGFjayBnZW5lcmF0ZXMgdGhlIGV4cGVjdGVkIHN0YWNrIHN0cmluZyB3aGVuIGNhbGxlZCBmb3IgY3NoYXJwJywgKCkgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZENTaGFycCcsICdjc2hhcnAnKTtcbiAgICBleHBlY3Qoc3RhY2spLnRvRXF1YWwoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbiguLi5zdGFja1BhdGgsICdTM1N0YWNrLmNzJyksICd1dGY4JykpO1xuICB9KTtcblxuICAvLyBUT0RPOiBmaXggd2l0aCBhY3R1YWwgZ28gdGVtcGxhdGVcbiAgdGVzdCgnZ2VuZXJhdGVTdGFjayBnZW5lcmF0ZXMgdGhlIGV4cGVjdGVkIHN0YWNrIHN0cmluZyB3aGVuIGNhbGxlZCBmb3IgZ28nLCAoKSA9PiB7XG4gICAgY29uc3Qgc3RhY2sgPSBnZW5lcmF0ZVN0YWNrKHZhbGlkVGVtcGxhdGUsICdHb29kR28nLCAnZ28nKTtcbiAgICBleHBlY3Qoc3RhY2spLnRvRXF1YWwoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbiguLi5zdGFja1BhdGgsICdzMy5nbycpLCAndXRmOCcpKTtcbiAgfSk7XG5cbiAgdGVzdCgnZ2VuZXJhdGVTdGFjayB0aHJvd3MgZXJyb3Igd2hlbiBjYWxsZWQgZm9yIG90aGVyIGxhbmd1YWdlJywgKCkgPT4ge1xuICAgIGV4cGVjdCgoKSA9PiBnZW5lcmF0ZVN0YWNrKHZhbGlkVGVtcGxhdGUsICdCYWRCYWRCYWQnLCAncGhwJykpLnRvVGhyb3coXG4gICAgICAnQmFkQmFkQmFkU3RhY2sgY291bGQgbm90IGJlIGdlbmVyYXRlZCBiZWNhdXNlIHBocCBpcyBub3QgYSBzdXBwb3J0ZWQgbGFuZ3VhZ2UnLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2dlbmVyYXRlU3RhY2sgdGhyb3dzIGVycm9yIGZvciBpbnZhbGlkIHJlc291cmNlIHByb3BlcnR5JywgKCkgPT4ge1xuICAgIGV4cGVjdCgoKSA9PiBnZW5lcmF0ZVN0YWNrKGludmFsaWRUZW1wbGF0ZSwgJ1ZlcnlCYWQnLCAndHlwZXNjcmlwdCcpKS50b1Rocm93KFxuICAgICAgJ1ZlcnlCYWRTdGFjayBjb3VsZCBub3QgYmUgZ2VuZXJhdGVkIGJlY2F1c2UgUmVhZEVuZHBvaW50IGlzIG5vdCBhIHZhbGlkIHByb3BlcnR5IGZvciByZXNvdXJjZSBSRFNDbHVzdGVyIG9mIHR5cGUgQVdTOjpSRFM6OkRCQ2x1c3RlcicsXG4gICAgKTtcbiAgfSk7XG5cbiAgY2xpVGVzdCgnZ2VuZXJhdGVDZGtBcHAgZ2VuZXJhdGVzIHRoZSBleHBlY3RlZCBjZGsgYXBwIHdoZW4gY2FsbGVkIGZvciB0eXBlc2NyaXB0JywgYXN5bmMgKHdvcmtEaXIpID0+IHtcbiAgICBjb25zdCBzdGFjayA9IGdlbmVyYXRlU3RhY2sodmFsaWRUZW1wbGF0ZSwgJ0dvb2RUeXBlU2NyaXB0JywgJ3R5cGVzY3JpcHQnKTtcbiAgICBhd2FpdCBnZW5lcmF0ZUNka0FwcCgnR29vZFR5cGVTY3JpcHQnLCBzdGFjaywgJ3R5cGVzY3JpcHQnLCB3b3JrRGlyKTtcblxuICAgIC8vIFBhY2thZ2VzIGV4aXN0IGluIHRoZSBjb3JyZWN0IHNwb3RcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kVHlwZVNjcmlwdCcsICdwYWNrYWdlLmpzb24nKSkpLnRvQmVUcnV0aHkoKTtcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kVHlwZVNjcmlwdCcsICdiaW4nLCAnZ29vZF90eXBlX3NjcmlwdC50cycpKSkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RUeXBlU2NyaXB0JywgJ2xpYicsICdnb29kX3R5cGVfc2NyaXB0LXN0YWNrLnRzJykpKS50b0JlVHJ1dGh5KCk7XG5cbiAgICAvLyBSZXBsYWNlZCBzdGFjayBmaWxlIGlzIHJlZmVyZW5jZWQgY29ycmVjdGx5IGluIGFwcCBmaWxlXG4gICAgY29uc3QgYXBwID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbih3b3JrRGlyLCAnR29vZFR5cGVTY3JpcHQnLCAnYmluJywgJ2dvb2RfdHlwZV9zY3JpcHQudHMnKSwgJ3V0ZjgnKS5zcGxpdCgnXFxuJyk7XG4gICAgZXhwZWN0KFxuICAgICAgYXBwXG4gICAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUubWF0Y2goXCJpbXBvcnQgeyBHb29kVHlwZVNjcmlwdFN0YWNrIH0gZnJvbSAnLi4vbGliL2dvb2RfdHlwZV9zY3JpcHQtc3RhY2snO1wiKSlcbiAgICAgICAgLmZpbHRlcigobGluZSkgPT4gbGluZSkubGVuZ3RoLFxuICAgICkudG9FcXVhbCgxKTtcbiAgICBleHBlY3QoXG4gICAgICBhcHAubWFwKChsaW5lKSA9PiBsaW5lLm1hdGNoKC9uZXcgR29vZFR5cGVTY3JpcHRTdGFja1xcKGFwcCwgXFwnR29vZFR5cGVTY3JpcHRcXCcsIFxcey8pKS5maWx0ZXIoKGxpbmUpID0+IGxpbmUpXG4gICAgICAgIC5sZW5ndGgsXG4gICAgKS50b0VxdWFsKDEpO1xuXG4gICAgLy8gUmVwbGFjZWQgc3RhY2sgZmlsZSBpcyBjb3JyZWN0bHkgZ2VuZXJhdGVkXG4gICAgY29uc3QgcmVwbGFjZWRTdGFjayA9IGZzLnJlYWRGaWxlU3luYyhcbiAgICAgIHBhdGguam9pbih3b3JrRGlyLCAnR29vZFR5cGVTY3JpcHQnLCAnbGliJywgJ2dvb2RfdHlwZV9zY3JpcHQtc3RhY2sudHMnKSxcbiAgICAgICd1dGY4JyxcbiAgICApO1xuICAgIGV4cGVjdChyZXBsYWNlZFN0YWNrKS50b0VxdWFsKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oLi4uc3RhY2tQYXRoLCAnczMtc3RhY2sudHMnKSwgJ3V0ZjgnKSk7XG4gIH0pO1xuXG4gIGNsaVRlc3QoJ2dlbmVyYXRlQ2RrQXBwIGFkZHMgY2RrLW1pZ3JhdGUga2V5IGluIGNvbnRleHQnLCBhc3luYyAod29ya0RpcikgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZFR5cGVTY3JpcHQnLCAndHlwZXNjcmlwdCcpO1xuICAgIGF3YWl0IGdlbmVyYXRlQ2RrQXBwKCdHb29kVHlwZVNjcmlwdCcsIHN0YWNrLCAndHlwZXNjcmlwdCcsIHdvcmtEaXIpO1xuXG4gICAgLy8gY2RrLmpzb24gZXhpc3QgaW4gdGhlIGNvcnJlY3Qgc3BvdFxuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RUeXBlU2NyaXB0JywgJ2Nkay5qc29uJykpKS50b0JlVHJ1dGh5KCk7XG5cbiAgICAvLyBjZGsuanNvbiBoYXMgXCJjZGstbWlncmF0ZVwiIDogdHJ1ZSBpbiBjb250ZXh0XG4gICAgY29uc3QgY2RrSnNvbiA9IGZzLnJlYWRKc29uU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RUeXBlU2NyaXB0JywgJ2Nkay5qc29uJyksICd1dGY4Jyk7XG4gICAgZXhwZWN0KGNka0pzb24uY29udGV4dFsnY2RrLW1pZ3JhdGUnXSkudG9CZVRydXRoeSgpO1xuICB9KTtcblxuICBjbGlUZXN0KCdnZW5lcmF0ZUNka0FwcCBnZW5lcmF0ZXMgdGhlIGV4cGVjdGVkIGNkayBhcHAgd2hlbiBjYWxsZWQgZm9yIHB5dGhvbicsIGFzeW5jICh3b3JrRGlyKSA9PiB7XG4gICAgY29uc3Qgc3RhY2sgPSBnZW5lcmF0ZVN0YWNrKHZhbGlkVGVtcGxhdGUsICdHb29kUHl0aG9uJywgJ3B5dGhvbicpO1xuICAgIGF3YWl0IGdlbmVyYXRlQ2RrQXBwKCdHb29kUHl0aG9uJywgc3RhY2ssICdweXRob24nLCB3b3JrRGlyKTtcblxuICAgIC8vIFBhY2thZ2VzIGV4aXN0IGluIHRoZSBjb3JyZWN0IHNwb3RcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kUHl0aG9uJywgJ3JlcXVpcmVtZW50cy50eHQnKSkpLnRvQmVUcnV0aHkoKTtcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kUHl0aG9uJywgJ2FwcC5weScpKSkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RQeXRob24nLCAnZ29vZF9weXRob24nLCAnZ29vZF9weXRob25fc3RhY2sucHknKSkpLnRvQmVUcnV0aHkoKTtcblxuICAgIC8vIFJlcGxhY2VkIHN0YWNrIGZpbGUgaXMgcmVmZXJlbmNlZCBjb3JyZWN0bHkgaW4gYXBwIGZpbGVcbiAgICBjb25zdCBhcHAgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kUHl0aG9uJywgJ2FwcC5weScpLCAndXRmOCcpLnNwbGl0KCdcXG4nKTtcbiAgICBleHBlY3QoXG4gICAgICBhcHAubWFwKChsaW5lKSA9PiBsaW5lLm1hdGNoKCdmcm9tIGdvb2RfcHl0aG9uLmdvb2RfcHl0aG9uX3N0YWNrIGltcG9ydCBHb29kUHl0aG9uU3RhY2snKSkuZmlsdGVyKChsaW5lKSA9PiBsaW5lKVxuICAgICAgICAubGVuZ3RoLFxuICAgICkudG9FcXVhbCgxKTtcbiAgICBleHBlY3QoYXBwLm1hcCgobGluZSkgPT4gbGluZS5tYXRjaCgvR29vZFB5dGhvblN0YWNrXFwoYXBwLCBcIkdvb2RQeXRob25cIiwvKSkuZmlsdGVyKChsaW5lKSA9PiBsaW5lKS5sZW5ndGgpLnRvRXF1YWwoXG4gICAgICAxLFxuICAgICk7XG5cbiAgICAvLyBSZXBsYWNlZCBzdGFjayBmaWxlIGlzIGNvcnJlY3RseSBnZW5lcmF0ZWRcbiAgICBjb25zdCByZXBsYWNlZFN0YWNrID0gZnMucmVhZEZpbGVTeW5jKFxuICAgICAgcGF0aC5qb2luKHdvcmtEaXIsICdHb29kUHl0aG9uJywgJ2dvb2RfcHl0aG9uJywgJ2dvb2RfcHl0aG9uX3N0YWNrLnB5JyksXG4gICAgICAndXRmOCcsXG4gICAgKTtcbiAgICBleHBlY3QocmVwbGFjZWRTdGFjaykudG9FcXVhbChmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKC4uLnN0YWNrUGF0aCwgJ3MzX3N0YWNrLnB5JyksICd1dGY4JykpO1xuICB9KTtcblxuICBjbGlUZXN0KCdnZW5lcmF0ZUNka0FwcCBnZW5lcmF0ZXMgdGhlIGV4cGVjdGVkIGNkayBhcHAgd2hlbiBjYWxsZWQgZm9yIGphdmEnLCBhc3luYyAod29ya0RpcikgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZEphdmEnLCAnamF2YScpO1xuICAgIGF3YWl0IGdlbmVyYXRlQ2RrQXBwKCdHb29kSmF2YScsIHN0YWNrLCAnamF2YScsIHdvcmtEaXIpO1xuXG4gICAgLy8gUGFja2FnZXMgZXhpc3QgaW4gdGhlIGNvcnJlY3Qgc3BvdFxuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RKYXZhJywgJ3BvbS54bWwnKSkpLnRvQmVUcnV0aHkoKTtcbiAgICBleHBlY3QoXG4gICAgICBmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RKYXZhJywgJ3NyYycsICdtYWluJywgJ2phdmEnLCAnY29tJywgJ215b3JnJywgJ0dvb2RKYXZhQXBwLmphdmEnKSksXG4gICAgKS50b0JlVHJ1dGh5KCk7XG4gICAgZXhwZWN0KFxuICAgICAgZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kSmF2YScsICdzcmMnLCAnbWFpbicsICdqYXZhJywgJ2NvbScsICdteW9yZycsICdHb29kSmF2YVN0YWNrLmphdmEnKSksXG4gICAgKS50b0JlVHJ1dGh5KCk7XG5cbiAgICAvLyBSZXBsYWNlZCBzdGFjayBmaWxlIGlzIHJlZmVyZW5jZWQgY29ycmVjdGx5IGluIGFwcCBmaWxlXG4gICAgY29uc3QgYXBwID0gZnNcbiAgICAgIC5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kSmF2YScsICdzcmMnLCAnbWFpbicsICdqYXZhJywgJ2NvbScsICdteW9yZycsICdHb29kSmF2YUFwcC5qYXZhJyksICd1dGY4JylcbiAgICAgIC5zcGxpdCgnXFxuJyk7XG4gICAgZXhwZWN0KGFwcC5tYXAoKGxpbmUpID0+IGxpbmUubWF0Y2goJ3B1YmxpYyBjbGFzcyBHb29kSmF2YUFwcCB7JykpLmZpbHRlcigobGluZSkgPT4gbGluZSkubGVuZ3RoKS50b0VxdWFsKDEpO1xuICAgIGV4cGVjdChcbiAgICAgIGFwcFxuICAgICAgICAubWFwKChsaW5lKSA9PiBsaW5lLm1hdGNoKC8gICAgICAgIG5ldyBHb29kSmF2YVN0YWNrXFwoYXBwLCBcIkdvb2RKYXZhXCIsIFN0YWNrUHJvcHMuYnVpbGRlcigpLykpXG4gICAgICAgIC5maWx0ZXIoKGxpbmUpID0+IGxpbmUpLmxlbmd0aCxcbiAgICApLnRvRXF1YWwoMSk7XG5cbiAgICAvLyBSZXBsYWNlZCBzdGFjayBmaWxlIGlzIGNvcnJlY3RseSBnZW5lcmF0ZWRcbiAgICBjb25zdCByZXBsYWNlZFN0YWNrID0gZnMucmVhZEZpbGVTeW5jKFxuICAgICAgcGF0aC5qb2luKHdvcmtEaXIsICdHb29kSmF2YScsICdzcmMnLCAnbWFpbicsICdqYXZhJywgJ2NvbScsICdteW9yZycsICdHb29kSmF2YVN0YWNrLmphdmEnKSxcbiAgICAgICd1dGY4JyxcbiAgICApO1xuICAgIGV4cGVjdChyZXBsYWNlZFN0YWNrKS50b0VxdWFsKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oLi4uc3RhY2tQYXRoLCAnUzNTdGFjay5qYXZhJyksICd1dGY4JykpO1xuICB9KTtcblxuICBjbGlUZXN0KCdnZW5lcmF0ZUNka0FwcCBnZW5lcmF0ZXMgdGhlIGV4cGVjdGVkIGNkayBhcHAgd2hlbiBjYWxsZWQgZm9yIGNzaGFycCcsIGFzeW5jICh3b3JrRGlyKSA9PiB7XG4gICAgY29uc3Qgc3RhY2sgPSBnZW5lcmF0ZVN0YWNrKHZhbGlkVGVtcGxhdGUsICdHb29kQ1NoYXJwJywgJ2NzaGFycCcpO1xuICAgIGF3YWl0IGdlbmVyYXRlQ2RrQXBwKCdHb29kQ1NoYXJwJywgc3RhY2ssICdjc2hhcnAnLCB3b3JrRGlyKTtcblxuICAgIC8vIFBhY2thZ2VzIGV4aXN0IGluIHRoZSBjb3JyZWN0IHNwb3RcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kQ1NoYXJwJywgJ3NyYycsICdHb29kQ1NoYXJwLnNsbicpKSkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RDU2hhcnAnLCAnc3JjJywgJ0dvb2RDU2hhcnAnLCAnUHJvZ3JhbS5jcycpKSkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RDU2hhcnAnLCAnc3JjJywgJ0dvb2RDU2hhcnAnLCAnR29vZENTaGFycFN0YWNrLmNzJykpKS50b0JlVHJ1dGh5KCk7XG5cbiAgICAvLyBSZXBsYWNlZCBzdGFjayBmaWxlIGlzIHJlZmVyZW5jZWQgY29ycmVjdGx5IGluIGFwcCBmaWxlXG4gICAgY29uc3QgYXBwID0gZnNcbiAgICAgIC5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kQ1NoYXJwJywgJ3NyYycsICdHb29kQ1NoYXJwJywgJ1Byb2dyYW0uY3MnKSwgJ3V0ZjgnKVxuICAgICAgLnNwbGl0KCdcXG4nKTtcbiAgICBleHBlY3QoYXBwLm1hcCgobGluZSkgPT4gbGluZS5tYXRjaCgnbmFtZXNwYWNlIEdvb2RDU2hhcnAnKSkuZmlsdGVyKChsaW5lKSA9PiBsaW5lKS5sZW5ndGgpLnRvRXF1YWwoMSk7XG4gICAgZXhwZWN0KFxuICAgICAgYXBwXG4gICAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUubWF0Y2goLyAgICAgICAgbmV3IEdvb2RDU2hhcnBTdGFja1xcKGFwcCwgXCJHb29kQ1NoYXJwXCIsIG5ldyBHb29kQ1NoYXJwU3RhY2tQcm9wcy8pKVxuICAgICAgICAuZmlsdGVyKChsaW5lKSA9PiBsaW5lKS5sZW5ndGgsXG4gICAgKS50b0VxdWFsKDEpO1xuXG4gICAgLy8gUmVwbGFjZWQgc3RhY2sgZmlsZSBpcyBjb3JyZWN0bHkgZ2VuZXJhdGVkXG4gICAgY29uc3QgcmVwbGFjZWRTdGFjayA9IGZzLnJlYWRGaWxlU3luYyhcbiAgICAgIHBhdGguam9pbih3b3JrRGlyLCAnR29vZENTaGFycCcsICdzcmMnLCAnR29vZENTaGFycCcsICdHb29kQ1NoYXJwU3RhY2suY3MnKSxcbiAgICAgICd1dGY4JyxcbiAgICApO1xuICAgIGV4cGVjdChyZXBsYWNlZFN0YWNrKS50b0VxdWFsKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oLi4uc3RhY2tQYXRoLCAnUzNTdGFjay5jcycpLCAndXRmOCcpKTtcbiAgfSk7XG5cbiAgY2xpVGVzdCgnZ2VuZXJhdGVkQ2RrQXBwIGdlbmVyYXRlcyB0aGUgZXhwZWN0ZWQgY2RrIGFwcCB3aGVuIGNhbGxlZCBmb3IgZ28nLCBhc3luYyAod29ya0RpcikgPT4ge1xuICAgIGNvbnN0IHN0YWNrID0gZ2VuZXJhdGVTdGFjayh2YWxpZFRlbXBsYXRlLCAnR29vZEdvJywgJ2dvJyk7XG4gICAgYXdhaXQgZ2VuZXJhdGVDZGtBcHAoJ0dvb2RHbycsIHN0YWNrLCAnZ28nLCB3b3JrRGlyKTtcblxuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzKHBhdGguam9pbih3b3JrRGlyLCAnczMuZ28nKSkpLnRvQmVUcnV0aHkoKTtcbiAgICBjb25zdCBhcHAgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kR28nLCAnZ29vZF9nby5nbycpLCAndXRmOCcpLnNwbGl0KCdcXG4nKTtcbiAgICBleHBlY3QoXG4gICAgICBhcHBcbiAgICAgICAgLm1hcCgobGluZSkgPT5cbiAgICAgICAgICBsaW5lLm1hdGNoKFxuICAgICAgICAgICAgL2Z1bmMgTmV3R29vZEdvU3RhY2tcXChzY29wZSBjb25zdHJ1Y3RzLkNvbnN0cnVjdCwgaWQgc3RyaW5nLCBwcm9wcyBcXCpHb29kR29TdGFja1Byb3BzXFwpIFxcKkdvb2RHb1N0YWNrIFxcey8sXG4gICAgICAgICAgKSxcbiAgICAgICAgKVxuICAgICAgICAuZmlsdGVyKChsaW5lKSA9PiBsaW5lKS5sZW5ndGgsXG4gICAgKS50b0VxdWFsKDEpO1xuICAgIGV4cGVjdChhcHAubWFwKChsaW5lKSA9PiBsaW5lLm1hdGNoKC8gICAgTmV3R29vZEdvU3RhY2tcXChhcHAsIFwiR29vZEdvXCIsICZHb29kR29TdGFja1Byb3BzXFx7LykpKTtcbiAgfSk7XG5cbiAgY2xpVGVzdCgnZ2VuZXJhdGVkQ2RrQXBwIGdlbmVyYXRlcyBhIHppcCBmaWxlIHdoZW4gLS1jb21wcmVzcyBpcyB1c2VkJywgYXN5bmMgKHdvcmtEaXIpID0+IHtcbiAgICBjb25zdCBzdGFjayA9IGdlbmVyYXRlU3RhY2sodmFsaWRUZW1wbGF0ZSwgJ0dvb2RUeXBlU2NyaXB0JywgJ3R5cGVzY3JpcHQnKTtcbiAgICBhd2FpdCBnZW5lcmF0ZUNka0FwcCgnR29vZFR5cGVTY3JpcHQnLCBzdGFjaywgJ3R5cGVzY3JpcHQnLCB3b3JrRGlyLCB0cnVlKTtcblxuICAgIC8vIFBhY2thZ2VzIG5vdCBpbiBvdXREaXJcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kVHlwZVNjcmlwdCcsICdwYWNrYWdlLmpzb24nKSkpLnRvQmVGYWxzeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RUeXBlU2NyaXB0JywgJ2JpbicsICdnb29kX3R5cGVfc2NyaXB0LnRzJykpKS50b0JlRmFsc3koKTtcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kVHlwZVNjcmlwdCcsICdsaWInLCAnZ29vZF90eXBlX3NjcmlwdC1zdGFjay50cycpKSkudG9CZUZhbHN5KCk7XG5cbiAgICAvLyBaaXAgZmlsZSBleGlzdHNcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdHb29kVHlwZVNjcmlwdC56aXAnKSkpLnRvQmVUcnV0aHkoKTtcblxuICAgIC8vIFVuemlwIGl0XG4gICAgYXdhaXQgZXhlYyhgdW56aXAgJHtwYXRoLmpvaW4od29ya0RpciwgJ0dvb2RUeXBlU2NyaXB0LnppcCcpfWAsIHsgY3dkOiB3b3JrRGlyIH0pO1xuXG4gICAgLy8gTm93IHRoZSBmaWxlcyBzaG91bGQgYmUgdGhlcmVcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdwYWNrYWdlLmpzb24nKSkpLnRvQmVUcnV0aHkoKTtcbiAgICBleHBlY3QoZnMucGF0aEV4aXN0c1N5bmMocGF0aC5qb2luKHdvcmtEaXIsICdiaW4nLCAnZ29vZF90eXBlX3NjcmlwdC50cycpKSkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChmcy5wYXRoRXhpc3RzU3luYyhwYXRoLmpvaW4od29ya0RpciwgJ2xpYicsICdnb29kX3R5cGVfc2NyaXB0LXN0YWNrLnRzJykpKS50b0JlVHJ1dGh5KCk7XG4gIH0pO1xufSk7XG5cbmZ1bmN0aW9uIGNsaVRlc3QobmFtZTogc3RyaW5nLCBoYW5kbGVyOiAoZGlyOiBzdHJpbmcpID0+IHZvaWQgfCBQcm9taXNlPGFueT4pOiB2b2lkIHtcbiAgdGVzdChuYW1lLCAoKSA9PiB3aXRoVGVtcERpcihoYW5kbGVyKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdpdGhUZW1wRGlyKGNiOiAoZGlyOiBzdHJpbmcpID0+IHZvaWQgfCBQcm9taXNlPGFueT4pIHtcbiAgY29uc3QgdG1wRGlyID0gYXdhaXQgZnMubWtkdGVtcChwYXRoLmpvaW4ob3MudG1wZGlyKCksICdhd3MtY2RrLXRlc3QnKSk7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2IodG1wRGlyKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBhd2FpdCBmcy5yZW1vdmUodG1wRGlyKTtcbiAgfVxufVxuXG5kZXNjcmliZSgnZ2VuZXJhdGVUZW1wbGF0ZScsICgpID0+IHtcbiAgbGV0IHNka1Byb3ZpZGVyOiBNb2NrU2RrUHJvdmlkZXI7XG4gIGNvbnN0IHNhbXBsZVJlc291cmNlID0ge1xuICAgIFJlc291cmNlVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgTWFuYWdlZEJ5U3RhY2s6IHRydWUsXG4gICAgUmVzb3VyY2VJZGVudGlmaWVyOiB7ICdteS1rZXknOiAnbXktYnVja2V0JyB9LFxuICAgIExvZ2ljYWxSZXNvdXJjZUlkOiAnbXktYnVja2V0JyxcbiAgfTtcbiAgY29uc3Qgc2FtcGxlUmVzb3VyY2UyID0ge1xuICAgIFJlc291cmNlVHlwZTogJ0FXUzo6RUMyOjpJbnN0YW5jZScsXG4gICAgUmVzb3VyY2VJZGVudGlmaWVyOiB7XG4gICAgICBpbnN0YW5jZUlkOiAnaS0xMjM0NTY3ODkwYWJjZGVmMCcsXG4gICAgfSxcbiAgICBMb2dpY2FsUmVzb3VyY2VJZDogJ215LWVjMi1pbnN0YW5jZScsXG4gICAgTWFuYWdlZEJ5U3RhY2s6IHRydWUsXG4gIH07XG4gIGNvbnN0IHN0YWNrTmFtZSA9ICdteS1zdGFjayc7XG4gIGNvbnN0IGVudmlyb25tZW50ID0gc2V0RW52aXJvbm1lbnQoJzEyMzQ1Njc4OTAxMicsICd1cy1lYXN0LTEnKTtcbiAgY29uc3Qgc2NhbklkID0gJ2Zha2Utc2Nhbi1pZCc7XG4gIGNvbnN0IGRlZmF1bHRFeHBlY3RlZFJlc3VsdCA9IHtcbiAgICBtaWdyYXRlSnNvbjoge1xuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBMb2dpY2FsUmVzb3VyY2VJZDogJ215LWJ1Y2tldCcsXG4gICAgICAgICAgUmVzb3VyY2VJZGVudGlmaWVyOiB7ICdteS1rZXknOiAnbXktYnVja2V0JyB9LFxuICAgICAgICAgIFJlc291cmNlVHlwZTogJ0FXUzo6UzM6OkJ1Y2tldCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBMb2dpY2FsUmVzb3VyY2VJZDogJ215LWVjMi1pbnN0YW5jZScsXG4gICAgICAgICAgUmVzb3VyY2VJZGVudGlmaWVyOiB7IGluc3RhbmNlSWQ6ICdpLTEyMzQ1Njc4OTBhYmNkZWYwJyB9LFxuICAgICAgICAgIFJlc291cmNlVHlwZTogJ0FXUzo6RUMyOjpJbnN0YW5jZScsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgc291cmNlOiAndGVtcGxhdGUtYXJuJyxcbiAgICAgIHRlbXBsYXRlQm9keTogJ3RlbXBsYXRlLWJvZHknLFxuICAgIH0sXG4gICAgcmVzb3VyY2VzOiBbXG4gICAgICB7XG4gICAgICAgIExvZ2ljYWxSZXNvdXJjZUlkOiAnbXktYnVja2V0JyxcbiAgICAgICAgTWFuYWdlZEJ5U3RhY2s6IHRydWUsXG4gICAgICAgIFJlc291cmNlSWRlbnRpZmllcjoge1xuICAgICAgICAgICdteS1rZXknOiAnbXktYnVja2V0JyxcbiAgICAgICAgfSxcbiAgICAgICAgUmVzb3VyY2VUeXBlOiAnQVdTOjpTMzo6QnVja2V0JyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIExvZ2ljYWxSZXNvdXJjZUlkOiAnbXktZWMyLWluc3RhbmNlJyxcbiAgICAgICAgTWFuYWdlZEJ5U3RhY2s6IHRydWUsXG4gICAgICAgIFJlc291cmNlSWRlbnRpZmllcjoge1xuICAgICAgICAgIGluc3RhbmNlSWQ6ICdpLTEyMzQ1Njc4OTBhYmNkZWYwJyxcbiAgICAgICAgfSxcbiAgICAgICAgUmVzb3VyY2VUeXBlOiAnQVdTOjpFQzI6Okluc3RhbmNlJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfTtcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgICBzZGtQcm92aWRlciA9IG5ldyBNb2NrU2RrUHJvdmlkZXIoKTtcbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAgIC5vbihTdGFydFJlc291cmNlU2NhbkNvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBSZXNvdXJjZVNjYW5JZDogc2NhbklkLFxuICAgICAgfSlcbiAgICAgIC5vbihMaXN0UmVzb3VyY2VTY2Fuc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBSZXNvdXJjZVNjYW5TdW1tYXJpZXM6IFtcbiAgICAgICAgICB7IFJlc291cmNlU2NhbklkOiBzY2FuSWQsIFN0YXR1czogUmVzb3VyY2VTY2FuU3RhdHVzLkNPTVBMRVRFLCBQZXJjZW50YWdlQ29tcGxldGVkOiAxMDAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVSZXNvdXJjZVNjYW5Db21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgU3RhdHVzOiAnQ09NUExFVEUnLFxuICAgICAgfSlcbiAgICAgIC5vbihMaXN0UmVzb3VyY2VTY2FuUmVzb3VyY2VzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFJlc291cmNlczogW3NhbXBsZVJlc291cmNlMl0sXG4gICAgICB9KVxuICAgICAgLm9uKENyZWF0ZUdlbmVyYXRlZFRlbXBsYXRlQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIEdlbmVyYXRlZFRlbXBsYXRlSWQ6ICd0ZW1wbGF0ZS1hcm4nLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZUdlbmVyYXRlZFRlbXBsYXRlQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFN0YXR1czogJ0NPTVBMRVRFJyxcbiAgICAgICAgUmVzb3VyY2VzOiBbc2FtcGxlUmVzb3VyY2UsIHNhbXBsZVJlc291cmNlMl0sXG4gICAgICB9KVxuICAgICAgLm9uKEdldEdlbmVyYXRlZFRlbXBsYXRlQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFRlbXBsYXRlQm9keTogJ3RlbXBsYXRlLWJvZHknLFxuICAgICAgfSlcbiAgICAgIC5vbihMaXN0UmVzb3VyY2VTY2FuUmVsYXRlZFJlc291cmNlc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBSZWxhdGVkUmVzb3VyY2VzOiBbc2FtcGxlUmVzb3VyY2VdLFxuICAgICAgfSk7XG4gIH0pO1xuXG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0KCk7XG4gIH0pO1xuXG4gIHRlc3QoJ2dlbmVyYXRlVGVtcGxhdGUgc3VjY2Vzc2Z1bGx5IGdlbmVyYXRlcyB0ZW1wbGF0ZSB3aXRoIGEgbmV3IHNjYW4nLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgb3B0czogR2VuZXJhdGVUZW1wbGF0ZU9wdGlvbnMgPSB7XG4gICAgICBzdGFja05hbWU6IHN0YWNrTmFtZSxcbiAgICAgIGZpbHRlcnM6IFtdLFxuICAgICAgZnJvbVNjYW46IEZyb21TY2FuLk5FVyxcbiAgICAgIHNka1Byb3ZpZGVyOiBzZGtQcm92aWRlcixcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9O1xuXG4gICAgY29uc3QgdGVtcGxhdGUgPSBhd2FpdCBnZW5lcmF0ZVRlbXBsYXRlKG9wdHMpO1xuICAgIGV4cGVjdCh0ZW1wbGF0ZSkudG9FcXVhbChkZWZhdWx0RXhwZWN0ZWRSZXN1bHQpO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVRlbXBsYXRlIHN1Y2Nlc3NmdWxseSBkZWZhdWx0cyB0byBsYXRlc3Qgc2NhbiBpbnN0ZWFkIG9mIHN0YXJ0aW5nIGEgbmV3IG9uZScsIGFzeW5jICgpID0+IHtcbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAgIC5vbihTdGFydFJlc291cmNlU2NhbkNvbW1hbmQpXG4gICAgICAucmVqZWN0cygnTm8gPjooJylcbiAgICAgIC5vbihMaXN0UmVzb3VyY2VTY2Fuc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgICAgUmVzb3VyY2VTY2FuU3VtbWFyaWVzOiBbeyBSZXNvdXJjZVNjYW5JZDogc2NhbklkLCBTdGF0dXM6ICdJTl9QUk9HUkVTUycsIFBlcmNlbnRhZ2VDb21wbGV0ZWQ6IDUwIH1dLFxuICAgICAgfSlcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFJlc291cmNlU2NhblN1bW1hcmllczogW3sgUmVzb3VyY2VTY2FuSWQ6IHNjYW5JZCwgU3RhdHVzOiAnQ09NUExFVEUnLCBQZXJjZW50YWdlQ29tcGxldGVkOiAxMDAgfV0sXG4gICAgICB9KTtcblxuICAgIGNvbnN0IG9wdHMgPSB7XG4gICAgICBzdGFja05hbWU6IHN0YWNrTmFtZSxcbiAgICAgIGZpbHRlcnM6IFtdLFxuICAgICAgbmV3U2NhbjogdHJ1ZSxcbiAgICAgIHNka1Byb3ZpZGVyOiBzZGtQcm92aWRlcixcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9O1xuICAgIGNvbnN0IHRlbXBsYXRlID0gYXdhaXQgZ2VuZXJhdGVUZW1wbGF0ZShvcHRzKTtcbiAgICBleHBlY3QodGVtcGxhdGUpLnRvRXF1YWwoZGVmYXVsdEV4cGVjdGVkUmVzdWx0KTtcbiAgfSk7XG5cbiAgdGVzdCgnZ2VuZXJhdGVUZW1wbGF0ZSB0aHJvd3MgYW4gZXJyb3Igd2hlbiBmcm9tLXNjYW4gbW9zdC1yZWNlbnQgaXMgcGFzc2VkIGJ1dCBubyBzY2FucyBhcmUgZm91bmQuJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihMaXN0UmVzb3VyY2VTY2Fuc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBSZXNvdXJjZVNjYW5TdW1tYXJpZXM6IFtdLFxuICAgICAgfSk7XG5cbiAgICBjb25zdCBvcHRzOiBHZW5lcmF0ZVRlbXBsYXRlT3B0aW9ucyA9IHtcbiAgICAgIHN0YWNrTmFtZTogc3RhY2tOYW1lLFxuICAgICAgZmlsdGVyczogW10sXG4gICAgICBmcm9tU2NhbjogRnJvbVNjYW4uTU9TVF9SRUNFTlQsXG4gICAgICBzZGtQcm92aWRlcjogc2RrUHJvdmlkZXIsXG4gICAgICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gICAgfTtcbiAgICBhd2FpdCBleHBlY3QoZ2VuZXJhdGVUZW1wbGF0ZShvcHRzKSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgJ05vIHNjYW5zIGZvdW5kLiBQbGVhc2UgZWl0aGVyIHN0YXJ0IGEgbmV3IHNjYW4gd2l0aCB0aGUgYC0tZnJvbS1zY2FuYCBuZXcgb3IgZG8gbm90IHNwZWNpZnkgYSBgLS1mcm9tLXNjYW5gIG9wdGlvbi4nLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2dlbmVyYXRlVGVtcGxhdGUgdGhyb3dzIGFuIGVycm9yIHdoZW4gYW4gaW52YWxpZCBrZXkgaXMgcGFzc2VkIGluIHRoZSBmaWx0ZXJzJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG9wdHM6IEdlbmVyYXRlVGVtcGxhdGVPcHRpb25zID0ge1xuICAgICAgc3RhY2tOYW1lOiBzdGFja05hbWUsXG4gICAgICBmaWx0ZXJzOiBbJ2ludmFsaWQta2V5PWludmFsaWQtdmFsdWUnXSxcbiAgICAgIGZyb21TY2FuOiBGcm9tU2Nhbi5NT1NUX1JFQ0VOVCxcbiAgICAgIHNka1Byb3ZpZGVyOiBzZGtQcm92aWRlcixcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9O1xuICAgIGF3YWl0IGV4cGVjdChnZW5lcmF0ZVRlbXBsYXRlKG9wdHMpKS5yZWplY3RzLnRvVGhyb3coJ0ludmFsaWQgZmlsdGVyOiBpbnZhbGlkLWtleScpO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVRlbXBsYXRlIGRlZmF1bHRzIHRvIHN0YXJ0aW5nIGEgbmV3IHNjYW4gd2hlbiBubyBvcHRpb25zIGFyZSBwcm92aWRlZCBhbmQgbm8gc2NhbnMgYXJlIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihMaXN0UmVzb3VyY2VTY2Fuc0NvbW1hbmQpXG4gICAgICAvLyBGaXJzdCBjYWxsOiBsaXN0IGN1cnJlbnQgc2NhbnMsIHRoZXJlIGFyZW4ndCBhbnkuXG4gICAgICAucmVzb2x2ZXNPbmNlKHsgUmVzb3VyY2VTY2FuU3VtbWFyaWVzOiBbXSB9KVxuICAgICAgLy8gVGhlIGdlbmVyYXRvciB3aWxsIHRoZW4gY2FsbCBTdGFydFNjYW4gYW5kIExpc3RSZXNvdXJjZVNjYW5zIGFnYWluIHdoaWNoIGl0IG5vdyB3aWxsIGV4cGVjdCB0byByZXR1cm4gc29tZXRoaW5nXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBSZXNvdXJjZVNjYW5TdW1tYXJpZXM6IFt7IFJlc291cmNlU2NhbklkOiBzY2FuSWQsIFN0YXR1czogJ0NPTVBMRVRFJywgUGVyY2VudGFnZUNvbXBsZXRlZDogMTAwIH1dLFxuICAgICAgfSk7XG5cbiAgICBjb25zdCBvcHRzOiBHZW5lcmF0ZVRlbXBsYXRlT3B0aW9ucyA9IHtcbiAgICAgIHN0YWNrTmFtZTogc3RhY2tOYW1lLFxuICAgICAgc2RrUHJvdmlkZXI6IHNka1Byb3ZpZGVyLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH07XG4gICAgY29uc3QgdGVtcGxhdGUgPSBhd2FpdCBnZW5lcmF0ZVRlbXBsYXRlKG9wdHMpO1xuICAgIGV4cGVjdCh0ZW1wbGF0ZSkudG9FcXVhbChkZWZhdWx0RXhwZWN0ZWRSZXN1bHQpO1xuICAgIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZChTdGFydFJlc291cmNlU2NhbkNvbW1hbmQpO1xuICB9KTtcblxuICB0ZXN0KCdnZW5lcmF0ZVRlbXBsYXRlIHN1Y2Nlc3NmdWxseSBnZW5lcmF0ZXMgdGVtcGxhdGVzIHdpdGggdmFsaWQgZmlsdGVyIG9wdGlvbnMnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgb3B0czogR2VuZXJhdGVUZW1wbGF0ZU9wdGlvbnMgPSB7XG4gICAgICBzdGFja05hbWU6IHN0YWNrTmFtZSxcbiAgICAgIGZpbHRlcnM6IFsndHlwZT1BV1M6OlMzOjpCdWNrZXQsaWRlbnRpZmllcj17XCJteS1rZXlcIjpcIm15LWJ1Y2tldFwifScsICd0eXBlPUFXUzo6RUMyOjpJbnN0YW5jZSddLFxuICAgICAgc2RrUHJvdmlkZXI6IHNka1Byb3ZpZGVyLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH07XG4gICAgY29uc3QgdGVtcGxhdGUgPSBhd2FpdCBnZW5lcmF0ZVRlbXBsYXRlKG9wdHMpO1xuICAgIGV4cGVjdCh0ZW1wbGF0ZSkudG9FcXVhbChkZWZhdWx0RXhwZWN0ZWRSZXN1bHQpO1xuICB9KTtcbn0pO1xuIl19