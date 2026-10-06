import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface GenerateContentOptions {
  type: ContentType;
  context: Record<string, any>;
  count?: number;
}

interface GenerateContentResult {
  success: boolean;
  content: any;
  provider: "gemini" | "lovable";
}

export function useAIContentGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateContent = async (options: GenerateContentOptions): Promise<GenerateContentResult | null> => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: options,
      });

      if (error) {
        console.error("Content generation error:", error);
        toast.error("Failed to generate content. Please try again.");
        return null;
      }

      if (!data.success) {
        toast.error(data.error || "Failed to generate content");
        return null;
      }

      toast.success("Content generated successfully");
      return data;
    } catch (err) {
      console.error("Content generation error:", err);
      toast.error("Failed to generate content. Please try again.");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Convenience methods for common use cases
  const generateEmailSubjects = (topic: string, options?: { audience?: string; tone?: string; count?: number }) => {
    return generateContent({
      type: "email_subject",
      context: { topic, ...options },
      count: options?.count || 3,
    });
  };

  const generateEmailBody = (topic: string, options?: { keyPoints?: string; cta?: string }) => {
    return generateContent({
      type: "email_body",
      context: { topic, ...options },
    });
  };

  const generateNotificationTitle = (purpose: string, options?: { contentTitle?: string; urgency?: string; count?: number }) => {
    return generateContent({
      type: "notification_title",
      context: { purpose, ...options },
      count: options?.count || 3,
    });
  };

  const generateNotificationBody = (title: string, options?: { purpose?: string; contentTitle?: string; count?: number }) => {
    return generateContent({
      type: "notification_body",
      context: { title, ...options },
      count: options?.count || 3,
    });
  };

  const generateDescription = (title: string, options?: { originalDescription?: string; genre?: string; cast?: string; year?: string }) => {
    return generateContent({
      type: "description",
      context: { title, ...options },
    });
  };

  const generateSupportReply = (issueType: string, customerMessage: string, options?: { previousMessages?: string; resolution?: string }) => {
    return generateContent({
      type: "support_reply",
      context: { issueType, customerMessage, ...options },
    });
  };

  const generateHeroSubtitle = (title: string, options?: { contentType?: string; genre?: string; count?: number }) => {
    return generateContent({
      type: "hero_subtitle",
      context: { title, ...options },
      count: options?.count || 3,
    });
  };

  const generateCTAText = (purpose: string, options?: { context?: string; count?: number }) => {
    return generateContent({
      type: "cta_text",
      context: { purpose, ...options },
      count: options?.count || 3,
    });
  };

  return {
    isGenerating,
    generateContent,
    generateEmailSubjects,
    generateEmailBody,
    generateNotificationTitle,
    generateNotificationBody,
    generateDescription,
    generateSupportReply,
    generateHeroSubtitle,
    generateCTAText,
  };
}
