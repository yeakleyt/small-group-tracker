import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Search, UserCheck, UserX, KeyRound } from "lucide-react";
import type { User } from "@/lib/types";

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const roleChangeMutation = useMutation({
    mutationFn: ({ id, appRole }: { id: number; appRole: string }) =>
      apiRequest("PATCH", `/api/users/${id}/role`, { appRole }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Role updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/users/${id}/status`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiRequest("POST", `/api/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      toast({ title: "Password reset", description: "The user's password has been updated." });
      setResetTarget(null);
      setNewPassword("");
      setPwError("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openResetDialog(u: User) {
    setResetTarget(u);
    setNewPassword("");
    setPwError("");
  }

  function handleResetSubmit() {
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (!resetTarget) return;
    resetPasswordMutation.mutate({ id: resetTarget.id, password: newPassword });
  }

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />All Users</h1>
        <p className="text-sm text-muted-foreground">Manage user accounts and roles across the app</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} users</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className={`flex items-center gap-3 p-3 border rounded-lg bg-card ${!u.isActive ? "opacity-60" : ""}`} data-testid={`row-user-${u.id}`}>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {u.firstName[0]}{u.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                  {!u.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {u.id !== me?.id ? (
                  <>
                    <Select value={u.appRole} onValueChange={v => roleChangeMutation.mutate({ id: u.id, appRole: v })}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="app_admin">App Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openResetDialog(u)} title="Reset password">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })} title={u.isActive ? "Deactivate" : "Activate"}>
                      {u.isActive ? <UserX className="h-4 w-4 text-muted-foreground" /> : <UserCheck className="h-4 w-4 text-green-600" />}
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary" className="text-xs">You</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) { setResetTarget(null); setNewPassword(""); setPwError(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Set a new temporary password for <span className="font-medium text-foreground">{resetTarget.firstName} {resetTarget.lastName}</span>. They should change it after logging in.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPwError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleResetSubmit()}
                  autoFocus
                />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(""); setPwError(""); }}>Cancel</Button>
            <Button onClick={handleResetSubmit} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Saving..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
