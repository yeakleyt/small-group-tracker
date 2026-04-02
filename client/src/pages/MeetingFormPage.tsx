import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import type { Meeting, Group, MemberWithUser } from "@/lib/types";

export function NewMeetingPage() {
  const [, params] = useRoute("/groups/:id/meetings/new");
  const groupId = Number(params?.id);
  return <MeetingForm groupId={groupId} />;
}

export function EditMeetingPage() {
  const [, params] = useRoute("/meetings/:id/edit");
  const meetingId = Number(params?.id);
  const { data } = useQuery<{ meeting: Meeting }>({ queryKey: ["/api/meetings", meetingId] });
  if (!data) return null;
  return <MeetingForm groupId={data.meeting.groupId} existingMeeting={data.meeting} />;
}

function MeetingForm({ groupId, existingMeeting }: { groupId: number; existingMeeting?: Meeting }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    title: existingMeeting?.title ?? "",
    date: existingMeeting?.date ?? today,
    startTime: existingMeeting?.startTime ?? "18:00",
    endTime: existingMeeting?.endTime ?? "20:00",
    location: existingMeeting?.location ?? "",
    notes: existingMeeting?.notes ?? "",
    hostUserId: existingMeeting?.hostUserId ? String(existingMeeting.hostUserId) : "",
  });

  const { data: group } = useQuery<Group>({ queryKey: ["/api/groups", groupId] });
  const { data: members = [] } = useQuery<MemberWithUser[]>({ queryKey: ["/api/groups", groupId, "members"] });

  useEffect(() => {
    if (existingMeeting) {
      setForm({
        title: existingMeeting.title,
        date: existingMeeting.date,
        startTime: existingMeeting.startTime,
        endTime: existingMeeting.endTime,
        location: existingMeeting.location ?? "",
        notes: existingMeeting.notes ?? "",
        hostUserId: existingMeeting.hostUserId ? String(existingMeeting.hostUserId) : "",
      });
    }
  }, [existingMeeting?.id]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/groups/${groupId}/meetings`, data),
    onSuccess: async (res) => {
      const mtg: Meeting = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "meetings"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Meeting created" });
      navigate(`/meetings/${mtg.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/meetings/${existingMeeting!.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meetings", existingMeeting!.id] });
      toast({ title: "Meeting updated" });
      navigate(`/meetings/${existingMeeting!.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      hostUserId: (form.hostUserId && form.hostUserId !== "none") ? Number(form.hostUserId) : null,
    };
    if (existingMeeting) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  const isEditing = !!existingMeeting;
  const backHref = isEditing ? `/meetings/${existingMeeting!.id}` : `/groups/${groupId}`;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link href={backHref}><a className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"><ArrowLeft className="h-3 w-3" />Back</a></Link>
        <h1 className="text-xl font-bold">{isEditing ? "Edit Meeting" : "New Meeting"}</h1>
        {group && <p className="text-sm text-muted-foreground">Group: {group.name}</p>}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Meeting Title *</Label>
              <Input id="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Weekly Bible Study" data-testid="input-meeting-title" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required data-testid="input-meeting-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Start *</Label>
                <Input id="startTime" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">End *</Label>
                <Input id="endTime" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="123 Main St or Zoom link" />
            </div>

            <div className="space-y-1.5">
              <Label>Designated Host (optional)</Label>
              <Select value={form.hostUserId} onValueChange={v => setForm(f => ({ ...f, hostUserId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No host designated</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.user.firstName} {m.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Study passage, agenda, special instructions..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(backHref)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-meeting">
                {isEditing ? "Save Changes" : "Create Meeting"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
