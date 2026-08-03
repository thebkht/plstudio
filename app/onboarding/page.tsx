"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { slugify } from "@/app/lib/workspace";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await authClient.organization.create({ name, slug: slug || slugify(name) });
    if (result.error) setError(result.error.message || "Could not create workspace");
    else router.push(`/${result.data?.slug || slugify(name)}`);
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>Create a workspace</CardTitle>
            <CardDescription>Workspaces let you share diagrams with your team.</CardDescription>
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
              <Field>
                <Button type="submit">Continue</Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>
    </main>
  );
}
