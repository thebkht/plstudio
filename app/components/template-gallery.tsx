"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseIcon, GitForkIcon, Layout01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { makeDemoSchema, type Schema } from "@/app/lib/schema";
import BrandMark from "@/app/components/brand-mark";
import SchemaPreview from "@/app/components/schema-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const templates = [
  { name: "Student enrollment", description: "A compact relational model for courses, students, and enrollment.", accent: "#175e7a", kind: "Education" },
  { name: "Commerce starter", description: "Products, customers, orders, and the relationships between them.", accent: "#6360f7", kind: "Commerce" },
  { name: "Team workspace", description: "A foundation for users, teams, projects, and collaboration.", accent: "#e8617d", kind: "Product" },
];

/* Drawn from the schema the template actually creates, rather than a fixed
   USERS/ORDERS sketch unrelated to any of them. All three currently share
   makeDemoSchema(), so all three previews match — the templates differ only by
   name and accent today. */
function Preview() { return <div className="template-preview"><SchemaPreview schema={makeDemoSchema()} /></div>; }

export default function TemplateGallery({ workspace }: { workspace?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const useTemplate = async (name: string) => { setBusy(name); const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(workspace ? { workspace } : {}), name }) }); if (response.ok) { const created = await response.json() as { id: string }; const schema = makeDemoSchema() as Schema; schema.id = created.id; schema.name = name; const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""; const saved = await fetch(`/api/projects/${created.id}${query}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ schema, overwrite: true }) }); if (saved.ok) router.push(workspace ? `/${workspace}/${created.id}` : `/project/${created.id}`); } setBusy(null); };
  const homeHref = workspace ? `/${workspace}` : "/";
  return (
    <main className="templates-page">
      <header className="templates-header">
        <Link href={homeHref} className="brand-link" aria-label="PLStudio home">
          <BrandMark />
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <div className="templates-title">
          <HugeiconsIcon icon={Layout01Icon} /> Templates
        </div>
        <Link data-slot="button" className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-auto" })} href={homeHref}>
          Back to projects
        </Link>
      </header>
      <section className="templates-intro">
        <p className="section-kicker">Start with a strong foundation</p>
        <h1>Database schema templates</h1>
        <p>A collection of practical diagrams to give your next project a quick start or a little inspiration.</p>
      </section>
      <Tabs defaultSelectedKey="default" className="templates-tabs">
        <TabsList variant="line">
          <TabsTrigger id="default">Default templates</TabsTrigger>
          <TabsTrigger id="yours" isDisabled>Your templates</TabsTrigger>
        </TabsList>
        <TabsContent id="default">
          <section className="template-grid">
            {templates.map((template) => (
              <Card className="template-card" key={template.name}>
                <Preview />
                <CardHeader>
                  <CardDescription>{template.kind}</CardDescription>
                  <CardTitle>{template.name}</CardTitle>
                  <CardAction>
                    <HugeiconsIcon icon={DatabaseIcon} />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p>{template.description}</p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" isDisabled={busy !== null} onPress={() => void useTemplate(template.name)}>
                    {busy === template.name ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <HugeiconsIcon icon={GitForkIcon} data-icon="inline-start" />
                    )}
                    {busy === template.name ? "Creating…" : "Use template"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </section>
        </TabsContent>
        <TabsContent id="yours">
          <Badge variant="secondary">Coming soon</Badge>
        </TabsContent>
      </Tabs>
      <footer className="templates-footer">PLStudio · Visual Oracle schema design</footer>
    </main>
  );
}
