import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface CreatorPayoutProcessedProps {
  creatorName: string;
  amount: string;
  currency: string;
  payoutMethod: string;
  referenceId?: string;
}

export const CreatorPayoutProcessed = ({
  creatorName,
  amount,
  currency,
  payoutMethod,
  referenceId,
}: CreatorPayoutProcessedProps) => (
  <BaseEmail previewText={`Your payout of ${currency} ${amount} has been processed`}>
    <Heading style={emailStyles.heading}>Payout Processed Successfully! 💰</Heading>
    
    <Text style={emailStyles.text}>
      Hello {creatorName},
    </Text>
    
    <Text style={emailStyles.text}>
      Great news! Your payout request has been processed and the funds are on their way.
    </Text>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        Payout Details:
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Amount:</strong> {currency} {amount}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Payment Method:</strong> {payoutMethod}
      </Text>
      {referenceId && (
        <Text style={emailStyles.infoRow}>
          <strong>Reference ID:</strong> {referenceId}
        </Text>
      )}
      <Text style={{ ...emailStyles.infoRow, marginTop: '12px', color: '#888' }}>
        Note: Depending on your payment method, it may take 1-3 business days for the funds to reflect in your account.
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      Keep creating amazing content! Your audience is waiting.
    </Text>
    
    <Button href="https://hoyeeh.com/creator/payouts" style={emailStyles.button}>
      View Payout History
    </Button>
    
    <Text style={emailStyles.mutedText}>
      For any payout-related queries, please contact our creator support team.
    </Text>
  </BaseEmail>
);

export default CreatorPayoutProcessed;
