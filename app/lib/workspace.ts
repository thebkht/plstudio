export type WorkspaceRole = "owner" | "admin" | "member";
export function slugify(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, ""); }
export function canManageMembers(role: string): role is "owner" | "admin" { return role === "owner" || role === "admin"; }
export function canDeleteProject(role: string): role is WorkspaceRole { return role === "owner" || role === "admin"; }

/** Roles an actor may hand out — only an owner can mint another owner. */
export function assignableRoles(actorRole: string): WorkspaceRole[] { return actorRole === "owner" ? ["owner", "admin", "member"] : actorRole === "admin" ? ["admin", "member"] : []; }

/** Mirrors the organization plugin's server check: no self-demotion, and admins cannot touch owners. */
export function canChangeMemberRole(actorRole: string, targetRole: string, isSelf: boolean) { return !isSelf && canManageMembers(actorRole) && (actorRole === "owner" || targetRole !== "owner"); }

export function canManageProjectShare(userId: string, createdBy: string | null, role: string) {
  return createdBy === userId || role === "owner" || role === "admin";
}
