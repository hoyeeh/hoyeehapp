import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface UserContentPurchasedProps {
  userName: string;
  contentTitle: string;
  creatorName: string;
  amount: string;
  currency: string;
  contentId: string;
}

export const UserContentPurchased = ({
  userName,
  contentTitle,
  creatorName,
  amount,
  currency,
  contentId,
}: UserContentPurchasedProps) => (
  <BaseEmail previewText={`Your purchase of "${contentTitle}" is confirmed`}>
    <Heading style={emailStyles.heading}>Purchase Confirmed! 🎬</Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Thank you for your purchase! You now have access to exclusive content.
    </Text>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        Purchase Details:
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Content:</strong> {contentTitle}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Creator:</strong> {creatorName}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Amount Paid:</strong> {currency} {amount}
      </Text>
    </Section>
    
    <Text style={emailStyles.text}>
      You can now stream this content anytime. Enjoy your viewing experience!
    </Text>
    
    <Button href={`https://hoyeeh.com/content/${contentId}`} style={emailStyles.button}>
      Watch Now
    </Button>
    
    <Text style={emailStyles.mutedText}>
      This purchase is non-refundable. If you have any issues, please contact support.
    </Text>
  </BaseEmail>
);

export default UserContentPurchased;
