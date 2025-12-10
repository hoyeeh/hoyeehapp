import { Tv, Wifi, WifiOff, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CastDevice } from '@/hooks/useUniversalCast';
import { cn } from '@/lib/utils';

interface CastDeviceListProps {
  devices: CastDevice[];
  connectedDevice: CastDevice | null;
  isConnecting: boolean;
  onConnect: (device: CastDevice) => void;
  onRemove: (deviceId: string) => void;
}

export function CastDeviceList({
  devices,
  connectedDevice,
  isConnecting,
  onConnect,
  onRemove,
}: CastDeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <Tv className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No paired devices</p>
        <p className="text-xs mt-1">Use "Link with TV code" to connect</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {devices.map((device) => {
        const isConnected = connectedDevice?.id === device.id;
        const isThisConnecting = isConnecting && !connectedDevice;

        return (
          <div
            key={device.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-colors",
              isConnected 
                ? "bg-primary/10 border-primary" 
                : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                isConnected ? "bg-primary/20" : "bg-muted"
              )}>
                <Tv className={cn(
                  "h-4 w-4",
                  isConnected ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium text-sm">{device.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {isConnected ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      {device.type === 'remote' ? 'Remote' : device.type}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isConnected && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onConnect(device)}
                    disabled={isThisConnecting}
                  >
                    {isThisConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(device.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isConnected && (
                <span className="text-xs text-green-500 font-medium">
                  Active
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}