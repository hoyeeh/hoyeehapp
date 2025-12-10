import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface PiPState {
  isSupported: boolean;
  isActive: boolean;
}

export function usePictureInPicture(videoRef: React.RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<PiPState>({
    isSupported: false,
    isActive: false,
  });

  // Check PiP support on mount
  useEffect(() => {
    const isSupported = 'pictureInPictureEnabled' in document && 
                        document.pictureInPictureEnabled;
    setState(prev => ({ ...prev, isSupported }));
  }, []);

  // Listen for PiP state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => {
      setState(prev => ({ ...prev, isActive: true }));
    };

    const handleLeavePiP = () => {
      setState(prev => ({ ...prev, isActive: false }));
    };

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, [videoRef]);

  const enterPiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      toast.error('Video element not available');
      return;
    }

    if (!document.pictureInPictureEnabled) {
      toast.error('Picture-in-Picture is not supported in this browser');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      await video.requestPictureInPicture();
      toast.success('Picture-in-Picture enabled');
    } catch (error) {
      console.error('PiP error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('PiP requires user interaction first');
        } else {
          toast.error('Failed to enter Picture-in-Picture');
        }
      }
    }
  }, [videoRef]);

  const exitPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast.info('Picture-in-Picture closed');
      }
    } catch (error) {
      console.error('Exit PiP error:', error);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (state.isActive) {
      await exitPiP();
    } else {
      await enterPiP();
    }
  }, [state.isActive, enterPiP, exitPiP]);

  return {
    isSupported: state.isSupported,
    isActive: state.isActive,
    enterPiP,
    exitPiP,
    togglePiP,
  };
}
