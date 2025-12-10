import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

interface ParentalPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
  contentTitle?: string;
}

export const ParentalPinModal = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin,
  contentTitle,
}: ParentalPinModalProps) => {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) return;

    if (pin === correctPin) {
      setPin("");
      setError("");
      setAttempts(0);
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");
      
      if (newAttempts >= 3) {
        setIsLocked(true);
        setError("Too many attempts. Locked for 30 seconds.");
        setTimeout(() => {
          setIsLocked(false);
          setAttempts(0);
          setError("");
        }, 30000);
      } else {
        setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
      }
    }
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand" />
            Parental Controls
          </DialogTitle>
          <DialogDescription>
            {contentTitle
              ? `"${contentTitle}" is restricted. Enter your parental PIN to continue.`
              : "This content is restricted. Enter your parental PIN to continue."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parental-pin" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Enter PIN
            </Label>
            <div className="relative">
              <Input
                id="parental-pin"
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="••••"
                maxLength={6}
                disabled={isLocked}
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pin.length < 4 || isLocked}
              className="flex-1"
            >
              {isLocked ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Unlock"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
