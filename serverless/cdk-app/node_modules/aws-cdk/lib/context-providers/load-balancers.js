"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerListenerContextProviderPlugin = exports.LoadBalancerContextProviderPlugin = void 0;
const cx_api_1 = require("@aws-cdk/cx-api");
const sdk_provider_1 = require("../api/aws-auth/sdk-provider");
/**
 * Provides load balancer context information.
 */
class LoadBalancerContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(query) {
        if (!query.loadBalancerArn && !query.loadBalancerTags) {
            throw new Error('The load balancer lookup query must specify either `loadBalancerArn` or `loadBalancerTags`');
        }
        const loadBalancer = await (await LoadBalancerProvider.getClient(this.aws, query)).getLoadBalancer();
        const ipAddressType = loadBalancer.IpAddressType === 'ipv4' ? cx_api_1.LoadBalancerIpAddressType.IPV4 : cx_api_1.LoadBalancerIpAddressType.DUAL_STACK;
        return {
            loadBalancerArn: loadBalancer.LoadBalancerArn,
            loadBalancerCanonicalHostedZoneId: loadBalancer.CanonicalHostedZoneId,
            loadBalancerDnsName: loadBalancer.DNSName,
            vpcId: loadBalancer.VpcId,
            securityGroupIds: loadBalancer.SecurityGroups ?? [],
            ipAddressType: ipAddressType,
        };
    }
}
exports.LoadBalancerContextProviderPlugin = LoadBalancerContextProviderPlugin;
/**
 * Provides load balancer listener context information
 */
class LoadBalancerListenerContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(query) {
        if (!query.listenerArn && !query.loadBalancerArn && !query.loadBalancerTags) {
            throw new Error('The load balancer listener query must specify at least one of: `listenerArn`, `loadBalancerArn` or `loadBalancerTags`');
        }
        return (await LoadBalancerProvider.getClient(this.aws, query)).getListener();
    }
}
exports.LoadBalancerListenerContextProviderPlugin = LoadBalancerListenerContextProviderPlugin;
class LoadBalancerProvider {
    static async getClient(aws, query) {
        const client = (await (0, sdk_provider_1.initContextProviderSdk)(aws, query)).elbv2();
        try {
            const listener = query.listenerArn
                ? // Assert we're sure there's at least one so it throws if not
                    (await client.describeListeners({ ListenerArns: [query.listenerArn] })).Listeners[0]
                : undefined;
            return new LoadBalancerProvider(client, { ...query, loadBalancerArn: listener?.LoadBalancerArn || query.loadBalancerArn }, listener);
        }
        catch (err) {
            throw new Error(`No load balancer listeners found matching arn ${query.listenerArn}`);
        }
    }
    constructor(client, filter, listener) {
        this.client = client;
        this.filter = filter;
        this.listener = listener;
    }
    async getLoadBalancer() {
        const loadBalancers = await this.getLoadBalancers();
        if (loadBalancers.length === 0) {
            throw new Error(`No load balancers found matching ${JSON.stringify(this.filter)}`);
        }
        if (loadBalancers.length > 1) {
            throw new Error(`Multiple load balancers found matching ${JSON.stringify(this.filter)} - please provide more specific criteria`);
        }
        return loadBalancers[0];
    }
    async getListener() {
        if (this.listener) {
            try {
                const loadBalancer = await this.getLoadBalancer();
                return {
                    listenerArn: this.listener.ListenerArn,
                    listenerPort: this.listener.Port,
                    securityGroupIds: loadBalancer.SecurityGroups || [],
                };
            }
            catch (err) {
                throw new Error(`No associated load balancer found for listener arn ${this.filter.listenerArn}`);
            }
        }
        const loadBalancers = await this.getLoadBalancers();
        if (loadBalancers.length === 0) {
            throw new Error(`No associated load balancers found for load balancer listener query ${JSON.stringify(this.filter)}`);
        }
        const listeners = (await this.getListenersForLoadBalancers(loadBalancers)).filter((listener) => {
            return ((!this.filter.listenerPort || listener.Port === this.filter.listenerPort) &&
                (!this.filter.listenerProtocol || listener.Protocol === this.filter.listenerProtocol));
        });
        if (listeners.length === 0) {
            throw new Error(`No load balancer listeners found matching ${JSON.stringify(this.filter)}`);
        }
        if (listeners.length > 1) {
            throw new Error(`Multiple load balancer listeners found matching ${JSON.stringify(this.filter)} - please provide more specific criteria`);
        }
        return {
            listenerArn: listeners[0].ListenerArn,
            listenerPort: listeners[0].Port,
            securityGroupIds: loadBalancers.find((lb) => listeners[0].LoadBalancerArn === lb.LoadBalancerArn)?.SecurityGroups || [],
        };
    }
    async getLoadBalancers() {
        const loadBalancerArns = this.filter.loadBalancerArn ? [this.filter.loadBalancerArn] : undefined;
        const loadBalancers = (await this.client.paginateDescribeLoadBalancers({
            LoadBalancerArns: loadBalancerArns,
        })).filter((lb) => lb.Type === this.filter.loadBalancerType);
        return this.filterByTags(loadBalancers);
    }
    async filterByTags(loadBalancers) {
        if (!this.filter.loadBalancerTags) {
            return loadBalancers;
        }
        return (await this.describeTags(loadBalancers.map((lb) => lb.LoadBalancerArn)))
            .filter((tagDescription) => {
            // For every tag in the filter, there is some tag in the LB that matches it.
            // In other words, the set of tags in the filter is a subset of the set of tags in the LB.
            return this.filter.loadBalancerTags.every((filter) => {
                return tagDescription.Tags?.some((tag) => filter.key === tag.Key && filter.value === tag.Value);
            });
        })
            .flatMap((tag) => loadBalancers.filter((loadBalancer) => tag.ResourceArn === loadBalancer.LoadBalancerArn));
    }
    /**
     * Returns tag descriptions associated with the resources. The API doesn't support
     * pagination, so this function breaks the resource list into chunks and issues
     * the appropriate requests.
     */
    async describeTags(resourceArns) {
        // Max of 20 resource arns per request.
        const chunkSize = 20;
        const tags = Array();
        for (let i = 0; i < resourceArns.length; i += chunkSize) {
            const chunk = resourceArns.slice(i, Math.min(i + chunkSize, resourceArns.length));
            const chunkTags = await this.client.describeTags({
                ResourceArns: chunk,
            });
            tags.push(...(chunkTags.TagDescriptions || []));
        }
        return tags;
    }
    async getListenersForLoadBalancers(loadBalancers) {
        const listeners = [];
        for (const loadBalancer of loadBalancers.map((lb) => lb.LoadBalancerArn)) {
            listeners.push(...(await this.client.paginateDescribeListeners({ LoadBalancerArn: loadBalancer })));
        }
        return listeners;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC1iYWxhbmNlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsb2FkLWJhbGFuY2Vycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw0Q0FJeUI7QUFHekIsK0RBQXdGO0FBR3hGOztHQUVHO0FBQ0gsTUFBYSxpQ0FBaUM7SUFDNUMsWUFBNkIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUFHLENBQUM7SUFFakQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUErQjtRQUM1QyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3RELE1BQU0sSUFBSSxLQUFLLENBQUMsNEZBQTRGLENBQUMsQ0FBQztRQUNoSCxDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUVyRyxNQUFNLGFBQWEsR0FDakIsWUFBWSxDQUFDLGFBQWEsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLGtDQUF5QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsa0NBQXlCLENBQUMsVUFBVSxDQUFDO1FBRWhILE9BQU87WUFDTCxlQUFlLEVBQUUsWUFBWSxDQUFDLGVBQWdCO1lBQzlDLGlDQUFpQyxFQUFFLFlBQVksQ0FBQyxxQkFBc0I7WUFDdEUsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLE9BQVE7WUFDMUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxLQUFNO1lBQzFCLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxjQUFjLElBQUksRUFBRTtZQUNuRCxhQUFhLEVBQUUsYUFBYTtTQUM3QixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBdEJELDhFQXNCQztBQUVEOztHQUVHO0FBQ0gsTUFBYSx5Q0FBeUM7SUFDcEQsWUFBNkIsR0FBZ0I7UUFBaEIs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Qy9DLFlBQVksRUFBRSxLQUFLO2FBQ3BCLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sS0FBSyxDQUFDLDRCQUE0QixDQUFDLGFBQTZCO1FBQ3RFLE1BQU0sU0FBUyxHQUFlLEVBQUUsQ0FBQztRQUNqQyxLQUFLLE1BQU0sWUFBWSxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBQ3pFLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RyxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTG9hZEJhbGFuY2VyQ29udGV4dFF1ZXJ5LCBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRRdWVyeSB9IGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQge1xuICBMb2FkQmFsYW5jZXJDb250ZXh0UmVzcG9uc2UsXG4gIExvYWRCYWxhbmNlcklwQWRkcmVzc1R5cGUsXG4gIExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFJlc3BvbnNlLFxufSBmcm9tICdAYXdzLWNkay9jeC1hcGknO1xuaW1wb3J0IHsgdHlwZSBMaXN0ZW5lciwgTG9hZEJhbGFuY2VyLCB0eXBlIFRhZ0Rlc2NyaXB0aW9uIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWVsYXN0aWMtbG9hZC1iYWxhbmNpbmctdjInO1xuaW1wb3J0IHR5cGUgeyBJRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCB9IGZyb20gJy4uL2FwaSc7XG5pbXBvcnQgeyB0eXBlIFNka1Byb3ZpZGVyLCBpbml0Q29udGV4dFByb3ZpZGVyU2RrIH0gZnJvbSAnLi4vYXBpL2F3cy1hdXRoL3Nkay1wcm92aWRlcic7XG5pbXBvcnQgeyBDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuLi9hcGkvcGx1Z2luJztcblxuLyoqXG4gKiBQcm92aWRlcyBsb2FkIGJhbGFuY2VyIGNvbnRleHQgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2FkQmFsYW5jZXJDb250ZXh0UHJvdmlkZXJQbHVnaW4gaW1wbGVtZW50cyBDb250ZXh0UHJvdmlkZXJQbHVnaW4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGF3czogU2RrUHJvdmlkZXIpIHt9XG5cbiAgYXN5bmMgZ2V0VmFsdWUocXVlcnk6IExvYWRCYWxhbmNlckNvbnRleHRRdWVyeSk6IFByb21pc2U8TG9hZEJhbGFuY2VyQ29udGV4dFJlc3BvbnNlPiB7XG4gICAgaWYgKCFxdWVyeS5sb2FkQmFsYW5jZXJBcm4gJiYgIXF1ZXJ5LmxvYWRCYWxhbmNlclRhZ3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGxvYWQgYmFsYW5jZXIgbG9va3VwIHF1ZXJ5IG11c3Qgc3BlY2lmeSBlaXRoZXIgYGxvYWRCYWxhbmNlckFybmAgb3IgYGxvYWRCYWxhbmNlclRhZ3NgJyk7XG4gICAgfVxuXG4gICAgY29uc3QgbG9hZEJhbGFuY2VyID0gYXdhaXQgKGF3YWl0IExvYWRCYWxhbmNlclByb3ZpZGVyLmdldENsaWVudCh0aGlzLmF3cywgcXVlcnkpKS5nZXRMb2FkQmFsYW5jZXIoKTtcblxuICAgIGNvbnN0IGlwQWRkcmVzc1R5cGUgPVxuICAgICAgbG9hZEJhbGFuY2VyLklwQWRkcmVzc1R5cGUgPT09ICdpcHY0JyA/IExvYWRCYWxhbmNlcklwQWRkcmVzc1R5cGUuSVBWNCA6IExvYWRCYWxhbmNlcklwQWRkcmVzc1R5cGUuRFVBTF9TVEFDSztcblxuICAgIHJldHVybiB7XG4gICAgICBsb2FkQmFsYW5jZXJBcm46IGxvYWRCYWxhbmNlci5Mb2FkQmFsYW5jZXJBcm4hLFxuICAgICAgbG9hZEJhbGFuY2VyQ2Fub25pY2FsSG9zdGVkWm9uZUlkOiBsb2FkQmFsYW5jZXIuQ2Fub25pY2FsSG9zdGVkWm9uZUlkISxcbiAgICAgIGxvYWRCYWxhbmNlckRuc05hbWU6IGxvYWRCYWxhbmNlci5ETlNOYW1lISxcbiAgICAgIHZwY0lkOiBsb2FkQmFsYW5jZXIuVnBjSWQhLFxuICAgICAgc2VjdXJpdHlHcm91cElkczogbG9hZEJhbGFuY2VyLlNlY3VyaXR5R3JvdXBzID8/IFtdLFxuICAgICAgaXBBZGRyZXNzVHlwZTogaXBBZGRyZXNzVHlwZSxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgbG9hZCBiYWxhbmNlciBsaXN0ZW5lciBjb250ZXh0IGluZm9ybWF0aW9uXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRQcm92aWRlclBsdWdpbiBpbXBsZW1lbnRzIENvbnRleHRQcm92aWRlclBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYXdzOiBTZGtQcm92aWRlcikge31cblxuICBhc3luYyBnZXRWYWx1ZShxdWVyeTogTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UXVlcnkpOiBQcm9taXNlPExvYWRCYWxhbmNlckxpc3RlbmVyQ29udGV4dFJlc3BvbnNlPiB7XG4gICAgaWYgKCFxdWVyeS5saXN0ZW5lckFybiAmJiAhcXVlcnkubG9hZEJhbGFuY2VyQXJuICYmICFxdWVyeS5sb2FkQmFsYW5jZXJUYWdzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdUaGUgbG9hZCBiYWxhbmNlciBsaXN0ZW5lciBxdWVyeSBtdXN0IHNwZWNpZnkgYXQgbGVhc3Qgb25lIG9mOiBgbGlzdGVuZXJBcm5gLCBgbG9hZEJhbGFuY2VyQXJuYCBvciBgbG9hZEJhbGFuY2VyVGFnc2AnLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gKGF3YWl0IExvYWRCYWxhbmNlclByb3ZpZGVyLmdldENsaWVudCh0aGlzLmF3cywgcXVlcnkpKS5nZXRMaXN0ZW5lcigpO1xuICB9XG59XG5cbmNsYXNzIExvYWRCYWxhbmNlclByb3ZpZGVyIHtcbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDbGllbnQoXG4gICAgYXdzOiBTZGtQcm92aWRlcixcbiAgICBxdWVyeTogTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UXVlcnksXG4gICk6IFByb21pc2U8TG9hZEJhbGFuY2VyUHJvdmlkZXI+IHtcbiAgICBjb25zdCBjbGllbnQgPSAoYXdhaXQgaW5pdENvbnRleHRQcm92aWRlclNkayhhd3MsIHF1ZXJ5KSkuZWxidjIoKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBsaXN0ZW5lciA9IHF1ZXJ5Lmxpc3RlbmVyQXJuXG4gICAgICAgID8gLy8gQXNzZXJ0IHdlJ3JlIHN1cmUgdGhlcmUncyBhdCBsZWFzdCBvbmUgc28gaXQgdGhyb3dzIGlmIG5vdFxuICAgICAgICAoYXdhaXQgY2xpZW50LmRlc2NyaWJlTGlzdGVuZXJzKHsgTGlzdGVuZXJBcm5zOiBbcXVlcnkubGlzdGVuZXJBcm5dIH0pKS5MaXN0ZW5lcnMhWzBdIVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiBuZXcgTG9hZEJhbGFuY2VyUHJvdmlkZXIoXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgeyAuLi5xdWVyeSwgbG9hZEJhbGFuY2VyQXJuOiBsaXN0ZW5lcj8uTG9hZEJhbGFuY2VyQXJuIHx8IHF1ZXJ5LmxvYWRCYWxhbmNlckFybiB9LFxuICAgICAgICBsaXN0ZW5lcixcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIGxvYWQgYmFsYW5jZXIgbGlzdGVuZXJzIGZvdW5kIG1hdGNoaW5nIGFybiAke3F1ZXJ5Lmxpc3RlbmVyQXJufWApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50OiBJRWxhc3RpY0xvYWRCYWxhbmNpbmdWMkNsaWVudCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGZpbHRlcjogTG9hZEJhbGFuY2VyTGlzdGVuZXJDb250ZXh0UXVlcnksXG4gICAgcHJpdmF0ZSByZWFkb25seSBsaXN0ZW5lcj86IExpc3RlbmVyLFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGdldExvYWRCYWxhbmNlcigpOiBQcm9taXNlPExvYWRCYWxhbmNlcj4ge1xuICAgIGNvbnN0IGxvYWRCYWxhbmNlcnMgPSBhd2FpdCB0aGlzLmdldExvYWRCYWxhbmNlcnMoKTtcblxuICAgIGlmIChsb2FkQmFsYW5jZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBsb2FkIGJhbGFuY2VycyBmb3VuZCBtYXRjaGluZyAke0pTT04uc3RyaW5naWZ5KHRoaXMuZmlsdGVyKX1gKTtcbiAgICB9XG5cbiAgICBpZiAobG9hZEJhbGFuY2Vycy5sZW5ndGggPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBNdWx0aXBsZSBsb2FkIGJhbGFuY2VycyBmb3VuZCBtYXRjaGluZyAke0pTT04uc3RyaW5naWZ5KHRoaXMuZmlsdGVyKX0gLSBwbGVhc2UgcHJvdmlkZSBtb3JlIHNwZWNpZmljIGNyaXRlcmlhYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvYWRCYWxhbmNlcnNbMF07XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0TGlzdGVuZXIoKTogUHJvbWlzZTxMb2FkQmFsYW5jZXJMaXN0ZW5lckNvbnRleHRSZXNwb25zZT4ge1xuICAgIGlmICh0aGlzLmxpc3RlbmVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBsb2FkQmFsYW5jZXIgPSBhd2FpdCB0aGlzLmdldExvYWRCYWxhbmNlcigpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxpc3RlbmVyQXJuOiB0aGlzLmxpc3RlbmVyLkxpc3RlbmVyQXJuISxcbiAgICAgICAgICBsaXN0ZW5lclBvcnQ6IHRoaXMubGlzdGVuZXIuUG9ydCEsXG4gICAgICAgICAgc2VjdXJpdHlHcm91cElkczogbG9hZEJhbGFuY2VyLlNlY3VyaXR5R3JvdXBzIHx8IFtdLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gYXNzb2NpYXRlZCBsb2FkIGJhbGFuY2VyIGZvdW5kIGZvciBsaXN0ZW5lciBhcm4gJHt0aGlzLmZpbHRlci5saXN0ZW5lckFybn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsb2FkQmFsYW5jZXJzID0gYXdhaXQgdGhpcy5nZXRMb2FkQmFsYW5jZXJzKCk7XG4gICAgaWYgKGxvYWRCYWxhbmNlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBObyBhc3NvY2lhdGVkIGxvYWQgYmFsYW5jZXJzIGZvdW5kIGZvciBsb2FkIGJhbGFuY2VyIGxpc3RlbmVyIHF1ZXJ5ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5maWx0ZXIpfWAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3RlbmVycyA9IChhd2FpdCB0aGlzLmdldExpc3RlbmVyc0ZvckxvYWRCYWxhbmNlcnMobG9hZEJhbGFuY2VycykpLmZpbHRlcigobGlzdGVuZXIpID0+IHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgICghdGhpcy5maWx0ZXIubGlzdGVuZXJQb3J0IHx8IGxpc3RlbmVyLlBvcnQgPT09IHRoaXMuZmlsdGVyLmxpc3RlbmVyUG9ydCkgJiZcbiAgICAgICAgKCF0aGlzLmZpbHRlci5saXN0ZW5lclByb3RvY29sIHx8IGxpc3RlbmVyLlByb3RvY29sID09PSB0aGlzLmZpbHRlci5saXN0ZW5lclByb3RvY29sKVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIGxvYWQgYmFsYW5jZXIgbGlzdGVuZXJzIGZvdW5kIG1hdGNoaW5nICR7SlNPTi5zdHJpbmdpZnkodGhpcy5maWx0ZXIpfWApO1xuICAgIH1cblxuICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID4gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgTXVsdGlwbGUgbG9hZCBiYWxhbmNlciBsaXN0ZW5lcnMgZm91bmQgbWF0Y2hpbmcgJHtKU09OLnN0cmluZ2lmeSh0aGlzLmZpbHRlcil9IC0gcGxlYXNlIHByb3ZpZGUgbW9yZSBzcGVjaWZpYyBjcml0ZXJpYWAsXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBsaXN0ZW5lckFybjogbGlzdGVuZXJzWzBdLkxpc3RlbmVyQXJuISxcbiAgICAgIGxpc3RlbmVyUG9ydDogbGlzdGVuZXJzWzBdLlBvcnQhLFxuICAgICAgc2VjdXJpdHlHcm91cElkczpcbiAgICAgICAgbG9hZEJhbGFuY2Vycy5maW5kKChsYikgPT4gbGlzdGVuZXJzWzBdLkxvYWRCYWxhbmNlckFybiA9PT0gbGIuTG9hZEJhbGFuY2VyQXJuKT8uU2VjdXJpdHlHcm91cHMgfHwgW10sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0TG9hZEJhbGFuY2VycygpIHtcbiAgICBjb25zdCBsb2FkQmFsYW5jZXJBcm5zID0gdGhpcy5maWx0ZXIubG9hZEJhbGFuY2VyQXJuID8gW3RoaXMuZmlsdGVyLmxvYWRCYWxhbmNlckFybl0gOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgbG9hZEJhbGFuY2VycyA9IChcbiAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnBhZ2luYXRlRGVzY3JpYmVMb2FkQmFsYW5jZXJzKHtcbiAgICAgICAgTG9hZEJhbGFuY2VyQXJuczogbG9hZEJhbGFuY2VyQXJucyxcbiAgICAgIH0pXG4gICAgKS5maWx0ZXIoKGxiKSA9PiBsYi5UeXBlID09PSB0aGlzLmZpbHRlci5sb2FkQmFsYW5jZXJUeXBlKTtcblxuICAgIHJldHVybiB0aGlzLmZpbHRlckJ5VGFncyhsb2FkQmFsYW5jZXJzKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmlsdGVyQnlUYWdzKGxvYWRCYWxhbmNlcnM6IExvYWRCYWxhbmNlcltdKTogUHJvbWlzZTxMb2FkQmFsYW5jZXJbXT4ge1xuICAgIGlmICghdGhpcy5maWx0ZXIubG9hZEJhbGFuY2VyVGFncykge1xuICAgICAgcmV0dXJuIGxvYWRCYWxhbmNlcnM7XG4gICAgfVxuICAgIHJldHVybiAoYXdhaXQgdGhpcy5kZXNjcmliZVRhZ3MobG9hZEJhbGFuY2Vycy5tYXAoKGxiKSA9PiBsYi5Mb2FkQmFsYW5jZXJBcm4hKSkpXG4gICAgICAuZmlsdGVyKCh0YWdEZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAvLyBGb3IgZXZlcnkgdGFnIGluIHRoZSBmaWx0ZXIsIHRoZXJlIGlzIHNvbWUgdGFnIGluIHRoZSBMQiB0aGF0IG1hdGNoZXMgaXQuXG4gICAgICAgIC8vIEluIG90aGVyIHdvcmRzLCB0aGUgc2V0IG9mIHRhZ3MgaW4gdGhlIGZpbHRlciBpcyBhIHN1YnNldCBvZiB0aGUgc2V0IG9mIHRhZ3MgaW4gdGhlIExCLlxuICAgICAgICByZXR1cm4gdGhpcy5maWx0ZXIubG9hZEJhbGFuY2VyVGFncyEuZXZlcnkoKGZpbHRlcikgPT4ge1xuICAgICAgICAgIHJldHVybiB0YWdEZXNjcmlwdGlvbi5UYWdzPy5zb21lKCh0YWcpID0+XG4gICAgICAgICAgICBmaWx0ZXIua2V5ID09PSB0YWcuS2V5ICYmIGZpbHRlci52YWx1ZSA9PT0gdGFnLlZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmZsYXRNYXAoKHRhZykgPT4gbG9hZEJhbGFuY2Vycy5maWx0ZXIoKGxvYWRCYWxhbmNlcikgPT4gdGFnLlJlc291cmNlQXJuID09PSBsb2FkQmFsYW5jZXIuTG9hZEJhbGFuY2VyQXJuKSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0YWcgZGVzY3JpcHRpb25zIGFzc29jaWF0ZWQgd2l0aCB0aGUgcmVzb3VyY2VzLiBUaGUgQVBJIGRvZXNuJ3Qgc3VwcG9ydFxuICAgKiBwYWdpbmF0aW9uLCBzbyB0aGlzIGZ1bmN0aW9uIGJyZWFrcyB0aGUgcmVzb3VyY2UgbGlzdCBpbnRvIGNodW5rcyBhbmQgaXNzdWVzXG4gICAqIHRoZSBhcHByb3ByaWF0ZSByZXF1ZXN0cy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZGVzY3JpYmVUYWdzKHJlc291cmNlQXJuczogc3RyaW5nW10pOiBQcm9taXNlPFRhZ0Rlc2NyaXB0aW9uW10+IHtcbiAgICAvLyBNYXggb2YgMjAgcmVzb3VyY2UgYXJucyBwZXIgcmVxdWVzdC5cbiAgICBjb25zdCBjaHVua1NpemUgPSAyMDtcbiAgICBjb25zdCB0YWdzID0gQXJyYXk8VGFnRGVzY3JpcHRpb24+KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXNvdXJjZUFybnMubGVuZ3RoOyBpICs9IGNodW5rU2l6ZSkge1xuICAgICAgY29uc3QgY2h1bmsgPSByZXNvdXJjZUFybnMuc2xpY2UoaSwgTWF0aC5taW4oaSArIGNodW5rU2l6ZSwgcmVzb3VyY2VBcm5zLmxlbmd0aCkpO1xuICAgICAgY29uc3QgY2h1bmtUYWdzID0gYXdhaXQgdGhpcy5jbGllbnQuZGVzY3JpYmVUYWdzKHtcbiAgICAgICAgUmVzb3VyY2VBcm5zOiBjaHVuayxcbiAgICAgIH0pO1xuXG4gICAgICB0YWdzLnB1c2goLi4uKGNodW5rVGFncy5UYWdEZXNjcmlwdGlvbnMgfHwgW10pKTtcbiAgICB9XG4gICAgcmV0dXJuIHRhZ3M7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdldExpc3RlbmVyc0ZvckxvYWRCYWxhbmNlcnMobG9hZEJhbGFuY2VyczogTG9hZEJhbGFuY2VyW10pOiBQcm9taXNlPExpc3RlbmVyW10+IHtcbiAgICBjb25zdCBsaXN0ZW5lcnM6IExpc3RlbmVyW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGxvYWRCYWxhbmNlciBvZiBsb2FkQmFsYW5jZXJzLm1hcCgobGIpID0+IGxiLkxvYWRCYWxhbmNlckFybikpIHtcbiAgICAgIGxpc3RlbmVycy5wdXNoKC4uLihhd2FpdCB0aGlzLmNsaWVudC5wYWdpbmF0ZURlc2NyaWJlTGlzdGVuZXJzKHsgTG9hZEJhbGFuY2VyQXJuOiBsb2FkQmFsYW5jZXIgfSkpKTtcbiAgICB9XG4gICAgcmV0dXJuIGxpc3RlbmVycztcbiAgfVxufVxuIl19