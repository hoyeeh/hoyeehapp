import { Shield, UserX, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const AdminAccessBadge = () => {
  const { isAdminUser, isImpersonating, toggleImpersonation, hasFullAccess } = useSubscriptionAccess();

  if (!isAdminUser) return null;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isImpersonating ? "secondary" : "default"}
              className={isImpersonating 
                ? "bg-muted text-muted-foreground" 
                : "bg-brand text-white"
              }
            >
              <Shield className="h-3 w-3 mr-1" />
              {isImpersonating ? "Impersonating User" : "Admin Access"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {isImpersonating 
              ? "You're viewing the app as a regular user without subscription" 
              : "You have unlimited access to all content"
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleImpersonation}
              className="h-7 px-2"
            >
              {isImpersonating ? (
                <Shield className="h-4 w-4 text-brand" />
              ) : (
                <UserX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isImpersonating 
              ? "Return to admin mode" 
              : "Test as regular user (impersonate)"
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
