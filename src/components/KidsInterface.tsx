import { ReactNode } from "react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Baby, Home, Search, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface KidsInterfaceProps {
  children: ReactNode;
}

export const KidsInterface = ({ children }: KidsInterfaceProps) => {
  const { currentProfile, setCurrentProfile } = useProfileContext();
  const navigate = useNavigate();

  if (!currentProfile?.is_kids) {
    return <>{children}</>;
  }

  // Kids mode wrapper with simplified UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-950 via-background to-purple-950">
      {/* Kids Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-gradient-to-b from-cyan-900/80 to-transparent">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Baby className="h-8 w-8 text-cyan-400" />
            <span className="font-display text-2xl text-cyan-400">
              Kids
            </span>
          </div>
          
          <button
            onClick={() => {
              localStorage.removeItem("hoyeeh_current_profile");
              setCurrentProfile(null as any);
              navigate("/");
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit Kids
          </button>
        </div>
      </header>

      {/* Kids Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-cyan-900/90 to-transparent px-4 py-3 safe-area-bottom">
        <div className="flex justify-around max-w-md mx-auto">
          <NavButton icon={Home} label="Home" onClick={() => navigate("/")} />
          <NavButton icon={Search} label="Search" onClick={() => navigate("/search")} />
          <NavButton icon={List} label="My List" onClick={() => navigate("/my-list")} />
        </div>
      </nav>

      {/* Content with padding for header/nav */}
      <main className="pt-16 pb-20">
        {children}
      </main>
    </div>
  );
};

const NavButton = ({ 
  icon: Icon, 
  label, 
  onClick,
  active = false
}: { 
  icon: typeof Home; 
  label: string; 
  onClick: () => void;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors",
      active ? "text-cyan-400" : "text-muted-foreground hover:text-cyan-300"
    )}
  >
    <Icon className="h-6 w-6" />
    <span className="text-xs font-medium">{label}</span>
  </button>
);
