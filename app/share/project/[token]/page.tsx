import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Designer from "@/app/components/designer";
import { findProjectByShareToken } from "@/app/lib/project-share";
import { auth } from "@/app/lib/auth";
import { type Schema } from "@/app/lib/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await findProjectByShareToken(token);
  if (!shared) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <>
      {!session && (
        <Alert className="share-readonly-banner">
          <AlertTitle>Read-only preview</AlertTitle>
          <AlertDescription>
            <Link href={`/login?redirect=/share/project/${token}`}>Sign in to edit</Link>
          </AlertDescription>
        </Alert>
      )}
      <main className="app-shell"><Designer initialSchema={shared.project.schemaJson as Schema} projectId={shared.project.id} shareToken={token} readOnly={!session} user={session ? { id: session.user.id, name: session.user.name, image: session.user.image } : null} /></main>
    </>
  );
}
