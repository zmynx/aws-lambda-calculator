"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const types_1 = require("util/types");
/**
 * Global test setup for Jest tests
 *
 * It's easy to accidentally write tests that interfere with each other by
 * writing files to disk in the "current directory". To prevent this, the global
 * test setup creates a directory in the temporary directory and chmods it to
 * being non-writable. That way, whenever a test tries to write to the current
 * directory, it will produce an error and we'll be able to find and fix the
 * test.
 *
 * If you see `EACCES: permission denied`, you have a test that creates files
 * in the current directory, and you should be sure to do it in a temporary
 * directory that you clean up afterwards.
 *
 * ## Alternate approach
 *
 * I tried an approach where I would automatically try to create and clean up
 * temp directories for every test, but it was introducing too many conflicts
 * with existing test behavior (around specific ordering of temp directory
 * creation and cleanup tasks that are already present) in many places that I
 * didn't want to go and chase down.
 *
 */
let tmpDir;
let oldDir;
beforeAll(() => {
    tmpDir = path.join(os.tmpdir(), 'cdk-nonwritable-on-purpose');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.chmodSync(tmpDir, 0o500);
    oldDir = process.cwd();
    process.chdir(tmpDir);
    tmpDir = process.cwd(); // This will have resolved symlinks
});
const reverseAfterAll = [];
/**
 * We need a cleanup here
 *
 * 99% of the time, Jest runs the tests in a subprocess and this isn't
 * necessary because we would have `chdir`ed in the subprocess.
 *
 * But sometimes we ask Jest with `-i` to run the tests in the main process,
 * or if you only ask for a single test suite Jest runs the tests in the main
 * process, and then we `chdir`ed the main process away.
 *
 * Jest will then try to write the `coverage` directory to the readonly directory,
 * and fail. Chdir back to the original dir.
 *
 * If the test file has an `afterAll()` hook it installed as well, we need to run
 * it before our cleanup, otherwise the wrong thing will happen (by default,
 * all `afterAll()`s run in call order, but they should be run in reverse).
 */
