"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parse_command_line_arguments_1 = require("../lib/parse-command-line-arguments");
test('cdk deploy -R sets rollback to false', async () => {
    const argv = await (0, parse_command_line_arguments_1.parseCommandLineArguments)(['deploy', '-R']);
    expect(argv.rollback).toBe(false);
});
describe('cdk docs', () => {
    const originalPlatform = process.platform;
    // Helper to mock process.platform
    const mockPlatform = (platform) => {
        Object.defineProperty(process, 'platform', {
            value: platform,
            writable: false,
            enumerable: true,
            configurable: true,
        });
    };
    // Restore original platform after each test
    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            writable: false,
            enumerable: true,
            configurable: true,
        });
    });
    test.each([
        ['darwin', 'open %u'],
        ['win32', 'start %u'],
        ['linux', 'xdg-open %u'],
        ['freebsd', 'xdg-open %u'],
    ])('for %s should return "%s"', async (platform, browser) => {
        mockPlatform(platform);
        const argv = await (0, parse_command_line_arguments_1.parseCommandLineArguments)(['docs']);
        expect(argv.browser).toBe(browser);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2UtY29tbWFuZC1saW5lLWFyZ3VtZW50cy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGFyc2UtY29tbWFuZC1saW5lLWFyZ3VtZW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsc0ZBQWdGO0FBRWhGLElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxLQUFLLElBQUksRUFBRTtJQUN0RCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUEsd0RBQXlCLEVBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMvRCxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwQyxDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFO0lBQ3hCLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUMxQyxrQ0FBa0M7SUFDbEMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7UUFDeEMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFO1lBQ3pDLEtBQUssRUFBRSxRQUFRO1lBQ2YsUUFBUSxFQUFFLEtBQUs7WUFDZixVQUFVLEVBQUUsSUFBSTtZQUNoQixZQUFZLEVBQUUsSUFBSTtTQUNuQixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRiw0Q0FBNEM7SUFDNUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtRQUNiLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRTtZQUN6QyxLQUFLLEVBQUUsZ0JBQWdCO1lBQ3ZCLFFBQVEsRUFBRSxLQUFLO1lBQ2YsVUFBVSxFQUFFLElBQUk7WUFDaEIsWUFBWSxFQUFFLElBQUk7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ1IsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO1FBQ3JCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQztRQUNyQixDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7UUFDeEIsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDO0tBQzNCLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQzFELFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLElBQUksR0FBRyxNQUFNLElBQUEsd0RBQXlCLEVBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXJzZUNvbW1hbmRMaW5lQXJndW1lbnRzIH0gZnJvbSAnLi4vbGliL3BhcnNlLWNvbW1hbmQtbGluZS1hcmd1bWVudHMnO1xuXG50ZXN0KCdjZGsgZGVwbG95IC1SIHNldHMgcm9sbGJhY2sgdG8gZmFsc2UnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGFyZ3YgPSBhd2FpdCBwYXJzZUNvbW1hbmRMaW5lQXJndW1lbnRzKFsnZGVwbG95JywgJy1SJ10pO1xuICBleHBlY3QoYXJndi5yb2xsYmFjaykudG9CZShmYWxzZSk7XG59KTtcblxuZGVzY3JpYmUoJ2NkayBkb2NzJywgKCkgPT4ge1xuICBjb25zdCBvcmlnaW5hbFBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgLy8gSGVscGVyIHRvIG1vY2sgcHJvY2Vzcy5wbGF0Zm9ybVxuICBjb25zdCBtb2NrUGxhdGZvcm0gPSAocGxhdGZvcm06IHN0cmluZykgPT4ge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9jZXNzLCAncGxhdGZvcm0nLCB7XG4gICAgICB2YWx1ZTogcGxhdGZvcm0sXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIH0pO1xuICB9O1xuXG4gIC8vIFJlc3RvcmUgb3JpZ2luYWwgcGxhdGZvcm0gYWZ0ZXIgZWFjaCB0ZXN0XG4gIGFmdGVyRWFjaCgoKSA9PiB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb2Nlc3MsICdwbGF0Zm9ybScsIHtcbiAgICAgIHZhbHVlOiBvcmlnaW5hbFBsYXRmb3JtLFxuICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdC5lYWNoKFtcbiAgICBbJ2RhcndpbicsICdvcGVuICV1J10sXG4gICAgWyd3aW4zMicsICdzdGFydCAldSddLFxuICAgIFsnbGludXgnLCAneGRnLW9wZW4gJXUnXSxcbiAgICBbJ2ZyZWVic2QnLCAneGRnLW9wZW4gJXUnXSxcbiAgXSkoJ2ZvciAlcyBzaG91bGQgcmV0dXJuIFwiJXNcIicsIGFzeW5jIChwbGF0Zm9ybSwgYnJvd3NlcikgPT4ge1xuICAgIG1vY2tQbGF0Zm9ybShwbGF0Zm9ybSk7XG4gICAgY29uc3QgYXJndiA9IGF3YWl0IHBhcnNlQ29tbWFuZExpbmVBcmd1bWVudHMoWydkb2NzJ10pO1xuICAgIGV4cGVjdChhcmd2LmJyb3dzZXIpLnRvQmUoYnJvd3Nlcik7XG4gIH0pO1xufSk7XG4iXX0=