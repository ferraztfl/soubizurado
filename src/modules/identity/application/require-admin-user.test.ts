import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isBootstrapAdminCandidate,
} from "./require-admin-user";

describe(
  "isBootstrapAdminCandidate",
  () => {
    it(
      "accepts the configured confirmed email",
      () => {
        expect(
          isBootstrapAdminCandidate({
            configuredEmail:
              "admin@example.com",
            userEmail:
              "ADMIN@example.com",
            emailConfirmed:
              true,
          }),
        ).toBe(true);
      },
    );

    it(
      "rejects an unconfirmed email",
      () => {
        expect(
          isBootstrapAdminCandidate({
            configuredEmail:
              "admin@example.com",
            userEmail:
              "admin@example.com",
            emailConfirmed:
              false,
          }),
        ).toBe(false);
      },
    );

    it(
      "rejects a different email",
      () => {
        expect(
          isBootstrapAdminCandidate({
            configuredEmail:
              "admin@example.com",
            userEmail:
              "student@example.com",
            emailConfirmed:
              true,
          }),
        ).toBe(false);
      },
    );

    it(
      "rejects when bootstrap is not configured",
      () => {
        expect(
          isBootstrapAdminCandidate({
            configuredEmail:
              undefined,
            userEmail:
              "admin@example.com",
            emailConfirmed:
              true,
          }),
        ).toBe(false);
      },
    );
  },
);