import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Button, Section } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface CreatorWelcomeEmailProps {
  creatorName: string;
}

export const CreatorWelcomeEmail = ({ creatorName }: CreatorWelcomeEmailProps) => (
  <BaseEmail previewText="Welcome to the Hoyeeh Creator Program!">
    <Heading style={emailStyles.heading}>Welcome to the Creator Program! 🎬</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Congratulations! Your creator application has been approved. You're now part of the Hoyeeh creator community.
    </Text>
    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.text, margin: 0 }}>
        <strong>Next Steps:</strong>
      </Text>
      <Text style={emailStyles.text}>1. Complete your KYC verification to enable payouts</Text>
      <Text style={emailStyles.text}>2. Upload your first content</Text>
      <Text style={emailStyles.text}>3. Set your pricing and start earning</Text>
    </Section>
    <Button style={emailStyles.button} href="https://hoyeeh.com/creator">
      Go to Creator Dashboard
    </Button>
  </BaseEmail>
);

export default CreatorWelcomeEmail;
