import { describe, expect, it } from "vitest";

import { checkAccountAction, type AccountActionInput } from "./account-admin-policy";

const base: AccountActionInput = {
  action: "REVOKE_ADMIN",
  actorProfileId: "me",
  targetProfileId: "other",
  targetIsAdmin: true,
  activeAdminCount: 2,
};

describe("checkAccountAction", () => {
  it("never lets an admin revoke or block themself", () => {
    expect(checkAccountAction({ ...base, targetProfileId: "me" })).toBe("SELF_REVOKE");
    expect(checkAccountAction({ ...base, action: "BLOCK", targetProfileId: "me" })).toBe("SELF_BLOCK");
  });

  it("keeps at least one active administrator", () => {
    expect(checkAccountAction({ ...base, activeAdminCount: 1 })).toBe("LAST_ADMIN");
    expect(checkAccountAction({ ...base, action: "BLOCK", activeAdminCount: 1 })).toBe("LAST_ADMIN");
    expect(checkAccountAction({ ...base, action: "BLOCK", targetIsAdmin: false, activeAdminCount: 1 })).toBeNull();
    expect(checkAccountAction(base)).toBeNull();
  });

  it("rejects no-op role changes", () => {
    expect(checkAccountAction({ ...base, action: "GRANT_ADMIN" })).toBe("ALREADY_ADMIN");
    expect(checkAccountAction({ ...base, targetIsAdmin: false })).toBe("NOT_ADMIN");
    expect(checkAccountAction({ ...base, action: "GRANT_ADMIN", targetIsAdmin: false })).toBeNull();
  });
});
