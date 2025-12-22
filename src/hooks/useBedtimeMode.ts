import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfileContext } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

export const useBedtimeMode = () => {
  const { currentProfile, refreshProfiles } = useProfileContext();
  const [bedtimeTime, setBedtimeTime] = useState<string | null>(null);
  const [isBedtime, setIsBedtime] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch bedtime time for current profile
  useEffect(() => {
    if (currentProfile?.id) {
      fetchBedtimeTime();
    }
  }, [currentProfile?.id]);

  // Check if it's bedtime every minute
  useEffect(() => {
    if (!bedtimeTime || !currentProfile?.is_kids) {
      setIsBedtime(false);
      return;
    }

    const checkBedtime = () => {
      const now = new Date();
      const [hours, minutes] = bedtimeTime.split(':').map(Number);
      const bedtimeDate = new Date();
      bedtimeDate.setHours(hours, minutes, 0, 0);

      // Check if current time is past bedtime
      const isPastBedtime = now >= bedtimeDate;
      setIsBedtime(isPastBedtime);

      if (isPastBedtime && !isBedtime) {
        toast.info("It's bedtime! 🌙", {
          description: "Time to stop watching and get some rest.",
          duration: 10000,
        });
        
        // Notify parent via push notification
        if (currentProfile?.id) {
          supabase.functions.invoke('notify-kids-limit', {
            body: {
              profileId: currentProfile.id,
              type: 'bedtime',
              profileName: currentProfile.name,
            }
          }).catch(err => console.error('Failed to notify parent about bedtime:', err));
        }
      }
    };

    checkBedtime();
    const interval = setInterval(checkBedtime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [bedtimeTime, currentProfile?.is_kids]);

  const fetchBedtimeTime = async () => {
    if (!currentProfile?.id) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('bedtime_time')
      .eq('id', currentProfile.id)
      .maybeSingle();

    if (!error && data) {
      setBedtimeTime(data.bedtime_time);
    }
  };

  const updateBedtimeTime = useCallback(async (time: string | null) => {
    if (!currentProfile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ bedtime_time: time })
        .eq('id', currentProfile.id);

      if (error) throw error;

      setBedtimeTime(time);
      await refreshProfiles();
      toast.success(time ? 'Bedtime set successfully' : 'Bedtime removed');
    } catch (error) {
      console.error('Error updating bedtime:', error);
      toast.error('Failed to update bedtime');
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id, refreshProfiles]);

  return {
    bedtimeTime,
    isBedtime,
    loading,
    updateBedtimeTime,
    isKidsProfile: currentProfile?.is_kids ?? false,
  };
};
