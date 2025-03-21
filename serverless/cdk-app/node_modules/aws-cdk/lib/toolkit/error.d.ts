/**
 * Represents a general toolkit error in the AWS CDK Toolkit.
 */
declare class ToolkitError extends Error {
    /**
     * Determines if a given error is an instance of ToolkitError.
     */
    static isToolkitError(x: any): x is ToolkitError;
    /**
     * Determines if a given error is an instance of AuthenticationError.
     */
    static isAuthenticationError(x: any): x is AuthenticationError;
    /**
     * The type of the error, defaults to "toolkit".
     */
    readonly type: string;
    constructor(message: string, type?: string);
}
/**
 * Represents an authentication-specific error in the AWS CDK Toolkit.
 */
declare class AuthenticationError extends ToolkitError {
    constructor(message: string);
}
export { ToolkitError, AuthenticationError };
