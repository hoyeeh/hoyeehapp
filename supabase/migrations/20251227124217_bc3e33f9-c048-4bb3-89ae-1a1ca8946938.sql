-- Create email_templates table for admin-managed email templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admins can view all templates
CREATE POLICY "Admins can view email templates"
  ON public.email_templates
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Admins can manage templates
CREATE POLICY "Admins can manage email templates"
  ON public.email_templates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Create indexes
CREATE INDEX idx_email_templates_key ON public.email_templates(template_key);
CREATE INDEX idx_email_templates_category ON public.email_templates(category);

-- Insert default email templates
INSERT INTO public.email_templates (template_key, name, description, subject, html_content, category, variables) VALUES

-- Subscription emails
('payment_confirmation', 'Payment Confirmation', 'Sent when a user completes a payment', 'Payment Confirmed - Welcome to Hoyeeh Premium!', 
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Payment Confirmed!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Thank you for your payment. Your Hoyeeh Premium subscription is now active!</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> {{planType}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> {{amount}} {{currency}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Valid Until:</strong> {{expiryDate}}</p>
</div>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Enjoy unlimited access to African movies, TV shows, and exclusive content!</p>
<a href="https://hoyeeh.com" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Start Watching Now</a>',
'subscription', '["userName", "planType", "amount", "currency", "expiryDate"]'::jsonb),

('renewal_reminder', 'Renewal Reminder', 'Sent before subscription renewal', 'Your Hoyeeh Subscription Renews in {{daysUntilExpiry}} Days',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Subscription Renewal Reminder</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your Hoyeeh Premium subscription will automatically renew in <strong>{{daysUntilExpiry}} days</strong>.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> {{planType}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> {{amount}} {{currency}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Renewal Date:</strong> {{expiryDate}}</p>
</div>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">No action is required. Your subscription will continue seamlessly.</p>
<a href="https://hoyeeh.com/subscription" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Manage Subscription</a>',
'subscription', '["userName", "planType", "amount", "currency", "expiryDate", "daysUntilExpiry"]'::jsonb),

('expiration_warning', 'Expiration Warning', 'Sent when subscription is about to expire', '⚠️ Your Hoyeeh Subscription Expires in {{daysUntilExpiry}} Days!',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">⚠️ Subscription Expiring Soon</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your Hoyeeh Premium subscription will expire in <strong style="color: #ff6300;">{{daysUntilExpiry}} days</strong>.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Expiry Date:</strong> {{expiryDate}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Current Plan:</strong> {{planType}}</p>
</div>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Don''t lose access to your favorite African content! Renew now.</p>
<a href="https://hoyeeh.com/subscription" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Renew Now</a>',
'subscription', '["userName", "planType", "expiryDate", "daysUntilExpiry"]'::jsonb),

('subscription_cancelled', 'Subscription Cancelled', 'Sent when subscription is cancelled', 'Your Hoyeeh Subscription Has Been Cancelled',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Subscription Cancelled</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your Hoyeeh Premium subscription has been cancelled as requested.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Access Until:</strong> {{expiryDate}}</p>
</div>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">We''d love to have you back! You can resubscribe anytime.</p>
<a href="https://hoyeeh.com/subscription" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Resubscribe</a>',
'subscription', '["userName", "expiryDate"]'::jsonb),

-- User emails
('welcome', 'Welcome Email', 'Sent when a new user registers', 'Welcome to Hoyeeh - Your streaming journey begins!',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Welcome to Hoyeeh! 🎬</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Thank you for joining Hoyeeh - Africa''s premier streaming platform!</p>
<h2 style="color: #ff6300; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">What you can do now:</h2>
<ul style="color: #e0e0e0; font-size: 14px; margin: 12px 0; padding-left: 20px;">
  <li>Browse our collection of African movies and TV shows</li>
  <li>Create up to 5 profiles for your family</li>
  <li>Set up a Kids profile for age-appropriate content</li>
  <li>Subscribe to Premium for unlimited access</li>
</ul>
<a href="https://hoyeeh.com" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Start Exploring</a>',
'user', '["userName"]'::jsonb),

('support_reply', 'Support Reply', 'Sent when support replies to a ticket', 'Re: {{ticketSubject}} - Hoyeeh Support',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Support Reply</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Our support team has replied to your ticket:</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;">
  <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Ticket:</strong> {{ticketSubject}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 0; white-space: pre-wrap;">{{replyMessage}}</p>
</div>
<a href="https://hoyeeh.com" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">View Conversation</a>',
'support', '["userName", "ticketSubject", "replyMessage"]'::jsonb),

-- Content leaving soon
('content_leaving_soon', 'Content Leaving Soon', 'Notifies users about content leaving the platform', 'Content in your watchlist is leaving soon!',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Watch Before It''s Gone!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Some content you''ve been watching or have in your list is leaving Hoyeeh soon:</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  {{contentList}}
</div>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Don''t miss out - watch before they''re gone!</p>
<a href="https://hoyeeh.com" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Watch Now</a>',
'content', '["userName", "contentList"]'::jsonb),

-- Creator emails
('creator_welcome', 'Creator Welcome', 'Sent when creator application is approved', 'Welcome to the Hoyeeh Creator Program! 🎬',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Welcome to the Creator Program!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Congratulations! Your creator application has been approved. You''re now part of the Hoyeeh creator community.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Next Steps:</strong></p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">1. Complete your KYC verification to enable payouts</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">2. Upload your first content</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">3. Set your pricing and start earning</p>
</div>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Go to Creator Dashboard</a>',
'creator', '["creatorName"]'::jsonb),

('creator_content_submitted', 'Creator Content Submitted', 'Sent when creator submits content', 'Content Submitted for Review - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Content Submitted</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your content "<strong>{{contentTitle}}</strong>" has been submitted for review.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">Our team will review your content within 24-48 hours.</p>
</div>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">View Status</a>',
'creator', '["creatorName", "contentTitle"]'::jsonb),

('creator_content_approved', 'Creator Content Approved', 'Sent when content is approved', '🎉 Your Content is Now Live! - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Content Approved!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Great news! Your content "<strong>{{contentTitle}}</strong>" has been approved and is now live!</p>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">View Your Content</a>',
'creator', '["creatorName", "contentTitle"]'::jsonb),

('creator_content_rejected', 'Creator Content Rejected', 'Sent when content is rejected', 'Content Review Update - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Content Review Update</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Unfortunately, your content "<strong>{{contentTitle}}</strong>" was not approved.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;">
  <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Reason:</strong></p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 0;">{{rejectionReason}}</p>
</div>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Edit & Resubmit</a>',
'creator', '["creatorName", "contentTitle", "rejectionReason"]'::jsonb),

('creator_kyc_submitted', 'Creator KYC Submitted', 'Sent when KYC is submitted', 'KYC Verification Submitted - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">KYC Verification Submitted</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your KYC documents have been submitted for verification.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">Our team will verify within 1-3 business days.</p>
</div>',
'creator', '["creatorName"]'::jsonb),

('creator_kyc_approved', 'Creator KYC Approved', 'Sent when KYC is approved', '✅ KYC Verified - Payouts Enabled! - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">KYC Verification Approved!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your KYC verification has been approved! You can now request payouts.</p>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Request Payout</a>',
'creator', '["creatorName"]'::jsonb),

('creator_kyc_declined', 'Creator KYC Declined', 'Sent when KYC is declined', 'KYC Verification Update - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">KYC Verification Update</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Unfortunately, we couldn''t verify your KYC documents.</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 0;">{{rejectionReason}}</p>
</div>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Resubmit Documents</a>',
'creator', '["creatorName", "rejectionReason"]'::jsonb),

('creator_payout_processed', 'Creator Payout Processed', 'Sent when payout is processed', '💰 Payout Processed - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Payout Processed!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your payout has been processed!</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> {{amount}} {{currency}}</p>
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Method:</strong> {{payoutMethod}}</p>
</div>',
'creator', '["creatorName", "amount", "currency", "payoutMethod"]'::jsonb),

('creator_new_follower', 'Creator New Follower', 'Sent when creator gets a new follower', 'You have a new follower! - Hoyeeh',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">New Follower!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{creatorName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;"><strong>{{followerName}}</strong> is now following you!</p>
<a href="https://hoyeeh.com/creator" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">View Profile</a>',
'creator', '["creatorName", "followerName"]'::jsonb),

('user_content_purchased', 'User Content Purchased', 'Sent when user purchases content', 'Purchase Confirmed - {{contentTitle}}',
'<h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Purchase Confirmed!</h1>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Hello <span style="color: #ff6300; font-weight: 600;">{{userName}}</span>,</p>
<p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Your purchase of "<strong>{{contentTitle}}</strong>" is complete!</p>
<div style="background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;">
  <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> {{amount}} {{currency}}</p>
</div>
<a href="https://hoyeeh.com" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Watch Now</a>',
'user', '["userName", "contentTitle", "amount", "currency"]'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();