import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Users } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" aria-label="Small Group Tracker">
              <circle cx="16" cy="16" r="14" stroke="hsl(239,65%,50%)" strokeWidth="2" />
              <circle cx="10" cy="14" r="3" fill="hsl(239,65%,50%)" />
              <circle cx="22" cy="14" r="3" fill="hsl(239,65%,50%)" />
              <circle cx="16" cy="20" r="3" fill="hsl(239,65%,50%)" />
              <line x1="10" y1="14" x2="16" y2="20" stroke="hsl(239,65%,50%)" strokeWidth="1.5" />
              <line x1="22" y1="14" x2="16" y2="20" stroke="hsl(239,65%,50%)" strokeWidth="1.5" />
              <line x1="10" y1="14" x2="22" y2="14" stroke="hsl(239,65%,50%)" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Small Group Tracker</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Access is by invitation only. Contact your group administrator.
        </p>
      </div>
    </div>
  );
}
