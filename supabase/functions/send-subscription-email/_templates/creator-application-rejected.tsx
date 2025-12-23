import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface CreatorApplicationRejectedProps {
  creatorName: string;
  rejectionReason?: string;
}

export const CreatorApplicationRejected = ({
  creatorName,
  rejectionReason,
}: CreatorApplicationRejectedProps) => (
  <BaseEmail previewText="Update on your creator application">
    <Heading style={emailStyles.heading}>Application Status Update</Heading>
    
    <Text style={emailStyles.text}>
      Hello {creatorName},
    </Text>
    
    <Text style={emailStyles.text}>
      Thank you for your interest in becoming a Hoyeeh Creator. After careful review, we regret to inform you that we are unable to approve your application at this time.
    </Text>
    
    {rejectionReason && (
      <Section style={emailStyles.infoBox}>
        <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '8px' }}>
          Feedback from our team:
        </Text>
        <Text style={emailStyles.infoRow}>
          {rejectionReason}
        </Text>
      </Section>
    )}
    
    <Text style={emailStyles.text}>
      This doesn't mean the door is closed forever. We encourage you to:
    </Text>
    
    <ul style={emailStyles.list}>
      <li>Build your portfolio with more original content</li>
      <li>Grow your presence on social media platforms</li>
      <li>Reapply in 30 days with updated information</li>
    </ul>
    
    <Button href="https://hoyeeh.com/creator/apply" style={emailStyles.button}>
      Apply Again Later
    </Button>
    
    <Text style={emailStyles.mutedText}>
      If you have questions about this decision, please contact our support team.
    </Text>
  </BaseEmail>
);

export default CreatorApplicationRejected;
