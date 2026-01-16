import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";

interface PartyMember {
  id: string;
  party_id: string;
  user_id: string;
  joined_at: string;
  is_ready: boolean;
  display_name?: string;
  avatar_url?: string;
}

interface WatchPartyMembersOverlayProps {
  members: PartyMember[];
  maxVisible?: number;
  isKidsMode?: boolean;
}

export const WatchPartyMembersOverlay = ({ 
  members, 
  maxVisible = 5,
  isKidsMode = false 
}: WatchPartyMembersOverlayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const visibleMembers = members.slice(0, maxVisible);
  const remainingCount = members.length - maxVisible;

  if (members.length === 0) return null;

  return (
    <div className="absolute bottom-32 left-4 z-40">
      {/* Collapsed view - stacked avatars */}
      <div 
        className="flex flex-col-reverse gap-1 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] text-white font-medium">
            {members.length} watching
          </span>
        </div>

        {/* Member avatars */}
        <AnimatePresence>
          {visibleMembers.map((member, index) => {
            const displayName = member.display_name || "Guest";
            const initials = displayName.slice(0, 2).toUpperCase();
            
            return (
              <motion.div
                key={member.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <Avatar className={`h-8 w-8 border-2 ${isKidsMode ? 'border-violet-500' : 'border-brand'} shadow-lg`}>
                  <AvatarImage src={member.avatar_url} alt={displayName} />
                  <AvatarFallback className={`text-xs ${isKidsMode ? 'bg-violet-500/30 text-violet-200' : 'bg-brand/20 text-brand'}`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {/* Ready indicator dot */}
                {member.is_ready && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Remaining count badge */}
        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-black/70 border-2 border-white/30 text-white text-xs font-bold">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Expanded view - full member list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute left-12 bottom-0 bg-black/80 backdrop-blur-md rounded-xl p-3 min-w-[150px] max-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
              <Users className="h-4 w-4 text-white/70" />
              <span className="text-sm font-medium text-white">Party Members</span>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {members.map((member) => {
                const displayName = member.display_name || "Guest";
                const initials = displayName.slice(0, 2).toUpperCase();
                
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url} alt={displayName} />
                      <AvatarFallback className="text-[10px] bg-brand/20 text-brand">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-white truncate flex-1">{displayName}</span>
                    {member.is_ready && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-green-500/20 text-green-400 border-green-500/30">
                        Ready
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
