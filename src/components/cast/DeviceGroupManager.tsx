import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  FolderPlus, 
  Tv, 
  Home, 
  Bed, 
  Sofa, 
  UtensilsCrossed, 
  Monitor,
  MoreVertical,
  Pencil,
  Trash2,
  Cast,
  Airplay,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CastDevice, DeviceGroup, useCastHistory } from "@/hooks/useCastHistory";
import { toast } from "sonner";

const GROUP_ICONS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'living', icon: Sofa, label: 'Living Room' },
  { id: 'bedroom', icon: Bed, label: 'Bedroom' },
  { id: 'kitchen', icon: UtensilsCrossed, label: 'Kitchen' },
  { id: 'office', icon: Monitor, label: 'Office' },
  { id: 'tv', icon: Tv, label: 'TV Room' },
  { id: 'folder', icon: Folder, label: 'Custom' },
];

interface DeviceGroupManagerProps {
  trigger?: React.ReactNode;
}

export function DeviceGroupManager({ trigger }: DeviceGroupManagerProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("living");
  const [editingDevice, setEditingDevice] = useState<CastDevice | null>(null);
  const [deviceCustomName, setDeviceCustomName] = useState("");

  const castHistory = useCastHistory();

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    const group = castHistory.createGroup(newGroupName, selectedIcon);
    if (group) {
      toast.success(`Created "${group.name}" group`);
      setNewGroupName("");
      setSelectedIcon("living");
      setIsCreating(false);
    } else {
      toast.error("Maximum groups reached (10)");
    }
  };

  const handleUpdateGroup = () => {
    if (!editingGroup || !newGroupName.trim()) return;

    castHistory.updateGroup(editingGroup.id, { 
      name: newGroupName, 
      icon: selectedIcon 
    });
    toast.success("Group updated");
    setEditingGroup(null);
    setNewGroupName("");
    setSelectedIcon("living");
  };

  const handleDeleteGroup = (group: DeviceGroup) => {
    castHistory.deleteGroup(group.id);
    toast.success(`Deleted "${group.name}" group`);
  };

  const handleSaveDeviceName = () => {
    if (!editingDevice) return;

    castHistory.setDeviceCustomName(
      editingDevice.id, 
      editingDevice.type, 
      deviceCustomName || undefined
    );
    toast.success("Device name updated");
    setEditingDevice(null);
    setDeviceCustomName("");
  };

  const getIconComponent = (iconId?: string) => {
    const found = GROUP_ICONS.find(i => i.id === iconId);
    return found?.icon || Folder;
  };

  const getDeviceIcon = (type: CastDevice['type']) => {
    switch (type) {
      case 'chromecast': return Cast;
      case 'dlna': return Tv;
      case 'airplay': return Airplay;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <FolderPlus className="h-4 w-4" />
            Manage Groups
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-brand" />
            Device Groups
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Create/Edit Group Form */}
          {(isCreating || editingGroup) && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border/50">
              <h4 className="font-medium text-sm">
                {editingGroup ? "Edit Group" : "Create New Group"}
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Living Room"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_ICONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedIcon(item.id)}
                      className={cn(
                        "p-2 rounded-lg border transition-colors",
                        selectedIcon === item.id
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border hover:border-brand/50"
                      )}
                      title={item.label}
                    >
                      <item.icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingGroup(null);
                    setNewGroupName("");
                    setSelectedIcon("living");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                >
                  {editingGroup ? "Save Changes" : "Create Group"}
                </Button>
              </div>
            </div>
          )}

          {/* Groups List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Your Groups</h4>
              {!isCreating && !editingGroup && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-1" />
                  New Group
                </Button>
              )}
            </div>

            {castHistory.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No groups created yet. Create a group to organize your devices.
              </p>
            ) : (
              <div className="space-y-2">
                {castHistory.groups.map((group) => {
                  const IconComponent = getIconComponent(group.icon);
                  const groupDevices = castHistory.getDevicesByGroup(group.id);

                  return (
                    <div
                      key={group.id}
                      className="p-3 rounded-lg border border-border/50 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-brand/10 text-brand">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {groupDevices.length} device{groupDevices.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 hover:bg-muted rounded">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingGroup(group);
                                setNewGroupName(group.name);
                                setSelectedIcon(group.icon || "folder");
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteGroup(group)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {groupDevices.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                          {groupDevices.map((device) => {
                            const DeviceIcon = getDeviceIcon(device.type);
                            return (
                              <div 
                                key={`${device.type}-${device.id}`}
                                className="flex items-center gap-2 text-sm text-muted-foreground py-1"
                              >
                                <DeviceIcon className="h-3.5 w-3.5" />
                                <span className="truncate">
                                  {castHistory.getDeviceDisplayName(device)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Devices List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Your Devices</h4>
            
            {castHistory.devices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No devices in history yet. Connect to a casting device to see it here.
              </p>
            ) : (
              <div className="space-y-2">
                {castHistory.devices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.type);
                  const deviceGroup = castHistory.groups.find(g => g.id === device.groupId);

                  return (
                    <div
                      key={`${device.type}-${device.id}`}
                      className="p-3 rounded-lg border border-border/50 bg-card"
                    >
                      {editingDevice?.id === device.id && editingDevice?.type === device.type ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Custom name (optional)"
                            value={deviceCustomName}
                            onChange={(e) => setDeviceCustomName(e.target.value)}
                            maxLength={50}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingDevice(null);
                                setDeviceCustomName("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveDeviceName}>
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <DeviceIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {castHistory.getDeviceDisplayName(device)}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="capitalize">{device.type}</span>
                                {deviceGroup && (
                                  <>
                                    <span>•</span>
                                    <span>{deviceGroup.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Select
                              value={device.groupId || "none"}
                              onValueChange={(value) => {
                                castHistory.assignDeviceToGroup(
                                  device.id,
                                  device.type,
                                  value === "none" ? undefined : value
                                );
                                toast.success("Device group updated");
                              }}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue placeholder="No group" />
                              </SelectTrigger>
                              <SelectContent className="bg-card">
                                <SelectItem value="none">No group</SelectItem>
                                {castHistory.groups.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 hover:bg-muted rounded">
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-card">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingDevice(device);
                                    setDeviceCustomName(device.customName || "");
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    castHistory.removeDevice(device.id, device.type);
                                    toast.success("Device removed");
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
