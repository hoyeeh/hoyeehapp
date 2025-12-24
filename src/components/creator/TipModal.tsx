import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Gift, Heart, Loader2 } from "lucide-react";
import { useSendTip } from "@/hooks/useCreatorTips";

interface TipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorName: string;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000];

export function TipModal({ open, onOpenChange, creatorId, creatorName }: TipModalProps) {
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const sendTipMutation = useSendTip();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handlePresetClick = (preset: number) => {
    setAmount(preset);
    setUseCustom(false);
    setCustomAmount("");
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    setUseCustom(true);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const handleSubmit = () => {
    const finalAmount = useCustom ? parseInt(customAmount, 10) : amount;
    if (finalAmount < 100) return;

    sendTipMutation.mutate({
      creatorId,
      amount: finalAmount,
      message: message.trim() || undefined,
    });
  };

  const finalAmount = useCustom ? parseInt(customAmount, 10) || 0 : amount;
  const isValid = finalAmount >= 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Send a Tip to {creatorName}
          </DialogTitle>
          <DialogDescription>
            Show your appreciation by sending a tip. They'll receive your message along with the tip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset Amounts */}
          <div className="space-y-2">
            <Label>Select Amount</Label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={!useCustom && amount === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs"
                >
                  {formatCurrency(preset).replace('XAF', '').trim()}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="customAmount">Or enter custom amount (XAF)</Label>
            <Input
              id="customAmount"
              type="number"
              placeholder="Enter amount..."
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              min={100}
            />
            {useCustom && finalAmount < 100 && (
              <p className="text-xs text-destructive">Minimum tip is 100 XAF</p>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Add a message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Say something nice..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/200
            </p>
          </div>

          {/* Summary */}
          {isValid && (
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">You're sending</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(finalAmount)}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <Heart className="h-3 w-3 text-red-500" />
                to {creatorName}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || sendTipMutation.isPending}
          >
            {sendTipMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Send Tip
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
