import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Content } from '@/types';

export interface ScheduledDownload {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  episodeTitle?: string;
  thumbnailUrl?: string;
  quality: string;
  scheduleType: 'off-peak' | 'wifi-only' | 'specific-time' | 'immediate';
  scheduledTime?: number; // timestamp for specific-time
  createdAt: number;
  status: 'pending' | 'ready' | 'downloading' | 'completed' | 'cancelled';
}

export interface SchedulerSettings {
  offPeakStart: string; // HH:MM format
  offPeakEnd: string;
  wifiOnlyEnabled: boolean;
  autoStartEnabled: boolean;
}

const SCHEDULER_STORAGE_KEY = 'hoyeeh-download-scheduler';
const SETTINGS_STORAGE_KEY = 'hoyeeh-scheduler-settings';

const DEFAULT_SETTINGS: SchedulerSettings = {
  offPeakStart: '00:00',
  offPeakEnd: '06:00',
  wifiOnlyEnabled: true,
  autoStartEnabled: true,
};

export function useDownloadScheduler() {
  const [scheduledDownloads, setScheduledDownloads] = useState<ScheduledDownload[]>([]);
  const [settings, setSettings] = useState<SchedulerSettings>(DEFAULT_SETTINGS);
  const [isOffPeakNow, setIsOffPeakNow] = useState(false);
  const [isOnWifi, setIsOnWifi] = useState(true);

  // Load saved data
  useEffect(() => {
    try {
      const savedSchedules = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (savedSchedules) {
        setScheduledDownloads(JSON.parse(savedSchedules));
      }
      
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
    } catch (e) {
      console.error('Failed to load scheduler data:', e);
    }
  }, []);

  // Save schedules when changed
  useEffect(() => {
    localStorage.setItem(SCHEDULER_STORAGE_KEY, JSON.stringify(scheduledDownloads));
  }, [scheduledDownloads]);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Check if current time is in off-peak hours
  const checkOffPeakStatus = useCallback(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.offPeakStart.split(':').map(Number);
    const [endHour, endMin] = settings.offPeakEnd.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Handle overnight off-peak (e.g., 23:00 - 06:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }, [settings.offPeakStart, settings.offPeakEnd]);

  // Check WiFi status
  const checkWifiStatus = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (!connection) return true; // Assume WiFi if API not available
    
    const connectionType = connection.type || '';
    const effectiveType = connection.effectiveType || '';
    const mobileTypes = ['cellular', '2g', '3g', '4g', '5g'];
    
    return !mobileTypes.includes(connectionType) && 
           !mobileTypes.includes(effectiveType) ||
           connectionType === 'wifi' || connectionType === 'ethernet';
  }, []);

  // Periodic checks
  useEffect(() => {
    const updateStatus = () => {
      setIsOffPeakNow(checkOffPeakStatus());
      setIsOnWifi(checkWifiStatus());
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 60000); // Check every minute
    
    // Network change listener
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }
    
    return () => {
      clearInterval(interval);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, [checkOffPeakStatus, checkWifiStatus]);

  // Check and trigger ready downloads
  useEffect(() => {
    if (!settings.autoStartEnabled) return;
    
    const readyDownloads = scheduledDownloads.filter(d => {
      if (d.status !== 'pending') return false;
      
      switch (d.scheduleType) {
        case 'immediate':
          return true;
        case 'wifi-only':
          return isOnWifi;
        case 'off-peak':
          return isOffPeakNow && (settings.wifiOnlyEnabled ? isOnWifi : true);
        case 'specific-time':
          return d.scheduledTime && Date.now() >= d.scheduledTime && 
                 (settings.wifiOnlyEnabled ? isOnWifi : true);
        default:
          return false;
      }
    });
    
    if (readyDownloads.length > 0) {
      setScheduledDownloads(prev => 
        prev.map(d => 
          readyDownloads.some(rd => rd.id === d.id) 
            ? { ...d, status: 'ready' as const }
            : d
        )
      );
      
      // Dispatch event for download manager to pick up
      readyDownloads.forEach(download => {
        window.dispatchEvent(new CustomEvent('scheduled-download-ready', { 
          detail: download 
        }));
      });
      
      if (readyDownloads.length === 1) {
        toast.info(`Starting scheduled download: ${readyDownloads[0].title}`);
      } else {
        toast.info(`Starting ${readyDownloads.length} scheduled downloads`);
      }
    }
  }, [scheduledDownloads, isOffPeakNow, isOnWifi, settings]);

  const scheduleDownload = useCallback((
    content: Content,
    episodeId?: string,
    episodeTitle?: string,
    quality: string = '720p',
    scheduleType: ScheduledDownload['scheduleType'] = 'off-peak',
    scheduledTime?: Date
  ) => {
    const id = `${content.id}-${episodeId || 'main'}-${Date.now()}`;
    
    const newSchedule: ScheduledDownload = {
      id,
      contentId: content.id,
      episodeId,
      title: content.title,
      episodeTitle,
      thumbnailUrl: content.thumbnailUrl,
      quality,
      scheduleType,
      scheduledTime: scheduledTime?.getTime(),
      createdAt: Date.now(),
      status: 'pending',
    };
    
    setScheduledDownloads(prev => [...prev, newSchedule]);
    
    const scheduleLabel = scheduleType === 'off-peak' 
      ? `during off-peak hours (${settings.offPeakStart} - ${settings.offPeakEnd})`
      : scheduleType === 'wifi-only'
      ? 'when connected to Wi-Fi'
      : scheduleType === 'specific-time' && scheduledTime
      ? `at ${scheduledTime.toLocaleTimeString()}`
      : 'now';
    
    toast.success(`Download scheduled ${scheduleLabel}`);
    
    return id;
  }, [settings.offPeakStart, settings.offPeakEnd]);

  const cancelScheduledDownload = useCallback((id: string) => {
    setScheduledDownloads(prev => 
      prev.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d)
    );
    toast.info('Scheduled download cancelled');
  }, []);

  const removeScheduledDownload = useCallback((id: string) => {
    setScheduledDownloads(prev => prev.filter(d => d.id !== id));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SchedulerSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    toast.success('Schedule settings updated');
  }, []);

  const getNextOffPeakTime = useCallback(() => {
    const now = new Date();
    const [startHour, startMin] = settings.offPeakStart.split(':').map(Number);
    
    const nextOffPeak = new Date(now);
    nextOffPeak.setHours(startHour, startMin, 0, 0);
    
    // If it's already past today's off-peak start, schedule for tomorrow
    if (now >= nextOffPeak && !isOffPeakNow) {
      nextOffPeak.setDate(nextOffPeak.getDate() + 1);
    }
    
    return nextOffPeak;
  }, [settings.offPeakStart, isOffPeakNow]);

  const getPendingCount = useCallback(() => {
    return scheduledDownloads.filter(d => d.status === 'pending').length;
  }, [scheduledDownloads]);

  const getReadyCount = useCallback(() => {
    return scheduledDownloads.filter(d => d.status === 'ready').length;
  }, [scheduledDownloads]);

  return {
    scheduledDownloads,
    settings,
    isOffPeakNow,
    isOnWifi,
    scheduleDownload,
    cancelScheduledDownload,
    removeScheduledDownload,
    updateSettings,
    getNextOffPeakTime,
    getPendingCount,
    getReadyCount,
  };
}
