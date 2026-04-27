import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays, MapPin, Clock, ArrowLeft, Mic2, UtensilsCrossed,
  CheckCircle, Plus, Pencil, Trash2, Lock, Unlock, Users
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { MeetingDetail, MemberWithUser } from "@/lib/types";

const FOOD_LABELS = ["Main Dish", "Dessert", "Drinks", "Sides", "Salad", "Appetizer", "Snacks", "Bread", "Other"];

export function MeetingDetailPage() {
  const [, params] = useRoute("/meetings/:id");
  const meetingId = Number(params?.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const [newFoodLabel, setNewFoodLabel] = useState("Main Dish");
  const [customLabel, setCustomLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [assignLeaderUserId, setAssignLeaderUserId] = useState("");
  const [assignLeaderOpen, setAssignLeaderOpen] = useState(false);
  const [assignFoodSlotId, setAssignFoodSlotId] = useState<number | null>(null);
  const [assignFoodUserId, setAssignFoodUserId] = useState("");

  const { data, isLoading } = useQuery<MeetingDetail>({
    queryKey: ["/api/meetings", meetingId],
  });
  const { data: members = [] } = useQuery<MemberWithUser[]>({
    queryKey: ["/api/groups", data?.meeting.groupId, "members"],
    enabled: !!data?.meeting.groupId,
  });

  const isGroupAdmin = user?.appRole === "app_admin" ||
    members.find(m => m.userId === user?.id)?.role === "group_admin";
  const isPast = data?.meeting ? new Date(data.meeting.date) < new Date(new Date().toISOString().split("T")[0]) : false;

  const claimLeaderMutation = useMutation({
    mutationFn: (targetUserId?: number) => apiRequest("POST", `/api/meetings/${meetingId}/leader`, { targetUserId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Signed up to lead!" }); setAssignLeaderOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeLeaderMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/meetings/${meetingId}/leader`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Leader removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addFoodSlotMutation = useMutation({
    mutationFn: (label: string) => apiRequest("POST", `/api/meetings/${meetingId}/food-slots`, { label }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); setAddFoodOpen(false); toast({ title: "Food slot added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const claimFoodMutation = useMutation({
    mutationFn: (slotId: number) => apiRequest("POST", `/api/food-slots/${slotId}/claim`, { meetingId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Food slot claimed!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unclaimFoodMutation = useMutation({
    mutationFn: (slotId: number) => apiRequest("POST", `/api/food-slots/${slotId}/unclaim`, { meetingId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Slot released" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFoodSlotMutation = useMutation({
    mutationFn: (slotId: number) => apiRequest("DELETE", `/api/food-slots/${slotId}`, { meetingId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }); },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/meetings/${meetingId}`, {}),
    onSuccess: () => {
      if (data) navigate(`/groups/${data.meeting.groupId}`);
      toast({ title: "Meeting deleted" });
    },
  });

  const lockLeaderMutation = useMutation({
    mutationFn: (lock: boolean) => apiRequest("PATCH", `/api/meetings/${meetingId}`, { ...data?.meeting, isLeaderLocked: lock }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }),
  });

  const assignFoodMutation = useMutation({
    mutationFn: ({ slotId, userId }: { slotId: number; userId: number | null }) =>
      apiRequest("POST", `/api/food-slots/${slotId}/assign`, { meetingId, userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAssignFoodSlotId(null);
      setAssignFoodUserId("");
      toast({ title: "Food slot assigned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ userId, isAttending }: { userId: number; isAttending: boolean }) =>
      apiRequest("PATCH", `/api/meetings/${meetingId}/attendance/${userId}`, { isAttending }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meetings", meetingId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="max-w-3xl mx-auto"><Skeleton className="h-80" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Meeting not found</div>;

  const { meeting, leader, foodSlots, attendance } = data;
  const myLeaderSignup = leader?.userId === user?.id;

  function fmtDate(d: string, t: string) {
    try { return format(parseISO(`${d}T${t}`), "EEEE, MMMM d, yyyy"); } catch { return d; }
  }
  function fmtTime(t: string) {
    try { return format(parseISO(`2000-01-01T${t}`), "h:mm a"); } catch { return t; }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href={`/groups/${meeting.groupId}`}>
        <a className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Back to group</a>
      </Link>

      {/* Meeting header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold">{meeting.title}</h1>
            {isPast && <Badge variant="secondary" className="text-xs">Past</Badge>}
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{fmtDate(meeting.date, meeting.startTime)}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{fmtTime(meeting.startTime)} – {fmtTime(meeting.endTime)}</span>
            {meeting.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{meeting.location}</span>}
          </div>
          {meeting.notes && <p className="mt-2 text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{meeting.notes}</p>}
        </div>
        {isGroupAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild data-testid="button-edit-meeting">
              <Link href={`/meetings/${meetingId}/edit`}><a><Pencil className="h-4 w-4" /></a></Link>
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Leader section */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Meeting Leader
            {meeting.isLeaderLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
          {isGroupAdmin && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => lockLeaderMutation.mutate(!meeting.isLeaderLocked)}>
              {meeting.isLeaderLocked ? <><Unlock className="h-3 w-3" />Unlock</> : <><Lock className="h-3 w-3" />Lock</>}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {leader ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {leader.user?.firstName?.[0]}{leader.user?.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{leader.user?.firstName} {leader.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{leader.assignedByAdminId ? "Assigned by admin" : "Volunteered"}</p>
                </div>
              </div>
              {(myLeaderSignup || isGroupAdmin) && !isPast && (
                <Button variant="outline" size="sm" className="text-destructive text-xs"
                  onClick={() => removeLeaderMutation.mutate()}>Remove</Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">No leader signed up yet</p>
              <div className="flex gap-2">
                {!meeting.isLeaderLocked && !isPast && (
                  <Button size="sm" onClick={() => claimLeaderMutation.mutate(undefined)} disabled={claimLeaderMutation.isPending}>
                    Volunteer to Lead
                  </Button>
                )}
                {isGroupAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setAssignLeaderOpen(true)}>
                    Assign Leader
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Food section */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-green-600 dark:text-green-400" />
            Food Signup
          </CardTitle>
          {isGroupAdmin && !isPast && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddFoodOpen(true)}>
              <Plus className="h-3 w-3" />Add Slot
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {foodSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isGroupAdmin ? "No food slots yet. Add some using the button above." : "No food slots have been set up for this meeting."}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {foodSlots.map(slot => {
                const isMine = slot.assignedUserId === user?.id;
                const isClaimed = !!slot.assignedUserId;
                return (
                  <div key={slot.id} className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${isClaimed ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-card"}`} data-testid={`card-food-slot-${slot.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isClaimed ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1">
                          {slot.label}
                          {slot.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </p>
                        {slot.assignedUser && (
                          <p className="text-xs text-muted-foreground truncate">
                            {slot.assignedUser.firstName} {slot.assignedUser.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!isClaimed && !slot.isLocked && !isPast && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => claimFoodMutation.mutate(slot.id)}>Claim</Button>
                      )}
                      {isGroupAdmin && !isClaimed && !slot.isLocked && !isPast && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssignFoodSlotId(slot.id); setAssignFoodUserId(""); }}>Assign</Button>
                      )}
                      {isMine && !isPast && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => unclaimFoodMutation.mutate(slot.id)}>Release</Button>
                      )}
                      {isGroupAdmin && isClaimed && !isMine && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => unclaimFoodMutation.mutate(slot.id)}>Clear</Button>
                      )}
                      {isGroupAdmin && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteFoodSlotMutation.mutate(slot.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add food slot dialog */}
      <Dialog open={addFoodOpen} onOpenChange={setAddFoodOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Food Slot</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={newFoodLabel} onValueChange={setNewFoodLabel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FOOD_LABELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {newFoodLabel === "Other" && (
              <div className="space-y-1.5">
                <Label>Custom label</Label>
                <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="e.g. Gluten-free dish" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddFoodOpen(false)}>Cancel</Button>
              <Button onClick={() => addFoodSlotMutation.mutate(newFoodLabel === "Other" ? (customLabel || "Other") : newFoodLabel)} disabled={addFoodSlotMutation.isPending}>Add Slot</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign leader dialog */}
      <Dialog open={assignLeaderOpen} onOpenChange={setAssignLeaderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Leader</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Select Member</Label>
              <Select value={assignLeaderUserId} onValueChange={setAssignLeaderUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a member" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.user.firstName} {m.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignLeaderOpen(false)}>Cancel</Button>
              <Button onClick={() => claimLeaderMutation.mutate(Number(assignLeaderUserId))} disabled={!assignLeaderUserId || claimLeaderMutation.isPending}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance section */}
      {attendance.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Attendance
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {attendance.filter(a => a.isAttending).length} of {attendance.length} attending
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {attendance.map(record => {
                const canEdit = isGroupAdmin || record.userId === user?.id;
                return (
                  <div key={record.userId} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                    record.isAttending ? "bg-card" : "bg-muted/40 border-dashed"
                  }`}>
                    <Checkbox
                      id={`attend-${record.userId}`}
                      checked={record.isAttending}
                      disabled={!canEdit || attendanceMutation.isPending}
                      onCheckedChange={checked =>
                        attendanceMutation.mutate({ userId: record.userId, isAttending: !!checked })
                      }
                    />
                    <label
                      htmlFor={`attend-${record.userId}`}
                      className={`text-sm cursor-pointer select-none flex-1 ${
                        !record.isAttending ? "line-through text-muted-foreground" : ""
                      } ${!canEdit ? "cursor-default" : ""}`}
                    >
                      {record.firstName} {record.lastName}
                    </label>
                    {!record.isAttending && (
                      <span className="text-xs text-muted-foreground">Not attending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign food dialog */}
      <Dialog open={assignFoodSlotId !== null} onOpenChange={open => { if (!open) { setAssignFoodSlotId(null); setAssignFoodUserId(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Food Slot</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Assign to Member</Label>
              <Select value={assignFoodUserId} onValueChange={setAssignFoodUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a member" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.user.firstName} {m.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAssignFoodSlotId(null); setAssignFoodUserId(""); }}>Cancel</Button>
              <Button
                disabled={!assignFoodUserId || assignFoodMutation.isPending}
                onClick={() => assignFoodMutation.mutate({ slotId: assignFoodSlotId!, userId: Number(assignFoodUserId) })}
              >
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete meeting confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the meeting and all associated sign-up data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMeetingMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
