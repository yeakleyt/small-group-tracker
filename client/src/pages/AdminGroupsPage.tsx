import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, CalendarDays, MapPin, Users, Archive, ArrowRight } from "lucide-react";
import type { Group } from "@/lib/types";

export function AdminGroupsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: groups = [], isLoading } = useQuery<Group[]>({ queryKey: ["/api/groups"] });

  const archiveMutation = useMutation({
    mutationFn: ({ id, isArchived }: { id: number; isArchived: boolean }) =>
      apiRequest("PATCH", `/api/groups/${id}`, { isArchived }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups"] }); toast({ title: "Group updated" }); },
  });

  const active = groups.filter(g => !g.isArchived);
  const archived = groups.filter(g => g.isArchived);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />All Groups</h1>
        <p className="text-sm text-muted-foreground">App-wide view of all groups</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active ({active.length})</h2>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <div className="space-y-2">
            {active.map(g => <GroupAdminRow key={g.id} group={g} onArchive={() => archiveMutation.mutate({ id: g.id, isArchived: true })} />)}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Archived ({archived.length})</h2>
          <div className="space-y-2 opacity-70">
            {archived.map(g => (
              <GroupAdminRow key={g.id} group={g} onArchive={() => archiveMutation.mutate({ id: g.id, isArchived: false })} unarchive />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GroupAdminRow({ group, onArchive, unarchive }: { group: Group; onArchive: () => void; unarchive?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card" data-testid={`row-admin-group-${group.id}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <p className="text-sm font-medium">{group.name}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {group.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{group.location}</span>}
            {group.meetingDay && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{group.meetingDay}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" />{unarchive ? "Unarchive" : "Archive"}
        </Button>
        <Link href={`/groups/${group.id}`}>
          <a className="text-xs text-primary hover:underline flex items-center gap-1">View<ArrowRight className="h-3 w-3" /></a>
        </Link>
      </div>
    </div>
  );
}
