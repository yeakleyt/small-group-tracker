import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronRight, CalendarDays, MapPin, Clock, List
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO, isToday, startOfWeek, endOfWeek
} from "date-fns";
import type { Meeting, Group } from "@/lib/types";
import { cn } from "@/lib/utils";

// Group-specific calendar
export function GroupCalendarPage() {
  const [, params] = useRoute("/groups/:id/calendar");
  const groupId = Number(params?.id);
  const { data: group } = useQuery<Group>({ queryKey: ["/api/groups", groupId] });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/groups", groupId, "meetings"] });
  return <CalendarView meetings={meetings} title={group ? `${group.name} — Calendar` : "Calendar"} />;
}

// Loader that fetches meetings for a single group — stable via ref to avoid re-render loops
function GroupMeetingLoader({ groupId, onLoaded }: { groupId: number; onLoaded: (id: number, m: Meeting[]) => void }) {
  const { data } = useQuery<Meeting[]>({ queryKey: ["/api/groups", groupId, "meetings"] });
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  useEffect(() => {
    if (data) onLoadedRef.current(groupId, data);
  }, [data, groupId]);
  return null;
}

// App-wide calendar (all groups)
export function CalendarPage() {
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const [meetingMap, setMeetingMap] = useState<Record<number, Meeting[]>>({});

  const handleLoaded = (id: number, m: Meeting[]) =>
    setMeetingMap(prev => (prev[id] === m ? prev : { ...prev, [id]: m }));

  const allMeetings = Object.values(meetingMap).flat();

  return (
    <>
      {groups.map(g => (
        <GroupMeetingLoader key={g.id} groupId={g.id} onLoaded={handleLoaded} />
      ))}
      <CalendarView meetings={allMeetings} title="Calendar" showGroupBadge groups={groups} />
    </>
  );
}

function CalendarView({ meetings, title, showGroupBadge, groups }: { meetings: Meeting[]; title: string; showGroupBadge?: boolean; groups?: Group[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "agenda">("month");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function getMeetingsForDay(day: Date) {
    return meetings.filter(m => {
      try { return isSameDay(parseISO(m.date), day); } catch { return false; }
    });
  }

  function fmtTime(t: string) {
    try { return format(parseISO(`2000-01-01T${t}`), "h:mm a"); } catch { return t; }
  }

  const today = new Date();
  const upcomingAgenda = meetings
    .filter(m => {
      try { return parseISO(m.date) >= today; } catch { return false; }
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  function groupName(groupId: number) {
    return groups?.find(g => g.id === groupId)?.name || `Group ${groupId}`;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
        <Tabs value={view} onValueChange={v => setView(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="month" className="text-xs gap-1 px-3"><CalendarDays className="h-3.5 w-3.5" />Month</TabsTrigger>
            <TabsTrigger value="agenda" className="text-xs gap-1 px-3"><List className="h-3.5 w-3.5" />Agenda</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "month" ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold">{format(currentDate, "MMMM yyyy")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {days.map(day => {
                const dayMeetings = getMeetingsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isT = isToday(day);
                return (
                  <div key={day.toISOString()} className={cn(
                    "min-h-[80px] p-1 border-t border-r border-border",
                    !isCurrentMonth && "opacity-40 bg-muted/30",
                  )}>
                    <span className={cn(
                      "text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full",
                      isT ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>{format(day, "d")}</span>
                    <div className="space-y-0.5 mt-0.5">
                      {dayMeetings.map(m => (
                        <Link key={m.id} href={`/meetings/${m.id}`}>
                          <span className="block text-xs bg-primary/15 hover:bg-primary/25 text-primary rounded px-1 py-0.5 truncate transition-colors cursor-pointer" data-testid={`cal-event-${m.id}`}>
                            {m.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingAgenda.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No upcoming meetings</CardContent></Card>
          ) : upcomingAgenda.map(meeting => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
              <span className="block border rounded-lg p-4 hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{meeting.title}</span>
                      {showGroupBadge && <Badge variant="outline" className="text-xs">{groupName(meeting.groupId)}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(parseISO(meeting.date), "EEE, MMM d, yyyy")}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(meeting.startTime)} – {fmtTime(meeting.endTime)}</span>
                      {meeting.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{meeting.location}</span>}
                    </div>
                  </div>
                </div>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
