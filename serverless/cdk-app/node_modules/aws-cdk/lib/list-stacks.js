"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStacks = listStacks;
require("@jsii/check-node/run");
const cloud_assembly_1 = require("./api/cxapp/cloud-assembly");
/**
 * List Stacks
 *
 * @param toolkit cdk toolkit
 * @param options list stacks options
 * @returns StackDetails[]
 */
async function listStacks(toolkit, options) {
    const assembly = await toolkit.assembly();
    const stacks = await assembly.selectStacks({
        patterns: options.selectors,
    }, {
        extend: cloud_assembly_1.ExtendedStackSelection.Upstream,
        defaultBehavior: cloud_assembly_1.DefaultSelection.AllStacks,
    });
    function calculateStackDependencies(collectionOfStacks) {
        const allData = [];
        for (const stack of collectionOfStacks.stackArtifacts) {
            const data = {
                id: stack.displayName ?? stack.id,
                name: stack.stackName,
                environment: stack.environment,
                dependencies: [],
            };
            for (const dependencyId of stack.dependencies.map(x => x.id)) {
                if (dependencyId.includes('.assets')) {
                    continue;
                }
                const depStack = assembly.stackById(dependencyId);
                if (depStack.stackArtifacts[0].dependencies.length > 0 &&
                    depStack.stackArtifacts[0].dependencies.filter((dep) => !(dep.id).includes('.assets')).length > 0) {
                    const stackWithDeps = calculateStackDependencies(depStack);
                    for (const stackDetail of stackWithDeps) {
                        data.dependencies.push({
                            id: stackDetail.id,
                            dependencies: stackDetail.dependencies,
                        });
                    }
                }
                else {
                    data.dependencies.push({
                        id: depStack.stackArtifacts[0].displayName ?? depStack.stackArtifacts[0].id,
                        dependencies: [],
                    });
                }
            }
            allData.push(data);
        }
        return allData;
    }
    return calculateStackDependencies(stacks);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdC1zdGFja3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsaXN0LXN0YWNrcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTJDQSxnQ0FzREM7QUFoR0QsZ0NBQThCO0FBRTlCLCtEQUF1RztBQWlDdkc7Ozs7OztHQU1HO0FBQ0ksS0FBSyxVQUFVLFVBQVUsQ0FBQyxPQUFtQixFQUFFLE9BQTBCO0lBQzlFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRTFDLE1BQU0sTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLFlBQVksQ0FBQztRQUN6QyxRQUFRLEVBQUUsT0FBTyxDQUFDLFNBQVM7S0FDNUIsRUFBRTtRQUNELE1BQU0sRUFBRSx1Q0FBc0IsQ0FBQyxRQUFRO1FBQ3ZDLGVBQWUsRUFBRSxpQ0FBZ0IsQ0FBQyxTQUFTO0tBQzVDLENBQUMsQ0FBQztJQUVILFNBQVMsMEJBQTBCLENBQUMsa0JBQW1DO1FBQ3JFLE1BQU0sT0FBTyxHQUFtQixFQUFFLENBQUM7UUFFbkMsS0FBSyxNQUFNLEtBQUssSUFBSSxrQkFBa0IsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN0RCxNQUFNLElBQUksR0FBaUI7Z0JBQ3pCLEVBQUUsRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxFQUFFO2dCQUNqQyxJQUFJLEVBQUUsS0FBSyxDQUFDLFNBQVM7Z0JBQ3JCLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztnQkFDOUIsWUFBWSxFQUFFLEVBQUU7YUFDakIsQ0FBQztZQUVGLEtBQUssTUFBTSxZQUFZLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDN0QsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7b0JBQ3JDLFNBQVM7Z0JBQ1gsQ0FBQztnQkFFRCxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUVsRCxJQUFJLFFBQVEsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUNwRCxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUVwRyxNQUFNLGFBQWEsR0FBRywwQkFBMEIsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFFM0QsS0FBSyxNQUFNLFdBQVcsSUFBSSxhQUFhLEVBQUUsQ0FBQzt3QkFDeEMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7NEJBQ3JCLEVBQUUsRUFBRSxXQUFXLENBQUMsRUFBRTs0QkFDbEIsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO3lCQUN2QyxDQUFDLENBQUM7b0JBQ0wsQ0FBQztnQkFDSCxDQUFDO3FCQUFNLENBQUM7b0JBQ04sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7d0JBQ3JCLEVBQUUsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsSUFBSSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7d0JBQzNFLFlBQVksRUFBRSxFQUFFO3FCQUNqQixDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNILENBQUM7WUFFRCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsT0FBTywwQkFBMEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM1QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQgJ0Bqc2lpL2NoZWNrLW5vZGUvcnVuJztcbmltcG9ydCB7IEVudmlyb25tZW50IH0gZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCB7IERlZmF1bHRTZWxlY3Rpb24sIEV4dGVuZGVkU3RhY2tTZWxlY3Rpb24sIFN0YWNrQ29sbGVjdGlvbiB9IGZyb20gJy4vYXBpL2N4YXBwL2Nsb3VkLWFzc2VtYmx5JztcbmltcG9ydCB7IENka1Rvb2xraXQgfSBmcm9tICcuL2Nkay10b29sa2l0JztcblxuLyoqXG4gKiBPcHRpb25zIGZvciBMaXN0IFN0YWNrc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIExpc3RTdGFja3NPcHRpb25zIHtcbiAgLyoqXG4gICAqIFN0YWNrcyB0byBsaXN0XG4gICAqXG4gICAqIEBkZWZhdWx0IC0gQWxsIHN0YWNrcyBhcmUgbGlzdGVkXG4gICAqL1xuICByZWFkb25seSBzZWxlY3RvcnM6IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIFR5cGUgdG8gc3RvcmUgc3RhY2sgZGVwZW5kZW5jaWVzIHJlY3Vyc2l2ZWx5XG4gKi9cbmV4cG9ydCB0eXBlIERlcGVuZGVuY3lEZXRhaWxzID0ge1xuICBpZDogc3RyaW5nO1xuICBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lEZXRhaWxzW107XG59O1xuXG4vKipcbiAqIFR5cGUgdG8gc3RvcmUgc3RhY2sgYW5kIHRoZWlyIGRlcGVuZGVuY2llc1xuICovXG5leHBvcnQgdHlwZSBTdGFja0RldGFpbHMgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50O1xuICBkZXBlbmRlbmNpZXM6IERlcGVuZGVuY3lEZXRhaWxzW107XG59O1xuXG4vKipcbiAqIExpc3QgU3RhY2tzXG4gKlxuICogQHBhcmFtIHRvb2xraXQgY2RrIHRvb2xraXRcbiAqIEBwYXJhbSBvcHRpb25zIGxpc3Qgc3RhY2tzIG9wdGlvbnNcbiAqIEByZXR1cm5zIFN0YWNrRGV0YWlsc1tdXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsaXN0U3RhY2tzKHRvb2xraXQ6IENka1Rvb2xraXQsIG9wdGlvbnM6IExpc3RTdGFja3NPcHRpb25zKTogUHJvbWlzZTxTdGFja0RldGFpbHNbXT4ge1xuICBjb25zdCBhc3NlbWJseSA9IGF3YWl0IHRvb2xraXQuYXNzZW1ibHkoKTtcblxuICBjb25zdCBzdGFja3MgPSBhd2FpdCBhc3NlbWJseS5zZWxlY3RTdGFja3Moe1xuICAgIHBhdHRlcm5zOiBvcHRpb25zLnNlbGVjdG9ycyxcbiAgfSwge1xuICAgIGV4dGVuZDogRXh0ZW5kZWRTdGFja1NlbGVjdGlvbi5VcHN0cmVhbSxcbiAgICBkZWZhdWx0QmVoYXZpb3I6IERlZmF1bHRTZWxlY3Rpb24uQWxsU3RhY2tzLFxuICB9KTtcblxuICBmdW5jdGlvbiBjYWxjdWxhdGVTdGFja0RlcGVuZGVuY2llcyhjb2xsZWN0aW9uT2ZTdGFja3M6IFN0YWNrQ29sbGVjdGlvbik6IFN0YWNrRGV0YWlsc1tdIHtcbiAgICBjb25zdCBhbGxEYXRhOiBTdGFja0RldGFpbHNbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBzdGFjayBvZiBjb2xsZWN0aW9uT2ZTdGFja3Muc3RhY2tBcnRpZmFjdHMpIHtcbiAgICAgIGNvbnN0IGRhdGE6IFN0YWNrRGV0YWlscyA9IHtcbiAgICAgICAgaWQ6IHN0YWNrLmRpc3BsYXlOYW1lID8/IHN0YWNrLmlkLFxuICAgICAgICBuYW1lOiBzdGFjay5zdGFja05hbWUsXG4gICAgICAgIGVudmlyb25tZW50OiBzdGFjay5lbnZpcm9ubWVudCxcbiAgICAgICAgZGVwZW5kZW5jaWVzOiBbXSxcbiAgICAgIH07XG5cbiAgICAgIGZvciAoY29uc3QgZGVwZW5kZW5jeUlkIG9mIHN0YWNrLmRlcGVuZGVuY2llcy5tYXAoeCA9PiB4LmlkKSkge1xuICAgICAgICBpZiAoZGVwZW5kZW5jeUlkLmluY2x1ZGVzKCcuYXNzZXRzJykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlcFN0YWNrID0gYXNzZW1ibHkuc3RhY2tCeUlkKGRlcGVuZGVuY3lJZCk7XG5cbiAgICAgICAgaWYgKGRlcFN0YWNrLnN0YWNrQXJ0aWZhY3RzWzBdLmRlcGVuZGVuY2llcy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgZGVwU3RhY2suc3RhY2tBcnRpZmFjdHNbMF0uZGVwZW5kZW5jaWVzLmZpbHRlcigoZGVwKSA9PiAhKGRlcC5pZCkuaW5jbHVkZXMoJy5hc3NldHMnKSkubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgY29uc3Qgc3RhY2tXaXRoRGVwcyA9IGNhbGN1bGF0ZVN0YWNrRGVwZW5kZW5jaWVzKGRlcFN0YWNrKTtcblxuICAgICAgICAgIGZvciAoY29uc3Qgc3RhY2tEZXRhaWwgb2Ygc3RhY2tXaXRoRGVwcykge1xuICAgICAgICAgICAgZGF0YS5kZXBlbmRlbmNpZXMucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBzdGFja0RldGFpbC5pZCxcbiAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBzdGFja0RldGFpbC5kZXBlbmRlbmNpZXMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGF0YS5kZXBlbmRlbmNpZXMucHVzaCh7XG4gICAgICAgICAgICBpZDogZGVwU3RhY2suc3RhY2tBcnRpZmFjdHNbMF0uZGlzcGxheU5hbWUgPz8gZGVwU3RhY2suc3RhY2tBcnRpZmFjdHNbMF0uaWQsXG4gICAgICAgICAgICBkZXBlbmRlbmNpZXM6IFtdLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGFsbERhdGEucHVzaChkYXRhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWxsRGF0YTtcbiAgfVxuXG4gIHJldHVybiBjYWxjdWxhdGVTdGFja0RlcGVuZGVuY2llcyhzdGFja3MpO1xufVxuIl19