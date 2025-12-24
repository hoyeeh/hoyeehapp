import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Section } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface CreatorContentSubmittedEmailProps {
  creatorName: string;
  contentTitle: string;
}

export const CreatorContentSubmittedEmail = ({ creatorName, contentTitle }: CreatorContentSubmittedEmailProps) => (
  <BaseEmail previewText={`Content submitted: ${contentTitle}`}>
    <Heading style={emailStyles.heading}>Content Submitted for Review</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Your content "<span style={emailStyles.highlightText}>{contentTitle}</span>" has been submitted for review.
    </Text>
    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.text, margin: 0 }}>
        Our team will review your submission within 1-2 business days. You'll receive an email once it's approved.
      </Text>
    </Section>
  </BaseEmail>
);

export default CreatorContentSubmittedEmail;
