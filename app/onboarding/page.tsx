"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { slugify } from "@/app/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function OnboardingPage() { const router = useRouter(); const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [error, setError] = useState(""); const submit = async (event: FormEvent) => { event.preventDefault(); const result = await authClient.organization.create({ name, slug: slug || slugify(name) }); if (result.error) setError(result.error.message || "Could not create workspace"); else router.push(`/${result.data?.slug || slugify(name)}`); }; return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><h1>Create a workspace</h1><Input placeholder="Workspace name" value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(slugify(event.target.value)); }} required /><Input placeholder="Slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /><Button type="submit">Continue</Button>{error && <p className="error-text">{error}</p>}</form></main>; }
