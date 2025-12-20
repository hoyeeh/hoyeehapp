import { useState } from 'react';
import { Cast, Tv, Airplay, Monitor, Loader, HelpCircle, FolderOpen, Home, Bed, Sofa, UtensilsCrossed, Folder, X, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGoogleCast } from '@/hooks/useGoogleCast';
import { useDLNA, DLNADevice } from '@/hooks/useDLNA';
import { useAirPlay } from '@/hooks/useAirPlay';
import { useCastHistory } from '@/hooks/useCastHistory';
import { CastSetupGuide } from './CastSetupGuide';
import { DeviceGroupManager } from './DeviceGroupManager';
import { NativeCastButton } from './NativeCastButton';
import { AirPlayButton } from './AirPlayButton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface CastPanelProps {
  videoUrl?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  startTime?: number;
  onCastStart?: (type: 'chromecast' | 'dlna' | 'airplay') => void;
  onCastEnd?: () => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function CastPanel({
  videoUrl,
  videoTitle,
  videoThumbnail,
  startTime = 0,
  onCastStart,
  onCastEnd,
  trigger,
  className,
}: CastPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const googleCast = useGoogleCast({
    mediaUrl: videoUrl,
    mediaTitle: videoTitle,
    mediaThumbnail: videoThumbnail,
    onConnectionChange: (connected) => {
      if (connected) {
        onCastStart?.('chromecast');
        if (videoUrl && videoTitle) {
          googleCast.loadMedia(videoUrl, videoTitle, videoThumbnail, startTime);
        }
      } else {
        onCastEnd?.();
      }
    },
  });

  const dlna = useDLNA();
  const airPlay = useAirPlay({
    onConnect: () => {
      onCastStart?.('airplay');
      toast.success('Connected to AirPlay');
    },
    onDisconnect: () => {
      onCastEnd?.();
    },
  });

  const castHistory = useCastHistory();

  const handleDLNAConnect = (device: DLNADevice) => {
    dlna.connectToDevice(device);
    if (videoUrl && videoTitle) {
      setTimeout(() => {
        dlna.playMedia(videoUrl, videoTitle, startTime);
        onCastStart?.('dlna');
      }, 500);
    }
  };

  const isAnyCasting = googleCast.isConnected || dlna.connectedDevice || airPlay.isConnected;

  const getGroupIcon = (icon: string) => {
    switch (icon) {
      case 'home': return Home;
      case 'living': return Sofa;
      case 'bedroom': return Bed;
      case 'kitchen': return UtensilsCrossed;
      case 'office': return Monitor;
      case 'tv': return Tv;
      default: return Folder;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'relative',
              isAnyCasting && 'text-primary bg-primary/10',
              className
            )}
          >
            <Cast className={cn('h-5 w-5', isAnyCasting && 'fill-current')} />
            {isAnyCasting && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-primary rounded-full animate-pulse" />
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[350px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Cast className="h-5 w-5" />
            Cast to Device
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quick Cast Buttons */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Quick Cast</h4>
            <div className="flex gap-3">
              <NativeCastButton
                videoUrl={videoUrl}
                videoTitle={videoTitle}
                videoThumbnail={videoThumbnail}
                startTime={startTime}
                onConnect={() => onCastStart?.('chromecast')}
                onDisconnect={onCastEnd}
                variant="full"
                showLabel
                className="flex-1"
              />
              <AirPlayButton
                variant="full"
                className="flex-1"
              />
            </div>
          </div>

          <Separator />

          {/* Chromecast Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Cast className="h-4 w-4" />
                Chromecast
              </h4>
              {googleCast.isConnected && (
                <span className="text-xs text-primary font-medium">Connected</span>
              )}
            </div>
            
            <div className="space-y-2">
              {googleCast.isInitialized ? (
                googleCast.isAvailable ? (
                  <button
                    onClick={() => {
                      if (googleCast.isConnected) {
                        googleCast.disconnect();
                      } else {
                        googleCast.connect();
                      }
                    }}
                    className={cn(
                      'w-full p-3 rounded-lg border transition-colors flex items-center gap-3',
                      googleCast.isConnected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    <Cast className={cn('h-5 w-5', googleCast.isConnected && 'text-primary')} />
                    <div className="flex-1 text-left">
                      <p className={cn('font-medium', googleCast.isConnected && 'text-primary')}>
                        {googleCast.isConnected ? googleCast.deviceName : 'Chromecast Device'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {googleCast.isConnected ? 'Tap to disconnect' : 'Tap to connect'}
                      </p>
                    </div>
                    {googleCast.isConnected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          googleCast.disconnect();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <WifiOff className="h-4 w-4" />
                      No Chromecast devices found
                    </div>
                    <p className="text-xs mt-1">Make sure your device is on the same network</p>
                  </div>
                )
              ) : (
                <div className="p-3 rounded-lg border border-border flex items-center gap-3">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Discovering devices...</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* DLNA Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Tv className="h-4 w-4" />
                DLNA / Smart TV
              </h4>
              {dlna.connectedDevice && (
                <span className="text-xs text-primary font-medium">Connected</span>
              )}
            </div>

            <div className="space-y-2">
              {dlna.connectedDevice ? (
                <button
                  onClick={() => dlna.disconnect()}
                  className="w-full p-3 rounded-lg border border-primary bg-primary/10 transition-colors flex items-center gap-3"
                >
                  <Tv className="h-5 w-5 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-primary">{dlna.connectedDevice.name}</p>
                    <p className="text-xs text-muted-foreground">Tap to disconnect</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      dlna.disconnect();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => dlna.scanForDevices()}
                    disabled={dlna.isScanning}
                  >
                    {dlna.isScanning ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4" />
                    )}
                    {dlna.isScanning ? 'Scanning...' : 'Scan for DLNA Devices'}
                  </Button>

                  {dlna.devices.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {dlna.devices.map((device) => (
                        <button
                          key={device.id}
                          onClick={() => handleDLNAConnect(device)}
                          className="w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center gap-3"
                        >
                          <Monitor className="h-5 w-5" />
                          <span className="flex-1 text-left font-medium">{device.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* AirPlay Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Airplay className="h-4 w-4" />
                AirPlay
              </h4>
              {airPlay.isConnected && (
                <span className="text-xs text-primary font-medium">Connected</span>
              )}
            </div>

            <div className="space-y-2">
              {airPlay.isAvailable ? (
                <button
                  onClick={() => airPlay.showPicker()}
                  className={cn(
                    'w-full p-3 rounded-lg border transition-colors flex items-center gap-3',
                    airPlay.isConnected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <Airplay className={cn('h-5 w-5', airPlay.isConnected && 'text-primary')} />
                  <div className="flex-1 text-left">
                    <p className={cn('font-medium', airPlay.isConnected && 'text-primary')}>
                      {airPlay.isConnected ? airPlay.deviceName || 'AirPlay Device' : 'AirPlay'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {airPlay.isConnected ? 'Tap to change device' : 'Tap to select device'}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <Airplay className="h-4 w-4" />
                    AirPlay not available
                  </div>
                  <p className="text-xs mt-1">AirPlay is only available in Safari on Mac/iOS</p>
                </div>
              )}
            </div>
          </div>

          {/* Device Groups */}
          {castHistory.groups.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Device Groups</h4>
                <div className="space-y-2">
                  {castHistory.groups.map((group) => {
                    const groupDevices = castHistory.getDevicesByGroup(group.id);
                    if (groupDevices.length === 0) return null;
                    const GroupIcon = getGroupIcon(group.icon);

                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          const device = groupDevices[0];
                          if (device.type === 'chromecast') {
                            googleCast.connect();
                          } else if (device.type === 'dlna') {
                            dlna.scanForDevices();
                          } else if (device.type === 'airplay' && airPlay.isAvailable) {
                            airPlay.showPicker();
                          }
                        }}
                        className="w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center gap-3"
                      >
                        <GroupIcon className="h-5 w-5 text-primary" />
                        <div className="flex-1 text-left">
                          <p className="font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {groupDevices.length} device{groupDevices.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Recent Devices */}
          {castHistory.getUngroupedDevices().length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Recent Devices</h4>
                <div className="space-y-2">
                  {castHistory.getUngroupedDevices().slice(0, 5).map((device) => (
                    <button
                      key={`${device.type}-${device.id}`}
                      onClick={() => {
                        if (device.type === 'chromecast') {
                          googleCast.connect();
                        } else if (device.type === 'dlna') {
                          dlna.scanForDevices();
                        } else if (device.type === 'airplay' && airPlay.isAvailable) {
                          airPlay.showPicker();
                        }
                      }}
                      className="w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      {device.type === 'chromecast' && <Cast className="h-5 w-5" />}
                      {device.type === 'dlna' && <Tv className="h-5 w-5" />}
                      {device.type === 'airplay' && <Airplay className="h-5 w-5" />}
                      <span className="flex-1 text-left font-medium truncate">
                        {castHistory.getDeviceDisplayName(device)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Help & Settings */}
          <div className="space-y-2">
            <DeviceGroupManager
              trigger={
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full p-2 rounded hover:bg-accent">
                  <FolderOpen className="h-4 w-4" />
                  Manage device groups
                </button>
              }
            />
            <CastSetupGuide
              trigger={
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full p-2 rounded hover:bg-accent">
                  <HelpCircle className="h-4 w-4" />
                  Need help setting up?
                </button>
              }
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
