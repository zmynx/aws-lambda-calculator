"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_helpers_1 = require("../../lib/util/yargs-helpers");
test.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    // The following ones are unexpected but this is the legacy behavior we're preserving.
    ['banana', true],
    ['', true],
])('test parsing of falsey CI values: %p parses as %p', (envvar, ci) => {
    process.env.CI = envvar;
    expect((0, yargs_helpers_1.isCI)()).toEqual(ci);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFyZ3MtaGVscGVycy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsieWFyZ3MtaGVscGVycy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsZ0VBQW9EO0FBRXBELElBQUksQ0FBQyxJQUFJLENBQUM7SUFDUixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7SUFDZCxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7SUFDWCxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7SUFDaEIsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDO0lBQ1osc0ZBQXNGO0lBQ3RGLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztJQUNoQixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUM7Q0FDWCxDQUFDLENBQUMsbURBQW1ELEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDckUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBQ3hCLE1BQU0sQ0FBQyxJQUFBLG9CQUFJLEdBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQ0kgfSBmcm9tICcuLi8uLi9saWIvdXRpbC95YXJncy1oZWxwZXJzJztcblxudGVzdC5lYWNoKFtcbiAgWyd0cnVlJywgdHJ1ZV0sXG4gIFsnMScsIHRydWVdLFxuICBbJ2ZhbHNlJywgZmFsc2VdLFxuICBbJzAnLCBmYWxzZV0sXG4gIC8vIFRoZSBmb2xsb3dpbmcgb25lcyBhcmUgdW5leHBlY3RlZCBidXQgdGhpcyBpcyB0aGUgbGVnYWN5IGJlaGF2aW9yIHdlJ3JlIHByZXNlcnZpbmcuXG4gIFsnYmFuYW5hJywgdHJ1ZV0sXG4gIFsnJywgdHJ1ZV0sXG5dKSgndGVzdCBwYXJzaW5nIG9mIGZhbHNleSBDSSB2YWx1ZXM6ICVwIHBhcnNlcyBhcyAlcCcsIChlbnZ2YXIsIGNpKSA9PiB7XG4gIHByb2Nlc3MuZW52LkNJID0gZW52dmFyO1xuICBleHBlY3QoaXNDSSgpKS50b0VxdWFsKGNpKTtcbn0pO1xuIl19