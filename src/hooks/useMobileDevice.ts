import { useState, useEffect } from "react";

const DEVICE_TYPE_KEY = "hoyeeh_device_type";
const DEVICE_OVERRIDE_KEY = "hoyeeh_device_override";

interface DeviceInfo {
  isMobileDevice: boolean;
  isTablet: boolean;
  isNativePWA: boolean;
  forceDesktop: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
}

// User Agent patterns for device detection
const MOBILE_UA_PATTERNS = [
  /Android.*Mobile/i,
  /webOS/i,
  /iPhone/i,
  /iPod/i,
  /BlackBerry/i,
  /Windows Phone/i,
  /Opera Mini/i,
  /IEMobile/i,
  /Mobile Safari/i,
];

const TABLET_UA_PATTERNS = [
  /iPad/i,
  /Android(?!.*Mobile)/i,
  /Tablet/i,
  /PlayBook/i,
  /Silk/i,
];

const detectDeviceType = (): "mobile" | "tablet" | "desktop" => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent;

  // Check for tablets first (iPad, Android tablets)
  if (TABLET_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    return "tablet";
  }

  // Check for mobile phones
  if (MOBILE_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    return "mobile";
  }

  // Additional check using touch and screen size
  const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  const isMediumScreen = window.innerWidth >= 768 && window.innerWidth < 1024;

  if (hasTouchScreen && isSmallScreen) {
    return "mobile";
  }

  if (hasTouchScreen && isMediumScreen) {
    return "tablet";
  }

  return "desktop";
};

const isStandalonePWA = (): boolean => {
  if (typeof window === "undefined") return false;
  
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
};

export const useMobileDevice = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Check for persisted device type
    if (typeof window !== "undefined") {
      const override = localStorage.getItem(DEVICE_OVERRIDE_KEY);
      if (override === "desktop") {
        return {
          isMobileDevice: false,
          isTablet: false,
          isNativePWA: isStandalonePWA(),
          forceDesktop: true,
          deviceType: "desktop",
        };
      }

      const persisted = localStorage.getItem(DEVICE_TYPE_KEY);
      if (persisted) {
        const deviceType = persisted as "mobile" | "tablet" | "desktop";
        return {
          isMobileDevice: deviceType === "mobile",
          isTablet: deviceType === "tablet",
          isNativePWA: isStandalonePWA(),
          forceDesktop: false,
          deviceType,
        };
      }
    }

    // Detect device type
    const deviceType = detectDeviceType();
    return {
      isMobileDevice: deviceType === "mobile",
      isTablet: deviceType === "tablet",
      isNativePWA: isStandalonePWA(),
      forceDesktop: false,
      deviceType,
    };
  });

  useEffect(() => {
    // Persist device type for consistency
    const deviceType = detectDeviceType();
    localStorage.setItem(DEVICE_TYPE_KEY, deviceType);

    const override = localStorage.getItem(DEVICE_OVERRIDE_KEY);
    const forceDesktop = override === "desktop";

    setDeviceInfo({
      isMobileDevice: forceDesktop ? false : deviceType === "mobile",
      isTablet: forceDesktop ? false : deviceType === "tablet",
      isNativePWA: isStandalonePWA(),
      forceDesktop,
      deviceType: forceDesktop ? "desktop" : deviceType,
    });

    console.log("[useMobileDevice] Device detected:", deviceType, "PWA:", isStandalonePWA());
  }, []);

  return deviceInfo;
};

// Helper to force desktop mode (for testing)
export const setForceDesktop = (force: boolean) => {
  if (typeof window !== "undefined") {
    if (force) {
      localStorage.setItem(DEVICE_OVERRIDE_KEY, "desktop");
    } else {
      localStorage.removeItem(DEVICE_OVERRIDE_KEY);
    }
    window.location.reload();
  }
};
