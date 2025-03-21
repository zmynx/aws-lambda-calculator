"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyContextProviderPlugin = void 0;
const sdk_provider_1 = require("../api/aws-auth/sdk-provider");
const logging_1 = require("../logging");
class KeyContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(args) {
        const kms = (await (0, sdk_provider_1.initContextProviderSdk)(this.aws, args)).kms();
        const aliasListEntry = await this.findKey(kms, args);
        return this.readKeyProps(aliasListEntry, args);
    }
    // TODO: use paginator function
    async findKey(kms, args) {
        (0, logging_1.debug)(`Listing keys in ${args.account}:${args.region}`);
        let response;
        let nextMarker;
        do {
            response = await kms.listAliases({
                Marker: nextMarker,
            });
            const aliases = response.Aliases || [];
            for (const alias of aliases) {
                if (alias.AliasName == args.aliasName) {
                    return alias;
                }
            }
            nextMarker = response.NextMarker;
        } while (nextMarker);
        const suppressError = 'ignoreErrorOnMissingContext' in args && args.ignoreErrorOnMissingContext;
        const hasDummyKeyId = 'dummyValue' in args && typeof args.dummyValue === 'object' && args.dummyValue !== null && 'keyId' in args.dummyValue;
        if (suppressError && hasDummyKeyId) {
            const keyId = args.dummyValue.keyId;
            return { TargetKeyId: keyId };
        }
        throw new Error(`Could not find any key with alias named ${args.aliasName}`);
    }
    async readKeyProps(alias, args) {
        if (!alias.TargetKeyId) {
            throw new Error(`Could not find any key with alias named ${args.aliasName}`);
        }
        (0, logging_1.debug)(`Key found ${alias.TargetKeyId}`);
        return {
            keyId: alias.TargetKeyId,
        };
    }
}
exports.KeyContextProviderPlugin = KeyContextProviderPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImtleXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBSUEsK0RBQXdGO0FBRXhGLHdDQUFtQztBQUVuQyxNQUFhLHdCQUF3QjtJQUNuQyxZQUE2QixHQUFnQjtRQUFoQixRQUFHLEdBQUgsR0FBRyxDQUFhO0lBQUcsQ0FBQztJQUUxQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQXFCO1FBQ3pDLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxJQUFBLHFDQUFzQixFQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUVqRSxNQUFNLGNBQWMsR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXJELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVELCtCQUErQjtJQUN2QixLQUFLLENBQUMsT0FBTyxDQUFDLEdBQWUsRUFBRSxJQUFxQjtRQUMxRCxJQUFBLGVBQUssRUFBQyxtQkFBbUIsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUV4RCxJQUFJLFFBQWtDLENBQUM7UUFDdkMsSUFBSSxVQUE4QixDQUFDO1FBQ25DLEdBQUcsQ0FBQztZQUNGLFFBQVEsR0FBRyxNQUFNLEdBQUcsQ0FBQyxXQUFXLENBQUM7Z0JBQy9CLE1BQU0sRUFBRSxVQUFVO2FBQ25CLENBQUMsQ0FBQztZQUVILE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1lBQ3ZDLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQzVCLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ3RDLE9BQU8sS0FBSyxDQUFDO2dCQUNmLENBQUM7WUFDSCxDQUFDO1lBRUQsVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDbkMsQ0FBQyxRQUFRLFVBQVUsRUFBRTtRQUVyQixNQUFNLGFBQWEsR0FBRyw2QkFBNkIsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLDJCQUFzQyxDQUFDO1FBQzNHLE1BQU0sYUFBYSxHQUFHLFlBQVksSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsVUFBVSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLElBQUksSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM1SSxJQUFJLGFBQWEsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQyxNQUFNLEtBQUssR0FBSSxJQUFJLENBQUMsVUFBZ0MsQ0FBQyxLQUFLLENBQUM7WUFDM0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBcUIsRUFBRSxJQUFxQjtRQUNyRSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCxJQUFBLGVBQUssRUFBQyxhQUFhLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRXhDLE9BQU87WUFDTCxLQUFLLEVBQUUsS0FBSyxDQUFDLFdBQVc7U0FDekIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXBERCw0REFvREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IEtleUNvbnRleHRRdWVyeSB9IGZyb20gJ0Bhd3MtY2RrL2Nsb3VkLWFzc2VtYmx5LXNjaGVtYSc7XG5pbXBvcnQgdHlwZSB7IEtleUNvbnRleHRSZXNwb25zZSB9IGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgdHlwZSB7IEFsaWFzTGlzdEVudHJ5LCBMaXN0QWxpYXNlc0NvbW1hbmRPdXRwdXQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQta21zJztcbmltcG9ydCB0eXBlIHsgSUtNU0NsaWVudCB9IGZyb20gJy4uL2FwaSc7XG5pbXBvcnQgeyB0eXBlIFNka1Byb3ZpZGVyLCBpbml0Q29udGV4dFByb3ZpZGVyU2RrIH0gZnJvbSAnLi4vYXBpL2F3cy1hdXRoL3Nkay1wcm92aWRlcic7XG5pbXBvcnQgeyBDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuLi9hcGkvcGx1Z2luJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vbG9nZ2luZyc7XG5cbmV4cG9ydCBjbGFzcyBLZXlDb250ZXh0UHJvdmlkZXJQbHVnaW4gaW1wbGVtZW50cyBDb250ZXh0UHJvdmlkZXJQbHVnaW4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGF3czogU2RrUHJvdmlkZXIpIHt9XG5cbiAgcHVibGljIGFzeW5jIGdldFZhbHVlKGFyZ3M6IEtleUNvbnRleHRRdWVyeSkge1xuICAgIGNvbnN0IGttcyA9IChhd2FpdCBpbml0Q29udGV4dFByb3ZpZGVyU2RrKHRoaXMuYXdzLCBhcmdzKSkua21zKCk7XG5cbiAgICBjb25zdCBhbGlhc0xpc3RFbnRyeSA9IGF3YWl0IHRoaXMuZmluZEtleShrbXMsIGFyZ3MpO1xuXG4gICAgcmV0dXJuIHRoaXMucmVhZEtleVByb3BzKGFsaWFzTGlzdEVudHJ5LCBhcmdzKTtcbiAgfVxuXG4gIC8vIFRPRE86IHVzZSBwYWdpbmF0b3IgZnVuY3Rpb25cbiAgcHJpdmF0ZSBhc3luYyBmaW5kS2V5KGttczogSUtNU0NsaWVudCwgYXJnczogS2V5Q29udGV4dFF1ZXJ5KTogUHJvbWlzZTxBbGlhc0xpc3RFbnRyeT4ge1xuICAgIGRlYnVnKGBMaXN0aW5nIGtleXMgaW4gJHthcmdzLmFjY291bnR9OiR7YXJncy5yZWdpb259YCk7XG5cbiAgICBsZXQgcmVzcG9uc2U6IExpc3RBbGlhc2VzQ29tbWFuZE91dHB1dDtcbiAgICBsZXQgbmV4dE1hcmtlcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGRvIHtcbiAgICAgIHJlc3BvbnNlID0gYXdhaXQga21zLmxpc3RBbGlhc2VzKHtcbiAgICAgICAgTWFya2VyOiBuZXh0TWFya2VyLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGFsaWFzZXMgPSByZXNwb25zZS5BbGlhc2VzIHx8IFtdO1xuICAgICAgZm9yIChjb25zdCBhbGlhcyBvZiBhbGlhc2VzKSB7XG4gICAgICAgIGlmIChhbGlhcy5BbGlhc05hbWUgPT0gYXJncy5hbGlhc05hbWUpIHtcbiAgICAgICAgICByZXR1cm4gYWxpYXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbmV4dE1hcmtlciA9IHJlc3BvbnNlLk5leHRNYXJrZXI7XG4gICAgfSB3aGlsZSAobmV4dE1hcmtlcik7XG5cbiAgICBjb25zdCBzdXBwcmVzc0Vycm9yID0gJ2lnbm9yZUVycm9yT25NaXNzaW5nQ29udGV4dCcgaW4gYXJncyAmJiBhcmdzLmlnbm9yZUVycm9yT25NaXNzaW5nQ29udGV4dCBhcyBib29sZWFuO1xuICAgIGNvbnN0IGhhc0R1bW15S2V5SWQgPSAnZHVtbXlWYWx1ZScgaW4gYXJncyAmJiB0eXBlb2YgYXJncy5kdW1teVZhbHVlID09PSAnb2JqZWN0JyAmJiBhcmdzLmR1bW15VmFsdWUgIT09IG51bGwgJiYgJ2tleUlkJyBpbiBhcmdzLmR1bW15VmFsdWU7XG4gICAgaWYgKHN1cHByZXNzRXJyb3IgJiYgaGFzRHVtbXlLZXlJZCkge1xuICAgICAgY29uc3Qga2V5SWQgPSAoYXJncy5kdW1teVZhbHVlIGFzIHsga2V5SWQ6IHN0cmluZyB9KS5rZXlJZDtcbiAgICAgIHJldHVybiB7IFRhcmdldEtleUlkOiBrZXlJZCB9O1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kIGFueSBrZXkgd2l0aCBhbGlhcyBuYW1lZCAke2FyZ3MuYWxpYXNOYW1lfWApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWFkS2V5UHJvcHMoYWxpYXM6IEFsaWFzTGlzdEVudHJ5LCBhcmdzOiBLZXlDb250ZXh0UXVlcnkpOiBQcm9taXNlPEtleUNvbnRleHRSZXNwb25zZT4ge1xuICAgIGlmICghYWxpYXMuVGFyZ2V0S2V5SWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgYW55IGtleSB3aXRoIGFsaWFzIG5hbWVkICR7YXJncy5hbGlhc05hbWV9YCk7XG4gICAgfVxuXG4gICAgZGVidWcoYEtleSBmb3VuZCAke2FsaWFzLlRhcmdldEtleUlkfWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtleUlkOiBhbGlhcy5UYXJnZXRLZXlJZCxcbiAgICB9O1xuICB9XG59XG4iXX0=