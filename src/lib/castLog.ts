// Cast event log — in-memory ring buffer with subscribe API.
// Used by the cast hook + debug panel to surface pair/LOAD/ack
// command-and-response flow for live diagnosis without opening DevTools.

export type CastLogLevel = "info" | "success" | "warn" | "error" | "debug";

export interface CastLogEntry {
  id: number;
  ts: number; // epoch ms
  level: CastLogLevel;
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 200;

let _nextId = 1;
let _entries: CastLogEntry[] = [];
const _listeners = new Set<(entries: CastLogEntry[]) => void>();

function emit() {
  for (const cb of _listeners) {
    try {
      cb(_entries);
    } catch {
      // ignore listener errors
    }
  }
}

export const castLog = {
  log(level: CastLogLevel, message: string, data?: unknown) {
    const entry: CastLogEntry = {
      id: _nextId++,
      ts: Date.now(),
      level,
      message,
      data,
    };
    _entries = [..._entries, entry].slice(-MAX_ENTRIES);
    // Also mirror to console for legacy debugging.
    const prefix = `[Cast:${level}]`;
    // eslint-disable-next-line no-console
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
        ? console.warn
        : console.log;
    if (data !== undefined) fn(prefix, message, data);
    else fn(prefix, message);
    emit();
  },
  info(message: string, data?: unknown) {
    this.log("info", message, data);
  },
  success(message: string, data?: unknown) {
    this.log("success", message, data);
  },
  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  },
  error(message: string, data?: unknown) {
    this.log("error", message, data);
  },
  debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  },
  getEntries(): CastLogEntry[] {
    return _entries;
  },
  clear() {
    _entries = [];
    emit();
  },
  subscribe(cb: (entries: CastLogEntry[]) => void): () => void {
    _listeners.add(cb);
    cb(_entries);
    return () => {
      _listeners.delete(cb);
    };
  },
};

export type CastLog = typeof castLog;
