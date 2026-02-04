import { useRealtimeHomeSections } from '@/hooks/useRealtimeHomeSections';
import { useAppLaunchRefresh } from '@/hooks/useAppLaunchRefresh';

/**
 * Component that handles realtime updates and app launch refresh.
 * Place this in the app root to enable automatic background updates.
 */
export function RealtimeUpdatesHandler() {
  // Subscribe to realtime updates from admin changes
  useRealtimeHomeSections();
  
  // Handle app launch and resume refresh
  useAppLaunchRefresh();
  
  return null;
}
