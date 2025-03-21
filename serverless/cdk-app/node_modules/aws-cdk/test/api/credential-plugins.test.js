"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const credential_plugins_1 = require("../../lib/api/aws-auth/credential-plugins");
const plugin_1 = require("../../lib/api/plugin");
const mode_1 = require("../../lib/api/plugin/mode");
test('returns credential from plugin', async () => {
    // GIVEN
    const creds = {
        accessKeyId: 'aaa',
        secretAccessKey: 'bbb',
        getPromise: () => Promise.resolve(),
    };
    const host = plugin_1.PluginHost.instance;
    host.registerCredentialProviderSource({
        name: 'Fake',
        canProvideCredentials(_accountId) {
            return Promise.resolve(true);
        },
        isAvailable() {
            return Promise.resolve(true);
        },
        getProvider(_accountId, _mode) {
            return Promise.resolve(creds);
        },
    });
    const plugins = new credential_plugins_1.CredentialPlugins();
    // WHEN
    const pluginCredentials = await plugins.fetchCredentialsFor('aaa', mode_1.Mode.ForReading);
    // THEN
    await expect(pluginCredentials?.credentials()).resolves.toEqual(expect.objectContaining({
        accessKeyId: 'aaa',
        secretAccessKey: 'bbb',
    }));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlZGVudGlhbC1wbHVnaW5zLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjcmVkZW50aWFsLXBsdWdpbnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLGtGQUE4RTtBQUM5RSxpREFBa0Q7QUFDbEQsb0RBQWlEO0FBRWpELElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxLQUFLLElBQUksRUFBRTtJQUNoRCxRQUFRO0lBQ1IsTUFBTSxLQUFLLEdBQUc7UUFDWixXQUFXLEVBQUUsS0FBSztRQUNsQixlQUFlLEVBQUUsS0FBSztRQUN0QixVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtLQUNDLENBQUM7SUFDdkMsTUFBTSxJQUFJLEdBQUcsbUJBQVUsQ0FBQyxRQUFRLENBQUM7SUFFakMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDO1FBQ3BDLElBQUksRUFBRSxNQUFNO1FBRVoscUJBQXFCLENBQUMsVUFBa0I7WUFDdEMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxXQUFXO1lBQ1QsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxXQUFXLENBQUMsVUFBa0IsRUFBRSxLQUFXO1lBQ3pDLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoQyxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxzQ0FBaUIsRUFBRSxDQUFDO0lBRXhDLE9BQU87SUFDUCxNQUFNLGlCQUFpQixHQUFHLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxXQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFcEYsT0FBTztJQUNQLE1BQU0sTUFBTSxDQUFDLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFDdEYsV0FBVyxFQUFFLEtBQUs7UUFDbEIsZUFBZSxFQUFFLEtBQUs7S0FDdkIsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgUGx1Z2luUHJvdmlkZXJSZXN1bHQsIFNES3YyQ29tcGF0aWJsZUNyZWRlbnRpYWxzIH0gZnJvbSAnQGF3cy1jZGsvY2xpLXBsdWdpbi1jb250cmFjdCc7XG5pbXBvcnQgeyBDcmVkZW50aWFsUGx1Z2lucyB9IGZyb20gJy4uLy4uL2xpYi9hcGkvYXdzLWF1dGgvY3JlZGVudGlhbC1wbHVnaW5zJztcbmltcG9ydCB7IFBsdWdpbkhvc3QgfSBmcm9tICcuLi8uLi9saWIvYXBpL3BsdWdpbic7XG5pbXBvcnQgeyBNb2RlIH0gZnJvbSAnLi4vLi4vbGliL2FwaS9wbHVnaW4vbW9kZSc7XG5cbnRlc3QoJ3JldHVybnMgY3JlZGVudGlhbCBmcm9tIHBsdWdpbicsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgY29uc3QgY3JlZHMgPSB7XG4gICAgYWNjZXNzS2V5SWQ6ICdhYWEnLFxuICAgIHNlY3JldEFjY2Vzc0tleTogJ2JiYicsXG4gICAgZ2V0UHJvbWlzZTogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCksXG4gIH0gc2F0aXNmaWVzIFNES3YyQ29tcGF0aWJsZUNyZWRlbnRpYWxzO1xuICBjb25zdCBob3N0ID0gUGx1Z2luSG9zdC5pbnN0YW5jZTtcblxuICBob3N0LnJlZ2lzdGVyQ3JlZGVudGlhbFByb3ZpZGVyU291cmNlKHtcbiAgICBuYW1lOiAnRmFrZScsXG5cbiAgICBjYW5Qcm92aWRlQ3JlZGVudGlhbHMoX2FjY291bnRJZDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuICAgIH0sXG5cbiAgICBpc0F2YWlsYWJsZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG4gICAgfSxcblxuICAgIGdldFByb3ZpZGVyKF9hY2NvdW50SWQ6IHN0cmluZywgX21vZGU6IE1vZGUpOiBQcm9taXNlPFBsdWdpblByb3ZpZGVyUmVzdWx0PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNyZWRzKTtcbiAgICB9LFxuICB9KTtcblxuICBjb25zdCBwbHVnaW5zID0gbmV3IENyZWRlbnRpYWxQbHVnaW5zKCk7XG5cbiAgLy8gV0hFTlxuICBjb25zdCBwbHVnaW5DcmVkZW50aWFscyA9IGF3YWl0IHBsdWdpbnMuZmV0Y2hDcmVkZW50aWFsc0ZvcignYWFhJywgTW9kZS5Gb3JSZWFkaW5nKTtcblxuICAvLyBUSEVOXG4gIGF3YWl0IGV4cGVjdChwbHVnaW5DcmVkZW50aWFscz8uY3JlZGVudGlhbHMoKSkucmVzb2x2ZXMudG9FcXVhbChleHBlY3Qub2JqZWN0Q29udGFpbmluZyh7XG4gICAgYWNjZXNzS2V5SWQ6ICdhYWEnLFxuICAgIHNlY3JldEFjY2Vzc0tleTogJ2JiYicsXG4gIH0pKTtcbn0pO1xuIl19