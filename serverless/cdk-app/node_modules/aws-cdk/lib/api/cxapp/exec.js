"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execProgram = execProgram;
exports.createAssembly = createAssembly;
exports.prepareDefaultEnvironment = prepareDefaultEnvironment;
exports.prepareContext = prepareContext;
const childProcess = require("child_process");
const os = require("os");
const path = require("path");
const cxschema = require("@aws-cdk/cloud-assembly-schema");
const cxapi = require("@aws-cdk/cx-api");
const fs = require("fs-extra");
const semver = require("semver");
const logging_1 = require("../../logging");
const settings_1 = require("../../settings");
const error_1 = require("../../toolkit/error");
const tree_1 = require("../../tree");
const objects_1 = require("../../util/objects");
const version_1 = require("../../version");
const rwlock_1 = require("../util/rwlock");
/** Invokes the cloud executable and returns JSON output */
async function execProgram(aws, config) {
    const env = await prepareDefaultEnvironment(aws);
    const context = await prepareContext(config, env);
    const build = config.settings.get(['build']);
    if (build) {
        await exec(build);
    }
    const app = config.settings.get(['app']);
    if (!app) {
        throw new error_1.ToolkitError(`--app is required either in command-line, in ${settings_1.PROJECT_CONFIG} or in ${settings_1.USER_DEFAULTS}`);
    }
    // bypass "synth" if app points to a cloud assembly
    if (await fs.pathExists(app) && (await fs.stat(app)).isDirectory()) {
        (0, logging_1.debug)('--app points to a cloud assembly, so we bypass synth');
        // Acquire a read lock on this directory
        const lock = await new rwlock_1.RWLock(app).acquireRead();
        return { assembly: createAssembly(app), lock };
    }
    const commandLine = await guessExecutable(appToArray(app));
    const outdir = config.settings.get(['output']);
    if (!outdir) {
        throw new error_1.ToolkitError('unexpected: --output is required');
    }
    if (typeof outdir !== 'string') {
        throw new error_1.ToolkitError(`--output takes a string, got ${JSON.stringify(outdir)}`);
    }
    try {
        await fs.mkdirp(outdir);
    }
    catch (error) {
        throw new error_1.ToolkitError(`Could not create output directory ${outdir} (${error.message})`);
    }
    (0, logging_1.debug)('outdir:', outdir);
    env[cxapi.OUTDIR_ENV] = outdir;
    // Acquire a lock on the output directory
    const writerLock = await new rwlock_1.RWLock(outdir).acquireWrite();
    try {
        // Send version information
        env[cxapi.CLI_ASM_VERSION_ENV] = cxschema.Manifest.version();
        env[cxapi.CLI_VERSION_ENV] = (0, version_1.versionNumber)();
        (0, logging_1.debug)('env:', env);
        const envVariableSizeLimit = os.platform() === 'win32' ? 32760 : 131072;
        const [smallContext, overflow] = (0, objects_1.splitBySize)(context, spaceAvailableForContext(env, envVariableSizeLimit));
        // Store the safe part in the environment variable
        env[cxapi.CONTEXT_ENV] = JSON.stringify(smallContext);
        // If there was any overflow, write it to a temporary file
        let contextOverflowLocation;
        if (Object.keys(overflow ?? {}).length > 0) {
            const contextDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdk-context'));
            contextOverflowLocation = path.join(contextDir, 'context-overflow.json');
            fs.writeJSONSync(contextOverflowLocation, overflow);
            env[cxapi.CONTEXT_OVERFLOW_LOCATION_ENV] = contextOverflowLocation;
        }
        await exec(commandLine.join(' '));
        const assembly = createAssembly(outdir);
        contextOverflowCleanup(contextOverflowLocation, assembly);
        return { assembly, lock: await writerLock.convertToReaderLock() };
    }
    catch (e) {
        await writerLock.release();
        throw e;
    }
    async function exec(commandAndArgs) {
        return new Promise((ok, fail) => {
            // We use a slightly lower-level interface to:
            //
            // - Pass arguments in an array instead of a string, to get around a
            //   number of quoting issues introduced by the intermediate shell layer
            //   (which would be different between Linux and Windows).
            //
            // - Inherit stderr from controlling terminal. We don't use the captured value
            //   anyway, and if the subprocess is printing to it for debugging purposes the
            //   user gets to see it sooner. Plus, capturing doesn't interact nicely with some
            //   processes like Maven.
            const proc = childProcess.spawn(commandAndArgs, {
                stdio: ['ignore', 'inherit', 'inherit'],
                detached: false,
                shell: true,
                env: {
                    ...process.env,
                    ...env,
                },
            });
            proc.on('error', fail);
            proc.on('exit', code => {
                if (code === 0) {
                    return ok();
                }
                else {
                    (0, logging_1.debug)('failed command:', commandAndArgs);
                    return fail(new error_1.ToolkitError(`Subprocess exited with error ${code}`));
                }
            });
        });
    }
}
/**
 * Creates an assembly with error handling
 */
