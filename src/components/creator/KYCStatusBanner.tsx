import { useCreatorKYC } from "@/hooks/useCreatorKYC";
import { useCreatorProfile } from "@/hooks/useCreator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface KYCStatusBannerProps {
  onOpenKYC?: () => void;
}

export function KYCStatusBanner({ onOpenKYC }: KYCStatusBannerProps) {
  const { data: creatorProfile } = useCreatorProfile();
  const { data: kyc, isLoading } = useCreatorKYC();

  if (isLoading) return null;

  const kycStatus = creatorProfile?.kyc_status || kyc?.status || 'not_started';

  if (kycStatus === 'approved') {
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-500">Identity Verified</AlertTitle>
        <AlertDescription>
          Your identity has been verified. You can request payouts anytime.
        </AlertDescription>
      </Alert>
    );
  }

  if (kycStatus === 'pending') {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10">
        <Clock className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-500">Verification In Progress</AlertTitle>
        <AlertDescription>
          Your documents are being reviewed. This usually takes 1-2 business days.
        </AlertDescription>
      </Alert>
    );
  }

  if (kycStatus === 'declined') {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Verification Declined</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{kyc?.rejection_reason || 'Your verification was declined. Please resubmit with valid documents.'}</span>
          <Button size="sm" variant="outline" onClick={onOpenKYC}>
            <Shield className="h-4 w-4 mr-2" />
            Resubmit Documents
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Not started
  return (
    <Alert className="border-orange-500/50 bg-orange-500/10">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertTitle className="text-orange-500">KYC Required for Payouts</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>Complete identity verification to enable payouts. This is a one-time process.</span>
        <Button size="sm" variant="outline" onClick={onOpenKYC}>
          <Shield className="h-4 w-4 mr-2" />
          Start Verification
        </Button>
      </AlertDescription>
    </Alert>
  );
}
