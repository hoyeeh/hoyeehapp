import { BaseEmail, emailStyles } from './base-email.tsx';
import { Heading, Text, Button, Section } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props { creatorName: string; contentTitle: string; }

export const CreatorContentApprovedEmail = ({ creatorName, contentTitle }: Props) => (
  <BaseEmail previewText={`${contentTitle} is now live!`}>
    <Heading style={emailStyles.heading}>🎉 Content Approved!</Heading>
    <Text style={emailStyles.text}>Hi {creatorName},</Text>
    <Text style={emailStyles.text}>
      Great news! Your content "<span style={emailStyles.highlightText}>{contentTitle}</span>" has been approved and is now live on Hoyeeh.
    </Text>
    <Button style={emailStyles.button} href="https://hoyeeh.com/creator">View Your Content</Button>
  </BaseEmail>
);

export default CreatorContentApprovedEmail;
