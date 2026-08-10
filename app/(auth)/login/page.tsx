"use client";
import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// `useSearchParams` needs a boundary above it, or prerendering the route fails.
export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirect(params.get("redirect"));
  const reset = params.get("reset") === "1";
  const [error, setError] = useState("");
  // Held through the redirect too: clearing it on success flashes the idle
  // label for a frame before the route changes.
  const [pending, setPending] = useState<"" | "signin" | "guest">("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending("signin");
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
    if (result.error) { setError(result.error.message || "Could not sign in"); setPending(""); }
    else router.push(next);
  };
  const guest = async () => {
    setPending("guest");
    const result = await authClient.signIn.anonymous();
    if (result.error) { setError(result.error.message || "Could not continue as guest"); setPending(""); }
    else router.push(next);
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        {/* The form is the card's only child, so it has to carry the card's
            own column gap — otherwise header/content/footer collapse together. */}
        <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your PLStudio account.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={error ? true : undefined} required />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <div className="auth-label-row">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link href={next === "/" ? "/forgot-password" : `/forgot-password?redirect=${encodeURIComponent(next)}`}>Forgot password?</Link>
                </div>
                <Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={error ? true : undefined} required />
              </Field>
              {reset && !error && (
                <Alert>
                  <AlertTitle>Password updated. Sign in with your new password.</AlertTitle>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <Field className="gap-2.5">
                <Button type="submit" size="lg" isDisabled={pending !== ""}>{pending === "signin" ? "Signing in…" : "Sign in"}</Button>
                <Button type="button" size="lg" variant="outline" isDisabled={pending !== ""} onPress={guest}>{pending === "guest" ? "Starting…" : "Continue as guest"}</Button>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <p>New here? <Link href={next === "/" ? "/signup" : `/signup?redirect=${encodeURIComponent(next)}`}>Create an account</Link></p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
