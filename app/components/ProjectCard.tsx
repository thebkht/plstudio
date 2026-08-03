"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProjectCard({ projectId, href, name, tableCount, updatedAt, workspace, canDelete = true }: { projectId: string; href: string; name: string; tableCount: number; updatedAt: string; workspace?: string; canDelete?: boolean }) {
  const router = useRouter();
  const remove = async () => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
    const response = await fetch(`/api/projects/${projectId}${query}`, { method: "DELETE" });
    if (response.ok) router.refresh(); else window.alert("This project could not be deleted.");
  };
  return <article className="project-card"><Link href={href} className="project-card-link"><span className="project-card-preview" aria-hidden="true" /><h2>{name}</h2><p>{tableCount} tables</p><small>Updated {updatedAt}</small></Link>{canDelete && <button className="project-card-delete" type="button" aria-label={`Delete ${name}`} onClick={() => void remove()}><HugeiconsIcon icon={Delete02Icon} size={14} /></button>}</article>;
}
