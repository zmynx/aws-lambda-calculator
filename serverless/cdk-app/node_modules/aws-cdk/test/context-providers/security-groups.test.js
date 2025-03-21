"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ec2_1 = require("@aws-sdk/client-ec2");
const lib_1 = require("../../lib");
const security_groups_1 = require("../../lib/context-providers/security-groups");
const mock_sdk_1 = require("../util/mock-sdk");
const mockSDK = new (class extends mock_sdk_1.MockSdkProvider {
    forEnvironment() {
        return Promise.resolve({ sdk: new lib_1.SDK(mock_sdk_1.FAKE_CREDENTIAL_CHAIN, mockSDK.defaultRegion, {}), didAssumeRole: false });
    }
})();
beforeEach(() => {
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeSecurityGroupsCommand).resolves({
        SecurityGroups: [
            {
                GroupId: 'sg-1234',
                IpPermissionsEgress: [
                    {
                        IpProtocol: '-1',
                        IpRanges: [{ CidrIp: '0.0.0.0/0' }],
                    },
                    {
                        IpProtocol: '-1',
                        Ipv6Ranges: [{ CidrIpv6: '::/0' }],
                    },
                ],
            },
        ],
    });
});
describe('security group context provider plugin', () => {
    test('errors when no matches are found', async () => {
        // GIVEN
        (0, mock_sdk_1.restoreSdkMocksToDefault)();
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        })).rejects.toThrow(/No security groups found/i);
    });
    test('looks up by security group id', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(true);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            GroupIds: ['sg-1234'],
        });
    });
    test('looks up by security group id and vpc id', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
            vpcId: 'vpc-1234567',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(true);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            GroupIds: ['sg-1234'],
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-1234567'],
                },
            ],
        });
    });
    test('looks up by security group name', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupName: 'my-security-group',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(true);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            Filters: [
                {
                    Name: 'group-name',
                    Values: ['my-security-group'],
                },
            ],
        });
    });
    test('looks up by security group name and vpc id', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupName: 'my-security-group',
            vpcId: 'vpc-1234567',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(true);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            Filters: [
                {
                    Name: 'vpc-id',
                    Values: ['vpc-1234567'],
                },
                {
                    Name: 'group-name',
                    Values: ['my-security-group'],
                },
            ],
        });
    });
    test('detects non all-outbound egress', async () => {
        // GIVEN
        mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeSecurityGroupsCommand).resolves({
            SecurityGroups: [
                {
                    GroupId: 'sg-1234',
                    IpPermissionsEgress: [
                        {
                            IpProtocol: '-1',
                            IpRanges: [{ CidrIp: '10.0.0.0/16' }],
                        },
                    ],
                },
            ],
        });
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        const res = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        });
        // THEN
        expect(res.securityGroupId).toEqual('sg-1234');
        expect(res.allowAllOutbound).toEqual(false);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            GroupIds: ['sg-1234'],
        });
    });
    test('errors when more than one security group is found', async () => {
        // GIVEN
        mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeSecurityGroupsCommand).resolves({
            SecurityGroups: [
                {
                    GroupId: 'sg-1234',
                    IpPermissionsEgress: [
                        {
                            IpProtocol: '-1',
                            IpRanges: [{ CidrIp: '10.0.0.0/16' }],
                        },
                    ],
                },
                {
                    GroupId: 'sg-1234',
                    IpPermissionsEgress: [
                        {
                            IpProtocol: '-1',
                            IpRanges: [{ CidrIp: '10.0.0.0/16' }],
                        },
                    ],
                },
            ],
        });
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
        })).rejects.toThrow(/\More than one security groups found matching/i);
        expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSecurityGroupsCommand, {
            GroupIds: ['sg-1234'],
        });
    });
    test('errors when securityGroupId and securityGroupName are specified both', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            securityGroupId: 'sg-1234',
            securityGroupName: 'my-security-group',
        })).rejects.toThrow(/\'securityGroupId\' and \'securityGroupName\' can not be specified both when looking up a security group/i);
    });
    test('errors when neither securityGroupId nor securityGroupName are specified', async () => {
        // GIVEN
        const provider = new security_groups_1.SecurityGroupContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
        })).rejects.toThrow(/\'securityGroupId\' or \'securityGroupName\' must be specified to look up a security group/i);
    });
    test('identifies allTrafficEgress from SecurityGroup permissions', () => {
        expect((0, security_groups_1.hasAllTrafficEgress)({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [{ CidrIp: '0.0.0.0/0' }],
                },
                {
                    IpProtocol: '-1',
                    Ipv6Ranges: [{ CidrIpv6: '::/0' }],
                },
            ],
        })).toBe(true);
    });
    test('identifies allTrafficEgress from SecurityGroup permissions when combined', () => {
        expect((0, security_groups_1.hasAllTrafficEgress)({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [{ CidrIp: '0.0.0.0/0' }],
                    Ipv6Ranges: [{ CidrIpv6: '::/0' }],
                },
            ],
        })).toBe(true);
    });
    test('identifies lacking allTrafficEgress from SecurityGroup permissions', () => {
        expect((0, security_groups_1.hasAllTrafficEgress)({
            IpPermissionsEgress: [
                {
                    IpProtocol: '-1',
                    IpRanges: [{ CidrIp: '10.0.0.0/16' }],
                },
            ],
        })).toBe(false);
        expect((0, security_groups_1.hasAllTrafficEgress)({
            IpPermissions: [
                {
                    IpProtocol: 'TCP',
                    IpRanges: [{ CidrIp: '0.0.0.0/0' }],
                },
            ],
        })).toBe(false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktZ3JvdXBzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1ncm91cHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUFvRTtBQUNwRSxtQ0FBd0Q7QUFDeEQsaUZBQXNIO0FBQ3RILCtDQUFtSDtBQUVuSCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBTSxTQUFRLDBCQUFlO0lBQ3pDLGNBQWM7UUFDbkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksU0FBRyxDQUFDLGdDQUFxQixFQUFFLE9BQU8sQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDbkgsQ0FBQztDQUNGLENBQUMsRUFBRSxDQUFDO0FBRUwsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLElBQUEsbUNBQXdCLEdBQUUsQ0FBQztJQUMzQix3QkFBYSxDQUFDLEVBQUUsQ0FBQywwQ0FBNkIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUN2RCxjQUFjLEVBQUU7WUFDZDtnQkFDRSxPQUFPLEVBQUUsU0FBUztnQkFDbEIsbUJBQW1CLEVBQUU7b0JBQ25CO3dCQUNFLFVBQVUsRUFBRSxJQUFJO3dCQUNoQixRQUFRLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQztxQkFDcEM7b0JBQ0Q7d0JBQ0UsVUFBVSxFQUFFLElBQUk7d0JBQ2hCLFVBQVUsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDO3FCQUNuQztpQkFDRjthQUNGO1NBQ0Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyx3Q0FBd0MsRUFBRSxHQUFHLEVBQUU7SUFDdEQsSUFBSSxDQUFDLGtDQUFrQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2xELFFBQVE7UUFDUixJQUFBLG1DQUF3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QUFDO1lBQ2xCLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxVQUFVLEVBQUUsSUFBSTtvQkFDaEIsUUFBUSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLENBQUM7aUJBQ3RDO2FBQ0Y7U0FDRixDQUFDLENBQ0gsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFZCxNQUFNLENBQ0osSUFBQSxxQ0FBbUIsRUFBQztZQUNsQixhQUFhLEVBQUU7Z0JBQ2I7b0JBQ0UsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDO2lCQUNwQzthQUNGO1NBQ0YsQ0FBQyxDQUNILENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZXNjcmliZVNlY3VyaXR5R3JvdXBzQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1lYzInO1xuaW1wb3J0IHsgU0RLLCB0eXBlIFNka0ZvckVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vbGliJztcbmltcG9ydCB7IGhhc0FsbFRyYWZmaWNFZ3Jlc3MsIFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuLi8uLi9saWIvY29udGV4dC1wcm92aWRlcnMvc2VjdXJpdHktZ3JvdXBzJztcbmltcG9ydCB7IEZBS0VfQ1JFREVOVElBTF9DSEFJTiwgTW9ja1Nka1Byb3ZpZGVyLCBtb2NrRUMyQ2xpZW50LCByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQgfSBmcm9tICcuLi91dGlsL21vY2stc2RrJztcblxuY29uc3QgbW9ja1NESyA9IG5ldyAoY2xhc3MgZXh0ZW5kcyBNb2NrU2RrUHJvdmlkZXIge1xuICBwdWJsaWMgZm9yRW52aXJvbm1lbnQoKTogUHJvbWlzZTxTZGtGb3JFbnZpcm9ubWVudD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBzZGs6IG5ldyBTREsoRkFLRV9DUkVERU5USUFMX0NIQUlOLCBtb2NrU0RLLmRlZmF1bHRSZWdpb24sIHt9KSwgZGlkQXNzdW1lUm9sZTogZmFsc2UgfSk7XG4gIH1cbn0pKCk7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZVNlY3VyaXR5R3JvdXBzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFNlY3VyaXR5R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIEdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgICAgSXBQZXJtaXNzaW9uc0VncmVzczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcFJhbmdlczogW3sgQ2lkcklwOiAnMC4wLjAuMC8wJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcHY2UmFuZ2VzOiBbeyBDaWRySXB2NjogJzo6LzAnIH1dLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdzZWN1cml0eSBncm91cCBjb250ZXh0IHByb3ZpZGVyIHBsdWdpbicsICgpID0+IHtcbiAgdGVzdCgnZXJyb3JzIHdoZW4gbm8gbWF0Y2hlcyBhcmUgZm91bmQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBTZWN1cml0eUdyb3VwQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBzZWN1cml0eUdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KC9ObyBzZWN1cml0eSBncm91cHMgZm91bmQvaSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IHNlY3VyaXR5IGdyb3VwIGlkJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgU2VjdXJpdHlHcm91cENvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCByZXMgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgc2VjdXJpdHlHcm91cElkOiAnc2ctMTIzNCcsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHJlcy5zZWN1cml0eUdyb3VwSWQpLnRvRXF1YWwoJ3NnLTEyMzQnKTtcbiAgICBleHBlY3QocmVzLmFsbG93QWxsT3V0Ym91bmQpLnRvRXF1YWwodHJ1ZSk7XG4gICAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTZWN1cml0eUdyb3Vwc0NvbW1hbmQsIHtcbiAgICAgIEdyb3VwSWRzOiBbJ3NnLTEyMzQnXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgc2VjdXJpdHkgZ3JvdXAgaWQgYW5kIHZwYyBpZCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgcmVzID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIHNlY3VyaXR5R3JvdXBJZDogJ3NnLTEyMzQnLFxuICAgICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHJlcy5zZWN1cml0eUdyb3VwSWQpLnRvRXF1YWwoJ3NnLTEyMzQnKTtcbiAgICBleHBlY3QocmVzLmFsbG93QWxsT3V0Ym91bmQpLnRvRXF1YWwodHJ1ZSk7XG4gICAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTZWN1cml0eUdyb3Vwc0NvbW1hbmQsIHtcbiAgICAgIEdyb3VwSWRzOiBbJ3NnLTEyMzQnXSxcbiAgICAgIEZpbHRlcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIE5hbWU6ICd2cGMtaWQnLFxuICAgICAgICAgIFZhbHVlczogWyd2cGMtMTIzNDU2NyddLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgc2VjdXJpdHkgZ3JvdXAgbmFtZScsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgcmVzID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiAnbXktc2VjdXJpdHktZ3JvdXAnLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChyZXMuc2VjdXJpdHlHcm91cElkKS50b0VxdWFsKCdzZy0xMjM0Jyk7XG4gICAgZXhwZWN0KHJlcy5hbGxvd0FsbE91dGJvdW5kKS50b0VxdWFsKHRydWUpO1xuICAgIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU2VjdXJpdHlHcm91cHNDb21tYW5kLCB7XG4gICAgICBGaWx0ZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBOYW1lOiAnZ3JvdXAtbmFtZScsXG4gICAgICAgICAgVmFsdWVzOiBbJ215LXNlY3VyaXR5LWdyb3VwJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSBzZWN1cml0eSBncm91cCBuYW1lIGFuZCB2cGMgaWQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBTZWN1cml0eUdyb3VwQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogJ215LXNlY3VyaXR5LWdyb3VwJyxcbiAgICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChyZXMuc2VjdXJpdHlHcm91cElkKS50b0VxdWFsKCdzZy0xMjM0Jyk7XG4gICAgZXhwZWN0KHJlcy5hbGxvd0FsbE91dGJvdW5kKS50b0VxdWFsKHRydWUpO1xuICAgIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU2VjdXJpdHlHcm91cHNDb21tYW5kLCB7XG4gICAgICBGaWx0ZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBOYW1lOiAndnBjLWlkJyxcbiAgICAgICAgICBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIE5hbWU6ICdncm91cC1uYW1lJyxcbiAgICAgICAgICBWYWx1ZXM6IFsnbXktc2VjdXJpdHktZ3JvdXAnXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2RldGVjdHMgbm9uIGFsbC1vdXRib3VuZCBlZ3Jlc3MnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRUMyQ2xpZW50Lm9uKERlc2NyaWJlU2VjdXJpdHlHcm91cHNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBTZWN1cml0eUdyb3VwczogW1xuICAgICAgICB7XG4gICAgICAgICAgR3JvdXBJZDogJ3NnLTEyMzQnLFxuICAgICAgICAgIElwUGVybWlzc2lvbnNFZ3Jlc3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgSXBQcm90b2NvbDogJy0xJyxcbiAgICAgICAgICAgICAgSXBSYW5nZXM6IFt7IENpZHJJcDogJzEwLjAuMC4wLzE2JyB9XSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgU2VjdXJpdHlHcm91cENvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCByZXMgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgc2VjdXJpdHlHcm91cElkOiAnc2ctMTIzNCcsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHJlcy5zZWN1cml0eUdyb3VwSWQpLnRvRXF1YWwoJ3NnLTEyMzQnKTtcbiAgICBleHBlY3QocmVzLmFsbG93QWxsT3V0Ym91bmQpLnRvRXF1YWwoZmFsc2UpO1xuICAgIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU2VjdXJpdHlHcm91cHNDb21tYW5kLCB7XG4gICAgICBHcm91cElkczogWydzZy0xMjM0J10sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2Vycm9ycyB3aGVuIG1vcmUgdGhhbiBvbmUgc2VjdXJpdHkgZ3JvdXAgaXMgZm91bmQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRUMyQ2xpZW50Lm9uKERlc2NyaWJlU2VjdXJpdHlHcm91cHNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBTZWN1cml0eUdyb3VwczogW1xuICAgICAgICB7XG4gICAgICAgICAgR3JvdXBJZDogJ3NnLTEyMzQnLFxuICAgICAgICAgIElwUGVybWlzc2lvbnNFZ3Jlc3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgSXBQcm90b2NvbDogJy0xJyxcbiAgICAgICAgICAgICAgSXBSYW5nZXM6IFt7IENpZHJJcDogJzEwLjAuMC4wLzE2JyB9XSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgICAgICBJcFBlcm1pc3Npb25zRWdyZXNzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICAgIElwUmFuZ2VzOiBbeyBDaWRySXA6ICcxMC4wLjAuMC8xNicgfV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBJZDogJ3NnLTEyMzQnLFxuICAgICAgfSksXG4gICAgKS5yZWplY3RzLnRvVGhyb3coL1xcTW9yZSB0aGFuIG9uZSBzZWN1cml0eSBncm91cHMgZm91bmQgbWF0Y2hpbmcvaSk7XG4gICAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTZWN1cml0eUdyb3Vwc0NvbW1hbmQsIHtcbiAgICAgIEdyb3VwSWRzOiBbJ3NnLTEyMzQnXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gc2VjdXJpdHlHcm91cElkIGFuZCBzZWN1cml0eUdyb3VwTmFtZSBhcmUgc3BlY2lmaWVkIGJvdGgnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBTZWN1cml0eUdyb3VwQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBzZWN1cml0eUdyb3VwSWQ6ICdzZy0xMjM0JyxcbiAgICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdteS1zZWN1cml0eS1ncm91cCcsXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdyhcbiAgICAgIC9cXCdzZWN1cml0eUdyb3VwSWRcXCcgYW5kIFxcJ3NlY3VyaXR5R3JvdXBOYW1lXFwnIGNhbiBub3QgYmUgc3BlY2lmaWVkIGJvdGggd2hlbiBsb29raW5nIHVwIGEgc2VjdXJpdHkgZ3JvdXAvaSxcbiAgICApO1xuICB9KTtcblxuICB0ZXN0KCdlcnJvcnMgd2hlbiBuZWl0aGVyIHNlY3VyaXR5R3JvdXBJZCBub3Igc2VjdXJpdHlHcm91cE5hbWUgYXJlIHNwZWNpZmllZCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IFNlY3VyaXR5R3JvdXBDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdygvXFwnc2VjdXJpdHlHcm91cElkXFwnIG9yIFxcJ3NlY3VyaXR5R3JvdXBOYW1lXFwnIG11c3QgYmUgc3BlY2lmaWVkIHRvIGxvb2sgdXAgYSBzZWN1cml0eSBncm91cC9pKTtcbiAgfSk7XG5cbiAgdGVzdCgnaWRlbnRpZmllcyBhbGxUcmFmZmljRWdyZXNzIGZyb20gU2VjdXJpdHlHcm91cCBwZXJtaXNzaW9ucycsICgpID0+IHtcbiAgICBleHBlY3QoXG4gICAgICBoYXNBbGxUcmFmZmljRWdyZXNzKHtcbiAgICAgICAgSXBQZXJtaXNzaW9uc0VncmVzczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcFJhbmdlczogW3sgQ2lkcklwOiAnMC4wLjAuMC8wJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcHY2UmFuZ2VzOiBbeyBDaWRySXB2NjogJzo6LzAnIH1dLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICApLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2lkZW50aWZpZXMgYWxsVHJhZmZpY0VncmVzcyBmcm9tIFNlY3VyaXR5R3JvdXAgcGVybWlzc2lvbnMgd2hlbiBjb21iaW5lZCcsICgpID0+IHtcbiAgICBleHBlY3QoXG4gICAgICBoYXNBbGxUcmFmZmljRWdyZXNzKHtcbiAgICAgICAgSXBQZXJtaXNzaW9uc0VncmVzczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICctMScsXG4gICAgICAgICAgICBJcFJhbmdlczogW3sgQ2lkcklwOiAnMC4wLjAuMC8wJyB9XSxcbiAgICAgICAgICAgIElwdjZSYW5nZXM6IFt7IENpZHJJcHY2OiAnOjovMCcgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICkudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgdGVzdCgnaWRlbnRpZmllcyBsYWNraW5nIGFsbFRyYWZmaWNFZ3Jlc3MgZnJvbSBTZWN1cml0eUdyb3VwIHBlcm1pc3Npb25zJywgKCkgPT4ge1xuICAgIGV4cGVjdChcbiAgICAgIGhhc0FsbFRyYWZmaWNFZ3Jlc3Moe1xuICAgICAgICBJcFBlcm1pc3Npb25zRWdyZXNzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBQcm90b2NvbDogJy0xJyxcbiAgICAgICAgICAgIElwUmFuZ2VzOiBbeyBDaWRySXA6ICcxMC4wLjAuMC8xNicgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICkudG9CZShmYWxzZSk7XG5cbiAgICBleHBlY3QoXG4gICAgICBoYXNBbGxUcmFmZmljRWdyZXNzKHtcbiAgICAgICAgSXBQZXJtaXNzaW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwUHJvdG9jb2w6ICdUQ1AnLFxuICAgICAgICAgICAgSXBSYW5nZXM6IFt7IENpZHJJcDogJzAuMC4wLjAvMCcgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICkudG9CZShmYWxzZSk7XG4gIH0pO1xufSk7XG4iXX0=