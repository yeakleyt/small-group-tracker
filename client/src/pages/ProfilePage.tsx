import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, CheckCircle } from "lucide-react";

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  const [profileForm, setProfileForm] = useState({ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwError, setPwError] = useState("");

  const profileMutation = useMutation({
    mutationFn: (data: typeof profileForm) => apiRequest("PATCH", "/api/users/me", data),
    onSuccess: () => { refresh(); toast({ title: "Profile updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("POST", "/api/auth/change-password", data),
    onSuccess: () => {
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast({ title: "Password changed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    profileMutation.mutate(profileForm);
  }

  function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (pwForm.newPassword !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
    if (pwForm.newPassword.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" />Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 pb-4 border-b">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <p className="font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant={user?.appRole === "app_admin" ? "default" : "secondary"} className="text-xs mt-1">
                {user?.appRole === "app_admin" ? "App Admin" : "Member"}
              </Badge>
            </div>
          </div>
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} required data-testid="input-first-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} required data-testid="input-last-name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileMutation.isPending} data-testid="button-save-profile">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePassword} className="space-y-4">
            {pwError && <Alert variant="destructive"><AlertDescription>{pwError}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required data-testid="input-current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={8} data-testid="input-new-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required data-testid="input-confirm-password" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pwMutation.isPending} data-testid="button-change-password">Change Password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
