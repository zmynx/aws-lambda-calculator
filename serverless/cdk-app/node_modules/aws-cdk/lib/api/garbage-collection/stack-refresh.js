"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundStackRefresh = exports.ActiveAssetCache = void 0;
exports.refreshStacks = refreshStacks;
const logging_1 = require("../../logging");
const error_1 = require("../../toolkit/error");
class ActiveAssetCache {
    constructor() {
        this.stacks = new Set();
    }
    rememberStack(stackTemplate) {
        this.stacks.add(stackTemplate);
    }
    contains(asset) {
        for (const stack of this.stacks) {
            if (stack.includes(asset)) {
                return true;
            }
        }
        return false;
    }
}
exports.ActiveAssetCache = ActiveAssetCache;
async function paginateSdkCall(cb) {
    let finished = false;
    let nextToken;
    while (!finished) {
        nextToken = await cb(nextToken);
        if (nextToken === undefined) {
            finished = true;
        }
    }
}
/**
 * Fetches all relevant stack templates from CloudFormation. It ignores the following stacks:
 * - stacks in DELETE_COMPLETE or DELETE_IN_PROGRESS stage
 * - stacks that are using a different bootstrap qualifier
 */
async function fetchAllStackTemplates(cfn, qualifier) {
    const stackNames = [];
    await paginateSdkCall(async (nextToken) => {
        const stacks = await cfn.listStacks({ NextToken: nextToken });
        // We ignore stacks with these statuses because their assets are no longer live
        const ignoredStatues = ['CREATE_FAILED', 'DELETE_COMPLETE', 'DELETE_IN_PROGRESS', 'DELETE_FAILED', 'REVIEW_IN_PROGRESS'];
        stackNames.push(...(stacks.StackSummaries ?? [])
            .filter((s) => !ignoredStatues.includes(s.StackStatus))
            .map((s) => s.StackId ?? s.StackName));
        return stacks.NextToken;
    });
    (0, logging_1.debug)(`Parsing through ${stackNames.length} stacks`);
    const templates = [];
    for (const stack of stackNames) {
        let summary;
        summary = await cfn.getTemplateSummary({
            StackName: stack,
        });
        if (bootstrapFilter(summary.Parameters, qualifier)) {
            // This stack is definitely bootstrapped to a different qualifier so we can safely ignore it
            continue;
        }
        else {
            const template = await cfn.getTemplate({
                StackName: stack,
            });
            templates.push((template.TemplateBody ?? '') + JSON.stringify(summary?.Parameters));
        }
    }
    (0, logging_1.debug)('Done parsing through stacks');
    return templates;
}
/**
 * Filter out stacks that we KNOW are using a different bootstrap qualifier
 * This is mostly necessary for the integration tests that can run the same app (with the same assets)
 * under different qualifiers.
 * This is necessary because a stack under a different bootstrap could coincidentally reference the same hash
 * and cause a false negative (cause an asset to be preserved when its isolated)
 * This is intentionally done in a way where we ONLY filter out stacks that are meant for a different qualifier
 * because we are okay with false positives.
 */
function bootstrapFilter(parameters, qualifier) {
    const bootstrapVersion = parameters?.find((p) => p.ParameterKey === 'BootstrapVersion');
    const splitBootstrapVersion = bootstrapVersion?.DefaultValue?.split('/');
    // We find the qualifier in a specific part of the bootstrap version parameter
    return (qualifier &&
        splitBootstrapVersion &&
        splitBootstrapVersion.length == 4 &&
        splitBootstrapVersion[2] != qualifier);
}
async function refreshStacks(cfn, activeAssets, qualifier) {
    try {
        const stacks = await fetchAllStackTemplates(cfn, qualifier);
        for (const stack of stacks) {
            activeAssets.rememberStack(stack);
        }
    }
    catch (err) {
        throw new error_1.ToolkitError(`Error refreshing stacks: ${err}`);
    }
}
/**
 * Class that controls scheduling of the background stack refresh
 */
