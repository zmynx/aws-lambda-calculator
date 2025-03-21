"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdkHomeDir = cdkHomeDir;
exports.cdkCacheDir = cdkCacheDir;
exports.rootDir = rootDir;
const fs = require("fs");
const os = require("os");
const path = require("path");
/**
 * Return a location that will be used as the CDK home directory.
 * Currently the only thing that is placed here is the cache.
 *
 * First try to use the users home directory (i.e. /home/someuser/),
 * but if that directory does not exist for some reason create a tmp directory.
 *
 * Typically it wouldn't make sense to create a one time use tmp directory for
 * the purpose of creating a cache, but since this only applies to users that do
 * not have a home directory (some CI systems?) this should be fine.
 */
function cdkHomeDir() {
    const tmpDir = fs.realpathSync(os.tmpdir());
    let home;
    try {
        let userInfoHome = os.userInfo().homedir;
        // Node returns this if the user doesn't have a home directory
        /* istanbul ignore if: will not happen in normal setups */
        if (userInfoHome == '/var/empty') {
            userInfoHome = undefined;
        }
        home = path.join((userInfoHome ?? os.homedir()).trim(), '.cdk');
    }
    catch { }
    return process.env.CDK_HOME
        ? path.resolve(process.env.CDK_HOME)
        : home || fs.mkdtempSync(path.join(tmpDir, '.cdk')).trim();
}
function cdkCacheDir() {
    return path.join(cdkHomeDir(), 'cache');
}
function rootDir(fail) {
    function _rootDir(dirname) {
        const manifestPath = path.join(dirname, 'package.json');
        if (fs.existsSync(manifestPath)) {
            return dirname;
        }
        if (path.dirname(dirname) === dirname) {
            if (fail ?? true) {
                throw new Error('Unable to find package manifest');
            }
            return undefined;
        }
        return _rootDir(path.dirname(dirname));
    }
    return _rootDir(__dirname);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0b3JpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaXJlY3Rvcmllcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWVBLGdDQWVDO0FBRUQsa0NBRUM7QUFZRCwwQkFnQkM7QUE5REQseUJBQXlCO0FBQ3pCLHlCQUF5QjtBQUN6Qiw2QkFBNkI7QUFFN0I7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQWdCLFVBQVU7SUFDeEIsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUM1QyxJQUFJLElBQUksQ0FBQztJQUNULElBQUksQ0FBQztRQUNILElBQUksWUFBWSxHQUF1QixFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDO1FBQzdELDhEQUE4RDtRQUM5RCwwREFBMEQ7UUFDMUQsSUFBSSxZQUFZLElBQUksWUFBWSxFQUFFLENBQUM7WUFDakMsWUFBWSxHQUFHLFNBQVMsQ0FBQztRQUMzQixDQUFDO1FBQ0QsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUM7SUFDVixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUTtRQUN6QixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztRQUNwQyxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUMvRCxDQUFDO0FBRUQsU0FBZ0IsV0FBVztJQUN6QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDMUMsQ0FBQztBQVlELFNBQWdCLE9BQU8sQ0FBQyxJQUFjO0lBQ3BDLFNBQVMsUUFBUSxDQUFDLE9BQWU7UUFDL0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDeEQsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDaEMsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUN0QyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBQ3JELENBQUM7WUFDRCxPQUFPLFNBQVMsQ0FBQztRQUNuQixDQUFDO1FBQ0QsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUM3QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBSZXR1cm4gYSBsb2NhdGlvbiB0aGF0IHdpbGwgYmUgdXNlZCBhcyB0aGUgQ0RLIGhvbWUgZGlyZWN0b3J5LlxuICogQ3VycmVudGx5IHRoZSBvbmx5IHRoaW5nIHRoYXQgaXMgcGxhY2VkIGhlcmUgaXMgdGhlIGNhY2hlLlxuICpcbiAqIEZpcnN0IHRyeSB0byB1c2UgdGhlIHVzZXJzIGhvbWUgZGlyZWN0b3J5IChpLmUuIC9ob21lL3NvbWV1c2VyLyksXG4gKiBidXQgaWYgdGhhdCBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QgZm9yIHNvbWUgcmVhc29uIGNyZWF0ZSBhIHRtcCBkaXJlY3RvcnkuXG4gKlxuICogVHlwaWNhbGx5IGl0IHdvdWxkbid0IG1ha2Ugc2Vuc2UgdG8gY3JlYXRlIGEgb25lIHRpbWUgdXNlIHRtcCBkaXJlY3RvcnkgZm9yXG4gKiB0aGUgcHVycG9zZSBvZiBjcmVhdGluZyBhIGNhY2hlLCBidXQgc2luY2UgdGhpcyBvbmx5IGFwcGxpZXMgdG8gdXNlcnMgdGhhdCBkb1xuICogbm90IGhhdmUgYSBob21lIGRpcmVjdG9yeSAoc29tZSBDSSBzeXN0ZW1zPykgdGhpcyBzaG91bGQgYmUgZmluZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNka0hvbWVEaXIoKSB7XG4gIGNvbnN0IHRtcERpciA9IGZzLnJlYWxwYXRoU3luYyhvcy50bXBkaXIoKSk7XG4gIGxldCBob21lO1xuICB0cnkge1xuICAgIGxldCB1c2VySW5mb0hvbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IG9zLnVzZXJJbmZvKCkuaG9tZWRpcjtcbiAgICAvLyBOb2RlIHJldHVybnMgdGhpcyBpZiB0aGUgdXNlciBkb2Vzbid0IGhhdmUgYSBob21lIGRpcmVjdG9yeVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZjogd2lsbCBub3QgaGFwcGVuIGluIG5vcm1hbCBzZXR1cHMgKi9cbiAgICBpZiAodXNlckluZm9Ib21lID09ICcvdmFyL2VtcHR5Jykge1xuICAgICAgdXNlckluZm9Ib21lID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBob21lID0gcGF0aC5qb2luKCh1c2VySW5mb0hvbWUgPz8gb3MuaG9tZWRpcigpKS50cmltKCksICcuY2RrJyk7XG4gIH0gY2F0Y2gge31cbiAgcmV0dXJuIHByb2Nlc3MuZW52LkNES19IT01FXG4gICAgPyBwYXRoLnJlc29sdmUocHJvY2Vzcy5lbnYuQ0RLX0hPTUUpXG4gICAgOiBob21lIHx8IGZzLm1rZHRlbXBTeW5jKHBhdGguam9pbih0bXBEaXIsICcuY2RrJykpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNka0NhY2hlRGlyKCkge1xuICByZXR1cm4gcGF0aC5qb2luKGNka0hvbWVEaXIoKSwgJ2NhY2hlJyk7XG59XG5cbi8qKlxuICogRnJvbSB0aGUgY3VycmVudCBmaWxlLCBmaW5kIHRoZSBkaXJlY3RvcnkgdGhhdCBjb250YWlucyB0aGUgQ0xJJ3MgcGFja2FnZS5qc29uXG4gKlxuICogQ2FuJ3QgdXNlIGBfX2Rpcm5hbWVgIGluIHByb2R1Y3Rpb24gY29kZSwgYXMgdGhlIENMSSB3aWxsIGdldCBidW5kbGVkIGFzIGl0J3NcbiAqIHJlbGVhc2VkIGFuZCBgX19kaXJuYW1lYCB3aWxsIHJlZmVyIHRvIGEgZGlmZmVyZW50IGxvY2F0aW9uIGluIHRoZSBgLnRzYCBmb3JtXG4gKiBhcyBpdCB3aWxsIGluIHRoZSBmaW5hbCBleGVjdXRpbmcgZm9ybS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJvb3REaXIoKTogc3RyaW5nO1xuZXhwb3J0IGZ1bmN0aW9uIHJvb3REaXIoZmFpbDogdHJ1ZSk6IHN0cmluZztcbmV4cG9ydCBmdW5jdGlvbiByb290RGlyKGZhaWw6IGZhbHNlKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuZXhwb3J0IGZ1bmN0aW9uIHJvb3REaXIoZmFpbD86IGJvb2xlYW4pIHtcbiAgZnVuY3Rpb24gX3Jvb3REaXIoZGlybmFtZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBtYW5pZmVzdFBhdGggPSBwYXRoLmpvaW4oZGlybmFtZSwgJ3BhY2thZ2UuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKG1hbmlmZXN0UGF0aCkpIHtcbiAgICAgIHJldHVybiBkaXJuYW1lO1xuICAgIH1cbiAgICBpZiAocGF0aC5kaXJuYW1lKGRpcm5hbWUpID09PSBkaXJuYW1lKSB7XG4gICAgICBpZiAoZmFpbCA/PyB0cnVlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpbmQgcGFja2FnZSBtYW5pZmVzdCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIF9yb290RGlyKHBhdGguZGlybmFtZShkaXJuYW1lKSk7XG4gIH1cblxuICByZXR1cm4gX3Jvb3REaXIoX19kaXJuYW1lKTtcbn1cbiJdfQ==