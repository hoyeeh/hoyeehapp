import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface RenewalReminderProps {
  userName: string;
  amount: number;
  currency: string;
  planType: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export const RenewalReminder = ({
  userName,
  amount,
  currency,
  planType,
  expiryDate,
  daysUntilExpiry,
}: RenewalReminderProps) => (
  <BaseEmail previewText={`Your Hoyeeh subscription renews in ${daysUntilExpiry} days`}>
    <Heading style={emailStyles.heading}>Subscription Renewal Reminder</Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Your Hoyeeh Premium subscription will renew in{' '}
      <strong>{daysUntilExpiry} days</strong> on {expiryDate}.
    </Text>
    
    <Section style={emailStyles.infoBox}>
      <Text style={emailStyles.infoRow}>
        <strong>Plan:</strong> {planType}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Renewal Amount:</strong> {amount?.toLocaleString()} {currency}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Renewal Date:</strong> {expiryDate}
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      Make sure your payment method is up to date to continue enjoying uninterrupted access to all premium content.
    </Text>
    
    <Button href="https://hoyeeh.com/subscription" style={emailStyles.button}>
      Manage Subscription
    </Button>
    
    <Text style={emailStyles.mutedText}>
      Thank you for being a valued Hoyeeh Premium member.
    </Text>
  </BaseEmail>
);

export default RenewalReminder;
