import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface WelcomeEmailProps {
  userName: string;
}

export const WelcomeEmail = ({
  userName,
}: WelcomeEmailProps) => (
  <BaseEmail previewText="Welcome to Hoyeeh - Your streaming journey begins!">
    <Heading style={emailStyles.heading}>Welcome to Hoyeeh! 🎬</Heading>
    
    <Text style={emailStyles.text}>
      Hello {userName},
    </Text>
    
    <Text style={emailStyles.text}>
      Thank you for joining Hoyeeh! We're excited to have you as part of our community.
    </Text>
    
    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        Here's what you can do on Hoyeeh:
      </Text>
      <ul style={emailStyles.list}>
        <li>Browse our extensive library of movies and TV shows</li>
        <li>Create personalized watchlists</li>
        <li>Set up family profiles with parental controls</li>
        <li>Get personalized recommendations based on your taste</li>
      </ul>
    </Section>
    
    <Text style={emailStyles.text}>
      Upgrade to <span style={emailStyles.highlightText}>Hoyeeh Premium</span> to unlock exclusive content, HD streaming, and offline downloads.
    </Text>
    
    <Button href="https://hoyeeh.com" style={emailStyles.button}>
      Start Exploring
    </Button>
    
    <Text style={emailStyles.mutedText}>
      Have questions? Our support team is always here to help.
    </Text>
  </BaseEmail>
);

export default WelcomeEmail;
