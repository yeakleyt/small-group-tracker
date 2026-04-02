import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import { LoginPage } from "@/pages/LoginPage";
import { InviteAcceptPage } from "@/pages/InviteAcceptPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { GroupsPage } from "@/pages/GroupsPage";
import { GroupDetailPage } from "@/pages/GroupDetailPage";
import { MeetingDetailPage } from "@/pages/MeetingDetailPage";
import { NewMeetingPage, EditMeetingPage } from "@/pages/MeetingFormPage";
import { CalendarPage, GroupCalendarPage } from "@/pages/CalendarPage";
import { InvitationsPage } from "@/pages/InvitationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AdminGroupsPage } from "@/pages/AdminGroupsPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 w-64">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/invite/:token" component={InviteAcceptPage} />
      {!user ? (
        <Route component={LoginPage} />
      ) : (
        <Route>
          {() => (
            <AppLayout>
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/groups" component={GroupsPage} />
                <Route path="/groups/:id/meetings/new" component={NewMeetingPage} />
                <Route path="/groups/:id/calendar" component={GroupCalendarPage} />
                <Route path="/groups/:id" component={GroupDetailPage} />
                <Route path="/meetings/:id/edit" component={EditMeetingPage} />
                <Route path="/meetings/:id" component={MeetingDetailPage} />
                <Route path="/calendar" component={CalendarPage} />
                <Route path="/invitations" component={InvitationsPage} />
                <Route path="/profile" component={ProfilePage} />
                {user.appRole === "app_admin" && <Route path="/admin/users" component={AdminUsersPage} />}
                {user.appRole === "app_admin" && <Route path="/admin/groups" component={AdminGroupsPage} />}
                <Route component={() => <NotFound />} />
              </Switch>
            </AppLayout>
          )}
        </Route>
      )}
    </Switch>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
      <p className="text-4xl font-bold text-muted-foreground">404</p>
      <p className="font-medium">Page not found</p>
      <a href="/" className="text-sm text-primary hover:underline">Go home</a>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
