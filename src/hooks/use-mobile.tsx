import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// SSR-safe initial value detection
const getInitialMobileState = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialMobileState);

  React.useEffect(() => {
    console.log('[useIsMobile] Hook mounted, initial isMobile:', isMobile);
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      const newValue = window.innerWidth < MOBILE_BREAKPOINT;
      console.log('[useIsMobile] Media query changed, isMobile:', newValue);
      setIsMobile(newValue);
    };
    
    mql.addEventListener("change", onChange);
    // Set initial value in effect as well for SSR hydration
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
