"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockSpawn = mockSpawn;
/* eslint-disable import/order */
const child_process = require("child_process");
const events = require("events");
if (!child_process.spawn.mockImplementationOnce) {
    throw new Error('Call "jest.mock(\'child_process\');" at the top of the test file!');
}
function mockSpawn(...invocations) {
    let mock = child_process.spawn;
    for (const _invocation of invocations) {
        const invocation = _invocation; // Mirror into variable for closure
        mock = mock.mockImplementationOnce((binary, options) => {
            expect(binary).toEqual(invocation.commandLine);
            if (invocation.cwd != null) {
                expect(options.cwd).toBe(invocation.cwd);
            }
            if (invocation.sideEffect) {
                invocation.sideEffect();
            }
            const child = new events.EventEmitter();
            child.stdin = new events.EventEmitter();
            child.stdin.write = jest.fn();
            child.stdin.end = jest.fn();
            child.stdout = new events.EventEmitter();
            child.stderr = new events.EventEmitter();
            if (invocation.stdout) {
                mockEmit(child.stdout, 'data', invocation.stdout);
            }
            mockEmit(child, 'close', invocation.exitCode ?? 0);
            mockEmit(child, 'exit', invocation.exitCode ?? 0);
            return child;
        });
    }
    mock.mockImplementation((binary, _options) => {
        throw new Error(`Did not expect call of ${binary}`);
    });
}
/**
 * Must do this on the next tick, as emitter.emit() expects all listeners to have been attached already
 */
