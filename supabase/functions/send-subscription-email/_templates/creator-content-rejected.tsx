import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Section } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props { creatorName: string; contentTitle: string; rejectionReason?: string; }

export const CreatorContentRejectedEmail = ({ creatorName, contentTitle, rejectionReason }: Props) => (
  <BaseEmail previewText={`Content update: ${contentTitle}`}>
    <Heading style={emailStyles.heading}>Content Not Approved</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Unfortunately, your content "<span style={emailStyles.highlightText}>{contentTitle}</span>" was not approved.
    </Text>
    {rejectionReason && (
      <Section style={emailStyles.infoBoxWithBorder}>
        <Text style={{ ...emailStyles.text, margin: 0 }}><strong>Reason:</strong> {rejectionReason}</Text>
      </Section>
    )}
    <Text style={emailStyles.text}>You can make changes and resubmit from your creator dashboard.</Text>
  </BaseEmail>
);

export default CreatorContentRejectedEmail;
