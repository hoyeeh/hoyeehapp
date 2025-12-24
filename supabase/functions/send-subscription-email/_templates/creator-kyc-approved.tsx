import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Button } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props { creatorName: string; }

export const CreatorKYCApprovedEmail = ({ creatorName }: Props) => (
  <BaseEmail previewText="KYC verified - Payouts enabled!">
    <Heading style={emailStyles.heading}>✅ Identity Verified!</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Your identity has been verified. You can now request payouts from your creator dashboard.
    </Text>
    <Button style={emailStyles.button} href="https://hoyeeh.com/creator">Request Payout</Button>
  </BaseEmail>
);

export default CreatorKYCApprovedEmail;
