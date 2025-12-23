import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface BaseEmailProps {
  previewText: string;
  children: React.ReactNode;
}

export const BaseEmail = ({ previewText, children }: BaseEmailProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Logo Header */}
        <Section style={logoSection}>
          <Img
            src="https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png"
            width="150"
            height="50"
            alt="Hoyeeh"
            style={logo}
          />
        </Section>
        
        {/* Main Content */}
        <Section style={contentSection}>
          {children}
        </Section>
        
        {/* Footer */}
        <Hr style={hr} />
        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} Hoyeeh. All rights reserved.
          </Text>
        <Text style={footerLinks}>
            <Link href="https://hoyeeh.com" style={footerLink}>Visit Hoyeeh</Link>
            {' • '}
            <Link href="https://hoyeeh.com/subscription" style={footerLink}>Manage Subscription</Link>
            {' • '}
            <Link href="https://hoyeeh.com/notifications" style={footerLink}>Email Preferences</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Styles
const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const logo = {
  margin: '0 auto',
};

const contentSection = {
  backgroundColor: '#141414',
  borderRadius: '12px',
  padding: '32px',
};

const hr = {
  borderColor: '#333',
  margin: '32px 0',
};

const footer = {
  textAlign: 'center' as const,
};

const footerText = {
  color: '#666',
  fontSize: '12px',
  margin: '0 0 8px 0',
};

const footerLinks = {
  color: '#666',
  fontSize: '12px',
  margin: '0',
};

const footerLink = {
  color: '#ff6300',
  textDecoration: 'none',
};

export default BaseEmail;

// Shared styles for email templates
export const emailStyles = {
  heading: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  subheading: {
    color: '#ff6300',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  text: {
    color: '#e0e0e0',
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 16px 0',
  },
  highlightText: {
    color: '#ff6300',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0',
  },
  infoBoxWithBorder: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0',
    borderLeft: '4px solid #ff6300',
  },
  infoRow: {
    color: '#e0e0e0',
    fontSize: '14px',
    margin: '8px 0',
  },
  button: {
    backgroundColor: '#ff6300',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'block',
    padding: '14px 32px',
    margin: '24px auto',
  },
  mutedText: {
    color: '#888',
    fontSize: '14px',
    margin: '16px 0 0 0',
  },
  list: {
    color: '#e0e0e0',
    fontSize: '14px',
    margin: '12px 0',
    paddingLeft: '20px',
  },
};
