import * as cxapi from '@aws-cdk/cx-api';
import { CloudAssembly } from '../../lib/api/cxapp/cloud-assembly';
/**
 * The cloud-assembly-schema in the new monorepo will use its own package version as the schema version, which is always `0.0.0` when tests are running.
 *
 * If we want to test the CLI's behavior when presented with specific schema versions, we will have to
 * mutate `manifest.json` on disk after writing it, and write the schema version that we want to test for in there.
 *
 * After we raise the schema version in the file on disk from `0.0.0` to
 * `30.0.0`, `cx-api` will refuse to load `manifest.json` back, because the
 * version is higher than its own package version ("Maximum schema version
 * supported is 0.x.x, but found 30.0.0"), so we have to turn on `skipVersionCheck`.
 */
export declare function cxapiAssemblyWithForcedVersion(asm: cxapi.CloudAssembly, version: string): cxapi.CloudAssembly;
/**
 * The CLI has its own CloudAssembly class which wraps the cxapi CloudAssembly class
 */
export declare function cliAssemblyWithForcedVersion(asm: CloudAssembly, version: string): CloudAssembly;
export declare function rewriteManifestVersion(directory: string, version: string): void;
