"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkToCliLogger = void 0;
exports.formatSdkLoggerContent = formatSdkLoggerContent;
const util_1 = require("util");
const logging_1 = require("../../logging");
class SdkToCliLogger {
    trace(..._content) {
        // This is too much detail for our logs
        // trace('[SDK trace] %s', fmtContent(content));
    }
    debug(..._content) {
        // This is too much detail for our logs
        // trace('[SDK debug] %s', fmtContent(content));
    }
    /**
     * Info is called mostly (exclusively?) for successful API calls
     *
     * Payload:
     *
     * (Note the input contains entire CFN templates, for example)
     *
     * ```
     * {
     *   clientName: 'S3Client',
     *   commandName: 'GetBucketLocationCommand',
     *   input: {
     *     Bucket: '.....',
     *     ExpectedBucketOwner: undefined
     *   },
     *   output: { LocationConstraint: 'eu-central-1' },
     *   metadata: {
     *     httpStatusCode: 200,
     *     requestId: '....',
     *     extendedRequestId: '...',
     *     cfId: undefined,
     *     attempts: 1,
     *     totalRetryDelay: 0
     *   }
     * }
     * ```
     */
    info(...content) {
        (0, logging_1.trace)('[sdk info] %s', formatSdkLoggerContent(content));
    }
    warn(...content) {
        (0, logging_1.trace)('[sdk warn] %s', formatSdkLoggerContent(content));
    }
    /**
     * Error is called mostly (exclusively?) for failing API calls
     *
     * Payload (input would be the entire API call arguments).
     *
     * ```
     * {
     *   clientName: 'STSClient',
     *   commandName: 'GetCallerIdentityCommand',
     *   input: {},
     *   error: AggregateError [ECONNREFUSED]:
     *       at internalConnectMultiple (node:net:1121:18)
     *       at afterConnectMultiple (node:net:1688:7) {
     *     code: 'ECONNREFUSED',
     *     '$metadata': { attempts: 3, totalRetryDelay: 600 },
     *     [errors]: [ [Error], [Error] ]
     *   },
     *   metadata: { attempts: 3, totalRetryDelay: 600 }
     * }
     * ```
     */
    error(...content) {
        (0, logging_1.trace)('[sdk error] %s', formatSdkLoggerContent(content));
    }
}
exports.SdkToCliLogger = SdkToCliLogger;
/**
 * This can be anything.
 *
 * For debug, it seems to be mostly strings.
 * For info, it seems to be objects.
 *
 * Stringify and join without separator.
 */
