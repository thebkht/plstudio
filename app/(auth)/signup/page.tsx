"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function SignupPage() { const router = useRouter(); const [error, setError] = useState(""); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const result = await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) }); if (result.error) setError(result.error.message || "Could not sign up"); else router.push("/"); }; return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><h1>Create your account</h1><Input name="name" placeholder="Name" required /><Input name="email" type="email" placeholder="Email" required /><Input name="password" type="password" placeholder="Password" minLength={8} required /><Button type="submit">Sign up</Button>{error && <p className="error-text">{error}</p>}<p>Already have an account? <Link href="/login">Sign in</Link></p></form></main>; }
