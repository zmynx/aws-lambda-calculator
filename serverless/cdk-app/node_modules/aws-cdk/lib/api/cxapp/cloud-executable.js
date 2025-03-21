"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudExecutable = void 0;
const cloud_assembly_1 = require("./cloud-assembly");
const contextproviders = require("../../context-providers");
const logging_1 = require("../../logging");
const error_1 = require("../../toolkit/error");
/**
 * Represent the Cloud Executable and the synthesis we can do on it
 */
class CloudExecutable {
    constructor(props) {
        this.props = props;
    }
    /**
     * Return whether there is an app command from the configuration
     */
    get hasApp() {
        return !!this.props.configuration.settings.get(['app']);
    }
    /**
     * Synthesize a set of stacks.
     *
     * @param cacheCloudAssembly whether to cache the Cloud Assembly after it has been first synthesized.
     *   This is 'true' by default, and only set to 'false' for 'cdk watch',
     *   which needs to re-synthesize the Assembly each time it detects a change to the project files
     */
    async synthesize(cacheCloudAssembly = true) {
        if (!this._cloudAssembly || !cacheCloudAssembly) {
            this._cloudAssembly = await this.doSynthesize();
        }
        return this._cloudAssembly;
    }
    async doSynthesize() {
        // We may need to run the cloud executable multiple times in order to satisfy all missing context
        // (When the executable runs, it will tell us about context it wants to use
        // but it missing. We'll then look up the context and run the executable again, and
        // again, until it doesn't complain anymore or we've stopped making progress).
        let previouslyMissingKeys;
        while (true) {
            const assembly = await this.props.synthesizer(this.props.sdkProvider, this.props.configuration);
            if (assembly.manifest.missing && assembly.manifest.missing.length > 0) {
                const missingKeys = missingContextKeys(assembly.manifest.missing);
                if (!this.canLookup) {
                    throw new error_1.ToolkitError('Context lookups have been disabled. '
                        + 'Make sure all necessary context is already in \'cdk.context.json\' by running \'cdk synth\' on a machine with sufficient AWS credentials and committing the result. '
                        + `Missing context keys: '${Array.from(missingKeys).join(', ')}'`);
                }
                let tryLookup = true;
                if (previouslyMissingKeys && setsEqual(missingKeys, previouslyMissingKeys)) {
                    (0, logging_1.debug)('Not making progress trying to resolve environmental context. Giving up.');
                    tryLookup = false;
                }
                previouslyMissingKeys = missingKeys;
                if (tryLookup) {
                    (0, logging_1.debug)('Some context information is missing. Fetching...');
                    await contextproviders.provideContextValues(assembly.manifest.missing, this.props.configuration.context, this.props.sdkProvider);
                    // Cache the new context to disk
                    await this.props.configuration.saveContext();
                    // Execute again
                    continue;
                }
            }
            return new cloud_assembly_1.CloudAssembly(assembly);
        }
    }
    get canLookup() {
        return !!(this.props.configuration.settings.get(['lookups']) ?? true);
    }
}
exports.CloudExecutable = CloudExecutable;
/**
 * Return all keys of missing context items
 */
