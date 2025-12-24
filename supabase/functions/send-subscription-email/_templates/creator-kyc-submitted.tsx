import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Section } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props { creatorName: string; }

export const CreatorKYCSubmittedEmail = ({ creatorName }: Props) => (
  <BaseEmail previewText="KYC verification submitted">
    <Heading style={emailStyles.heading}>KYC Verification Submitted</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Your identity verification documents have been submitted successfully.
    </Text>
    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.text, margin: 0 }}>
        Our team will review your documents within 1-2 business days. You'll be notified once verified.
      </Text>
    </Section>
  </BaseEmail>
);

export default CreatorKYCSubmittedEmail;
