"use client";
import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeRedirect } from "@/app/lib/url";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// `useSearchParams` needs a boundary above it, or prerendering the route fails.
export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordForm /></Suspense>;
}

function ForgotPasswordForm() {
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("redirect"));
  const login = next === "/" ? "/login" : `/login?redirect=${encodeURIComponent(next)}`;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) return setError("Passwords do not match");
    setError("");
    setPending(true);
    const response = await fetch("/api/account/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: String(data.get("email")), password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Could not reset your password"); setPending(false); }
    else router.push(login.includes("?") ? `${login}&reset=1` : `${login}?reset=1`);
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        {/* The form is the card's only child, so it has to carry the card's
            own column gap — otherwise header/content/footer collapse together. */}
        <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>Set a new password for your PLStudio account.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={error ? true : undefined} required />
                <FieldDescription>This server sends no email — the new password takes effect immediately.</FieldDescription>
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">New password</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} aria-invalid={error ? true : undefined} required />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} aria-invalid={error ? true : undefined} required />
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <Field>
                <Button type="submit" size="lg" isDisabled={pending}>{pending ? "Saving…" : "Set new password"}</Button>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <p>Remembered it? <Link href={login}>Back to sign in</Link></p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
