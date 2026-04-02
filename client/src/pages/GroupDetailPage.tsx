import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, MapPin, Users, Pencil, Trash2, UserMinus, Crown, ArrowLeft, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Group, MemberWithUser, Meeting } from "@/lib/types";
import { Link } from "wouter";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function GroupDetailPage() {
  const [, params] = useRoute("/groups/:id");
  const groupId = Number(params?.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Group>>({});
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  const { data: group, isLoading: gLoading } = useQuery<Group>({ queryKey: ["/api/groups", groupId] });
  const { data: members = [], isLoading: mLoading } = useQuery<MemberWithUser[]>({ queryKey: ["/api/groups", groupId, "members"] });
  const { data: meetings = [], isLoading: mtgLoading } = useQuery<Meeting[]>({ queryKey: ["/api/groups", groupId, "meetings"] });

  const myMembership = members.find(m => m.userId === user?.id);
  const isGroupAdmin = user?.appRole === "app_admin" || myMembership?.role === "group_admin";

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Group>) => apiRequest("PATCH", `/api/groups/${groupId}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups", groupId] }); setEditOpen(false); toast({ title: "Group updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/groups/${groupId}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups"] }); navigate("/groups"); toast({ title: "Group deleted" }); },
  });

  const removeUserMutation = useMutation({
    mutationFn: (uid: number) => apiRequest("DELETE", `/api/groups/${groupId}/members/${uid}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] }); setRemoveTarget(null); },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ uid, role }: { uid: number; role: string }) =>
      apiRequest("PATCH", `/api/groups/${groupId}/members/${uid}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] }); toast({ title: "Role updated" }); },
  });

  if (gLoading) return <div className="max-w-4xl mx-auto"><Skeleton className="h-60" /></div>;
  if (!group) return <div className="p-8 text-center text-muted-foreground">Group not found</div>;

  const upcomingMeetings = meetings.filter(m => m.date >= new Date().toISOString().split("T")[0]);
  const pastMeetings = meetings.filter(m => m.date < new Date().toISOString().split("T")[0]).reverse();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/groups"><a className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" />All Groups</a></Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{group.name}</h1>
              {group.isArchived && <Badge variant="secondary">Archived</Badge>}
            </div>
            {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {group.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{group.location}</span>}
              {group.meetingDay && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{group.meetingDay}{group.meetingTime ? ` · ${group.meetingTime}` : ""}</span>}
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{members.length} member{members.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          {isGroupAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setEditForm({ ...group }); setEditOpen(true); }} data-testid="button-edit-group">
                <Pencil className="h-4 w-4" />
              </Button>
              {user?.appRole === "app_admin" && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
        </TabsList>

        {/* Meetings tab */}
        <TabsContent value="meetings" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</h2>
            {isGroupAdmin && (
              <Link href={`/groups/${groupId}/meetings/new`}>
                <Button size="sm" data-testid="button-new-meeting">+ New Meeting</Button>
              </Link>
            )}
          </div>
          {mtgLoading ? <Skeleton className="h-32" /> : upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No upcoming meetings scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map(m => <MeetingRow key={m.id} meeting={m} />)}
            </div>
          )}

          {pastMeetings.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">Past</h2>
              <div className="space-y-2 opacity-70">
                {pastMeetings.slice(0, 5).map(m => <MeetingRow key={m.id} meeting={m} />)}
              </div>
            </>
          )}
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <div className="space-y-2">
            {mLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card" data-testid={`row-member-${m.userId}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {m.user.firstName[0]}{m.user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.user.firstName} {m.user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  {m.role === "group_admin" && <Badge variant="secondary" className="text-xs gap-1"><Crown className="h-2.5 w-2.5" />Admin</Badge>}
                </div>
                {isGroupAdmin && m.userId !== user?.id && (
                  <div className="flex items-center gap-2">
                    <Select value={m.role} onValueChange={v => roleChangeMutation.mutate({ uid: m.userId, role: v })}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="group_admin">Group Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setRemoveTarget(m.userId)}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(editForm); }} className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={editForm.location ?? ""} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meeting Day</Label>
                <Select value={editForm.meetingDay ?? ""} onValueChange={v => setEditForm(f => ({ ...f, meetingDay: v }))}>
                  <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={editForm.meetingTime ?? ""} onChange={e => setEditForm(f => ({ ...f, meetingTime: e.target.value }))} /></div>
            </div>
            {user?.appRole === "app_admin" && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="archived" checked={!!editForm.isArchived} onChange={e => setEditForm(f => ({ ...f, isArchived: e.target.checked }))} />
                <Label htmlFor="archived">Archive this group</Label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the group, all meetings, and all sign-up data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/80" onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog open={removeTarget !== null} onOpenChange={o => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove Member?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTarget && removeUserMutation.mutate(removeTarget)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  function fmt(d: string, t: string) {
    try { return format(parseISO(`${d}T${t}`), "EEE MMM d · h:mm a"); } catch { return d; }
  }
  return (
    <Link href={`/meetings/${meeting.id}`}>
      <a className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:border-primary/40 hover:bg-accent/20 transition-colors">
        <div>
          <p className="text-sm font-medium">{meeting.title}</p>
          <p className="text-xs text-muted-foreground">{fmt(meeting.date, meeting.startTime)}</p>
          {meeting.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{meeting.location}</p>}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{meeting.startTime}–{meeting.endTime}</span>
      </a>
    </Link>
  );
}
