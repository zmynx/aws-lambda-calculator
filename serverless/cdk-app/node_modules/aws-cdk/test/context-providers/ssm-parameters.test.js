"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ssm_1 = require("@aws-sdk/client-ssm");
const lib_1 = require("../../lib");
const ssm_parameters_1 = require("../../lib/context-providers/ssm-parameters");
const mock_sdk_1 = require("../util/mock-sdk");
const mockSDK = new (class extends mock_sdk_1.MockSdkProvider {
    forEnvironment() {
        return Promise.resolve({ sdk: new lib_1.SDK(mock_sdk_1.FAKE_CREDENTIAL_CHAIN, mockSDK.defaultRegion, {}), didAssumeRole: false });
    }
})();
describe('ssmParameters', () => {
    test('returns value', async () => {
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
        const provider = new ssm_parameters_1.SSMContextProviderPlugin(mockSDK);
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).resolves({
            Parameter: {
                Value: 'bar',
            },
        });
        // WHEN
        const value = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            parameterName: 'foo',
        });
        expect(value).toEqual('bar');
    });
    test('errors when parameter is not found', async () => {
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
        const provider = new ssm_parameters_1.SSMContextProviderPlugin(mockSDK);
        const notFound = new Error('Parameter not found');
        notFound.name = 'ParameterNotFound';
        mock_sdk_1.mockSSMClient.on(client_ssm_1.GetParameterCommand).rejects(notFound);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            parameterName: 'foo',
        })).rejects.toThrow(/SSM parameter not available in account/);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtLXBhcmFtZXRlcnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNzbS1wYXJhbWV0ZXJzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxvREFBMEQ7QUFDMUQsbUNBQW1EO0FBQ25ELCtFQUFzRjtBQUN0RiwrQ0FBbUg7QUFFbkgsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQU0sU0FBUSwwQkFBZTtJQUN6QyxjQUFjO1FBQ25CLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLFNBQUcsQ0FBQyxnQ0FBcUIsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ25ILENBQUM7Q0FDRixDQUFDLEVBQUUsQ0FBQztBQUVMLFFBQVEsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQzdCLElBQUksQ0FBQyxlQUFlLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDL0IsSUFBQSxtQ0FBd0IsR0FBRSxDQUFDO1FBQzNCLE1BQU0sUUFBUSxHQUFHLElBQUkseUNBQXdCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFdkQsd0JBQWEsQ0FBQyxFQUFFLENBQUMsZ0NBQW1CLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDN0MsU0FBUyxFQUFFO2dCQUNULEtBQUssRUFBRSxLQUFLO2FBQ2I7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsTUFBTSxLQUFLLEdBQUcsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ3BDLE9BQU8sRUFBRSxNQUFNO1lBQ2YsTUFBTSxFQUFFLFdBQVc7WUFDbkIsYUFBYSxFQUFFLEtBQUs7U0FDckIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNwRCxJQUFBLG1DQUF3QixHQUFFLENBQUM7UUFDM0IsTUFBTSxRQUFRLEdBQUcsSUFBSSx5Q0FBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV2RCxNQUFNLFFBQVEsR0FBRyxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2xELFFBQVEsQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7UUFDcEMsd0JBQWEsQ0FBQyxFQUFFLENBQUMsZ0NBQW1CLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFeEQsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUNWLFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsT0FBTyxFQUFFLE1BQU07WUFDZixNQUFNLEVBQUUsV0FBVztZQUNuQixhQUFhLEVBQUUsS0FBSztTQUNyQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7SUFDbEUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEdldFBhcmFtZXRlckNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtc3NtJztcbmltcG9ydCB7IFNESywgU2RrRm9yRW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi9saWInO1xuaW1wb3J0IHsgU1NNQ29udGV4dFByb3ZpZGVyUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2NvbnRleHQtcHJvdmlkZXJzL3NzbS1wYXJhbWV0ZXJzJztcbmltcG9ydCB7IEZBS0VfQ1JFREVOVElBTF9DSEFJTiwgTW9ja1Nka1Byb3ZpZGVyLCBtb2NrU1NNQ2xpZW50LCByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuY29uc3QgbW9ja1NESyA9IG5ldyAoY2xhc3MgZXh0ZW5kcyBNb2NrU2RrUHJvdmlkZXIge1xuICBwdWJsaWMgZm9yRW52aXJvbm1lbnQoKTogUHJvbWlzZTxTZGtGb3JFbnZpcm9ubWVudD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBzZGs6IG5ldyBTREsoRkFLRV9DUkVERU5USUFMX0NIQUlOLCBtb2NrU0RLLmRlZmF1bHRSZWdpb24sIHt9KSwgZGlkQXNzdW1lUm9sZTogZmFsc2UgfSk7XG4gIH1cbn0pKCk7XG5cbmRlc2NyaWJlKCdzc21QYXJhbWV0ZXJzJywgKCkgPT4ge1xuICB0ZXN0KCdyZXR1cm5zIHZhbHVlJywgYXN5bmMgKCkgPT4ge1xuICAgIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCgpO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNTTUNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIG1vY2tTU01DbGllbnQub24oR2V0UGFyYW1ldGVyQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgUGFyYW1ldGVyOiB7XG4gICAgICAgIFZhbHVlOiAnYmFyJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgdmFsdWUgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgcGFyYW1ldGVyTmFtZTogJ2ZvbycsXG4gICAgfSk7XG5cbiAgICBleHBlY3QodmFsdWUpLnRvRXF1YWwoJ2JhcicpO1xuICB9KTtcblxuICB0ZXN0KCdlcnJvcnMgd2hlbiBwYXJhbWV0ZXIgaXMgbm90IGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAgIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCgpO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNTTUNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIGNvbnN0IG5vdEZvdW5kID0gbmV3IEVycm9yKCdQYXJhbWV0ZXIgbm90IGZvdW5kJyk7XG4gICAgbm90Rm91bmQubmFtZSA9ICdQYXJhbWV0ZXJOb3RGb3VuZCc7XG4gICAgbW9ja1NTTUNsaWVudC5vbihHZXRQYXJhbWV0ZXJDb21tYW5kKS5yZWplY3RzKG5vdEZvdW5kKTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgcGFyYW1ldGVyTmFtZTogJ2ZvbycsXG4gICAgICB9KSkucmVqZWN0cy50b1Rocm93KC9TU00gcGFyYW1ldGVyIG5vdCBhdmFpbGFibGUgaW4gYWNjb3VudC8pO1xuICB9KTtcbn0pO1xuIl19