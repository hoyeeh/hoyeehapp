import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface ExpirationWarningProps {
  userName: string;
  amount: number;
  currency: string;
  planType: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export const ExpirationWarning = ({
  userName,
  amount,
  currency,
  planType,
  expiryDate,
  daysUntilExpiry,
}: ExpirationWarningProps) => (
  <BaseEmail previewText={`Your Hoyeeh subscription expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}!`}>
    <Heading style={emailStyles.subheading}>
      ⚠️ Subscription Expiring Soon
    </Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Your Hoyeeh Premium subscription expires in{' '}
      <span style={emailStyles.highlightText}>
        {daysUntilExpiry} day{daysUntilExpiry > 1 ? 's' : ''}
      </span>{' '}
      on {expiryDate}.
    </Text>
    
    <Text style={{ ...emailStyles.text, fontSize: '18px', color: '#ff6300' }}>
      <strong>Don't lose access to your favorite content!</strong>
    </Text>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        What you'll lose:
      </Text>
      <ul style={emailStyles.list}>
        <li>Access to all premium movies and series</li>
        <li>HD and 4K streaming quality</li>
        <li>Offline downloads</li>
        <li>Ad-free experience</li>
      </ul>
    </Section>
    
    <Button href="https://hoyeeh.com/subscription" style={emailStyles.button}>
      Renew Now for {amount?.toLocaleString()} {currency}
    </Button>
    
    <Text style={emailStyles.mutedText}>
      If you've already renewed, please ignore this email.
    </Text>
  </BaseEmail>
);

export default ExpirationWarning;
