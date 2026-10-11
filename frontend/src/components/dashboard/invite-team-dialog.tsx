"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Organization, TeamInvitation } from "@/types";

interface InviteTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugFromName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "team"}-${Date.now().toString(36)}`;
}

export function InviteTeamDialog({ open, onOpenChange }: InviteTeamDialogProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [orgName, setOrgName] = useState("");

  const {
    data: organization,
    isLoading: orgLoading,
    isError,
  } = useQuery<Organization | null>({
    queryKey: ["organization", "current"],
    queryFn: async () => {
      try {
        return await api.getCurrentOrganization();
      } catch {
        return null;
      }
    },
    enabled: open,
  });

  const needsOrg = !orgLoading && (isError || !organization);

  const createOrgMutation = useMutation({
    mutationFn: async () => {
      const name = orgName.trim();
      if (!name) {
        throw new Error("Organization name is required");
      }
      return api.createOrganization({ name, slug: slugFromName(name) });
    },
    onSuccess: (created) => {
      queryClient.setQueryData(["organization", "current"], created);
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Workspace created");
    },
    onError: () => {
      toast.error("Could not create a workspace");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      let org = organization || createOrgMutation.data;
      if (!org) {
        const name = orgName.trim();
        if (!name) {
          throw new Error("Organization name is required");
        }
        org = await createOrgMutation.mutateAsync();
      }
      return api.sendInvitation(org.id, email.trim(), role);
    },
    onSuccess: (invitation: TeamInvitation) => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success(`Invitation sent to ${invitation.email}`);
      setEmail("");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send invitation";
      toast.error(message);
    },
  });

  const canInvite = useMemo(() => {
    return email.includes("@") && Boolean(organization || createOrgMutation.data);
  }, [createOrgMutation.data, email, organization]);

  const handleSubmit = async () => {
    inviteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite teammates
          </DialogTitle>
          <DialogDescription>
            Send an email invite to join your workspace. They will need an account with the same email to accept.
          </DialogDescription>
        </DialogHeader>

        {orgLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {needsOrg && !createOrgMutation.data && (
              <div className="space-y-2">
                <Label htmlFor="org-name">Workspace name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Design"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  You don&apos;t have a workspace yet. Create one to send team invites.
                </p>
              </div>
            )}

            {(organization || createOrgMutation.data) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Inviting to{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {(organization || createOrgMutation.data)?.name}
                </span>
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value: "ADMIN" | "MEMBER") => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={
              orgLoading ||
              inviteMutation.isPending ||
              createOrgMutation.isPending ||
              !email.includes("@") ||
              (needsOrg && !orgName.trim() && !canInvite)
            }
          >
            {(inviteMutation.isPending || createOrgMutation.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
