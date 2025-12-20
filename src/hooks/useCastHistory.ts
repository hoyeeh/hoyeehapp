import { useState, useEffect, useCallback } from 'react';

export interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'dlna' | 'airplay';
  lastUsed: number;
}

const STORAGE_KEY = 'cast_device_history';
const MAX_DEVICES = 5;

export function useCastHistory() {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [lastUsedDevice, setLastUsedDevice] = useState<CastDevice | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CastDevice[];
        // Sort by most recently used
        const sorted = parsed.sort((a, b) => b.lastUsed - a.lastUsed);
        setDevices(sorted);
        if (sorted.length > 0) {
          setLastUsedDevice(sorted[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load cast history:', error);
    }
  }, []);

  // Save to localStorage
  const saveDevices = useCallback((newDevices: CastDevice[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDevices));
    } catch (error) {
      console.error('Failed to save cast history:', error);
    }
  }, []);

  // Add or update a device in history
  const addDevice = useCallback((device: Omit<CastDevice, 'lastUsed'>) => {
    setDevices((prev) => {
      // Check if device already exists
      const existingIndex = prev.findIndex(
        (d) => d.id === device.id && d.type === device.type
      );

      let newDevices: CastDevice[];
      const updatedDevice: CastDevice = {
        ...device,
        lastUsed: Date.now(),
      };

      if (existingIndex >= 0) {
        // Update existing device
        newDevices = [...prev];
        newDevices[existingIndex] = updatedDevice;
      } else {
        // Add new device at the beginning
        newDevices = [updatedDevice, ...prev];
      }

      // Sort by most recently used and limit to MAX_DEVICES
      newDevices = newDevices
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_DEVICES);

      saveDevices(newDevices);
      setLastUsedDevice(newDevices[0]);
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

  return {
    devices,
    lastUsedDevice,
    addDevice,
    removeDevice,
    clearHistory,
    getDevicesByType,
  };
}
