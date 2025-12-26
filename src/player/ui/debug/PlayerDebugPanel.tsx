import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Bug } from "lucide-react";

interface PlayerDebugPanelProps {
  isVisible?: boolean;
  currentUrl?: string;
  loadedUrl?: string;
  commandSeq?: number;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  lastAction?: string;
  platform?: string;
}

export const PlayerDebugPanel = ({
  isVisible: externalVisible,
  currentUrl,
  loadedUrl,
  commandSeq,
  isPlaying,
  currentTime,
  duration,
  lastAction,
  platform,
}: PlayerDebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    // Check for debug flag
    const checkDebug = () => {
      const flag = localStorage.getItem('HOYEEH_DEBUG') === '1';
      setDebugEnabled(flag);
      if (!flag) setIsVisible(false);
    };
    
    checkDebug();
    window.addEventListener('storage', checkDebug);
    return () => window.removeEventListener('storage', checkDebug);
  }, []);

  // Use external visibility if provided, otherwise internal state
  const visible = externalVisible !== undefined ? externalVisible : isVisible;

  if (!debugEnabled) return null;

  const formatUrl = (url?: string) => {
    if (!url) return '-';
    if (url.length > 50) return url.substring(0, 50) + '...';
    return url;
  };

  return (
    <>
      {/* Toggle Button */}
      {!visible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 left-4 z-50 p-2 bg-black/80 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        >
          <Bug className="h-4 w-4" />
        </button>
      )}

      {/* Debug Panel */}
      {visible && (
        <div className="fixed bottom-16 left-4 z-50 w-80 bg-black/90 border border-border rounded-lg p-3 font-mono text-xs text-muted-foreground">
          <div className="flex items-center justify-between mb-2 text-primary font-bold">
            <span>🔧 Player Debug</span>
            <button onClick={() => setIsVisible(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <DebugRow label="Platform" value={platform || 'unknown'} />
            <DebugRow label="command_seq" value={commandSeq?.toString() || '-'} />
            <DebugRow label="currentUrl" value={formatUrl(currentUrl)} className="text-green-400" />
            <DebugRow label="loadedUrl" value={formatUrl(loadedUrl)} className="text-blue-400" />
            <DebugRow label="isPlaying" value={isPlaying ? 'true' : 'false'} />
            <DebugRow 
              label="Time" 
              value={`${(currentTime || 0).toFixed(1)}s / ${(duration || 0).toFixed(1)}s`} 
            />
            <DebugRow label="Last Action" value={lastAction || '-'} className="text-yellow-400" />
          </div>

          <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground/60">
            Set localStorage.HOYEEH_DEBUG=0 to hide
          </div>
        </div>
      )}
    </>
  );
};

const DebugRow = ({ 
  label, 
  value, 
  className 
}: { 
  label: string; 
  value: string; 
  className?: string;
}) => (
  <div className="flex gap-2">
    <span className="text-muted-foreground/60 min-w-[80px]">{label}:</span>
    <span className={cn("break-all", className)}>{value}</span>
  </div>
);

export default PlayerDebugPanel;
