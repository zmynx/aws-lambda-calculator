"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const doctor_1 = require("../lib/commands/doctor");
// eslint-disable-next-line no-console
console.log = jest.fn();
describe('`cdk doctor`', () => {
    test('exits with 0 when everything is OK', async () => {
        const result = await (0, doctor_1.doctor)();
        expect(result).toBe(0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWRvY3Rvci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLWRvY3Rvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbURBQWdEO0FBRWhELHNDQUFzQztBQUN0QyxPQUFPLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztBQUV4QixRQUFRLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRTtJQUM1QixJQUFJLENBQUMsb0NBQW9DLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDcEQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGVBQU0sR0FBRSxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekIsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRvY3RvciB9IGZyb20gJy4uL2xpYi9jb21tYW5kcy9kb2N0b3InO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuY29uc29sZS5sb2cgPSBqZXN0LmZuKCk7XG5cbmRlc2NyaWJlKCdgY2RrIGRvY3RvcmAnLCAoKSA9PiB7XG4gIHRlc3QoJ2V4aXRzIHdpdGggMCB3aGVuIGV2ZXJ5dGhpbmcgaXMgT0snLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZG9jdG9yKCk7XG4gICAgZXhwZWN0KHJlc3VsdCkudG9CZSgwKTtcbiAgfSk7XG59KTtcbiJdfQ==