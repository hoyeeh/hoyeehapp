import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface SubscriptionCancelledProps {
  userName: string;
  expiryDate: string;
}

export const SubscriptionCancelled = ({
  userName,
  expiryDate,
}: SubscriptionCancelledProps) => (
  <BaseEmail previewText="Your Hoyeeh subscription has been cancelled">
    <Heading style={emailStyles.heading}>Subscription Cancelled</Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Your Hoyeeh Premium subscription has been successfully cancelled. We're sorry to see you go.
    </Text>
    
    <Section style={emailStyles.infoBox}>
      <Text style={emailStyles.infoRow}>
        You will continue to have access to premium content until{' '}
        <strong>{expiryDate}</strong>.
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      After this date, you'll still be able to access free content on Hoyeeh.
    </Text>
    
    <Text style={emailStyles.text}>
      Changed your mind? You can resubscribe anytime to regain access to all premium features.
    </Text>
    
    <Button href="https://hoyeeh.com/subscription" style={emailStyles.button}>
      Resubscribe to Premium
    </Button>
    
    <Text style={emailStyles.mutedText}>
      We'd love to have you back. Thank you for being part of the Hoyeeh community.
    </Text>
  </BaseEmail>
);

export default SubscriptionCancelled;
