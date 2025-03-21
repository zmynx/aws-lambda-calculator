import { ICloudFormationClient } from '../../lib';
import { CloudFormationStack, Template } from '../../lib/api/util/cloudformation';
import { StackStatus } from '../../lib/api/util/cloudformation/stack-status';
export interface FakeCloudFormationStackProps {
    readonly stackName: string;
    readonly stackId?: string;
    readonly stackStatus?: string;
}
export declare class FakeCloudformationStack extends CloudFormationStack {
    readonly client: ICloudFormationClient;
    private readonly props;
    private __template;
    constructor(props: FakeCloudFormationStackProps);
    setTemplate(template: Template): void;
    template(): Promise<Template>;
    get exists(): boolean;
    get stackStatus(): StackStatus;
    get stackId(): string;
    get outputs(): Record<string, string>;
}
