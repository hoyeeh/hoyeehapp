import { Home, Film, Tv, List, LogOut, CreditCard, Shield, User, LayoutDashboard } from "lucide-react";
import { ViewState } from "@/types";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useAdmin";
import NotificationBell from "./NotificationBell";

interface SidebarProps {
  currentView: ViewState | 'dashboard';
  onNavigate: (view: ViewState | 'dashboard') => void;
  onLogout: () => void;
  userName?: string;
}

const navItems = [
  { icon: Home, label: "Home", view: "home" as ViewState },
  { icon: LayoutDashboard, label: "Dashboard", view: "dashboard" as const },
  { icon: Film, label: "Movies", view: "movies" as ViewState },
  { icon: Tv, label: "TV Shows", view: "shows" as ViewState },
  { icon: List, label: "My List", view: "mylist" as ViewState },
];

export const Sidebar = ({ currentView, onNavigate, onLogout, userName }: SidebarProps) => {
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();

  return (
    <aside className="fixed left-0 top-0 h-full w-16 md:w-64 bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-sidebar-border">
        <Logo className="hidden md:block" />
        <div className="md:hidden text-brand font-display text-xl font-bold">H</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 md:p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <li key={item.view}>
                <button
                  onClick={() => {
                    if (item.view === "mylist") {
                      navigate("/my-list");
                    } else {
                      onNavigate(item.view);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="hidden md:inline font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="p-2 md:p-4 border-t border-sidebar-border space-y-1">
        {/* Notifications */}
        <div className="flex items-center justify-center md:justify-start px-3 py-2">
          <NotificationBell />
          <span className="hidden md:inline font-medium ml-3">Notifications</span>
        </div>

        {/* Profile Link */}
        <button
          onClick={() => navigate("/profile")}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <User className="h-5 w-5 flex-shrink-0" />
          <span className="hidden md:inline font-medium">Profile</span>
        </button>

        {/* Subscription Link */}
        <button
          onClick={() => navigate("/subscription")}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <CreditCard className="h-5 w-5 flex-shrink-0" />
          <span className="hidden md:inline font-medium">Subscription</span>
        </button>

        {/* Admin Link - Only for admins */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-brand hover:bg-sidebar-accent transition-colors"
          >
            <Shield className="h-5 w-5 flex-shrink-0" />
            <span className="hidden md:inline font-medium">Admin</span>
          </button>
        )}

        {/* User Info */}
        <div className="hidden md:flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-primary-foreground font-semibold text-sm">
            {userName?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-sm font-medium truncate">{userName || "User"}</span>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className="hidden md:inline font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
