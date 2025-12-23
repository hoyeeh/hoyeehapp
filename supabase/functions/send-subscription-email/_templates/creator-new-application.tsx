import {
  Heading,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'
import { BaseEmail, emailStyles } from './base-email.tsx'

interface CreatorNewApplicationProps {
  applicantName: string;
  applicantEmail: string;
  description: string;
  portfolioUrl?: string;
}

export const CreatorNewApplication = ({
  applicantName,
  applicantEmail,
  description,
  portfolioUrl,
}: CreatorNewApplicationProps) => (
  <BaseEmail previewText={`New creator application from ${applicantName}`}>
    <Heading style={emailStyles.heading}>New Creator Application 📝</Heading>
    
    <Text style={emailStyles.text}>
      A new creator application has been submitted and is awaiting review.
    </Text>
    
    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '12px' }}>
        Applicant Details:
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Name:</strong> {applicantName}
      </Text>
      <Text style={emailStyles.infoRow}>
        <strong>Email:</strong> {applicantEmail}
      </Text>
      {portfolioUrl && (
        <Text style={emailStyles.infoRow}>
          <strong>Portfolio:</strong> {portfolioUrl}
        </Text>
      )}
    </Section>
    
    <Section style={emailStyles.infoBoxWithBorder}>
      <Text style={{ ...emailStyles.infoRow, fontWeight: '600', marginBottom: '8px' }}>
        Application Description:
      </Text>
      <Text style={emailStyles.infoRow}>
        {description}
      </Text>
    </Section>
    
    <Button href="https://hoyeeh.com/admin?tab=creators" style={emailStyles.button}>
      Review Application
    </Button>
    
    <Text style={emailStyles.mutedText}>
      This is an automated notification for Hoyeeh administrators.
    </Text>
  </BaseEmail>
);

export default CreatorNewApplication;
