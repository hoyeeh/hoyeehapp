import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface PaymentConfirmationProps {
  userName: string;
  amount: number;
  currency: string;
  planType: string;
  expiryDate: string;
}

export const PaymentConfirmation = ({
  userName,
  amount,
  currency,
  planType,
  expiryDate,
}: PaymentConfirmationProps) => (
  <BaseEmail previewText="Your Hoyeeh Premium subscription is now active!">
    <Heading style={emailStyles.heading}>Welcome to Hoyeeh Premium! 🎉</Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Thank you for subscribing to Hoyeeh Premium. Your payment has been confirmed and your account is now active.
    </Text>
    
    <Section style={emailStyles.infoBox}>
      <Text style={emailStyles.infoRow}>
        <strong>Plan:</strong> {planType}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Amount Paid:</strong> {amount?.toLocaleString()} {currency}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Valid Until:</strong> {expiryDate}
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      You now have unlimited access to all premium content including:
    </Text>
    
    <ul style={emailStyles.list}>
      <li>Exclusive movies and TV series</li>
      <li>HD and 4K streaming quality</li>
      <li>Offline downloads</li>
      <li>Ad-free viewing experience</li>
    </ul>
    
    <Button href="https://hoyeeh.com" style={emailStyles.button}>
      Start Watching Now
    </Button>
    
    <Text style={emailStyles.mutedText}>
      If you have any questions, please don't hesitate to contact our support team.
    </Text>
  </BaseEmail>
);

export default PaymentConfirmation;
