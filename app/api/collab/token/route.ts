import { documentNameFor, signCollabToken } from "@/app/lib/collab/token";
import { findProjectByShareToken } from "@/app/lib/project-share";
import { requirePersonalProjectAccess, requireProjectAccess, requireSession } from "@/app/lib/session";

/**
 * Mints a short-lived token for one collab room. Every access decision is made
 * here, by the same helpers the REST routes use — the websocket server verifies
 * the signature and trusts the verdict rather than querying membership itself.
 */export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return Response.json({ error: "projectId is required" }, { status: 400 });

    const secret = process.env.COLLAB_TOKEN_SECRET;
    if (!secret) return Response.json({ error: "Collaboration is not configured" }, { status: 503 });

    const shareToken = url.searchParams.get("shareToken");
    const workspace = url.searchParams.get("workspace");

    const access = await (async () => {
      if (shareToken) {
        const session = await requireSession();
        const shared = await findProjectByShareToken(shareToken);
        if (!shared || shared.project.id !== projectId) throw new Response("Invalid project share link", { status: 403 });
        return { session, readOnly: shared.share.permission !== "editor" };
      }
      const granted = workspace ? await requireProjectAccess(workspace, projectId) : await requirePersonalProjectAccess(projectId);
      return { session: granted.session, readOnly: false };
    })();

    return Response.json({
      token: signCollabToken({
        sub: access.session.user.id,
        name: access.session.user.name,
        image: access.session.user.image ?? null,
        documentName: documentNameFor(projectId),
        readOnly: access.readOnly,
      }, secret),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: error instanceof Error ? error.message : "Could not authorize" }, { status: 403 });
  }
}
