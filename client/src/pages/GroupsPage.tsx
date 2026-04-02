import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, CalendarDays, MapPin, Clock, ArrowRight } from "lucide-react";
import type { Group } from "@/lib/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function GroupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", location: "", meetingDay: "", meetingTime: "" });

  const { data: groups = [], isLoading } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/groups", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups"] });
      setCreateOpen(false);
      setForm({ name: "", description: "", location: "", meetingDay: "", meetingTime: "" });
      toast({ title: "Group created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Groups</h1>
          <p className="text-sm text-muted-foreground">Manage and browse your small groups</p>
        </div>
        {user?.appRole === "app_admin" && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" data-testid="button-create-group">
                <Plus className="h-4 w-4" />New Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Group Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="input-group-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Location</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Typical Meeting Day</Label>
                    <Select value={form.meetingDay} onValueChange={v => setForm(f => ({ ...f, meetingDay: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                      <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Typical Time</Label>
                    <Input type="time" value={form.meetingTime} onChange={e => setForm(f => ({ ...f, meetingTime: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>Create Group</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground">
              {user?.appRole === "app_admin" ? "Create your first group above." : "You haven't been added to any groups yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Card className={`transition-all hover:shadow-md ${group.isArchived ? "opacity-60" : ""}`} data-testid={`card-group-${group.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{group.name}</h3>
              {group.isArchived && <Badge variant="secondary" className="text-xs shrink-0">Archived</Badge>}
            </div>
            {group.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{group.description}</p>}
          </div>
        </div>
        <div className="space-y-1 mb-4">
          {group.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{group.location}</span>
            </div>
          )}
          {group.meetingDay && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              <span>{group.meetingDay}{group.meetingTime ? ` at ${group.meetingTime}` : ""}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/groups/${group.id}`}>
            <a className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              View group<ArrowRight className="h-3 w-3" />
            </a>
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href={`/groups/${group.id}/calendar`}>
            <a className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />Calendar
            </a>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
