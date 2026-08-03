"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/app/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type Invitation = { id: string; email: string; organization?: { slug?: string } };
type InviteState = {
  loading: boolean;
  invite?: Invitation;
  /** Set when the signed-in account is not the invited address. */
  mismatch?: boolean;
  message?: string;
};

export default function InvitePage({ params }: { params: Promise<{ invitationId: string }> }) {
  const router = useRouter();
  const [state, setState] = useState<InviteState>({ loading: true });
  useEffect(() => {
    void params.then(async ({ invitationId }) => {
      const invite = await (authClient.organization as any).getInvitation({ query: { id: invitationId } });
      const session = await authClient.getSession();
      if (invite.error) setState({ loading: false, message: "This invitation is expired, cancelled, or already accepted." });
      else if (!session.data) setState({ loading: false, invite: invite.data, message: "Sign in with the invited email to continue." });
      else if (session.data.user.email.toLowerCase() !== invite.data.email.toLowerCase()) setState({ loading: false, invite: invite.data, mismatch: true, message: `This invitation is for ${invite.data.email}.` });
      else setState({ loading: false, invite: invite.data });
    });
  }, [params]);

  const accept = async () => {
    if (!state.invite) return;
    const result = await (authClient.organization as any).acceptInvitation({ invitationId: state.invite.id });
    if (result.error) setState({ ...state, message: result.error.message });
    else router.push(`/${state.invite.organization?.slug || ""}`);
  };
  const decline = async () => {
    if (!state.invite) return;
    const result = await (authClient.organization as any).rejectInvitation({ invitationId: state.invite.id });
    setState({ ...state, message: result.error?.message || "Invitation declined." });
  };

  if (state.loading)
    return (
      <main className="auth-shell">
        <Spinner />
        <p>Loading invitation…</p>
      </main>
    );

  const needsSignIn = state.message?.startsWith("Sign in");
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
          {state.message && <CardDescription>{state.message}</CardDescription>}
        </CardHeader>
        <CardContent className="flex gap-2">
          {state.invite && !state.mismatch &&
            (needsSignIn ? (
              <Link className={buttonVariants()} href={`/login?redirect=/invite/${state.invite.id}`}>Sign in</Link>
            ) : (
              <>
                <Button onPress={accept}>Accept invitation</Button>
                <Button variant="outline" onPress={decline}>Decline</Button>
              </>
            ))}
          {state.mismatch && state.invite && (
            <Link className={buttonVariants()} href={`/login?redirect=/invite/${state.invite.id}`}>Sign in as the invited account</Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