function missingContextKeys(missing) {
    return new Set((missing || []).map(m => m.key));
}
function setsEqual(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    for (const x of a) {
        if (!b.has(x)) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQtZXhlY3V0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsb3VkLWV4ZWN1dGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EscURBQWlEO0FBQ2pELDREQUE0RDtBQUM1RCwyQ0FBc0M7QUFFdEMsK0NBQW1EO0FBeUJuRDs7R0FFRztBQUNILE1BQWEsZUFBZTtJQUcxQixZQUE2QixLQUEyQjtRQUEzQixVQUFLLEdBQUwsS0FBSyxDQUFzQjtJQUN4RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFXLE1BQU07UUFDZixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0ksS0FBSyxDQUFDLFVBQVUsQ0FBQyxxQkFBOEIsSUFBSTtRQUN4RCxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNsRCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQzdCLENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWTtRQUN4QixpR0FBaUc7UUFDakcsMkVBQTJFO1FBQzNFLG1GQUFtRjtRQUNuRiw4RUFBOEU7UUFDOUUsSUFBSSxxQkFBOEMsQ0FBQztRQUNuRCxPQUFPLElBQUksRUFBRSxDQUFDO1lBQ1osTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBRWhHLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN0RSxNQUFNLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUVsRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO29CQUNwQixNQUFNLElBQUksb0JBQVksQ0FDcEIsc0NBQXNDOzBCQUNwQyxzS0FBc0s7MEJBQ3RLLDBCQUEwQixLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3ZFLENBQUM7Z0JBRUQsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNyQixJQUFJLHFCQUFxQixJQUFJLFNBQVMsQ0FBQyxXQUFXLEVBQUUscUJBQXFCLENBQUMsRUFBRSxDQUFDO29CQUMzRSxJQUFBLGVBQUssRUFBQyx5RUFBeUUsQ0FBQyxDQUFDO29CQUNqRixTQUFTLEdBQUcsS0FBSyxDQUFDO2dCQUNwQixDQUFDO2dCQUVELHFCQUFxQixHQUFHLFdBQVcsQ0FBQztnQkFFcEMsSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDZCxJQUFBLGVBQUssRUFBQyxrREFBa0QsQ0FBQyxDQUFDO29CQUUxRCxNQUFNLGdCQUFnQixDQUFDLG9CQUFvQixDQUN6QyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFDekIsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUNoQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUUxQixnQ0FBZ0M7b0JBQ2hDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBRTdDLGdCQUFnQjtvQkFDaEIsU0FBUztnQkFDWCxDQUFDO1lBQ0gsQ0FBQztZQUVELE9BQU8sSUFBSSw4QkFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBWSxTQUFTO1FBQ25CLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7SUFDeEUsQ0FBQztDQUNGO0FBN0VELDBDQTZFQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxPQUFnQztJQUMxRCxPQUFPLElBQUksR0FBRyxDQUFDLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBSSxDQUFTLEVBQUUsQ0FBUztJQUN4QyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQUMsT0FBTyxLQUFLLENBQUM7SUFBQyxDQUFDO0lBQ3hDLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUFDLE9BQU8sS0FBSyxDQUFDO1FBQUMsQ0FBQztJQUNsQyxDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY3hhcGkgZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCB7IENsb3VkQXNzZW1ibHkgfSBmcm9tICcuL2Nsb3VkLWFzc2VtYmx5JztcbmltcG9ydCAqIGFzIGNvbnRleHRwcm92aWRlcnMgZnJvbSAnLi4vLi4vY29udGV4dC1wcm92aWRlcnMnO1xuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuLi8uLi9sb2dnaW5nJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi9zZXR0aW5ncyc7XG5pbXBvcnQgeyBUb29sa2l0RXJyb3IgfSBmcm9tICcuLi8uLi90b29sa2l0L2Vycm9yJztcbmltcG9ydCB7IFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuXG4vKipcbiAqIEByZXR1cm5zIG91dHB1dCBkaXJlY3RvcnlcbiAqL1xuZXhwb3J0IHR5cGUgU3ludGhlc2l6ZXIgPSAoYXdzOiBTZGtQcm92aWRlciwgY29uZmlnOiBDb25maWd1cmF0aW9uKSA9PiBQcm9taXNlPGN4YXBpLkNsb3VkQXNzZW1ibHk+O1xuXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkRXhlY3V0YWJsZVByb3BzIHtcbiAgLyoqXG4gICAqIEFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gKHNldHRpbmdzIGFuZCBjb250ZXh0KVxuICAgKi9cbiAgY29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbjtcblxuICAvKipcbiAgICogQVdTIG9iamVjdCAodXNlZCBieSBzeW50aGVzaXplciBhbmQgY29udGV4dHByb3ZpZGVyKVxuICAgKi9cbiAgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBpbnZva2VkIHRvIHN5bnRoZXNpemUgdGhlIGFjdHVhbCBzdGFja3NcbiAgICovXG4gIHN5bnRoZXNpemVyOiBTeW50aGVzaXplcjtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnQgdGhlIENsb3VkIEV4ZWN1dGFibGUgYW5kIHRoZSBzeW50aGVzaXMgd2UgY2FuIGRvIG9uIGl0XG4gKi9cbmV4cG9ydCBjbGFzcyBDbG91ZEV4ZWN1dGFibGUge1xuICBwcml2YXRlIF9jbG91ZEFzc2VtYmx5PzogQ2xvdWRBc3NlbWJseTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByb3BzOiBDbG91ZEV4ZWN1dGFibGVQcm9wcykge1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB3aGV0aGVyIHRoZXJlIGlzIGFuIGFwcCBjb21tYW5kIGZyb20gdGhlIGNvbmZpZ3VyYXRpb25cbiAgICovXG4gIHB1YmxpYyBnZXQgaGFzQXBwKCkge1xuICAgIHJldHVybiAhIXRoaXMucHJvcHMuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5nZXQoWydhcHAnXSk7XG4gIH1cblxuICAvKipcbiAgICogU3ludGhlc2l6ZSBhIHNldCBvZiBzdGFja3MuXG4gICAqXG4gICAqIEBwYXJhbSBjYWNoZUNsb3VkQXNzZW1ibHkgd2hldGhlciB0byBjYWNoZSB0aGUgQ2xvdWQgQXNzZW1ibHkgYWZ0ZXIgaXQgaGFzIGJlZW4gZmlyc3Qgc3ludGhlc2l6ZWQuXG4gICAqICAgVGhpcyBpcyAndHJ1ZScgYnkgZGVmYXVsdCwgYW5kIG9ubHkgc2V0IHRvICdmYWxzZScgZm9yICdjZGsgd2F0Y2gnLFxuICAgKiAgIHdoaWNoIG5lZWRzIHRvIHJlLXN5bnRoZXNpemUgdGhlIEFzc2VtYmx5IGVhY2ggdGltZSBpdCBkZXRlY3RzIGEgY2hhbmdlIHRvIHRoZSBwcm9qZWN0IGZpbGVzXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgc3ludGhlc2l6ZShjYWNoZUNsb3VkQXNzZW1ibHk6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxDbG91ZEFzc2VtYmx5PiB7XG4gICAgaWYgKCF0aGlzLl9jbG91ZEFzc2VtYmx5IHx8ICFjYWNoZUNsb3VkQXNzZW1ibHkpIHtcbiAgICAgIHRoaXMuX2Nsb3VkQXNzZW1ibHkgPSBhd2FpdCB0aGlzLmRvU3ludGhlc2l6ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2xvdWRBc3NlbWJseTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZG9TeW50aGVzaXplKCk6IFByb21pc2U8Q2xvdWRBc3NlbWJseT4ge1xuICAgIC8vIFdlIG1heSBuZWVkIHRvIHJ1biB0aGUgY2xvdWQgZXhlY3V0YWJsZSBtdWx0aXBsZSB0aW1lcyBpbiBvcmRlciB0byBzYXRpc2Z5IGFsbCBtaXNzaW5nIGNvbnRleHRcbiAgICAvLyAoV2hlbiB0aGUgZXhlY3V0YWJsZSBydW5zLCBpdCB3aWxsIHRlbGwgdXMgYWJvdXQgY29udGV4dCBpdCB3YW50cyB0byB1c2VcbiAgICAvLyBidXQgaXQgbWlzc2luZy4gV2UnbGwgdGhlbiBsb29rIHVwIHRoZSBjb250ZXh0IGFuZCBydW4gdGhlIGV4ZWN1dGFibGUgYWdhaW4sIGFuZFxuICAgIC8vIGFnYWluLCB1bnRpbCBpdCBkb2Vzbid0IGNvbXBsYWluIGFueW1vcmUgb3Igd2UndmUgc3RvcHBlZCBtYWtpbmcgcHJvZ3Jlc3MpLlxuICAgIGxldCBwcmV2aW91c2x5TWlzc2luZ0tleXM6IFNldDxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBhc3NlbWJseSA9IGF3YWl0IHRoaXMucHJvcHMuc3ludGhlc2l6ZXIodGhpcy5wcm9wcy5zZGtQcm92aWRlciwgdGhpcy5wcm9wcy5jb25maWd1cmF0aW9uKTtcblxuICAgICAgaWYgKGFzc2VtYmx5Lm1hbmlmZXN0Lm1pc3NpbmcgJiYgYXNzZW1ibHkubWFuaWZlc3QubWlzc2luZy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IG1pc3NpbmdLZXlzID0gbWlzc2luZ0NvbnRleHRLZXlzKGFzc2VtYmx5Lm1hbmlmZXN0Lm1pc3NpbmcpO1xuXG4gICAgICAgIGlmICghdGhpcy5jYW5Mb29rdXApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKFxuICAgICAgICAgICAgJ0NvbnRleHQgbG9va3VwcyBoYXZlIGJlZW4gZGlzYWJsZWQuICdcbiAgICAgICAgICAgICsgJ01ha2Ugc3VyZSBhbGwgbmVjZXNzYXJ5IGNvbnRleHQgaXMgYWxyZWFkeSBpbiBcXCdjZGsuY29udGV4dC5qc29uXFwnIGJ5IHJ1bm5pbmcgXFwnY2RrIHN5bnRoXFwnIG9uIGEgbWFjaGluZSB3aXRoIHN1ZmZpY2llbnQgQVdTIGNyZWRlbnRpYWxzIGFuZCBjb21taXR0aW5nIHRoZSByZXN1bHQuICdcbiAgICAgICAgICAgICsgYE1pc3NpbmcgY29udGV4dCBrZXlzOiAnJHtBcnJheS5mcm9tKG1pc3NpbmdLZXlzKS5qb2luKCcsICcpfSdgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0cnlMb29rdXAgPSB0cnVlO1xuICAgICAgICBpZiAocHJldmlvdXNseU1pc3NpbmdLZXlzICYmIHNldHNFcXVhbChtaXNzaW5nS2V5cywgcHJldmlvdXNseU1pc3NpbmdLZXlzKSkge1xuICAgICAgICAgIGRlYnVnKCdOb3QgbWFraW5nIHByb2dyZXNzIHRyeWluZyB0byByZXNvbHZlIGVudmlyb25tZW50YWwgY29udGV4dC4gR2l2aW5nIHVwLicpO1xuICAgICAgICAgIHRyeUxvb2t1cCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJldmlvdXNseU1pc3NpbmdLZXlzID0gbWlzc2luZ0tleXM7XG5cbiAgICAgICAgaWYgKHRyeUxvb2t1cCkge1xuICAgICAgICAgIGRlYnVnKCdTb21lIGNvbnRleHQgaW5mb3JtYXRpb24gaXMgbWlzc2luZy4gRmV0Y2hpbmcuLi4nKTtcblxuICAgICAgICAgIGF3YWl0IGNvbnRleHRwcm92aWRlcnMucHJvdmlkZUNvbnRleHRWYWx1ZXMoXG4gICAgICAgICAgICBhc3NlbWJseS5tYW5pZmVzdC5taXNzaW5nLFxuICAgICAgICAgICAgdGhpcy5wcm9wcy5jb25maWd1cmF0aW9uLmNvbnRleHQsXG4gICAgICAgICAgICB0aGlzLnByb3BzLnNka1Byb3ZpZGVyKTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSBuZXcgY29udGV4dCB0byBkaXNrXG4gICAgICAgICAgYXdhaXQgdGhpcy5wcm9wcy5jb25maWd1cmF0aW9uLnNhdmVDb250ZXh0KCk7XG5cbiAgICAgICAgICAvLyBFeGVjdXRlIGFnYWluXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBDbG91ZEFzc2VtYmx5KGFzc2VtYmx5KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldCBjYW5Mb29rdXAoKSB7XG4gICAgcmV0dXJuICEhKHRoaXMucHJvcHMuY29uZmlndXJhdGlvbi5zZXR0aW5ncy5nZXQoWydsb29rdXBzJ10pID8/IHRydWUpO1xuICB9XG59XG5cbi8qKlxuICogUmV0dXJuIGFsbCBrZXlzIG9mIG1pc3NpbmcgY29udGV4dCBpdGVtc1xuICovXG5mdW5jdGlvbiBtaXNzaW5nQ29udGV4dEtleXMobWlzc2luZz86IGN4YXBpLk1pc3NpbmdDb250ZXh0W10pOiBTZXQ8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgU2V0KChtaXNzaW5nIHx8IFtdKS5tYXAobSA9PiBtLmtleSkpO1xufVxuXG5mdW5jdGlvbiBzZXRzRXF1YWw8QT4oYTogU2V0PEE+LCBiOiBTZXQ8QT4pIHtcbiAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7IHJldHVybiBmYWxzZTsgfVxuICBmb3IgKGNvbnN0IHggb2YgYSkge1xuICAgIGlmICghYi5oYXMoeCkpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG4iXX0=