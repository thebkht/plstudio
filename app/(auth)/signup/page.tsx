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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// `useSearchParams` needs a boundary above it, or prerendering the route fails.
export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}

function SignupForm() {
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("redirect"));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const result = await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) });
    if (result.error) { setError(result.error.message || "Could not sign up"); setPending(false); }
    else router.push(next);
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        {/* The form is the card's only child, so it has to carry the card's
            own column gap — otherwise header/content/footer collapse together. */}
        <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
          <CardHeader>
            <CardTitle className="text-xl tracking-[-0.02em]">Create your account</CardTitle>
            <CardDescription className="leading-relaxed">Start modeling Oracle schemas visually.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" required />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={error ? true : undefined} required />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} aria-invalid={error ? true : undefined} required />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <Field>
                <Button type="submit" size="lg" isDisabled={pending}>{pending ? "Creating account…" : "Sign up"}</Button>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="auth-footer">
            <p>Already have an account? <Link href={next === "/" ? "/login" : `/login?redirect=${encodeURIComponent(next)}`}>Sign in</Link></p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
