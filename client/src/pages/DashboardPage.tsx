import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Users, Mic2, UtensilsCrossed, ArrowRight, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Meeting, Group } from "@/lib/types";

interface DashboardData {
  upcoming: Meeting[];
  openLeader: Meeting[];
  openFood: { meeting: Meeting; openSlots: any[] }[];
  groups: Group[];
}

export function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  function formatMeetingDate(dateStr: string, timeStr: string) {
    try {
      return format(parseISO(`${dateStr}T${timeStr}`), "EEE, MMM d · h:mm a");
    } catch {
      return `${dateStr} ${timeStr}`;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what's coming up across your groups.</p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Groups" value={data?.groups.length ?? 0} color="text-primary" />
          <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Upcoming Meetings" value={data?.upcoming.length ?? 0} color="text-blue-600 dark:text-blue-400" />
          <StatCard icon={<Mic2 className="h-4 w-4" />} label="Open Leader Slots" value={data?.openLeader.length ?? 0} color="text-amber-600 dark:text-amber-400" />
          <StatCard icon={<UtensilsCrossed className="h-4 w-4" />} label="Open Food Slots" value={data?.openFood.length ?? 0} color="text-green-600 dark:text-green-400" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming meetings */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Upcoming Meetings
            </CardTitle>
            <Link href="/calendar"><a className="text-xs text-primary hover:underline flex items-center gap-1">View calendar<ArrowRight className="h-3 w-3" /></a></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : data?.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming meetings</p>
            ) : (
              data?.upcoming.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Open leader slots */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Open Leader Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              [...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : data?.openLeader.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All leader slots filled</p>
            ) : (
              data?.openLeader.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} badge="Leader Needed" badgeColor="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
              ))
            )}
          </CardContent>
        </Card>

        {/* Open food slots */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-green-600 dark:text-green-400" />
              Open Food Signup Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : data?.openFood.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All food slots claimed</p>
            ) : (
              <div className="space-y-3">
                {data?.openFood.map(({ meeting, openSlots }) => (
                  <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
                    <a className="block border rounded-lg p-3 hover:border-primary/50 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{meeting.title}</p>
                          <p className="text-xs text-muted-foreground">{formatMeetingDate(meeting.date, meeting.startTime)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {openSlots.slice(0, 4).map((slot: any) => (
                            <span key={slot.id} className="text-xs bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-full">{slot.label}</span>
                          ))}
                          {openSlots.length > 4 && <span className="text-xs text-muted-foreground">+{openSlots.length - 4} more</span>}
                        </div>
                      </div>
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className={`flex items-center gap-2 ${color} mb-1`}>
          {icon}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function MeetingCard({ meeting, badge, badgeColor }: { meeting: Meeting; badge?: string; badgeColor?: string }) {
  function fmt(dateStr: string, timeStr: string) {
    try { return format(parseISO(`${dateStr}T${timeStr}`), "EEE, MMM d · h:mm a"); } catch { return `${dateStr}`; }
  }

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <a className="flex items-start justify-between gap-2 border rounded-lg p-3 hover:border-primary/50 hover:bg-accent/30 transition-colors block">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{meeting.title}</p>
          <p className="text-xs text-muted-foreground">{fmt(meeting.date, meeting.startTime)}</p>
          {meeting.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{meeting.location}
            </p>
          )}
        </div>
        {badge && <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>{badge}</span>}
      </a>
    </Link>
  );
}
