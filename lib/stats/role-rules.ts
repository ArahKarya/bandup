export type AppRole = "USER" | "ADMIN";

export type RoleChangeVerdict = "ok" | "unchanged" | "self" | "last_admin";

export interface RoleChange {
  actorId: string;
  targetId: string;
  currentRole: AppRole;
  nextRole: AppRole;
  /** Admins in the system right now, including the target. */
  adminCount: number;
}

/**
 * Guards admin role changes. An admin may not demote themselves (they would lock
 * themselves out mid-session) and the last admin can never be demoted, so an install is
 * never left without anyone able to manage it.
 */
export function checkRoleChange(c: RoleChange): RoleChangeVerdict {
  if (c.currentRole === c.nextRole) return "unchanged";
  if (c.nextRole === "USER") {
    if (c.actorId === c.targetId) return "self";
    if (c.currentRole === "ADMIN" && c.adminCount <= 1) return "last_admin";
  }
  return "ok";
}
