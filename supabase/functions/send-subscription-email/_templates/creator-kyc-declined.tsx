import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Section, Button } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props { creatorName: string; rejectionReason?: string; }

export const CreatorKYCDeclinedEmail = ({ creatorName, rejectionReason }: Props) => (
  <BaseEmail previewText="KYC verification update">
    <Heading style={emailStyles.heading}>KYC Verification Declined</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Unfortunately, we couldn't verify your identity with the documents provided.
    </Text>
    {rejectionReason && (
      <Section style={emailStyles.infoBoxWithBorder}>
        <Text style={{ ...emailStyles.text, margin: 0 }}><strong>Reason:</strong> {rejectionReason}</Text>
      </Section>
    )}
    <Text style={emailStyles.text}>Please resubmit with valid, clear documents.</Text>
    <Button style={emailStyles.button} href="https://hoyeeh.com/creator">Resubmit Documents</Button>
  </BaseEmail>
);

export default CreatorKYCDeclinedEmail;
