"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function NewProjectButton({ workspace }: { workspace: string }) { const router = useRouter(); return <Button onPress={async () => { const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace, name: "Untitled Diagram" }) }); if (response.ok) { const schema = await response.json(); router.push(`/${workspace}/${schema.id}`); } }}>New project</Button>; }
