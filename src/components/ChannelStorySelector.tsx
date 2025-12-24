import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  thumbnail_url?: string | null;
}

interface ChannelStorySelectorProps {
  channels: Channel[];
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
  allLabel?: string;
  className?: string;
}

export function ChannelStorySelector({
  channels,
  selectedChannel,
  onSelectChannel,
  allLabel = "All",
  className
}: ChannelStorySelectorProps) {
  return (
    <div className={cn("px-4 md:px-8 py-4", className)}>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {/* All Channels Story */}
        <button
          onClick={() => onSelectChannel(null)}
          className="flex flex-col items-center gap-2 flex-shrink-0 group"
        >
          <div
            className={cn(
              "relative w-16 h-16 md:w-20 md:h-20 rounded-full p-[3px] transition-all duration-300",
              selectedChannel === null
                ? "bg-gradient-to-br from-primary via-chart-1 to-chart-2"
                : "bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10 group-hover:from-primary/60 group-hover:to-chart-1/60"
            )}
          >
            <div className="w-full h-full rounded-full bg-background p-[2px]">
              <div className={cn(
                "w-full h-full rounded-full flex items-center justify-center font-bold text-lg md:text-xl transition-colors",
                selectedChannel === null
                  ? "bg-gradient-to-br from-primary to-chart-1 text-primary-foreground"
                  : "bg-secondary text-secondary-foreground group-hover:bg-primary/10"
              )}>
                ✦
              </div>
            </div>
          </div>
          <span className={cn(
            "text-xs md:text-sm font-medium max-w-16 md:max-w-20 truncate transition-colors",
            selectedChannel === null ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}>
            {allLabel}
          </span>
        </button>

        {/* Channel Stories */}
        {channels?.map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className="flex flex-col items-center gap-2 flex-shrink-0 group"
          >
            <div
              className={cn(
                "relative w-16 h-16 md:w-20 md:h-20 rounded-full p-[3px] transition-all duration-300",
                selectedChannel === channel.id
                  ? "bg-gradient-to-br from-primary via-chart-1 to-chart-2"
                  : "bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10 group-hover:from-primary/60 group-hover:to-chart-1/60"
              )}
            >
              <div className="w-full h-full rounded-full bg-background p-[2px]">
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full rounded-full flex items-center justify-center font-bold text-lg md:text-xl uppercase",
                    selectedChannel === channel.id
                      ? "bg-gradient-to-br from-primary to-chart-1 text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}>
                    {channel.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
            <span className={cn(
              "text-xs md:text-sm font-medium max-w-16 md:max-w-20 truncate transition-colors text-center",
              selectedChannel === channel.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
            )}>
              {channel.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
