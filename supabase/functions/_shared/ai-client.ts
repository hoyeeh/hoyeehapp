// Shared AI client with Gemini as primary and Lovable AI as fallback

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
  provider: "gemini" | "lovable";
}

// Convert OpenAI-style messages to Gemini format
function convertToGeminiFormat(messages: Message[]) {
  const systemPrompt = messages.find(m => m.role === "system")?.content || "";
  const userMessages = messages.filter(m => m.role !== "system");
  
  const contents = userMessages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  return {
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents
  };
}

// Call Gemini API directly
async function callGeminiDirect(apiKey: string, messages: Message[]): Promise<string> {
  const geminiPayload = convertToGeminiFormat(messages);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...geminiPayload,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Invalid Gemini response structure");
  }

  return data.candidates[0].content.parts[0].text;
}

// Call Lovable AI gateway (fallback)
async function callLovableAI(apiKey: string, messages: Message[], model = "google/gemini-2.5-flash"): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Main function: Try Gemini first, fallback to Lovable AI
export async function callAI(messages: Message[], options?: { model?: string }): Promise<AIResponse> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  // Try Gemini first if key is available
  if (geminiKey) {
    try {
      console.log("Attempting Gemini API call...");
      const content = await callGeminiDirect(geminiKey, messages);
      console.log("Gemini API call successful");
      return { content, provider: "gemini" };
    } catch (error) {
      console.error("Gemini API failed, falling back to Lovable AI:", error);
    }
  } else {
    console.log("No GEMINI_API_KEY set, using Lovable AI");
  }

  // Fallback to Lovable AI
  if (lovableKey) {
    try {
      console.log("Attempting Lovable AI call...");
      const content = await callLovableAI(lovableKey, messages, options?.model);
      console.log("Lovable AI call successful");
      return { content, provider: "lovable" };
    } catch (error) {
      console.error("Lovable AI also failed:", error);
      throw new Error("All AI providers failed");
    }
  }

  throw new Error("No AI provider available - please configure GEMINI_API_KEY or LOVABLE_API_KEY");
}

// Parse JSON from AI response (handles markdown code blocks)
export function parseJSONFromAI(content: string): any {
  let jsonStr = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  
  return JSON.parse(jsonStr.trim());
}
