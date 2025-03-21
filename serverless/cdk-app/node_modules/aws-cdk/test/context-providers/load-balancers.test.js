"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
const client_elastic_load_balancing_v2_1 = require("@aws-sdk/client-elastic-load-balancing-v2");
const lib_1 = require("../../lib");
const load_balancers_1 = require("../../lib/context-providers/load-balancers");
const mock_sdk_1 = require("../util/mock-sdk");
const mockSDK = new (class extends mock_sdk_1.MockSdkProvider {
    forEnvironment() {
        return Promise.resolve({ sdk: new lib_1.SDK(mock_sdk_1.FAKE_CREDENTIAL_CHAIN, mockSDK.defaultRegion, {}), didAssumeRole: false });
    }
})();
beforeEach(() => {
    (0, mock_sdk_1.restoreSdkMocksToDefault)();
});
describe('load balancer context provider plugin', () => {
    test('errors when no matches are found', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer1',
        })).rejects.toThrow('No load balancers found matching {"account":"1234","region":"us-east-1","loadBalancerType":"application","loadBalancerArn":"arn:load-balancer1"}');
    });
    test('errors when multiple load balancers match', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
        })).rejects.toThrow('Multiple load balancers found matching {"account":"1234","region":"us-east-1","loadBalancerType":"application","loadBalancerTags":[{"key":"some","value":"tag"}]} - please provide more specific criteria');
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeTagsCommand, {
            ResourceArns: ['arn:load-balancer1', 'arn:load-balancer2'],
        });
    });
    test('looks up by arn', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client.on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand).resolves({
            LoadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        const result = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer1',
        });
        // THEN
        expect(result.ipAddressType).toEqual('ipv4');
        expect(result.loadBalancerArn).toEqual('arn:load-balancer1');
        expect(result.loadBalancerCanonicalHostedZoneId).toEqual('Z1234');
        expect(result.loadBalancerDnsName).toEqual('dns.example.com');
        expect(result.securityGroupIds).toEqual(['sg-1234']);
        expect(result.vpcId).toEqual('vpc-1234');
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: ['arn:load-balancer1'],
        });
    });
    test('looks up by tags', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [
                        { Key: 'some', Value: 'tag' },
                        { Key: 'second', Value: 'tag2' },
                    ],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        const result = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [
                { key: 'some', value: 'tag' },
                { key: 'second', value: 'tag2' },
            ],
        });
        expect(result.loadBalancerArn).toEqual('arn:load-balancer2');
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeTagsCommand, {
            ResourceArns: ['arn:load-balancer1', 'arn:load-balancer2'],
        });
    });
    test('looks up by tags - query by subset', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [
                        // Load balancer has two tags...
                        { Key: 'some', Value: 'tag' },
                        { Key: 'second', Value: 'tag2' },
                    ],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        const result = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [
                // ...but we are querying for only one of them
                { key: 'second', value: 'tag2' },
            ],
        });
        expect(result.loadBalancerArn).toEqual('arn:load-balancer2');
    });
    test('filters by type', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    IpAddressType: 'ipv4',
                    Type: 'network',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                },
                {
                    IpAddressType: 'ipv4',
                    Type: 'application',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerContextProviderPlugin(mockSDK);
        // WHEN
        const loadBalancer = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
        });
        expect(loadBalancer.loadBalancerArn).toEqual('arn:load-balancer2');
    });
});
describe('load balancer listener context provider plugin', () => {
    test('errors when no associated load balancers match', async () => {
        // GIVEN
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
        })).rejects.toThrow('No associated load balancers found for load balancer listener query {"account":"1234","region":"us-east-1","loadBalancerType":"application","loadBalancerTags":[{"key":"some","value":"tag"}]}');
    });
    test('errors when no listeners match', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    ListenerArn: 'arn:listener',
                    Port: 80,
                    Protocol: 'HTTP',
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer',
            listenerPort: 443,
            listenerProtocol: cloud_assembly_schema_1.LoadBalancerListenerProtocol.HTTPS,
        })).rejects.toThrow('No load balancer listeners found matching {"account":"1234","region":"us-east-1","loadBalancerType":"application","loadBalancerArn":"arn:load-balancer","listenerPort":443,"listenerProtocol":"HTTPS"}');
    });
    test('errors when multiple listeners match', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    Type: 'application',
                },
                {
                    LoadBalancerArn: 'arn:load-balancer2',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    LoadBalancerArn: 'arn:load-balancer',
                    ListenerArn: 'arn:listener',
                    Port: 80,
                    Protocol: 'HTTP',
                },
                {
                    LoadBalancerArn: 'arn:load-balancer2',
                    ListenerArn: 'arn:listener2',
                    Port: 80,
                    Protocol: 'HTTP',
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerPort: 80,
            listenerProtocol: cloud_assembly_schema_1.LoadBalancerListenerProtocol.HTTP,
        })).rejects.toThrow('Multiple load balancer listeners found matching {"account":"1234","region":"us-east-1","loadBalancerType":"application","loadBalancerTags":[{"key":"some","value":"tag"}],"listenerPort":80,"listenerProtocol":"HTTP"} - please provide more specific criteria');
    });
    test('looks up by listener arn', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer-arn',
                    SecurityGroups: ['sg-1234', 'sg-2345'],
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    ListenerArn: 'arn:listener-arn',
                    LoadBalancerArn: 'arn:load-balancer-arn',
                    Port: 999,
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            listenerArn: 'arn:listener-arn',
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn');
        expect(listener.listenerPort).toEqual(999);
        expect(listener.securityGroupIds).toEqual(['sg-1234', 'sg-2345']);
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: ['arn:load-balancer-arn'],
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeListenersCommand, {
            ListenerArns: ['arn:listener-arn'],
        });
    });
    test('looks up by associated load balancer arn', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: ['sg-1234'],
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    // This one
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    Port: 80,
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerArn: 'arn:load-balancer-arn1',
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn1');
        expect(listener.listenerPort).toEqual(80);
        expect(listener.securityGroupIds).toEqual(['sg-1234']);
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: ['arn:load-balancer-arn1'],
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeListenersCommand, {
            LoadBalancerArn: 'arn:load-balancer-arn1',
        });
    });
    test('looks up by associated load balancer tags', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    // This one should have the wrong tags
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: ['sg-1234', 'sg-2345'],
                    Type: 'application',
                },
                {
                    // Expecting this one
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    SecurityGroups: ['sg-3456', 'sg-4567'],
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    // This one
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 80,
                },
                {
                    ListenerArn: 'arn:listener-arn2',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 999,
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer-arn1',
                    Tags: [],
                },
                {
                    // Expecting this one
                    ResourceArn: 'arn:load-balancer-arn2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerPort: 999,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn2');
        expect(listener.listenerPort).toEqual(999);
        expect(listener.securityGroupIds).toEqual(['sg-3456', 'sg-4567']);
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: undefined,
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeListenersCommand, {
            LoadBalancerArn: 'arn:load-balancer-arn2',
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeTagsCommand, {
            ResourceArns: ['arn:load-balancer-arn1', 'arn:load-balancer-arn2'],
        });
    });
    test('looks up by listener port and protocol', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    // Shouldn't have any matching listeners
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    DNSName: 'dns1.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-1234'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
                {
                    // Should have a matching listener
                    IpAddressType: 'ipv4',
                    LoadBalancerArn: 'arn:load-balancer2',
                    DNSName: 'dns2.example.com',
                    CanonicalHostedZoneId: 'Z1234',
                    SecurityGroups: ['sg-2345'],
                    VpcId: 'vpc-1234',
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolvesOnce({
            Listeners: [
                {
                    // Wrong port, wrong protocol => no match
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer1',
                    Protocol: 'HTTP',
                    Port: 80,
                },
                {
                    // Wrong protocol, right port => no match
                    ListenerArn: 'arn:listener-arn3',
                    LoadBalancerArn: 'arn:load-balancer1',
                    Protocol: 'HTTPS',
                    Port: 443,
                },
                {
                    // Wrong port, right protocol => no match
                    ListenerArn: 'arn:listener-arn4',
                    LoadBalancerArn: 'arn:load-balancer1',
                    Protocol: 'TCP',
                    Port: 999,
                },
            ],
        })
            .resolvesOnce({
            Listeners: [
                {
                    // Wrong port, wrong protocol => no match
                    ListenerArn: 'arn:listener-arn5',
                    LoadBalancerArn: 'arn:load-balancer2',
                    Protocol: 'HTTP',
                    Port: 80,
                },
                {
                    // Right port, right protocol => match
                    ListenerArn: 'arn:listener-arn6',
                    LoadBalancerArn: 'arn:load-balancer2',
                    Port: 443,
                    Protocol: 'TCP',
                },
            ],
        });
        mock_sdk_1.mockElasticLoadBalancingV2Client.on(client_elastic_load_balancing_v2_1.DescribeTagsCommand).resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.APPLICATION,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerProtocol: cloud_assembly_schema_1.LoadBalancerListenerProtocol.TCP,
            listenerPort: 443,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn6');
        expect(listener.listenerPort).toEqual(443);
        expect(listener.securityGroupIds).toEqual(['sg-2345']);
    });
    test('filters by associated load balancer type', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    // This one has wrong type => no match
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: [],
                    Type: 'application',
                },
                {
                    // Right type => match
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    SecurityGroups: [],
                    Type: 'network',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    ListenerArn: 'arn:listener-arn2',
                    LoadBalancerArn: 'arn:load-balancer-arn2',
                    Port: 443,
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeTagsCommand)
            .resolves({
            TagDescriptions: [
                {
                    ResourceArn: 'arn:load-balancer-arn1',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
                {
                    ResourceArn: 'arn:load-balancer-arn2',
                    Tags: [{ Key: 'some', Value: 'tag' }],
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        const listener = await provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.NETWORK,
            loadBalancerTags: [{ key: 'some', value: 'tag' }],
            listenerPort: 443,
        });
        // THEN
        expect(listener.listenerArn).toEqual('arn:listener-arn2');
        expect(listener.listenerPort).toEqual(443);
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: undefined,
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeListenersCommand, {
            LoadBalancerArn: 'arn:load-balancer-arn2',
        });
    });
    test('errors when associated load balancer is wrong type', async () => {
        // GIVEN
        mock_sdk_1.mockElasticLoadBalancingV2Client
            .on(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand)
            .resolves({
            LoadBalancers: [
                {
                    // This one has wrong type => no match
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    SecurityGroups: [],
                    Type: 'application',
                },
            ],
        })
            .on(client_elastic_load_balancing_v2_1.DescribeListenersCommand)
            .resolves({
            Listeners: [
                {
                    ListenerArn: 'arn:listener-arn1',
                    LoadBalancerArn: 'arn:load-balancer-arn1',
                    Port: 443,
                },
            ],
        });
        const provider = new load_balancers_1.LoadBalancerListenerContextProviderPlugin(mockSDK);
        // WHEN
        await expect(provider.getValue({
            account: '1234',
            region: 'us-east-1',
            loadBalancerType: cloud_assembly_schema_1.LoadBalancerType.NETWORK,
            listenerArn: 'arn:listener-arn1',
        })).rejects.toThrow('No associated load balancer found for listener arn arn:listener-arn1');
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeLoadBalancersCommand, {
            LoadBalancerArns: ['arn:load-balancer-arn1'],
        });
        expect(mock_sdk_1.mockElasticLoadBalancingV2Client).toHaveReceivedCommandWith(client_elastic_load_balancing_v2_1.DescribeListenersCommand, {
            ListenerArns: ['arn:listener-arn1'],
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1iYWxhbmNlcnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvYWQtYmFsYW5jZXJzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwwRUFBZ0c7QUFDaEcsZ0dBSW1EO0FBQ25ELG1DQUFtRDtBQUNuRCwrRUFHb0Q7QUFDcEQsK0NBSzBCO0FBRTFCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFNLFNBQVEsMEJBQWU7SUFDekMsY0FBYztRQUNuQixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxTQUFHLENBQUMsZ0NBQXFCLEVBQUUsT0FBTyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNuSCxDQUFDO0NBQ0YsQ0FBQyxFQUFFLENBQUM7QUFFTCxVQUFVLENBQUMsR0FBRyxFQUFFO0lBQ2QsSUFBQSxtQ0FBd0IsR0FBRSxDQUFDO0FBQzdCLENBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBUSxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsRUFBRTtJQUNyRCxJQUFJLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEQsUUFBUTtRQUNSLE1BQU0sUUFBUSxHQUFHLElBQUksa0RBQWlDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFaEUsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUNWLFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsT0FBTyxFQUFFLE1BQU07WUFDZixNQUFNLEVBQUUsV0FBVztZQUNuQixnQkFBZ0IsRUFBRSx3Q0FBZ0IsQ0FBQyxXQUFXO1lBQzlDLGVBQWUsRUFBRSxvQkFBb0I7U0FDdEMsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDZixrSkFBa0osQ0FDbkosQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEtBQUssSUFBSSxFQUFF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LHdCQUF3QjtvQkFDekMsSUFBSSxFQUFFLEdBQUc7aUJBQ1Y7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUNMLE1BQU0sUUFBUSxHQUFHLElBQUksMERBQXlDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFeEUsT0FBTztRQUNQLE1BQU0sTUFBTSxDQUNWLFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsT0FBTyxFQUFFLE1BQU07WUFDZixNQUFNLEVBQUUsV0FBVztZQUNuQixnQkFBZ0IsRUFBRSx3Q0FBZ0IsQ0FBQyxPQUFPO1lBQzFDLFdBQVcsRUFBRSxtQkFBbUI7U0FDakMsQ0FBQyxDQUNILENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO1FBQzFGLE1BQU0sQ0FBQywyQ0FBZ0MsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLCtEQUE0QixFQUFFO1lBQy9GLGdCQUFnQixFQUFFLENBQUMsd0JBQXdCLENBQUM7U0FDN0MsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLDJDQUFnQyxDQUFDLENBQUMseUJBQXlCLENBQUMsMkRBQXdCLEVBQUU7WUFDM0YsWUFBWSxFQUFFLENBQUMsbUJBQW1CLENBQUM7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExvYWRCYWxhbmNlckxpc3RlbmVyUHJvdG9jb2wsIExvYWRCYWxhbmNlclR5cGUgfSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0IHtcbiAgRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kLFxuICBEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kLFxuICBEZXNjcmliZVRhZ3NDb21tYW5kLFxufSBmcm9tICdAYXdzLXNkay9jbGllbnQtZWxhc3RpYy1sb2FkLWJhbGFuY2luZy12Mic7XG5pbXBvcnQgeyBTREssIFNka0ZvckVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vbGliJztcbmltcG9ydCB7XG4gIExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luLFxuICBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4sXG59IGZyb20gJy4uLy4uL2xpYi9jb250ZXh0LXByb3ZpZGVycy9sb2FkLWJhbGFuY2Vycyc7XG5pbXBvcnQge1xuICBGQUtFX0NSRURFTlRJQUxfQ0hBSU4sXG4gIE1vY2tTZGtQcm92aWRlcixcbiAgbW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnQsXG4gIHJlc3RvcmVTZGtNb2Nrc1RvRGVmYXVsdCxcbn0gZnJvbSAnLi4vdXRpbC9tb2NrLXNkayc7XG5cbmNvbnN0IG1vY2tTREsgPSBuZXcgKGNsYXNzIGV4dGVuZHMgTW9ja1Nka1Byb3ZpZGVyIHtcbiAgcHVibGljIGZvckVudmlyb25tZW50KCk6IFByb21pc2U8U2RrRm9yRW52aXJvbm1lbnQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgc2RrOiBuZXcgU0RLKEZBS0VfQ1JFREVOVElBTF9DSEFJTiwgbW9ja1NESy5kZWZhdWx0UmVnaW9uLCB7fSksIGRpZEFzc3VtZVJvbGU6IGZhbHNlIH0pO1xuICB9XG59KSgpO1xuXG5iZWZvcmVFYWNoKCgpID0+IHtcbiAgcmVzdG9yZVNka01vY2tzVG9EZWZhdWx0KCk7XG59KTtcblxuZGVzY3JpYmUoJ2xvYWQgYmFsYW5jZXIgY29udGV4dCBwcm92aWRlciBwbHVnaW4nLCAoKSA9PiB7XG4gIHRlc3QoJ2Vycm9ycyB3aGVuIG5vIG1hdGNoZXMgYXJlIGZvdW5kJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBsb2FkQmFsYW5jZXJUeXBlOiBMb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgICBsb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgfSksXG4gICAgKS5yZWplY3RzLnRvVGhyb3coXG4gICAgICAnTm8gbG9hZCBiYWxhbmNlcnMgZm91bmQgbWF0Y2hpbmcge1wiYWNjb3VudFwiOlwiMTIzNFwiLFwicmVnaW9uXCI6XCJ1cy1lYXN0LTFcIixcImxvYWRCYWxhbmNlclR5cGVcIjpcImFwcGxpY2F0aW9uXCIsXCJsb2FkQmFsYW5jZXJBcm5cIjpcImFybjpsb2FkLWJhbGFuY2VyMVwifScsXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gbXVsdGlwbGUgbG9hZCBiYWxhbmNlcnMgbWF0Y2gnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudFxuICAgICAgLm9uKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBMb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICAgIEROU05hbWU6ICdkbnMxLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgICBETlNOYW1lOiAnZG5zMi5leGFtcGxlLmNvbScsXG4gICAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVUYWdzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFRhZ0Rlc2NyaXB0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICAgIGxvYWRCYWxhbmNlclRhZ3M6IFt7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfV0sXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICdNdWx0aXBsZSBsb2FkIGJhbGFuY2VycyBmb3VuZCBtYXRjaGluZyB7XCJhY2NvdW50XCI6XCIxMjM0XCIsXCJyZWdpb25cIjpcInVzLWVhc3QtMVwiLFwibG9hZEJhbGFuY2VyVHlwZVwiOlwiYXBwbGljYXRpb25cIixcImxvYWRCYWxhbmNlclRhZ3NcIjpbe1wia2V5XCI6XCJzb21lXCIsXCJ2YWx1ZVwiOlwidGFnXCJ9XX0gLSBwbGVhc2UgcHJvdmlkZSBtb3JlIHNwZWNpZmljIGNyaXRlcmlhJyxcbiAgICApO1xuICAgIGV4cGVjdChtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZVRhZ3NDb21tYW5kLCB7XG4gICAgICBSZXNvdXJjZUFybnM6IFsnYXJuOmxvYWQtYmFsYW5jZXIxJywgJ2Fybjpsb2FkLWJhbGFuY2VyMiddLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSBhcm4nLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudC5vbihEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBMb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICBETlNOYW1lOiAnZG5zLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgbG9hZEJhbGFuY2VyVHlwZTogTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgIGxvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgfSk7XG5cbiAgICAvLyBUSEVOXG4gICAgZXhwZWN0KHJlc3VsdC5pcEFkZHJlc3NUeXBlKS50b0VxdWFsKCdpcHY0Jyk7XG4gICAgZXhwZWN0KHJlc3VsdC5sb2FkQmFsYW5jZXJBcm4pLnRvRXF1YWwoJ2Fybjpsb2FkLWJhbGFuY2VyMScpO1xuICAgIGV4cGVjdChyZXN1bHQubG9hZEJhbGFuY2VyQ2Fub25pY2FsSG9zdGVkWm9uZUlkKS50b0VxdWFsKCdaMTIzNCcpO1xuICAgIGV4cGVjdChyZXN1bHQubG9hZEJhbGFuY2VyRG5zTmFtZSkudG9FcXVhbCgnZG5zLmV4YW1wbGUuY29tJyk7XG4gICAgZXhwZWN0KHJlc3VsdC5zZWN1cml0eUdyb3VwSWRzKS50b0VxdWFsKFsnc2ctMTIzNCddKTtcbiAgICBleHBlY3QocmVzdWx0LnZwY0lkKS50b0VxdWFsKCd2cGMtMTIzNCcpO1xuICAgIGV4cGVjdChtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kLCB7XG4gICAgICBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyMSddLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSB0YWdzJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnRcbiAgICAgIC5vbihEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTG9hZEJhbGFuY2VyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIElwQWRkcmVzc1R5cGU6ICdpcHY0JyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgICBETlNOYW1lOiAnZG5zMS5leGFtcGxlLmNvbScsXG4gICAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgRE5TTmFtZTogJ2RuczIuZXhhbXBsZS5jb20nLFxuICAgICAgICAgICAgQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiAnWjEyMzQnLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgICAgVnBjSWQ6ICd2cGMtMTIzNCcsXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLm9uKERlc2NyaWJlVGFnc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBUYWdEZXNjcmlwdGlvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgICB7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfSxcbiAgICAgICAgICAgICAgeyBLZXk6ICdzZWNvbmQnLCBWYWx1ZTogJ3RhZzInIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbXG4gICAgICAgIHsga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9LFxuICAgICAgICB7IGtleTogJ3NlY29uZCcsIHZhbHVlOiAndGFnMicgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBleHBlY3QocmVzdWx0LmxvYWRCYWxhbmNlckFybikudG9FcXVhbCgnYXJuOmxvYWQtYmFsYW5jZXIyJyk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlVGFnc0NvbW1hbmQsIHtcbiAgICAgIFJlc291cmNlQXJuczogWydhcm46bG9hZC1iYWxhbmNlcjEnLCAnYXJuOmxvYWQtYmFsYW5jZXIyJ10sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IHRhZ3MgLSBxdWVyeSBieSBzdWJzZXQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudFxuICAgICAgLm9uKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBMb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIEROU05hbWU6ICdkbnMyLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZVRhZ3NDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgVGFnczogW1xuICAgICAgICAgICAgICAvLyBMb2FkIGJhbGFuY2VyIGhhcyB0d28gdGFncy4uLlxuICAgICAgICAgICAgICB7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfSxcbiAgICAgICAgICAgICAgeyBLZXk6ICdzZWNvbmQnLCBWYWx1ZTogJ3RhZzInIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbXG4gICAgICAgIC8vIC4uLmJ1dCB3ZSBhcmUgcXVlcnlpbmcgZm9yIG9ubHkgb25lIG9mIHRoZW1cbiAgICAgICAgeyBrZXk6ICdzZWNvbmQnLCB2YWx1ZTogJ3RhZzInIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgZXhwZWN0KHJlc3VsdC5sb2FkQmFsYW5jZXJBcm4pLnRvRXF1YWwoJ2Fybjpsb2FkLWJhbGFuY2VyMicpO1xuICB9KTtcblxuICB0ZXN0KCdmaWx0ZXJzIGJ5IHR5cGUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudFxuICAgICAgLm9uKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBMb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgICAgVHlwZTogJ25ldHdvcmsnLFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICAgIEROU05hbWU6ICdkbnMxLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgICBETlNOYW1lOiAnZG5zMi5leGFtcGxlLmNvbScsXG4gICAgICAgICAgICBDYW5vbmljYWxIb3N0ZWRab25lSWQ6ICdaMTIzNCcsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0J10sXG4gICAgICAgICAgICBWcGNJZDogJ3ZwYy0xMjM0JyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZVRhZ3NDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBsb2FkQmFsYW5jZXIgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgbG9hZEJhbGFuY2VyVGFnczogW3sga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9XSxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgfSk7XG5cbiAgICBleHBlY3QobG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckFybikudG9FcXVhbCgnYXJuOmxvYWQtYmFsYW5jZXIyJyk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIGNvbnRleHQgcHJvdmlkZXIgcGx1Z2luJywgKCkgPT4ge1xuICB0ZXN0KCdlcnJvcnMgd2hlbiBubyBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXJzIG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgYXdhaXQgZXhwZWN0KFxuICAgICAgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICAgIGxvYWRCYWxhbmNlclRhZ3M6IFt7IGtleTogJ3NvbWUnLCB2YWx1ZTogJ3RhZycgfV0sXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICdObyBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXJzIGZvdW5kIGZvciBsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIHF1ZXJ5IHtcImFjY291bnRcIjpcIjEyMzRcIixcInJlZ2lvblwiOlwidXMtZWFzdC0xXCIsXCJsb2FkQmFsYW5jZXJUeXBlXCI6XCJhcHBsaWNhdGlvblwiLFwibG9hZEJhbGFuY2VyVGFnc1wiOlt7XCJrZXlcIjpcInNvbWVcIixcInZhbHVlXCI6XCJ0YWdcIn1dfScsXG4gICAgKTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gbm8gbGlzdGVuZXJzIG1hdGNoJywgYXN5bmMgKCkgPT4ge1xuICAgIC8vIEdJVkVOXG4gICAgbW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnRcbiAgICAgIC5vbihEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTG9hZEJhbGFuY2VyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyJyxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTGlzdGVuZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXInLFxuICAgICAgICAgICAgUG9ydDogODAsXG4gICAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgbG9hZEJhbGFuY2VyVHlwZTogTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgICAgbG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICBsaXN0ZW5lclBvcnQ6IDQ0MyxcbiAgICAgICAgbGlzdGVuZXJQcm90b2NvbDogTG9hZEJhbGFuY2VyTGlzdGVuZXJQcm90b2NvbC5IVFRQUyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KFxuICAgICAgJ05vIGxvYWQgYmFsYW5jZXIgbGlzdGVuZXJzIGZvdW5kIG1hdGNoaW5nIHtcImFjY291bnRcIjpcIjEyMzRcIixcInJlZ2lvblwiOlwidXMtZWFzdC0xXCIsXCJsb2FkQmFsYW5jZXJUeXBlXCI6XCJhcHBsaWNhdGlvblwiLFwibG9hZEJhbGFuY2VyQXJuXCI6XCJhcm46bG9hZC1iYWxhbmNlclwiLFwibGlzdGVuZXJQb3J0XCI6NDQzLFwibGlzdGVuZXJQcm90b2NvbFwiOlwiSFRUUFNcIn0nLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2Vycm9ycyB3aGVuIG11bHRpcGxlIGxpc3RlbmVycyBtYXRjaCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcicsXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVUYWdzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIFRhZ0Rlc2NyaXB0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTGlzdGVuZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXInLFxuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXInLFxuICAgICAgICAgICAgUG9ydDogODAsXG4gICAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyMicsXG4gICAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgICAgIFByb3RvY29sOiAnSFRUUCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGF3YWl0IGV4cGVjdChcbiAgICAgIHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICBsb2FkQmFsYW5jZXJUeXBlOiBMb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICBsaXN0ZW5lclBvcnQ6IDgwLFxuICAgICAgICBsaXN0ZW5lclByb3RvY29sOiBMb2FkQmFsYW5jZXJMaXN0ZW5lclByb3RvY29sLkhUVFAsXG4gICAgICB9KSxcbiAgICApLnJlamVjdHMudG9UaHJvdyhcbiAgICAgICdNdWx0aXBsZSBsb2FkIGJhbGFuY2VyIGxpc3RlbmVycyBmb3VuZCBtYXRjaGluZyB7XCJhY2NvdW50XCI6XCIxMjM0XCIsXCJyZWdpb25cIjpcInVzLWVhc3QtMVwiLFwibG9hZEJhbGFuY2VyVHlwZVwiOlwiYXBwbGljYXRpb25cIixcImxvYWRCYWxhbmNlclRhZ3NcIjpbe1wia2V5XCI6XCJzb21lXCIsXCJ2YWx1ZVwiOlwidGFnXCJ9XSxcImxpc3RlbmVyUG9ydFwiOjgwLFwibGlzdGVuZXJQcm90b2NvbFwiOlwiSFRUUFwifSAtIHBsZWFzZSBwcm92aWRlIG1vcmUgc3BlY2lmaWMgY3JpdGVyaWEnLFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoJ2xvb2tzIHVwIGJ5IGxpc3RlbmVyIGFybicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4nLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCcsICdzZy0yMzQ1J10sXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLm9uKERlc2NyaWJlTGlzdGVuZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExpc3RlbmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybicsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4nLFxuICAgICAgICAgICAgUG9ydDogOTk5LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBsaXN0ZW5lciA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBMb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgbGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuJyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJBcm4pLnRvRXF1YWwoJ2FybjpsaXN0ZW5lci1hcm4nKTtcbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJQb3J0KS50b0VxdWFsKDk5OSk7XG4gICAgZXhwZWN0KGxpc3RlbmVyLnNlY3VyaXR5R3JvdXBJZHMpLnRvRXF1YWwoWydzZy0xMjM0JywgJ3NnLTIzNDUnXSk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQsIHtcbiAgICAgIExvYWRCYWxhbmNlckFybnM6IFsnYXJuOmxvYWQtYmFsYW5jZXItYXJuJ10sXG4gICAgfSk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlTGlzdGVuZXJzQ29tbWFuZCwge1xuICAgICAgTGlzdGVuZXJBcm5zOiBbJ2FybjpsaXN0ZW5lci1hcm4nXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnbG9va3MgdXAgYnkgYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGFybicsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTEyMzQnXSxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTGlzdGVuZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gVGhpcyBvbmVcbiAgICAgICAgICAgIExpc3RlbmVyQXJuOiAnYXJuOmxpc3RlbmVyLWFybjEnLFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgICBQb3J0OiA4MCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgbGlzdGVuZXIgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgbG9hZEJhbGFuY2VyVHlwZTogTG9hZEJhbGFuY2VyVHlwZS5BUFBMSUNBVElPTixcbiAgICAgIGxvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lckFybikudG9FcXVhbCgnYXJuOmxpc3RlbmVyLWFybjEnKTtcbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJQb3J0KS50b0VxdWFsKDgwKTtcbiAgICBleHBlY3QobGlzdGVuZXIuc2VjdXJpdHlHcm91cElkcykudG9FcXVhbChbJ3NnLTEyMzQnXSk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQsIHtcbiAgICAgIExvYWRCYWxhbmNlckFybnM6IFsnYXJuOmxvYWQtYmFsYW5jZXItYXJuMSddLFxuICAgIH0pO1xuICAgIGV4cGVjdChtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZUxpc3RlbmVyc0NvbW1hbmQsIHtcbiAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXIgdGFncycsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBUaGlzIG9uZSBzaG91bGQgaGF2ZSB0aGUgd3JvbmcgdGFnc1xuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogWydzZy0xMjM0JywgJ3NnLTIzNDUnXSxcbiAgICAgICAgICAgIFR5cGU6ICdhcHBsaWNhdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBFeHBlY3RpbmcgdGhpcyBvbmVcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMzQ1NicsICdzZy00NTY3J10sXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLm9uKERlc2NyaWJlTGlzdGVuZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExpc3RlbmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFRoaXMgb25lXG4gICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgICAgUG9ydDogODAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4yJyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgICAgUG9ydDogOTk5LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLm9uKERlc2NyaWJlVGFnc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBUYWdEZXNjcmlwdGlvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgICAgICAgICAgVGFnczogW10sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBFeHBlY3RpbmcgdGhpcyBvbmVcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicsXG4gICAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBjb25zdCBsaXN0ZW5lciA9IGF3YWl0IHByb3ZpZGVyLmdldFZhbHVlKHtcbiAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBsb2FkQmFsYW5jZXJUeXBlOiBMb2FkQmFsYW5jZXJUeXBlLkFQUExJQ0FUSU9OLFxuICAgICAgbG9hZEJhbGFuY2VyVGFnczogW3sga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9XSxcbiAgICAgIGxpc3RlbmVyUG9ydDogOTk5LFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lckFybikudG9FcXVhbCgnYXJuOmxpc3RlbmVyLWFybjInKTtcbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJQb3J0KS50b0VxdWFsKDk5OSk7XG4gICAgZXhwZWN0KGxpc3RlbmVyLnNlY3VyaXR5R3JvdXBJZHMpLnRvRXF1YWwoWydzZy0zNDU2JywgJ3NnLTQ1NjcnXSk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQsIHtcbiAgICAgIExvYWRCYWxhbmNlckFybnM6IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kLCB7XG4gICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4yJyxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVUYWdzQ29tbWFuZCwge1xuICAgICAgUmVzb3VyY2VBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLCAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMiddLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdsb29rcyB1cCBieSBsaXN0ZW5lciBwb3J0IGFuZCBwcm90b2NvbCcsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBTaG91bGRuJ3QgaGF2ZSBhbnkgbWF0Y2hpbmcgbGlzdGVuZXJzXG4gICAgICAgICAgICBJcEFkZHJlc3NUeXBlOiAnaXB2NCcsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgRE5TTmFtZTogJ2RuczEuZXhhbXBsZS5jb20nLFxuICAgICAgICAgICAgQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiAnWjEyMzQnLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFsnc2ctMTIzNCddLFxuICAgICAgICAgICAgVnBjSWQ6ICd2cGMtMTIzNCcsXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gU2hvdWxkIGhhdmUgYSBtYXRjaGluZyBsaXN0ZW5lclxuICAgICAgICAgICAgSXBBZGRyZXNzVHlwZTogJ2lwdjQnLFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIEROU05hbWU6ICdkbnMyLmV4YW1wbGUuY29tJyxcbiAgICAgICAgICAgIENhbm9uaWNhbEhvc3RlZFpvbmVJZDogJ1oxMjM0JyxcbiAgICAgICAgICAgIFNlY3VyaXR5R3JvdXBzOiBbJ3NnLTIzNDUnXSxcbiAgICAgICAgICAgIFZwY0lkOiAndnBjLTEyMzQnLFxuICAgICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZVRhZ3NDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIyJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzT25jZSh7XG4gICAgICAgIExpc3RlbmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFdyb25nIHBvcnQsIHdyb25nIHByb3RvY29sID0+IG5vIG1hdGNoXG4gICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMScsXG4gICAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICAgICAgUG9ydDogODAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBXcm9uZyBwcm90b2NvbCwgcmlnaHQgcG9ydCA9PiBubyBtYXRjaFxuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMycsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgUHJvdG9jb2w6ICdIVFRQUycsXG4gICAgICAgICAgICBQb3J0OiA0NDMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBXcm9uZyBwb3J0LCByaWdodCBwcm90b2NvbCA9PiBubyBtYXRjaFxuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuNCcsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjEnLFxuICAgICAgICAgICAgUHJvdG9jb2w6ICdUQ1AnLFxuICAgICAgICAgICAgUG9ydDogOTk5LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLnJlc29sdmVzT25jZSh7XG4gICAgICAgIExpc3RlbmVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFdyb25nIHBvcnQsIHdyb25nIHByb3RvY29sID0+IG5vIG1hdGNoXG4gICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm41JyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyMicsXG4gICAgICAgICAgICBQcm90b2NvbDogJ0hUVFAnLFxuICAgICAgICAgICAgUG9ydDogODAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBSaWdodCBwb3J0LCByaWdodCBwcm90b2NvbCA9PiBtYXRjaFxuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuNicsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgICAgUG9ydDogNDQzLFxuICAgICAgICAgICAgUHJvdG9jb2w6ICdUQ1AnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudC5vbihEZXNjcmliZVRhZ3NDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICBUYWdEZXNjcmlwdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIFJlc291cmNlQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXIxJyxcbiAgICAgICAgICBUYWdzOiBbeyBLZXk6ICdzb21lJywgVmFsdWU6ICd0YWcnIH1dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlcjInLFxuICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gbmV3IExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspO1xuXG4gICAgLy8gV0hFTlxuICAgIGNvbnN0IGxpc3RlbmVyID0gYXdhaXQgcHJvdmlkZXIuZ2V0VmFsdWUoe1xuICAgICAgYWNjb3VudDogJzEyMzQnLFxuICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIGxvYWRCYWxhbmNlclR5cGU6IExvYWRCYWxhbmNlclR5cGUuQVBQTElDQVRJT04sXG4gICAgICBsb2FkQmFsYW5jZXJUYWdzOiBbeyBrZXk6ICdzb21lJywgdmFsdWU6ICd0YWcnIH1dLFxuICAgICAgbGlzdGVuZXJQcm90b2NvbDogTG9hZEJhbGFuY2VyTGlzdGVuZXJQcm90b2NvbC5UQ1AsXG4gICAgICBsaXN0ZW5lclBvcnQ6IDQ0MyxcbiAgICB9KTtcblxuICAgIC8vIFRIRU5cbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJBcm4pLnRvRXF1YWwoJ2FybjpsaXN0ZW5lci1hcm42Jyk7XG4gICAgZXhwZWN0KGxpc3RlbmVyLmxpc3RlbmVyUG9ydCkudG9FcXVhbCg0NDMpO1xuICAgIGV4cGVjdChsaXN0ZW5lci5zZWN1cml0eUdyb3VwSWRzKS50b0VxdWFsKFsnc2ctMjM0NSddKTtcbiAgfSk7XG5cbiAgdGVzdCgnZmlsdGVycyBieSBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXIgdHlwZScsIGFzeW5jICgpID0+IHtcbiAgICAvLyBHSVZFTlxuICAgIG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50XG4gICAgICAub24oRGVzY3JpYmVMb2FkQmFsYW5jZXJzQ29tbWFuZClcbiAgICAgIC5yZXNvbHZlcyh7XG4gICAgICAgIExvYWRCYWxhbmNlcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBUaGlzIG9uZSBoYXMgd3JvbmcgdHlwZSA9PiBubyBtYXRjaFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMScsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogW10sXG4gICAgICAgICAgICBUeXBlOiAnYXBwbGljYXRpb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gUmlnaHQgdHlwZSA9PiBtYXRjaFxuICAgICAgICAgICAgTG9hZEJhbGFuY2VyQXJuOiAnYXJuOmxvYWQtYmFsYW5jZXItYXJuMicsXG4gICAgICAgICAgICBTZWN1cml0eUdyb3VwczogW10sXG4gICAgICAgICAgICBUeXBlOiAnbmV0d29yaycsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAub24oRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgTGlzdGVuZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgTGlzdGVuZXJBcm46ICdhcm46bGlzdGVuZXItYXJuMicsXG4gICAgICAgICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4yJyxcbiAgICAgICAgICAgIFBvcnQ6IDQ0MyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZVRhZ3NDb21tYW5kKVxuICAgICAgLnJlc29sdmVzKHtcbiAgICAgICAgVGFnRGVzY3JpcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgUmVzb3VyY2VBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4xJyxcbiAgICAgICAgICAgIFRhZ3M6IFt7IEtleTogJ3NvbWUnLCBWYWx1ZTogJ3RhZycgfV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBSZXNvdXJjZUFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjInLFxuICAgICAgICAgICAgVGFnczogW3sgS2V5OiAnc29tZScsIFZhbHVlOiAndGFnJyB9XSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4obW9ja1NESyk7XG5cbiAgICAvLyBXSEVOXG4gICAgY29uc3QgbGlzdGVuZXIgPSBhd2FpdCBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgbG9hZEJhbGFuY2VyVHlwZTogTG9hZEJhbGFuY2VyVHlwZS5ORVRXT1JLLFxuICAgICAgbG9hZEJhbGFuY2VyVGFnczogW3sga2V5OiAnc29tZScsIHZhbHVlOiAndGFnJyB9XSxcbiAgICAgIGxpc3RlbmVyUG9ydDogNDQzLFxuICAgIH0pO1xuXG4gICAgLy8gVEhFTlxuICAgIGV4cGVjdChsaXN0ZW5lci5saXN0ZW5lckFybikudG9FcXVhbCgnYXJuOmxpc3RlbmVyLWFybjInKTtcbiAgICBleHBlY3QobGlzdGVuZXIubGlzdGVuZXJQb3J0KS50b0VxdWFsKDQ0Myk7XG4gICAgZXhwZWN0KG1vY2tFbGFzdGljTG9hZEJhbGFuY2luZ1YyQ2xpZW50KS50b0hhdmVSZWNlaXZlZENvbW1hbmRXaXRoKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQsIHtcbiAgICAgIExvYWRCYWxhbmNlckFybnM6IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kLCB7XG4gICAgICBMb2FkQmFsYW5jZXJBcm46ICdhcm46bG9hZC1iYWxhbmNlci1hcm4yJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnZXJyb3JzIHdoZW4gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGlzIHdyb25nIHR5cGUnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gR0lWRU5cbiAgICBtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudFxuICAgICAgLm9uKERlc2NyaWJlTG9hZEJhbGFuY2Vyc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBMb2FkQmFsYW5jZXJzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gVGhpcyBvbmUgaGFzIHdyb25nIHR5cGUgPT4gbm8gbWF0Y2hcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgICAgICAgICAgU2VjdXJpdHlHcm91cHM6IFtdLFxuICAgICAgICAgICAgVHlwZTogJ2FwcGxpY2F0aW9uJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5vbihEZXNjcmliZUxpc3RlbmVyc0NvbW1hbmQpXG4gICAgICAucmVzb2x2ZXMoe1xuICAgICAgICBMaXN0ZW5lcnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBMaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgICAgICAgIExvYWRCYWxhbmNlckFybjogJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnLFxuICAgICAgICAgICAgUG9ydDogNDQzLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICBjb25zdCBwcm92aWRlciA9IG5ldyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbihtb2NrU0RLKTtcblxuICAgIC8vIFdIRU5cbiAgICBhd2FpdCBleHBlY3QoXG4gICAgICBwcm92aWRlci5nZXRWYWx1ZSh7XG4gICAgICAgIGFjY291bnQ6ICcxMjM0JyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgbG9hZEJhbGFuY2VyVHlwZTogTG9hZEJhbGFuY2VyVHlwZS5ORVRXT1JLLFxuICAgICAgICBsaXN0ZW5lckFybjogJ2FybjpsaXN0ZW5lci1hcm4xJyxcbiAgICAgIH0pLFxuICAgICkucmVqZWN0cy50b1Rocm93KCdObyBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXIgZm91bmQgZm9yIGxpc3RlbmVyIGFybiBhcm46bGlzdGVuZXItYXJuMScpO1xuICAgIGV4cGVjdChtb2NrRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCkudG9IYXZlUmVjZWl2ZWRDb21tYW5kV2l0aChEZXNjcmliZUxvYWRCYWxhbmNlcnNDb21tYW5kLCB7XG4gICAgICBMb2FkQmFsYW5jZXJBcm5zOiBbJ2Fybjpsb2FkLWJhbGFuY2VyLWFybjEnXSxcbiAgICB9KTtcbiAgICBleHBlY3QobW9ja0VsYXN0aWNMb2FkQmFsYW5jaW5nVjJDbGllbnQpLnRvSGF2ZVJlY2VpdmVkQ29tbWFuZFdpdGgoRGVzY3JpYmVMaXN0ZW5lcnNDb21tYW5kLCB7XG4gICAgICBMaXN0ZW5lckFybnM6IFsnYXJuOmxpc3RlbmVyLWFybjEnXSxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==