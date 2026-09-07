import { describe, expect, it } from "vitest";

import { ApplicationError } from "./application-error";
import { ERROR_CODES } from "./error-code";

describe("ApplicationError", () => {
  it("preserves the application error code and message", () => {
    const error = new ApplicationError(
      ERROR_CODES.NOT_FOUND,
      "Resource not found",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe("ApplicationError");
    expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(error.message).toBe("Resource not found");
  });
});