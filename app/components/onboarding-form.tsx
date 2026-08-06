"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/app/lib/auth-client";
import { slugify } from "@/app/lib/workspace";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Reached both as first-run onboarding and as "New workspace" from the switcher,
 * so `hasWorkspaces` only changes the wording and whether there is somewhere to
 * go back to — a user may create as many as the plugin's organizationLimit.
 */
export default function OnboardingForm({ hasWorkspaces }: { hasWorkspaces: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const wanted = slug || slugify(name);
    const result = await authClient.organization.create({ name, slug: wanted });
    if (result.error) {
      // Slugs are unique across every account, not just this one, so a plain
      // name like "acme" is often already spoken for.
      setError(/slug/i.test(result.error.message || "") ? `The slug "${wanted}" is taken — try another.` : result.error.message || "Could not create workspace");
      setBusy(false);
      return;
    }
    const created = result.data?.slug || wanted;
    // Land in the new workspace with it already active, so member management and
    // invitations there do not need a second round-trip to catch up.
    await authClient.organization.setActive({ organizationSlug: created });
    router.push(`/${created}`);
  };

  return (
    <Card className="auth-card">
      <form onSubmit={submit}>
        <CardHeader>
          <CardTitle>{hasWorkspaces ? "Create another workspace" : "Create a workspace"}</CardTitle>
          <CardDescription>Workspaces let you share diagrams with your team. You can belong to as many as you like.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slug) setSlug(slugify(event.target.value));
                }}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-slug">Slug</FieldLabel>
              <Input id="workspace-slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required />
              <FieldDescription>Used in the workspace URL.</FieldDescription>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <Field className="flex-row gap-2">
              <Button type="submit" isDisabled={busy || !name.trim()}>{busy ? "Creating…" : "Continue"}</Button>
              {hasWorkspaces && <Link data-slot="button" className={buttonVariants({ variant: "outline" })} href="/">Cancel</Link>}
            </Field>
          </FieldGroup>
        </CardContent>
      </form>
    </Card>
  );
}
