"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineAllowCrossAccountAssetPublishing = determineAllowCrossAccountAssetPublishing;
exports.getBootstrapStackInfo = getBootstrapStackInfo;
const logging_1 = require("../../logging");
async function determineAllowCrossAccountAssetPublishing(sdk, customStackName) {
    try {
        const stackName = customStackName || 'CDKToolkit';
        const stackInfo = await getBootstrapStackInfo(sdk, stackName);
        if (!stackInfo.hasStagingBucket) {
            // indicates an intentional cross account setup
            return true;
        }
        if (stackInfo.bootstrapVersion >= 21) {
            // bootstrap stack version 21 contains a fix that will prevent cross
            // account publishing on the IAM level
            // https://github.com/aws/aws-cdk/pull/30823
            return true;
        }
        // If there is a staging bucket AND the bootstrap version is old, then we want to protect
        // against accidental cross-account publishing.
        return false;
    }
    catch (e) {
        // You would think we would need to fail closed here, but the reality is
        // that we get here if we couldn't find the bootstrap stack: that is
        // completely valid, and many large organizations may have their own method
        // of creating bootstrap resources. If they do, there's nothing for us to validate,
        // but we can't use that as a reason to disallow cross-account publishing. We'll just
        // have to trust they did their due diligence. So we fail open.
        (0, logging_1.debug)(`Error determining cross account asset publishing: ${e}`);
        (0, logging_1.debug)('Defaulting to allowing cross account asset publishing');
        return true;
    }
}
async function getBootstrapStackInfo(sdk, stackName) {
    try {
        const cfn = sdk.cloudFormation();
        const stackResponse = await cfn.describeStacks({ StackName: stackName });
        if (!stackResponse.Stacks || stackResponse.Stacks.length === 0) {
            throw new Error(`Toolkit stack ${stackName} not found`);
        }
        const stack = stackResponse.Stacks[0];
        const versionOutput = stack.Outputs?.find(output => output.OutputKey === 'BootstrapVersion');
        if (!versionOutput?.OutputValue) {
            throw new Error(`Unable to find BootstrapVersion output in the toolkit stack ${stackName}`);
        }
        const bootstrapVersion = parseInt(versionOutput.OutputValue);
        if (isNaN(bootstrapVersion)) {
            throw new Error(`Invalid BootstrapVersion value: ${versionOutput.OutputValue}`);
        }
        // try to get bucketname from the logical resource id. If there is no
        // bucketname, or the value doesn't look like an S3 bucket name, we assume
        // the bucket doesn't exist (this is for the case where a template customizer did
        // not dare to remove the Output, but put a dummy value there like '' or '-' or '***').
        //
        // We would have preferred to look at the stack resources here, but
        // unfortunately the deploy role doesn't have permissions call DescribeStackResources.
        const bucketName = stack.Outputs?.find(output => output.OutputKey === 'BucketName')?.OutputValue;
        // Must begin and end with letter or number.
        const hasStagingBucket = !!(bucketName && bucketName.match(/^[a-z0-9]/) && bucketName.match(/[a-z0-9]$/));
        return {
            hasStagingBucket,
            bootstrapVersion,
        };
    }
    catch (e) {
        throw new Error(`Error retrieving toolkit stack info: ${e}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2hlY2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0EsOEZBK0JDO0FBT0Qsc0RBdUNDO0FBaEZELDJDQUFzQztBQUcvQixLQUFLLFVBQVUseUNBQXlDLENBQUMsR0FBUSxFQUFFLGVBQXdCO0lBQ2hHLElBQUksQ0FBQztRQUNILE1BQU0sU0FBUyxHQUFHLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFDbEQsTUFBTSxTQUFTLEdBQUcsTUFBTSxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2hDLCtDQUErQztZQUMvQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxJQUFJLFNBQVMsQ0FBQyxnQkFBZ0IsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUNyQyxvRUFBb0U7WUFDcEUsc0NBQXNDO1lBQ3RDLDRDQUE0QztZQUM1QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCx5RkFBeUY7UUFDekYsK0NBQStDO1FBQy9DLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWCx3RUFBd0U7UUFDeEUsb0VBQW9FO1FBQ3BFLDJFQUEyRTtRQUMzRSxtRkFBbUY7UUFDbkYscUZBQXFGO1FBQ3JGLCtEQUErRDtRQUMvRCxJQUFBLGVBQUssRUFBQyxxREFBcUQsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNoRSxJQUFBLGVBQUssRUFBQyx1REFBdUQsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUM7QUFPTSxLQUFLLFVBQVUscUJBQXFCLENBQUMsR0FBUSxFQUFFLFNBQWlCO0lBQ3JFLElBQUksQ0FBQztRQUNILE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNqQyxNQUFNLGFBQWEsR0FBRyxNQUFNLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUV6RSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMvRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixTQUFTLFlBQVksQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxrQkFBa0IsQ0FBQyxDQUFDO1FBRTdGLElBQUksQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLENBQUM7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQywrREFBK0QsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBRUQsTUFBTSxnQkFBZ0IsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzdELElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBRUQscUVBQXFFO1FBQ3JFLDBFQUEwRTtRQUMxRSxpRkFBaUY7UUFDakYsdUZBQXVGO1FBQ3ZGLEVBQUU7UUFDRixtRUFBbUU7UUFDbkUsc0ZBQXNGO1FBQ3RGLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsS0FBSyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUM7UUFDakcsNENBQTRDO1FBQzVDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBRTFHLE9BQU87WUFDTCxnQkFBZ0I7WUFDaEIsZ0JBQWdCO1NBQ2pCLENBQUM7SUFDSixDQUFDO0lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0QsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4uLy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHsgU0RLIH0gZnJvbSAnLi4vYXdzLWF1dGgvc2RrJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRldGVybWluZUFsbG93Q3Jvc3NBY2NvdW50QXNzZXRQdWJsaXNoaW5nKHNkazogU0RLLCBjdXN0b21TdGFja05hbWU/OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGFja05hbWUgPSBjdXN0b21TdGFja05hbWUgfHwgJ0NES1Rvb2xraXQnO1xuICAgIGNvbnN0IHN0YWNrSW5mbyA9IGF3YWl0IGdldEJvb3RzdHJhcFN0YWNrSW5mbyhzZGssIHN0YWNrTmFtZSk7XG5cbiAgICBpZiAoIXN0YWNrSW5mby5oYXNTdGFnaW5nQnVja2V0KSB7XG4gICAgICAvLyBpbmRpY2F0ZXMgYW4gaW50ZW50aW9uYWwgY3Jvc3MgYWNjb3VudCBzZXR1cFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHN0YWNrSW5mby5ib290c3RyYXBWZXJzaW9uID49IDIxKSB7XG4gICAgICAvLyBib290c3RyYXAgc3RhY2sgdmVyc2lvbiAyMSBjb250YWlucyBhIGZpeCB0aGF0IHdpbGwgcHJldmVudCBjcm9zc1xuICAgICAgLy8gYWNjb3VudCBwdWJsaXNoaW5nIG9uIHRoZSBJQU0gbGV2ZWxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvYXdzLWNkay9wdWxsLzMwODIzXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBhIHN0YWdpbmcgYnVja2V0IEFORCB0aGUgYm9vdHN0cmFwIHZlcnNpb24gaXMgb2xkLCB0aGVuIHdlIHdhbnQgdG8gcHJvdGVjdFxuICAgIC8vIGFnYWluc3QgYWNjaWRlbnRhbCBjcm9zcy1hY2NvdW50IHB1Ymxpc2hpbmcuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gWW91IHdvdWxkIHRoaW5rIHdlIHdvdWxkIG5lZWQgdG8gZmFpbCBjbG9zZWQgaGVyZSwgYnV0IHRoZSByZWFsaXR5IGlzXG4gICAgLy8gdGhhdCB3ZSBnZXQgaGVyZSBpZiB3ZSBjb3VsZG4ndCBmaW5kIHRoZSBib290c3RyYXAgc3RhY2s6IHRoYXQgaXNcbiAgICAvLyBjb21wbGV0ZWx5IHZhbGlkLCBhbmQgbWFueSBsYXJnZSBvcmdhbml6YXRpb25zIG1heSBoYXZlIHRoZWlyIG93biBtZXRob2RcbiAgICAvLyBvZiBjcmVhdGluZyBib290c3RyYXAgcmVzb3VyY2VzLiBJZiB0aGV5IGRvLCB0aGVyZSdzIG5vdGhpbmcgZm9yIHVzIHRvIHZhbGlkYXRlLFxuICAgIC8vIGJ1dCB3ZSBjYW4ndCB1c2UgdGhhdCBhcyBhIHJlYXNvbiB0byBkaXNhbGxvdyBjcm9zcy1hY2NvdW50IHB1Ymxpc2hpbmcuIFdlJ2xsIGp1c3RcbiAgICAvLyBoYXZlIHRvIHRydXN0IHRoZXkgZGlkIHRoZWlyIGR1ZSBkaWxpZ2VuY2UuIFNvIHdlIGZhaWwgb3Blbi5cbiAgICBkZWJ1ZyhgRXJyb3IgZGV0ZXJtaW5pbmcgY3Jvc3MgYWNjb3VudCBhc3NldCBwdWJsaXNoaW5nOiAke2V9YCk7XG4gICAgZGVidWcoJ0RlZmF1bHRpbmcgdG8gYWxsb3dpbmcgY3Jvc3MgYWNjb3VudCBhc3NldCBwdWJsaXNoaW5nJyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuaW50ZXJmYWNlIEJvb3RzdHJhcFN0YWNrSW5mbyB7XG4gIGhhc1N0YWdpbmdCdWNrZXQ6IGJvb2xlYW47XG4gIGJvb3RzdHJhcFZlcnNpb246IG51bWJlcjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEJvb3RzdHJhcFN0YWNrSW5mbyhzZGs6IFNESywgc3RhY2tOYW1lOiBzdHJpbmcpOiBQcm9taXNlPEJvb3RzdHJhcFN0YWNrSW5mbz4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNmbiA9IHNkay5jbG91ZEZvcm1hdGlvbigpO1xuICAgIGNvbnN0IHN0YWNrUmVzcG9uc2UgPSBhd2FpdCBjZm4uZGVzY3JpYmVTdGFja3MoeyBTdGFja05hbWU6IHN0YWNrTmFtZSB9KTtcblxuICAgIGlmICghc3RhY2tSZXNwb25zZS5TdGFja3MgfHwgc3RhY2tSZXNwb25zZS5TdGFja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRvb2xraXQgc3RhY2sgJHtzdGFja05hbWV9IG5vdCBmb3VuZGApO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YWNrID0gc3RhY2tSZXNwb25zZS5TdGFja3NbMF07XG4gICAgY29uc3QgdmVyc2lvbk91dHB1dCA9IHN0YWNrLk91dHB1dHM/LmZpbmQob3V0cHV0ID0+IG91dHB1dC5PdXRwdXRLZXkgPT09ICdCb290c3RyYXBWZXJzaW9uJyk7XG5cbiAgICBpZiAoIXZlcnNpb25PdXRwdXQ/Lk91dHB1dFZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBmaW5kIEJvb3RzdHJhcFZlcnNpb24gb3V0cHV0IGluIHRoZSB0b29sa2l0IHN0YWNrICR7c3RhY2tOYW1lfWApO1xuICAgIH1cblxuICAgIGNvbnN0IGJvb3RzdHJhcFZlcnNpb24gPSBwYXJzZUludCh2ZXJzaW9uT3V0cHV0Lk91dHB1dFZhbHVlKTtcbiAgICBpZiAoaXNOYU4oYm9vdHN0cmFwVmVyc2lvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBCb290c3RyYXBWZXJzaW9uIHZhbHVlOiAke3ZlcnNpb25PdXRwdXQuT3V0cHV0VmFsdWV9YCk7XG4gICAgfVxuXG4gICAgLy8gdHJ5IHRvIGdldCBidWNrZXRuYW1lIGZyb20gdGhlIGxvZ2ljYWwgcmVzb3VyY2UgaWQuIElmIHRoZXJlIGlzIG5vXG4gICAgLy8gYnVja2V0bmFtZSwgb3IgdGhlIHZhbHVlIGRvZXNuJ3QgbG9vayBsaWtlIGFuIFMzIGJ1Y2tldCBuYW1lLCB3ZSBhc3N1bWVcbiAgICAvLyB0aGUgYnVja2V0IGRvZXNuJ3QgZXhpc3QgKHRoaXMgaXMgZm9yIHRoZSBjYXNlIHdoZXJlIGEgdGVtcGxhdGUgY3VzdG9taXplciBkaWRcbiAgICAvLyBub3QgZGFyZSB0byByZW1vdmUgdGhlIE91dHB1dCwgYnV0IHB1dCBhIGR1bW15IHZhbHVlIHRoZXJlIGxpa2UgJycgb3IgJy0nIG9yICcqKionKS5cbiAgICAvL1xuICAgIC8vIFdlIHdvdWxkIGhhdmUgcHJlZmVycmVkIHRvIGxvb2sgYXQgdGhlIHN0YWNrIHJlc291cmNlcyBoZXJlLCBidXRcbiAgICAvLyB1bmZvcnR1bmF0ZWx5IHRoZSBkZXBsb3kgcm9sZSBkb2Vzbid0IGhhdmUgcGVybWlzc2lvbnMgY2FsbCBEZXNjcmliZVN0YWNrUmVzb3VyY2VzLlxuICAgIGNvbnN0IGJ1Y2tldE5hbWUgPSBzdGFjay5PdXRwdXRzPy5maW5kKG91dHB1dCA9PiBvdXRwdXQuT3V0cHV0S2V5ID09PSAnQnVja2V0TmFtZScpPy5PdXRwdXRWYWx1ZTtcbiAgICAvLyBNdXN0IGJlZ2luIGFuZCBlbmQgd2l0aCBsZXR0ZXIgb3IgbnVtYmVyLlxuICAgIGNvbnN0IGhhc1N0YWdpbmdCdWNrZXQgPSAhIShidWNrZXROYW1lICYmIGJ1Y2tldE5hbWUubWF0Y2goL15bYS16MC05XS8pICYmIGJ1Y2tldE5hbWUubWF0Y2goL1thLXowLTldJC8pKTtcblxuICAgIHJldHVybiB7XG4gICAgICBoYXNTdGFnaW5nQnVja2V0LFxuICAgICAgYm9vdHN0cmFwVmVyc2lvbixcbiAgICB9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJvciByZXRyaWV2aW5nIHRvb2xraXQgc3RhY2sgaW5mbzogJHtlfWApO1xuICB9XG59XG4iXX0=