function formatSdkLoggerContent(content) {
    if (content.length === 1) {
        const apiFmt = formatApiCall(content[0]);
        if (apiFmt) {
            return apiFmt;
        }
    }
    return content.map((x) => typeof x === 'string' ? x : (0, util_1.inspect)(x)).join('');
}
function formatApiCall(content) {
    if (!isSdkApiCallSuccess(content) && !isSdkApiCallError(content)) {
        return undefined;
    }
    const service = content.clientName.replace(/Client$/, '');
    const api = content.commandName.replace(/Command$/, '');
    const parts = [];
    if ((content.metadata?.attempts ?? 0) > 1) {
        parts.push(`[${content.metadata?.attempts} attempts, ${content.metadata?.totalRetryDelay}ms retry]`);
    }
    parts.push(`${service}.${api}(${JSON.stringify(content.input)})`);
    if (isSdkApiCallSuccess(content)) {
        parts.push('-> OK');
    }
    else {
        parts.push(`-> ${content.error}`);
    }
    return parts.join(' ');
}
function isSdkApiCallSuccess(x) {
    return x && typeof x === 'object' && x.commandName && x.output;
}
function isSdkApiCallError(x) {
    return x && typeof x === 'object' && x.commandName && x.error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLWxvZ2dlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNkay1sb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBb0ZBLHdEQVFDO0FBNUZELCtCQUErQjtBQUUvQiwyQ0FBc0M7QUFFdEMsTUFBYSxjQUFjO0lBQ2xCLEtBQUssQ0FBQyxHQUFHLFFBQWU7UUFDN0IsdUNBQXVDO1FBQ3ZDLGdEQUFnRDtJQUNsRCxDQUFDO0lBRU0sS0FBSyxDQUFDLEdBQUcsUUFBZTtRQUM3Qix1Q0FBdUM7UUFDdkMsZ0RBQWdEO0lBQ2xELENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0EwQkc7SUFDSSxJQUFJLENBQUMsR0FBRyxPQUFjO1FBQzNCLElBQUEsZUFBSyxFQUFDLGVBQWUsRUFBRSxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFTSxJQUFJLENBQUMsR0FBRyxPQUFjO1FBQzNCLElBQUEsZUFBSyxFQUFDLGVBQWUsRUFBRSxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FvQkc7SUFDSSxLQUFLLENBQUMsR0FBRyxPQUFjO1FBQzVCLElBQUEsZUFBSyxFQUFDLGdCQUFnQixFQUFFLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBdEVELHdDQXNFQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxPQUFjO0lBQ25ELElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN6QixNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNYLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBQSxjQUFPLEVBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDN0UsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLE9BQVk7SUFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNqRSxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzFELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUV4RCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLFFBQVEsY0FBYyxPQUFPLENBQUMsUUFBUSxFQUFFLGVBQWUsV0FBVyxDQUFDLENBQUM7SUFDdkcsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUVsRSxJQUFJLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDakMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0QixDQUFDO1NBQU0sQ0FBQztRQUNOLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFtQkQsU0FBUyxtQkFBbUIsQ0FBQyxDQUFNO0lBQ2pDLE9BQU8sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDakUsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsQ0FBTTtJQUMvQixPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ2hFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpbnNwZWN0IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICdAc21pdGh5L3R5cGVzJztcbmltcG9ydCB7IHRyYWNlIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5cbmV4cG9ydCBjbGFzcyBTZGtUb0NsaUxvZ2dlciBpbXBsZW1lbnRzIExvZ2dlciB7XG4gIHB1YmxpYyB0cmFjZSguLi5fY29udGVudDogYW55W10pIHtcbiAgICAvLyBUaGlzIGlzIHRvbyBtdWNoIGRldGFpbCBmb3Igb3VyIGxvZ3NcbiAgICAvLyB0cmFjZSgnW1NESyB0cmFjZV0gJXMnLCBmbXRDb250ZW50KGNvbnRlbnQpKTtcbiAgfVxuXG4gIHB1YmxpYyBkZWJ1ZyguLi5fY29udGVudDogYW55W10pIHtcbiAgICAvLyBUaGlzIGlzIHRvbyBtdWNoIGRldGFpbCBmb3Igb3VyIGxvZ3NcbiAgICAvLyB0cmFjZSgnW1NESyBkZWJ1Z10gJXMnLCBmbXRDb250ZW50KGNvbnRlbnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmZvIGlzIGNhbGxlZCBtb3N0bHkgKGV4Y2x1c2l2ZWx5PykgZm9yIHN1Y2Nlc3NmdWwgQVBJIGNhbGxzXG4gICAqXG4gICAqIFBheWxvYWQ6XG4gICAqXG4gICAqIChOb3RlIHRoZSBpbnB1dCBjb250YWlucyBlbnRpcmUgQ0ZOIHRlbXBsYXRlcywgZm9yIGV4YW1wbGUpXG4gICAqXG4gICAqIGBgYFxuICAgKiB7XG4gICAqICAgY2xpZW50TmFtZTogJ1MzQ2xpZW50JyxcbiAgICogICBjb21tYW5kTmFtZTogJ0dldEJ1Y2tldExvY2F0aW9uQ29tbWFuZCcsXG4gICAqICAgaW5wdXQ6IHtcbiAgICogICAgIEJ1Y2tldDogJy4uLi4uJyxcbiAgICogICAgIEV4cGVjdGVkQnVja2V0T3duZXI6IHVuZGVmaW5lZFxuICAgKiAgIH0sXG4gICAqICAgb3V0cHV0OiB7IExvY2F0aW9uQ29uc3RyYWludDogJ2V1LWNlbnRyYWwtMScgfSxcbiAgICogICBtZXRhZGF0YToge1xuICAgKiAgICAgaHR0cFN0YXR1c0NvZGU6IDIwMCxcbiAgICogICAgIHJlcXVlc3RJZDogJy4uLi4nLFxuICAgKiAgICAgZXh0ZW5kZWRSZXF1ZXN0SWQ6ICcuLi4nLFxuICAgKiAgICAgY2ZJZDogdW5kZWZpbmVkLFxuICAgKiAgICAgYXR0ZW1wdHM6IDEsXG4gICAqICAgICB0b3RhbFJldHJ5RGVsYXk6IDBcbiAgICogICB9XG4gICAqIH1cbiAgICogYGBgXG4gICAqL1xuICBwdWJsaWMgaW5mbyguLi5jb250ZW50OiBhbnlbXSkge1xuICAgIHRyYWNlKCdbc2RrIGluZm9dICVzJywgZm9ybWF0U2RrTG9nZ2VyQ29udGVudChjb250ZW50KSk7XG4gIH1cblxuICBwdWJsaWMgd2FybiguLi5jb250ZW50OiBhbnlbXSkge1xuICAgIHRyYWNlKCdbc2RrIHdhcm5dICVzJywgZm9ybWF0U2RrTG9nZ2VyQ29udGVudChjb250ZW50KSk7XG4gIH1cblxuICAvKipcbiAgICogRXJyb3IgaXMgY2FsbGVkIG1vc3RseSAoZXhjbHVzaXZlbHk/KSBmb3IgZmFpbGluZyBBUEkgY2FsbHNcbiAgICpcbiAgICogUGF5bG9hZCAoaW5wdXQgd291bGQgYmUgdGhlIGVudGlyZSBBUEkgY2FsbCBhcmd1bWVudHMpLlxuICAgKlxuICAgKiBgYGBcbiAgICoge1xuICAgKiAgIGNsaWVudE5hbWU6ICdTVFNDbGllbnQnLFxuICAgKiAgIGNvbW1hbmROYW1lOiAnR2V0Q2FsbGVySWRlbnRpdHlDb21tYW5kJyxcbiAgICogICBpbnB1dDoge30sXG4gICAqICAgZXJyb3I6IEFnZ3JlZ2F0ZUVycm9yIFtFQ09OTlJFRlVTRURdOlxuICAgKiAgICAgICBhdCBpbnRlcm5hbENvbm5lY3RNdWx0aXBsZSAobm9kZTpuZXQ6MTEyMToxOClcbiAgICogICAgICAgYXQgYWZ0ZXJDb25uZWN0TXVsdGlwbGUgKG5vZGU6bmV0OjE2ODg6Nykge1xuICAgKiAgICAgY29kZTogJ0VDT05OUkVGVVNFRCcsXG4gICAqICAgICAnJG1ldGFkYXRhJzogeyBhdHRlbXB0czogMywgdG90YWxSZXRyeURlbGF5OiA2MDAgfSxcbiAgICogICAgIFtlcnJvcnNdOiBbIFtFcnJvcl0sIFtFcnJvcl0gXVxuICAgKiAgIH0sXG4gICAqICAgbWV0YWRhdGE6IHsgYXR0ZW1wdHM6IDMsIHRvdGFsUmV0cnlEZWxheTogNjAwIH1cbiAgICogfVxuICAgKiBgYGBcbiAgICovXG4gIHB1YmxpYyBlcnJvciguLi5jb250ZW50OiBhbnlbXSkge1xuICAgIHRyYWNlKCdbc2RrIGVycm9yXSAlcycsIGZvcm1hdFNka0xvZ2dlckNvbnRlbnQoY29udGVudCkpO1xuICB9XG59XG5cbi8qKlxuICogVGhpcyBjYW4gYmUgYW55dGhpbmcuXG4gKlxuICogRm9yIGRlYnVnLCBpdCBzZWVtcyB0byBiZSBtb3N0bHkgc3RyaW5ncy5cbiAqIEZvciBpbmZvLCBpdCBzZWVtcyB0byBiZSBvYmplY3RzLlxuICpcbiAqIFN0cmluZ2lmeSBhbmQgam9pbiB3aXRob3V0IHNlcGFyYXRvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFNka0xvZ2dlckNvbnRlbnQoY29udGVudDogYW55W10pIHtcbiAgaWYgKGNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgY29uc3QgYXBpRm10ID0gZm9ybWF0QXBpQ2FsbChjb250ZW50WzBdKTtcbiAgICBpZiAoYXBpRm10KSB7XG4gICAgICByZXR1cm4gYXBpRm10O1xuICAgIH1cbiAgfVxuICByZXR1cm4gY29udGVudC5tYXAoKHgpID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHggOiBpbnNwZWN0KHgpKS5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0QXBpQ2FsbChjb250ZW50OiBhbnkpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoIWlzU2RrQXBpQ2FsbFN1Y2Nlc3MoY29udGVudCkgJiYgIWlzU2RrQXBpQ2FsbEVycm9yKGNvbnRlbnQpKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IHNlcnZpY2UgPSBjb250ZW50LmNsaWVudE5hbWUucmVwbGFjZSgvQ2xpZW50JC8sICcnKTtcbiAgY29uc3QgYXBpID0gY29udGVudC5jb21tYW5kTmFtZS5yZXBsYWNlKC9Db21tYW5kJC8sICcnKTtcblxuICBjb25zdCBwYXJ0cyA9IFtdO1xuICBpZiAoKGNvbnRlbnQubWV0YWRhdGE/LmF0dGVtcHRzID8/IDApID4gMSkge1xuICAgIHBhcnRzLnB1c2goYFske2NvbnRlbnQubWV0YWRhdGE/LmF0dGVtcHRzfSBhdHRlbXB0cywgJHtjb250ZW50Lm1ldGFkYXRhPy50b3RhbFJldHJ5RGVsYXl9bXMgcmV0cnldYCk7XG4gIH1cblxuICBwYXJ0cy5wdXNoKGAke3NlcnZpY2V9LiR7YXBpfSgke0pTT04uc3RyaW5naWZ5KGNvbnRlbnQuaW5wdXQpfSlgKTtcblxuICBpZiAoaXNTZGtBcGlDYWxsU3VjY2Vzcyhjb250ZW50KSkge1xuICAgIHBhcnRzLnB1c2goJy0+IE9LJyk7XG4gIH0gZWxzZSB7XG4gICAgcGFydHMucHVzaChgLT4gJHtjb250ZW50LmVycm9yfWApO1xuICB9XG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJyAnKTtcbn1cblxuaW50ZXJmYWNlIFNka0FwaUNhbGxCYXNlIHtcbiAgY2xpZW50TmFtZTogc3RyaW5nO1xuICBjb21tYW5kTmFtZTogc3RyaW5nO1xuICBpbnB1dDogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIG1ldGFkYXRhPzoge1xuICAgIGh0dHBTdGF0dXNDb2RlPzogbnVtYmVyO1xuICAgIHJlcXVlc3RJZD86IHN0cmluZztcbiAgICBleHRlbmRlZFJlcXVlc3RJZD86IHN0cmluZztcbiAgICBjZklkPzogc3RyaW5nO1xuICAgIGF0dGVtcHRzPzogbnVtYmVyO1xuICAgIHRvdGFsUmV0cnlEZWxheT86IG51bWJlcjtcbiAgfTtcbn1cblxudHlwZSBTZGtBcGlDYWxsU3VjY2VzcyA9IFNka0FwaUNhbGxCYXNlICYgeyBvdXRwdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH07XG50eXBlIFNka0FwaUNhbGxFcnJvciA9IFNka0FwaUNhbGxCYXNlICYgeyBlcnJvcjogRXJyb3IgfTtcblxuZnVuY3Rpb24gaXNTZGtBcGlDYWxsU3VjY2Vzcyh4OiBhbnkpOiB4IGlzIFNka0FwaUNhbGxTdWNjZXNzIHtcbiAgcmV0dXJuIHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHguY29tbWFuZE5hbWUgJiYgeC5vdXRwdXQ7XG59XG5cbmZ1bmN0aW9uIGlzU2RrQXBpQ2FsbEVycm9yKHg6IGFueSk6IHggaXMgU2RrQXBpQ2FsbEVycm9yIHtcbiAgcmV0dXJuIHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHguY29tbWFuZE5hbWUgJiYgeC5lcnJvcjtcbn1cbiJdfQ==