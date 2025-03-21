"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RollbackChoice = exports.StackStatus = void 0;
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
/**
 * A utility class to inspect CloudFormation stack statuses.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-describing-stacks.html
 */
class StackStatus {
    static fromStackDescription(description) {
        return new StackStatus(description.StackStatus, description.StackStatusReason);
    }
    constructor(name, reason) {
        this.name = name;
        this.reason = reason;
    }
    get isCreationFailure() {
        return this.name === client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE || this.name === client_cloudformation_1.StackStatus.ROLLBACK_FAILED;
    }
    get isDeleted() {
        return this.name.startsWith('DELETE_');
    }
    get isFailure() {
        return this.name.endsWith('FAILED');
    }
    get isInProgress() {
        return this.name.endsWith('_IN_PROGRESS') && !this.isReviewInProgress;
    }
    get isReviewInProgress() {
        return this.name === client_cloudformation_1.StackStatus.REVIEW_IN_PROGRESS;
    }
    get isNotFound() {
        return this.name === 'NOT_FOUND';
    }
    get isDeploySuccess() {
        return (!this.isNotFound &&
            (this.name === client_cloudformation_1.StackStatus.CREATE_COMPLETE ||
                this.name === client_cloudformation_1.StackStatus.UPDATE_COMPLETE ||
                this.name === client_cloudformation_1.StackStatus.IMPORT_COMPLETE));
    }
    get isRollbackSuccess() {
        return this.name === client_cloudformation_1.StackStatus.ROLLBACK_COMPLETE || this.name === client_cloudformation_1.StackStatus.UPDATE_ROLLBACK_COMPLETE;
    }
    /**
     * Whether the stack is in a paused state due to `--no-rollback`.
     *
     * The possible actions here are retrying a new `--no-rollback` deployment, or initiating a rollback.
     */
    get rollbackChoice() {
        switch (this.name) {
            case client_cloudformation_1.StackStatus.CREATE_FAILED:
            case client_cloudformation_1.StackStatus.UPDATE_FAILED:
                return RollbackChoice.START_ROLLBACK;
            case client_cloudformation_1.StackStatus.UPDATE_ROLLBACK_FAILED:
                return RollbackChoice.CONTINUE_UPDATE_ROLLBACK;
            case client_cloudformation_1.StackStatus.ROLLBACK_FAILED:
                // Unfortunately there is no option to continue a failed rollback without
                // a stable target state.
                return RollbackChoice.ROLLBACK_FAILED;
            default:
                return RollbackChoice.NONE;
        }
    }
    get isRollbackable() {
        return [RollbackChoice.START_ROLLBACK, RollbackChoice.CONTINUE_UPDATE_ROLLBACK].includes(this.rollbackChoice);
    }
    toString() {
        return this.name + (this.reason ? ` (${this.reason})` : '');
    }
}
exports.StackStatus = StackStatus;
/**
 * Describe the current rollback options for this state
 */
var RollbackChoice;
(function (RollbackChoice) {
    RollbackChoice[RollbackChoice["START_ROLLBACK"] = 0] = "START_ROLLBACK";
    RollbackChoice[RollbackChoice["CONTINUE_UPDATE_ROLLBACK"] = 1] = "CONTINUE_UPDATE_ROLLBACK";
    /**
     * A sign that stack creation AND its rollback have failed.
     *
     * There is no way to recover from this, other than recreating the stack.
     */
    RollbackChoice[RollbackChoice["ROLLBACK_FAILED"] = 2] = "ROLLBACK_FAILED";
    RollbackChoice[RollbackChoice["NONE"] = 3] = "NONE";
})(RollbackChoice || (exports.RollbackChoice = RollbackChoice = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhY2stc3RhdHVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RhY2stc3RhdHVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDBFQUF5RjtBQUV6Rjs7OztHQUlHO0FBQ0gsTUFBYSxXQUFXO0lBQ2YsTUFBTSxDQUFDLG9CQUFvQixDQUFDLFdBQWtCO1FBQ25ELE9BQU8sSUFBSSxXQUFXLENBQUMsV0FBVyxDQUFDLFdBQVksRUFBRSxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQsWUFDa0IsSUFBWSxFQUNaLE1BQWU7UUFEZixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1osV0FBTSxHQUFOLE1BQU0sQ0FBUztJQUM5QixDQUFDO0lBRUosSUFBSSxpQkFBaUI7UUFDbkIsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLG1DQUFZLENBQUMsaUJBQWlCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxtQ0FBWSxDQUFDLGVBQWUsQ0FBQztJQUNwRyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1gsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1gsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUN4RSxDQUFDO0lBRUQsSUFBSSxrQkFBa0I7UUFDcEIsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLG1DQUFZLENBQUMsa0JBQWtCLENBQUM7SUFDdkQsQ0FBQztJQUVELElBQUksVUFBVTtRQUNaLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLENBQUM7SUFDbkMsQ0FBQztJQUVELElBQUksZUFBZTtRQUNqQixPQUFPLENBQ0wsQ0FBQyxJQUFJLENBQUMsVUFBVTtZQUNoQixDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssbUNBQVksQ0FBQyxlQUFlO2dCQUN6QyxJQUFJLENBQUMsSUFBSSxLQUFLLG1DQUFZLENBQUMsZUFBZTtnQkFDMUMsSUFBSSxDQUFDLElBQUksS0FBSyxtQ0FBWSxDQUFDLGVBQWUsQ0FBQyxDQUM5QyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksaUJBQWlCO1FBQ25CLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxtQ0FBWSxDQUFDLGlCQUFpQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssbUNBQVksQ0FBQyx3QkFBd0IsQ0FBQztJQUM3RyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILElBQUksY0FBYztRQUNoQixRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQixLQUFLLG1DQUFZLENBQUMsYUFBYSxDQUFDO1lBQ2hDLEtBQUssbUNBQVksQ0FBQyxhQUFhO2dCQUM3QixPQUFPLGNBQWMsQ0FBQyxjQUFjLENBQUM7WUFDdkMsS0FBSyxtQ0FBWSxDQUFDLHNCQUFzQjtnQkFDdEMsT0FBTyxjQUFjLENBQUMsd0JBQXdCLENBQUM7WUFDakQsS0FBSyxtQ0FBWSxDQUFDLGVBQWU7Z0JBQy9CLHlFQUF5RTtnQkFDekUseUJBQXlCO2dCQUN6QixPQUFPLGNBQWMsQ0FBQyxlQUFlLENBQUM7WUFDeEM7Z0JBQ0UsT0FBTyxjQUFjLENBQUMsSUFBSSxDQUFDO1FBQy9CLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxjQUFjO1FBQ2hCLE9BQU8sQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDaEgsQ0FBQztJQUVNLFFBQVE7UUFDYixPQUFPLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUQsQ0FBQztDQUNGO0FBM0VELGtDQTJFQztBQUVEOztHQUVHO0FBQ0gsSUFBWSxjQVVYO0FBVkQsV0FBWSxjQUFjO0lBQ3hCLHVFQUFjLENBQUE7SUFDZCwyRkFBd0IsQ0FBQTtJQUN4Qjs7OztPQUlHO0lBQ0gseUVBQWUsQ0FBQTtJQUNmLG1EQUFJLENBQUE7QUFDTixDQUFDLEVBVlcsY0FBYyw4QkFBZCxjQUFjLFFBVXpCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdHlwZSBTdGFjaywgU3RhY2tTdGF0dXMgYXMgX1N0YWNrU3RhdHVzIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNsb3VkZm9ybWF0aW9uJztcblxuLyoqXG4gKiBBIHV0aWxpdHkgY2xhc3MgdG8gaW5zcGVjdCBDbG91ZEZvcm1hdGlvbiBzdGFjayBzdGF0dXNlcy5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BV1NDbG91ZEZvcm1hdGlvbi9sYXRlc3QvVXNlckd1aWRlL3VzaW5nLWNmbi1kZXNjcmliaW5nLXN0YWNrcy5odG1sXG4gKi9cbmV4cG9ydCBjbGFzcyBTdGFja1N0YXR1cyB7XG4gIHB1YmxpYyBzdGF0aWMgZnJvbVN0YWNrRGVzY3JpcHRpb24oZGVzY3JpcHRpb246IFN0YWNrKSB7XG4gICAgcmV0dXJuIG5ldyBTdGFja1N0YXR1cyhkZXNjcmlwdGlvbi5TdGFja1N0YXR1cyEsIGRlc2NyaXB0aW9uLlN0YWNrU3RhdHVzUmVhc29uKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmcsXG4gICAgcHVibGljIHJlYWRvbmx5IHJlYXNvbj86IHN0cmluZyxcbiAgKSB7fVxuXG4gIGdldCBpc0NyZWF0aW9uRmFpbHVyZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lID09PSBfU3RhY2tTdGF0dXMuUk9MTEJBQ0tfQ09NUExFVEUgfHwgdGhpcy5uYW1lID09PSBfU3RhY2tTdGF0dXMuUk9MTEJBQ0tfRkFJTEVEO1xuICB9XG5cbiAgZ2V0IGlzRGVsZXRlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lLnN0YXJ0c1dpdGgoJ0RFTEVURV8nKTtcbiAgfVxuXG4gIGdldCBpc0ZhaWx1cmUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmFtZS5lbmRzV2l0aCgnRkFJTEVEJyk7XG4gIH1cblxuICBnZXQgaXNJblByb2dyZXNzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hbWUuZW5kc1dpdGgoJ19JTl9QUk9HUkVTUycpICYmICF0aGlzLmlzUmV2aWV3SW5Qcm9ncmVzcztcbiAgfVxuXG4gIGdldCBpc1Jldmlld0luUHJvZ3Jlc3MoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gX1N0YWNrU3RhdHVzLlJFVklFV19JTl9QUk9HUkVTUztcbiAgfVxuXG4gIGdldCBpc05vdEZvdW5kKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hbWUgPT09ICdOT1RfRk9VTkQnO1xuICB9XG5cbiAgZ2V0IGlzRGVwbG95U3VjY2VzcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgIXRoaXMuaXNOb3RGb3VuZCAmJlxuICAgICAgKHRoaXMubmFtZSA9PT0gX1N0YWNrU3RhdHVzLkNSRUFURV9DT01QTEVURSB8fFxuICAgICAgICB0aGlzLm5hbWUgPT09IF9TdGFja1N0YXR1cy5VUERBVEVfQ09NUExFVEUgfHxcbiAgICAgICAgdGhpcy5uYW1lID09PSBfU3RhY2tTdGF0dXMuSU1QT1JUX0NPTVBMRVRFKVxuICAgICk7XG4gIH1cblxuICBnZXQgaXNSb2xsYmFja1N1Y2Nlc3MoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubmFtZSA9PT0gX1N0YWNrU3RhdHVzLlJPTExCQUNLX0NPTVBMRVRFIHx8IHRoaXMubmFtZSA9PT0gX1N0YWNrU3RhdHVzLlVQREFURV9ST0xMQkFDS19DT01QTEVURTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBzdGFjayBpcyBpbiBhIHBhdXNlZCBzdGF0ZSBkdWUgdG8gYC0tbm8tcm9sbGJhY2tgLlxuICAgKlxuICAgKiBUaGUgcG9zc2libGUgYWN0aW9ucyBoZXJlIGFyZSByZXRyeWluZyBhIG5ldyBgLS1uby1yb2xsYmFja2AgZGVwbG95bWVudCwgb3IgaW5pdGlhdGluZyBhIHJvbGxiYWNrLlxuICAgKi9cbiAgZ2V0IHJvbGxiYWNrQ2hvaWNlKCk6IFJvbGxiYWNrQ2hvaWNlIHtcbiAgICBzd2l0Y2ggKHRoaXMubmFtZSkge1xuICAgICAgY2FzZSBfU3RhY2tTdGF0dXMuQ1JFQVRFX0ZBSUxFRDpcbiAgICAgIGNhc2UgX1N0YWNrU3RhdHVzLlVQREFURV9GQUlMRUQ6XG4gICAgICAgIHJldHVybiBSb2xsYmFja0Nob2ljZS5TVEFSVF9ST0xMQkFDSztcbiAgICAgIGNhc2UgX1N0YWNrU3RhdHVzLlVQREFURV9ST0xMQkFDS19GQUlMRUQ6XG4gICAgICAgIHJldHVybiBSb2xsYmFja0Nob2ljZS5DT05USU5VRV9VUERBVEVfUk9MTEJBQ0s7XG4gICAgICBjYXNlIF9TdGFja1N0YXR1cy5ST0xMQkFDS19GQUlMRUQ6XG4gICAgICAgIC8vIFVuZm9ydHVuYXRlbHkgdGhlcmUgaXMgbm8gb3B0aW9uIHRvIGNvbnRpbnVlIGEgZmFpbGVkIHJvbGxiYWNrIHdpdGhvdXRcbiAgICAgICAgLy8gYSBzdGFibGUgdGFyZ2V0IHN0YXRlLlxuICAgICAgICByZXR1cm4gUm9sbGJhY2tDaG9pY2UuUk9MTEJBQ0tfRkFJTEVEO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFJvbGxiYWNrQ2hvaWNlLk5PTkU7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGlzUm9sbGJhY2thYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBbUm9sbGJhY2tDaG9pY2UuU1RBUlRfUk9MTEJBQ0ssIFJvbGxiYWNrQ2hvaWNlLkNPTlRJTlVFX1VQREFURV9ST0xMQkFDS10uaW5jbHVkZXModGhpcy5yb2xsYmFja0Nob2ljZSk7XG4gIH1cblxuICBwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lICsgKHRoaXMucmVhc29uID8gYCAoJHt0aGlzLnJlYXNvbn0pYCA6ICcnKTtcbiAgfVxufVxuXG4vKipcbiAqIERlc2NyaWJlIHRoZSBjdXJyZW50IHJvbGxiYWNrIG9wdGlvbnMgZm9yIHRoaXMgc3RhdGVcbiAqL1xuZXhwb3J0IGVudW0gUm9sbGJhY2tDaG9pY2Uge1xuICBTVEFSVF9ST0xMQkFDSyxcbiAgQ09OVElOVUVfVVBEQVRFX1JPTExCQUNLLFxuICAvKipcbiAgICogQSBzaWduIHRoYXQgc3RhY2sgY3JlYXRpb24gQU5EIGl0cyByb2xsYmFjayBoYXZlIGZhaWxlZC5cbiAgICpcbiAgICogVGhlcmUgaXMgbm8gd2F5IHRvIHJlY292ZXIgZnJvbSB0aGlzLCBvdGhlciB0aGFuIHJlY3JlYXRpbmcgdGhlIHN0YWNrLlxuICAgKi9cbiAgUk9MTEJBQ0tfRkFJTEVELFxuICBOT05FLFxufVxuIl19