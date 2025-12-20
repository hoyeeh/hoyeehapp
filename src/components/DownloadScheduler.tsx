import { useState } from "react";
import {
  Clock,
  Wifi,
  Moon,
  Calendar,
  Settings,
  Trash2,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useDownloadScheduler, ScheduledDownload } from "@/hooks/useDownloadScheduler";
import { Content } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ScheduleDownloadButtonProps {
  content: Content;
  episodeId?: string;
  episodeTitle?: string;
  quality?: string;
  onScheduled?: (scheduleId: string) => void;
}

export function ScheduleDownloadButton({
  content,
  episodeId,
  episodeTitle,
  quality = "720p",
  onScheduled,
}: ScheduleDownloadButtonProps) {
  const { scheduleDownload, settings, isOffPeakNow, isOnWifi, getNextOffPeakTime } = useDownloadScheduler();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>("");

  const handleSchedule = (type: ScheduledDownload['scheduleType']) => {
    let time: Date | undefined;
    if (type === 'specific-time' && scheduledTime) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      time = new Date();
      time.setHours(hours, minutes, 0, 0);
      if (time <= new Date()) {
        time.setDate(time.getDate() + 1);
      }
    }
    
    const id = scheduleDownload(content, episodeId, episodeTitle, quality, type, time);
    onScheduled?.(id);
    setShowTimePicker(false);
  };

  const nextOffPeak = getNextOffPeakTime();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="w-4 h-4" />
          Schedule
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Schedule Download
        </div>
        <DropdownMenuSeparator />
        
        {/* Download Now */}
        <DropdownMenuItem 
          onClick={() => handleSchedule('immediate')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Download Now</div>
            <div className="text-[10px] text-muted-foreground">Start immediately</div>
          </div>
        </DropdownMenuItem>
        
        {/* Wi-Fi Only */}
        <DropdownMenuItem 
          onClick={() => handleSchedule('wifi-only')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Wifi className={cn("w-4 h-4", isOnWifi ? "text-green-500" : "text-muted-foreground")} />
          <div className="flex-1">
            <div className="font-medium">When on Wi-Fi</div>
            <div className="text-[10px] text-muted-foreground">
              {isOnWifi ? "Connected now - will start" : "Waiting for Wi-Fi connection"}
            </div>
          </div>
          {isOnWifi && <Badge variant="secondary" className="text-[10px]">Ready</Badge>}
        </DropdownMenuItem>
        
        {/* Off-Peak Hours */}
        <DropdownMenuItem 
          onClick={() => handleSchedule('off-peak')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Moon className={cn("w-4 h-4", isOffPeakNow ? "text-primary" : "text-muted-foreground")} />
          <div className="flex-1">
            <div className="font-medium">Off-Peak Hours</div>
            <div className="text-[10px] text-muted-foreground">
              {isOffPeakNow 
                ? "In off-peak now - will start" 
                : `Next: ${format(nextOffPeak, 'HH:mm')} (${settings.offPeakStart} - ${settings.offPeakEnd})`
              }
            </div>
          </div>
          {isOffPeakNow && <Badge variant="secondary" className="text-[10px]">Now</Badge>}
        </DropdownMenuItem>
        
        {/* Specific Time */}
        {showTimePicker ? (
          <div className="px-2 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="h-8 text-sm"
              />
              <Button 
                size="sm" 
                className="h-8"
                disabled={!scheduledTime}
                onClick={() => handleSchedule('specific-time')}
              >
                Set
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem 
            onClick={(e) => {
              e.preventDefault();
              setShowTimePicker(true);
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">Specific Time</div>
              <div className="text-[10px] text-muted-foreground">Choose when to download</div>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface SchedulerSettingsDialogProps {
  trigger?: React.ReactNode;
}

export function SchedulerSettingsDialog({ trigger }: SchedulerSettingsDialogProps) {
  const { settings, updateSettings, isOffPeakNow, isOnWifi } = useDownloadScheduler();
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    updateSettings(localSettings);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Download Schedule Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Status Indicators */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className={cn(
              "flex items-center gap-2 text-sm",
              isOnWifi ? "text-green-500" : "text-muted-foreground"
            )}>
              <Wifi className="w-4 h-4" />
              {isOnWifi ? "On Wi-Fi" : "Mobile Data"}
            </div>
            <div className={cn(
              "flex items-center gap-2 text-sm",
              isOffPeakNow ? "text-primary" : "text-muted-foreground"
            )}>
              <Moon className="w-4 h-4" />
              {isOffPeakNow ? "Off-Peak Now" : "Peak Hours"}
            </div>
          </div>

          {/* Off-Peak Hours */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Off-Peak Hours</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  value={localSettings.offPeakStart}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, offPeakStart: e.target.value }))}
                  className="h-9"
                />
              </div>
              <span className="text-muted-foreground mt-5">to</span>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="time"
                  value={localSettings.offPeakEnd}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, offPeakEnd: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Downloads scheduled for off-peak will start during these hours
            </p>
          </div>

          {/* Wi-Fi Only */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Require Wi-Fi for scheduled downloads</Label>
              <p className="text-xs text-muted-foreground">
                Only start scheduled downloads when connected to Wi-Fi
              </p>
            </div>
            <Switch
              checked={localSettings.wifiOnlyEnabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, wifiOnlyEnabled: checked }))}
            />
          </div>

          {/* Auto Start */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto-start when conditions met</Label>
              <p className="text-xs text-muted-foreground">
                Automatically begin downloads when schedule criteria are satisfied
              </p>
            </div>
            <Switch
              checked={localSettings.autoStartEnabled}
              onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, autoStartEnabled: checked }))}
            />
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Settings
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduledDownloadsList() {
  const { 
    scheduledDownloads, 
    cancelScheduledDownload, 
    removeScheduledDownload,
    isOffPeakNow,
    isOnWifi,
    settings,
  } = useDownloadScheduler();
  const [isExpanded, setIsExpanded] = useState(true);

  const pendingDownloads = scheduledDownloads.filter(d => d.status === 'pending');
  const readyDownloads = scheduledDownloads.filter(d => d.status === 'ready');

  if (pendingDownloads.length === 0 && readyDownloads.length === 0) {
    return null;
  }

  const getScheduleInfo = (download: ScheduledDownload) => {
    switch (download.scheduleType) {
      case 'off-peak':
        return {
          icon: <Moon className="w-3.5 h-3.5" />,
          label: `Off-peak (${settings.offPeakStart} - ${settings.offPeakEnd})`,
          ready: isOffPeakNow && (!settings.wifiOnlyEnabled || isOnWifi),
        };
      case 'wifi-only':
        return {
          icon: <Wifi className="w-3.5 h-3.5" />,
          label: 'When on Wi-Fi',
          ready: isOnWifi,
        };
      case 'specific-time':
        return {
          icon: <Calendar className="w-3.5 h-3.5" />,
          label: download.scheduledTime 
            ? `At ${format(new Date(download.scheduledTime), 'HH:mm')}`
            : 'Scheduled',
          ready: download.scheduledTime ? Date.now() >= download.scheduledTime : false,
        };
      default:
        return {
          icon: <Zap className="w-3.5 h-3.5" />,
          label: 'Immediate',
          ready: true,
        };
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Scheduled Downloads</span>
          <Badge variant="secondary" className="text-xs">
            {pendingDownloads.length + readyDownloads.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {[...readyDownloads, ...pendingDownloads].map((download) => {
                const scheduleInfo = getScheduleInfo(download);
                
                return (
                  <div
                    key={download.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-0",
                      download.status === 'ready' && "bg-primary/5"
                    )}
                  >
                    {/* Thumbnail */}
                    {download.thumbnailUrl && (
                      <img
                        src={download.thumbnailUrl}
                        alt={download.title}
                        className="w-12 h-8 object-cover rounded"
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {download.episodeTitle || download.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {scheduleInfo.icon}
                        <span>{scheduleInfo.label}</span>
                        <Badge variant="outline" className="px-1 py-0 text-[10px]">
                          {download.quality}
                        </Badge>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {download.status === 'ready' ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Starting
                        </Badge>
                      ) : scheduleInfo.ready ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Waiting
                        </Badge>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (download.status === 'pending') {
                            cancelScheduledDownload(download.id);
                          }
                          removeScheduledDownload(download.id);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Settings Link */}
            <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isOnWifi ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <Wifi className="w-3 h-3" />
                )}
                <span>{isOnWifi ? 'On Wi-Fi' : 'Mobile'}</span>
                <span>•</span>
                <Moon className={cn("w-3 h-3", isOffPeakNow && "text-primary")} />
                <span>{isOffPeakNow ? 'Off-peak' : 'Peak hours'}</span>
              </div>
              <SchedulerSettingsDialog />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
