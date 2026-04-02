import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Users, CalendarDays, Mail,
  Menu, LogOut, User as UserIcon, Shield, UsersRound
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: UsersRound },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/invitations", label: "Invitations", icon: Mail },
];

const adminNavItems = [
  { href: "/admin/users", label: "All Users", icon: Users },
  { href: "/admin/groups", label: "All Groups", icon: Shield },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
    const isActive = href === "/" ? location === "/" : location.startsWith(href);
    return (
      <Link href={href}>
        <span
          role="button"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </span>
      </Link>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-label="Small Group Tracker" fill="none">
            <circle cx="16" cy="16" r="14" stroke="hsl(239,65%,65%)" strokeWidth="2" />
            <circle cx="10" cy="14" r="3" fill="hsl(239,65%,65%)" />
            <circle cx="22" cy="14" r="3" fill="hsl(239,65%,65%)" />
            <circle cx="16" cy="20" r="3" fill="hsl(239,65%,65%)" />
            <line x1="10" y1="14" x2="16" y2="20" stroke="hsl(239,65%,65%)" strokeWidth="1.5" />
            <line x1="22" y1="14" x2="16" y2="20" stroke="hsl(239,65%,65%)" strokeWidth="1.5" />
            <line x1="10" y1="14" x2="22" y2="14" stroke="hsl(239,65%,65%)" strokeWidth="1.5" />
          </svg>
          <span className="font-semibold text-sidebar-foreground text-sm">Small Groups</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {user?.appRole === "app_admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">Admin</p>
            </div>
            {adminNavItems.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <span className="flex items-center gap-2 cursor-pointer w-full"><UserIcon className="h-4 w-4" />Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 border-r border-border">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">Small Group Tracker</span>
          {user?.appRole === "app_admin" && (
            <Badge variant="secondary" className="ml-auto text-xs">Admin</Badge>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
