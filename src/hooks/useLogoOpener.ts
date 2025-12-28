import { useState, useCallback, useEffect } from "react";

interface UseLogoOpenerOptions {
  contentId: string;
  episodeId?: string;
  enabled?: boolean;
}

export function useLogoOpener({ contentId, episodeId, enabled = true }: UseLogoOpenerOptions) {
  const [showOpener, setShowOpener] = useState(false);
  const [openerComplete, setOpenerComplete] = useState(false);

  // Generate a unique key for this content/episode
  const getSessionKey = useCallback(() => {
    const base = episodeId ? `opener_${contentId}_${episodeId}` : `opener_${contentId}`;
    return base;
  }, [contentId, episodeId]);

  // Check if opener was already shown this session
  useEffect(() => {
    if (!enabled) {
      setOpenerComplete(true);
      return;
    }

    const sessionKey = getSessionKey();
    const alreadyShown = sessionStorage.getItem(sessionKey);
    
    if (alreadyShown) {
      setOpenerComplete(true);
      setShowOpener(false);
    } else {
      setShowOpener(true);
      setOpenerComplete(false);
    }
  }, [enabled, getSessionKey]);

  const markOpenerComplete = useCallback(() => {
    const sessionKey = getSessionKey();
    sessionStorage.setItem(sessionKey, "true");
    setShowOpener(false);
    setOpenerComplete(true);
  }, [getSessionKey]);

  return {
    showOpener,
    openerComplete,
    markOpenerComplete,
  };
}
