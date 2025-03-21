"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const evaluate_cloudformation_template_1 = require("../../lib/api/evaluate-cloudformation-template");
const mock_sdk_1 = require("../util/mock-sdk");
describe('LazyLookupExport', () => {
    const mockSdk = new mock_sdk_1.MockSdk();
    beforeEach(() => {
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
    });
    const createExport = (num) => ({
        ExportingStackId: `test-exporting-stack-id-${num}`,
        Name: `test-name-${num}`,
        Value: `test-value-${num}`,
    });
    it('skips over any results that omit Name property', async () => {
        mock_sdk_1.mockCloudFormationClient.on(client_cloudformation_1.ListExportsCommand).resolvesOnce({
            Exports: [
                createExport(1),
                createExport(2),
                {
                    Value: 'value-without-name',
                },
                createExport(3),
            ],
            NextToken: undefined,
        });
        const lookup = new evaluate_cloudformation_template_1.LazyLookupExport(mockSdk);
        const result = await lookup.lookupExport('test-name-3');
        expect(result?.Value).toEqual('test-value-3');
    });
    describe('three pages of exports', () => {
        let lookup;
        beforeEach(() => {
            lookup = new evaluate_cloudformation_template_1.LazyLookupExport(mockSdk);
            mock_sdk_1.mockCloudFormationClient
                .on(client_cloudformation_1.ListExportsCommand)
                .resolvesOnce({
                Exports: [createExport(1), createExport(2), createExport(3)],
                NextToken: 'next-token-1',
            })
                .resolvesOnce({
                Exports: [createExport(4), createExport(5), createExport(6)],
                NextToken: 'next-token-2',
            })
                .resolvesOnce({
                Exports: [createExport(7), createExport(8)],
                NextToken: undefined,
            });
        });
        it('returns the matching export', async () => {
            const name = 'test-name-3';
            const result = await lookup.lookupExport(name);
            expect(result?.Name).toEqual(name);
            expect(result?.Value).toEqual('test-value-3');
        });
        it('stops fetching once export is found', async () => {
            await lookup.lookupExport('test-name-3');
            expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListExportsCommand, 1);
        });
        it('paginates', async () => {
            await lookup.lookupExport('test-name-7');
            expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListExportsCommand, 3);
            expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ListExportsCommand, {
                NextToken: 'next-token-1',
            });
            expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandWith(client_cloudformation_1.ListExportsCommand, {
                NextToken: 'next-token-2',
            });
        });
        it('caches the calls to CloudFormation API', async () => {
            await lookup.lookupExport('test-name-3');
            await lookup.lookupExport('test-name-3');
            await lookup.lookupExport('test-name-3');
            expect(mock_sdk_1.mockCloudFormationClient).toHaveReceivedCommandTimes(client_cloudformation_1.ListExportsCommand, 1);
        });
        it('returns undefined if the export does not exist', async () => {
            const result = await lookup.lookupExport('test-name-unknown');
            expect(result).toBeUndefined();
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF6eS1sb29rdXAtZXhwb3J0LnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYXp5LWxvb2t1cC1leHBvcnQudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBFQUFvRTtBQUNwRSxxR0FBa0Y7QUFDbEYsK0NBQStGO0FBRS9GLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7SUFDaEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxrQkFBTyxFQUFFLENBQUM7SUFFOUIsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLElBQUEsbUNBQXdCLEdBQUUsQ0FBQztJQUM3QixDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sWUFBWSxHQUFHLENBQUMsR0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3JDLGdCQUFnQixFQUFFLDJCQUEyQixHQUFHLEVBQUU7UUFDbEQsSUFBSSxFQUFFLGFBQWEsR0FBRyxFQUFFO1FBQ3hCLEtBQUssRUFBRSxjQUFjLEdBQUcsRUFBRTtLQUMzQixDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsZ0RBQWdELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUQsbUNBQXdCLENBQUMsRUFBRSxDQUFDLDBDQUFrQixDQUFDLENBQUMsWUFBWSxDQUFDO1lBQzNELE9BQU8sRUFBRTtnQkFDUCxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUNmLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2Y7b0JBQ0UsS0FBSyxFQUFFLG9CQUFvQjtpQkFDNUI7Z0JBQ0QsWUFBWSxDQUFDLENBQUMsQ0FBQzthQUNoQjtZQUNELFNBQVMsRUFBRSxTQUFTO1NBQ3JCLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxHQUFHLElBQUksbURBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFN0MsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3hELE1BQU0sQ0FBQyxNQUFNLEVBQUUsS0FBSyxD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S0FBSyxJQUFJLEVBQUU7WUFDOUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDOUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExpc3RFeHBvcnRzQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBMYXp5TG9va3VwRXhwb3J0IH0gZnJvbSAnLi4vLi4vbGliL2FwaS9ldmFsdWF0ZS1jbG91ZGZvcm1hdGlvbi10ZW1wbGF0ZSc7XG5pbXBvcnQgeyBNb2NrU2RrLCBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQsIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCB9IGZyb20gJy4uL3V0aWwvbW9jay1zZGsnO1xuXG5kZXNjcmliZSgnTGF6eUxvb2t1cEV4cG9ydCcsICgpID0+IHtcbiAgY29uc3QgbW9ja1NkayA9IG5ldyBNb2NrU2RrKCk7XG5cbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0KCk7XG4gIH0pO1xuXG4gIGNvbnN0IGNyZWF0ZUV4cG9ydCA9IChudW06IG51bWJlcikgPT4gKHtcbiAgICBFeHBvcnRpbmdTdGFja0lkOiBgdGVzdC1leHBvcnRpbmctc3RhY2staWQtJHtudW19YCxcbiAgICBOYW1lOiBgdGVzdC1uYW1lLSR7bnVtfWAsXG4gICAgVmFsdWU6IGB0ZXN0LXZhbHVlLSR7bnVtfWAsXG4gIH0pO1xuXG4gIGl0KCdza2lwcyBvdmVyIGFueSByZXN1bHRzIHRoYXQgb21pdCBOYW1lIHByb3BlcnR5JywgYXN5bmMgKCkgPT4ge1xuICAgIG1vY2tDbG91ZEZvcm1hdGlvbkNsaWVudC5vbihMaXN0RXhwb3J0c0NvbW1hbmQpLnJlc29sdmVzT25jZSh7XG4gICAgICBFeHBvcnRzOiBbXG4gICAgICAgIGNyZWF0ZUV4cG9ydCgxKSxcbiAgICAgICAgY3JlYXRlRXhwb3J0KDIpLFxuICAgICAgICB7XG4gICAgICAgICAgVmFsdWU6ICd2YWx1ZS13aXRob3V0LW5hbWUnLFxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVFeHBvcnQoMyksXG4gICAgICBdLFxuICAgICAgTmV4dFRva2VuOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb29rdXAgPSBuZXcgTGF6eUxvb2t1cEV4cG9ydChtb2NrU2RrKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvb2t1cC5sb29rdXBFeHBvcnQoJ3Rlc3QtbmFtZS0zJyk7XG4gICAgZXhwZWN0KHJlc3VsdD8uVmFsdWUpLnRvRXF1YWwoJ3Rlc3QtdmFsdWUtMycpO1xuICB9KTtcblxuICBkZXNjcmliZSgndGhyZWUgcGFnZXMgb2YgZXhwb3J0cycsICgpID0+IHtcbiAgICBsZXQgbG9va3VwOiBMYXp5TG9va3VwRXhwb3J0O1xuICAgIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgICAgbG9va3VwID0gbmV3IExhenlMb29rdXBFeHBvcnQobW9ja1Nkayk7XG4gICAgICBtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnRcbiAgICAgICAgLm9uKExpc3RFeHBvcnRzQ29tbWFuZClcbiAgICAgICAgLnJlc29sdmVzT25jZSh7XG4gICAgICAgICAgRXhwb3J0czogW2NyZWF0ZUV4cG9ydCgxKSwgY3JlYXRlRXhwb3J0KDIpLCBjcmVhdGVFeHBvcnQoMyldLFxuICAgICAgICAgIE5leHRUb2tlbjogJ25leHQtdG9rZW4tMScsXG4gICAgICAgIH0pXG4gICAgICAgIC5yZXNvbHZlc09uY2Uoe1xuICAgICAgICAgIEV4cG9ydHM6IFtjcmVhdGVFeHBvcnQoNCksIGNyZWF0ZUV4cG9ydCg1KSwgY3JlYXRlRXhwb3J0KDYpXSxcbiAgICAgICAgICBOZXh0VG9rZW46ICduZXh0LXRva2VuLTInLFxuICAgICAgICB9KVxuICAgICAgICAucmVzb2x2ZXNPbmNlKHtcbiAgICAgICAgICBFeHBvcnRzOiBbY3JlYXRlRXhwb3J0KDcpLCBjcmVhdGVFeHBvcnQoOCldLFxuICAgICAgICAgIE5leHRUb2tlbjogdW5kZWZpbmVkLFxuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KCdyZXR1cm5zIHRoZSBtYXRjaGluZyBleHBvcnQnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gJ3Rlc3QtbmFtZS0zJztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvb2t1cC5sb29rdXBFeHBvcnQobmFtZSk7XG4gICAgICBleHBlY3QocmVzdWx0Py5OYW1lKS50b0VxdWFsKG5hbWUpO1xuICAgICAgZXhwZWN0KHJlc3VsdD8uVmFsdWUpLnRvRXF1YWwoJ3Rlc3QtdmFsdWUtMycpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3N0b3BzIGZldGNoaW5nIG9uY2UgZXhwb3J0IGlzIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgbG9va3VwLmxvb2t1cEV4cG9ydCgndGVzdC1uYW1lLTMnKTtcbiAgICAgIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RFeHBvcnRzQ29tbWFuZCwgMSk7XG4gICAgfSk7XG5cbiAgICBpdCgncGFnaW5hdGVzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgbG9va3VwLmxvb2t1cEV4cG9ydCgndGVzdC1uYW1lLTcnKTtcbiAgICAgIGV4cGVjdChtb2NrQ2xvdWRGb3JtYXRpb25DbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFRpbWVzKExpc3RFeHBvcnRzQ29tbWFuZCwgMyk7XG4gICAgICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKExpc3RFeHBvcnRzQ29tbWFuZCwge1xuICAgICAgICBOZXh0VG9rZW46ICduZXh0LXRva2VuLTEnLFxuICAgICAgfSk7XG4gICAgICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKExpc3RFeHBvcnRzQ29tbWFuZCwge1xuICAgICAgICBOZXh0VG9rZW46ICduZXh0LXRva2VuLTInLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnY2FjaGVzIHRoZSBjYWxscyB0byBDbG91ZEZvcm1hdGlvbiBBUEknLCBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBsb29rdXAubG9va3VwRXhwb3J0KCd0ZXN0LW5hbWUtMycpO1xuICAgICAgYXdhaXQgbG9va3VwLmxvb2t1cEV4cG9ydCgndGVzdC1uYW1lLTMnKTtcbiAgICAgIGF3YWl0IGxvb2t1cC5sb29rdXBFeHBvcnQoJ3Rlc3QtbmFtZS0zJyk7XG4gICAgICBleHBlY3QobW9ja0Nsb3VkRm9ybWF0aW9uQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRUaW1lcyhMaXN0RXhwb3J0c0NvbW1hbmQsIDEpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JldHVybnMgdW5kZWZpbmVkIGlmIHRoZSBleHBvcnQgZG9lcyBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsb29rdXAubG9va3VwRXhwb3J0KCd0ZXN0LW5hbWUtdW5rbm93bicpO1xuICAgICAgZXhwZWN0KHJlc3VsdCkudG9CZVVuZGVmaW5lZCgpO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuIl19