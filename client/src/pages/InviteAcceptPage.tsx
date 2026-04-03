import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Users } from "lucide-react";

export function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token || "";
  const [, navigate] = useLocation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data, isLoading, isError } = useQuery<{ invitation: any; group: any }>({
    queryKey: ["/api/invitations/token", token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/token/${token}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Invalid invitation");
      }
      return res.json();
    },
    retry: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/invitations/accept", { token, firstName, lastName, password });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");
      setDone(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Checking invitation...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-semibold">Invitation Not Found</h2>
            <p className="text-sm text-muted-foreground">This invitation link is invalid, expired, or has already been used.</p>
            <Button variant="outline" onClick={() => navigate("/")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <h2 className="font-semibold">Account Created!</h2>
            <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">You're Invited!</h1>
          <p className="text-sm text-muted-foreground">
            {data.group
              ? <>Join <strong>{data.group.name}</strong> on Small Group Manager</>
              : <>Join Small Group Manager</>}
          </p>
          <p className="text-xs text-muted-foreground">Invitation for: <strong>{data.invitation.email}</strong></p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required data-testid="input-first-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required data-testid="input-last-name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} data-testid="input-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required data-testid="input-confirm-password" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-accept">
                {submitting ? "Creating account..." : "Accept Invitation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
