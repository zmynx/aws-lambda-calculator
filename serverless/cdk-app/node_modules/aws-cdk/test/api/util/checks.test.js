"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const checks_1 = require("../../../lib/api/util/checks");
const mock_sdk_1 = require("../../util/mock-sdk");
describe('determineAllowCrossAccountAssetPublishing', () => {
    it('should return true when hasStagingBucket is false', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [{ OutputKey: 'BootstrapVersion', OutputValue: '1' }],
                }],
        });
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(true);
    });
    it.each(['', '-', '*', '---'])('should return true when the bucket output does not look like a real bucket', async (notABucketName) => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [
                        { OutputKey: 'BootstrapVersion', OutputValue: '1' },
                        { OutputKey: 'BucketName', OutputValue: notABucketName },
                    ],
                }],
        });
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(true);
    });
    it('should return true when bootstrap version is >= 21', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [
                        { OutputKey: 'BootstrapVersion', OutputValue: '21' },
                        { OutputKey: 'BucketName', OutputValue: 'some-bucket' },
                    ],
                }],
        });
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(true);
    });
    it('should return true if looking up the bootstrap stack fails', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).rejects(new Error('Could not read bootstrap stack'));
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(true);
    });
    it('should return true if looking up the bootstrap stack fails', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).rejects(new Error('Could not read bootstrap stack'));
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(true);
    });
    it('should return false for other scenarios', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [
                        { OutputKey: 'BootstrapVersion', OutputValue: '20' },
                        { OutputKey: 'BucketName', OutputValue: 'some-bucket' },
                    ],
                }],
        });
        const result = await (0, checks_1.determineAllowCrossAccountAssetPublishing)(mockSDK);
        expect(result).toBe(false);
    });
});
describe('getBootstrapStackInfo', () => {
    it('should return correct BootstrapStackInfo', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [
                        { OutputKey: 'BootstrapVersion', OutputValue: '21' },
                        { OutputKey: 'BucketName', OutputValue: 'some-bucket' },
                    ],
                }],
        });
        const result = await (0, checks_1.getBootstrapStackInfo)(mockSDK, 'CDKToolkit');
        expect(result).toEqual({
            hasStagingBucket: true,
            bootstrapVersion: 21,
        });
    });
    it('should throw error when stack is not found', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [],
        });
        await expect((0, checks_1.getBootstrapStackInfo)(mockSDK, 'CDKToolkit')).rejects.toThrow('Toolkit stack CDKToolkit not found');
    });
    it('should throw error when BootstrapVersion output is missing', async () => {
        const mockSDK = new mock_sdk_1.MockSdk();
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.DescribeStacksCommand).resolves({
            Stacks: [{
                    StackName: 'foo',
                    CreationTime: new Date(),
                    StackStatus: client_cloudformation_1.StackStatus.CREATE_COMPLETE,
                    Outputs: [],
                }],
        });
        await expect((0, checks_1.getBootstrapStackInfo)(mockSDK, 'CDKToolkit')).rejects.toThrow('Unable to find BootstrapVersion output in the toolkit stack CDKToolkit');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjaGVja3MudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBFQUFvRjtBQUNwRix5REFBZ0g7QUFDaEgsa0RBQXdFO0FBRXhFLFFBQVEsQ0FBQywyQ0FBMkMsRUFBRSxHQUFHLEVBQUU7SUFDekQsRUFBRSxDQUFDLG1EQUFtRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2pFLE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO1FBQzlCLG1DQUF3QixDQUFDLEVBQUUsQ0FBQyw2Q0FBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUMxRCxNQUFNLEVBQUUsQ0FBQztvQkFDUCxTQUFTLEVBQUUsS0FBSztvQkFDaEIsWUFBWSxFQUFFLElBQUksSUFBSSxFQUFFO29CQUN4QixXQUFXLEVBQUUsbUNBQVcsQ0FBQyxlQUFlO29CQUN4QyxPQUFPLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUM7aUJBQy9ELENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsa0RBQXlDLEVBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLDRFQUE0RSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsRUFBRTtRQUNwSSxNQUFNLE9BQU8sR0FBRyxJQUFJLGtCQUFPLEVBQUUsQ0FBQztRQUM5QixtQ0FBd0IsQ0FBQyxFQUFFLENBQUMsNkNBQXFCLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDMUQsTUFBTSxFQUFFLENBQUM7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LENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLDRDQUE0QyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzFELE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO1FBRTlCLG1DQUF3QixDQUFDLEVBQUUsQ0FBQyw2Q0FBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUMxRCxNQUFNLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxDQUFDLElBQUEsOEJBQXFCLEVBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ25ILENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLDREQUE0RCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzFFLE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sRUFBRSxDQUFDO1FBRTlCLG1DQUF3QixDQUFDLEVBQUUsQ0FBQyw2Q0FBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUMxRCxNQUFNLEVBQUUsQ0FBQztvQkFDUCxTQUFTLEVBQUUsS0FBSztvQkFDaEIsWUFBWSxFQUFFLElBQUksSUFBSSxFQUFFO29CQUN4QixXQUFXLEVBQUUsbUNBQVcsQ0FBQyxlQUFlO29CQUN4QyxPQUFPLEVBQUUsRUFBRTtpQkFDWixDQUFDO1NBQ0gsQ0FBQyxDQUFDO1FBRUgsTUFBTSxNQUFNLENBQUMsSUFBQSw4QkFBcUIsRUFBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7SUFDdkosQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlc2NyaWJlU3RhY2tzQ29tbWFuZCwgU3RhY2tTdGF0dXMgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtY2xvdWRmb3JtYXRpb24nO1xuaW1wb3J0IHsgZGV0ZXJtaW5lQWxsb3dDcm9zc0FjY291bnRBc3NldFB1Ymxpc2hpbmcsIGdldEJvb3RzdHJhcFN0YWNrSW5mbyB9IGZyb20gJy4uLy4uLy4uL2xpYi9hcGkvdXRpbC9jaGVja3MnO1xuaW1wb3J0IHsgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50LCBNb2NrU2RrIH0gZnJvbSAnLi4vLi4vdXRpbC9tb2NrLXNkayc7XG5cbmRlc2NyaWJlKCdkZXRlcm1pbmVBbGxvd0Nyb3NzQWNjb3VudEFzc2V0UHVibGlzaGluZycsICgpID0+IHtcbiAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZSB3aGVuIGhhc1N0YWdpbmdCdWNrZXQgaXMgZmFsc2UnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbW9ja1NESyA9IG5ldyBNb2NrU2RrKCk7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgU3RhY2tzOiBbe1xuICAgICAgICBTdGFja05hbWU6ICdmb28nLFxuICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIE91dHB1dHM6IFt7IE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLCBPdXRwdXRWYWx1ZTogJzEnIH1dLFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkZXRlcm1pbmVBbGxvd0Nyb3NzQWNjb3VudEFzc2V0UHVibGlzaGluZyhtb2NrU0RLKTtcbiAgICBleHBlY3QocmVzdWx0KS50b0JlKHRydWUpO1xuICB9KTtcblxuICBpdC5lYWNoKFsnJywgJy0nLCAnKicsICctLS0nXSkoJ3Nob3VsZCByZXR1cm4gdHJ1ZSB3aGVuIHRoZSBidWNrZXQgb3V0cHV0IGRvZXMgbm90IGxvb2sgbGlrZSBhIHJlYWwgYnVja2V0JywgYXN5bmMgKG5vdEFCdWNrZXROYW1lKSA9PiB7XG4gICAgY29uc3QgbW9ja1NESyA9IG5ldyBNb2NrU2RrKCk7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgU3RhY2tzOiBbe1xuICAgICAgICBTdGFja05hbWU6ICdmb28nLFxuICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIE91dHB1dHM6IFtcbiAgICAgICAgICB7IE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLCBPdXRwdXRWYWx1ZTogJzEnIH0sXG4gICAgICAgICAgeyBPdXRwdXRLZXk6ICdCdWNrZXROYW1lJywgT3V0cHV0VmFsdWU6IG5vdEFCdWNrZXROYW1lIH0sXG4gICAgICAgIF0sXG4gICAgICB9XSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nKG1vY2tTREspO1xuICAgIGV4cGVjdChyZXN1bHQpLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIGl0KCdzaG91bGQgcmV0dXJuIHRydWUgd2hlbiBib290c3RyYXAgdmVyc2lvbiBpcyA+PSAyMScsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGsoKTtcblxuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFN0YWNrczogW3tcbiAgICAgICAgU3RhY2tOYW1lOiAnZm9vJyxcbiAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICBPdXRwdXRzOiBbXG4gICAgICAgICAgeyBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJywgT3V0cHV0VmFsdWU6ICcyMScgfSxcbiAgICAgICAgICB7IE91dHB1dEtleTogJ0J1Y2tldE5hbWUnLCBPdXRwdXRWYWx1ZTogJ3NvbWUtYnVja2V0JyB9LFxuICAgICAgICBdLFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkZXRlcm1pbmVBbGxvd0Nyb3NzQWNjb3VudEFzc2V0UHVibGlzaGluZyhtb2NrU0RLKTtcbiAgICBleHBlY3QocmVzdWx0KS50b0JlKHRydWUpO1xuICB9KTtcblxuICBpdCgnc2hvdWxkIHJldHVybiB0cnVlIGlmIGxvb2tpbmcgdXAgdGhlIGJvb3RzdHJhcCBzdGFjayBmYWlscycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGsoKTtcbiAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQub24oRGVzY3JpYmVTdGFja3NDb21tYW5kKS5yZWplY3RzKG5ldyBFcnJvcignQ291bGQgbm90IHJlYWQgYm9vdHN0cmFwIHN0YWNrJykpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGV0ZXJtaW5lQWxsb3dDcm9zc0FjY291bnRBc3NldFB1Ymxpc2hpbmcobW9ja1NESyk7XG4gICAgZXhwZWN0KHJlc3VsdCkudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgaXQoJ3Nob3VsZCByZXR1cm4gdHJ1ZSBpZiBsb29raW5nIHVwIHRoZSBib290c3RyYXAgc3RhY2sgZmFpbHMnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbW9ja1NESyA9IG5ldyBNb2NrU2RrKCk7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVqZWN0cyhuZXcgRXJyb3IoJ0NvdWxkIG5vdCByZWFkIGJvb3RzdHJhcCBzdGFjaycpKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nKG1vY2tTREspO1xuICAgIGV4cGVjdChyZXN1bHQpLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIGl0KCdzaG91bGQgcmV0dXJuIGZhbHNlIGZvciBvdGhlciBzY2VuYXJpb3MnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbW9ja1NESyA9IG5ldyBNb2NrU2RrKCk7XG4gICAgbW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50Lm9uKERlc2NyaWJlU3RhY2tzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgU3RhY2tzOiBbe1xuICAgICAgICBTdGFja05hbWU6ICdmb28nLFxuICAgICAgICBDcmVhdGlvblRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIFN0YWNrU3RhdHVzOiBTdGFja1N0YXR1cy5DUkVBVEVfQ09NUExFVEUsXG4gICAgICAgIE91dHB1dHM6IFtcbiAgICAgICAgICB7IE91dHB1dEtleTogJ0Jvb3RzdHJhcFZlcnNpb24nLCBPdXRwdXRWYWx1ZTogJzIwJyB9LFxuICAgICAgICAgIHsgT3V0cHV0S2V5OiAnQnVja2V0TmFtZScsIE91dHB1dFZhbHVlOiAnc29tZS1idWNrZXQnIH0sXG4gICAgICAgIF0sXG4gICAgICB9XSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nKG1vY2tTREspO1xuICAgIGV4cGVjdChyZXN1bHQpLnRvQmUoZmFsc2UpO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnZ2V0Qm9vdHN0cmFwU3RhY2tJbmZvJywgKCkgPT4ge1xuICBpdCgnc2hvdWxkIHJldHVybiBjb3JyZWN0IEJvb3RzdHJhcFN0YWNrSW5mbycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGsoKTtcblxuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFN0YWNrczogW3tcbiAgICAgICAgU3RhY2tOYW1lOiAnZm9vJyxcbiAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICBPdXRwdXRzOiBbXG4gICAgICAgICAgeyBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJywgT3V0cHV0VmFsdWU6ICcyMScgfSxcbiAgICAgICAgICB7IE91dHB1dEtleTogJ0J1Y2tldE5hbWUnLCBPdXRwdXRWYWx1ZTogJ3NvbWUtYnVja2V0JyB9LFxuICAgICAgICBdLFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnZXRCb290c3RyYXBTdGFja0luZm8obW9ja1NESywgJ0NES1Rvb2xraXQnKTtcbiAgICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICAgIGhhc1N0YWdpbmdCdWNrZXQ6IHRydWUsXG4gICAgICBib290c3RyYXBWZXJzaW9uOiAyMSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoJ3Nob3VsZCB0aHJvdyBlcnJvciB3aGVuIHN0YWNrIGlzIG5vdCBmb3VuZCcsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGsoKTtcblxuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFN0YWNrczogW10sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBleHBlY3QoZ2V0Qm9vdHN0cmFwU3RhY2tJbmZvKG1vY2tTREssICdDREtUb29sa2l0JykpLnJlamVjdHMudG9UaHJvdygnVG9vbGtpdCBzdGFjayBDREtUb29sa2l0IG5vdCBmb3VuZCcpO1xuICB9KTtcblxuICBpdCgnc2hvdWxkIHRocm93IGVycm9yIHdoZW4gQm9vdHN0cmFwVmVyc2lvbiBvdXRwdXQgaXMgbWlzc2luZycsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBtb2NrU0RLID0gbmV3IE1vY2tTZGsoKTtcblxuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihEZXNjcmliZVN0YWNrc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFN0YWNrczogW3tcbiAgICAgICAgU3RhY2tOYW1lOiAnZm9vJyxcbiAgICAgICAgQ3JlYXRpb25UaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICBTdGFja1N0YXR1czogU3RhY2tTdGF0dXMuQ1JFQVRFX0NPTVBMRVRFLFxuICAgICAgICBPdXRwdXRzOiBbXSxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgZXhwZWN0KGdldEJvb3RzdHJhcFN0YWNrSW5mbyhtb2NrU0RLLCAnQ0RLVG9vbGtpdCcpKS5yZWplY3RzLnRvVGhyb3coJ1VuYWJsZSB0byBmaW5kIEJvb3RzdHJhcFZlcnNpb24gb3V0cHV0IGluIHRoZSB0b29sa2l0IHN0YWNrIENES1Rvb2xraXQnKTtcbiAgfSk7XG59KTtcbiJdfQ==