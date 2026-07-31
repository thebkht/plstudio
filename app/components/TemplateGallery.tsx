"use client";

import { useState } from "react";
import { ArrowRight, Database, GitFork, LayoutTemplate } from "lucide-react";
import { useRouter } from "next/navigation";
import { makeDemoSchema, type Schema } from "@/app/lib/schema";
import BrandMark from "@/app/components/BrandMark";

const templates = [
  { name: "Student enrollment", description: "A compact relational model for courses, students, and enrollment.", accent: "#175e7a", kind: "Education" },
  { name: "Commerce starter", description: "Products, customers, orders, and the relationships between them.", accent: "#6360f7", kind: "Commerce" },
  { name: "Team workspace", description: "A foundation for users, teams, projects, and collaboration.", accent: "#e8617d", kind: "Product" },
];

function Preview({ accent }: { accent: string }) { return <div className="template-preview"><div className="preview-grid" /><div className="preview-table preview-table-one" style={{ borderTopColor: accent }}><b>USERS</b><span>ID <em>NUMBER</em></span><span>EMAIL <em>VARCHAR2</em></span><span>STATUS <em>CHAR</em></span></div><div className="preview-table preview-table-two" style={{ borderTopColor: accent }}><b>ORDERS</b><span>ID <em>NUMBER</em></span><span>USER_ID <em>NUMBER</em></span></div><div className="preview-connection" style={{ background: accent }} /></div>; }

export default function TemplateGallery({ workspace }: { workspace: string }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null);
  const useTemplate = async (name: string, index: number) => { setBusy(name); const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace, name }) }); if (response.ok) { const created = await response.json() as { id: string }; const schema = makeDemoSchema() as Schema; schema.id = created.id; schema.name = name; const saved = await fetch(`/api/projects/${created.id}?workspace=${encodeURIComponent(workspace)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ schema, overwrite: true }) }); if (saved.ok) router.push(`/${workspace}/${created.id}`); } setBusy(null); };
  return <main className="templates-page"><header className="templates-header"><a href={`/${workspace}`} className="brand-link"><BrandMark /></a><div className="templates-title"><LayoutTemplate size={18} /> Templates</div><a className="templates-back" href={`/${workspace}`}>Back to workspace</a></header><section className="templates-intro"><p className="section-kicker">Start with a strong foundation</p><h1>Database schema templates</h1><p>A collection of practical diagrams to give your next project a quick start or a little inspiration.</p></section><div className="template-tabs"><button className="active" type="button">Default templates</button><button type="button" disabled>Your templates</button></div><section className="template-grid">{templates.map((template, index) => <article className="template-card" key={template.name}><Preview accent={template.accent} /><div className="template-card-copy"><div className="template-meta"><span>{template.kind}</span><Database size={14} /></div><h2>{template.name}</h2><p>{template.description}</p><button className="template-action" type="button" disabled={busy !== null} onClick={() => void useTemplate(template.name, index)}>{busy === template.name ? "Creating…" : "Use template"}<GitFork size={15} /></button></div></article>)}</section><footer className="templates-footer">DrawSQL · Visual Oracle schema design</footer></main>;
}
