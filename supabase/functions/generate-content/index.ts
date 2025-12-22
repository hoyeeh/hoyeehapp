import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentType = 
  | "email_subject"
  | "email_body"
  | "notification_title"
  | "notification_body"
  | "description"
  | "campaign"
  | "support_reply"
  | "hero_subtitle"
  | "cta_text";

interface GenerateRequest {
  type: ContentType;
  context: Record<string, any>;
  count?: number; // Number of variations to generate (default: 3)
}

const systemPrompts: Record<ContentType, string> = {
  email_subject: `You are an expert email marketer for Hoyeeh, Africa's premier streaming platform. Generate compelling email subject lines that:
- Are concise (under 60 characters)
- Create urgency or curiosity
- Highlight value to the reader
- Avoid spam trigger words
Return exactly the number of variations requested as a JSON array of strings.`,

  email_body: `You are an expert email copywriter for Hoyeeh, Africa's premier streaming platform. Generate professional email body content that:
- Opens with a compelling hook
- Clearly communicates the value proposition
- Includes a clear call-to-action
- Uses a warm, conversational tone
- Is properly formatted with paragraphs
Return the content as a JSON object with 'html' (formatted email) and 'plain' (plain text) versions.`,

  notification_title: `You are a push notification expert for Hoyeeh streaming service. Generate notification titles that:
- Are short (under 50 characters)
- Grab attention immediately
- Create urgency or excitement
- Are appropriate for mobile screens
Return exactly the number of variations requested as a JSON array of strings.`,

  notification_body: `You are a push notification expert for Hoyeeh streaming service. Generate notification body text that:
- Is concise (under 100 characters)
- Complements the title
- Includes relevant details
- Drives user action
Return exactly the number of variations requested as a JSON array of strings.`,

  description: `You are a content curator for Hoyeeh, Africa's premier streaming platform. Generate engaging content descriptions that:
- Capture the essence of the movie/show
- Create intrigue without spoilers
- Highlight key selling points (cast, genre, awards)
- Match Hoyeeh's brand voice
Return a JSON object with 'short' (2-3 sentences) and 'full' (paragraph) versions.`,

  campaign: `You are a marketing strategist for Hoyeeh streaming platform. Generate a complete email campaign including:
- Subject line options (3 variations)
- Preview text
- Email body with HTML formatting
- Call-to-action text
Return as a structured JSON object.`,

  support_reply: `You are a customer support agent for Hoyeeh streaming service. Generate helpful, empathetic support responses that:
- Acknowledge the customer's concern
- Provide clear solutions
- Maintain a professional yet friendly tone
- Include next steps if applicable
Return the response as a JSON object with 'message' and 'suggestedActions' array.`,

  hero_subtitle: `You are a marketing copywriter for Hoyeeh streaming platform. Generate compelling hero banner subtitles that:
- Are impactful and memorable
- Support the main title
- Are concise (under 80 characters)
- Create excitement
Return exactly the number of variations requested as a JSON array of strings.`,

  cta_text: `You are a UX copywriter for Hoyeeh streaming platform. Generate effective call-to-action button text that:
- Is action-oriented
- Creates urgency
- Is short (2-4 words)
- Is appropriate for the context
Return exactly the number of variations requested as a JSON array of strings.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, context, count = 3 }: GenerateRequest = await req.json();

    if (!type || !systemPrompts[type]) {
      return new Response(
        JSON.stringify({ error: "Invalid content type", validTypes: Object.keys(systemPrompts) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user prompt based on context
    let userPrompt = "";
    switch (type) {
      case "email_subject":
        userPrompt = `Generate ${count} email subject line variations for: ${context.topic || "general announcement"}
${context.audience ? `Target audience: ${context.audience}` : ""}
${context.tone ? `Tone: ${context.tone}` : ""}
${context.campaign ? `Campaign: ${context.campaign}` : ""}`;
        break;

      case "email_body":
        userPrompt = `Generate email body content for:
Topic: ${context.topic || "announcement"}
Key points to cover: ${context.keyPoints || "N/A"}
${context.cta ? `Call-to-action: ${context.cta}` : ""}
${context.recipientName ? `Recipient name placeholder: ${context.recipientName}` : ""}`;
        break;

      case "notification_title":
        userPrompt = `Generate ${count} push notification titles for:
Purpose: ${context.purpose || "engagement"}
${context.contentTitle ? `Content: ${context.contentTitle}` : ""}
${context.urgency ? `Urgency level: ${context.urgency}` : ""}`;
        break;

      case "notification_body":
        userPrompt = `Generate ${count} push notification body texts for:
Title: ${context.title || "New on Hoyeeh"}
Purpose: ${context.purpose || "engagement"}
${context.contentTitle ? `Content: ${context.contentTitle}` : ""}`;
        break;

      case "description":
        userPrompt = `Generate descriptions for this content:
Title: ${context.title || "Unknown"}
Original description: ${context.originalDescription || "N/A"}
Genre: ${context.genre || "N/A"}
Cast: ${context.cast || "N/A"}
Year: ${context.year || "N/A"}`;
        break;

      case "campaign":
        userPrompt = `Create a complete email campaign for:
Campaign goal: ${context.goal || "engagement"}
Target audience: ${context.audience || "all subscribers"}
Key message: ${context.message || "N/A"}
${context.deadline ? `Deadline/Date: ${context.deadline}` : ""}`;
        break;

      case "support_reply":
        userPrompt = `Generate a support response for:
Issue type: ${context.issueType || "general inquiry"}
Customer message: ${context.customerMessage || "N/A"}
${context.previousMessages ? `Previous conversation: ${context.previousMessages}` : ""}
Resolution needed: ${context.resolution || "provide assistance"}`;
        break;

      case "hero_subtitle":
        userPrompt = `Generate ${count} hero banner subtitle options for:
Title: ${context.title || "Featured Content"}
Content type: ${context.contentType || "movie"}
${context.genre ? `Genre: ${context.genre}` : ""}`;
        break;

      case "cta_text":
        userPrompt = `Generate ${count} call-to-action button texts for:
Purpose: ${context.purpose || "watch now"}
Context: ${context.context || "general"}`;
        break;
    }

    const messages = [
      { role: "system" as const, content: systemPrompts[type] },
      { role: "user" as const, content: userPrompt },
    ];

    console.log(`Generating ${type} content...`);
    
    const { content, provider } = await callAI(messages);
    console.log(`Content generated using: ${provider}`);

    // Try to parse the response as JSON
    let parsedContent;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      parsedContent = JSON.parse(jsonStr.trim());
    } catch {
      // If parsing fails, return as-is
      parsedContent = content;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        type,
        content: parsedContent,
        provider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Content generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
