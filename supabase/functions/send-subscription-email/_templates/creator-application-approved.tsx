import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface CreatorApplicationApprovedProps {
  creatorName: string;
}

export const CreatorApplicationApproved = ({
  creatorName,
}: CreatorApplicationApprovedProps) => (
  <BaseEmail previewText="Congratulations! Your creator application has been approved">
    <Heading style={emailStyles.heading}>Welcome to the Creator Program! 🎉</Heading>
    
    <Text style={emailStyles.text}>
      Hello {creatorName},
    </Text>
    
    <Text style={emailStyles.text}>
      We're thrilled to inform you that your application to become a Hoyeeh Creator has been <span style={emailStyles.highlightText}>approved</span>!
    </Text>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        As a Hoyeeh Creator, you can now:
      </Text>
      <ul style={emailStyles.list}>
        <li>Upload and sell your original content</li>
        <li>Set your own prices for premium content</li>
        <li>Track your earnings and analytics</li>
        <li>Request payouts to your preferred payment method</li>
        <li>Build your audience and grow your brand</li>
      </ul>
    </Section>
    
    <Text style={emailStyles.text}>
      Start by visiting your Creator Dashboard to set up your profile and upload your first content.
    </Text>
    
    <Button href="https://hoyeeh.com/creator/dashboard" style={emailStyles.button}>
      Go to Creator Dashboard
    </Button>
    
    <Text style={emailStyles.mutedText}>
      If you have any questions, our creator support team is here to help you succeed.
    </Text>
  </BaseEmail>
);

export default CreatorApplicationApproved;
