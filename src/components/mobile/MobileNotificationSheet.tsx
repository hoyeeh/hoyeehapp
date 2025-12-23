import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, CheckCheck, Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
  Notification 
} from "@/hooks/useNotifications";

interface MobileNotificationSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNotificationSheet({ open, onClose }: MobileNotificationSheetProps) {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    
    // Navigate to content if available
    if (notification.content_id) {
      onClose();
      navigate(`/content/${notification.content_id}`);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_release":
        return "🎬";
      case "subscription":
        return "💳";
      case "coming_soon":
        return "📅";
      case "kids":
        return "👶";
      default:
        return "🔔";
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[210] bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Notifications</h2>
                {unreadCount && unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount && unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markAllRead.isPending}
                    className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                    aria-label="Mark all as read"
                  >
                    {markAllRead.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-5 w-5" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    onClose();
                    navigate("/notification-preferences");
                  }}
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                  aria-label="Notification settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button 
                  onClick={onClose} 
                  className="p-2 rounded-full hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[55vh] pb-24">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {notifications.map((notification) => (
                    <motion.button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full flex items-start gap-3 p-4 text-left transition-colors",
                        !notification.read 
                          ? "bg-primary/5 hover:bg-primary/10" 
                          : "hover:bg-secondary/50"
                      )}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg",
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
                            <span className="flex-shrink-0 w-2 h-2 mt-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No notifications yet</p>
                  <p className="text-sm text-muted-foreground/70 text-center mt-1">
                    We'll notify you about new releases and updates
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
