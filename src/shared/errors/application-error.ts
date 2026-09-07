import type { ErrorCode } from "./error-code";

export class ApplicationError extends Error {
  public readonly code: ErrorCode;

  public constructor(code: ErrorCode, message: string) {
    super(message);

    this.name = "ApplicationError";
    this.code = code;
  }
}