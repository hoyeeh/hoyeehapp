import { useEffect, useState } from 'react';
import {
  connectGoogleCast,
  disconnectGoogleCast,
  ensureGoogleCast,
  getGoogleCastState,
  googleCastControls,
  loadGoogleCastMedia,
  subscribeGoogleCast,
  type GoogleCastState,
} from '@/lib/googleCastSender';

export type { GoogleCastResult } from '@/lib/googleCastSender';

/**
 * Thin React view over the app-wide Google Cast sender singleton. Every
 * consumer shares one SDK load / one CastContext. connect() and loadMedia()
 * return explicit results — callers must check `success`.
 */
export function useGoogleCast() {
  const [state, setState] = useState<GoogleCastState>(getGoogleCastState());

  useEffect(() => {
    const unsub = subscribeGoogleCast(setState);
    ensureGoogleCast();
    setState(getGoogleCastState());
    return unsub;
  }, []);

  return {
    ...state,
    connect: connectGoogleCast,
    disconnect: disconnectGoogleCast,
    loadMedia: loadGoogleCastMedia,
    ...googleCastControls,
  };
}
