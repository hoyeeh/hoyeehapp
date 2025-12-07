import { Home, Film, Tv, List, Search, User, LogOut } from "lucide-react";
import { ViewState } from "@/types";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  userName?: string;
}

const navItems = [
  { icon: Home, label: "Home", view: "home" as ViewState },
  { icon: Film, label: "Movies", view: "movies" as ViewState },
  { icon: Tv, label: "TV Shows", view: "shows" as ViewState },
  { icon: List, label: "My List", view: "mylist" as ViewState },
];

export const Sidebar = ({ currentView, onNavigate, onLogout, userName }: SidebarProps) => {
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
                  onClick={() => onNavigate(item.view)}
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

      {/* User Section */}
      <div className="p-2 md:p-4 border-t border-sidebar-border">
        <div className="hidden md:flex items-center gap-3 px-3 py-2 mb-2">
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
