import { useState, useEffect, useCallback } from 'react';
import { useNetworkQuality } from './useNetworkQuality';
import { getStorageUsed } from '@/lib/downloadStorage';

export interface AutoQualityResult {
  recommendedQuality: '1080p' | '720p' | '480p' | '360p';
  reason: string;
  estimatedSize: number;
  availableStorage: number;
  networkScore: number;
  storageScore: number;
}

const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB
const QUALITY_SIZES = {
  '1080p': 2 * 1024 * 1024 * 1024,    // 2GB
  '720p': 1 * 1024 * 1024 * 1024,      // 1GB
  '480p': 500 * 1024 * 1024,           // 500MB
  '360p': 250 * 1024 * 1024,           // 250MB
};

export function useAutoDownloadQuality() {
  const network = useNetworkQuality();
  const [storageUsed, setStorageUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const used = await getStorageUsed();
        setStorageUsed(used);
      } catch (error) {
        console.error('Failed to get storage:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorage();
  }, []);

  const getQualityFromNetwork = useCallback((): '1080p' | '720p' | '480p' | '360p' => {
    // Based on network effective type and speed
    if (network.saveData) {
      return '360p'; // Data saver mode
    }

    // Use downlink speed (in Mbps)
    if (network.downlink >= 10) return '1080p';
    if (network.downlink >= 5) return '720p';
    if (network.downlink >= 2) return '480p';
    return '360p';
  }, [network]);

  const getQualityFromStorage = useCallback((): '1080p' | '720p' | '480p' | '360p' => {
    const availableSpace = STORAGE_LIMIT - storageUsed;
    const usagePercentage = storageUsed / STORAGE_LIMIT;

    // If storage is almost full (>90%), use lowest quality
    if (usagePercentage > 0.9 || availableSpace < QUALITY_SIZES['360p']) {
      return '360p';
    }
    // If storage is getting full (>75%), use SD quality
    if (usagePercentage > 0.75 || availableSpace < QUALITY_SIZES['480p'] * 2) {
      return '480p';
    }
    // If storage is moderately used (>50%), use HD
    if (usagePercentage > 0.5 || availableSpace < QUALITY_SIZES['720p'] * 3) {
      return '720p';
    }
    // Plenty of space, use full HD
    return '1080p';
  }, [storageUsed]);

  const getNetworkScore = useCallback((): number => {
    // Score from 0-100 based on network quality
    let score = 0;
    
    // Effective type contributes 40 points
    switch (network.effectiveType) {
      case '4g': score += 40; break;
      case '3g': score += 25; break;
      case '2g': score += 10; break;
      case 'slow-2g': score += 5; break;
      default: score += 20;
    }
    
    // Downlink speed contributes 40 points
    score += Math.min(40, network.downlink * 4);
    
    // Low RTT contributes 20 points
    if (network.rtt < 50) score += 20;
    else if (network.rtt < 100) score += 15;
    else if (network.rtt < 200) score += 10;
    else if (network.rtt < 500) score += 5;
    
    // Penalize for data saver mode
    if (network.saveData) score = Math.min(score, 30);
    
    return Math.min(100, Math.max(0, score));
  }, [network]);

  const getStorageScore = useCallback((): number => {
    // Score from 0-100 based on available storage
    const availableSpace = STORAGE_LIMIT - storageUsed;
    const availablePercentage = availableSpace / STORAGE_LIMIT;
    return Math.round(availablePercentage * 100);
  }, [storageUsed]);

  const calculateAutoQuality = useCallback((): AutoQualityResult => {
    const networkQuality = getQualityFromNetwork();
    const storageQuality = getQualityFromStorage();
    const networkScore = getNetworkScore();
    const storageScore = getStorageScore();
    const availableStorage = STORAGE_LIMIT - storageUsed;

    // Quality ranking: 1080p=4, 720p=3, 480p=2, 360p=1
    const qualityRank = { '1080p': 4, '720p': 3, '480p': 2, '360p': 1 };
    const rankToQuality = ['360p', '360p', '480p', '720p', '1080p'] as const;

    // Use the lower of network and storage recommendations
    const networkRank = qualityRank[networkQuality];
    const storageRank = qualityRank[storageQuality];
    const finalRank = Math.min(networkRank, storageRank);
    const recommendedQuality = rankToQuality[finalRank];

    // Generate reason
    let reason = '';
    if (storageRank < networkRank) {
      reason = `Limited storage (${Math.round(storageScore)}% free)`;
    } else if (networkRank < storageRank) {
      if (network.saveData) {
        reason = 'Data saver mode enabled';
      } else {
        reason = `${network.effectiveType.toUpperCase()} connection (${network.downlink.toFixed(1)} Mbps)`;
      }
    } else {
      reason = 'Optimal for your network and storage';
    }

    return {
      recommendedQuality,
      reason,
      estimatedSize: QUALITY_SIZES[recommendedQuality],
      availableStorage,
      networkScore,
      storageScore,
    };
  }, [getQualityFromNetwork, getQualityFromStorage, getNetworkScore, getStorageScore, storageUsed, network]);

  const refreshStorageInfo = useCallback(async () => {
    try {
      const used = await getStorageUsed();
      setStorageUsed(used);
    } catch (error) {
      console.error('Failed to refresh storage:', error);
    }
  }, []);

  return {
    autoQuality: calculateAutoQuality(),
    isLoading,
    network,
    storageUsed,
    storageLimit: STORAGE_LIMIT,
    qualitySizes: QUALITY_SIZES,
    refreshStorageInfo,
  };
}
