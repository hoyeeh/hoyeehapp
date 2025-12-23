import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Bell, Settings, CheckCheck, Loader2, 
  Filter, Trash2, Film, Calendar, CreditCard, Baby, Megaphone
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
  Notification 
} from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

type NotificationFilter = "all" | "unread" | "new_release" | "subscription" | "coming_soon" | "kids" | "promotional";

const filterOptions: { value: NotificationFilter; label: string; icon?: React.ElementType }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "new_release", label: "Releases", icon: Film },
  { value: "subscription", label: "Subscription", icon: CreditCard },
  { value: "coming_soon", label: "Coming Soon", icon: Calendar },
  { value: "kids", label: "Kids", icon: Baby },
  { value: "promotional", label: "Promo", icon: Megaphone },
];

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  
  const { data: notifications, isLoading, refetch } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Filter notifications based on active filter
  const filteredNotifications = notifications?.filter(notification => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.read;
    return notification.type === activeFilter;
  }) || [];

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at);
    let key = format(date, "yyyy-MM-dd");
    
    if (isToday(date)) {
      key = "Today";
    } else if (isYesterday(date)) {
      key = "Yesterday";
    } else {
      key = format(date, "MMMM d, yyyy");
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    
    if (notification.content_id) {
      navigate(`/content/${notification.content_id}`);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
    toast.success("All notifications marked as read");
  };

  const handleClearAll = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success("All notifications cleared");
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_release": return "🎬";
      case "subscription": return "💳";
      case "coming_soon": return "📅";
      case "kids": return "👶";
      case "promotional": return "📢";
      default: return "🔔";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please sign in to view notifications</p>
          <Button className="mt-4" onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  const content = (
    <div className={cn("min-h-screen bg-background", isMobile && "pb-20")}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border",
        isMobile && "pt-safe"
      )}>
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Notifications</h1>
              {unreadCount && unreadCount > 0 && (
                <Badge variant="default" className="h-5 min-w-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {unreadCount && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
              >
                {markAllRead.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCheck className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notification-preferences")}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {filterOptions.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  "border active:scale-95",
                  activeFilter === filter.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {filter.icon && <filter.icon className="h-3.5 w-3.5" />}
                {filter.label}
                {filter.value === "unread" && unreadCount ? (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-foreground/20 rounded-full">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                  {date}
                </h3>
                <div className="space-y-2">
                  {items.map((notification) => (
                    <motion.button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all",
                        !notification.read 
                          ? "bg-primary/5 border border-primary/20 hover:bg-primary/10" 
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl",
                        !notification.read ? "bg-primary/20" : "bg-secondary"
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "font-medium line-clamp-1",
                            !notification.read && "text-primary"
                          )}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="flex-shrink-0 w-2.5 h-2.5 mt-1.5 bg-primary rounded-full animate-pulse" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}

            {/* Clear all button at bottom */}
            {filteredNotifications.length > 0 && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Notifications
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Bell className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">
              {activeFilter === "all" ? "No notifications yet" : `No ${activeFilter.replace("_", " ")} notifications`}
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs">
              {activeFilter === "all" 
                ? "We'll notify you about new releases, updates, and more"
                : "Try selecting a different filter to see more notifications"}
            </p>
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );

  // Wrap with pull-to-refresh on mobile
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        {content}
      </PullToRefresh>
    );
  }

  return content;
};

export default Notifications;
