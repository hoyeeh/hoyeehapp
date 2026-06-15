import { useState } from "react";
import { Home, Film, Tv, List, LogOut, CreditCard, Shield, User, LayoutDashboard, Download, Search, Layers, ChevronDown, ChevronUp, Baby, Bell, MessageCircle, Youtube, Clock, Store, Palette, Users, RefreshCw } from "lucide-react";
import { ViewState } from "@/types";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useIsCreator } from "@/hooks/useCreator";
import NotificationBell from "./NotificationBell";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { useProfileContext } from "@/contexts/ProfileContext";
import { AdminAccessBadge } from "./AdminAccessBadge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SidebarProps {
  currentView: ViewState | 'dashboard' | 'downloads' | 'search' | 'parental';
  onNavigate: (view: ViewState | 'dashboard' | 'downloads' | 'search' | 'parental') => void;
  onLogout: () => void;
  userName?: string;
}

const navItems = [
  { icon: Home, label: "Home", view: "home" as ViewState },
  { icon: Search, label: "Search", view: "search" as const },
  { icon: Layers, label: "Genres", view: "genres" as const },
  { icon: Film, label: "Movies", view: "movies" as ViewState },
  { icon: Tv, label: "TV Shows", view: "shows" as ViewState },
  { icon: Youtube, label: "Channels", view: "youtube" as const },
  { icon: Users, label: "Watch Party", view: "watch-party" as const },
  { icon: Store, label: "Hoyeeh Studio", view: "creator-store" as const },
  { icon: Clock, label: "Watch Later", view: "watch-later" as const },
  { icon: List, label: "My List", view: "mylist" as ViewState },
];

export const Sidebar = ({ currentView, onNavigate, onLogout, userName }: SidebarProps) => {
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();
  const { data: isCreator } = useIsCreator();
  const { setCurrentProfile, currentProfile } = useProfileContext();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <aside className="fixed left-0 top-0 h-full w-16 md:w-64 bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-sidebar-border">
        <Logo className="hidden md:block" />
        <div className="md:hidden text-brand font-display text-xl font-bold">H</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 md:p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <li key={item.view}>
                <button
                  onClick={() => {
                    if (item.view === "mylist") {
                      navigate("/my-list");
                    } else if (item.view === "search") {
                      navigate("/search");
                    } else if (item.view === "genres") {
                      navigate("/genres");
                    } else if (item.view === "youtube") {
                      navigate("/youtube");
                    } else if (item.view === "watch-party") {
                      window.dispatchEvent(new CustomEvent('toggleWatchParty'));
                    } else if (item.view === "watch-later") {
                      navigate("/watch-later");
                    } else if (item.view === "creator-store") {
                      navigate("/creator-store");
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

      {/* Bottom Section - User Menu */}
      <div className="p-2 md:p-4 border-t border-sidebar-border">
        <Collapsible open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-brand" />
              </div>
              <div className="hidden md:flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-medium text-sm truncate max-w-[120px]">
                      {currentProfile?.name || userName || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">Account</p>
                  </div>
                  {isUserMenuOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
              </div>
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-1 mt-1">
            {/* Admin Access Badge - at the top of menu */}
            {isAdmin && (
              <div className="px-3 py-2">
                <AdminAccessBadge />
              </div>
            )}
            {/* Dashboard */}
            <button
              onClick={() => onNavigate("dashboard" as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                currentView === "dashboard"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Dashboard</span>
            </button>

            {/* Downloads */}
            <button
              onClick={() => navigate("/downloads")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                currentView === "downloads"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Download className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Downloads</span>
            </button>

            {/* Offline Downloads (non-DRM) */}
            <button
              onClick={() => navigate("/offline-downloads")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                currentView === "offline-downloads"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Download className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Offline</span>
            </button>

            {/* Notifications */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <div className="ml-1">
                <NotificationBell />
              </div>
              <span className="hidden md:inline text-sm">Notifications</span>
            </div>

            {/* Notification Preferences */}
            <button
              onClick={() => navigate("/notifications")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Bell className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Notification Settings</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <User className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Profile Settings</span>
            </button>

            {/* Subscription */}
            <button
              onClick={() => navigate("/subscription")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <CreditCard className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Subscription</span>
            </button>

            {/* Parental Dashboard */}
            <button
              onClick={() => onNavigate("parental" as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                currentView === "parental"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-cyan-500 hover:bg-sidebar-accent"
              )}
            >
              <Baby className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Parental Controls</span>
            </button>

            {/* Creator Dashboard - Only for creators */}
            {isCreator && (
              <button
                onClick={() => navigate("/creator-dashboard")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-amber-500 hover:bg-sidebar-accent transition-colors"
              >
                <Palette className="h-4 w-4 flex-shrink-0 ml-1" />
                <span className="hidden md:inline text-sm">Creator Dashboard</span>
              </button>
            )}

            {/* Admin Link - Only for admins */}
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-brand hover:bg-sidebar-accent transition-colors"
              >
                <Shield className="h-4 w-4 flex-shrink-0 ml-1" />
                <span className="hidden md:inline text-sm">Admin Panel</span>
              </button>
            )}

            {/* Switch Profile Button */}
            <button
              onClick={() => {
                setCurrentProfile(null);
                navigate("/profiles");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <RefreshCw className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Switch Profile</span>
            </button>

            {/* Profile Switcher */}
            <div className="px-1 py-1">
              <ProfileSwitcher 
                onManageProfiles={() => {
                  setCurrentProfile(null);
                  navigate("/");
                }}
              />
            </div>
            
            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4 flex-shrink-0 ml-1" />
              <span className="hidden md:inline text-sm">Sign Out</span>
            </button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
};
