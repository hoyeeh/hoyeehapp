import { useEffect, useState } from "react";
import { Bug, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { castLog, type CastLogEntry } from "@/lib/castLog";
import { cn } from "@/lib/utils";

/**
 * CastDebugPanel — floating diagnostic overlay for cast
 * command/response flow (pair, LOAD payload, ack success/error).
 *
 * Surfaced when:
 *  - import.meta.env.DEV is true, OR
 *  - the URL contains ?castdebug=1 (persisted in localStorage)
 */
const STORAGE_KEY = "hoyeeh_cast_debug";

function shouldEnable(): boolean {
  if (typeof window === "undefined") return false;
  if ((import.meta as any)?.env?.DEV) return true;
  try {
    if (new URLSearchParams(window.location.search).get("castdebug") === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const levelClass: Record<CastLogEntry["level"], string> = {
  info: "text-foreground",
  success: "text-green-500",
  warn: "text-yellow-500",
  error: "text-destructive",
  debug: "text-muted-foreground",
};

export function CastDebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CastLogEntry[]>([]);

  useEffect(() => {
    setEnabled(shouldEnable());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return castLog.subscribe(setEntries);
  }, [enabled]);

  if (!enabled) return null;

  const handleCopy = () => {
    const text = entries
      .map((e) => `${new Date(e.ts).toISOString()} [${e.level}] ${e.message}${
        e.data !== undefined ? " " + safeStringify(e.data) : ""
      }`)
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open cast debug panel"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-4 right-4 z-[120] rounded-full bg-background/90 border border-border",
            "p-2 shadow-lg backdrop-blur hover:bg-accent transition-colors"
          )}
          data-testid="cast-debug-toggle"
        >
          <Bug className="h-4 w-4 text-primary" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 right-4 z-[120] w-[min(420px,calc(100vw-32px))] h-[min(420px,60vh)] rounded-lg border border-border bg-background/95 backdrop-blur shadow-xl flex flex-col"
          data-testid="cast-debug-panel"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bug className="h-4 w-4 text-primary" />
              Cast Debug
              <span className="text-xs text-muted-foreground">
                ({entries.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
                aria-label="Copy log"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => castLog.clear()}
                aria-label="Clear log"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close cast debug panel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2 text-[11px] font-mono leading-tight space-y-1">
            {entries.length === 0 && (
              <p className="text-muted-foreground text-center mt-4">
                No cast events yet — pair with a TV to begin logging.
              </p>
            )}
            {entries.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "border-l-2 pl-2 py-0.5",
                  e.level === "error"
                    ? "border-destructive"
                    : e.level === "success"
                    ? "border-green-500"
                    : e.level === "warn"
                    ? "border-yellow-500"
                    : "border-border"
                )}
              >
                <div className={cn("flex gap-2", levelClass[e.level])}>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className="font-semibold uppercase shrink-0">
                    {e.level}
                  </span>
                  <span className="break-words">{e.message}</span>
                </div>
                {e.data !== undefined && (
                  <pre className="ml-12 text-muted-foreground whitespace-pre-wrap break-all">
                    {safeStringify(e.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
