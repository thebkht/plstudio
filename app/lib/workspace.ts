export type WorkspaceRole = "owner" | "admin" | "member";
export function slugify(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, ""); }
export function canManageMembers(role: string): role is "owner" | "admin" { return role === "owner" || role === "admin"; }
export function canDeleteProject(role: string): role is WorkspaceRole { return role === "owner" || role === "admin"; }

export function canManageProjectShare(userId: string, createdBy: string | null, role: string) {
  return createdBy === userId || role === "owner" || role === "admin";
}
