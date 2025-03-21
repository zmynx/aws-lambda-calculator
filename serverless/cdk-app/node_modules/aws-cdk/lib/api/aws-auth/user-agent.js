"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCliUserAgent = defaultCliUserAgent;
const path = require("path");
const util_1 = require("./util");
const directories_1 = require("../../util/directories");
/**
 * Find the package.json from the main toolkit.
 *
 * If we can't read it for some reason, try to do something reasonable anyway.
 * Fall back to argv[1], or a standard string if that is undefined for some reason.
 */
function defaultCliUserAgent() {
    const root = (0, directories_1.rootDir)(false);
    const pkg = JSON.parse((root ? (0, util_1.readIfPossible)(path.join(root, 'package.json')) : undefined) ?? '{}');
    const name = pkg.name ?? path.basename(process.argv[1] ?? 'cdk-cli');
    const version = pkg.version ?? '<unknown>';
    return `${name}/${version}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlci1hZ2VudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInVzZXItYWdlbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxrREFNQztBQWhCRCw2QkFBNkI7QUFDN0IsaUNBQXdDO0FBQ3hDLHdEQUFpRDtBQUVqRDs7Ozs7R0FLRztBQUNILFNBQWdCLG1CQUFtQjtJQUNqQyxNQUFNLElBQUksR0FBRyxJQUFBLHFCQUFPLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBQSxxQkFBYyxFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDO0lBQ3JHLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDO0lBQ3JFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLElBQUksV0FBVyxDQUFDO0lBQzNDLE9BQU8sR0FBRyxJQUFJLElBQUksT0FBTyxFQUFFLENBQUM7QUFDOUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyByZWFkSWZQb3NzaWJsZSB9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgeyByb290RGlyIH0gZnJvbSAnLi4vLi4vdXRpbC9kaXJlY3Rvcmllcyc7XG5cbi8qKlxuICogRmluZCB0aGUgcGFja2FnZS5qc29uIGZyb20gdGhlIG1haW4gdG9vbGtpdC5cbiAqXG4gKiBJZiB3ZSBjYW4ndCByZWFkIGl0IGZvciBzb21lIHJlYXNvbiwgdHJ5IHRvIGRvIHNvbWV0aGluZyByZWFzb25hYmxlIGFueXdheS5cbiAqIEZhbGwgYmFjayB0byBhcmd2WzFdLCBvciBhIHN0YW5kYXJkIHN0cmluZyBpZiB0aGF0IGlzIHVuZGVmaW5lZCBmb3Igc29tZSByZWFzb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0Q2xpVXNlckFnZW50KCkge1xuICBjb25zdCByb290ID0gcm9vdERpcihmYWxzZSk7XG4gIGNvbnN0IHBrZyA9IEpTT04ucGFyc2UoKHJvb3QgPyByZWFkSWZQb3NzaWJsZShwYXRoLmpvaW4ocm9vdCwgJ3BhY2thZ2UuanNvbicpKSA6IHVuZGVmaW5lZCkgPz8gJ3t9Jyk7XG4gIGNvbnN0IG5hbWUgPSBwa2cubmFtZSA/PyBwYXRoLmJhc2VuYW1lKHByb2Nlc3MuYXJndlsxXSA/PyAnY2RrLWNsaScpO1xuICBjb25zdCB2ZXJzaW9uID0gcGtnLnZlcnNpb24gPz8gJzx1bmtub3duPic7XG4gIHJldHVybiBgJHtuYW1lfS8ke3ZlcnNpb259YDtcbn1cbiJdfQ==