afterAll(async () => {
    for (const aft of reverseAfterAll.reverse()) {
        await new Promise((resolve, reject) => {
            const response = aft(resolve);
            if ((0, types_1.isPromise)(response)) {
                response.then(() => { return resolve(); }, reject);
            }
            else {
                resolve();
            }
        });
    }
    if (process.cwd() === tmpDir) {
        process.chdir(oldDir);
    }
});
// Patch afterAll to make later-provided afterAll's run before us (in reverse order even).
afterAll = (after) => {
    reverseAfterAll.push(after);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVzdC1zZXR1cC1hZnRlci1lbnYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJqZXN0LXNldHVwLWFmdGVyLWVudi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHlCQUF5QjtBQUN6Qix5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLHNDQUF1QztBQUV2Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNCRztBQUVILElBQUksTUFBYyxDQUFDO0FBQ25CLElBQUksTUFBYyxDQUFDO0FBRW5CLFNBQVMsQ0FBQyxHQUFHLEVBQUU7SUFDYixNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztJQUM5RCxFQUFFLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDdkIsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QixNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsbUNBQW1DO0FBQzdELENBQUMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxlQUFlLEdBQXFDLEVBQUUsQ0FBQztBQUU3RDs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILFFBQVEsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUNsQixLQUFLLE1BQU0sR0FBRyxJQUFJLGVBQWUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBQzVDLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDMUMsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQWMsQ0FBQyxDQUFDO1lBQ3JDLElBQUksSUFBQSxpQkFBUyxFQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hCLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsT0FBTyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNyRCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sT0FBTyxFQUFFLENBQUM7WUFDWixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssTUFBTSxFQUFFLENBQUM7UUFDN0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4QixDQUFDO0FBQ0gsQ0FBQyxDQUFDLENBQUM7QUFFSCwwRkFBMEY7QUFDMUYsUUFBUSxHQUFHLENBQUMsS0FBZ0MsRUFBRSxFQUFFO0lBQzlDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGlzUHJvbWlzZSB9IGZyb20gJ3V0aWwvdHlwZXMnO1xuXG4vKipcbiAqIEdsb2JhbCB0ZXN0IHNldHVwIGZvciBKZXN0IHRlc3RzXG4gKlxuICogSXQncyBlYXN5IHRvIGFjY2lkZW50YWxseSB3cml0ZSB0ZXN0cyB0aGF0IGludGVyZmVyZSB3aXRoIGVhY2ggb3RoZXIgYnlcbiAqIHdyaXRpbmcgZmlsZXMgdG8gZGlzayBpbiB0aGUgXCJjdXJyZW50IGRpcmVjdG9yeVwiLiBUbyBwcmV2ZW50IHRoaXMsIHRoZSBnbG9iYWxcbiAqIHRlc3Qgc2V0dXAgY3JlYXRlcyBhIGRpcmVjdG9yeSBpbiB0aGUgdGVtcG9yYXJ5IGRpcmVjdG9yeSBhbmQgY2htb2RzIGl0IHRvXG4gKiBiZWluZyBub24td3JpdGFibGUuIFRoYXQgd2F5LCB3aGVuZXZlciBhIHRlc3QgdHJpZXMgdG8gd3JpdGUgdG8gdGhlIGN1cnJlbnRcbiAqIGRpcmVjdG9yeSwgaXQgd2lsbCBwcm9kdWNlIGFuIGVycm9yIGFuZCB3ZSdsbCBiZSBhYmxlIHRvIGZpbmQgYW5kIGZpeCB0aGVcbiAqIHRlc3QuXG4gKlxuICogSWYgeW91IHNlZSBgRUFDQ0VTOiBwZXJtaXNzaW9uIGRlbmllZGAsIHlvdSBoYXZlIGEgdGVzdCB0aGF0IGNyZWF0ZXMgZmlsZXNcbiAqIGluIHRoZSBjdXJyZW50IGRpcmVjdG9yeSwgYW5kIHlvdSBzaG91bGQgYmUgc3VyZSB0byBkbyBpdCBpbiBhIHRlbXBvcmFyeVxuICogZGlyZWN0b3J5IHRoYXQgeW91IGNsZWFuIHVwIGFmdGVyd2FyZHMuXG4gKlxuICogIyMgQWx0ZXJuYXRlIGFwcHJvYWNoXG4gKlxuICogSSB0cmllZCBhbiBhcHByb2FjaCB3aGVyZSBJIHdvdWxkIGF1dG9tYXRpY2FsbHkgdHJ5IHRvIGNyZWF0ZSBhbmQgY2xlYW4gdXBcbiAqIHRlbXAgZGlyZWN0b3JpZXMgZm9yIGV2ZXJ5IHRlc3QsIGJ1dCBpdCB3YXMgaW50cm9kdWNpbmcgdG9vIG1hbnkgY29uZmxpY3RzXG4gKiB3aXRoIGV4aXN0aW5nIHRlc3QgYmVoYXZpb3IgKGFyb3VuZCBzcGVjaWZpYyBvcmRlcmluZyBvZiB0ZW1wIGRpcmVjdG9yeVxuICogY3JlYXRpb24gYW5kIGNsZWFudXAgdGFza3MgdGhhdCBhcmUgYWxyZWFkeSBwcmVzZW50KSBpbiBtYW55IHBsYWNlcyB0aGF0IElcbiAqIGRpZG4ndCB3YW50IHRvIGdvIGFuZCBjaGFzZSBkb3duLlxuICpcbiAqL1xuXG5sZXQgdG1wRGlyOiBzdHJpbmc7XG5sZXQgb2xkRGlyOiBzdHJpbmc7XG5cbmJlZm9yZUFsbCgoKSA9PiB7XG4gIHRtcERpciA9IHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2Nkay1ub253cml0YWJsZS1vbi1wdXJwb3NlJyk7XG4gIGZzLm1rZGlyU3luYyh0bXBEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBmcy5jaG1vZFN5bmModG1wRGlyLCAwbzUwMCk7XG4gIG9sZERpciA9IHByb2Nlc3MuY3dkKCk7XG4gIHByb2Nlc3MuY2hkaXIodG1wRGlyKTtcbiAgdG1wRGlyID0gcHJvY2Vzcy5jd2QoKTsgLy8gVGhpcyB3aWxsIGhhdmUgcmVzb2x2ZWQgc3ltbGlua3Ncbn0pO1xuXG5jb25zdCByZXZlcnNlQWZ0ZXJBbGw6IEFycmF5PGplc3QuUHJvdmlkZXNIb29rQ2FsbGJhY2s+ID0gW107XG5cbi8qKlxuICogV2UgbmVlZCBhIGNsZWFudXAgaGVyZVxuICpcbiAqIDk5JSBvZiB0aGUgdGltZSwgSmVzdCBydW5zIHRoZSB0ZXN0cyBpbiBhIHN1YnByb2Nlc3MgYW5kIHRoaXMgaXNuJ3RcbiAqIG5lY2Vzc2FyeSBiZWNhdXNlIHdlIHdvdWxkIGhhdmUgYGNoZGlyYGVkIGluIHRoZSBzdWJwcm9jZXNzLlxuICpcbiAqIEJ1dCBzb21ldGltZXMgd2UgYXNrIEplc3Qgd2l0aCBgLWlgIHRvIHJ1biB0aGUgdGVzdHMgaW4gdGhlIG1haW4gcHJvY2VzcyxcbiAqIG9yIGlmIHlvdSBvbmx5IGFzayBmb3IgYSBzaW5nbGUgdGVzdCBzdWl0ZSBKZXN0IHJ1bnMgdGhlIHRlc3RzIGluIHRoZSBtYWluXG4gKiBwcm9jZXNzLCBhbmQgdGhlbiB3ZSBgY2hkaXJgZWQgdGhlIG1haW4gcHJvY2VzcyBhd2F5LlxuICpcbiAqIEplc3Qgd2lsbCB0aGVuIHRyeSB0byB3cml0ZSB0aGUgYGNvdmVyYWdlYCBkaXJlY3RvcnkgdG8gdGhlIHJlYWRvbmx5IGRpcmVjdG9yeSxcbiAqIGFuZCBmYWlsLiBDaGRpciBiYWNrIHRvIHRoZSBvcmlnaW5hbCBkaXIuXG4gKlxuICogSWYgdGhlIHRlc3QgZmlsZSBoYXMgYW4gYGFmdGVyQWxsKClgIGhvb2sgaXQgaW5zdGFsbGVkIGFzIHdlbGwsIHdlIG5lZWQgdG8gcnVuXG4gKiBpdCBiZWZvcmUgb3VyIGNsZWFudXAsIG90aGVyd2lzZSB0aGUgd3JvbmcgdGhpbmcgd2lsbCBoYXBwZW4gKGJ5IGRlZmF1bHQsXG4gKiBhbGwgYGFmdGVyQWxsKClgcyBydW4gaW4gY2FsbCBvcmRlciwgYnV0IHRoZXkgc2hvdWxkIGJlIHJ1biBpbiByZXZlcnNlKS5cbiAqL1xuYWZ0ZXJBbGwoYXN5bmMgKCkgPT4ge1xuICBmb3IgKGNvbnN0IGFmdCBvZiByZXZlcnNlQWZ0ZXJBbGwucmV2ZXJzZSgpKSB7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhZnQocmVzb2x2ZSBhcyBhbnkpO1xuICAgICAgaWYgKGlzUHJvbWlzZShyZXNwb25zZSkpIHtcbiAgICAgICAgcmVzcG9uc2UudGhlbigoKSA9PiB7IHJldHVybiByZXNvbHZlKCk7IH0sIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAocHJvY2Vzcy5jd2QoKSA9PT0gdG1wRGlyKSB7XG4gICAgcHJvY2Vzcy5jaGRpcihvbGREaXIpO1xuICB9XG59KTtcblxuLy8gUGF0Y2ggYWZ0ZXJBbGwgdG8gbWFrZSBsYXRlci1wcm92aWRlZCBhZnRlckFsbCdzIHJ1biBiZWZvcmUgdXMgKGluIHJldmVyc2Ugb3JkZXIgZXZlbikuXG5hZnRlckFsbCA9IChhZnRlcjogamVzdC5Qcm92aWRlc0hvb2tDYWxsYmFjaykgPT4ge1xuICByZXZlcnNlQWZ0ZXJBbGwucHVzaChhZnRlcik7XG59O1xuIl19