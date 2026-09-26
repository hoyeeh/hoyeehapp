import { useState, useEffect, useCallback } from 'react';

export interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'dlna' | 'airplay' | 'remote';
  lastUsed: number;
  /** TV-code sessions only: the cast-signaling session to resume. */
  sessionId?: string;
  groupId?: string;
  customName?: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
}

const STORAGE_KEY = 'cast_device_history';
const GROUPS_STORAGE_KEY = 'cast_device_groups';
const MAX_DEVICES = 10;
const MAX_GROUPS = 10;

export function useCastHistory() {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [lastUsedDevice, setLastUsedDevice] = useState<CastDevice | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedDevices = localStorage.getItem(STORAGE_KEY);
      if (storedDevices) {
        const parsed = JSON.parse(storedDevices) as CastDevice[];
        const sorted = parsed.sort((a, b) => b.lastUsed - a.lastUsed);
        setDevices(sorted);
        if (sorted.length > 0) {
          setLastUsedDevice(sorted[0]);
        }
      }

      const storedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (storedGroups) {
        setGroups(JSON.parse(storedGroups) as DeviceGroup[]);
      }
    } catch (error) {
      console.error('Failed to load cast history:', error);
    }
  }, []);

  // Save devices to localStorage
  const saveDevices = useCallback((newDevices: CastDevice[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDevices));
    } catch (error) {
      console.error('Failed to save cast history:', error);
    }
  }, []);

  // Save groups to localStorage
  const saveGroups = useCallback((newGroups: DeviceGroup[]) => {
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(newGroups));
    } catch (error) {
      console.error('Failed to save cast groups:', error);
    }
  }, []);

  // Add or update a device in history
  const addDevice = useCallback((device: Omit<CastDevice, 'lastUsed'>) => {
    setDevices((prev) => {
      const existingIndex = prev.findIndex(
        (d) => d.id === device.id && d.type === device.type
      );

      let newDevices: CastDevice[];
      const updatedDevice: CastDevice = {
        ...device,
        lastUsed: Date.now(),
        // Preserve existing groupId and customName if updating
        groupId: device.groupId ?? (existingIndex >= 0 ? prev[existingIndex].groupId : undefined),
        customName: device.customName ?? (existingIndex >= 0 ? prev[existingIndex].customName : undefined),
      };

      if (existingIndex >= 0) {
        newDevices = [...prev];
        newDevices[existingIndex] = updatedDevice;
      } else {
        newDevices = [updatedDevice, ...prev];
      }

      newDevices = newDevices
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_DEVICES);

      saveDevices(newDevices);
      setLastUsedDevice(newDevices[0]);
      return newDevices;
    });
  }, [saveDevices]);

  // Update device with group or custom name
  const updateDevice = useCallback((deviceId: string, type: CastDevice['type'], updates: Partial<Pick<CastDevice, 'groupId' | 'customName'>>) => {
    setDevices((prev) => {
      const index = prev.findIndex(d => d.id === deviceId && d.type === type);
      if (index === -1) return prev;

      const newDevices = [...prev];
      newDevices[index] = { ...newDevices[index], ...updates };
      saveDevices(newDevices);
      return newDevices;
    });
  }, [saveDevices]);

  // Remove a device from history
  const removeDevice = useCallback((deviceId: string, type: CastDevice['type']) => {
    setDevices((prev) => {
      const newDevices = prev.filter(
        (d) => !(d.id === deviceId && d.type === type)
      );
      saveDevices(newDevices);
      
      if (lastUsedDevice?.id === deviceId && lastUsedDevice?.type === type) {
        setLastUsedDevice(newDevices[0] || null);
      }
      
      return newDevices;
    });
  }, [saveDevices, lastUsedDevice]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setDevices([]);
    setLastUsedDevice(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Get devices by type
  const getDevicesByType = useCallback((type: CastDevice['type']) => {
    return devices.filter((d) => d.type === type);
  }, [devices]);

  // Get devices by group
  const getDevicesByGroup = useCallback((groupId: string) => {
    return devices.filter((d) => d.groupId === groupId);
  }, [devices]);

  // Get ungrouped devices
  const getUngroupedDevices = useCallback(() => {
    return devices.filter((d) => !d.groupId);
  }, [devices]);

  // Create a new group
  const createGroup = useCallback((name: string, icon?: string): DeviceGroup | null => {
    if (groups.length >= MAX_GROUPS) return null;
    
    const newGroup: DeviceGroup = {
      id: `group-${Date.now()}`,
      name: name.trim().slice(0, 50),
      icon,
      createdAt: Date.now(),
    };

    const newGroups = [...groups, newGroup];
    setGroups(newGroups);
    saveGroups(newGroups);
    return newGroup;
  }, [groups, saveGroups]);

  // Update a group
  const updateGroup = useCallback((groupId: string, updates: Partial<Pick<DeviceGroup, 'name' | 'icon'>>) => {
    setGroups((prev) => {
      const index = prev.findIndex(g => g.id === groupId);
      if (index === -1) return prev;

      const newGroups = [...prev];
      newGroups[index] = { 
        ...newGroups[index], 
        ...updates,
        name: updates.name ? updates.name.trim().slice(0, 50) : newGroups[index].name,
      };
      saveGroups(newGroups);
      return newGroups;
    });
  }, [saveGroups]);

  // Delete a group (devices become ungrouped)
  const deleteGroup = useCallback((groupId: string) => {
    // Remove group from devices
    setDevices((prev) => {
      const newDevices = prev.map(d => 
        d.groupId === groupId ? { ...d, groupId: undefined } : d
      );
      saveDevices(newDevices);
      return newDevices;
    });

    // Remove the group
    setGroups((prev) => {
      const newGroups = prev.filter(g => g.id !== groupId);
      saveGroups(newGroups);
      return newGroups;
    });
  }, [saveDevices, saveGroups]);

  // Assign device to a group
  const assignDeviceToGroup = useCallback((deviceId: string, type: CastDevice['type'], groupId: string | undefined) => {
    updateDevice(deviceId, type, { groupId });
  }, [updateDevice]);

  // Set custom name for a device
  const setDeviceCustomName = useCallback((deviceId: string, type: CastDevice['type'], customName: string | undefined) => {
    updateDevice(deviceId, type, { customName: customName?.trim().slice(0, 50) });
  }, [updateDevice]);

  // Get display name for a device (custom name or original name)
  const getDeviceDisplayName = useCallback((device: CastDevice) => {
    return device.customName || device.name;
  }, []);

  return {
    devices,
    groups,
    lastUsedDevice,
    addDevice,
    updateDevice,
    removeDevice,
    clearHistory,
    getDevicesByType,
    getDevicesByGroup,
    getUngroupedDevices,
    createGroup,
    updateGroup,
    deleteGroup,
    assignDeviceToGroup,
    setDeviceCustomName,
    getDeviceDisplayName,
  };
}
