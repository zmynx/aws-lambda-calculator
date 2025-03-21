"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ec2_1 = require("@aws-sdk/client-ec2");
const vpcs_1 = require("../../lib/context-providers/vpcs");
const mock_sdk_1 = require("../util/mock-sdk");
beforeEach(() => {
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeVpcsCommand)
        .resolves({
        Vpcs: [{ VpcId: 'vpc-1234567', CidrBlock: '1.1.1.1/16' }],
    })
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
    });
});
const mockSDK = new mock_sdk_1.MockSdkProvider();
test('looks up the requested (symmetric) VPC', async () => {
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [
            {
                SubnetId: 'sub-123456',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: true,
                CidrBlock: '1.1.1.1/24',
            },
            {
                SubnetId: 'sub-789012',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: false,
                CidrBlock: '1.1.2.1/24',
            },
        ],
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({ VpnGateways: [{ VpnGatewayId: 'gw-abcdef' }] });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
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
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'sub-789012',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: 'gw-abcdef',
    });
});
test('throws when no such VPC is found', async () => {
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeVpcsCommand).resolves({});
    await expect(new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    })).rejects.toThrow(/Could not find any VPCs matching/);
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
});
test('throws when multiple VPCs are found', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeVpcsCommand).resolves({
        Vpcs: [{ VpcId: 'vpc-1' }, { VpcId: 'vpc-2' }],
    });
    // WHEN
    await expect(new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    })).rejects.toThrow(/Found 2 VPCs matching/);
    expect(mock_sdk_1.mockEC2Client).toHaveReceivedCommandWith(client_ec2_1.DescribeVpcsCommand, {
        Filters: [{ Name: 'foo', Values: ['bar'] }],
    });
});
test('uses the VPC main route table when a subnet has no specific association', async () => {
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [
            {
                SubnetId: 'sub-123456',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: true,
                CidrBlock: '1.1.1.1/24',
            },
            {
                SubnetId: 'sub-789012',
                AvailabilityZone: 'bermuda-triangle-1337',
                MapPublicIpOnLaunch: false,
                CidrBlock: '1.1.2.1/24',
            },
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
    })
        .on(client_ec2_1.DescribeVpnGatewaysCommand)
        .resolves({
        VpnGateways: [{ VpnGatewayId: 'gw-abcdef' }],
    });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
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
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'sub-789012',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: 'gw-abcdef',
    });
});
test('Recognize public subnet by route table', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeRouteTablesCommand).resolves({
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
        ],
    });
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
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
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('Recognize isolated subnet by route table', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeRouteTablesCommand).resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'sub-123456' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '1.1.2.1/24',
                        GatewayId: 'local',
                        Origin: 'CreateRouteTable',
                        State: 'active',
                    },
                ],
            },
        ],
    });
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Isolated',
                type: 'Isolated',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('Recognize private subnet by route table', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeRouteTablesCommand).resolves({
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
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'sub-123456',
                        availabilityZone: 'bermuda-triangle-1337',
                        routeTableId: 'rtb-123456',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('works for asymmetric subnets (not spanning the same Availability Zones)', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [
            {
                SubnetId: 'pri-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: false,
                CidrBlock: '1.1.1.1/24',
            },
            {
                SubnetId: 'pub-sub-in-1c',
                AvailabilityZone: 'us-west-1c',
                MapPublicIpOnLaunch: true,
                CidrBlock: '1.1.2.1/24',
            },
            {
                SubnetId: 'pub-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: true,
                CidrBlock: '1.1.3.1/24',
            },
            {
                SubnetId: 'pub-sub-in-1a',
                AvailabilityZone: 'us-west-1a',
                MapPublicIpOnLaunch: true,
                CidrBlock: '1.1.4.1/24',
            },
        ],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'pri-sub-in-1b' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        NatGatewayId: 'nat-xxxxxx',
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
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    });
    // WHEN
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
    });
    // THEN
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'Private',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'pri-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123456',
                        cidr: '1.1.1.1/24',
                    },
                ],
            },
            {
                name: 'Public',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'pub-sub-in-1a',
                        availabilityZone: 'us-west-1a',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.4.1/24',
                    },
                    {
                        subnetId: 'pub-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.3.1/24',
                    },
                    {
                        subnetId: 'pub-sub-in-1c',
                        availabilityZone: 'us-west-1c',
                        routeTableId: 'rtb-789012',
                        cidr: '1.1.2.1/24',
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
test('allows specifying the subnet group name tag', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client
        .on(client_ec2_1.DescribeSubnetsCommand)
        .resolves({
        Subnets: [
            {
                SubnetId: 'pri-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: false,
                Tags: [{ Key: 'Tier', Value: 'restricted' }],
            },
            {
                SubnetId: 'pub-sub-in-1c',
                AvailabilityZone: 'us-west-1c',
                MapPublicIpOnLaunch: true,
                Tags: [{ Key: 'Tier', Value: 'connectivity' }],
            },
            {
                SubnetId: 'pub-sub-in-1b',
                AvailabilityZone: 'us-west-1b',
                MapPublicIpOnLaunch: true,
                Tags: [{ Key: 'Tier', Value: 'connectivity' }],
            },
            {
                SubnetId: 'pub-sub-in-1a',
                AvailabilityZone: 'us-west-1a',
                MapPublicIpOnLaunch: true,
                Tags: [{ Key: 'Tier', Value: 'connectivity' }],
            },
        ],
    })
        .on(client_ec2_1.DescribeRouteTablesCommand)
        .resolves({
        RouteTables: [
            {
                Associations: [{ SubnetId: 'pri-sub-in-1b' }],
                RouteTableId: 'rtb-123456',
                Routes: [
                    {
                        DestinationCidrBlock: '0.0.0.0/0',
                        NatGatewayId: 'nat-xxxxxx',
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
                        DestinationCidrBlock: '0.0.0.0/0',
                        GatewayId: 'igw-xxxxxx',
                        Origin: 'CreateRoute',
                        State: 'active',
                    },
                ],
            },
        ],
    });
    const result = await new vpcs_1.VpcNetworkContextProviderPlugin(mockSDK).getValue({
        account: '123456789012',
        region: 'us-east-1',
        filter: { foo: 'bar' },
        returnAsymmetricSubnets: true,
        subnetGroupNameTag: 'Tier',
    });
    expect(result).toEqual({
        availabilityZones: [],
        vpcCidrBlock: '1.1.1.1/16',
        subnetGroups: [
            {
                name: 'restricted',
                type: 'Private',
                subnets: [
                    {
                        subnetId: 'pri-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-123456',
                        cidr: undefined,
                    },
                ],
            },
            {
                name: 'connectivity',
                type: 'Public',
                subnets: [
                    {
                        subnetId: 'pub-sub-in-1a',
                        availabilityZone: 'us-west-1a',
                        routeTableId: 'rtb-789012',
                        cidr: undefined,
                    },
                    {
                        subnetId: 'pub-sub-in-1b',
                        availabilityZone: 'us-west-1b',
                        routeTableId: 'rtb-789012',
                        cidr: undefined,
                    },
                    {
                        subnetId: 'pub-sub-in-1c',
                        availabilityZone: 'us-west-1c',
                        routeTableId: 'rtb-789012',
                        cidr: undefined,
                    },
                ],
            },
        ],
        vpcId: 'vpc-1234567',
        vpnGatewayId: undefined,
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bW1ldHJpYy12cGNzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhc3ltbWV0cmljLXZwY3MudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUs2QjtBQUM3QiwyREFBbUY7QUFDbkYsK0NBQTRGO0FBRTVGLFVBQVUsQ0FBQyxHQUFHLEVBQUU7SUFDZCxJQUFBLG1DQUF3QixHQUFFLENBQUM7SUFDM0Isd0JBQWE7U0FDVixFQUFFLENBQUMsZ0NBQW1CLENBQUM7U0FDdkIsUUFBUSxDQUFDO1FBQ1IsSUFBSSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsQ0FBQztLQUMxRCxDQUFDO1NBQ0QsRUFBRSxDQUFDLG1DQUFzQixDQUFDO1NBQzFCLFFBQVEsQ0FBQztRQUNSLE9BQU8sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSx1QkFBdUIsRUFBRSxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsQ0FBQztLQUM3RyxDQUFDO1NBQ0QsRUFBRSxDQUFDLHVDQUEwQixDQUFDO1NBQzlCLFFBQVEsQ0FBQztRQUNSLFdBQVcsRUFBRTtZQUNYO2dCQUNFLFlBQVksRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxDQUFDO2dCQUMxQyxZQUFZLEVBQUUsWUFBWTtnQkFDMUIsTUFBTSxFQUFFO29CQUNOO3dCQUNFLG9CQUFvQixFQUFFLFlBQVk7d0JBQ2xDLFNBQVMsRUFBRSxPQUFPO3dCQUNsQixNQUFNLEVBQUUsa0JBQWtCO3dCQUMxQixLQUFLLEVBQUUsUUFBUTtxQkFDaEI7b0JBQ0Q7d0JBQ0Usb0JBQW9CLEVBQUUsV0FBVzt3QkFDakMsU0FBUyxFQUFFLFlBQVk7d0JBQ3ZCLE1BQU0sRUFBRSxhQUFhO3dCQUNyQixLQUFLLEVBQUUsUUFBUTtxQkFDaEI7aUJBQ0Y7YUFDRjtZQUNEO2dCQUNFLFlBQVksRUFBRSxDQUFDLEVB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LEVBQUU7b0JBQ1A7d0JBQ0UsUUFBUSxFQUFFLGVBQWU7d0JBQ3pCLGdCQUFnQixFQUFFLFlBQVk7d0JBQzlCLFlBQVksRUFBRSxZQUFZO3dCQUMxQixJQUFJLEVBQUUsU0FBUztxQkFDaEI7aUJBQ0Y7YUFDRjtZQUNEO2dCQUNFLElBQUksRUFBRSxjQUFjO2dCQUNwQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxPQUFPLEVBQUU7b0JBQ1A7d0JBQ0UsUUFBUSxFQUFFLGVBQWU7d0JBQ3pCLGdCQUFnQixFQUFFLFlBQVk7d0JBQzlCLFlBQVksRUFBRSxZQUFZO3dCQUMxQixJQUFJLEVBQUUsU0FBUztxQkFDaEI7b0JBQ0Q7d0JBQ0UsUUFBUSxFQUFFLGVBQWU7d0JBQ3pCLGdCQUFnQixFQUFFLFlBQVk7d0JBQzlCLFlBQVksRUFBRSxZQUFZO3dCQUMxQixJQUFJLEVBQUUsU0FBUztxQkFDaEI7b0JBQ0Q7d0JBQ0UsUUFBUSxFQUFFLGVBQWU7d0JBQ3pCLGdCQUFnQixFQUFFLFlBQVk7d0JBQzlCLFlBQVksRUFBRSxZQUFZO3dCQUMxQixJQUFJLEVBQUUsU0FBUztxQkFDaEI7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0QsS0FBSyxFQUFFLGFBQWE7UUFDcEIsWUFBWSxFQUFFLFNBQVM7S0FDeEIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCxcbiAgRGVzY3JpYmVTdWJuZXRzQ29tbWFuZCxcbiAgRGVzY3JpYmVWcGNzQ29tbWFuZCxcbiAgRGVzY3JpYmVWcG5HYXRld2F5c0NvbW1hbmQsXG59IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1lYzInO1xuaW1wb3J0IHsgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbiB9IGZyb20gJy4uLy4uL2xpYi9jb250ZXh0LXByb3ZpZGVycy92cGNzJztcbmltcG9ydCB7IE1vY2tTZGtQcm92aWRlciwgbW9ja0VDMkNsaWVudCwgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0IH0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICByZXN0b3JlU2RrTW9ja3NUb0RlZmF1bHQoKTtcbiAgbW9ja0VDMkNsaWVudFxuICAgIC5vbihEZXNjcmliZVZwY3NDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBWcGNzOiBbeyBWcGNJZDogJ3ZwYy0xMjM0NTY3JywgQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicgfV0sXG4gICAgfSlcbiAgICAub24oRGVzY3JpYmVTdWJuZXRzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgU3VibmV0czogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JywgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlIH1dLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBSb3V0ZVRhYmxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnIH1dLFxuICAgICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgIFJvdXRlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgICAgICBHYXRld2F5SWQ6ICdsb2NhbCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlVGFibGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICAgIEdhdGV3YXlJZDogJ2lndy14eHh4eHgnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItNzg5MDEyJyB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBOYXRHYXRld2F5SWQ6ICduYXQteHh4eHh4JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xufSk7XG5cbmNvbnN0IG1vY2tTREsgPSBuZXcgTW9ja1Nka1Byb3ZpZGVyKCk7XG5cbnRlc3QoJ2xvb2tzIHVwIHRoZSByZXF1ZXN0ZWQgKHN5bW1ldHJpYykgVlBDJywgYXN5bmMgKCkgPT4ge1xuICBtb2NrRUMyQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBDaWRyQmxvY2s6ICcxLjEuMS4xLzI0JyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAnc3ViLTc4OTAxMicsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogZmFsc2UsXG4gICAgICAgICAgQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7IFZwbkdhdGV3YXlzOiBbeyBWcG5HYXRld2F5SWQ6ICdndy1hYmNkZWYnIH1dIH0pO1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgIHR5cGU6ICdQcml2YXRlJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTc4OTAxMicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi03ODkwMTInLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4yLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBuR2F0ZXdheUlkOiAnZ3ctYWJjZGVmJyxcbiAgfSk7XG59KTtcblxudGVzdCgndGhyb3dzIHdoZW4gbm8gc3VjaCBWUEMgaXMgZm91bmQnLCBhc3luYyAoKSA9PiB7XG4gIG1vY2tFQzJDbGllbnQub24oRGVzY3JpYmVWcGNzQ29tbWFuZCkucmVzb2x2ZXMoe30pO1xuICBhd2FpdCBleHBlY3QoXG4gICAgbmV3IFZwY05ldHdvcmtDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESykuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgZmlsdGVyOiB7IGZvbzogJ2JhcicgfSxcbiAgICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICAgIH0pLFxuICApLnJlamVjdHMudG9UaHJvdygvQ291bGQgbm90IGZpbmQgYW55IFZQQ3MgbWF0Y2hpbmcvKTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcGNzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICdmb28nLCBWYWx1ZXM6IFsnYmFyJ10gfV0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ3Rocm93cyB3aGVuIG11bHRpcGxlIFZQQ3MgYXJlIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrRUMyQ2xpZW50Lm9uKERlc2NyaWJlVnBjc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBWcGNzOiBbeyBWcGNJZDogJ3ZwYy0xJyB9LCB7IFZwY0lkOiAndnBjLTInIH1dLFxuICB9KTtcblxuICAvLyBXSEVOXG4gIGF3YWl0IGV4cGVjdChcbiAgICBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgICAgcmV0dXJuQXN5bW1ldHJpY1N1Ym5ldHM6IHRydWUsXG4gICAgfSksXG4gICkucmVqZWN0cy50b1Rocm93KC9Gb3VuZCAyIFZQQ3MgbWF0Y2hpbmcvKTtcbiAgZXhwZWN0KG1vY2tFQzJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVWcGNzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICdmb28nLCBWYWx1ZXM6IFsnYmFyJ10gfV0sXG4gIH0pO1xufSk7XG5cbnRlc3QoJ3VzZXMgdGhlIFZQQyBtYWluIHJvdXRlIHRhYmxlIHdoZW4gYSBzdWJuZXQgaGFzIG5vIHNwZWNpZmljIGFzc29jaWF0aW9uJywgYXN5bmMgKCkgPT4ge1xuICBtb2NrRUMyQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBDaWRyQmxvY2s6ICcxLjEuMS4xLzI0JyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAnc3ViLTc4OTAxMicsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogZmFsc2UsXG4gICAgICAgICAgQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlUm91dGVUYWJsZXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBSb3V0ZVRhYmxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBTdWJuZXRJZDogJ3N1Yi0xMjM0NTYnIH1dLFxuICAgICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgIFJvdXRlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgICAgICBHYXRld2F5SWQ6ICdsb2NhbCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlVGFibGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICAgIEdhdGV3YXlJZDogJ2lndy14eHh4eHgnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgTWFpbjogdHJ1ZSB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBOYXRHYXRld2F5SWQ6ICduYXQteHh4eHh4JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pXG4gICAgLm9uKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBWcG5HYXRld2F5czogW3sgVnBuR2F0ZXdheUlkOiAnZ3ctYWJjZGVmJyB9XSxcbiAgICB9KTtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4xLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgIHR5cGU6ICdQcml2YXRlJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTc4OTAxMicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi03ODkwMTInLFxuICAgICAgICAgICAgY2lkcjogJzEuMS4yLjEvMjQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBuR2F0ZXdheUlkOiAnZ3ctYWJjZGVmJyxcbiAgfSk7XG59KTtcblxudGVzdCgnUmVjb2duaXplIHB1YmxpYyBzdWJuZXQgYnkgcm91dGUgdGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnQub24oRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBSb3V0ZVRhYmxlczogW1xuICAgICAge1xuICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicgfV0sXG4gICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEwLjAuMi4wLzI2JyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIFZwY1BlZXJpbmdDb25uZWN0aW9uSWQ6ICdwY3gteHh4eHh4JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMS4xLjEuMS8yNCcsXG4gICAgICAgICAgICBHYXRld2F5SWQ6ICdsb2NhbCcsXG4gICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZVRhYmxlJyxcbiAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMC4wLjAuMC8wJyxcbiAgICAgICAgICAgIEdhdGV3YXlJZDogJ2lndy14eHh4eHgnLFxuICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFZwY05ldHdvcmtDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESykuZ2V0VmFsdWUoe1xuICAgIGFjY291bnQ6ICcxMjM0NTY3ODkwMTInLFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgZmlsdGVyOiB7IGZvbzogJ2JhcicgfSxcbiAgICByZXR1cm5Bc3ltbWV0cmljU3VibmV0czogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gVEhFTlxuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVZwY3NDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW3sgTmFtZTogJ2ZvbycsIFZhbHVlczogWydiYXInXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlU3VibmV0c0NvbW1hbmQsIHtcbiAgICBGaWx0ZXJzOiBbeyBOYW1lOiAndnBjLWlkJywgVmFsdWVzOiBbJ3ZwYy0xMjM0NTY3J10gfV0sXG4gIH0pO1xuICBleHBlY3QobW9ja0VDMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCwge1xuICAgIEZpbHRlcnM6IFt7IE5hbWU6ICd2cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9XSxcbiAgfSk7XG4gIGV4cGVjdChtb2NrRUMyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVnBuR2F0ZXdheXNDb21tYW5kLCB7XG4gICAgRmlsdGVyczogW1xuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC52cGMtaWQnLCBWYWx1ZXM6IFsndnBjLTEyMzQ1NjcnXSB9LFxuICAgICAgeyBOYW1lOiAnYXR0YWNobWVudC5zdGF0ZScsIFZhbHVlczogWydhdHRhY2hlZCddIH0sXG4gICAgICB7IE5hbWU6ICdzdGF0ZScsIFZhbHVlczogWydhdmFpbGFibGUnXSB9LFxuICAgIF0sXG4gIH0pO1xuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBuR2F0ZXdheUlkOiB1bmRlZmluZWQsXG4gIH0pO1xufSk7XG5cbnRlc3QoJ1JlY29nbml6ZSBpc29sYXRlZCBzdWJuZXQgYnkgcm91dGUgdGFibGUnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnQub24oRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBSb3V0ZVRhYmxlczogW1xuICAgICAge1xuICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAnc3ViLTEyMzQ1NicgfV0sXG4gICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzEuMS4yLjEvMjQnLFxuICAgICAgICAgICAgR2F0ZXdheUlkOiAnbG9jYWwnLFxuICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGVUYWJsZScsXG4gICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ0lzb2xhdGVkJyxcbiAgICAgICAgdHlwZTogJ0lzb2xhdGVkJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAnc3ViLTEyMzQ1NicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAnYmVybXVkYS10cmlhbmdsZS0xMzM3JyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgdnBjSWQ6ICd2cGMtMTIzNDU2NycsXG4gICAgdnBuR2F0ZXdheUlkOiB1bmRlZmluZWQsXG4gIH0pO1xufSk7XG5cbnRlc3QoJ1JlY29nbml6ZSBwcml2YXRlIHN1Ym5ldCBieSByb3V0ZSB0YWJsZScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIFJvdXRlVGFibGVzOiBbXG4gICAgICB7XG4gICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdzdWItMTIzNDU2JyB9XSxcbiAgICAgICAgUm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicsXG4gICAgICAgIFJvdXRlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMTAuMC4yLjAvMjYnLFxuICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgVnBjUGVlcmluZ0Nvbm5lY3Rpb25JZDogJ3BjeC14eHh4eHgnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICAgIEdhdGV3YXlJZDogJ2xvY2FsJyxcbiAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlVGFibGUnLFxuICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgTmF0R2F0ZXdheUlkOiAnbmF0LXh4eHh4eCcsXG4gICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICB0eXBlOiAnUHJpdmF0ZScsXG4gICAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3N1Yi0xMjM0NTYnLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ2Jlcm11ZGEtdHJpYW5nbGUtMTMzNycsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItMTIzNDU2JyxcbiAgICAgICAgICAgIGNpZHI6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwbkdhdGV3YXlJZDogdW5kZWZpbmVkLFxuICB9KTtcbn0pO1xuXG50ZXN0KCd3b3JrcyBmb3IgYXN5bW1ldHJpYyBzdWJuZXRzIChub3Qgc3Bhbm5pbmcgdGhlIHNhbWUgQXZhaWxhYmlsaXR5IFpvbmVzKScsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0VDMkNsaWVudFxuICAgIC5vbihEZXNjcmliZVN1Ym5ldHNDb21tYW5kKVxuICAgIC5yZXNvbHZlcyh7XG4gICAgICBTdWJuZXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBTdWJuZXRJZDogJ3ByaS1zdWItaW4tMWInLFxuICAgICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgICBNYXBQdWJsaWNJcE9uTGF1bmNoOiBmYWxzZSxcbiAgICAgICAgICBDaWRyQmxvY2s6ICcxLjEuMS4xLzI0JyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYycsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWMnLFxuICAgICAgICAgIE1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsXG4gICAgICAgICAgQ2lkckJsb2NrOiAnMS4xLjIuMS8yNCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBTdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWInLFxuICAgICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgICBNYXBQdWJsaWNJcE9uTGF1bmNoOiB0cnVlLFxuICAgICAgICAgIENpZHJCbG9jazogJzEuMS4zLjEvMjQnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFhJyxcbiAgICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYScsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBDaWRyQmxvY2s6ICcxLjEuNC4xLzI0JyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSlcbiAgICAub24oRGVzY3JpYmVSb3V0ZVRhYmxlc0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFJvdXRlVGFibGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IFN1Ym5ldElkOiAncHJpLXN1Yi1pbi0xYicgfV0sXG4gICAgICAgICAgUm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicsXG4gICAgICAgICAgUm91dGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMC4wLjAuMC8wJyxcbiAgICAgICAgICAgICAgTmF0R2F0ZXdheUlkOiAnbmF0LXh4eHh4eCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXNzb2NpYXRpb25zOiBbeyBNYWluOiB0cnVlIH1dLFxuICAgICAgICAgIFJvdXRlVGFibGVJZDogJ3J0Yi03ODkwMTInLFxuICAgICAgICAgIFJvdXRlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBEZXN0aW5hdGlvbkNpZHJCbG9jazogJzAuMC4wLjAvMCcsXG4gICAgICAgICAgICAgIEdhdGV3YXlJZDogJ2lndy14eHh4eHgnLFxuICAgICAgICAgICAgICBPcmlnaW46ICdDcmVhdGVSb3V0ZScsXG4gICAgICAgICAgICAgIFN0YXRlOiAnYWN0aXZlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICB9KTtcblxuICAvLyBUSEVOXG4gIGV4cGVjdChyZXN1bHQpLnRvRXF1YWwoe1xuICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBbXSxcbiAgICB2cGNDaWRyQmxvY2s6ICcxLjEuMS4xLzE2JyxcbiAgICBzdWJuZXRHcm91cHM6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICB0eXBlOiAnUHJpdmF0ZScsXG4gICAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3ByaS1zdWItaW4tMWInLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTEyMzQ1NicsXG4gICAgICAgICAgICBjaWRyOiAnMS4xLjEuMS8yNCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICB0eXBlOiAnUHVibGljJyxcbiAgICAgICAgc3VibmV0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYScsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYScsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuNC4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYicsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYicsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuMy4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkOiAncHViLXN1Yi1pbi0xYycsXG4gICAgICAgICAgICBhdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYycsXG4gICAgICAgICAgICByb3V0ZVRhYmxlSWQ6ICdydGItNzg5MDEyJyxcbiAgICAgICAgICAgIGNpZHI6ICcxLjEuMi4xLzI0JyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICAgIHZwY0lkOiAndnBjLTEyMzQ1NjcnLFxuICAgIHZwbkdhdGV3YXlJZDogdW5kZWZpbmVkLFxuICB9KTtcbn0pO1xuXG50ZXN0KCdhbGxvd3Mgc3BlY2lmeWluZyB0aGUgc3VibmV0IGdyb3VwIG5hbWUgdGFnJywgYXN5bmMgKCkgPT4ge1xuICAvLyBHSVZFTlxuICBtb2NrRUMyQ2xpZW50XG4gICAgLm9uKERlc2NyaWJlU3VibmV0c0NvbW1hbmQpXG4gICAgLnJlc29sdmVzKHtcbiAgICAgIFN1Ym5ldHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFN1Ym5ldElkOiAncHJpLXN1Yi1pbi0xYicsXG4gICAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLFxuICAgICAgICAgIE1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlLFxuICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ1RpZXInLCBWYWx1ZTogJ3Jlc3RyaWN0ZWQnIH1dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFjJyxcbiAgICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYycsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdUaWVyJywgVmFsdWU6ICdjb25uZWN0aXZpdHknIH1dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFiJyxcbiAgICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYicsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdUaWVyJywgVmFsdWU6ICdjb25uZWN0aXZpdHknIH1dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgU3VibmV0SWQ6ICdwdWItc3ViLWluLTFhJyxcbiAgICAgICAgICBBdmFpbGFiaWxpdHlab25lOiAndXMtd2VzdC0xYScsXG4gICAgICAgICAgTWFwUHVibGljSXBPbkxhdW5jaDogdHJ1ZSxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdUaWVyJywgVmFsdWU6ICdjb25uZWN0aXZpdHknIH1dLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KVxuICAgIC5vbihEZXNjcmliZVJvdXRlVGFibGVzQ29tbWFuZClcbiAgICAucmVzb2x2ZXMoe1xuICAgICAgUm91dGVUYWJsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEFzc29jaWF0aW9uczogW3sgU3VibmV0SWQ6ICdwcmktc3ViLWluLTFiJyB9XSxcbiAgICAgICAgICBSb3V0ZVRhYmxlSWQ6ICdydGItMTIzNDU2JyxcbiAgICAgICAgICBSb3V0ZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgRGVzdGluYXRpb25DaWRyQmxvY2s6ICcwLjAuMC4wLzAnLFxuICAgICAgICAgICAgICBOYXRHYXRld2F5SWQ6ICduYXQteHh4eHh4JyxcbiAgICAgICAgICAgICAgT3JpZ2luOiAnQ3JlYXRlUm91dGUnLFxuICAgICAgICAgICAgICBTdGF0ZTogJ2FjdGl2ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBc3NvY2lhdGlvbnM6IFt7IE1haW46IHRydWUgfV0sXG4gICAgICAgICAgUm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgUm91dGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIERlc3RpbmF0aW9uQ2lkckJsb2NrOiAnMC4wLjAuMC8wJyxcbiAgICAgICAgICAgICAgR2F0ZXdheUlkOiAnaWd3LXh4eHh4eCcsXG4gICAgICAgICAgICAgIE9yaWdpbjogJ0NyZWF0ZVJvdXRlJyxcbiAgICAgICAgICAgICAgU3RhdGU6ICdhY3RpdmUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgVnBjTmV0d29ya0NvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKS5nZXRWYWx1ZSh7XG4gICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICBmaWx0ZXI6IHsgZm9vOiAnYmFyJyB9LFxuICAgIHJldHVybkFzeW1tZXRyaWNTdWJuZXRzOiB0cnVlLFxuICAgIHN1Ym5ldEdyb3VwTmFtZVRhZzogJ1RpZXInLFxuICB9KTtcblxuICBleHBlY3QocmVzdWx0KS50b0VxdWFsKHtcbiAgICBhdmFpbGFiaWxpdHlab25lczogW10sXG4gICAgdnBjQ2lkckJsb2NrOiAnMS4xLjEuMS8xNicsXG4gICAgc3VibmV0R3JvdXBzOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdyZXN0cmljdGVkJyxcbiAgICAgICAgdHlwZTogJ1ByaXZhdGUnLFxuICAgICAgICBzdWJuZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3VibmV0SWQ6ICdwcmktc3ViLWluLTFiJyxcbiAgICAgICAgICAgIGF2YWlsYWJpbGl0eVpvbmU6ICd1cy13ZXN0LTFiJyxcbiAgICAgICAgICAgIHJvdXRlVGFibGVJZDogJ3J0Yi0xMjM0NTYnLFxuICAgICAgICAgICAgY2lkcjogdW5kZWZpbmVkLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnY29ubmVjdGl2aXR5JyxcbiAgICAgICAgdHlwZTogJ1B1YmxpYycsXG4gICAgICAgIHN1Ym5ldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWEnLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWEnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWInLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWInLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdWJuZXRJZDogJ3B1Yi1zdWItaW4tMWMnLFxuICAgICAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZTogJ3VzLXdlc3QtMWMnLFxuICAgICAgICAgICAgcm91dGVUYWJsZUlkOiAncnRiLTc4OTAxMicsXG4gICAgICAgICAgICBjaWRyOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICB2cGNJZDogJ3ZwYy0xMjM0NTY3JyxcbiAgICB2cG5HYXRld2F5SWQ6IHVuZGVmaW5lZCxcbiAgfSk7XG59KTtcbiJdfQ==