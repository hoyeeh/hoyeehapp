import { Film, Users, CreditCard, Shield, BarChart3, Bell, Settings, Home, Tv, Upload, Clapperboard, Tag, Trophy, LayoutGrid, Clock, Image, Send, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useIsSuperAdmin } from "@/hooks/useSuperAdmin";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "content", label: "Content", icon: Film },
  { id: "tvshows", label: "TV Shows", icon: Tv },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "transcoding", label: "Transcoding", icon: Clapperboard },
  { id: "genres", label: "Genres", icon: Tag },
  { id: "top10", label: "Top 10", icon: Trophy },
  { id: "homepage", label: "Home Page", icon: LayoutGrid },
  { id: "comingsoon", label: "Coming Soon", icon: Clock },
  { id: "banners", label: "Hero Banners", icon: Image },
  { id: "users", label: "Users", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "push", label: "Push Notifications", icon: Send },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return (
    <aside className="fixed left-0 top-0 h-full w-16 md:w-64 bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Logo className="hidden md:block" />
          <span className="hidden md:inline text-muted-foreground text-sm">Admin</span>
        </div>
        <div className="md:hidden text-primary font-display text-xl font-bold">A</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 md:p-4 overflow-y-auto">
        {/* Super Admin Section */}
        {isSuperAdmin && (
          <div className="mb-4">
            <button
              onClick={() => onTabChange("superadmin")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors mb-2",
                activeTab === "superadmin"
                  ? "bg-amber-500 text-white"
                  : "text-amber-500 hover:bg-amber-500/20 border border-amber-500/30"
              )}
            >
              <Crown className="h-5 w-5 flex-shrink-0" />
              <span className="hidden md:inline font-medium">Super Admin</span>
            </button>
            <div className="border-b border-sidebar-border mb-2" />
          </div>
        )}

        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
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

      {/* Settings */}
      <div className="p-2 md:p-4 border-t border-sidebar-border">
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
            activeTab === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className="hidden md:inline font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
};
