"use client";

import { useCallback, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { authClient } from "@/app/lib/auth-client";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type ShareModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspaceSlug?: string;
  workspaceId?: string;
};

/**
 * Owns its own state: the link, the workspace invitation and the failure text
 * are meaningless anywhere else, and both requests are addressed by ids alone.
 */
export function ShareModal({
  isOpen,
  onOpenChange,
  projectId,
  workspaceSlug,
  workspaceId,
}: ShareModalProps) {
  const [shareLink, setShareLink] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [workspaceInviteLink, setWorkspaceInviteLink] = useState("");
  const [workspaceInviteBusy, setWorkspaceInviteBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const copyText = useCallback(
    async (value: string, message = "Link copied.") => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(message);
      } catch {
        setShareError(
          "Clipboard access failed. Select and copy the link manually.",
        );
        toast.error("Clipboard access failed.");
      }
    },
    [],
  );

  const generateShareLink = async () => {
    setShareBusy(true);
    setShareError("");
    try {
      const query = workspaceSlug
        ? `?workspace=${encodeURIComponent(workspaceSlug)}`
        : "";
      const response = await fetch(`/api/projects/${projectId}/share${query}`, {
        method: "POST",
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url)
        throw new Error(body.error || "Could not create project link.");
      setShareLink(body.url);
      await copyText(body.url);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create project link.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  const inviteToWorkspace = async () => {
    if (!workspaceSlug || !workspaceEmail.trim()) return;
    setWorkspaceInviteBusy(true);
    setShareError("");
    try {
      await (authClient.organization as any).setActive({
        organizationSlug: workspaceSlug,
      });
      const result = await (authClient.organization as any).inviteMember({
        organizationId: workspaceId,
        email: workspaceEmail.trim(),
        role: "member",
      });
      if (result.error || !result.data?.id)
        throw new Error(
          result.error?.message || "Could not create workspace invitation.",
        );
      const url = `${window.location.origin}/invite/${result.data.id}`;
      setWorkspaceInviteLink(url);
      await copyText(url);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create workspace invitation.",
      );
    } finally {
      setWorkspaceInviteBusy(false);
    }
  };

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this diagram.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Project invite link</FieldLabel>
            <FieldDescription>
              Anyone with the link can preview the project. Sign-in is required
              to edit.
            </FieldDescription>
            {shareLink ? (
              <div className="flex gap-2">
                <Input
                  aria-label="Project invite link"
                  value={shareLink}
                  readOnly
                />
                <Button
                  variant="outline"
                  onClick={() => void copyText(shareLink)}
                >
                  <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                  Copy
                </Button>
              </div>
            ) : (
              <Button
                className="self-start"
                isDisabled={shareBusy}
                onClick={() => void generateShareLink()}
              >
                {shareBusy ? "Generating…" : "Generate invite link"}
              </Button>
            )}
            {shareLink && (
              <Button
                variant="outline"
                className="self-start"
                isDisabled={shareBusy}
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke and generate new link
              </Button>
            )}
          </Field>
          {workspaceSlug && (
            <Field>
              <FieldLabel>Invite to workspace</FieldLabel>
              <FieldDescription>
                Send a single-use invitation to a workspace member.
              </FieldDescription>
              <div className="flex gap-2">
                <Input
                  aria-label="Invitee email"
                  type="email"
                  placeholder="person@example.com"
                  value={workspaceEmail}
                  onChange={(event) => setWorkspaceEmail(event.target.value)}
                />
                <Button
                  isDisabled={workspaceInviteBusy || !workspaceEmail.trim()}
                  onClick={() => void inviteToWorkspace()}
                >
                  {workspaceInviteBusy ? "Generating…" : "Generate link"}
                </Button>
              </div>
              {workspaceInviteLink && (
                <div className="flex gap-2">
                  <Input
                    aria-label="Workspace invitation link"
                    value={workspaceInviteLink}
                    readOnly
                  />
                  <Button
                    variant="outline"
                    onClick={() => void copyText(workspaceInviteLink)}
                  >
                    <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                    Copy
                  </Button>
                </div>
              )}
            </Field>
          )}
          {shareError && (
            <Alert variant="destructive">
              <AlertTitle>{shareError}</AlertTitle>
            </Alert>
          )}
        </FieldGroup>
      </Dialog>

      <AlertDialog isOpen={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
          <AlertDialogDescription>
            The current link stops working immediately and a new one is
            generated in its place.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmRevoke(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmRevoke(false);
              void generateShareLink();
            }}
          >
            Revoke and generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
