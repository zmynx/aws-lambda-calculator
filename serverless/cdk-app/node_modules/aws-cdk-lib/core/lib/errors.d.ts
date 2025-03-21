import { IConstruct } from 'constructs';
/**
 * Helper to check if an error is a SynthesisErrors
 */
export declare class Errors {
    /**
     * Test whether the given errors is a ConstructionError
     */
    static isConstructError(x: any): x is ConstructError;
    /**
     * Test whether the given error is a ValidationError
     */
    static isValidationError(x: any): x is ValidationError;
}
interface ConstructInfo {
    readonly fqn: string;
    readonly version: string;
}
/**
 * Generic, abstract error that is thrown from the users app during app construction or synth.
 */
declare abstract class ConstructError extends Error {
    #private;
    /**
     * The time the error was thrown.
     */
    get time(): string;
    /**
     * The level. Always `'error'`.
     */
    get level(): 'error';
    /**
     * The type of the error.
     */
    abstract get type(): string;
    /**
     * The path of the construct this error is thrown from, if available.
     */
    get constructPath(): string | undefined;
    /**
     * Information on the construct this error is thrown from, if available.
     */
    get constructInfo(): ConstructInfo | undefined;
    constructor(msg: string, scope?: IConstruct);
    /**
     * Helper message to clean-up the stack and amend with construct information.
     */
    private constructStack;
}
/**
 * An Error that is thrown when a construct has validation errors.
 */
export declare class ValidationError extends ConstructError {
    get type(): 'validation';
    constructor(msg: string, scope: IConstruct);
}
export {};
