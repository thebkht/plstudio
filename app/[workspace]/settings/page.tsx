import Link from "next/link";
import { requireWorkspace } from "@/app/lib/session";
import { canManageMembers } from "@/app/lib/workspace";
import SettingsClient from "@/app/components/SettingsClient";
export default async function SettingsPage({ params }: { params: Promise<{ workspace: string }> }) { const { workspace } = await params; const { organization, role } = await requireWorkspace(workspace); return <main className="dashboard-shell"><Link href={`/${workspace}`}>← Back to projects</Link><h1>Workspace settings</h1><SettingsClient workspace={workspace} organizationName={organization.name} canManage={canManageMembers(role)} /></main>; }
