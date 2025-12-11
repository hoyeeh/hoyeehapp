import { useCallback } from "react";

type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

export function useHaptics() {
  const vibrate = useCallback((style: HapticStyle = "light") => {
    // Check if vibration API is supported
    if (!navigator.vibrate) return;

    // Pattern based on haptic style
    const patterns: Record<HapticStyle, number | number[]> = {
      light: 10,
      medium: 25,
      heavy: 50,
      selection: 5,
      success: [10, 50, 10],
      warning: [30, 50, 30],
      error: [50, 100, 50, 100, 50],
    };

    try {
      navigator.vibrate(patterns[style]);
    } catch (e) {
      // Silently fail if vibration not supported
    }
  }, []);

  const lightTap = useCallback(() => vibrate("light"), [vibrate]);
  const mediumTap = useCallback(() => vibrate("medium"), [vibrate]);
  const heavyTap = useCallback(() => vibrate("heavy"), [vibrate]);
  const selectionTap = useCallback(() => vibrate("selection"), [vibrate]);
  const successFeedback = useCallback(() => vibrate("success"), [vibrate]);
  const warningFeedback = useCallback(() => vibrate("warning"), [vibrate]);
  const errorFeedback = useCallback(() => vibrate("error"), [vibrate]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    selectionTap,
    successFeedback,
    warningFeedback,
    errorFeedback,
  };
}
