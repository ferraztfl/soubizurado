/*
 * Guards for backoffice actions on accounts. Checked server-side before
 * anything is changed: an admin never locks themself out, and the
 * platform always keeps at least one active administrator.
 */

export type AccountAction = "GRANT_ADMIN" | "REVOKE_ADMIN" | "BLOCK" | "UNBLOCK" | "PASSWORD_RESET";

export type AccountActionRefusal = "SELF_REVOKE" | "SELF_BLOCK" | "LAST_ADMIN" | "ALREADY_ADMIN" | "NOT_ADMIN";

export type AccountActionInput = Readonly<{
  action: AccountAction;
  actorProfileId: string;
  targetProfileId: string;
  targetIsAdmin: boolean;
  /** Active (not blocked) administrators, including the target. */
  activeAdminCount: number;
}>;

export function checkAccountAction(input: AccountActionInput): AccountActionRefusal | null {
  const self = input.actorProfileId === input.targetProfileId;

  switch (input.action) {
    case "GRANT_ADMIN":
      return input.targetIsAdmin ? "ALREADY_ADMIN" : null;
    case "REVOKE_ADMIN":
      if (!input.targetIsAdmin) return "NOT_ADMIN";
      if (self) return "SELF_REVOKE";
      return input.activeAdminCount <= 1 ? "LAST_ADMIN" : null;
    case "BLOCK":
      if (self) return "SELF_BLOCK";
      return input.targetIsAdmin && input.activeAdminCount <= 1 ? "LAST_ADMIN" : null;
    case "UNBLOCK":
    case "PASSWORD_RESET":
      return null;
  }
}
