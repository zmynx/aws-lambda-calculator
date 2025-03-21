"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ssm_1 = require("@aws-sdk/client-ssm");
const api_1 = require("../../lib/api");
const environment_resources_1 = require("../../lib/api/environment-resources");
const notices_1 = require("../../lib/notices");
const settings_1 = require("../../lib/settings");
const version = require("../../lib/version");
const mock_sdk_1 = require("../util/mock-sdk");
const mock_toolkitinfo_1 = require("../util/mock-toolkitinfo");
let mockSdk;
let envRegistry;
let toolkitMock;
beforeEach(() => {
    mockSdk = new mock_sdk_1.MockSdk();
    envRegistry = new environment_resources_1.EnvironmentResourcesRegistry();
    toolkitMock = mock_toolkitinfo_1.MockToolkitInfo.setup();
});
afterEach(() => {
    toolkitMock.dispose();
});
function mockToolkitInfo(ti) {
    api_1.ToolkitInfo.lookup = jest.fn().mockResolvedValue(ti);
}
function envResources() {
    return envRegistry.for({
        account: '11111111',
        region: 'us-nowhere',
        name: 'aws://11111111/us-nowhere',
    }, mockSdk);
}
test('failure to read SSM parameter results in upgrade message for existing bootstrap stack under v5', async () => {
    // GIVEN
    mockToolkitInfo(api_1.ToolkitInfo.fromStack((0, mock_sdk_1.mockBootstrapStack)({
        Outputs: [{ OutputKey: 'BootstrapVersion', OutputValue: '4' }],
    })));
    const error = new Error('Computer says no');
    error.name = 'AccessDeniedException';
    mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).rejects(error);
    // THEN
    await expect(envResources().validateVersion(99, '/abc')).rejects.toThrow(/This CDK deployment requires bootstrap stack version/);
});
test('failure to read SSM parameter results in exception passthrough for existing bootstrap stack v5 or higher', async () => {
    // GIVEN
    mockToolkitInfo(api_1.ToolkitInfo.fromStack((0, mock_sdk_1.mockBootstrapStack)({
        Outputs: [{ OutputKey: 'BootstrapVersion', OutputValue: '5' }],
    })));
    const error = new Error('Computer says no');
    error.name = 'AccessDeniedException';
    mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).rejects(error);
    // THEN
    await expect(envResources().validateVersion(99, '/abc')).rejects.toThrow(/Computer says no/);
});
describe('validateversion without bootstrap stack', () => {
    beforeEach(() => {
        mockToolkitInfo(api_1.ToolkitInfo.bootstrapStackNotFoundInfo('TestBootstrapStack'));
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    test('validating version with explicit SSM parameter succeeds', async () => {
        // GIVEN
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).resolves({
            Parameter: { Value: '10' },
        });
        // disable notices caching
        jest.spyOn(notices_1.CachedDataSource.prototype, 'save').mockImplementation((_) => Promise.resolve());
        jest
            .spyOn(notices_1.CachedDataSource.prototype, 'load')
            .mockImplementation(() => Promise.resolve({ expiration: 0, notices: [] }));
        // mock cli version number
        jest.spyOn(version, 'versionNumber').mockImplementation(() => '1.0.0');
        // THEN
        const notices = notices_1.Notices.create({ context: new settings_1.Context() });
        await notices.refresh({ dataSource: { fetch: async () => [] } });
        await expect(envResources().validateVersion(8, '/abc')).resolves.toBeUndefined();
        const filter = jest.spyOn(notices_1.NoticesFilter, 'filter');
        notices.display();
        expect(filter).toHaveBeenCalledTimes(1);
        expect(filter).toHaveBeenCalledWith({
            bootstrappedEnvironments: [
                {
                    bootstrapStackVersion: 10,
                    environment: {
                        account: '11111111',
                        region: 'us-nowhere',
                        name: 'aws://11111111/us-nowhere',
                    },
                },
            ],
            cliVersion: '1.0.0',
            data: [],
            outDir: 'cdk.out',
        });
    });
    test('validating version without explicit SSM parameter fails', async () => {
        // WHEN
        await expect(envResources().validateVersion(8, undefined)).rejects.toThrow(/This deployment requires a bootstrap stack with a known name/);
    });
    test('validating version with access denied error gives upgrade hint', async () => {
        // GIVEN
        const error = new Error('Computer says no');
        error.name = 'AccessDeniedException';
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).rejects(error);
        // WHEN
        await expect(envResources().validateVersion(8, '/abc')).rejects.toThrow(/This CDK deployment requires bootstrap stack version/);
    });
    test('validating version with missing parameter gives bootstrap hint', async () => {
        // GIVEN
        const error = new Error('Wut?');
        error.name = 'ParameterNotFound';
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).rejects(error);
        // WHEN
        await expect(envResources().validateVersion(8, '/abc')).rejects.toThrow(/Has the environment been bootstrapped?/);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtcmVzb3VyY2VzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnZpcm9ubWVudC1yZXNvdXJjZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUEwRDtBQUMxRCx1Q0FBNEM7QUFDNUMsK0VBQW1GO0FBQ25GLCtDQUE2RTtBQUM3RSxpREFBNkM7QUFDN0MsNkNBQTZDO0FBQzdDLCtDQUE4RTtBQUM5RSwrREFBMkQ7QUFFM0QsSUFBSSxPQUFnQixDQUFDO0FBQ3JCLElBQUksV0FBeUMsQ0FBQztBQUM5QyxJQUFJLFdBQXFELENBQUM7QUFDMUQsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLE9BQU8sR0FBRyxJQUFJLGtCQUFPLEVBQUUsQ0FBQztJQUN4QixXQUFXLEdBQUcsSUFBSSxvREFBNEIsRUFBRSxDQUFDO0lBQ2pELFdBQVcsR0FBRyxrQ0FBZSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ3hDLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxDQUFDLEdBQUcsRUFBRTtJQUNiLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN4QixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsZUFBZSxDQUFDLEVBQWU7SUFDdEMsaUJBQVcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFFRCxTQUFTLFlBQVk7SUFDbkIsT0FBTyxXQUFXLENBQUMsR0FBRyxDQUNwQjtRQUNFLE9BQU8sRUFBRSxVQUFVO1FBQ25CLE1BQU0sRUFBRSxZQUFZO1FBQ3BCLElBQUksRUFBRSwyQkFBMkI7S0FDbEMsRUFDRCxPQUFPLENBQ1IsQ0FBQztBQUNKLENBQUM7QUFFRCxJQUFJLENBQUMsZ0dBQWdHLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDaEgsUUFBUTtJQUNSLGVBQWUsQ0FDYixpQkFBVyxDQUFDLFNBQVMsQ0FDbkIsSUFBQSw2QkFBa0IsRUFBQztRQUNqQixPQUFPLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUM7S0FDL0QsQ0FBQyxDQUNILENBQ0YsQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDNUMsS0FBSyxDQUFDLElBQUksR0FBRyx1QkFBdUIsQ0FBQztJQUNyQyx3QkFBYSxDQUFDLEVBQUUsQ0FBQyxnQ0FBbUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVyRCxPQUFPO0lBQ1AsTUFBTSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3RFLHNEQUFzRCxDQUN2RCxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLENBQUMsMEdBQTBHLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDMUgsUUFBUTtJQUNSLGVBQWUsQ0FDYixpQkFBVyxDQUFDLFNBQVMsQ0FDbkIsSUFBQSw2QkFBa0IsRUFBQztRQUNqQixPQUFPLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUM7S0FDL0QsQ0FBQyxDQUNILENBQ0YsQ0FBQztJQUVGLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDNUMsS0FBSyxDQUFDLElBQUksR0FBRyx1QkFBdUIsQ0FBQztJQUNyQyx3QkFBYSxDQUFDLEVBQUUsQ0FBQyxnQ0FBbUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUVyRCxPQUFPO0lBQ1AsTUFBTSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUMvRixDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyx5Q0FBeUMsRUFBRSxHQUFHLEVBQUU7SUFDdkQsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLGVBQWUsQ0FBQyxpQkFBVyxDQUFDLDBCQUEwQixDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztJQUNoRixDQUFDLENBQUMsQ0FBQztJQUVILFNBQVMsQ0FBQyxHQUFHLEVBQUU7UUFDYixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekUsUUFBUTtRQUNSLHdCQUFhLENBQUMsRUFBRSxDQUFDLGdDQUFtQixDQUFDLENBQUMsUUFBUSxDQUFDO1lBQzdDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxLQUFLLENBQUMsMEJBQWdCLENBQUMsU0FBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDeEcsSUFBSTthQUNELEtBQUssQ0FBQywwQkFBZ0IsQ0FBQyxTQUFnQixFQUFFLE1BQU0sQ0FBQzthQUNoRCxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTdFLDBCQUEwQjtRQUMxQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV2RSxPQUFPO1FBQ1AsTUFBTSxPQUFPLEdBQUcsaUJBQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxrQkFBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzNELE1BQU0sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRSxNQUFNLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRWpGLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNuRCxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFbEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztZQUNsQyx3QkFBd0IsRUFBRTtnQkFDeEI7b0JBQ0UscUJBQXFCLEVBQUUsRUFBRTtvQkFDekIsV0FBVyxFQUFFO3dCQUNYLE9BQU8sRUFBRSxVQUFVO3dCQUNuQixNQUFNLEVBQUUsWUFBWTt3QkFDcEIsSUFBSSxFQUFFLDJCQUEyQjtxQkFDbEM7aUJBQ0Y7YUFDRjtZQUNELFVBQVUsRUFBRSxPQUFPO1lBQ25CLElBQUksRUFBRSxFQUFFO1lBQ1IsTUFBTSxFQUFFLFNBQVM7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekUsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUN4RSw4REFBOEQsQ0FDL0QsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdFQUFnRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hGLFFBQVE7UUFDUixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzVDLEtBQUssQ0FBQyxJQUFJLEdBQUcsdUJBQXVCLENBQUM7UUFDckMsd0JBQWEsQ0FBQyxFQUFFLENBQUMsZ0NBQW1CLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckQsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUNyRSxzREFBc0QsQ0FDdkQsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdFQUFnRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hGLFFBQVE7UUFDUixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxLQUFLLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDO1FBQ2pDLHdCQUFhLENBQUMsRUFBRSxDQUFDLGdDQUFtQixDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJELE9BQU87UUFDUCxNQUFNLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0lBQ3BILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBHZXRQYXJhbWV0ZXJDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXNzbSc7XG5pbXBvcnQgeyBUb29sa2l0SW5mbyB9IGZyb20gJy4uLy4uL2xpYi9hcGknO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRSZXNvdXJjZXNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2xpYi9hcGkvZW52aXJvbm1lbnQtcmVzb3VyY2VzJztcbmltcG9ydCB7IENhY2hlZERhdGFTb3VyY2UsIE5vdGljZXMsIE5vdGljZXNGaWx0ZXIgfSBmcm9tICcuLi8uLi9saWIvbm90aWNlcyc7XG5pbXBvcnQgeyBDb250ZXh0IH0gZnJvbSAnLi4vLi4vbGliL3NldHRpbmdzJztcbmltcG9ydCAqIGFzIHZlcnNpb24gZnJvbSAnLi4vLi4vbGliL3ZlcnNpb24nO1xuaW1wb3J0IHsgTW9ja1NkaywgbW9ja0Jvb3RzdHJhcFN0YWNrLCBtb2NrU1NNQ2xpZW50IH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5pbXBvcnQgeyBNb2NrVG9vbGtpdEluZm8gfSBmcm9tICcuLi91dGlsL21vY2stdG9vbGtpdGluZm8nO1xuXG5sZXQgbW9ja1NkazogTW9ja1NkaztcbmxldCBlbnZSZWdpc3RyeTogRW52aXJvbm1lbnRSZXNvdXJjZXNSZWdpc3RyeTtcbmxldCB0b29sa2l0TW9jazogUmV0dXJuVHlwZTx0eXBlb2YgTW9ja1Rvb2xraXRJbmZvLnNldHVwPjtcbmJlZm9yZUVhY2goKCkgPT4ge1xuICBtb2NrU2RrID0gbmV3IE1vY2tTZGsoKTtcbiAgZW52UmVnaXN0cnkgPSBuZXcgRW52aXJvbm1lbnRSZXNvdXJjZXNSZWdpc3RyeSgpO1xuICB0b29sa2l0TW9jayA9IE1vY2tUb29sa2l0SW5mby5zZXR1cCgpO1xufSk7XG5cbmFmdGVyRWFjaCgoKSA9PiB7XG4gIHRvb2xraXRNb2NrLmRpc3Bvc2UoKTtcbn0pO1xuXG5mdW5jdGlvbiBtb2NrVG9vbGtpdEluZm8odGk6IFRvb2xraXRJbmZvKSB7XG4gIFRvb2xraXRJbmZvLmxvb2t1cCA9IGplc3QuZm4oKS5tb2NrUmVzb2x2ZWRWYWx1ZSh0aSk7XG59XG5cbmZ1bmN0aW9uIGVudlJlc291cmNlcygpIHtcbiAgcmV0dXJuIGVudlJlZ2lzdHJ5LmZvcihcbiAgICB7XG4gICAgICBhY2NvdW50OiAnMTExMTExMTEnLFxuICAgICAgcmVnaW9uOiAndXMtbm93aGVyZScsXG4gICAgICBuYW1lOiAnYXdzOi8vMTExMTExMTEvdXMtbm93aGVyZScsXG4gICAgfSxcbiAgICBtb2NrU2RrLFxuICApO1xufVxuXG50ZXN0KCdmYWlsdXJlIHRvIHJlYWQgU1NNIHBhcmFtZXRlciByZXN1bHRzIGluIHVwZ3JhZGUgbWVzc2FnZSBmb3IgZXhpc3RpbmcgYm9vdHN0cmFwIHN0YWNrIHVuZGVyIHY1JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrVG9vbGtpdEluZm8oXG4gICAgVG9vbGtpdEluZm8uZnJvbVN0YWNrKFxuICAgICAgbW9ja0Jvb3RzdHJhcFN0YWNrKHtcbiAgICAgICAgT3V0cHV0czogW3sgT3V0cHV0S2V5OiAnQm9vdHN0cmFwVmVyc2lvbicsIE91dHB1dFZhbHVlOiAnNCcgfV0sXG4gICAgICB9KSxcbiAgICApLFxuICApO1xuXG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdDb21wdXRlciBzYXlzIG5vJyk7XG4gIGVycm9yLm5hbWUgPSAnQWNjZXNzRGVuaWVkRXhjZXB0aW9uJztcbiAgbW9ja1NTTUNsaWVudC5vbihHZXRQYXJhbWV0ZXJDb21tYW5kKS5yZWplY3RzKGVycm9yKTtcblxuICAvLyBUSEVOXG4gIGF3YWl0IGV4cGVjdChlbnZSZXNvdXJjZXMoKS52YWxpZGF0ZVZlcnNpb24oOTksICcvYWJjJykpLnJlamVjdHMudG9UaHJvdyhcbiAgICAvVGhpcyBDREsgZGVwbG95bWVudCByZXF1aXJlcyBib290c3RyYXAgc3RhY2sgdmVyc2lvbi8sXG4gICk7XG59KTtcblxudGVzdCgnZmFpbHVyZSB0byByZWFkIFNTTSBwYXJhbWV0ZXIgcmVzdWx0cyBpbiBleGNlcHRpb24gcGFzc3Rocm91Z2ggZm9yIGV4aXN0aW5nIGJvb3RzdHJhcCBzdGFjayB2NSBvciBoaWdoZXInLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tUb29sa2l0SW5mbyhcbiAgICBUb29sa2l0SW5mby5mcm9tU3RhY2soXG4gICAgICBtb2NrQm9vdHN0cmFwU3RhY2soe1xuICAgICAgICBPdXRwdXRzOiBbeyBPdXRwdXRLZXk6ICdCb290c3RyYXBWZXJzaW9uJywgT3V0cHV0VmFsdWU6ICc1JyB9XSxcbiAgICAgIH0pLFxuICAgICksXG4gICk7XG5cbiAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ0NvbXB1dGVyIHNheXMgbm8nKTtcbiAgZXJyb3IubmFtZSA9ICdBY2Nlc3NEZW5pZWRFeGNlcHRpb24nO1xuICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLnJlamVjdHMoZXJyb3IpO1xuXG4gIC8vIFRIRU5cbiAgYXdhaXQgZXhwZWN0KGVudlJlc291cmNlcygpLnZhbGlkYXRlVmVyc2lvbig5OSwgJy9hYmMnKSkucmVqZWN0cy50b1Rocm93KC9Db21wdXRlciBzYXlzIG5vLyk7XG59KTtcblxuZGVzY3JpYmUoJ3ZhbGlkYXRldmVyc2lvbiB3aXRob3V0IGJvb3RzdHJhcCBzdGFjaycsICgpID0+IHtcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgbW9ja1Rvb2xraXRJbmZvKFRvb2xraXRJbmZvLmJvb3RzdHJhcFN0YWNrTm90Rm91bmRJbmZvKCdUZXN0Qm9vdHN0cmFwU3RhY2snKSk7XG4gIH0pO1xuXG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgamVzdC5jbGVhckFsbE1vY2tzKCk7XG4gIH0pO1xuXG4gIHRlc3QoJ3ZhbGlkYXRpbmcgdmVyc2lvbiB3aXRoIGV4cGxpY2l0IFNTTSBwYXJhbWV0ZXIgc3VjY2VlZHMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgIFBhcmFtZXRlcjogeyBWYWx1ZTogJzEwJyB9LFxuICAgIH0pO1xuXG4gICAgLy8gZGlzYWJsZSBub3RpY2VzIGNhY2hpbmdcbiAgICBqZXN0LnNweU9uKENhY2hlZERhdGFTb3VyY2UucHJvdG90eXBlIGFzIGFueSwgJ3NhdmUnKS5tb2NrSW1wbGVtZW50YXRpb24oKF86IGFueSkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpO1xuICAgIGplc3RcbiAgICAgIC5zcHlPbihDYWNoZWREYXRhU291cmNlLnByb3RvdHlwZSBhcyBhbnksICdsb2FkJylcbiAgICAgIC5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgZXhwaXJhdGlvbjogMCwgbm90aWNlczogW10gfSkpO1xuXG4gICAgLy8gbW9jayBjbGkgdmVyc2lvbiBudW1iZXJcbiAgICBqZXN0LnNweU9uKHZlcnNpb24sICd2ZXJzaW9uTnVtYmVyJykubW9ja0ltcGxlbWVudGF0aW9uKCgpID0+ICcxLjAuMCcpO1xuXG4gICAgLy8gVEhFTlxuICAgIGNvbnN0IG5vdGljZXMgPSBOb3RpY2VzLmNyZWF0ZSh7IGNvbnRleHQ6IG5ldyBDb250ZXh0KCkgfSk7XG4gICAgYXdhaXQgbm90aWNlcy5yZWZyZXNoKHsgZGF0YVNvdXJjZTogeyBmZXRjaDogYXN5bmMgKCkgPT4gW10gfSB9KTtcbiAgICBhd2FpdCBleHBlY3QoZW52UmVzb3VyY2VzKCkudmFsaWRhdGVWZXJzaW9uKDgsICcvYWJjJykpLnJlc29sdmVzLnRvQmVVbmRlZmluZWQoKTtcblxuICAgIGNvbnN0IGZpbHRlciA9IGplc3Quc3B5T24oTm90aWNlc0ZpbHRlciwgJ2ZpbHRlcicpO1xuICAgIG5vdGljZXMuZGlzcGxheSgpO1xuXG4gICAgZXhwZWN0KGZpbHRlcikudG9IYXZlQmVlbkNhbGxlZFRpbWVzKDEpO1xuICAgIGV4cGVjdChmaWx0ZXIpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKHtcbiAgICAgIGJvb3RzdHJhcHBlZEVudmlyb25tZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgYm9vdHN0cmFwU3RhY2tWZXJzaW9uOiAxMCxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgYWNjb3VudDogJzExMTExMTExJyxcbiAgICAgICAgICAgIHJlZ2lvbjogJ3VzLW5vd2hlcmUnLFxuICAgICAgICAgICAgbmFtZTogJ2F3czovLzExMTExMTExL3VzLW5vd2hlcmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgY2xpVmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIGRhdGE6IFtdLFxuICAgICAgb3V0RGlyOiAnY2RrLm91dCcsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3ZhbGlkYXRpbmcgdmVyc2lvbiB3aXRob3V0IGV4cGxpY2l0IFNTTSBwYXJhbWV0ZXIgZmFpbHMnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChlbnZSZXNvdXJjZXMoKS52YWxpZGF0ZVZlcnNpb24oOCwgdW5kZWZpbmVkKSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgL1RoaXMgZGVwbG95bWVudCByZXF1aXJlcyBhIGJvb3RzdHJhcCBzdGFjayB3aXRoIGEga25vd24gbmFtZS8sXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgndmFsaWRhdGluZyB2ZXJzaW9uIHdpdGggYWNjZXNzIGRlbmllZCBlcnJvciBnaXZlcyB1cGdyYWRlIGhpbnQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignQ29tcHV0ZXIgc2F5cyBubycpO1xuICAgIGVycm9yLm5hbWUgPSAnQWNjZXNzRGVuaWVkRXhjZXB0aW9uJztcbiAgICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLnJlamVjdHMoZXJyb3IpO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChlbnZSZXNvdXJjZXMoKS52YWxpZGF0ZVZlcnNpb24oOCwgJy9hYmMnKSkucmVqZWN0cy50b1Rocm93KFxuICAgICAgL1RoaXMgQ0RLIGRlcGxveW1lbnQgcmVxdWlyZXMgYm9vdHN0cmFwIHN0YWNrIHZlcnNpb24vLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ3ZhbGlkYXRpbmcgdmVyc2lvbiB3aXRoIG1pc3NpbmcgcGFyYW1ldGVyIGdpdmVzIGJvb3RzdHJhcCBoaW50JywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1d1dD8nKTtcbiAgICBlcnJvci5uYW1lID0gJ1BhcmFtZXRlck5vdEZvdW5kJztcbiAgICBtb2NrU1NNQ2xpZW50Lm9uKEdldFBhcmFtZXRlckNvbW1hbmQpLnJlamVjdHMoZXJyb3IpO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChlbnZSZXNvdXJjZXMoKS52YWxpZGF0ZVZlcnNpb24oOCwgJy9hYmMnKSkucmVqZWN0cy50b1Rocm93KC9IYXMgdGhlIGVudmlyb25tZW50IGJlZW4gYm9vdHN0cmFwcGVkPy8pO1xuICB9KTtcbn0pO1xuIl19