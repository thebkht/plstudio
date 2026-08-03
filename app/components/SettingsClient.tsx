"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function SettingsClient({ workspace, organizationName, canManage }: { workspace: string; organizationName: string; canManage: boolean }) {
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      await authClient.organization.setActive({ organizationSlug: workspace });
      const result = await (authClient.organization as any).listMembers({ query: { organizationSlug: workspace } });
      setMembers(result.data?.members || []);
      if (result.error) setMessage(result.error.message || "Could not load workspace members.");
    })();
  }, [workspace]);

  const invite = async () => {
    const result = await (authClient.organization as any).inviteMember({ email: email.trim(), role: "member" });
    if (result.data?.id) {
      const url = `${window.location.origin}/invite/${result.data.id}`;
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Invitation link copied.");
      } catch {
        setMessage(url);
      }
    } else setMessage(result.error?.message || "Could not create invitation.");
  };

  return <section className="settings-card"><h2>{organizationName} members</h2>{members.map((member) => <p key={member.id}>{member.user?.name || member.user?.email} · {member.role}</p>)}{canManage && <><Input placeholder="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><Button onPress={invite}>Copy invitation link</Button></>}{message && <p>{message}</p>}</section>;
}
