"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ec2_1 = require("@aws-sdk/client-ec2");
const vpcs_1 = require("../../lib/context-providers/vpcs");
const mock_sdk_1 = require("../util/mock-sdk");
const mockSDK = new mock_sdk_1.MockSdkProvider();
beforeEach(() => {
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeVpcsCommand)
        .resolves({
        Vpcs: [{ VpcId: 'vpc-1234567', CidrBlock: '1.1.1.1/16', OwnerId: '123456789012' }],
    })
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [
            { SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: true },
            { SubnetId: 'sub-789012', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false },
        ],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '1.1.1.1/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
            {
                Associations: [{ SubnetId: 'sub-789012' }],
                RouteTableId: 'rtb-789012',
                Routes: [
                    {
                        DestinationCidrBlock: '1.1.2.1/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        NatGatewayId: 'nat-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({
        VpnGateways: [{ VpnGatewayId: 'gw-abcdef' }],
    });
});
test('looks up the requested VPC', async () => {
    // GIVEN
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        privateSubnetIds: ['sub-789012'],
        privateSubnetNames: ['Private'],
        privateSubnetRouteTableIds: ['rtb-789012'],
        publicSubnetIds: ['sub-123456'],
        publicSubnetNames: ['Public'],
        publicSubnetRouteTableIds: ['rtb-123456'],
        vpnGatewayId: 'gw-abcdef',
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('throws when no such VPC is found', async () => {
    // GIVEN
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeVpcsCommand).resolves({});
    // WHEN
    await expect(provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    })).rejects.toThrow(/Could not find any VPCs matching/);
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
});
test('throws when subnet with subnetGroupNameTag not found', async () => {
    // GIVEN
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    await expect(provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        subnetGroupNameTag: 'DOES_NOT_EXIST',
        filter,
    })).rejects.toThrow(/Invalid subnetGroupNameTag: Subnet .* does not have an associated tag with Key='DOES_NOT_EXIST'/);
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
});
test('does not throw when subnet with subnetGroupNameTag is found', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeSubnetsCommand).resolves({
        Subnets: [
            {
                SubnetId: 'sub-123456',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: true,
                Tags: [{ Key: 'DOES_EXIST', Value: 'SubnetName1' }],
            },
            {
                SubnetId: 'sub-789012',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: false,
                Tags: [{ Key: 'DOES_EXIST', Value: 'SubnetName2' }],
            },
        ],
    });
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        subnetGroupNameTag: 'DOES_EXIST',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        privateSubnetIds: ['sub-789012'],
        privateSubnetNames: ['SubnetName2'],
        privateSubnetRouteTableIds: ['rtb-789012'],
        publicSubnetIds: ['sub-123456'],
        publicSubnetNames: ['SubnetName1'],
        publicSubnetRouteTableIds: ['rtb-123456'],
        vpnGatewayId: 'gw-abcdef',
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('throws when multiple VPCs are found', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeVpcsCommand).resolves({
        Vpcs: [{ VpcId: 'vpc-1' }, { VpcId: 'vpc-2' }],
    });
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    await expect(provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    })).rejects.toThrow(/Found 2 VPCs matching/);
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
});
test('uses the VPC main route table when a subnet has no specific association', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeRouteTablesCommand).resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '1.1.1.1/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
            {
                Associations: [{ Main: true }],
                RouteTableId: 'rtb-789012',
                Routes: [
                    {
                        DestinationCidrBlock: '1.1.2.1/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        NatGatewayId: 'nat-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    });
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        privateSubnetIds: ['sub-789012'],
        privateSubnetNames: ['Private'],
        privateSubnetRouteTableIds: ['rtb-789012'],
        publicSubnetIds: ['sub-123456'],
        publicSubnetNames: ['Public'],
        publicSubnetRouteTableIds: ['rtb-123456'],
        vpnGatewayId: 'gw-abcdef',
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('Recognize public subnet by route table', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [{ SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false }],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '10.0.2.0/26',
                        Origin: 'CreateRoute',
                        State: 'active',
                        VpcPeeringConnectionId: 'pcx-xxxxxx',
                    },
                    {
                        DestinationCidrBlock: '10.0.1.0/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({});
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        publicSubnetIds: ['sub-123456'],
        publicSubnetNames: ['Public'],
        publicSubnetRouteTableIds: ['rtb-123456'],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('Recognize private subnet by route table with NAT Gateway', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [{ SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false }],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '10.0.2.0/26',
                        Origin: 'CreateRoute',
                        State: 'active',
                        VpcPeeringConnectionId: 'pcx-xxxxxx',
                    },
                    {
                        DestinationCidrBlock: '10.0.1.0/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        NatGatewayId: 'nat-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({});
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        privateSubnetIds: ['sub-123456'],
        privateSubnetNames: ['Private'],
        privateSubnetRouteTableIds: ['rtb-123456'],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('Recognize private subnet by route table with Transit Gateway', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [{ SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false }],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '10.0.2.0/26',
                        Origin: 'CreateRoute',
                        State: 'active',
                        VpcPeeringConnectionId: 'pcx-xxxxxx',
                    },
                    {
                        DestinationCidrBlock: '10.0.1.0/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        TransitGatewayId: 'tgw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({});
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        privateSubnetIds: ['sub-123456'],
        privateSubnetNames: ['Private'],
        privateSubnetRouteTableIds: ['rtb-123456'],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
test('Recognize isolated subnet by route table', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [{ SubnetId: 'sub-123456', AvailabilityZone: 'bermuda-triangle-1337', MapPublicIpOnLaunch: false }],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '10.0.1.0/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                ],
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({});
    const filter = { foo: 'bar' };
    const provider = new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK);
    // WHEN
    const result = await provider.getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter,
    });
    // THEN
    expect(result).toEqual({
        vpcId: 'vpc-1234567',
        vpcCidrBlock: '1.1.1.1/16',
        ownerAccountId: '123456789012',
        availabilityZones: ['bermuda-triangle-1337'],
        isolatedSubnetIds: ['sub-123456'],
        isolatedSubnetNames: ['Isolated'],
        isolatedSubnetRouteTableIds: ['rtb-123456'],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeSubnetsCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeRouteTablesCommand, {
        Filters: [{ Name: 'vpc-id', Values: ['vpc-1234567'] }],
    });
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpnGatewaysCommand, {
        Filters: [
            { Name: 'attachment.vpc-id', Values: ['vpc-1234567'] },
            { Name: 'attachment.state', Values: ['attached'] },
            { Name: 'state', Values: ['available'] },
        ],
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnBjcy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidnBjcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsb0RBSzZCO0FBQzdCLDJEQUFtRjtBQUNuRiwrQ0FBNEY7QUFFNUYsTUFBTSxPQUFPLEdBQUcsSUFBSSwwQkFBZSxFQUFFLENBQUM7QUFFdEMsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLElBQUEsbUNBQXdCLEdBQUUsQ0FBQztJQUMzQix3QkFBYTtTQUNWLEVBQUUsQ0FBQyxnQ0FBbUIsQ0FBQztTQUN2QixRQUFRLENBQUM7UUFDUixJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLENBQUM7S0FDbkYsQ0FBQztTQUNELEVBQUUsQ0FBQyxtQ0FBc0IsQ0FBQztTQUMxQixRQUFRLENBQUM7UUFDUixPQUFPLEVBQUU7WUFDUCxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFO1lBQ2hHLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSx1QkFBdUIsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUU7U0FDbEc7S0FDRixDQUFDO1NBQ0QsRUFBRSxDQUFDLHVDQUEwQixDQUFDO1NBQzlCLFFBQVEsQ0FBQztRQUNSLFdBQVcsRUFBRTtZQUNYO2dCQUNFLFlBQVksRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxDQUFDO2dCQUMxQyxZQUFZLEVBQUUsWUFBWTtnQkFDMUIsTUFBTSxFQUFFO29CQUNOO3dCQUNFLG9CQUFvQixFQUFFLFlBQVk7d0JBQ2xDLFNBQVMsRUFBRSxPQUFPO3dCQUNsQixNQUFNLEVBQUUsa0JBQWtCO3dCQUMxQixLQUFLLEVBQUUsUUFBUTtxQkFDaEI7b0JBQ0Q7d0JBQ0Usb0JBQW9CLEVBQUUs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LENBQUM7SUFDSCxNQUFNLENBQUMsd0JBQWEsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLHVDQUEwQixFQUFFO1FBQzFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0tBQ3ZELENBQUMsQ0FBQztJQUNILE1BQU0sQ0FBQyx3QkFBYSxDQUFDLENBQUMseUJBQXlCLENBQUMsdUNBQTBCLEVBQUU7UUFDMUUsT0FBTyxFQUFFO1lBQ1AsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxFQUFFLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDdEQsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDbEQsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1NBQ3pDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCxcbiAgRGVzY3JpYmVTdWJuZXRzQ29tbWFuZCxcbiAgRGVzY3JpYmVWcGNzQ29tbWFuZCxcbiAgRGVzY3JpYmVWcG5HYXRld2F5c0NvbW1hbmQsXG59IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1lYzInO1xuaW1wb3J0IHsgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbiB9IGZyb20gJy4uLy4uL2xpYi9jb250ZXh0LXByb3ZpZGVycy92cGNzJztcbmltcG9ydCB7IE1vY2tTZGtQcm92aWRlciwgbW9ja0VDMkNsaWVudCwgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0IH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmNvbnN0IG1vY2tTREsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgbW9ja0VDMkNsaWVudFxuICAgIC5vbihEZXNjcmliZVZwY3NDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBWcGNzOiBbeyBWcGNJZDogJ3ZwYy0xMjM0NTY3JywgQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsIE93bmVySWQ6ICcxMjM0NTY3ODkwMTInIH1dLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFtcbiAgICAgICAgeyBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnLCBBdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JywgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSB9LFxuICAgICAgICB7IFN1Ym5ldElkOiAnc3ViLTc4OTAxMicsIEF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgUm91dGVUYWJsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItMTIzNDU2JyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxLjEuMS4xLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBHYXRld2F5SWQ6ICdpZ3cteHh4eHh4JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAnc3ViLTc4OTAxMicgfV0sXG4gICAgICAgICAgUm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgUm91dGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcsXG4gICAgICAgICAgICAgIEdhdGV3YXlJZDogJ2xvY2FsJyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGVUYWJsZScsXG4gICAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMC4wLjAuMC8wJyxcbiAgICAgICAgICAgICAgTmF0R2F0ZXdheUlkOiAnbmF0LXh4eHh4eCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVZwbkdhdGV3YXlzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgVnBuR2F0ZXdheXM6IFt7IFZwbkdhdGV3YXlJZDogJ2d3LWFiY2RlZicgfV0sXG4gICAgfSk7XG59KTtcblxudGVzdCgnbG9va3MgdXAgdGhlIHJlcXVlc3RlZCBWUEMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGZpbHRlciA9IHsgZm9vOiAnYmFyJyB9O1xuICBjb25zdCBwcm92aWRlciA9IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZmlsdGVyLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwY0NpZHJCbG9jazogJzEuMS4xLjEvMTYnLFxuICAgIG93bmVyQWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICBhdmFpbGFiaWxpdHlab25lczogWydiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnXSxcbiAgICBwcml2YXRlU3VibmV0SWRzOiBbJ3N1Yi03ODkwMTInXSxcbiAgICBwcml2YXRlU3VibmV0TmFtZXM6IFsnUHJpdmF0ZSddLFxuICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiBbJ3J0Yi03ODkwMTInXSxcbiAgICBwdWJsaWNTdWJuZXRJZHM6IFsnc3ViLTEyMzQ1NiddLFxuICAgIHB1YmxpY1N1Ym5ldE5hbWVzOiBbJ1B1YmxpYyddLFxuICAgIHB1YmxpY1N1Ym5ldFJvdXRlVGFibGVJZHM6IFsncnRiLTEyMzQ1NiddLFxuICAgIHZwbkdhdGV3YXlJZDogJ2d3LWFiY2RlZicsXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ3Rocm93cyB3aGVuIG5vIHN1Y2ggVlBDIGlzIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBjb25zdCBmaWx0ZXIgPSB7IGZvbzogJ2JhcicgfTtcbiAgY29uc3QgcHJvdmlkZXIgPSBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZVZwY3NDb21tYW5kKS5yZXNvbHZlcyh7fSk7XG5cbiAgLy8gV0hFTlxuICBhd2FpdCBleHBlY3QoXG4gICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgZmlsdGVyLFxuICAgIH0pLFxuICApLnJlamVjdHMudG9UaHJvdygvQ291bGQgbm90IGZpbmQgYW55IFZQQ3MgbWF0Y2hpbmcvKTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcGNzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICdmb28nLCBWYWx1ZXM6IFsnYmFyJ10gfV0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ3Rocm93cyB3aGVuIHN1Ym5ldCB3aXRoIHN1Ym5ldEdyb3VwTmFtZVRhZyBub3QgZm91bmQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIGNvbnN0IGZpbHRlciA9IHsgZm9vOiAnYmFyJyB9O1xuICBjb25zdCBwcm92aWRlciA9IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZXhwZWN0KFxuICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIHN1Ym5ldEdyb3VwTmFtZVRhZzogJ0RPRVNfTk9UX0VYSVNUJyxcbiAgICAgIGZpbHRlcixcbiAgICB9KSxcbiAgKS5yZWplY3RzLnRvVGhyb3coL0ludmFsaWQgc3VibmV0R3JvdXBOYW1lVGFnOiBTdWJuZXQgLiogZG9lcyBub3QgaGF2ZSBhbiBhc3NvY2lhdGVkIHRhZyB3aXRoIEtleT0nRE9FU19OT1RfRVhJU1QnLyk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBjc0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAnZm9vJywgVmFsdWVzOiBbJ2JhciddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTdWJuZXRzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ3ZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH1dLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdkb2VzIG5vdCB0aHJvdyB3aGVuIHN1Ym5ldCB3aXRoIHN1Ym5ldEdyb3VwTmFtZVRhZyBpcyBmb3VuZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZVN1Ym5ldHNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgU3VibmV0czogW1xuICAgICAge1xuICAgICAgICBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnLFxuICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgVGFnczogW3sgS2V5OiAnRE9FU19FWElTVCcsIFZhbHVlOiAnU3VibmV0TmFtZTEnIH1dLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgU3VibmV0SWQ6ICdzdWItNzg5MDEyJyxcbiAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlLFxuICAgICAgICBUYWdzOiBbeyBLZXk6ICdET0VTX0VYSVNUJywgVmFsdWU6ICdTdWJuZXROYW1lMicgfV0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuICBjb25zdCBmaWx0ZXIgPSB7IGZvbzogJ2JhcicgfTtcbiAgY29uc3QgcHJvdmlkZXIgPSBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIHN1Ym5ldEdyb3VwTmFtZVRhZzogJ0RPRVNfRVhJU1QnLFxuICAgIGZpbHRlcixcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBvd25lckFjY291bnRJZDogJzEyMzQ1Njc4OTAxMicsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IFsnYmVybXVkYS10cmlhbmdsZS0xMzM3J10sXG4gICAgcHJpdmF0ZVN1Ym5ldElkczogWydzdWItNzg5MDEyJ10sXG4gICAgcHJpdmF0ZVN1Ym5ldE5hbWVzOiBbJ1N1Ym5ldE5hbWUyJ10sXG4gICAgcHJpdmF0ZVN1Ym5ldFJvdXRlVGFibGVJZHM6IFsncnRiLTc4OTAxMiddLFxuICAgIHB1YmxpY1N1Ym5ldElkczogWydzdWItMTIzNDU2J10sXG4gICAgcHVibGljU3VibmV0TmFtZXM6IFsnU3VibmV0TmFtZTEnXSxcbiAgICBwdWJsaWNTdWJuZXRSb3V0ZVRhYmxlSWRzOiBbJ3J0Yi0xMjM0NTYnXSxcbiAgICB2cG5HYXRld2F5SWQ6ICdndy1hYmNkZWYnLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcGNzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICdmb28nLCBWYWx1ZXM6IFsnYmFyJ10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVN1Ym5ldHNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ3ZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwbkdhdGV3YXlzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFtcbiAgICAgIHsgTmFtZTogJ2F0dGFjaG1lbnQudnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfSxcbiAgICAgIHsgTmFtZTogJ2F0dGFjaG1lbnQuc3RhdGUnLCBWYWx1ZXM6IFsnYXR0YWNoZWQnXSB9LFxuICAgICAgeyBOYW1lOiAnc3RhdGUnLCBWYWx1ZXM6IFsnYXZhaWxhYmxlJ10gfSxcbiAgICBdLFxuICB9KTtcbn0pO1xuXG50ZXN0KCd0aHJvd3Mgd2hlbiBtdWx0aXBsZSBWUENzIGFyZSBmb3VuZCcsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZVZwY3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgVnBjczogW3sgVnBjSWQ6ICd2cGMtMScgfSwgeyBWcGNJZDogJ3ZwYy0yJyB9XSxcbiAgfSk7XG4gIGNvbnN0IGZpbHRlciA9IHsgZm9vOiAnYmFyJyB9O1xuICBjb25zdCBwcm92aWRlciA9IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gIC8vIFdIRU5cbiAgYXdhaXQgZXhwZWN0KFxuICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGZpbHRlcixcbiAgICB9KSxcbiAgKS5yZWplY3RzLnRvVGhyb3coL0ZvdW5kIDIgVlBDcyBtYXRjaGluZy8pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG59KTtcblxudGVzdCgndXNlcyB0aGUgVlBDIG1haW4gcm91dGUgdGFibGUgd2hlbiBhIHN1Ym5ldCBoYXMgbm8gc3BlY2lmaWMgYXNzb2NpYXRpb24nLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnQub24oRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBSb3V0ZVRhYmxlczogW1xuICAgICAge1xuICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicgfV0sXG4gICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGVUYWJsZScsXG4gICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICBHYXRld2F5SWQ6ICdpZ3cteHh4eHh4JyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBNYWluOiB0cnVlIH1dLFxuICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgUm91dGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICAgIEdhdGV3YXlJZDogJ2xvY2FsJyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlVGFibGUnLFxuICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgTmF0R2F0ZXdheUlkOiAnbmF0LXh4eHh4eCcsXG4gICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG4gIGNvbnN0IGZpbHRlciA9IHsgZm9vOiAnYmFyJyB9O1xuICBjb25zdCBwcm92aWRlciA9IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZmlsdGVyLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwY0NpZHJCbG9jazogJzEuMS4xLjEvMTYnLFxuICAgIG93bmVyQWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICBhdmFpbGFiaWxpdHlab25lczogWydiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnXSxcbiAgICBwcml2YXRlU3VibmV0SWRzOiBbJ3N1Yi03ODkwMTInXSxcbiAgICBwcml2YXRlU3VibmV0TmFtZXM6IFsnUHJpdmF0ZSddLFxuICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiBbJ3J0Yi03ODkwMTInXSxcbiAgICBwdWJsaWNTdWJuZXRJZHM6IFsnc3ViLTEyMzQ1NiddLFxuICAgIHB1YmxpY1N1Ym5ldE5hbWVzOiBbJ1B1YmxpYyddLFxuICAgIHB1YmxpY1N1Ym5ldFJvdXRlVGFibGVJZHM6IFsncnRiLTEyMzQ1NiddLFxuICAgIHZwbkdhdGV3YXlJZDogJ2d3LWFiY2RlZicsXG4gIH0pO1xuXG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBjc0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAnZm9vJywgVmFsdWVzOiBbJ2JhciddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTdWJuZXRzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ3ZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcG5HYXRld2F5c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbXG4gICAgICB7IE5hbWU6ICdhdHRhY2htZW50LnZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH0sXG4gICAgICB7IE5hbWU6ICdhdHRhY2htZW50LnN0YXRlJywgVmFsdWVzOiBbJ2F0dGFjaGVkJ10gfSxcbiAgICAgIHsgTmFtZTogJ3N0YXRlJywgVmFsdWVzOiBbJ2F2YWlsYWJsZSddIH0sXG4gICAgXSxcbiAgfSk7XG59KTtcblxudGVzdCgnUmVjb2duaXplIHB1YmxpYyBzdWJuZXQgYnkgcm91dGUgdGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnRcbiAgICAub24oRGVzY3JpYmVTdWJuZXRzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgU3VibmV0czogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlIH1dLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBSb3V0ZVRhYmxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnIH1dLFxuICAgICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgIFJvdXRlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMi4wLzI2JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICAgIFZwY1BlZXJpbmdDb25uZWN0aW9uSWQ6ICdwY3gteHh4eHh4JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMTAuMC4xLjAvMjQnLFxuICAgICAgICAgICAgICBHYXRld2F5SWQ6ICdsb2NhbCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlVGFibGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICAgIEdhdGV3YXlJZDogJ2lndy14eHh4eHgnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAub24oRGVzY3JpYmVWcG5HYXRld2F5c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHt9KTtcbiAgY29uc3QgZmlsdGVyID0geyBmb286ICdiYXInIH07XG4gIGNvbnN0IHByb3ZpZGVyID0gbmV3IFZwY05ldHdvcmtDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXIsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KHJlc3VsdCkudG9FcXVhbCh7XG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgb3duZXJBY2NvdW50SWQ6ICcxMjM0NTY3ODkwMTInLFxuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNyddLFxuICAgIHB1YmxpY1N1Ym5ldElkczogWydzdWItMTIzNDU2J10sXG4gICAgcHVibGljU3VibmV0TmFtZXM6IFsnUHVibGljJ10sXG4gICAgcHVibGljU3VibmV0Um91dGVUYWJsZUlkczogWydydGItMTIzNDU2J10sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ1JlY29nbml6ZSBwcml2YXRlIHN1Ym5ldCBieSByb3V0ZSB0YWJsZSB3aXRoIE5BVCBHYXRld2F5JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrRUMyQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsIEF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSB9XSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgUm91dGVUYWJsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItMTIzNDU2JyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxMC4wLjIuMC8yNicsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgICBWcGNQZWVyaW5nQ29ubmVjdGlvbklkOiAncGN4LXh4eHh4eCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMS4wLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBOYXRHYXRld2F5SWQ6ICduYXQteHh4eHh4JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7fSk7XG4gIGNvbnN0IGZpbHRlciA9IHsgZm9vOiAnYmFyJyB9O1xuICBjb25zdCBwcm92aWRlciA9IG5ldyBWcGNOZXR3b3JrQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZmlsdGVyLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwY0NpZHJCbG9jazogJzEuMS4xLjEvMTYnLFxuICAgIG93bmVyQWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICBhdmFpbGFiaWxpdHlab25lczogWydiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnXSxcbiAgICBwcml2YXRlU3VibmV0SWRzOiBbJ3N1Yi0xMjM0NTYnXSxcbiAgICBwcml2YXRlU3VibmV0TmFtZXM6IFsnUHJpdmF0ZSddLFxuICAgIHByaXZhdGVTdWJuZXRSb3V0ZVRhYmxlSWRzOiBbJ3J0Yi0xMjM0NTYnXSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBjc0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAnZm9vJywgVmFsdWVzOiBbJ2JhciddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVTdWJuZXRzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ3ZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcG5HYXRld2F5c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbXG4gICAgICB7IE5hbWU6ICdhdHRhY2htZW50LnZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH0sXG4gICAgICB7IE5hbWU6ICdhdHRhY2htZW50LnN0YXRlJywgVmFsdWVzOiBbJ2F0dGFjaGVkJ10gfSxcbiAgICAgIHsgTmFtZTogJ3N0YXRlJywgVmFsdWVzOiBbJ2F2YWlsYWJsZSddIH0sXG4gICAgXSxcbiAgfSk7XG59KTtcblxudGVzdCgnUmVjb2duaXplIHByaXZhdGUgc3VibmV0IGJ5IHJvdXRlIHRhYmxlIHdpdGggVHJhbnNpdCBHYXRld2F5JywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrRUMyQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsIEF2YWlsYWJpbGl0eVpvbmU6ICdiZXJtdWRhLXRyaWFuZ2xlLTEzMzcnLCBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSB9XSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgUm91dGVUYWJsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItMTIzNDU2JyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxMC4wLjIuMC8yNicsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgICBWcGNQZWVyaW5nQ29ubmVjdGlvbklkOiAncGN4LXh4eHh4eCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMS4wLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBUcmFuc2l0R2F0ZXdheUlkOiAndGd3LXh4eHh4eCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVZwbkdhdGV3YXlzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe30pO1xuICBjb25zdCBmaWx0ZXIgPSB7IGZvbzogJ2JhcicgfTtcbiAgY29uc3QgcHJvdmlkZXIgPSBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIGZpbHRlcixcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBvd25lckFjY291bnRJZDogJzEyMzQ1Njc4OTAxMicsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IFsnYmVybXVkYS10cmlhbmdsZS0xMzM3J10sXG4gICAgcHJpdmF0ZVN1Ym5ldElkczogWydzdWItMTIzNDU2J10sXG4gICAgcHJpdmF0ZVN1Ym5ldE5hbWVzOiBbJ1ByaXZhdGUnXSxcbiAgICBwcml2YXRlU3VibmV0Um91dGVUYWJsZUlkczogWydydGItMTIzNDU2J10sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ1JlY29nbml6ZSBpc29sYXRlZCBzdWJuZXQgYnkgcm91dGUgdGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnRcbiAgICAub24oRGVzY3JpYmVTdWJuZXRzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgU3VibmV0czogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlIH1dLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBSb3V0ZVRhYmxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnIH1dLFxuICAgICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgIFJvdXRlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMS4wLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVZwbkdhdGV3YXlzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe30pO1xuICBjb25zdCBmaWx0ZXIgPSB7IGZvbzogJ2JhcicgfTtcbiAgY29uc3QgcHJvdmlkZXIgPSBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAvLyBXSEVOXG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgIGZpbHRlcixcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBvd25lckFjY291bnRJZDogJzEyMzQ1Njc4OTAxMicsXG4gICAgYXZhaWxhYmlsaXR5Wm9uZXM6IFsnYmVybXVkYS10cmlhbmdsZS0xMzM3J10sXG4gICAgaXNvbGF0ZWRTdWJuZXRJZHM6IFsnc3ViLTEyMzQ1NiddLFxuICAgIGlzb2xhdGVkU3VibmV0TmFtZXM6IFsnSXNvbGF0ZWQnXSxcbiAgICBpc29sYXRlZFN1Ym5ldFJvdXRlVGFibGVJZHM6IFsncnRiLTEyMzQ1NiddLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcGNzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICdmb28nLCBWYWx1ZXM6IFsnYmFyJ10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVN1Ym5ldHNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ3ZwYy1pZCcsIFZhbHVlczogWyd2cGMtMTIzNDU2NyddIH1dLFxuICB9KTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwbkdhdGV3YXlzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFtcbiAgICAgIHsgTmFtZTogJ2F0dGFjaG1lbnQudnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfSxcbiAgICAgIHsgTmFtZTogJ2F0dGFjaG1lbnQuc3RhdGUnLCBWYWx1ZXM6IFsnYXR0YWNoZWQnXSB9LFxuICAgICAgeyBOYW1lOiAnc3RhdGUnLCBWYWx1ZXM6IFsnYXZhaWxhYmxlJ10gfSxcbiAgICBdLFxuICB9KTtcbn0pO1xuIl19