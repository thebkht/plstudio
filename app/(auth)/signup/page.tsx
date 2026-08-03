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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) });
    if (result.error) setError(result.error.message || "Could not sign up");
    else router.push("/");
  };
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Start modeling Oracle schemas visually.</CardDescription>
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
                <Button type="submit">Sign up</Button>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <p>Already have an account? <Link href="/login">Sign in</Link></p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
