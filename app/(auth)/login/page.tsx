"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function LoginPage() { const router = useRouter(); const [error, setError] = useState(""); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) }); if (result.error) setError(result.error.message || "Could not sign in"); else router.push(new URLSearchParams(window.location.search).get("redirect") || "/"); }; const guest = async () => { const result = await authClient.signIn.anonymous(); if (result.error) setError(result.error.message || "Could not continue as guest"); else router.push("/"); }; return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><h1>Welcome back</h1><Input name="email" type="email" placeholder="Email" required /><Input name="password" type="password" placeholder="Password" required /><Button type="submit">Sign in</Button><Button type="button" variant="outline" onPress={guest}>Continue as guest</Button>{error && <p className="error-text">{error}</p>}<p>New here? <Link href="/signup">Create an account</Link></p></form></main>; }
