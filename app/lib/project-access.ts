import { requirePersonalProjectAccess, requireProjectAccess, requireSession } from "@/app/lib/session";
import { findProjectByShareToken } from "@/app/lib/project-share";

/**
 * Who may touch a project through the REST routes, decided the same way for
 * each of them: an editor share link, a workspace membership (`?workspace=`),
 * or ownership of a personal project. Throws the `Response` to return when the
 * answer is no, which every route passes straight through.
 */
export async function projectAccess(request: Request, id: string) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken");
  if (shareToken) {
    const session = await requireSession();
    const shared = await findProjectByShareToken(shareToken);
    if (!shared || shared.project.id !== id || shared.share.permission !== "editor") throw new Response("Invalid project share link", { status: 403 });
    return { session, project: shared.project, role: "member" as const, shareToken };
  }
  const workspace = url.searchParams.get("workspace");
  return workspace ? requireProjectAccess(workspace, id) : requirePersonalProjectAccess(id);
}
