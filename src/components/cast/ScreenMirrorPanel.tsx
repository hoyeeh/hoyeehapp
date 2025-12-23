import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Loader2, Copy, Check, X, QrCode, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useScreenMirror } from '@/hooks/useScreenMirror';
import { toast } from 'sonner';

interface ScreenMirrorPanelProps {
  onClose?: () => void;
}

export function ScreenMirrorPanel({ onClose }: ScreenMirrorPanelProps) {
  const {
    isSupported,
    isCapturing,
    isConnected,
    pairingCode,
    connectionUrl,
    error,
    createSession,
    startScreenCapture,
    stopScreenCapture,
    disconnect,
  } = useScreenMirror();

  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    await createSession();
    setIsCreatingSession(false);
  };

  const handleCopyUrl = () => {
    if (connectionUrl) {
      navigator.clipboard.writeText(connectionUrl);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenTvPage = () => {
    if (connectionUrl) {
      window.open(connectionUrl, '_blank');
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Monitor className="h-5 w-5" />
            Screen Mirror
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Screen mirroring is not supported in this browser. 
            Please use Chrome, Edge, or another browser that supports screen capture.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Monitor className="h-5 w-5 text-primary" />
            Screen Mirror
          </CardTitle>
          <CardDescription>
            Share your entire screen to a TV
          </CardDescription>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {/* Initial state - no session */}
          {!pairingCode && !isCapturing && (
            <motion.div
              key="initial"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Mirror your screen to any TV or display with a web browser.
                No app required on the TV!
              </p>
              
              <Button
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                className="w-full"
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  <>
                    <Monitor className="h-4 w-4 mr-2" />
                    Start Screen Mirror
                  </>
                )}
              </Button>

              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">How it works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create a mirror session</li>
                  <li>Open the URL on your TV's browser</li>
                  <li>Share your screen</li>
                </ol>
              </div>
            </motion.div>
          )}

          {/* Session created - waiting for TV */}
          {pairingCode && !isConnected && !isCapturing && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Enter this code on your TV
                </p>
                <div className="text-4xl font-mono font-bold tracking-widest text-primary">
                  {pairingCode}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-muted rounded text-xs font-mono truncate">
                  {connectionUrl}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenTvPage}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Waiting for TV to connect...
                </span>
              </div>

              <Button
                variant="outline"
                onClick={disconnect}
                className="w-full"
              >
                Cancel
              </Button>
            </motion.div>
          )}

          {/* Connected - ready to share or sharing */}
          {(isConnected || isCapturing) && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-500 font-medium">
                  {isCapturing ? 'Screen is being shared' : 'TV Connected'}
                </span>
              </div>

              {isCapturing ? (
                <Button
                  onClick={stopScreenCapture}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Sharing
                </Button>
              ) : (
                <Button
                  onClick={() => startScreenCapture()}
                  className="w-full"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Start Sharing Screen
                </Button>
              )}

              <Button
                variant="outline"
                onClick={disconnect}
                className="w-full"
              >
                Disconnect
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
