"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSMContextProviderPlugin = void 0;
const sdk_provider_1 = require("../api/aws-auth/sdk-provider");
const logging_1 = require("../logging");
/**
 * Plugin to read arbitrary SSM parameter names
 */
class SSMContextProviderPlugin {
    constructor(aws) {
        this.aws = aws;
    }
    async getValue(args) {
        const region = args.region;
        const account = args.account;
        if (!('parameterName' in args)) {
            throw new Error('parameterName must be provided in props for SSMContextProviderPlugin');
        }
        const parameterName = args.parameterName;
        (0, logging_1.debug)(`Reading SSM parameter ${account}:${region}:${parameterName}`);
        const response = await this.getSsmParameterValue(args);
        const parameterNotFound = !response.Parameter || response.Parameter.Value === undefined;
        const suppressError = 'ignoreErrorOnMissingContext' in args && args.ignoreErrorOnMissingContext;
        if (parameterNotFound && suppressError && 'dummyValue' in args) {
            return args.dummyValue;
        }
        if (parameterNotFound) {
            throw new Error(`SSM parameter not available in account ${account}, region ${region}: ${parameterName}`);
        }
        // will not be undefined because we've handled undefined cases above
        return response.Parameter.Value;
    }
    /**
     * Gets the value of an SSM Parameter, while not throwin if the parameter does not exist.
     * @param account       the account in which the SSM Parameter is expected to be.
     * @param region        the region in which the SSM Parameter is expected to be.
     * @param parameterName the name of the SSM Parameter
     * @param lookupRoleArn the ARN of the lookup role.
     *
     * @returns the result of the ``GetParameter`` operation.
     *
     * @throws Error if a service error (other than ``ParameterNotFound``) occurs.
     */
    async getSsmParameterValue(args) {
        const ssm = (await (0, sdk_provider_1.initContextProviderSdk)(this.aws, args)).ssm();
        try {
            return await ssm.getParameter({ Name: args.parameterName });
        }
        catch (e) {
            if (e.name === 'ParameterNotFound') {
                return { $metadata: {} };
            }
            throw e;
        }
    }
}
exports.SSMContextProviderPlugin = SSMContextProviderPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtLXBhcmFtZXRlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzc20tcGFyYW1ldGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSwrREFBd0Y7QUFFeEYsd0NBQW1DO0FBRW5DOztHQUVHO0FBQ0gsTUFBYSx3QkFBd0I7SUFDbkMsWUFBNkIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUFHLENBQUM7SUFFMUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUE4QjtRQUNsRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzNCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFN0IsSUFBSSxDQUFDLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFDRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3pDLElBQUEsZUFBSyxFQUFDLHlCQUF5QixPQUFPLElBQUksTUFBTSxJQUFJLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFFckUsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQsTUFBTSxpQkFBaUIsR0FBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEtBQUssU0FBUyxDQUFDO1FBQ2pHLE1BQU0sYUFBYSxHQUFHLDZCQUE2QixJQUFJLElBQUksSUFBSyxJQUFJLENBQUMsMkJBQXVDLENBQUM7UUFDN0csSUFBSSxpQkFBaUIsSUFBSSxhQUFhLElBQUksWUFBWSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQy9ELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUN6QixDQUFDO1FBQ0QsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQTBDLE9BQU8sWUFBWSxNQUFNLEtBQUssYUFBYSxFQUFFLENBQUMsQ0FBQztRQUMzRyxDQUFDO1FBQ0Qsb0VBQW9FO1FBQ3BFLE9BQU8sUUFBUSxDQUFDLFNBQVUsQ0FBQyxLQUFLLENBQUM7SUFDbkMsQ0FBQztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBOEI7UUFDL0QsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLElBQUEscUNBQXNCLEVBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2pFLElBQUksQ0FBQztZQUNILE9BQU8sTUFBTSxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFBQyxPQUFPLENBQU0sRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxtQkFBbUIsRUFBRSxDQUFDO2dCQUNuQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDO1lBQzNCLENBQUM7WUFDRCxNQUFNLENBQUMsQ0FBQztRQUNWLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFoREQsNERBZ0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBTU01QYXJhbWV0ZXJDb250ZXh0UXVlcnkgfSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0IHR5cGUgeyBHZXRQYXJhbWV0ZXJDb21tYW5kT3V0cHV0IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LXNzbSc7XG5pbXBvcnQgeyB0eXBlIFNka1Byb3ZpZGVyLCBpbml0Q29udGV4dFByb3ZpZGVyU2RrIH0gZnJvbSAnLi4vYXBpL2F3cy1hdXRoL3Nkay1wcm92aWRlcic7XG5pbXBvcnQgeyBDb250ZXh0UHJvdmlkZXJQbHVnaW4gfSBmcm9tICcuLi9hcGkvcGx1Z2luJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vbG9nZ2luZyc7XG5cbi8qKlxuICogUGx1Z2luIHRvIHJlYWQgYXJiaXRyYXJ5IFNTTSBwYXJhbWV0ZXIgbmFtZXNcbiAqL1xuZXhwb3J0IGNsYXNzIFNTTUNvbnRleHRQcm92aWRlclBsdWdpbiBpbXBsZW1lbnRzIENvbnRleHRQcm92aWRlclBsdWdpbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYXdzOiBTZGtQcm92aWRlcikge31cblxuICBwdWJsaWMgYXN5bmMgZ2V0VmFsdWUoYXJnczogU1NNUGFyYW1ldGVyQ29udGV4dFF1ZXJ5KSB7XG4gICAgY29uc3QgcmVnaW9uID0gYXJncy5yZWdpb247XG4gICAgY29uc3QgYWNjb3VudCA9IGFyZ3MuYWNjb3VudDtcblxuICAgIGlmICghKCdwYXJhbWV0ZXJOYW1lJyBpbiBhcmdzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdwYXJhbWV0ZXJOYW1lIG11c3QgYmUgcHJvdmlkZWQgaW4gcHJvcHMgZm9yIFNTTUNvbnRleHRQcm92aWRlclBsdWdpbicpO1xuICAgIH1cbiAgICBjb25zdCBwYXJhbWV0ZXJOYW1lID0gYXJncy5wYXJhbWV0ZXJOYW1lO1xuICAgIGRlYnVnKGBSZWFkaW5nIFNTTSBwYXJhbWV0ZXIgJHthY2NvdW50fToke3JlZ2lvbn06JHtwYXJhbWV0ZXJOYW1lfWApO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldFNzbVBhcmFtZXRlclZhbHVlKGFyZ3MpO1xuICAgIGNvbnN0IHBhcmFtZXRlck5vdEZvdW5kOiBib29sZWFuID0gIXJlc3BvbnNlLlBhcmFtZXRlciB8fCByZXNwb25zZS5QYXJhbWV0ZXIuVmFsdWUgPT09IHVuZGVmaW5lZDtcbiAgICBjb25zdCBzdXBwcmVzc0Vycm9yID0gJ2lnbm9yZUVycm9yT25NaXNzaW5nQ29udGV4dCcgaW4gYXJncyAmJiAoYXJncy5pZ25vcmVFcnJvck9uTWlzc2luZ0NvbnRleHQgYXMgYm9vbGVhbik7XG4gICAgaWYgKHBhcmFtZXRlck5vdEZvdW5kICYmIHN1cHByZXNzRXJyb3IgJiYgJ2R1bW15VmFsdWUnIGluIGFyZ3MpIHtcbiAgICAgIHJldHVybiBhcmdzLmR1bW15VmFsdWU7XG4gICAgfVxuICAgIGlmIChwYXJhbWV0ZXJOb3RGb3VuZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTU00gcGFyYW1ldGVyIG5vdCBhdmFpbGFibGUgaW4gYWNjb3VudCAke2FjY291bnR9LCByZWdpb24gJHtyZWdpb259OiAke3BhcmFtZXRlck5hbWV9YCk7XG4gICAgfVxuICAgIC8vIHdpbGwgbm90IGJlIHVuZGVmaW5lZCBiZWNhdXNlIHdlJ3ZlIGhhbmRsZWQgdW5kZWZpbmVkIGNhc2VzIGFib3ZlXG4gICAgcmV0dXJuIHJlc3BvbnNlLlBhcmFtZXRlciEuVmFsdWU7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgdmFsdWUgb2YgYW4gU1NNIFBhcmFtZXRlciwgd2hpbGUgbm90IHRocm93aW4gaWYgdGhlIHBhcmFtZXRlciBkb2VzIG5vdCBleGlzdC5cbiAgICogQHBhcmFtIGFjY291bnQgICAgICAgdGhlIGFjY291bnQgaW4gd2hpY2ggdGhlIFNTTSBQYXJhbWV0ZXIgaXMgZXhwZWN0ZWQgdG8gYmUuXG4gICAqIEBwYXJhbSByZWdpb24gICAgICAgIHRoZSByZWdpb24gaW4gd2hpY2ggdGhlIFNTTSBQYXJhbWV0ZXIgaXMgZXhwZWN0ZWQgdG8gYmUuXG4gICAqIEBwYXJhbSBwYXJhbWV0ZXJOYW1lIHRoZSBuYW1lIG9mIHRoZSBTU00gUGFyYW1ldGVyXG4gICAqIEBwYXJhbSBsb29rdXBSb2xlQXJuIHRoZSBBUk4gb2YgdGhlIGxvb2t1cCByb2xlLlxuICAgKlxuICAgKiBAcmV0dXJucyB0aGUgcmVzdWx0IG9mIHRoZSBgYEdldFBhcmFtZXRlcmBgIG9wZXJhdGlvbi5cbiAgICpcbiAgICogQHRocm93cyBFcnJvciBpZiBhIHNlcnZpY2UgZXJyb3IgKG90aGVyIHRoYW4gYGBQYXJhbWV0ZXJOb3RGb3VuZGBgKSBvY2N1cnMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGdldFNzbVBhcmFtZXRlclZhbHVlKGFyZ3M6IFNTTVBhcmFtZXRlckNvbnRleHRRdWVyeSk6IFByb21pc2U8R2V0UGFyYW1ldGVyQ29tbWFuZE91dHB1dD4ge1xuICAgIGNvbnN0IHNzbSA9IChhd2FpdCBpbml0Q29udGV4dFByb3ZpZGVyU2RrKHRoaXMuYXdzLCBhcmdzKSkuc3NtKCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBzc20uZ2V0UGFyYW1ldGVyKHsgTmFtZTogYXJncy5wYXJhbWV0ZXJOYW1lIH0pO1xuICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgaWYgKGUubmFtZSA9PT0gJ1BhcmFtZXRlck5vdEZvdW5kJykge1xuICAgICAgICByZXR1cm4geyAkbWV0YWRhdGE6IHt9IH07XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuIl19