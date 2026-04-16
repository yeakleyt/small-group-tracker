import { useState, useEffect, useRef } from "react";
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
import { CalendarDays, MapPin, Users, Pencil, Trash2, UserMinus, Crown, ArrowLeft, UserPlus, BookOpen, Link2, Plus, ExternalLink, X, Send, MessageSquare, Bell, BellOff } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Group, MemberWithUser, Meeting, User, Resource, ResourceLink, ChatMessage } from "@/lib/types";
import { Link } from "wouter";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Resource link form row ─────────────────────────────────────────────────
interface LinkRow { label: string; url: string; }

function LinkFormRow({
  row,
  onChange,
  onRemove,
}: {
  row: LinkRow;
  onChange: (val: LinkRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Label (e.g. Amazon)"
        value={row.label}
        onChange={e => onChange({ ...row, label: e.target.value })}
        className="flex-1"
      />
      <Input
        placeholder="https://..."
        value={row.url}
        onChange={e => onChange({ ...row, url: e.target.value })}
        className="flex-[2]"
      />
      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive shrink-0" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Resource card ───────────────────────────────────────────────────────────
function ResourceCard({
  resource,
  isAdmin,
  groupId,
  onEdit,
  onDelete,
}: {
  resource: Resource;
  isAdmin: boolean;
  groupId: number;
  onEdit: (r: Resource) => void;
  onDelete: (r: Resource) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [newLink, setNewLink] = useState<LinkRow>({ label: "", url: "" });
  const [deleteLinkTarget, setDeleteLinkTarget] = useState<number | null>(null);

  const addLinkMutation = useMutation({
    mutationFn: (data: LinkRow) =>
      apiRequest("POST", `/api/resources/${resource.id}/links`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "resources"] });
      setAddLinkOpen(false);
      setNewLink({ label: "", url: "" });
      toast({ title: "Link added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: number) =>
      apiRequest("DELETE", `/api/resource-links/${linkId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "resources"] });
      setDeleteLinkTarget(null);
      toast({ title: "Link removed" });
    },
  });

  return (
    <div className="border rounded-lg bg-card p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{resource.title}</p>
            {resource.description && (
              <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{resource.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(resource)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(resource)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Links list */}
      {resource.links.length > 0 && (
        <div className="space-y-1.5 pl-6">
          {resource.links.map(link => (
            <div key={link.id} className="flex items-center gap-2 group">
              <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1 truncate"
              >
                {link.label || link.url}
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </a>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
                  onClick={() => setDeleteLinkTarget(link.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add link button */}
      {isAdmin && (
        <div className="pl-6">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            onClick={() => setAddLinkOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Link
          </Button>
        </div>
      )}

      {/* Add link dialog */}
      <Dialog open={addLinkOpen} onOpenChange={setAddLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Link to "{resource.title}"</DialogTitle></DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!newLink.url) return;
              addLinkMutation.mutate(newLink);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label>Label <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. Amazon, Publisher, YouTube"
                value={newLink.label}
                onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input
                placeholder="https://..."
                type="url"
                value={newLink.url}
                onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddLinkOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addLinkMutation.isPending || !newLink.url}>
                {addLinkMutation.isPending ? "Saving..." : "Add Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete link confirmation */}
      <AlertDialog open={deleteLinkTarget !== null} onOpenChange={o => !o && setDeleteLinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Link?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the link from this resource.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteLinkTarget !== null && deleteLinkMutation.mutate(deleteLinkTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Chat tab ────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map(c => c.charCodeAt(0)));
}

function ChatTab({ groupId, currentUserId, isAdmin }: { groupId: number; currentUserId: number; isAdmin: boolean }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Push notification state
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"default" | "granted" | "denied">("default");
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    // Check if push is supported and read current permission
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setNotifSupported(supported);
    if (supported) setNotifStatus(Notification.permission as "default" | "granted" | "denied");
  }, []);

  async function enableNotifications() {
    if (!notifSupported) return;
    setNotifLoading(true);
    try {
      // Get VAPID public key
      const keyRes = await fetch("/api/push/vapid-public-key", { credentials: "include" });
      if (!keyRes.ok) { toast({ title: "Push not configured on server", variant: "destructive" }); return; }
      const { key } = await keyRes.json();

      // Request permission
      const permission = await Notification.requestPermission();
      setNotifStatus(permission as "default" | "granted" | "denied");
      if (permission !== "granted") { toast({ title: "Notifications blocked", description: "You can enable them in your browser settings.", variant: "destructive" }); return; }

      // Subscribe via service worker
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      // Save subscription on server
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      toast({ title: "Notifications enabled", description: "You'll be notified when new messages are posted." });
    } catch (e: any) {
      toast({ title: "Could not enable notifications", description: e.message, variant: "destructive" });
    } finally {
      setNotifLoading(false);
    }
  }

  async function disableNotifications() {
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setNotifStatus("default");
      toast({ title: "Notifications disabled" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setNotifLoading(false);
    }
  }

  // Load history once on mount
  useEffect(() => {
    fetch(`/api/groups/${groupId}/chat`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: ChatMessage[]) => setMessages(data))
      .catch(() => {});
  }, [groupId]);

  // SSE subscription for real-time new messages
  useEffect(() => {
    const es = new EventSource(`/api/groups/${groupId}/chat/stream`, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "delete") {
          setMessages(prev => prev.filter(m => m.id !== data.id));
        } else {
          setMessages(prev => {
            // Avoid duplicate if we already added it optimistically
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }
      } catch {}
    };
    es.onerror = () => {}; // silent — will reconnect automatically
    return () => es.close();
  }, [groupId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/groups/${groupId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const saved: ChatMessage = await res.json();
        // Add optimistically (SSE will also arrive but we dedup)
        setMessages(prev => prev.some(m => m.id === saved.id) ? prev : [...prev, saved]);
      }
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
      setInput(text); // restore
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function deleteMessage(id: number) {
    await fetch(`/api/chat/${id}`, { method: "DELETE", credentials: "include" });
    setMessages(prev => prev.filter(m => m.id !== id));
    setDeleteTarget(null);
  }

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      return isToday
        ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  }

  return (
    <div className="flex flex-col h-[520px]">
      {/* Notification toggle */}
      {notifSupported && notifStatus !== "denied" && (
        <div className="flex justify-end mb-2">
          {notifStatus === "granted" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground gap-1"
              onClick={disableNotifications}
              disabled={notifLoading}
            >
              <BellOff className="h-3.5 w-3.5" /> Notifications on
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground gap-1"
              onClick={enableNotifications}
              disabled={notifLoading}
            >
              <Bell className="h-3.5 w-3.5" /> Enable notifications
            </Button>
          )}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Be the first to say something to the group.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.userId === currentUserId;
          const canDelete = isOwn || isAdmin;
          return (
            <div key={msg.id} className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0 mt-0.5">
                {msg.firstName[0]}{msg.lastName[0]}
              </div>
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                {/* Name + time */}
                <div className={`flex items-baseline gap-1.5 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] font-semibold">{msg.firstName} {msg.lastName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                </div>
                {/* Bubble */}
                <div className="flex items-end gap-1">
                  {canDelete && !isOwn && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => setDeleteTarget(msg.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <div className={`rounded-2xl px-3 py-1.5 text-sm leading-snug break-words ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}>
                    {msg.message}
                  </div>
                  {canDelete && isOwn && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => setDeleteTarget(msg.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t mt-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={sending}
          autoComplete="off"
        />
        <Button type="submit" size="sm" disabled={sending || !input.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the message for everyone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteTarget !== null && deleteMessage(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function GroupDetailPage() {
  const [, params] = useRoute("/groups/:id");
  const groupId = Number(params?.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Group/member/meeting state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Group>>({});
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ userId: "", role: "member" });

  // Resource state
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [editResourceOpen, setEditResourceOpen] = useState(false);
  const [deleteResourceTarget, setDeleteResourceTarget] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState<{ title: string; description: string; links: LinkRow[] }>({
    title: "", description: "", links: [],
  });
  const [editResourceForm, setEditResourceForm] = useState<{ id: number; title: string; description: string }>({
    id: 0, title: "", description: "",
  });

  const { data: group, isLoading: gLoading } = useQuery<Group>({ queryKey: ["/api/groups", groupId] });
  const { data: members = [], isLoading: mLoading } = useQuery<MemberWithUser[]>({ queryKey: ["/api/groups", groupId, "members"] });
  const { data: meetings = [], isLoading: mtgLoading } = useQuery<Meeting[]>({ queryKey: ["/api/groups", groupId, "meetings"] });
  const { data: resources = [], isLoading: resLoading } = useQuery<Resource[]>({ queryKey: ["/api/groups", groupId, "resources"] });
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const myMembership = members.find(m => m.userId === user?.id);
  const isGroupAdmin = user?.appRole === "app_admin" || myMembership?.role === "group_admin";

  // ── Group mutations ────────────────────────────────────────────────────────
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

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: number; role: string }) =>
      apiRequest("POST", `/api/groups/${groupId}/members`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "members"] });
      setAddMemberOpen(false);
      setAddMemberForm({ userId: "", role: "member" });
      toast({ title: "Member added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Resource mutations ─────────────────────────────────────────────────────
  const addResourceMutation = useMutation({
    mutationFn: (data: { title: string; description: string; links: LinkRow[] }) =>
      apiRequest("POST", `/api/groups/${groupId}/resources`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "resources"] });
      setAddResourceOpen(false);
      setResourceForm({ title: "", description: "", links: [] });
      toast({ title: "Resource added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editResourceMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; title: string; description: string }) =>
      apiRequest("PATCH", `/api/resources/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "resources"] });
      setEditResourceOpen(false);
      toast({ title: "Resource updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/groups", groupId, "resources"] });
      setDeleteResourceTarget(null);
      toast({ title: "Resource deleted" });
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const nonMembers = allUsers.filter(u => !members.some(m => m.userId === u.id));

  function openEditResource(r: Resource) {
    setEditResourceForm({ id: r.id, title: r.title, description: r.description ?? "" });
    setEditResourceOpen(true);
  }

  function addLinkRow() {
    setResourceForm(f => ({ ...f, links: [...f.links, { label: "", url: "" }] }));
  }

  function updateLinkRow(idx: number, val: LinkRow) {
    setResourceForm(f => ({ ...f, links: f.links.map((l, i) => i === idx ? val : l) }));
  }

  function removeLinkRow(idx: number) {
    setResourceForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }));
  }

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
          <TabsTrigger value="resources">Resources {resources.length > 0 ? `(${resources.length})` : ""}</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
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
          {isGroupAdmin && (
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setAddMemberOpen(true)} data-testid="button-add-member">
                <UserPlus className="h-4 w-4 mr-1" /> Add Existing User
              </Button>
            </div>
          )}
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

        {/* Resources tab */}
        <TabsContent value="resources" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resources</h2>
            {isGroupAdmin && (
              <Button size="sm" onClick={() => { setResourceForm({ title: "", description: "", links: [] }); setAddResourceOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Resource
              </Button>
            )}
          </div>
          {resLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : resources.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border rounded-lg">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No resources yet.</p>
              {isGroupAdmin && <p className="text-xs mt-1">Click "Add Resource" to add books, studies, or links for the group.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map(r => (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  isAdmin={isGroupAdmin}
                  groupId={groupId}
                  onEdit={openEditResource}
                  onDelete={res => setDeleteResourceTarget(res)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chat tab */}
        <TabsContent value="chat" className="mt-4">
          {user && (
            <ChatTab
              groupId={groupId}
              currentUserId={user.id}
              isAdmin={isGroupAdmin}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Resource dialog ── */}
      <Dialog open={addResourceOpen} onOpenChange={setAddResourceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!resourceForm.title.trim()) return;
              addResourceMutation.mutate({
                title: resourceForm.title.trim(),
                description: resourceForm.description.trim(),
                links: resourceForm.links.filter(l => l.url.trim()),
              });
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. The Purpose Driven Life"
                value={resourceForm.title}
                onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Brief description or notes about this resource..."
                value={resourceForm.description}
                onChange={e => setResourceForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Links <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={addLinkRow}>
                  <Plus className="h-3 w-3 mr-1" /> Add Link
                </Button>
              </div>
              {resourceForm.links.length > 0 && (
                <div className="space-y-2">
                  {resourceForm.links.map((row, idx) => (
                    <LinkFormRow
                      key={idx}
                      row={row}
                      onChange={val => updateLinkRow(idx, val)}
                      onRemove={() => removeLinkRow(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddResourceOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addResourceMutation.isPending || !resourceForm.title.trim()}>
                {addResourceMutation.isPending ? "Saving..." : "Add Resource"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Resource dialog ── */}
      <Dialog open={editResourceOpen} onOpenChange={setEditResourceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Resource</DialogTitle></DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!editResourceForm.title.trim()) return;
              editResourceMutation.mutate({
                id: editResourceForm.id,
                title: editResourceForm.title.trim(),
                description: editResourceForm.description.trim(),
              });
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={editResourceForm.title}
                onChange={e => setEditResourceForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={editResourceForm.description}
                onChange={e => setEditResourceForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">To add or remove links, use the Add Link / remove buttons on the resource card directly.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditResourceOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editResourceMutation.isPending}>
                {editResourceMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Resource confirmation ── */}
      <AlertDialog open={deleteResourceTarget !== null} onOpenChange={o => !o && setDeleteResourceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteResourceTarget?.title}" and all its links will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
              onClick={() => deleteResourceTarget && deleteResourceMutation.mutate(deleteResourceTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add member dialog ── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Existing User to Group</DialogTitle></DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!addMemberForm.userId) return;
              addMemberMutation.mutate({ userId: Number(addMemberForm.userId), role: addMemberForm.role });
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1.5">
              <Label>User *</Label>
              <Select value={addMemberForm.userId} onValueChange={v => setAddMemberForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger data-testid="select-add-member-user">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {nonMembers.length === 0 ? (
                    <SelectItem value="none" disabled>All users are already members</SelectItem>
                  ) : (
                    nonMembers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.firstName} {u.lastName} — {u.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={addMemberForm.role} onValueChange={v => setAddMemberForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="group_admin">Group Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMemberMutation.isPending || !addMemberForm.userId || addMemberForm.userId === "none"}>
                {addMemberMutation.isPending ? "Adding..." : "Add to Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group dialog ── */}
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

      {/* ── Delete Group confirmation ── */}
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

      {/* ── Remove Member confirmation ── */}
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
