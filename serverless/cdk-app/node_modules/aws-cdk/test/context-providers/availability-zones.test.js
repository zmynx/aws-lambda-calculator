"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ec2_1 = require("@aws-sdk/client-ec2");
const lib_1 = require("../../lib");
const availability_zones_1 = require("../../lib/context-providers/availability-zones");
const mock_sdk_1 = require("../util/mock-sdk");
const mockSDK = new (class extends mock_sdk_1.MockSdkProvider {
    forEnvironment() {
        return Promise.resolve({ sdk: new lib_1.SDK(mock_sdk_1.FAKE_CREDENTIAL_CHAIN, mockSDK.defaultRegion, {}), didAssumeRole: false });
    }
})();
test('empty array as result when response has no AZs', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeAvailabilityZonesCommand).resolves({
        AvailabilityZones: undefined,
    });
    // WHEN
    const azs = await new availability_zones_1.AZContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'asdf',
    });
    // THEN
    expect(azs).toEqual([]);
});
test('returns AZs', async () => {
    // GIVEN
    mock_sdk_1.mockEC2Client.on(client_ec2_1.DescribeAvailabilityZonesCommand).resolves({
        AvailabilityZones: [{
                ZoneName: 'us-east-1a',
                State: 'available',
            }],
    });
    // WHEN
    const azs = await new availability_zones_1.AZContextProviderPlugin(mockSDK).getValue({
        account: '1234',
        region: 'asdf',
    });
    // THEN
    expect(azs).toEqual(['us-east-1a']);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXZhaWxhYmlsaXR5LXpvbmVzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdmFpbGFiaWxpdHktem9uZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG9EQUF1RTtBQUN2RSxtQ0FBbUQ7QUFDbkQsdUZBQXlGO0FBQ3pGLCtDQUF5RjtBQUV6RixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBTSxTQUFRLDBCQUFlO0lBQ3pDLGNBQWM7UUFDbkIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksU0FBRyxDQUFDLGdDQUFxQixFQUFFLE9BQU8sQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDbkgsQ0FBQztDQUNGLENBQUMsRUFBRSxDQUFDO0FBRUwsSUFBSSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssSUFBSSxFQUFFO0lBQ2hFLFFBQVE7SUFDUix3QkFBYSxDQUFDLEVBQUUsQ0FBQyw2Q0FBZ0MsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUMxRCxpQkFBaUIsRUFBRSxTQUFTO0tBQzdCLENBQUMsQ0FBQztJQUVILE9BQU87SUFDUCxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksNENBQXVCLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQzlELE9BQU8sRUFBRSxNQUFNO1FBQ2YsTUFBTSxFQUFFLE1BQU07S0FDZixDQUFDLENBQUM7SUFFSCxPQUFPO0lBQ1AsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUMsQ0FBQztBQUVILElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDN0IsUUFBUTtJQUNSLHdCQUFhLENBQUMsRUFBRSxDQUFDLDZDQUFnQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQzFELGlCQUFpQixFQUFFLENBQUM7Z0JBQ2xCLFFBQVEsRUFBRSxZQUFZO2dCQUN0QixLQUFLLEVBQUUsV0FBVzthQUNuQixDQUFDO0tBQ0gsQ0FBQyxDQUFDO0lBRUgsT0FBTztJQUNQLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSw0Q0FBdUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7UUFDOUQsT0FBTyxFQUFFLE1BQU07UUFDZixNQUFNLEVBQUUsTUFBTTtLQUNmLENBQUMsQ0FBQztJQUVILE9BQU87SUFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUN0QyxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlc2NyaWJlQXZhaWxhYmlsaXR5Wm9uZXNDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWVjMic7XG5pbXBvcnQgeyBTREssIFNka0ZvckVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vbGliJztcbmltcG9ydCB7IEFaQ29udGV4dFByb3ZpZGVyUGx1Z2luIH0gZnJvbSAnLi4vLi4vbGliL2NvbnRleHQtcHJvdmlkZXJzL2F2YWlsYWJpbGl0eS16b25lcyc7XG5pbXBvcnQgeyBGQUtFX0NSRURFTlRJQUxfQ0hBSU4sIG1vY2tFQzJDbGllbnQsIE1vY2tTZGtQcm92aWRlciB9IGZyb20gJy4uL3V0aWwvbW9jay1zZGsnO1xuXG5jb25zdCBtb2NrU0RLID0gbmV3IChjbGFzcyBleHRlbmRzIE1vY2tTZGtQcm92aWRlciB7XG4gIHB1YmxpYyBmb3JFbnZpcm9ubWVudCgpOiBQcm9taXNlPFNka0ZvckVudmlyb25tZW50PiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IHNkazogbmV3IFNESyhGQUtFX0NSRURFTlRJQUxfQ0hBSU4sIG1vY2tTREsuZGVmYXVsdFJlZ2lvbiwge30pLCBkaWRBc3N1bWVSb2xlOiBmYWxzZSB9KTtcbiAgfVxufSkoKTtcblxudGVzdCgnZW1wdHkgYXJyYXkgYXMgcmVzdWx0IHdoZW4gcmVzcG9uc2UgaGFzIG5vIEFacycsIGFzeW5jICgpID0+IHtcbiAgLy8gR0lWRU5cbiAgbW9ja0VDMkNsaWVudC5vbihEZXNjcmliZUF2YWlsYWJpbGl0eVpvbmVzQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgIEF2YWlsYWJpbGl0eVpvbmVzOiB1bmRlZmluZWQsXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgYXpzID0gYXdhaXQgbmV3IEFaQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAnYXNkZicsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KGF6cykudG9FcXVhbChbXSk7XG59KTtcblxudGVzdCgncmV0dXJucyBBWnMnLCBhc3luYyAoKSA9PiB7XG4gIC8vIEdJVkVOXG4gIG1vY2tFQzJDbGllbnQub24oRGVzY3JpYmVBdmFpbGFiaWxpdHlab25lc0NvbW1hbmQpLnJlc29sdmVzKHtcbiAgICBBdmFpbGFiaWxpdHlab25lczogW3tcbiAgICAgIFpvbmVOYW1lOiAndXMtZWFzdC0xYScsXG4gICAgICBTdGF0ZTogJ2F2YWlsYWJsZScsXG4gICAgfV0sXG4gIH0pO1xuXG4gIC8vIFdIRU5cbiAgY29uc3QgYXpzID0gYXdhaXQgbmV3IEFaQ29udGV4dFByb3ZpZGVyUGx1Z2luKG1vY2tTREspLmdldFZhbHVlKHtcbiAgICBhY2NvdW50OiAnMTIzNCcsXG4gICAgcmVnaW9uOiAnYXNkZicsXG4gIH0pO1xuXG4gIC8vIFRIRU5cbiAgZXhwZWN0KGF6cykudG9FcXVhbChbJ3VzLWVhc3QtMWEnXSk7XG59KTtcbiJdfQ==