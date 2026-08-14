"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* Equal-lightness hues, so no project's strip outweighs another's, keyed to the
   id: four diagrams all called "Untitled" are otherwise identical at a glance. */
const HUES = [28, 78, 148, 228, 288, 348];
const hueOf = (id: string) => HUES[[...id].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7) % HUES.length];

export default function ProjectCard({ projectId, href, name, tableCount, updatedAt, updatedLabel, author, workspace, canDelete = true }: { projectId: string; href: string; name: string; tableCount: number; updatedAt: string; updatedLabel: string; author?: string; workspace?: string; canDelete?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const remove = async () => {
    setConfirming(false);
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
    const response = await fetch(`/api/projects/${projectId}${query}`, { method: "DELETE" });
    if (response.ok) router.refresh();
    else toast.error("This project could not be deleted.");
  };
  return (
    <Card size="sm" className="project-card">
      <span className="project-card-strip" style={{ color: `oklch(0.62 0.11 ${hueOf(projectId)})` }} aria-hidden="true" />
      <CardHeader>
        <CardTitle>
          <Link href={href} className="project-card-link">
            {name}
          </Link>
        </CardTitle>
        <CardDescription>
          {tableCount} {tableCount === 1 ? "table" : "tables"}
        </CardDescription>
        {canDelete && (
          <CardAction>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
                <HugeiconsIcon icon={MoreVerticalIcon} />
              </Button>
              <DropdownMenu placement="bottom end" className="w-auto min-w-40">
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onAction={() => setConfirming(true)}>
                    <HugeiconsIcon icon={Delete02Icon} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenu>
            </DropdownMenuTrigger>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter>
        <small className="project-card-meta" title={updatedAt}>{author ? `${author} · ${updatedLabel}` : `Updated ${updatedLabel}`}</small>
      </CardFooter>
      <AlertDialog isOpen={confirming} onOpenChange={setConfirming}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. The diagram and its saved revisions are removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirming(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Card>
  );
}
