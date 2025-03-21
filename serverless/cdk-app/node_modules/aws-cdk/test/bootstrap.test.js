"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_environment_1 = require("../lib/api/bootstrap/bootstrap-environment");
const cli_1 = require("../lib/cli");
beforeEach(() => {
    jest.clearAllMocks();
});
describe('cdk bootstrap', () => {
    const bootstrapEnvironmentMock = jest.spyOn(bootstrap_environment_1.Bootstrapper.prototype, 'bootstrapEnvironment');
    test('will bootstrap the a provided environment', async () => {
        bootstrapEnvironmentMock.mockResolvedValueOnce({
            noOp: false,
            outputs: {},
            type: 'did-deploy-stack',
            stackArn: 'fake-arn',
        });
        await (0, cli_1.exec)(['bootstrap', 'aws://123456789012/us-east-1']);
        expect(bootstrapEnvironmentMock).toHaveBeenCalledTimes(1);
        expect(bootstrapEnvironmentMock).toHaveBeenCalledWith({
            name: 'aws://123456789012/us-east-1',
            account: '123456789012',
            region: 'us-east-1',
        }, expect.anything(), expect.anything());
    });
});
describe('cdk bootstrap --show-template', () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => { return true; });
    test('prints the default bootstrap template', async () => {
        await (0, cli_1.exec)(['bootstrap', '--show-template']);
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('BootstrapVersion'));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJib290c3RyYXAudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNGQUEwRTtBQUMxRSxvQ0FBa0M7QUFFbEMsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztBQUN2QixDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQzdCLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxvQ0FBWSxDQUFDLFNBQVMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0lBRTVGLElBQUksQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMzRCx3QkFBd0IsQ0FBQyxxQkFBcUIsQ0FBQztZQUM3QyxJQUFJLEVBQUUsS0FBSztZQUNYLE9BQU8sRUFBRSxFQUFFO1lBQ1gsSUFBSSxFQUFFLGtCQUFrQjtZQUN4QixRQUFRLEVBQUUsVUFBVTtTQUNyQixDQUFDLENBQUM7UUFFSCxNQUFNLElBQUEsVUFBSSxFQUFDLENBQUMsV0FBVyxFQUFFLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztZQUNwRCxJQUFJLEVBQUUsOEJBQThCO1lBQ3BDLE9BQU8sRUFBRSxjQUFjO1lBQ3ZCLE1BQU0sRUFBRSxXQUFXO1NBQ3BCLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsK0JBQStCLEVBQUUsR0FBRyxFQUFFO0lBQzdDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWpHLElBQUksQ0FBQyx1Q0FBdUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN2RCxNQUFNLElBQUEsVUFBSSxFQUFDLENBQUMsV0FBVyxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQztRQUM3QyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztJQUN0RixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQm9vdHN0cmFwcGVyIH0gZnJvbSAnLi4vbGliL2FwaS9ib290c3RyYXAvYm9vdHN0cmFwLWVudmlyb25tZW50JztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICcuLi9saWIvY2xpJztcblxuYmVmb3JlRWFjaCgoKSA9PiB7XG4gIGplc3QuY2xlYXJBbGxNb2NrcygpO1xufSk7XG5cbmRlc2NyaWJlKCdjZGsgYm9vdHN0cmFwJywgKCkgPT4ge1xuICBjb25zdCBib290c3RyYXBFbnZpcm9ubWVudE1vY2sgPSBqZXN0LnNweU9uKEJvb3RzdHJhcHBlci5wcm90b3R5cGUsICdib290c3RyYXBFbnZpcm9ubWVudCcpO1xuXG4gIHRlc3QoJ3dpbGwgYm9vdHN0cmFwIHRoZSBhIHByb3ZpZGVkIGVudmlyb25tZW50JywgYXN5bmMgKCkgPT4ge1xuICAgIGJvb3RzdHJhcEVudmlyb25tZW50TW9jay5tb2NrUmVzb2x2ZWRWYWx1ZU9uY2Uoe1xuICAgICAgbm9PcDogZmFsc2UsXG4gICAgICBvdXRwdXRzOiB7fSxcbiAgICAgIHR5cGU6ICdkaWQtZGVwbG95LXN0YWNrJyxcbiAgICAgIHN0YWNrQXJuOiAnZmFrZS1hcm4nLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgZXhlYyhbJ2Jvb3RzdHJhcCcsICdhd3M6Ly8xMjM0NTY3ODkwMTIvdXMtZWFzdC0xJ10pO1xuICAgIGV4cGVjdChib290c3RyYXBFbnZpcm9ubWVudE1vY2spLnRvSGF2ZUJlZW5DYWxsZWRUaW1lcygxKTtcbiAgICBleHBlY3QoYm9vdHN0cmFwRW52aXJvbm1lbnRNb2NrKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCh7XG4gICAgICBuYW1lOiAnYXdzOi8vMTIzNDU2Nzg5MDEyL3VzLWVhc3QtMScsXG4gICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgfSwgZXhwZWN0LmFueXRoaW5nKCksIGV4cGVjdC5hbnl0aGluZygpKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ2NkayBib290c3RyYXAgLS1zaG93LXRlbXBsYXRlJywgKCkgPT4ge1xuICBjb25zdCBzdGRvdXRTcHkgPSBqZXN0LnNweU9uKHByb2Nlc3Muc3Rkb3V0LCAnd3JpdGUnKS5tb2NrSW1wbGVtZW50YXRpb24oKCkgPT4geyByZXR1cm4gdHJ1ZTsgfSk7XG5cbiAgdGVzdCgncHJpbnRzIHRoZSBkZWZhdWx0IGJvb3RzdHJhcCB0ZW1wbGF0ZScsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleGVjKFsnYm9vdHN0cmFwJywgJy0tc2hvdy10ZW1wbGF0ZSddKTtcbiAgICBleHBlY3Qoc3Rkb3V0U3B5KS50b0hhdmVCZWVuQ2FsbGVkV2l0aChleHBlY3Quc3RyaW5nQ29udGFpbmluZygnQm9vdHN0cmFwVmVyc2lvbicpKTtcbiAgfSk7XG59KTtcbiJdfQ==