class BackgroundStackRefresh {
    constructor(props) {
        this.props = props;
        this.queuedPromises = [];
        this.lastRefreshTime = Date.now();
    }
    start() {
        // Since start is going to be called right after the first invocation of refreshStacks,
        // lets wait some time before beginning the background refresh.
        this.timeout = setTimeout(() => this.refresh(), 300000); // 5 minutes
    }
    async refresh() {
        const startTime = Date.now();
        await refreshStacks(this.props.cfn, this.props.activeAssets, this.props.qualifier);
        this.justRefreshedStacks();
        // If the last invocation of refreshStacks takes <5 minutes, the next invocation starts 5 minutes after the last one started.
        // If the last invocation of refreshStacks takes >5 minutes, the next invocation starts immediately.
        this.timeout = setTimeout(() => this.refresh(), Math.max(startTime + 300000 - Date.now(), 0));
    }
    justRefreshedStacks() {
        this.lastRefreshTime = Date.now();
        for (const p of this.queuedPromises.splice(0, this.queuedPromises.length)) {
            p(undefined);
        }
    }
    /**
     * Checks if the last successful background refresh happened within the specified time frame.
     * If the last refresh is older than the specified time frame, it returns a Promise that resolves
     * when the next background refresh completes or rejects if the refresh takes too long.
     */
    noOlderThan(ms) {
        const horizon = Date.now() - ms;
        // The last refresh happened within the time frame
        if (this.lastRefreshTime >= horizon) {
            return Promise.resolve();
        }
        // The last refresh happened earlier than the time frame
        // We will wait for the latest refresh to land or reject if it takes too long
        return Promise.race([
            new Promise(resolve => this.queuedPromises.push(resolve)),
            new Promise((_, reject) => setTimeout(() => reject(new error_1.ToolkitError('refreshStacks took too long; the background thread likely threw an error')), ms)),
        ]);
    }
    stop() {
        clearTimeout(this.timeout);
    }
}
exports.BackgroundStackRefresh = BackgroundStackRefresh;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2stcmVmcmVzaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0YWNrLXJlZnJlc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBbUdBLHNDQVNDO0FBM0dELDJDQUFzQztBQUN0QywrQ0FBbUQ7QUFHbkQsTUFBYSxnQkFBZ0I7SUFBN0I7UUFDbUIsV0FBTSxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBY25ELENBQUM7SUFaUSxhQUFhLENBQUMsYUFBcUI7UUFDeEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVNLFFBQVEsQ0FBQyxLQUFhO1FBQzNCLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMxQixPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFmRCw0Q0FlQztBQUVELEtBQUssVUFBVSxlQUFlLENBQUMsRUFBdUQ7SUFDcEYsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLElBQUksU0FBNkIsQ0FBQztJQUNsQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakIsU0FBUyxHQUFHLE1BQU0sRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hDLElBQUksU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzVCLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILEtBQUssVUFBVSxzQkFBc0IsQ0FBQyxHQUEwQixFQUFFLFNBQWtCO0lBQ2xGLE1BQU0sVUFBVSxHQUFhLEVBQUUsQ0FBQztJQUNoQyxNQUFNLGVBQWUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVB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QzFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLFdBQVcsQ0FBQyxFQUFVO1FBQzNCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFFaEMsa0RBQWtEO1FBQ2xELElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNwQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMzQixDQUFDO1FBRUQsd0RBQXdEO1FBQ3hELDZFQUE2RTtRQUM3RSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDbEIsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN6RCxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxvQkFBWSxDQUFDLDBFQUEwRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztTQUN2SixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sSUFBSTtRQUNULFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0IsQ0FBQztDQUNGO0FBekRELHdEQXlEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBhcmFtZXRlckRlY2xhcmF0aW9uIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3VkZm9ybWF0aW9uJztcbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBUb29sa2l0RXJyb3IgfSBmcm9tICcuLi8uLi90b29sa2l0L2Vycm9yJztcbmltcG9ydCB7IElDbG91ZEZvcm1hdGlvbkNsaWVudCB9IGZyb20gJy4uL2F3cy1hdXRoJztcblxuZXhwb3J0IGNsYXNzIEFjdGl2ZUFzc2V0Q2FjaGUge1xuICBwcml2YXRlIHJlYWRvbmx5IHN0YWNrczogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cbiAgcHVibGljIHJlbWVtYmVyU3RhY2soc3RhY2tUZW1wbGF0ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5zdGFja3MuYWRkKHN0YWNrVGVtcGxhdGUpO1xuICB9XG5cbiAgcHVibGljIGNvbnRhaW5zKGFzc2V0OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGNvbnN0IHN0YWNrIG9mIHRoaXMuc3RhY2tzKSB7XG4gICAgICBpZiAoc3RhY2suaW5jbHVkZXMoYXNzZXQpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcGFnaW5hdGVTZGtDYWxsKGNiOiAobmV4dFRva2VuPzogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4pIHtcbiAgbGV0IGZpbmlzaGVkID0gZmFsc2U7XG4gIGxldCBuZXh0VG9rZW46IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgd2hpbGUgKCFmaW5pc2hlZCkge1xuICAgIG5leHRUb2tlbiA9IGF3YWl0IGNiKG5leHRUb2tlbik7XG4gICAgaWYgKG5leHRUb2tlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRmV0Y2hlcyBhbGwgcmVsZXZhbnQgc3RhY2sgdGVtcGxhdGVzIGZyb20gQ2xvdWRGb3JtYXRpb24uIEl0IGlnbm9yZXMgdGhlIGZvbGxvd2luZyBzdGFja3M6XG4gKiAtIHN0YWNrcyBpbiBERUxFVEVfQ09NUExFVEUgb3IgREVMRVRFX0lOX1BST0dSRVNTIHN0YWdlXG4gKiAtIHN0YWNrcyB0aGF0IGFyZSB1c2luZyBhIGRpZmZlcmVudCBib290c3RyYXAgcXVhbGlmaWVyXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQWxsU3RhY2tUZW1wbGF0ZXMoY2ZuOiBJQ2xvdWRGb3JtYXRpb25DbGllbnQsIHF1YWxpZmllcj86IHN0cmluZykge1xuICBjb25zdCBzdGFja05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBhd2FpdCBwYWdpbmF0ZVNka0NhbGwoYXN5bmMgKG5leHRUb2tlbikgPT4ge1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IGNmbi5saXN0U3RhY2tzKHsgTmV4dFRva2VuOiBuZXh0VG9rZW4gfSk7XG5cbiAgICAvLyBXZSBpZ25vcmUgc3RhY2tzIHdpdGggdGhlc2Ugc3RhdHVzZXMgYmVjYXVzZSB0aGVpciBhc3NldHMgYXJlIG5vIGxvbmdlciBsaXZlXG4gICAgY29uc3QgaWdub3JlZFN0YXR1ZXMgPSBbJ0NSRUFURV9GQUlMRUQnLCAnREVMRVRFX0NPTVBMRVRFJywgJ0RFTEVURV9JTl9QUk9HUkVTUycsICdERUxFVEVfRkFJTEVEJywgJ1JFVklFV19JTl9QUk9HUkVTUyddO1xuICAgIHN0YWNrTmFtZXMucHVzaChcbiAgICAgIC4uLihzdGFja3MuU3RhY2tTdW1tYXJpZXMgPz8gW10pXG4gICAgICAgIC5maWx0ZXIoKHM6IGFueSkgPT4gIWlnbm9yZWRTdGF0dWVzLmluY2x1ZGVzKHMuU3RhY2tTdGF0dXMpKVxuICAgICAgICAubWFwKChzOiBhbnkpID0+IHMuU3RhY2tJZCA/PyBzLlN0YWNrTmFtZSksXG4gICAgKTtcblxuICAgIHJldHVybiBzdGFja3MuTmV4dFRva2VuO1xuICB9KTtcblxuICBkZWJ1ZyhgUGFyc2luZyB0aHJvdWdoICR7c3RhY2tOYW1lcy5sZW5ndGh9IHN0YWNrc2ApO1xuXG4gIGNvbnN0IHRlbXBsYXRlczogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzdGFjayBvZiBzdGFja05hbWVzKSB7XG4gICAgbGV0IHN1bW1hcnk7XG4gICAgc3VtbWFyeSA9IGF3YWl0IGNmbi5nZXRUZW1wbGF0ZVN1bW1hcnkoe1xuICAgICAgU3RhY2tOYW1lOiBzdGFjayxcbiAgICB9KTtcblxuICAgIGlmIChib290c3RyYXBGaWx0ZXIoc3VtbWFyeS5QYXJhbWV0ZXJzLCBxdWFsaWZpZXIpKSB7XG4gICAgICAvLyBUaGlzIHN0YWNrIGlzIGRlZmluaXRlbHkgYm9vdHN0cmFwcGVkIHRvIGEgZGlmZmVyZW50IHF1YWxpZmllciBzbyB3ZSBjYW4gc2FmZWx5IGlnbm9yZSBpdFxuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlID0gYXdhaXQgY2ZuLmdldFRlbXBsYXRlKHtcbiAgICAgICAgU3RhY2tOYW1lOiBzdGFjayxcbiAgICAgIH0pO1xuXG4gICAgICB0ZW1wbGF0ZXMucHVzaCgodGVtcGxhdGUuVGVtcGxhdGVCb2R5ID8/ICcnKSArIEpTT04uc3RyaW5naWZ5KHN1bW1hcnk/LlBhcmFtZXRlcnMpKTtcbiAgICB9XG4gIH1cblxuICBkZWJ1ZygnRG9uZSBwYXJzaW5nIHRocm91Z2ggc3RhY2tzJyk7XG5cbiAgcmV0dXJuIHRlbXBsYXRlcztcbn1cblxuLyoqXG4gKiBGaWx0ZXIgb3V0IHN0YWNrcyB0aGF0IHdlIEtOT1cgYXJlIHVzaW5nIGEgZGlmZmVyZW50IGJvb3RzdHJhcCBxdWFsaWZpZXJcbiAqIFRoaXMgaXMgbW9zdGx5IG5lY2Vzc2FyeSBmb3IgdGhlIGludGVncmF0aW9uIHRlc3RzIHRoYXQgY2FuIHJ1biB0aGUgc2FtZSBhcHAgKHdpdGggdGhlIHNhbWUgYXNzZXRzKVxuICogdW5kZXIgZGlmZmVyZW50IHF1YWxpZmllcnMuXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGEgc3RhY2sgdW5kZXIgYSBkaWZmZXJlbnQgYm9vdHN0cmFwIGNvdWxkIGNvaW5jaWRlbnRhbGx5IHJlZmVyZW5jZSB0aGUgc2FtZSBoYXNoXG4gKiBhbmQgY2F1c2UgYSBmYWxzZSBuZWdhdGl2ZSAoY2F1c2UgYW4gYXNzZXQgdG8gYmUgcHJlc2VydmVkIHdoZW4gaXRzIGlzb2xhdGVkKVxuICogVGhpcyBpcyBpbnRlbnRpb25hbGx5IGRvbmUgaW4gYSB3YXkgd2hlcmUgd2UgT05MWSBmaWx0ZXIgb3V0IHN0YWNrcyB0aGF0IGFyZSBtZWFudCBmb3IgYSBkaWZmZXJlbnQgcXVhbGlmaWVyXG4gKiBiZWNhdXNlIHdlIGFyZSBva2F5IHdpdGggZmFsc2UgcG9zaXRpdmVzLlxuICovXG5mdW5jdGlvbiBib290c3RyYXBGaWx0ZXIocGFyYW1ldGVycz86IFBhcmFtZXRlckRlY2xhcmF0aW9uW10sIHF1YWxpZmllcj86IHN0cmluZykge1xuICBjb25zdCBib290c3RyYXBWZXJzaW9uID0gcGFyYW1ldGVycz8uZmluZCgocCkgPT4gcC5QYXJhbWV0ZXJLZXkgPT09ICdCb290c3RyYXBWZXJzaW9uJyk7XG4gIGNvbnN0IHNwbGl0Qm9vdHN0cmFwVmVyc2lvbiA9IGJvb3RzdHJhcFZlcnNpb24/LkRlZmF1bHRWYWx1ZT8uc3BsaXQoJy8nKTtcbiAgLy8gV2UgZmluZCB0aGUgcXVhbGlmaWVyIGluIGEgc3BlY2lmaWMgcGFydCBvZiB0aGUgYm9vdHN0cmFwIHZlcnNpb24gcGFyYW1ldGVyXG4gIHJldHVybiAocXVhbGlmaWVyICYmXG4gICAgICAgICAgc3BsaXRCb290c3RyYXBWZXJzaW9uICYmXG4gICAgICAgICAgc3BsaXRCb290c3RyYXBWZXJzaW9uLmxlbmd0aCA9PSA0ICYmXG4gICAgICAgICAgc3BsaXRCb290c3RyYXBWZXJzaW9uWzJdICE9IHF1YWxpZmllcik7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWZyZXNoU3RhY2tzKGNmbjogSUNsb3VkRm9ybWF0aW9uQ2xpZW50LCBhY3RpdmVBc3NldHM6IEFjdGl2ZUFzc2V0Q2FjaGUsIHF1YWxpZmllcj86IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IGZldGNoQWxsU3RhY2tUZW1wbGF0ZXMoY2ZuLCBxdWFsaWZpZXIpO1xuICAgIGZvciAoY29uc3Qgc3RhY2sgb2Ygc3RhY2tzKSB7XG4gICAgICBhY3RpdmVBc3NldHMucmVtZW1iZXJTdGFjayhzdGFjayk7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKGBFcnJvciByZWZyZXNoaW5nIHN0YWNrczogJHtlcnJ9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBCYWNrZ3JvdW5kIFN0YWNrIFJlZnJlc2ggcHJvcGVydGllc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEJhY2tncm91bmRTdGFja1JlZnJlc2hQcm9wcyB7XG4gIC8qKlxuICAgKiBUaGUgQ0ZOIFNESyBoYW5kbGVyXG4gICAqL1xuICByZWFkb25seSBjZm46IElDbG91ZEZvcm1hdGlvbkNsaWVudDtcblxuICAvKipcbiAgICogQWN0aXZlIEFzc2V0IHN0b3JhZ2VcbiAgICovXG4gIHJlYWRvbmx5IGFjdGl2ZUFzc2V0czogQWN0aXZlQXNzZXRDYWNoZTtcblxuICAvKipcbiAgICogU3RhY2sgYm9vdHN0cmFwIHF1YWxpZmllclxuICAgKi9cbiAgcmVhZG9ubHkgcXVhbGlmaWVyPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIENsYXNzIHRoYXQgY29udHJvbHMgc2NoZWR1bGluZyBvZiB0aGUgYmFja2dyb3VuZCBzdGFjayByZWZyZXNoXG4gKi9cbmV4cG9ydCBjbGFzcyBCYWNrZ3JvdW5kU3RhY2tSZWZyZXNoIHtcbiAgcHJpdmF0ZSB0aW1lb3V0PzogTm9kZUpTLlRpbWVvdXQ7XG4gIHByaXZhdGUgbGFzdFJlZnJlc2hUaW1lOiBudW1iZXI7XG4gIHByaXZhdGUgcXVldWVkUHJvbWlzZXM6IEFycmF5PCh2YWx1ZTogdW5rbm93bikgPT4gdm9pZD4gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByb3BzOiBCYWNrZ3JvdW5kU3RhY2tSZWZyZXNoUHJvcHMpIHtcbiAgICB0aGlzLmxhc3RSZWZyZXNoVGltZSA9IERhdGUubm93KCk7XG4gIH1cblxuICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgLy8gU2luY2Ugc3RhcnQgaXMgZ29pbmcgdG8gYmUgY2FsbGVkIHJpZ2h0IGFmdGVyIHRoZSBmaXJzdCBpbnZvY2F0aW9uIG9mIHJlZnJlc2hTdGFja3MsXG4gICAgLy8gbGV0cyB3YWl0IHNvbWUgdGltZSBiZWZvcmUgYmVnaW5uaW5nIHRoZSBiYWNrZ3JvdW5kIHJlZnJlc2guXG4gICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnJlZnJlc2goKSwgMzAwXzAwMCk7IC8vIDUgbWludXRlc1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoKCkge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgICBhd2FpdCByZWZyZXNoU3RhY2tzKHRoaXMucHJvcHMuY2ZuLCB0aGlzLnByb3BzLmFjdGl2ZUFzc2V0cywgdGhpcy5wcm9wcy5xdWFsaWZpZXIpO1xuICAgIHRoaXMuanVzdFJlZnJlc2hlZFN0YWNrcygpO1xuXG4gICAgLy8gSWYgdGhlIGxhc3QgaW52b2NhdGlvbiBvZiByZWZyZXNoU3RhY2tzIHRha2VzIDw1IG1pbnV0ZXMsIHRoZSBuZXh0IGludm9jYXRpb24gc3RhcnRzIDUgbWludXRlcyBhZnRlciB0aGUgbGFzdCBvbmUgc3RhcnRlZC5cbiAgICAvLyBJZiB0aGUgbGFzdCBpbnZvY2F0aW9uIG9mIHJlZnJlc2hTdGFja3MgdGFrZXMgPjUgbWludXRlcywgdGhlIG5leHQgaW52b2NhdGlvbiBzdGFydHMgaW1tZWRpYXRlbHkuXG4gICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnJlZnJlc2goKSwgTWF0aC5tYXgoc3RhcnRUaW1lICsgMzAwXzAwMCAtIERhdGUubm93KCksIDApKTtcbiAgfVxuXG4gIHByaXZhdGUganVzdFJlZnJlc2hlZFN0YWNrcygpIHtcbiAgICB0aGlzLmxhc3RSZWZyZXNoVGltZSA9IERhdGUubm93KCk7XG4gICAgZm9yIChjb25zdCBwIG9mIHRoaXMucXVldWVkUHJvbWlzZXMuc3BsaWNlKDAsIHRoaXMucXVldWVkUHJvbWlzZXMubGVuZ3RoKSkge1xuICAgICAgcCh1bmRlZmluZWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgdGhlIGxhc3Qgc3VjY2Vzc2Z1bCBiYWNrZ3JvdW5kIHJlZnJlc2ggaGFwcGVuZWQgd2l0aGluIHRoZSBzcGVjaWZpZWQgdGltZSBmcmFtZS5cbiAgICogSWYgdGhlIGxhc3QgcmVmcmVzaCBpcyBvbGRlciB0aGFuIHRoZSBzcGVjaWZpZWQgdGltZSBmcmFtZSwgaXQgcmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlc1xuICAgKiB3aGVuIHRoZSBuZXh0IGJhY2tncm91bmQgcmVmcmVzaCBjb21wbGV0ZXMgb3IgcmVqZWN0cyBpZiB0aGUgcmVmcmVzaCB0YWtlcyB0b28gbG9uZy5cbiAgICovXG4gIHB1YmxpYyBub09sZGVyVGhhbihtczogbnVtYmVyKSB7XG4gICAgY29uc3QgaG9yaXpvbiA9IERhdGUubm93KCkgLSBtcztcblxuICAgIC8vIFRoZSBsYXN0IHJlZnJlc2ggaGFwcGVuZWQgd2l0aGluIHRoZSB0aW1lIGZyYW1lXG4gICAgaWYgKHRoaXMubGFzdFJlZnJlc2hUaW1lID49IGhvcml6b24pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgbGFzdCByZWZyZXNoIGhhcHBlbmVkIGVhcmxpZXIgdGhhbiB0aGUgdGltZSBmcmFtZVxuICAgIC8vIFdlIHdpbGwgd2FpdCBmb3IgdGhlIGxhdGVzdCByZWZyZXNoIHRvIGxhbmQgb3IgcmVqZWN0IGlmIGl0IHRha2VzIHRvbyBsb25nXG4gICAgcmV0dXJuIFByb21pc2UucmFjZShbXG4gICAgICBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHRoaXMucXVldWVkUHJvbWlzZXMucHVzaChyZXNvbHZlKSksXG4gICAgICBuZXcgUHJvbWlzZSgoXywgcmVqZWN0KSA9PiBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChuZXcgVG9vbGtpdEVycm9yKCdyZWZyZXNoU3RhY2tzIHRvb2sgdG9vIGxvbmc7IHRoZSBiYWNrZ3JvdW5kIHRocmVhZCBsaWtlbHkgdGhyZXcgYW4gZXJyb3InKSksIG1zKSksXG4gICAgXSk7XG4gIH1cblxuICBwdWJsaWMgc3RvcCgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgfVxufVxuIl19