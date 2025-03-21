"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSnsTopicArn = validateSnsTopicArn;
/**
 * Validate SNS topic arn
 */
function validateSnsTopicArn(arn) {
    return /^arn:aws:sns:[a-z0-9\-]+:[0-9]+:[a-z0-9\-\_]+$/i.test(arn);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUtbm90aWZpY2F0aW9uLWFybi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZhbGlkYXRlLW5vdGlmaWNhdGlvbi1hcm4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxrREFFQztBQUxEOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsR0FBVztJQUM3QyxPQUFPLGlEQUFpRCxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBWYWxpZGF0ZSBTTlMgdG9waWMgYXJuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVNuc1RvcGljQXJuKGFybjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiAvXmFybjphd3M6c25zOlthLXowLTlcXC1dKzpbMC05XSs6W2EtejAtOVxcLVxcX10rJC9pLnRlc3QoYXJuKTtcbn1cbiJdfQ==