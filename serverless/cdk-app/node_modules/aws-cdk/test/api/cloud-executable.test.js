"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable import/order */
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cloud_assembly_1 = require("../../lib/api/cxapp/cloud-assembly");
const context_providers_1 = require("../../lib/context-providers");
const util_1 = require("../util");
describe('AWS::CDK::Metadata', () => {
    test('is not generated for new frameworks', async () => {
        const cx = await testCloudExecutable({
            env: 'aws://012345678912/us-east-1',
            versionReporting: true,
            schemaVersion: '8.0.0',
        });
        const cxasm = await cx.synthesize();
        const result = cxasm.stackById('withouterrors').firstStack;
        const metadata = result.template.Resources && result.template.Resources.CDKMetadata;
        expect(metadata).toBeUndefined();
    });
});
test('stop executing if context providers are not making progress', async () => {
    (0, context_providers_1.registerContextProvider)(cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER, {
        async getValue(_) {
            return 'foo';
        },
    });
    const cloudExecutable = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'thestack',
                template: { resource: 'noerrorresource' },
            }],
        // Always return the same missing keys, synthesis should still finish.
        missing: [
            { key: 'abcdef', props: { account: '1324', region: 'us-east-1' }, provider: cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER },
        ],
    });
    const cxasm = await cloudExecutable.synthesize();
    // WHEN
    await cxasm.selectStacks({ patterns: ['thestack'] }, { defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks });
    // THEN: the test finishes normally});
});
test('fails if lookups are disabled and missing context is synthesized', async () => {
    // GIVEN
    const cloudExecutable = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'thestack',
                template: { resource: 'noerrorresource' },
            }],
        // Always return the same missing keys, synthesis should still finish.
        missing: [
            { key: 'abcdef', props: { account: '1324', region: 'us-east-1' }, provider: cxschema.ContextProvider.AVAILABILITY_ZONE_PROVIDER },
        ],
    });
    cloudExecutable.configuration.settings.set(['lookups'], false);
    // WHEN
    await expect(cloudExecutable.synthesize()).rejects.toThrow(/Context lookups have been disabled/);
});
async function testCloudExecutable({ env, versionReporting = true, schemaVersion } = {}) {
    const cloudExec = new util_1.MockCloudExecutable({
        stacks: [{
                stackName: 'withouterrors',
                env,
                template: { resource: 'noerrorresource' },
            },
            {
                stackName: 'witherrors',
                env,
                template: { resource: 'errorresource' },
                metadata: {
                    '/resource': [
                        {
                            type: cxschema.ArtifactMetadataEntryType.ERROR,
                            data: 'this is an error',
                        },
                    ],
                },
            }],
        schemaVersion,
    });
    cloudExec.configuration.settings.set(['versionReporting'], versionReporting);
    return cloudExec;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtZXhlY3V0YWJsZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xvdWQtZXhlY3V0YWJsZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsaUNBQWlDO0FBQ2pDLDJEQUEyRDtBQUMzRCx1RUFBc0U7QUFDdEUsbUVBQXNFO0FBQ3RFLGtDQUE4QztBQUU5QyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQ2xDLElBQUksQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNyRCxNQUFNLEVBQUUsR0FBRyxNQUFNLG1CQUFtQixDQUFDO1lBQ25DLEdBQUcsRUFBRSw4QkFBOEI7WUFDbkMsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixhQUFhLEVBQUUsT0FBTztTQUN2QixDQUFDLENBQUM7UUFDSCxNQUFNLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVwQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLFVBQVUsQ0FBQztRQUMzRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDcEYsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ25DLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDN0UsSUFBQSwyQ0FBdUIsRUFBQyxRQUFRLENBQUMsZUFBZSxDQUFDLDBCQUEwQixFQUFFO1FBQzNFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBeUI7WUFDdEMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztRQUM5QyxNQUFNLEVBQUUsQ0FBQztnQkFDUCxTQUFTLEVBQUUsVUFBVTtnQkFDckIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFO2FBQzFDLENBQUM7UUFDRixzRUFBc0U7UUFDdEUsT0FBTyxFQUFFO1lBQ1AsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLDBCQUEwQixFQUFFO1NBQ2xJO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUM7SUFFakQsT0FBTztJQUNQLE1BQU0sS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsaUNBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUV0RyxzQ0FBc0M7QUFDeEMsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsa0VBQWtFLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDbEYsUUFBUTtJQUNSLE1BQU0sZUFBZSxHQUFHLElBQUksMEJBQW1CLENBQUM7UUFDOUMsTUFBTSxFQUFFLENBQUM7Z0JBQ1AsU0FBUyxFQUFFLFVBQVU7Z0JBQ3JCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRTthQUMxQyxDQUFDO1FBQ0Ysc0VBQXNFO1FBQ3RFLE9BQU8sRUFBRTtZQUNQLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQywwQkFBMEIsRUFBRTtTQUNsSTtLQUNGLENBQUMsQ0FBQztJQUNILGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBRS9ELE9BQU87SUFDUCxNQUFNLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7QUFDbkcsQ0FBQyxDQUFDLENBQUM7QUFFSCxLQUFLLFVBQVUsbUJBQW1CLENBQ2hDLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixHQUFHLElBQUksRUFBRSxhQUFhLEtBQzBCLEVBQUU7SUFFekUsTUFBTSxTQUFTLEdBQUcsSUFBSSwwQkFBbUIsQ0FBQztRQUN4QyxNQUFNLEVBQUUsQ0FBQztnQkFDUCxTQUFTLEVBQUUsZUFBZTtnQkFDMUIsR0FBRztnQkFDSCxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUU7YUFDMUM7WUFDRDtnQkFDRSxTQUFTLEVBQUUsWUFBWTtnQkFDdkIsR0FBRztnQkFDSCxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFO2dCQUN2QyxRQUFRLEVBQUU7b0JBQ1IsV0FBVyxFQUFFO3dCQUNYOzRCQUNFLElBQUksRUFBRSxRQUFRLENBQUMseUJBQXlCLENBQUMsS0FBSzs0QkFDOUMsSUFBSSxFQUFFLGtCQUFrQjt5QkFDekI7cUJBQ0Y7aUJBQ0Y7YUFDRixDQUFDO1FBQ0YsYUFBYTtLQUNkLENBQUMsQ0FBQztJQUNILFNBQVMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUU3RSxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgaW1wb3J0L29yZGVyICovXG5pbXBvcnQgKiBhcyBjeHNjaGVtYSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0IHsgRGVmYXVsdFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uL2xpYi9hcGkvY3hhcHAvY2xvdWQtYXNzZW1ibHknO1xuaW1wb3J0IHsgcmVnaXN0ZXJDb250ZXh0UHJvdmlkZXIgfSBmcm9tICcuLi8uLi9saWIvY29udGV4dC1wcm92aWRlcnMnO1xuaW1wb3J0IHsgTW9ja0Nsb3VkRXhlY3V0YWJsZSB9IGZyb20gJy4uL3V0aWwnO1xuXG5kZXNjcmliZSgnQVdTOjpDREs6Ok1ldGFkYXRhJywgKCkgPT4ge1xuICB0ZXN0KCdpcyBub3QgZ2VuZXJhdGVkIGZvciBuZXcgZnJhbWV3b3JrcycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjeCA9IGF3YWl0IHRlc3RDbG91ZEV4ZWN1dGFibGUoe1xuICAgICAgZW52OiAnYXdzOi8vMDEyMzQ1Njc4OTEyL3VzLWVhc3QtMScsXG4gICAgICB2ZXJzaW9uUmVwb3J0aW5nOiB0cnVlLFxuICAgICAgc2NoZW1hVmVyc2lvbjogJzguMC4wJyxcbiAgICB9KTtcbiAgICBjb25zdCBjeGFzbSA9IGF3YWl0IGN4LnN5bnRoZXNpemUoKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGN4YXNtLnN0YWNrQnlJZCgnd2l0aG91dGVycm9ycycpLmZpcnN0U3RhY2s7XG4gICAgY29uc3QgbWV0YWRhdGEgPSByZXN1bHQudGVtcGxhdGUuUmVzb3VyY2VzICYmIHJlc3VsdC50ZW1wbGF0ZS5SZXNvdXJjZXMuQ0RLTWV0YWRhdGE7XG4gICAgZXhwZWN0KG1ldGFkYXRhKS50b0JlVW5kZWZpbmVkKCk7XG4gIH0pO1xufSk7XG5cbnRlc3QoJ3N0b3AgZXhlY3V0aW5nIGlmIGNvbnRleHQgcHJvdmlkZXJzIGFyZSBub3QgbWFraW5nIHByb2dyZXNzJywgYXN5bmMgKCkgPT4ge1xuICByZWdpc3RlckNvbnRleHRQcm92aWRlcihjeHNjaGVtYS5Db250ZXh0UHJvdmlkZXIuQVZBSUxBQklMSVRZX1pPTkVfUFJPVklERVIsIHtcbiAgICBhc3luYyBnZXRWYWx1ZShfOiB7IFtrZXk6IHN0cmluZ106IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgIHJldHVybiAnZm9vJztcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCBjbG91ZEV4ZWN1dGFibGUgPSBuZXcgTW9ja0Nsb3VkRXhlY3V0YWJsZSh7XG4gICAgc3RhY2tzOiBbe1xuICAgICAgc3RhY2tOYW1lOiAndGhlc3RhY2snLFxuICAgICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdub2Vycm9ycmVzb3VyY2UnIH0sXG4gICAgfV0sXG4gICAgLy8gQWx3YXlzIHJldHVybiB0aGUgc2FtZSBtaXNzaW5nIGtleXMsIHN5bnRoZXNpcyBzaG91bGQgc3RpbGwgZmluaXNoLlxuICAgIG1pc3Npbmc6IFtcbiAgICAgIHsga2V5OiAnYWJjZGVmJywgcHJvcHM6IHsgYWNjb3VudDogJzEzMjQnLCByZWdpb246ICd1cy1lYXN0LTEnIH0sIHByb3ZpZGVyOiBjeHNjaGVtYS5Db250ZXh0UHJvdmlkZXIuQVZBSUxBQklMSVRZX1pPTkVfUFJPVklERVIgfSxcbiAgICBdLFxuICB9KTtcbiAgY29uc3QgY3hhc20gPSBhd2FpdCBjbG91ZEV4ZWN1dGFibGUuc3ludGhlc2l6ZSgpO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgY3hhc20uc2VsZWN0U3RhY2tzKHsgcGF0dGVybnM6IFsndGhlc3RhY2snXSB9LCB7IGRlZmF1bHRCZWhhdmlvcjogRGVmYXVsdFNlbGVjdGlvbi5BbGxTdGFja3MgfSk7XG5cbiAgLy8gVEhFTjogdGhlIHRlc3QgZmluaXNoZXMgbm9ybWFsbHl9KTtcbn0pO1xuXG50ZXN0KCdmYWlscyBpZiBsb29rdXBzIGFyZSBkaXNhYmxlZCBhbmQgbWlzc2luZyBjb250ZXh0IGlzIHN5bnRoZXNpemVkJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBjbG91ZEV4ZWN1dGFibGUgPSBuZXcgTW9ja0Nsb3VkRXhlY3V0YWJsZSh7XG4gICAgc3RhY2tzOiBbe1xuICAgICAgc3RhY2tOYW1lOiAndGhlc3RhY2snLFxuICAgICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdub2Vycm9ycmVzb3VyY2UnIH0sXG4gICAgfV0sXG4gICAgLy8gQWx3YXlzIHJldHVybiB0aGUgc2FtZSBtaXNzaW5nIGtleXMsIHN5bnRoZXNpcyBzaG91bGQgc3RpbGwgZmluaXNoLlxuICAgIG1pc3Npbmc6IFtcbiAgICAgIHsga2V5OiAnYWJjZGVmJywgcHJvcHM6IHsgYWNjb3VudDogJzEzMjQnLCByZWdpb246ICd1cy1lYXN0LTEnIH0sIHByb3ZpZGVyOiBjeHNjaGVtYS5Db250ZXh0UHJvdmlkZXIuQVZBSUxBQklMSVRZX1pPTkVfUFJPVklERVIgfSxcbiAgICBdLFxuICB9KTtcbiAgY2xvdWRFeGVjdXRhYmxlLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsnbG9va3VwcyddLCBmYWxzZSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBleHBlY3QoY2xvdWRFeGVjdXRhYmxlLnN5bnRoZXNpemUoKSkucmVqZWN0cy50b1Rocm93KC9Db250ZXh0IGxvb2t1cHMgaGF2ZSBiZWVuIGRpc2FibGVkLyk7XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gdGVzdENsb3VkRXhlY3V0YWJsZShcbiAgeyBlbnYsIHZlcnNpb25SZXBvcnRpbmcgPSB0cnVlLCBzY2hlbWFWZXJzaW9uIH06XG4gIHsgZW52Pzogc3RyaW5nOyB2ZXJzaW9uUmVwb3J0aW5nPzogYm9vbGVhbjsgc2NoZW1hVmVyc2lvbj86IHN0cmluZyB9ID0ge30sXG4pIHtcbiAgY29uc3QgY2xvdWRFeGVjID0gbmV3IE1vY2tDbG91ZEV4ZWN1dGFibGUoe1xuICAgIHN0YWNrczogW3tcbiAgICAgIHN0YWNrTmFtZTogJ3dpdGhvdXRlcnJvcnMnLFxuICAgICAgZW52LFxuICAgICAgdGVtcGxhdGU6IHsgcmVzb3VyY2U6ICdub2Vycm9ycmVzb3VyY2UnIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBzdGFja05hbWU6ICd3aXRoZXJyb3JzJyxcbiAgICAgIGVudixcbiAgICAgIHRlbXBsYXRlOiB7IHJlc291cmNlOiAnZXJyb3JyZXNvdXJjZScgfSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICcvcmVzb3VyY2UnOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogY3hzY2hlbWEuQXJ0aWZhY3RNZXRhZGF0YUVudHJ5VHlwZS5FUlJPUixcbiAgICAgICAgICAgIGRhdGE6ICd0aGlzIGlzIGFuIGVycm9yJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9XSxcbiAgICBzY2hlbWFWZXJzaW9uLFxuICB9KTtcbiAgY2xvdWRFeGVjLmNvbmZpZ3VyYXRpb24uc2V0dGluZ3Muc2V0KFsndmVyc2lvblJlcG9ydGluZyddLCB2ZXJzaW9uUmVwb3J0aW5nKTtcblxuICByZXR1cm4gY2xvdWRFeGVjO1xufVxuIl19