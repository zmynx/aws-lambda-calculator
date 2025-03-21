"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootstrapStack = void 0;
exports.bootstrapVersionFromTemplate = bootstrapVersionFromTemplate;
exports.bootstrapVariantFromTemplate = bootstrapVariantFromTemplate;
const os = require("os");
const path = require("path");
const cloud_assembly_schema_1 = require("@aws-cdk/cloud-assembly-schema");
const cx_api_1 = require("@aws-cdk/cx-api");
const fs = require("fs-extra");
const bootstrap_props_1 = require("./bootstrap-props");
const logging = require("../../logging");
const deploy_stack_1 = require("../deploy-stack");
const environment_resources_1 = require("../environment-resources");
const mode_1 = require("../plugin/mode");
const toolkit_info_1 = require("../toolkit-info");
/**
 * A class to hold state around stack bootstrapping
 *
 * This class exists so we can break bootstrapping into 2 phases:
 *
 * ```ts
 * const current = BootstrapStack.lookup(...);
 * // ...
 * current.update(newTemplate, ...);
 * ```
 *
 * And do something in between the two phases (such as look at the
 * current bootstrap stack and doing something intelligent).
 */
class BootstrapStack {
    static async lookup(sdkProvider, environment, toolkitStackName) {
        toolkitStackName = toolkitStackName ?? toolkit_info_1.DEFAULT_TOOLKIT_STACK_NAME;
        const resolvedEnvironment = await sdkProvider.resolveEnvironment(environment);
        const sdk = (await sdkProvider.forEnvironment(resolvedEnvironment, mode_1.Mode.ForWriting)).sdk;
        const currentToolkitInfo = await toolkit_info_1.ToolkitInfo.lookup(resolvedEnvironment, sdk, toolkitStackName);
        return new BootstrapStack(sdkProvider, sdk, resolvedEnvironment, toolkitStackName, currentToolkitInfo);
    }
    constructor(sdkProvider, sdk, resolvedEnvironment, toolkitStackName, currentToolkitInfo) {
        this.sdkProvider = sdkProvider;
        this.sdk = sdk;
        this.resolvedEnvironment = resolvedEnvironment;
        this.toolkitStackName = toolkitStackName;
        this.currentToolkitInfo = currentToolkitInfo;
    }
    get parameters() {
        return this.currentToolkitInfo.found ? this.currentToolkitInfo.bootstrapStack.parameters : {};
    }
    get terminationProtection() {
        return this.currentToolkitInfo.found ? this.currentToolkitInfo.bootstrapStack.terminationProtection : undefined;
    }
    async partition() {
        return (await this.sdk.currentAccount()).partition;
    }
    /**
     * Perform the actual deployment of a bootstrap stack, given a template and some parameters
     */
    async update(template, parameters, options) {
        if (this.currentToolkitInfo.found && !options.force) {
            // Safety checks
            const abortResponse = {
                type: 'did-deploy-stack',
                noOp: true,
                outputs: {},
                stackArn: this.currentToolkitInfo.bootstrapStack.stackId,
            };
            // Validate that the bootstrap stack we're trying to replace is from the same variant as the one we're trying to deploy
            const currentVariant = this.currentToolkitInfo.variant;
            const newVariant = bootstrapVariantFromTemplate(template);
            if (currentVariant !== newVariant) {
                logging.warning(`Bootstrap stack already exists, containing '${currentVariant}'. Not overwriting it with a template containing '${newVariant}' (use --force if you intend to overwrite)`);
                return abortResponse;
            }
            // Validate that we're not downgrading the bootstrap stack
            const newVersion = bootstrapVersionFromTemplate(template);
            const currentVersion = this.currentToolkitInfo.version;
            if (newVersion < currentVersion) {
                logging.warning(`Bootstrap stack already at version ${currentVersion}. Not downgrading it to version ${newVersion} (use --force if you intend to downgrade)`);
                if (newVersion === 0) {
                    // A downgrade with 0 as target version means we probably have a new-style bootstrap in the account,
                    // and an old-style bootstrap as current target, which means the user probably forgot to put this flag in.
                    logging.warning("(Did you set the '@aws-cdk/core:newStyleStackSynthesis' feature flag in cdk.json?)");
                }
                return abortResponse;
            }
        }
        const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdk-bootstrap'));
        const builder = new cx_api_1.CloudAssemblyBuilder(outdir);
        const templateFile = `${this.toolkitStackName}.template.json`;
        await fs.writeJson(path.join(builder.outdir, templateFile), template, {
            spaces: 2,
        });
        builder.addArtifact(this.toolkitStackName, {
            type: cloud_assembly_schema_1.ArtifactType.AWS_CLOUDFORMATION_STACK,
            environment: cx_api_1.EnvironmentUtils.format(this.resolvedEnvironment.account, this.resolvedEnvironment.region),
            properties: {
                templateFile,
                terminationProtection: options.terminationProtection ?? false,
            },
        });
        const assembly = builder.buildAssembly();
        const ret = await (0, deploy_stack_1.deployStack)({
            stack: assembly.getStackByName(this.toolkitStackName),
            resolvedEnvironment: this.resolvedEnvironment,
            sdk: this.sdk,
            sdkProvider: this.sdkProvider,
            force: options.force,
            roleArn: options.roleArn,
            tags: options.tags,
            deploymentMethod: { method: 'change-set', execute: options.execute },
            parameters,
            usePreviousParameters: options.usePreviousParameters ?? true,
            // Obviously we can't need a bootstrap stack to deploy a bootstrap stack
            envResources: new environment_resources_1.NoBootstrapStackEnvironmentResources(this.resolvedEnvironment, this.sdk),
        });
        (0, deploy_stack_1.assertIsSuccessfulDeployStackResult)(ret);
        return ret;
    }
}
exports.BootstrapStack = BootstrapStack;
function bootstrapVersionFromTemplate(template) {
    const versionSources = [
        template.Outputs?.[bootstrap_props_1.BOOTSTRAP_VERSION_OUTPUT]?.Value,
        template.Resources?.[bootstrap_props_1.BOOTSTRAP_VERSION_RESOURCE]?.Properties?.Value,
    ];
    for (const vs of versionSources) {
        if (typeof vs === 'number') {
            return vs;
        }
        if (typeof vs === 'string' && !isNaN(parseInt(vs, 10))) {
            return parseInt(vs, 10);
        }
    }
    return 0;
}
function bootstrapVariantFromTemplate(template) {
    return template.Parameters?.[bootstrap_props_1.BOOTSTRAP_VARIANT_PARAMETER]?.Default ?? bootstrap_props_1.DEFAULT_BOOTSTRAP_VARIANT;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LWJvb3RzdHJhcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGxveS1ib290c3RyYXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBbUpBLG9FQWVDO0FBRUQsb0VBRUM7QUF0S0QseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwwRUFBOEQ7QUFDOUQsNENBQXNGO0FBQ3RGLCtCQUErQjtBQUMvQix1REFNMkI7QUFDM0IseUNBQXlDO0FBRXpDLGtEQUFnSDtBQUNoSCxvRUFBZ0Y7QUFDaEYseUNBQXNDO0FBQ3RDLGtEQUEwRTtBQUUxRTs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBYSxjQUFjO0lBQ2xCLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQXdCLEVBQUUsV0FBd0IsRUFBRSxnQkFBeUI7UUFDdEcsZ0JBQWdCLEdBQUcsZ0JBQWdCLElBQUkseUNBQTBCLENBQUM7UUFFbEUsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM5RSxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsRUFBRSxXQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFFekYsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLDBCQUFXLENBQUMsTUFBTSxDQUFDLG1CQUFtQixFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRWhHLE9BQU8sSUFBSSxjQUFjLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxtQkFBbUIsRUFBRSxnQkFBZ0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3pHLENBQUM7SUFFRCxZQUNtQixXQUF3QixFQUN4QixHQUFRLEVBQ1IsbUJBQWdDLEVBQ2hDLGdCQUF3QixFQUN4QixrQkFBK0I7UUFKL0IsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDeEIsUUFBRyxHQUFILEdBQUcsQ0FB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QWdIQztBQUVELFNBQWdCLDRCQUE0QixDQUFDLFFBQWE7SUFDeEQsTUFBTSxjQUFjLEdBQUc7UUFDckIsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLDBDQUF3QixDQUFDLEVBQUUsS0FBSztRQUNuRCxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsNENBQTBCLENBQUMsRUFBRSxVQUFVLEVBQUUsS0FBSztLQUNwRSxDQUFDO0lBRUYsS0FBSyxNQUFNLEVBQUUsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNoQyxJQUFJLE9BQU8sRUFBRSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzNCLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3ZELE9BQU8sUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxQixDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVELFNBQWdCLDRCQUE0QixDQUFDLFFBQWE7SUFDeEQsT0FBTyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsNkNBQTJCLENBQUMsRUFBRSxPQUFPLElBQUksMkNBQXlCLENBQUM7QUFDbEcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBBcnRpZmFjdFR5cGUgfSBmcm9tICdAYXdzLWNkay9jbG91ZC1hc3NlbWJseS1zY2hlbWEnO1xuaW1wb3J0IHsgQ2xvdWRBc3NlbWJseUJ1aWxkZXIsIEVudmlyb25tZW50LCBFbnZpcm9ubWVudFV0aWxzIH0gZnJvbSAnQGF3cy1jZGsvY3gtYXBpJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCB7XG4gIEJPT1RTVFJBUF9WQVJJQU5UX1BBUkFNRVRFUixcbiAgQk9PVFNUUkFQX1ZFUlNJT05fT1VUUFVULFxuICBCT09UU1RSQVBfVkVSU0lPTl9SRVNPVVJDRSxcbiAgQm9vdHN0cmFwRW52aXJvbm1lbnRPcHRpb25zLFxuICBERUZBVUxUX0JPT1RTVFJBUF9WQVJJQU5ULFxufSBmcm9tICcuL2Jvb3RzdHJhcC1wcm9wcyc7XG5pbXBvcnQgKiBhcyBsb2dnaW5nIGZyb20gJy4uLy4uL2xvZ2dpbmcnO1xuaW1wb3J0IHR5cGUgeyBTREssIFNka1Byb3ZpZGVyIH0gZnJvbSAnLi4vYXdzLWF1dGgnO1xuaW1wb3J0IHsgYXNzZXJ0SXNTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQsIGRlcGxveVN0YWNrLCBTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQgfSBmcm9tICcuLi9kZXBsb3ktc3RhY2snO1xuaW1wb3J0IHsgTm9Cb290c3RyYXBTdGFja0Vudmlyb25tZW50UmVzb3VyY2VzIH0gZnJvbSAnLi4vZW52aXJvbm1lbnQtcmVzb3VyY2VzJztcbmltcG9ydCB7IE1vZGUgfSBmcm9tICcuLi9wbHVnaW4vbW9kZSc7XG5pbXBvcnQgeyBERUZBVUxUX1RPT0xLSVRfU1RBQ0tfTkFNRSwgVG9vbGtpdEluZm8gfSBmcm9tICcuLi90b29sa2l0LWluZm8nO1xuXG4vKipcbiAqIEEgY2xhc3MgdG8gaG9sZCBzdGF0ZSBhcm91bmQgc3RhY2sgYm9vdHN0cmFwcGluZ1xuICpcbiAqIFRoaXMgY2xhc3MgZXhpc3RzIHNvIHdlIGNhbiBicmVhayBib290c3RyYXBwaW5nIGludG8gMiBwaGFzZXM6XG4gKlxuICogYGBgdHNcbiAqIGNvbnN0IGN1cnJlbnQgPSBCb290c3RyYXBTdGFjay5sb29rdXAoLi4uKTtcbiAqIC8vIC4uLlxuICogY3VycmVudC51cGRhdGUobmV3VGVtcGxhdGUsIC4uLik7XG4gKiBgYGBcbiAqXG4gKiBBbmQgZG8gc29tZXRoaW5nIGluIGJldHdlZW4gdGhlIHR3byBwaGFzZXMgKHN1Y2ggYXMgbG9vayBhdCB0aGVcbiAqIGN1cnJlbnQgYm9vdHN0cmFwIHN0YWNrIGFuZCBkb2luZyBzb21ldGhpbmcgaW50ZWxsaWdlbnQpLlxuICovXG5leHBvcnQgY2xhc3MgQm9vdHN0cmFwU3RhY2sge1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGxvb2t1cChzZGtQcm92aWRlcjogU2RrUHJvdmlkZXIsIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCwgdG9vbGtpdFN0YWNrTmFtZT86IHN0cmluZykge1xuICAgIHRvb2xraXRTdGFja05hbWUgPSB0b29sa2l0U3RhY2tOYW1lID8/IERFRkFVTFRfVE9PTEtJVF9TVEFDS19OQU1FO1xuXG4gICAgY29uc3QgcmVzb2x2ZWRFbnZpcm9ubWVudCA9IGF3YWl0IHNka1Byb3ZpZGVyLnJlc29sdmVFbnZpcm9ubWVudChlbnZpcm9ubWVudCk7XG4gICAgY29uc3Qgc2RrID0gKGF3YWl0IHNka1Byb3ZpZGVyLmZvckVudmlyb25tZW50KHJlc29sdmVkRW52aXJvbm1lbnQsIE1vZGUuRm9yV3JpdGluZykpLnNkaztcblxuICAgIGNvbnN0IGN1cnJlbnRUb29sa2l0SW5mbyA9IGF3YWl0IFRvb2xraXRJbmZvLmxvb2t1cChyZXNvbHZlZEVudmlyb25tZW50LCBzZGssIHRvb2xraXRTdGFja05hbWUpO1xuXG4gICAgcmV0dXJuIG5ldyBCb290c3RyYXBTdGFjayhzZGtQcm92aWRlciwgc2RrLCByZXNvbHZlZEVudmlyb25tZW50LCB0b29sa2l0U3RhY2tOYW1lLCBjdXJyZW50VG9vbGtpdEluZm8pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2RrUHJvdmlkZXI6IFNka1Byb3ZpZGVyLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2RrOiBTREssXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXNvbHZlZEVudmlyb25tZW50OiBFbnZpcm9ubWVudCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHRvb2xraXRTdGFja05hbWU6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGN1cnJlbnRUb29sa2l0SW5mbzogVG9vbGtpdEluZm8sXG4gICkge31cblxuICBwdWJsaWMgZ2V0IHBhcmFtZXRlcnMoKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRvb2xraXRJbmZvLmZvdW5kID8gdGhpcy5jdXJyZW50VG9vbGtpdEluZm8uYm9vdHN0cmFwU3RhY2sucGFyYW1ldGVycyA6IHt9O1xuICB9XG5cbiAgcHVibGljIGdldCB0ZXJtaW5hdGlvblByb3RlY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRvb2xraXRJbmZvLmZvdW5kID8gdGhpcy5jdXJyZW50VG9vbGtpdEluZm8uYm9vdHN0cmFwU3RhY2sudGVybWluYXRpb25Qcm90ZWN0aW9uIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHBhcnRpdGlvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5zZGsuY3VycmVudEFjY291bnQoKSkucGFydGl0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gdGhlIGFjdHVhbCBkZXBsb3ltZW50IG9mIGEgYm9vdHN0cmFwIHN0YWNrLCBnaXZlbiBhIHRlbXBsYXRlIGFuZCBzb21lIHBhcmFtZXRlcnNcbiAgICovXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUoXG4gICAgdGVtcGxhdGU6IGFueSxcbiAgICBwYXJhbWV0ZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+LFxuICAgIG9wdGlvbnM6IE9taXQ8Qm9vdHN0cmFwRW52aXJvbm1lbnRPcHRpb25zLCAncGFyYW1ldGVycyc+LFxuICApOiBQcm9taXNlPFN1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdD4ge1xuICAgIGlmICh0aGlzLmN1cnJlbnRUb29sa2l0SW5mby5mb3VuZCAmJiAhb3B0aW9ucy5mb3JjZSkge1xuICAgICAgLy8gU2FmZXR5IGNoZWNrc1xuICAgICAgY29uc3QgYWJvcnRSZXNwb25zZSA9IHtcbiAgICAgICAgdHlwZTogJ2RpZC1kZXBsb3ktc3RhY2snLFxuICAgICAgICBub09wOiB0cnVlLFxuICAgICAgICBvdXRwdXRzOiB7fSxcbiAgICAgICAgc3RhY2tBcm46IHRoaXMuY3VycmVudFRvb2xraXRJbmZvLmJvb3RzdHJhcFN0YWNrLnN0YWNrSWQsXG4gICAgICB9IHNhdGlzZmllcyBTdWNjZXNzZnVsRGVwbG95U3RhY2tSZXN1bHQ7XG5cbiAgICAgIC8vIFZhbGlkYXRlIHRoYXQgdGhlIGJvb3RzdHJhcCBzdGFjayB3ZSdyZSB0cnlpbmcgdG8gcmVwbGFjZSBpcyBmcm9tIHRoZSBzYW1lIHZhcmlhbnQgYXMgdGhlIG9uZSB3ZSdyZSB0cnlpbmcgdG8gZGVwbG95XG4gICAgICBjb25zdCBjdXJyZW50VmFyaWFudCA9IHRoaXMuY3VycmVudFRvb2xraXRJbmZvLnZhcmlhbnQ7XG4gICAgICBjb25zdCBuZXdWYXJpYW50ID0gYm9vdHN0cmFwVmFyaWFudEZyb21UZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gICAgICBpZiAoY3VycmVudFZhcmlhbnQgIT09IG5ld1ZhcmlhbnQpIHtcbiAgICAgICAgbG9nZ2luZy53YXJuaW5nKFxuICAgICAgICAgIGBCb290c3RyYXAgc3RhY2sgYWxyZWFkeSBleGlzdHMsIGNvbnRhaW5pbmcgJyR7Y3VycmVudFZhcmlhbnR9Jy4gTm90IG92ZXJ3cml0aW5nIGl0IHdpdGggYSB0ZW1wbGF0ZSBjb250YWluaW5nICcke25ld1ZhcmlhbnR9JyAodXNlIC0tZm9yY2UgaWYgeW91IGludGVuZCB0byBvdmVyd3JpdGUpYCxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGFib3J0UmVzcG9uc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFZhbGlkYXRlIHRoYXQgd2UncmUgbm90IGRvd25ncmFkaW5nIHRoZSBib290c3RyYXAgc3RhY2tcbiAgICAgIGNvbnN0IG5ld1ZlcnNpb24gPSBib290c3RyYXBWZXJzaW9uRnJvbVRlbXBsYXRlKHRlbXBsYXRlKTtcbiAgICAgIGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gdGhpcy5jdXJyZW50VG9vbGtpdEluZm8udmVyc2lvbjtcbiAgICAgIGlmIChuZXdWZXJzaW9uIDwgY3VycmVudFZlcnNpb24pIHtcbiAgICAgICAgbG9nZ2luZy53YXJuaW5nKFxuICAgICAgICAgIGBCb290c3RyYXAgc3RhY2sgYWxyZWFkeSBhdCB2ZXJzaW9uICR7Y3VycmVudFZlcnNpb259LiBOb3QgZG93bmdyYWRpbmcgaXQgdG8gdmVyc2lvbiAke25ld1ZlcnNpb259ICh1c2UgLS1mb3JjZSBpZiB5b3UgaW50ZW5kIHRvIGRvd25ncmFkZSlgLFxuICAgICAgICApO1xuICAgICAgICBpZiAobmV3VmVyc2lvbiA9PT0gMCkge1xuICAgICAgICAgIC8vIEEgZG93bmdyYWRlIHdpdGggMCBhcyB0YXJnZXQgdmVyc2lvbiBtZWFucyB3ZSBwcm9iYWJseSBoYXZlIGEgbmV3LXN0eWxlIGJvb3RzdHJhcCBpbiB0aGUgYWNjb3VudCxcbiAgICAgICAgICAvLyBhbmQgYW4gb2xkLXN0eWxlIGJvb3RzdHJhcCBhcyBjdXJyZW50IHRhcmdldCwgd2hpY2ggbWVhbnMgdGhlIHVzZXIgcHJvYmFibHkgZm9yZ290IHRvIHB1dCB0aGlzIGZsYWcgaW4uXG4gICAgICAgICAgbG9nZ2luZy53YXJuaW5nKFwiKERpZCB5b3Ugc2V0IHRoZSAnQGF3cy1jZGsvY29yZTpuZXdTdHlsZVN0YWNrU3ludGhlc2lzJyBmZWF0dXJlIGZsYWcgaW4gY2RrLmpzb24/KVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWJvcnRSZXNwb25zZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBvdXRkaXIgPSBhd2FpdCBmcy5ta2R0ZW1wKHBhdGguam9pbihvcy50bXBkaXIoKSwgJ2Nkay1ib290c3RyYXAnKSk7XG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyBDbG91ZEFzc2VtYmx5QnVpbGRlcihvdXRkaXIpO1xuICAgIGNvbnN0IHRlbXBsYXRlRmlsZSA9IGAke3RoaXMudG9vbGtpdFN0YWNrTmFtZX0udGVtcGxhdGUuanNvbmA7XG4gICAgYXdhaXQgZnMud3JpdGVKc29uKHBhdGguam9pbihidWlsZGVyLm91dGRpciwgdGVtcGxhdGVGaWxlKSwgdGVtcGxhdGUsIHtcbiAgICAgIHNwYWNlczogMixcbiAgICB9KTtcblxuICAgIGJ1aWxkZXIuYWRkQXJ0aWZhY3QodGhpcy50b29sa2l0U3RhY2tOYW1lLCB7XG4gICAgICB0eXBlOiBBcnRpZmFjdFR5cGUuQVdTX0NMT1VERk9STUFUSU9OX1NUQUNLLFxuICAgICAgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50VXRpbHMuZm9ybWF0KHRoaXMucmVzb2x2ZWRFbnZpcm9ubWVudC5hY2NvdW50LCB0aGlzLnJlc29sdmVkRW52aXJvbm1lbnQucmVnaW9uKSxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgdGVtcGxhdGVGaWxlLFxuICAgICAgICB0ZXJtaW5hdGlvblByb3RlY3Rpb246IG9wdGlvbnMudGVybWluYXRpb25Qcm90ZWN0aW9uID8/IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFzc2VtYmx5ID0gYnVpbGRlci5idWlsZEFzc2VtYmx5KCk7XG5cbiAgICBjb25zdCByZXQgPSBhd2FpdCBkZXBsb3lTdGFjayh7XG4gICAgICBzdGFjazogYXNzZW1ibHkuZ2V0U3RhY2tCeU5hbWUodGhpcy50b29sa2l0U3RhY2tOYW1lKSxcbiAgICAgIHJlc29sdmVkRW52aXJvbm1lbnQ6IHRoaXMucmVzb2x2ZWRFbnZpcm9ubWVudCxcbiAgICAgIHNkazogdGhpcy5zZGssXG4gICAgICBzZGtQcm92aWRlcjogdGhpcy5zZGtQcm92aWRlcixcbiAgICAgIGZvcmNlOiBvcHRpb25zLmZvcmNlLFxuICAgICAgcm9sZUFybjogb3B0aW9ucy5yb2xlQXJuLFxuICAgICAgdGFnczogb3B0aW9ucy50YWdzLFxuICAgICAgZGVwbG95bWVudE1ldGhvZDogeyBtZXRob2Q6ICdjaGFuZ2Utc2V0JywgZXhlY3V0ZTogb3B0aW9ucy5leGVjdXRlIH0sXG4gICAgICBwYXJhbWV0ZXJzLFxuICAgICAgdXNlUHJldmlvdXNQYXJhbWV0ZXJzOiBvcHRpb25zLnVzZVByZXZpb3VzUGFyYW1ldGVycyA/PyB0cnVlLFxuICAgICAgLy8gT2J2aW91c2x5IHdlIGNhbid0IG5lZWQgYSBib290c3RyYXAgc3RhY2sgdG8gZGVwbG95IGEgYm9vdHN0cmFwIHN0YWNrXG4gICAgICBlbnZSZXNvdXJjZXM6IG5ldyBOb0Jvb3RzdHJhcFN0YWNrRW52aXJvbm1lbnRSZXNvdXJjZXModGhpcy5yZXNvbHZlZEVudmlyb25tZW50LCB0aGlzLnNkayksXG4gICAgfSk7XG5cbiAgICBhc3NlcnRJc1N1Y2Nlc3NmdWxEZXBsb3lTdGFja1Jlc3VsdChyZXQpO1xuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYm9vdHN0cmFwVmVyc2lvbkZyb21UZW1wbGF0ZSh0ZW1wbGF0ZTogYW55KTogbnVtYmVyIHtcbiAgY29uc3QgdmVyc2lvblNvdXJjZXMgPSBbXG4gICAgdGVtcGxhdGUuT3V0cHV0cz8uW0JPT1RTVFJBUF9WRVJTSU9OX09VVFBVVF0/LlZhbHVlLFxuICAgIHRlbXBsYXRlLlJlc291cmNlcz8uW0JPT1RTVFJBUF9WRVJTSU9OX1JFU09VUkNFXT8uUHJvcGVydGllcz8uVmFsdWUsXG4gIF07XG5cbiAgZm9yIChjb25zdCB2cyBvZiB2ZXJzaW9uU291cmNlcykge1xuICAgIGlmICh0eXBlb2YgdnMgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gdnM7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdnMgPT09ICdzdHJpbmcnICYmICFpc05hTihwYXJzZUludCh2cywgMTApKSkge1xuICAgICAgcmV0dXJuIHBhcnNlSW50KHZzLCAxMCk7XG4gICAgfVxuICB9XG4gIHJldHVybiAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYm9vdHN0cmFwVmFyaWFudEZyb21UZW1wbGF0ZSh0ZW1wbGF0ZTogYW55KTogc3RyaW5nIHtcbiAgcmV0dXJuIHRlbXBsYXRlLlBhcmFtZXRlcnM/LltCT09UU1RSQVBfVkFSSUFOVF9QQVJBTUVURVJdPy5EZWZhdWx0ID8/IERFRkFVTFRfQk9PVFNUUkFQX1ZBUklBTlQ7XG59XG4iXX0=