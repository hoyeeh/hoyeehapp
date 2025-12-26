/**
 * Creates a throttled function that only executes at most once per wait period
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      func.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        func.apply(this, args);
      }, remaining);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}

/**
 * Creates a debounced function that delays execution until after wait period of inactivity
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Rate limiter that tracks if an action can be performed
 */
export function createRateLimiter(minIntervalMs: number) {
  let lastExecutionTime = 0;

  return {
    canExecute(): boolean {
      const now = Date.now();
      return now - lastExecutionTime >= minIntervalMs;
    },
    execute<T>(fn: () => T): T | undefined {
      const now = Date.now();
      if (now - lastExecutionTime >= minIntervalMs) {
        lastExecutionTime = now;
        return fn();
      }
      return undefined;
    },
    reset() {
      lastExecutionTime = 0;
    },
    getTimeUntilNextExecution(): number {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime;
      return Math.max(0, minIntervalMs - timeSinceLastExecution);
    },
  };
}
