import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface CreatorContentPurchasedProps {
  creatorName: string;
  contentTitle: string;
  buyerName: string;
  amount: string;
  currency: string;
  yourEarnings: string;
}

export const CreatorContentPurchased = ({
  creatorName,
  contentTitle,
  buyerName,
  amount,
  currency,
  yourEarnings,
}: CreatorContentPurchasedProps) => (
  <BaseEmail previewText={`Someone purchased "${contentTitle}"! You earned ${currency} ${yourEarnings}`}>
    <Heading style={emailStyles.heading}>You Made a Sale! 🎊</Heading>
    
    <Text style={emailStyles.text}>
      Hello {creatorName},
    </Text>
    
    <Text style={emailStyles.text}>
      Congratulations! Someone just purchased your content.
    </Text>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        Sale Details:
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Content:</strong> {contentTitle}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Buyer:</strong> {buyerName}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Sale Price:</strong> {currency} {amount}
      </Text>
      <Text style={{ ...emailStyles.infoRow, color: '#ff6300', fontWeight: '600' }}>
        <strong>Your Earnings:</strong> {currency} {yourEarnings}
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      Your earnings have been added to your pending balance. You can request a payout once you reach the minimum threshold.
    </Text>
    
    <Button href="https://hoyeeh.com/creator/dashboard" style={emailStyles.button}>
      View Your Dashboard
    </Button>
    
    <Text style={emailStyles.mutedText}>
      Keep up the great work! Your content is making an impact.
    </Text>
  </BaseEmail>
);

export default CreatorContentPurchased;
