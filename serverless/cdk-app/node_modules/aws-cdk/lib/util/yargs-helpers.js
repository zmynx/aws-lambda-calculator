"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsNegativeAlias = yargsNegativeAlias;
exports.isCI = isCI;
exports.cliVersion = cliVersion;
exports.browserForPlatform = browserForPlatform;
const version = require("../../lib/version");
/**
 * yargs middleware to negate an option if a negative alias is provided
 * E.g. `-R` will imply `--rollback=false`
 *
 * @param optionToNegate The name of the option to negate, e.g. `rollback`
 * @param negativeAlias The alias that should negate the option, e.g. `R`
 * @returns a middleware function that can be passed to yargs
 */
function yargsNegativeAlias(negativeAlias, optionToNegate) {
    return (argv) => {
        // if R in argv && argv[R]
        // then argv[rollback] = false
        if (negativeAlias in argv && argv[negativeAlias]) {
            argv[optionToNegate] = false;
        }
        return argv;
    };
}
/**
 * Returns true if the current process is running in a CI environment
 * @returns true if the current process is running in a CI environment
 */
function isCI() {
    return process.env.CI !== undefined && process.env.CI !== 'false' && process.env.CI !== '0';
}
/**
 * Returns the current version of the CLI
 * @returns the current version of the CLI
 */
function cliVersion() {
    return version.DISPLAY_VERSION;
}
/**
 * Returns the default browser command for the current platform
 * @returns the default browser command for the current platform
 */
function browserForPlatform() {
    switch (process.platform) {
        case 'darwin':
            return 'open %u';
        case 'win32':
            return 'start %u';
        default:
            return 'xdg-open %u';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFyZ3MtaGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInlhcmdzLWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFVQSxnREFZQztBQU1ELG9CQUVDO0FBTUQsZ0NBRUM7QUFNRCxnREFTQztBQXJERCw2Q0FBNkM7QUFFN0M7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLGtCQUFrQixDQUNoQyxhQUFnQixFQUNoQixjQUFpQjtJQUVqQixPQUFPLENBQUMsSUFBTyxFQUFFLEVBQUU7UUFDakIsMEJBQTBCO1FBQzFCLDhCQUE4QjtRQUM5QixJQUFJLGFBQWEsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDaEQsSUFBWSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUN4QyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsSUFBSTtJQUNsQixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLFNBQVMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxPQUFPLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDO0FBQzlGLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixVQUFVO0lBQ3hCLE9BQU8sT0FBTyxDQUFDLGVBQWUsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0Isa0JBQWtCO0lBQ2hDLFFBQVEsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3pCLEtBQUssUUFBUTtZQUNYLE9BQU8sU0FBUyxDQUFDO1FBQ25CLEtBQUssT0FBTztZQUNWLE9BQU8sVUFBVSxDQUFDO1FBQ3BCO1lBQ0UsT0FBTyxhQUFhLENBQUM7SUFDekIsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyB2ZXJzaW9uIGZyb20gJy4uLy4uL2xpYi92ZXJzaW9uJztcblxuLyoqXG4gKiB5YXJncyBtaWRkbGV3YXJlIHRvIG5lZ2F0ZSBhbiBvcHRpb24gaWYgYSBuZWdhdGl2ZSBhbGlhcyBpcyBwcm92aWRlZFxuICogRS5nLiBgLVJgIHdpbGwgaW1wbHkgYC0tcm9sbGJhY2s9ZmFsc2VgXG4gKlxuICogQHBhcmFtIG9wdGlvblRvTmVnYXRlIFRoZSBuYW1lIG9mIHRoZSBvcHRpb24gdG8gbmVnYXRlLCBlLmcuIGByb2xsYmFja2BcbiAqIEBwYXJhbSBuZWdhdGl2ZUFsaWFzIFRoZSBhbGlhcyB0aGF0IHNob3VsZCBuZWdhdGUgdGhlIG9wdGlvbiwgZS5nLiBgUmBcbiAqIEByZXR1cm5zIGEgbWlkZGxld2FyZSBmdW5jdGlvbiB0aGF0IGNhbiBiZSBwYXNzZWQgdG8geWFyZ3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHlhcmdzTmVnYXRpdmVBbGlhczxUIGV4dGVuZHMgeyBbeCBpbiBTIHwgTF06IGJvb2xlYW4gfCB1bmRlZmluZWQgfSwgUyBleHRlbmRzIHN0cmluZywgTCBleHRlbmRzIHN0cmluZz4oXG4gIG5lZ2F0aXZlQWxpYXM6IFMsXG4gIG9wdGlvblRvTmVnYXRlOiBMLFxuKTogKGFyZ3Y6IFQpID0+IFQge1xuICByZXR1cm4gKGFyZ3Y6IFQpID0+IHtcbiAgICAvLyBpZiBSIGluIGFyZ3YgJiYgYXJndltSXVxuICAgIC8vIHRoZW4gYXJndltyb2xsYmFja10gPSBmYWxzZVxuICAgIGlmIChuZWdhdGl2ZUFsaWFzIGluIGFyZ3YgJiYgYXJndltuZWdhdGl2ZUFsaWFzXSkge1xuICAgICAgKGFyZ3YgYXMgYW55KVtvcHRpb25Ub05lZ2F0ZV0gPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIGFyZ3Y7XG4gIH07XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBjdXJyZW50IHByb2Nlc3MgaXMgcnVubmluZyBpbiBhIENJIGVudmlyb25tZW50XG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBjdXJyZW50IHByb2Nlc3MgaXMgcnVubmluZyBpbiBhIENJIGVudmlyb25tZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0NJKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gcHJvY2Vzcy5lbnYuQ0kgIT09IHVuZGVmaW5lZCAmJiBwcm9jZXNzLmVudi5DSSAhPT0gJ2ZhbHNlJyAmJiBwcm9jZXNzLmVudi5DSSAhPT0gJzAnO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgQ0xJXG4gKiBAcmV0dXJucyB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBDTElcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaVZlcnNpb24oKTogc3RyaW5nIHtcbiAgcmV0dXJuIHZlcnNpb24uRElTUExBWV9WRVJTSU9OO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGRlZmF1bHQgYnJvd3NlciBjb21tYW5kIGZvciB0aGUgY3VycmVudCBwbGF0Zm9ybVxuICogQHJldHVybnMgdGhlIGRlZmF1bHQgYnJvd3NlciBjb21tYW5kIGZvciB0aGUgY3VycmVudCBwbGF0Zm9ybVxuICovXG5leHBvcnQgZnVuY3Rpb24gYnJvd3NlckZvclBsYXRmb3JtKCk6IHN0cmluZyB7XG4gIHN3aXRjaCAocHJvY2Vzcy5wbGF0Zm9ybSkge1xuICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICByZXR1cm4gJ29wZW4gJXUnO1xuICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgIHJldHVybiAnc3RhcnQgJXUnO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ3hkZy1vcGVuICV1JztcbiAgfVxufVxuXG4iXX0=