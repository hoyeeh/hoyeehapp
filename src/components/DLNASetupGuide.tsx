import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tv, Smartphone, Wifi, Settings, Plus, Trash2, Play, MonitorSpeaker } from 'lucide-react';
import { toast } from 'sonner';

interface SavedDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

interface DLNASetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceSelect?: (device: SavedDevice) => void;
}

const STORAGE_KEY = 'dlna_saved_devices';

export function DLNASetupGuide({ open, onOpenChange, onDeviceSelect }: DLNASetupGuideProps) {
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newDevice, setNewDevice] = useState({
    name: '',
    ipAddress: '',
    port: '8080',
  });
  
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const saveDevices = (devices: SavedDevice[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    setSavedDevices(devices);
  };

  const handleAddDevice = () => {
    if (!newDevice.name.trim() || !newDevice.ipAddress.trim()) {
      toast.error('Please enter device name and IP address');
      return;
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newDevice.ipAddress)) {
      toast.error('Please enter a valid IP address');
      return;
    }

    const device: SavedDevice = {
      id: Date.now().toString(),
      name: newDevice.name.trim(),
      ipAddress: newDevice.ipAddress.trim(),
      port: parseInt(newDevice.port) || 8080,
    };

    saveDevices([...savedDevices, device]);
    setNewDevice({ name: '', ipAddress: '', port: '8080' });
    toast.success(`${device.name} added successfully`);
  };

  const handleRemoveDevice = (id: string) => {
    saveDevices(savedDevices.filter(d => d.id !== id));
    toast.info('Device removed');
  };

  const handleConnectDevice = async (device: SavedDevice) => {
    setIsConnecting(device.id);
    
    // Simulate connection attempt
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsConnecting(null);
    onDeviceSelect?.(device);
    toast.success(`Connected to ${device.name}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5" />
            DLNA/UPnP Setup
          </DialogTitle>
          <DialogDescription>
            Cast to smart TVs and media devices that don't support Google Cast
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Setup</TabsTrigger>
            <TabsTrigger value="guide">Companion App</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Device Manually
                </CardTitle>
                <CardDescription>
                  Enter your TV's IP address to connect directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device Name</Label>
                    <Input
                      id="device-name"
                      placeholder="Living Room TV"
                      value={newDevice.name}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ip-address">IP Address</Label>
                    <Input
                      id="ip-address"
                      placeholder="192.168.1.100"
                      value={newDevice.ipAddress}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, ipAddress: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port (optional)</Label>
                    <Input
                      id="port"
                      placeholder="8080"
                      value={newDevice.port}
                      onChange={(e) => setNewDevice(prev => ({ ...prev, port: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddDevice} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Device
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 mt-4">
                  <p className="font-medium">How to find your TV's IP address:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Samsung: Settings → General → Network → Network Status</li>
                    <li>LG: Settings → Network → Wi-Fi Connection → Advanced</li>
                    <li>Sony: Settings → Network → Network Settings → View Network Status</li>
                    <li>Roku: Settings → Network → About</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {savedDevices.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MonitorSpeaker className="h-4 w-4" />
                    Saved Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {savedDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Tv className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.ipAddress}:{device.port}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleConnectDevice(device)}
                            disabled={isConnecting === device.id}
                          >
                            {isConnecting === device.id ? (
                              'Connecting...'
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Connect
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveDevice(device.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guide" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Companion App Setup
                </CardTitle>
                <CardDescription>
                  Use a companion app to discover DLNA devices on your local network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium">Download a DLNA Discovery App</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Install one of these apps on your phone:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-background rounded text-xs">BubbleUPnP (Android)</span>
                        <span className="px-2 py-1 bg-background rounded text-xs">LocalCast (Android)</span>
                        <span className="px-2 py-1 bg-background rounded text-xs">TV Cast (iOS)</span>
                        <span className="px-2 py-1 bg-background rounded text-xs">AllConnect (iOS)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        Connect to the Same Network
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Make sure your phone and TV are connected to the same Wi-Fi network for device discovery to work.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium">Scan for Devices</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Open the app and scan for DLNA/UPnP devices. Note down your TV's IP address from the device details.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Add Device Manually
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Go to the "Manual Setup" tab and enter your TV's IP address to save it for quick access.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <h4 className="font-medium text-primary mb-2">Why Manual Setup?</h4>
                  <p className="text-sm text-muted-foreground">
                    Web browsers cannot perform UDP multicast discovery (SSDP) required for automatic DLNA device discovery. 
                    This is a security limitation of web browsers. By using a companion app or manually entering your TV's IP address, 
                    you can still enjoy DLNA casting from our web app.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