function createAssembly(appDir) {
    try {
        return new cxapi.CloudAssembly(appDir, {
            // We sort as we deploy
            topoSort: false,
        });
    }
    catch (error) {
        if (error.message.includes(cxschema.VERSION_MISMATCH)) {
            // this means the CLI version is too old.
            // we instruct the user to upgrade.
            throw new error_1.ToolkitError(`This CDK CLI is not compatible with the CDK library used by your application. Please upgrade the CLI to the latest version.\n(${error.message})`);
        }
        throw error;
    }
}
/**
 * If we don't have region/account defined in context, we fall back to the default SDK behavior
 * where region is retrieved from ~/.aws/config and account is based on default credentials provider
 * chain and then STS is queried.
 *
 * This is done opportunistically: for example, if we can't access STS for some reason or the region
 * is not configured, the context value will be 'null' and there could failures down the line. In
 * some cases, synthesis does not require region/account information at all, so that might be perfectly
 * fine in certain scenarios.
 *
 * @param context The context key/value bash.
 */
async function prepareDefaultEnvironment(aws) {
    const env = {};
    env[cxapi.DEFAULT_REGION_ENV] = aws.defaultRegion;
    (0, logging_1.debug)(`Setting "${cxapi.DEFAULT_REGION_ENV}" environment variable to`, env[cxapi.DEFAULT_REGION_ENV]);
    const accountId = (await aws.defaultAccount())?.accountId;
    if (accountId) {
        env[cxapi.DEFAULT_ACCOUNT_ENV] = accountId;
        (0, logging_1.debug)(`Setting "${cxapi.DEFAULT_ACCOUNT_ENV}" environment variable to`, env[cxapi.DEFAULT_ACCOUNT_ENV]);
    }
    return env;
}
/**
 * Settings related to synthesis are read from context.
 * The merging of various configuration sources like cli args or cdk.json has already happened.
 * We now need to set the final values to the context.
 */
async function prepareContext(config, env) {
    const context = config.context.all;
    const debugMode = config.settings.get(['debug']) ?? true;
    if (debugMode) {
        env.CDK_DEBUG = 'true';
    }
    const pathMetadata = config.settings.get(['pathMetadata']) ?? true;
    if (pathMetadata) {
        context[cxapi.PATH_METADATA_ENABLE_CONTEXT] = true;
    }
    const assetMetadata = config.settings.get(['assetMetadata']) ?? true;
    if (assetMetadata) {
        context[cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT] = true;
    }
    const versionReporting = config.settings.get(['versionReporting']) ?? true;
    if (versionReporting) {
        context[cxapi.ANALYTICS_REPORTING_ENABLED_CONTEXT] = true;
    }
    // We need to keep on doing this for framework version from before this flag was deprecated.
    if (!versionReporting) {
        context['aws:cdk:disable-version-reporting'] = true;
    }
    const stagingEnabled = config.settings.get(['staging']) ?? true;
    if (!stagingEnabled) {
        context[cxapi.DISABLE_ASSET_STAGING_CONTEXT] = true;
    }
    const bundlingStacks = config.settings.get(['bundlingStacks']) ?? ['**'];
    context[cxapi.BUNDLING_STACKS] = bundlingStacks;
    (0, logging_1.debug)('context:', context);
    return context;
}
/**
 * Make sure the 'app' is an array
 *
 * If it's a string, split on spaces as a trivial way of tokenizing the command line.
 */
function appToArray(app) {
    return typeof app === 'string' ? app.split(' ') : app;
}
/**
 * Execute the given file with the same 'node' process as is running the current process
 */
function executeNode(scriptFile) {
    return [process.execPath, scriptFile];
}
/**
 * Mapping of extensions to command-line generators
 */
const EXTENSION_MAP = new Map([
    ['.js', executeNode],
]);
/**
 * Guess the executable from the command-line argument
 *
 * Only do this if the file is NOT marked as executable. If it is,
 * we'll defer to the shebang inside the file itself.
 *
 * If we're on Windows, we ALWAYS take the handler, since it's hard to
 * verify if registry associations have or have not been set up for this
 * file type, so we'll assume the worst and take control.
 */