function mockEmit(emitter, event, data) {
    setImmediate(() => {
        emitter.emit(event, data);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay1jaGlsZF9wcm9jZXNzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9jay1jaGlsZF9wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBb0JBLDhCQW1DQztBQXZERCxpQ0FBaUM7QUFDakMsK0NBQStDO0FBQy9DLGlDQUFpQztBQUVqQyxJQUFJLENBQUUsYUFBcUIsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztJQUN6RCxNQUFNLElBQUksS0FBSyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7QUFDdkYsQ0FBQztBQWNELFNBQWdCLFNBQVMsQ0FBQyxHQUFHLFdBQXlCO0lBQ3BELElBQUksSUFBSSxHQUFJLGFBQWEsQ0FBQyxLQUFhLENBQUM7SUFDeEMsS0FBSyxNQUFNLFdBQVcsSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUN0QyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsQ0FBQyxtQ0FBbUM7UUFDbkUsSUFBSSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLE1BQWMsRUFBRSxPQUFtQyxFQUFFLEVBQUU7WUFDekYsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7WUFFL0MsSUFBSSxVQUFVLENBQUMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUMzQixNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDM0MsQ0FBQztZQUVELElBQUksVUFBVSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUMxQixVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDMUIsQ0FBQztZQUVELE1BQU0sS0FBSyxHQUFRLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzdDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDeEMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM1QixLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3pDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7WUFFekMsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEQsQ0FBQztZQUNELFFBQVEsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbkQsUUFBUSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUVsRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQWMsRUFBRSxRQUFhLEVBQUUsRUFBRTtRQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxRQUFRLENBQUMsT0FBNEIsRUFBRSxLQUFhLEVBQUUsSUFBUztJQUN0RSxZQUFZLENBQUMsR0FBRyxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzVCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlIGltcG9ydC9vcmRlciAqL1xuaW1wb3J0ICogYXMgY2hpbGRfcHJvY2VzcyBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdldmVudHMnO1xuXG5pZiAoIShjaGlsZF9wcm9jZXNzIGFzIGFueSkuc3Bhd24ubW9ja0ltcGxlbWVudGF0aW9uT25jZSkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGwgXCJqZXN0Lm1vY2soXFwnY2hpbGRfcHJvY2Vzc1xcJyk7XCIgYXQgdGhlIHRvcCBvZiB0aGUgdGVzdCBmaWxlIScpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEludm9jYXRpb24ge1xuICBjb21tYW5kTGluZTogc3RyaW5nO1xuICBjd2Q/OiBzdHJpbmc7XG4gIGV4aXRDb2RlPzogbnVtYmVyO1xuICBzdGRvdXQ/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFJ1biB0aGlzIGZ1bmN0aW9uIGFzIGEgc2lkZSBlZmZlY3QsIGlmIHByZXNlbnRcbiAgICovXG4gIHNpZGVFZmZlY3Q/OiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9ja1NwYXduKC4uLmludm9jYXRpb25zOiBJbnZvY2F0aW9uW10pIHtcbiAgbGV0IG1vY2sgPSAoY2hpbGRfcHJvY2Vzcy5zcGF3biBhcyBhbnkpO1xuICBmb3IgKGNvbnN0IF9pbnZvY2F0aW9uIG9mIGludm9jYXRpb25zKSB7XG4gICAgY29uc3QgaW52b2NhdGlvbiA9IF9pbnZvY2F0aW9uOyAvLyBNaXJyb3IgaW50byB2YXJpYWJsZSBmb3IgY2xvc3VyZVxuICAgIG1vY2sgPSBtb2NrLm1vY2tJbXBsZW1lbnRhdGlvbk9uY2UoKGJpbmFyeTogc3RyaW5nLCBvcHRpb25zOiBjaGlsZF9wcm9jZXNzLlNwYXduT3B0aW9ucykgPT4ge1xuICAgICAgZXhwZWN0KGJpbmFyeSkudG9FcXVhbChpbnZvY2F0aW9uLmNvbW1hbmRMaW5lKTtcblxuICAgICAgaWYgKGludm9jYXRpb24uY3dkICE9IG51bGwpIHtcbiAgICAgICAgZXhwZWN0KG9wdGlvbnMuY3dkKS50b0JlKGludm9jYXRpb24uY3dkKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGludm9jYXRpb24uc2lkZUVmZmVjdCkge1xuICAgICAgICBpbnZvY2F0aW9uLnNpZGVFZmZlY3QoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY2hpbGQ6IGFueSA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG4gICAgICBjaGlsZC5zdGRpbiA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG4gICAgICBjaGlsZC5zdGRpbi53cml0ZSA9IGplc3QuZm4oKTtcbiAgICAgIGNoaWxkLnN0ZGluLmVuZCA9IGplc3QuZm4oKTtcbiAgICAgIGNoaWxkLnN0ZG91dCA9IG5ldyBldmVudHMuRXZlbnRFbWl0dGVyKCk7XG4gICAgICBjaGlsZC5zdGRlcnIgPSBuZXcgZXZlbnRzLkV2ZW50RW1pdHRlcigpO1xuXG4gICAgICBpZiAoaW52b2NhdGlvbi5zdGRvdXQpIHtcbiAgICAgICAgbW9ja0VtaXQoY2hpbGQuc3Rkb3V0LCAnZGF0YScsIGludm9jYXRpb24uc3Rkb3V0KTtcbiAgICAgIH1cbiAgICAgIG1vY2tFbWl0KGNoaWxkLCAnY2xvc2UnLCBpbnZvY2F0aW9uLmV4aXRDb2RlID8/IDApO1xuICAgICAgbW9ja0VtaXQoY2hpbGQsICdleGl0JywgaW52b2NhdGlvbi5leGl0Q29kZSA/PyAwKTtcblxuICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH0pO1xuICB9XG5cbiAgbW9jay5tb2NrSW1wbGVtZW50YXRpb24oKGJpbmFyeTogc3RyaW5nLCBfb3B0aW9uczogYW55KSA9PiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBEaWQgbm90IGV4cGVjdCBjYWxsIG9mICR7YmluYXJ5fWApO1xuICB9KTtcbn1cblxuLyoqXG4gKiBNdXN0IGRvIHRoaXMgb24gdGhlIG5leHQgdGljaywgYXMgZW1pdHRlci5lbWl0KCkgZXhwZWN0cyBhbGwgbGlzdGVuZXJzIHRvIGhhdmUgYmVlbiBhdHRhY2hlZCBhbHJlYWR5XG4gKi9cbmZ1bmN0aW9uIG1vY2tFbWl0KGVtaXR0ZXI6IGV2ZW50cy5FdmVudEVtaXR0ZXIsIGV2ZW50OiBzdHJpbmcsIGRhdGE6IGFueSkge1xuICBzZXRJbW1lZGlhdGUoKCkgPT4ge1xuICAgIGVtaXR0ZXIuZW1pdChldmVudCwgZGF0YSk7XG4gIH0pO1xufVxuIl19