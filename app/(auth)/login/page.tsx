"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
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

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
    if (result.error) setError(result.error.message || "Could not sign in");
    else router.push(new URLSearchParams(window.location.search).get("redirect") || "/");
  };
  const guest = async () => {
    const result = await authClient.signIn.anonymous();
    if (result.error) setError(result.error.message || "Could not continue as guest");
    else router.push("/");
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your DrawSQL account.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={error ? true : undefined} required />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={error ? true : undefined} required />
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <Field>
                <Button type="submit">Sign in</Button>
                <Button type="button" variant="outline" onPress={guest}>Continue as guest</Button>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <p>New here? <Link href="/signup">Create an account</Link></p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