async function guessExecutable(commandLine) {
    if (commandLine.length === 1) {
        let fstat;
        try {
            fstat = await fs.stat(commandLine[0]);
        }
        catch {
            (0, logging_1.debug)(`Not a file: '${commandLine[0]}'. Using '${commandLine}' as command-line`);
            return commandLine;
        }
        // eslint-disable-next-line no-bitwise
        const isExecutable = (fstat.mode & fs.constants.X_OK) !== 0;
        const isWindows = process.platform === 'win32';
        const handler = EXTENSION_MAP.get(path.extname(commandLine[0]));
        if (handler && (!isExecutable || isWindows)) {
            return handler(commandLine[0]);
        }
    }
    return commandLine;
}
function contextOverflowCleanup(location, assembly) {
    if (location) {
        fs.removeSync(path.dirname(location));
        const tree = (0, tree_1.loadTree)(assembly);
        const frameworkDoesNotSupportContextOverflow = (0, tree_1.some)(tree, node => {
            const fqn = node.constructInfo?.fqn;
            const version = node.constructInfo?.version;
            return (fqn === 'aws-cdk-lib.App' && version != null && semver.lte(version, '2.38.0'))
                || fqn === '@aws-cdk/core.App'; // v1
        });
        // We're dealing with an old version of the framework here. It is unaware of the temporary
        // file, which means that it will ignore the context overflow.
        if (frameworkDoesNotSupportContextOverflow) {
            (0, logging_1.warning)('Part of the context could not be sent to the application. Please update the AWS CDK library to the latest version.');
        }
    }
}
function spaceAvailableForContext(env, limit) {
    const size = (value) => value != null ? Buffer.byteLength(value) : 0;
    const usedSpace = Object.entries(env)
        .map(([k, v]) => k === cxapi.CONTEXT_ENV ? size(k) : size(k) + size(v))
        .reduce((a, b) => a + b, 0);
    return Math.max(0, limit - usedSpace);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV4ZWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFzQkEsa0NBaUhDO0FBS0Qsd0NBY0M7QUFjRCw4REFhQztBQU9ELHdDQWtDQztBQTlORCw4Q0FBOEM7QUFDOUMseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwyREFBMkQ7QUFDM0QseUNBQXlDO0FBQ3pDLCtCQUErQjtBQUMvQixpQ0FBaUM7QUFDakMsMkNBQStDO0FBQy9DLDZDQUE4RTtBQUM5RSwrQ0FBbUQ7QUFDbkQscUNBQTRDO0FBQzVDLGdEQUFpRDtBQUNqRCwyQ0FBOEM7QUFFOUMsMkNBQStDO0FBTy9DLDJEQUEyRDtBQUNwRCxLQUFLLFVBQVUsV0FBVyxDQUFDLEdBQWdCLEVBQUUsTUFBcUI7SUFDdkUsTUFBTSxHQUFHLEdBQUcsTUFBTSx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqRCxNQUFNLE9BQU8sR0FBRyxNQUFNLGNBQWMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFbEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzdDLElBQUksS0FBSyxFQUFFLENBQUM7UUFDVixNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNwQixDQUFDO0lBRUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNULE1BQU0sSUFBSSxvQkFBWSxDQUFDLGdEQUFnRCx5QkFBYyxVQUFVLHdCQUFhLEVBQUUsQ0FBQyxDQUFDO0lBQ2xILENBQUM7SUFFRCxtREFBbUQ7SUFDbkQsSUFBSSxNQUFNLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUs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QztTQUNsQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN0RSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRTlCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjaGlsZFByb2Nlc3MgZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY3hzY2hlbWEgZnJvbSAnQGF3cy1jZGsvY2xvdWQtYXNzZW1ibHktc2NoZW1hJztcbmltcG9ydCAqIGFzIGN4YXBpIGZyb20gJ0Bhd3MtY2RrL2N4LWFwaSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7IGRlYnVnLCB3YXJuaW5nIH0gZnJvbSAnLi4vLi4vbG9nZ2luZyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uLCBQUk9KRUNUX0NPTkZJRywgVVNFUl9ERUZBVUxUUyB9IGZyb20gJy4uLy4uL3NldHRpbmdzJztcbmltcG9ydCB7IFRvb2xraXRFcnJvciB9IGZyb20gJy4uLy4uL3Rvb2xraXQvZXJyb3InO1xuaW1wb3J0IHsgbG9hZFRyZWUsIHNvbWUgfSBmcm9tICcuLi8uLi90cmVlJztcbmltcG9ydCB7IHNwbGl0QnlTaXplIH0gZnJvbSAnLi4vLi4vdXRpbC9vYmplY3RzJztcbmltcG9ydCB7IHZlcnNpb25OdW1iZXIgfSBmcm9tICcuLi8uLi92ZXJzaW9uJztcbmltcG9ydCB7IFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuaW1wb3J0IHsgUldMb2NrLCBJTG9jayB9IGZyb20gJy4uL3V0aWwvcndsb2NrJztcblxuZXhwb3J0IGludGVyZmFjZSBFeGVjUHJvZ3JhbVJlc3VsdCB7XG4gIHJlYWRvbmx5IGFzc2VtYmx5OiBjeGFwaS5DbG91ZEFzc2VtYmx5O1xuICByZWFkb25seSBsb2NrOiBJTG9jaztcbn1cblxuLyoqIEludm9rZXMgdGhlIGNsb3VkIGV4ZWN1dGFibGUgYW5kIHJldHVybnMgSlNPTiBvdXRwdXQgKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjUHJvZ3JhbShhd3M6IFNka1Byb3ZpZGVyLCBjb25maWc6IENvbmZpZ3VyYXRpb24pOiBQcm9taXNlPEV4ZWNQcm9ncmFtUmVzdWx0PiB7XG4gIGNvbnN0IGVudiA9IGF3YWl0IHByZXBhcmVEZWZhdWx0RW52aXJvbm1lbnQoYXdzKTtcbiAgY29uc3QgY29udGV4dCA9IGF3YWl0IHByZXBhcmVDb250ZXh0KGNvbmZpZywgZW52KTtcblxuICBjb25zdCBidWlsZCA9IGNvbmZpZy5zZXR0aW5ncy5nZXQoWydidWlsZCddKTtcbiAgaWYgKGJ1aWxkKSB7XG4gICAgYXdhaXQgZXhlYyhidWlsZCk7XG4gIH1cblxuICBjb25zdCBhcHAgPSBjb25maWcuc2V0dGluZ3MuZ2V0KFsnYXBwJ10pO1xuICBpZiAoIWFwcCkge1xuICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoYC0tYXBwIGlzIHJlcXVpcmVkIGVpdGhlciBpbiBjb21tYW5kLWxpbmUsIGluICR7UFJPSkVDVF9DT05GSUd9IG9yIGluICR7VVNFUl9ERUZBVUxUU31gKTtcbiAgfVxuXG4gIC8vIGJ5cGFzcyBcInN5bnRoXCIgaWYgYXBwIHBvaW50cyB0byBhIGNsb3VkIGFzc2VtYmx5XG4gIGlmIChhd2FpdCBmcy5wYXRoRXhpc3RzKGFwcCkgJiYgKGF3YWl0IGZzLnN0YXQoYXBwKSkuaXNEaXJlY3RvcnkoKSkge1xuICAgIGRlYnVnKCctLWFwcCBwb2ludHMgdG8gYSBjbG91ZCBhc3NlbWJseSwgc28gd2UgYnlwYXNzIHN5bnRoJyk7XG5cbiAgICAvLyBBY3F1aXJlIGEgcmVhZCBsb2NrIG9uIHRoaXMgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9jayA9IGF3YWl0IG5ldyBSV0xvY2soYXBwKS5hY3F1aXJlUmVhZCgpO1xuXG4gICAgcmV0dXJuIHsgYXNzZW1ibHk6IGNyZWF0ZUFzc2VtYmx5KGFwcCksIGxvY2sgfTtcbiAgfVxuXG4gIGNvbnN0IGNvbW1hbmRMaW5lID0gYXdhaXQgZ3Vlc3NFeGVjdXRhYmxlKGFwcFRvQXJyYXkoYXBwKSk7XG5cbiAgY29uc3Qgb3V0ZGlyID0gY29uZmlnLnNldHRpbmdzLmdldChbJ291dHB1dCddKTtcbiAgaWYgKCFvdXRkaXIpIHtcbiAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKCd1bmV4cGVjdGVkOiAtLW91dHB1dCBpcyByZXF1aXJlZCcpO1xuICB9XG4gIGlmICh0eXBlb2Ygb3V0ZGlyICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUb29sa2l0RXJyb3IoYC0tb3V0cHV0IHRha2VzIGEgc3RyaW5nLCBnb3QgJHtKU09OLnN0cmluZ2lmeShvdXRkaXIpfWApO1xuICB9XG4gIHRyeSB7XG4gICAgYXdhaXQgZnMubWtkaXJwKG91dGRpcik7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKGBDb3VsZCBub3QgY3JlYXRlIG91dHB1dCBkaXJlY3RvcnkgJHtvdXRkaXJ9ICgke2Vycm9yLm1lc3NhZ2V9KWApO1xuICB9XG5cbiAgZGVidWcoJ291dGRpcjonLCBvdXRkaXIpO1xuICBlbnZbY3hhcGkuT1VURElSX0VOVl0gPSBvdXRkaXI7XG5cbiAgLy8gQWNxdWlyZSBhIGxvY2sgb24gdGhlIG91dHB1dCBkaXJlY3RvcnlcbiAgY29uc3Qgd3JpdGVyTG9jayA9IGF3YWl0IG5ldyBSV0xvY2sob3V0ZGlyKS5hY3F1aXJlV3JpdGUoKTtcblxuICB0cnkge1xuICAgIC8vIFNlbmQgdmVyc2lvbiBpbmZvcm1hdGlvblxuICAgIGVudltjeGFwaS5DTElfQVNNX1ZFUlNJT05fRU5WXSA9IGN4c2NoZW1hLk1hbmlmZXN0LnZlcnNpb24oKTtcbiAgICBlbnZbY3hhcGkuQ0xJX1ZFUlNJT05fRU5WXSA9IHZlcnNpb25OdW1iZXIoKTtcblxuICAgIGRlYnVnKCdlbnY6JywgZW52KTtcblxuICAgIGNvbnN0IGVudlZhcmlhYmxlU2l6ZUxpbWl0ID0gb3MucGxhdGZvcm0oKSA9PT0gJ3dpbjMyJyA/IDMyNzYwIDogMTMxMDcyO1xuICAgIGNvbnN0IFtzbWFsbENvbnRleHQsIG92ZXJmbG93XSA9IHNwbGl0QnlTaXplKGNvbnRleHQsIHNwYWNlQXZhaWxhYmxlRm9yQ29udGV4dChlbnYsIGVudlZhcmlhYmxlU2l6ZUxpbWl0KSk7XG5cbiAgICAvLyBTdG9yZSB0aGUgc2FmZSBwYXJ0IGluIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZVxuICAgIGVudltjeGFwaS5DT05URVhUX0VOVl0gPSBKU09OLnN0cmluZ2lmeShzbWFsbENvbnRleHQpO1xuXG4gICAgLy8gSWYgdGhlcmUgd2FzIGFueSBvdmVyZmxvdywgd3JpdGUgaXQgdG8gYSB0ZW1wb3JhcnkgZmlsZVxuICAgIGxldCBjb250ZXh0T3ZlcmZsb3dMb2NhdGlvbjtcbiAgICBpZiAoT2JqZWN0LmtleXMob3ZlcmZsb3cgPz8ge30pLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGNvbnRleHREaXIgPSBhd2FpdCBmcy5ta2R0ZW1wKHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2Nkay1jb250ZXh0JykpO1xuICAgICAgY29udGV4dE92ZXJmbG93TG9jYXRpb24gPSBwYXRoLmpvaW4oY29udGV4dERpciwgJ2NvbnRleHQtb3ZlcmZsb3cuanNvbicpO1xuICAgICAgZnMud3JpdGVKU09OU3luYyhjb250ZXh0T3ZlcmZsb3dMb2NhdGlvbiwgb3ZlcmZsb3cpO1xuICAgICAgZW52W2N4YXBpLkNPTlRFWFRfT1ZFUkZMT1dfTE9DQVRJT05fRU5WXSA9IGNvbnRleHRPdmVyZmxvd0xvY2F0aW9uO1xuICAgIH1cblxuICAgIGF3YWl0IGV4ZWMoY29tbWFuZExpbmUuam9pbignICcpKTtcblxuICAgIGNvbnN0IGFzc2VtYmx5ID0gY3JlYXRlQXNzZW1ibHkob3V0ZGlyKTtcblxuICAgIGNvbnRleHRPdmVyZmxvd0NsZWFudXAoY29udGV4dE92ZXJmbG93TG9jYXRpb24sIGFzc2VtYmx5KTtcblxuICAgIHJldHVybiB7IGFzc2VtYmx5LCBsb2NrOiBhd2FpdCB3cml0ZXJMb2NrLmNvbnZlcnRUb1JlYWRlckxvY2soKSB9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXdhaXQgd3JpdGVyTG9jay5yZWxlYXNlKCk7XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGV4ZWMoY29tbWFuZEFuZEFyZ3M6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigob2ssIGZhaWwpID0+IHtcbiAgICAgIC8vIFdlIHVzZSBhIHNsaWdodGx5IGxvd2VyLWxldmVsIGludGVyZmFjZSB0bzpcbiAgICAgIC8vXG4gICAgICAvLyAtIFBhc3MgYXJndW1lbnRzIGluIGFuIGFycmF5IGluc3RlYWQgb2YgYSBzdHJpbmcsIHRvIGdldCBhcm91bmQgYVxuICAgICAgLy8gICBudW1iZXIgb2YgcXVvdGluZyBpc3N1ZXMgaW50cm9kdWNlZCBieSB0aGUgaW50ZXJtZWRpYXRlIHNoZWxsIGxheWVyXG4gICAgICAvLyAgICh3aGljaCB3b3VsZCBiZSBkaWZmZXJlbnQgYmV0d2VlbiBMaW51eCBhbmQgV2luZG93cykuXG4gICAgICAvL1xuICAgICAgLy8gLSBJbmhlcml0IHN0ZGVyciBmcm9tIGNvbnRyb2xsaW5nIHRlcm1pbmFsLiBXZSBkb24ndCB1c2UgdGhlIGNhcHR1cmVkIHZhbHVlXG4gICAgICAvLyAgIGFueXdheSwgYW5kIGlmIHRoZSBzdWJwcm9jZXNzIGlzIHByaW50aW5nIHRvIGl0IGZvciBkZWJ1Z2dpbmcgcHVycG9zZXMgdGhlXG4gICAgICAvLyAgIHVzZXIgZ2V0cyB0byBzZWUgaXQgc29vbmVyLiBQbHVzLCBjYXB0dXJpbmcgZG9lc24ndCBpbnRlcmFjdCBuaWNlbHkgd2l0aCBzb21lXG4gICAgICAvLyAgIHByb2Nlc3NlcyBsaWtlIE1hdmVuLlxuICAgICAgY29uc3QgcHJvYyA9IGNoaWxkUHJvY2Vzcy5zcGF3bihjb21tYW5kQW5kQXJncywge1xuICAgICAgICBzdGRpbzogWydpZ25vcmUnLCAnaW5oZXJpdCcsICdpbmhlcml0J10sXG4gICAgICAgIGRldGFjaGVkOiBmYWxzZSxcbiAgICAgICAgc2hlbGw6IHRydWUsXG4gICAgICAgIGVudjoge1xuICAgICAgICAgIC4uLnByb2Nlc3MuZW52LFxuICAgICAgICAgIC4uLmVudixcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBwcm9jLm9uKCdlcnJvcicsIGZhaWwpO1xuXG4gICAgICBwcm9jLm9uKCdleGl0JywgY29kZSA9PiB7XG4gICAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG9rKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVidWcoJ2ZhaWxlZCBjb21tYW5kOicsIGNvbW1hbmRBbmRBcmdzKTtcbiAgICAgICAgICByZXR1cm4gZmFpbChuZXcgVG9vbGtpdEVycm9yKGBTdWJwcm9jZXNzIGV4aXRlZCB3aXRoIGVycm9yICR7Y29kZX1gKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhc3NlbWJseSB3aXRoIGVycm9yIGhhbmRsaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBc3NlbWJseShhcHBEaXI6IHN0cmluZykge1xuICB0cnkge1xuICAgIHJldHVybiBuZXcgY3hhcGkuQ2xvdWRBc3NlbWJseShhcHBEaXIsIHtcbiAgICAgIC8vIFdlIHNvcnQgYXMgd2UgZGVwbG95XG4gICAgICB0b3BvU29ydDogZmFsc2UsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhjeHNjaGVtYS5WRVJTSU9OX01JU01BVENIKSkge1xuICAgICAgLy8gdGhpcyBtZWFucyB0aGUgQ0xJIHZlcnNpb24gaXMgdG9vIG9sZC5cbiAgICAgIC8vIHdlIGluc3RydWN0IHRoZSB1c2VyIHRvIHVwZ3JhZGUuXG4gICAgICB0aHJvdyBuZXcgVG9vbGtpdEVycm9yKGBUaGlzIENESyBDTEkgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgQ0RLIGxpYnJhcnkgdXNlZCBieSB5b3VyIGFwcGxpY2F0aW9uLiBQbGVhc2UgdXBncmFkZSB0aGUgQ0xJIHRvIHRoZSBsYXRlc3QgdmVyc2lvbi5cXG4oJHtlcnJvci5tZXNzYWdlfSlgKTtcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLyoqXG4gKiBJZiB3ZSBkb24ndCBoYXZlIHJlZ2lvbi9hY2NvdW50IGRlZmluZWQgaW4gY29udGV4dCwgd2UgZmFsbCBiYWNrIHRvIHRoZSBkZWZhdWx0IFNESyBiZWhhdmlvclxuICogd2hlcmUgcmVnaW9uIGlzIHJldHJpZXZlZCBmcm9tIH4vLmF3cy9jb25maWcgYW5kIGFjY291bnQgaXMgYmFzZWQgb24gZGVmYXVsdCBjcmVkZW50aWFscyBwcm92aWRlclxuICogY2hhaW4gYW5kIHRoZW4gU1RTIGlzIHF1ZXJpZWQuXG4gKlxuICogVGhpcyBpcyBkb25lIG9wcG9ydHVuaXN0aWNhbGx5OiBmb3IgZXhhbXBsZSwgaWYgd2UgY2FuJ3QgYWNjZXNzIFNUUyBmb3Igc29tZSByZWFzb24gb3IgdGhlIHJlZ2lvblxuICogaXMgbm90IGNvbmZpZ3VyZWQsIHRoZSBjb250ZXh0IHZhbHVlIHdpbGwgYmUgJ251bGwnIGFuZCB0aGVyZSBjb3VsZCBmYWlsdXJlcyBkb3duIHRoZSBsaW5lLiBJblxuICogc29tZSBjYXNlcywgc3ludGhlc2lzIGRvZXMgbm90IHJlcXVpcmUgcmVnaW9uL2FjY291bnQgaW5mb3JtYXRpb24gYXQgYWxsLCBzbyB0aGF0IG1pZ2h0IGJlIHBlcmZlY3RseVxuICogZmluZSBpbiBjZXJ0YWluIHNjZW5hcmlvcy5cbiAqXG4gKiBAcGFyYW0gY29udGV4dCBUaGUgY29udGV4dCBrZXkvdmFsdWUgYmFzaC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByZXBhcmVEZWZhdWx0RW52aXJvbm1lbnQoYXdzOiBTZGtQcm92aWRlcik6IFByb21pc2U8eyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfT4ge1xuICBjb25zdCBlbnY6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7IH07XG5cbiAgZW52W2N4YXBpLkRFRkFVTFRfUkVHSU9OX0VOVl0gPSBhd3MuZGVmYXVsdFJlZ2lvbjtcbiAgZGVidWcoYFNldHRpbmcgXCIke2N4YXBpLkRFRkFVTFRfUkVHSU9OX0VOVn1cIiBlbnZpcm9ubWVudCB2YXJpYWJsZSB0b2AsIGVudltjeGFwaS5ERUZBVUxUX1JFR0lPTl9FTlZdKTtcblxuICBjb25zdCBhY2NvdW50SWQgPSAoYXdhaXQgYXdzLmRlZmF1bHRBY2NvdW50KCkpPy5hY2NvdW50SWQ7XG4gIGlmIChhY2NvdW50SWQpIHtcbiAgICBlbnZbY3hhcGkuREVGQVVMVF9BQ0NPVU5UX0VOVl0gPSBhY2NvdW50SWQ7XG4gICAgZGVidWcoYFNldHRpbmcgXCIke2N4YXBpLkRFRkFVTFRfQUNDT1VOVF9FTlZ9XCIgZW52aXJvbm1lbnQgdmFyaWFibGUgdG9gLCBlbnZbY3hhcGkuREVGQVVMVF9BQ0NPVU5UX0VOVl0pO1xuICB9XG5cbiAgcmV0dXJuIGVudjtcbn1cblxuLyoqXG4gKiBTZXR0aW5ncyByZWxhdGVkIHRvIHN5bnRoZXNpcyBhcmUgcmVhZCBmcm9tIGNvbnRleHQuXG4gKiBUaGUgbWVyZ2luZyBvZiB2YXJpb3VzIGNvbmZpZ3VyYXRpb24gc291cmNlcyBsaWtlIGNsaSBhcmdzIG9yIGNkay5qc29uIGhhcyBhbHJlYWR5IGhhcHBlbmVkLlxuICogV2Ugbm93IG5lZWQgdG8gc2V0IHRoZSBmaW5hbCB2YWx1ZXMgdG8gdGhlIGNvbnRleHQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVwYXJlQ29udGV4dChjb25maWc6IENvbmZpZ3VyYXRpb24sIGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWR9KSB7XG4gIGNvbnN0IGNvbnRleHQgPSBjb25maWcuY29udGV4dC5hbGw7XG5cbiAgY29uc3QgZGVidWdNb2RlOiBib29sZWFuID0gY29uZmlnLnNldHRpbmdzLmdldChbJ2RlYnVnJ10pID8/IHRydWU7XG4gIGlmIChkZWJ1Z01vZGUpIHtcbiAgICBlbnYuQ0RLX0RFQlVHID0gJ3RydWUnO1xuICB9XG5cbiAgY29uc3QgcGF0aE1ldGFkYXRhOiBib29sZWFuID0gY29uZmlnLnNldHRpbmdzLmdldChbJ3BhdGhNZXRhZGF0YSddKSA/PyB0cnVlO1xuICBpZiAocGF0aE1ldGFkYXRhKSB7XG4gICAgY29udGV4dFtjeGFwaS5QQVRIX01FVEFEQVRBX0VOQUJMRV9DT05URVhUXSA9IHRydWU7XG4gIH1cblxuICBjb25zdCBhc3NldE1ldGFkYXRhOiBib29sZWFuID0gY29uZmlnLnNldHRpbmdzLmdldChbJ2Fzc2V0TWV0YWRhdGEnXSkgPz8gdHJ1ZTtcbiAgaWYgKGFzc2V0TWV0YWRhdGEpIHtcbiAgICBjb250ZXh0W2N4YXBpLkFTU0VUX1JFU09VUkNFX01FVEFEQVRBX0VOQUJMRURfQ09OVEVYVF0gPSB0cnVlO1xuICB9XG5cbiAgY29uc3QgdmVyc2lvblJlcG9ydGluZzogYm9vbGVhbiA9IGNvbmZpZy5zZXR0aW5ncy5nZXQoWyd2ZXJzaW9uUmVwb3J0aW5nJ10pID8/IHRydWU7XG4gIGlmICh2ZXJzaW9uUmVwb3J0aW5nKSB7IGNvbnRleHRbY3hhcGkuQU5BTFlUSUNTX1JFUE9SVElOR19FTkFCTEVEX0NPTlRFWFRdID0gdHJ1ZTsgfVxuICAvLyBXZSBuZWVkIHRvIGtlZXAgb24gZG9pbmcgdGhpcyBmb3IgZnJhbWV3b3JrIHZlcnNpb24gZnJvbSBiZWZvcmUgdGhpcyBmbGFnIHdhcyBkZXByZWNhdGVkLlxuICBpZiAoIXZlcnNpb25SZXBvcnRpbmcpIHsgY29udGV4dFsnYXdzOmNkazpkaXNhYmxlLXZlcnNpb24tcmVwb3J0aW5nJ10gPSB0cnVlOyB9XG5cbiAgY29uc3Qgc3RhZ2luZ0VuYWJsZWQgPSBjb25maWcuc2V0dGluZ3MuZ2V0KFsnc3RhZ2luZyddKSA/PyB0cnVlO1xuICBpZiAoIXN0YWdpbmdFbmFibGVkKSB7XG4gICAgY29udGV4dFtjeGFwaS5ESVNBQkxFX0FTU0VUX1NUQUdJTkdfQ09OVEVYVF0gPSB0cnVlO1xuICB9XG5cbiAgY29uc3QgYnVuZGxpbmdTdGFja3MgPSBjb25maWcuc2V0dGluZ3MuZ2V0KFsnYnVuZGxpbmdTdGFja3MnXSkgPz8gWycqKiddO1xuICBjb250ZXh0W2N4YXBpLkJVTkRMSU5HX1NUQUNLU10gPSBidW5kbGluZ1N0YWNrcztcblxuICBkZWJ1ZygnY29udGV4dDonLCBjb250ZXh0KTtcblxuICByZXR1cm4gY29udGV4dDtcbn1cblxuLyoqXG4gKiBNYWtlIHN1cmUgdGhlICdhcHAnIGlzIGFuIGFycmF5XG4gKlxuICogSWYgaXQncyBhIHN0cmluZywgc3BsaXQgb24gc3BhY2VzIGFzIGEgdHJpdmlhbCB3YXkgb2YgdG9rZW5pemluZyB0aGUgY29tbWFuZCBsaW5lLlxuICovXG5mdW5jdGlvbiBhcHBUb0FycmF5KGFwcDogYW55KSB7XG4gIHJldHVybiB0eXBlb2YgYXBwID09PSAnc3RyaW5nJyA/IGFwcC5zcGxpdCgnICcpIDogYXBwO1xufVxuXG50eXBlIENvbW1hbmRHZW5lcmF0b3IgPSAoZmlsZTogc3RyaW5nKSA9PiBzdHJpbmdbXTtcblxuLyoqXG4gKiBFeGVjdXRlIHRoZSBnaXZlbiBmaWxlIHdpdGggdGhlIHNhbWUgJ25vZGUnIHByb2Nlc3MgYXMgaXMgcnVubmluZyB0aGUgY3VycmVudCBwcm9jZXNzXG4gKi9cbmZ1bmN0aW9uIGV4ZWN1dGVOb2RlKHNjcmlwdEZpbGU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIFtwcm9jZXNzLmV4ZWNQYXRoLCBzY3JpcHRGaWxlXTtcbn1cblxuLyoqXG4gKiBNYXBwaW5nIG9mIGV4dGVuc2lvbnMgdG8gY29tbWFuZC1saW5lIGdlbmVyYXRvcnNcbiAqL1xuY29uc3QgRVhURU5TSU9OX01BUCA9IG5ldyBNYXA8c3RyaW5nLCBDb21tYW5kR2VuZXJhdG9yPihbXG4gIFsnLmpzJywgZXhlY3V0ZU5vZGVdLFxuXSk7XG5cbi8qKlxuICogR3Vlc3MgdGhlIGV4ZWN1dGFibGUgZnJvbSB0aGUgY29tbWFuZC1saW5lIGFyZ3VtZW50XG4gKlxuICogT25seSBkbyB0aGlzIGlmIHRoZSBmaWxlIGlzIE5PVCBtYXJrZWQgYXMgZXhlY3V0YWJsZS4gSWYgaXQgaXMsXG4gKiB3ZSdsbCBkZWZlciB0byB0aGUgc2hlYmFuZyBpbnNpZGUgdGhlIGZpbGUgaXRzZWxmLlxuICpcbiAqIElmIHdlJ3JlIG9uIFdpbmRvd3MsIHdlIEFMV0FZUyB0YWtlIHRoZSBoYW5kbGVyLCBzaW5jZSBpdCdzIGhhcmQgdG9cbiAqIHZlcmlmeSBpZiByZWdpc3RyeSBhc3NvY2lhdGlvbnMgaGF2ZSBvciBoYXZlIG5vdCBiZWVuIHNldCB1cCBmb3IgdGhpc1xuICogZmlsZSB0eXBlLCBzbyB3ZSdsbCBhc3N1bWUgdGhlIHdvcnN0IGFuZCB0YWtlIGNvbnRyb2wuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGd1ZXNzRXhlY3V0YWJsZShjb21tYW5kTGluZTogc3RyaW5nW10pIHtcbiAgaWYgKGNvbW1hbmRMaW5lLmxlbmd0aCA9PT0gMSkge1xuICAgIGxldCBmc3RhdDtcblxuICAgIHRyeSB7XG4gICAgICBmc3RhdCA9IGF3YWl0IGZzLnN0YXQoY29tbWFuZExpbmVbMF0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgZGVidWcoYE5vdCBhIGZpbGU6ICcke2NvbW1hbmRMaW5lWzBdfScuIFVzaW5nICcke2NvbW1hbmRMaW5lfScgYXMgY29tbWFuZC1saW5lYCk7XG4gICAgICByZXR1cm4gY29tbWFuZExpbmU7XG4gICAgfVxuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWJpdHdpc2VcbiAgICBjb25zdCBpc0V4ZWN1dGFibGUgPSAoZnN0YXQubW9kZSAmIGZzLmNvbnN0YW50cy5YX09LKSAhPT0gMDtcbiAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xuXG4gICAgY29uc3QgaGFuZGxlciA9IEVYVEVOU0lPTl9NQVAuZ2V0KHBhdGguZXh0bmFtZShjb21tYW5kTGluZVswXSkpO1xuICAgIGlmIChoYW5kbGVyICYmICghaXNFeGVjdXRhYmxlIHx8IGlzV2luZG93cykpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyKGNvbW1hbmRMaW5lWzBdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbW1hbmRMaW5lO1xufVxuXG5mdW5jdGlvbiBjb250ZXh0T3ZlcmZsb3dDbGVhbnVwKGxvY2F0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIGFzc2VtYmx5OiBjeGFwaS5DbG91ZEFzc2VtYmx5KSB7XG4gIGlmIChsb2NhdGlvbikge1xuICAgIGZzLnJlbW92ZVN5bmMocGF0aC5kaXJuYW1lKGxvY2F0aW9uKSk7XG5cbiAgICBjb25zdCB0cmVlID0gbG9hZFRyZWUoYXNzZW1ibHkpO1xuICAgIGNvbnN0IGZyYW1ld29ya0RvZXNOb3RTdXBwb3J0Q29udGV4dE92ZXJmbG93ID0gc29tZSh0cmVlLCBub2RlID0+IHtcbiAgICAgIGNvbnN0IGZxbiA9IG5vZGUuY29uc3RydWN0SW5mbz8uZnFuO1xuICAgICAgY29uc3QgdmVyc2lvbiA9IG5vZGUuY29uc3RydWN0SW5mbz8udmVyc2lvbjtcbiAgICAgIHJldHVybiAoZnFuID09PSAnYXdzLWNkay1saWIuQXBwJyAmJiB2ZXJzaW9uICE9IG51bGwgJiYgc2VtdmVyLmx0ZSh2ZXJzaW9uLCAnMi4zOC4wJykpXG4gICAgICAgIHx8IGZxbiA9PT0gJ0Bhd3MtY2RrL2NvcmUuQXBwJzsgLy8gdjFcbiAgICB9KTtcblxuICAgIC8vIFdlJ3JlIGRlYWxpbmcgd2l0aCBhbiBvbGQgdmVyc2lvbiBvZiB0aGUgZnJhbWV3b3JrIGhlcmUuIEl0IGlzIHVuYXdhcmUgb2YgdGhlIHRlbXBvcmFyeVxuICAgIC8vIGZpbGUsIHdoaWNoIG1lYW5zIHRoYXQgaXQgd2lsbCBpZ25vcmUgdGhlIGNvbnRleHQgb3ZlcmZsb3cuXG4gICAgaWYgKGZyYW1ld29ya0RvZXNOb3RTdXBwb3J0Q29udGV4dE92ZXJmbG93KSB7XG4gICAgICB3YXJuaW5nKCdQYXJ0IG9mIHRoZSBjb250ZXh0IGNvdWxkIG5vdCBiZSBzZW50IHRvIHRoZSBhcHBsaWNhdGlvbi4gUGxlYXNlIHVwZGF0ZSB0aGUgQVdTIENESyBsaWJyYXJ5IHRvIHRoZSBsYXRlc3QgdmVyc2lvbi4nKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc3BhY2VBdmFpbGFibGVGb3JDb250ZXh0KGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSwgbGltaXQ6IG51bWJlcikge1xuICBjb25zdCBzaXplID0gKHZhbHVlOiBzdHJpbmcpID0+IHZhbHVlICE9IG51bGwgPyBCdWZmZXIuYnl0ZUxlbmd0aCh2YWx1ZSkgOiAwO1xuXG4gIGNvbnN0IHVzZWRTcGFjZSA9IE9iamVjdC5lbnRyaWVzKGVudilcbiAgICAubWFwKChbaywgdl0pID0+IGsgPT09IGN4YXBpLkNPTlRFWFRfRU5WID8gc2l6ZShrKSA6IHNpemUoaykgKyBzaXplKHYpKVxuICAgIC5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKTtcblxuICByZXR1cm4gTWF0aC5tYXgoMCwgbGltaXQgLSB1c2VkU3BhY2UpO1xufVxuIl19