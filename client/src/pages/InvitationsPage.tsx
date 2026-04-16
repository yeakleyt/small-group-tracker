import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Mail, Copy, CheckCircle, Clock, AlertCircle, Users, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Invitation, Group } from "@/lib/types";

export function InvitationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", groupId: "", groupRole: "member" });
  const [copied, setCopied] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({ queryKey: ["/api/invitations"] });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/invitations", {
      email: data.email,
      groupId: (data.groupId && data.groupId !== "none") ? data.groupId : undefined,
      groupRole: data.groupRole,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invitations"] });
      setOpen(false);
      setForm({ email: "", groupId: "", groupRole: "member" });
      toast({ title: "Invitation created", description: "Share the link with the invitee." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/invitations/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invitations"] });
      setDeleteTarget(null);
      toast({ title: "Invitation removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  function copyInviteLink(inv: Invitation) {
    const url = `${window.location.origin}/#/invite/${inv.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(inv.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function getStatus(inv: Invitation): { label: string; variant: "default" | "secondary" | "destructive"; icon: any } {
    if (inv.isUsed) return { label: "Used", variant: "secondary", icon: CheckCircle };
    if (new Date(inv.expiresAt) < new Date()) return { label: "Expired", variant: "destructive", icon: AlertCircle };
    return { label: "Pending", variant: "default", icon: Clock };
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Invitations</h1>
          <p className="text-sm text-muted-foreground">Manage and create invitation links</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="button-create-invitation">
              <Plus className="h-4 w-4" />New Invitation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Invitation</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Email Address *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="invitee@example.com" data-testid="input-invite-email" />
              </div>
              <div className="space-y-1.5">
                <Label>Invite to Group (optional)</Label>
                <Select value={form.groupId} onValueChange={v => setForm(f => ({ ...f, groupId: v }))}>
                  <SelectTrigger><SelectValue placeholder="App access only" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">App access only</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.groupId && form.groupId !== "none" && (
                <div className="space-y-1.5">
                  <Label>Group Role</Label>
                  <Select value={form.groupRole} onValueChange={v => setForm(f => ({ ...f, groupRole: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="group_admin">Group Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
                The invitation link is valid for 7 days and can only be used once.
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Create Invitation</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Mail className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-sm">No invitations yet</p>
            <p className="text-xs text-muted-foreground">Create an invitation to add users to the app or a group.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invitations.map(inv => {
            const status = getStatus(inv);
            const StatusIcon = status.icon;
            const group = groups.find(g => g.id === inv.groupId);
            return (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4 border rounded-lg bg-card" data-testid={`row-invitation-${inv.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {group ? (
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{group.name} · {inv.groupRole}</span>
                      ) : (
                        <span>App access only</span>
                      )}
                      <span>Expires {format(parseISO(inv.expiresAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={status.variant} className="gap-1 text-xs">
                    <StatusIcon className="h-3 w-3" />{status.label}
                  </Badge>
                  {!inv.isUsed && new Date(inv.expiresAt) > new Date() && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyInviteLink(inv)} data-testid={`button-copy-invite-${inv.id}`}>
                      {copied === inv.id ? <><CheckCircle className="h-3 w-3 text-green-600" />Copied</> : <><Copy className="h-3 w-3" />Copy Link</>}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => setDeleteTarget(inv.id)}
                    data-testid={`button-delete-invite-${inv.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the invitation. The link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
