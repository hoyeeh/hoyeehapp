import { useState } from "react";
import { useRequestPayout, useCreatorProfile } from "@/hooks/useCreator";
import { useCreatorKYC } from "@/hooks/useCreatorKYC";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Wallet, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KYCStatusBanner } from "./KYCStatusBanner";

interface CreatorPayoutFormProps {
  availableBalance: number;
  creatorProfile: any;
  onOpenKYC?: () => void;
}

export function CreatorPayoutForm({ availableBalance, creatorProfile, onOpenKYC }: CreatorPayoutFormProps) {
  const requestPayout = useRequestPayout();
  const { data: kyc } = useCreatorKYC();
  
  const kycApproved = creatorProfile?.can_request_payout || kyc?.status === 'approved';

  // If KYC not approved, show the banner
  if (!kycApproved) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Request Payout
          </DialogTitle>
        </DialogHeader>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Complete identity verification (KYC) to enable payouts. This is a one-time process required for security.
          </AlertDescription>
        </Alert>
        <KYCStatusBanner onOpenKYC={onOpenKYC} />
      </div>
    );
  }
  
  const [amount, setAmount] = useState(availableBalance.toString());
  const [payoutMethod, setPayoutMethod] = useState(creatorProfile?.payout_method || "mobile_money");
  const [mobileNumber, setMobileNumber] = useState(creatorProfile?.payout_details?.mobile_number || "");
  const [bankName, setBankName] = useState(creatorProfile?.payout_details?.bank_name || "");
  const [accountNumber, setAccountNumber] = useState(creatorProfile?.payout_details?.account_number || "");
  const [paypalEmail, setPaypalEmail] = useState(creatorProfile?.payout_details?.paypal_email || "");

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let payoutDetails: any = {};
    if (payoutMethod === "mobile_money") {
      payoutDetails = { mobile_number: mobileNumber };
    } else if (payoutMethod === "bank_transfer") {
      payoutDetails = { bank_name: bankName, account_number: accountNumber };
    } else if (payoutMethod === "paypal") {
      payoutDetails = { paypal_email: paypalEmail };
    }

    await requestPayout.mutateAsync({
      amount: parseFloat(amount),
      payoutMethod,
      payoutDetails,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Request Payout
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="p-3 bg-secondary rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(availableBalance)}</p>
        </div>

        <div className="space-y-2">
          <Label>Amount (XAF)</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={5000}
            max={availableBalance}
          />
        </div>

        <div className="space-y-2">
          <Label>Payout Method</Label>
          <Select value={payoutMethod} onValueChange={setPayoutMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mobile_money">Mobile Money</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {payoutMethod === "mobile_money" && (
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <Input
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+237..."
              required
            />
          </div>
        )}

        {payoutMethod === "bank_transfer" && (
          <>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
            </div>
          </>
        )}

        {payoutMethod === "paypal" && (
          <div className="space-y-2">
            <Label>PayPal Email</Label>
            <Input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} required />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={requestPayout.isPending} className="w-full">
          {requestPayout.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Request {formatCurrency(parseFloat(amount) || 0)}
        </Button>
      </DialogFooter>
    </form>
  );
}
