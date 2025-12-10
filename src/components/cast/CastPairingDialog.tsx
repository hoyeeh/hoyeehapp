import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tv, Loader2, Link2, ExternalLink, Smartphone } from 'lucide-react';

interface CastPairingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPair: (code: string) => Promise<boolean>;
  isConnecting: boolean;
}

export function CastPairingDialog({
  open,
  onOpenChange,
  onPair,
  isConnecting,
}: CastPairingDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    const success = await onPair(code);
    if (success) {
      setCode('');
      onOpenChange(false);
    } else {
      setError('Invalid or expired code. Please try again.');
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric characters, uppercase
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');
  };

  const tvReceiverUrl = `${window.location.origin}/tv-receiver/`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Link with TV Code
          </DialogTitle>
          <DialogDescription>
            Connect to your Smart TV to cast videos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Open TV Receiver */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                1
              </span>
              Open the TV Receiver on your Smart TV
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                On your Smart TV's browser, go to:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {tvReceiverUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(tvReceiverUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Enter Code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                2
              </span>
              Enter the code shown on your TV
            </div>
            <form onSubmit={handleSubmit} className="ml-8 space-y-3">
              <Input
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.5em] font-mono uppercase"
                maxLength={6}
                autoFocus
                disabled={isConnecting}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== 6 || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect to TV
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Alternative: Scan QR Code */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Smartphone className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p>
                <strong>Tip:</strong> You can also scan a QR code from your TV 
                if your Smart TV's browser supports it.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}