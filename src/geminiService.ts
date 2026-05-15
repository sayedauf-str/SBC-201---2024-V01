import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

async function handleApiError(error: any) {
  const message = error?.message || String(error);
  if (message.includes("PERMISSION_DENIED") || message.includes("API_KEY_INVALID") || message.includes("invalid api key")) {
    throw new Error("Invalid or missing API Key. Please check your Gemini API key in Settings > Secrets.");
  }
  if (message.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("API Quota exceeded. If you are on the free tier, consider upgrading to a paid tier in Settings > Secrets to increase your quota.");
  }
  throw error;
}

export async function getGeminiResponse(prompt: string, history: { role: "user" | "assistant"; content: string }[], systemInstruction: string) {
  try {
    const contents = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction
      }
    });

    return response.text || "No response from AI.";
  } catch (error) {
    return await handleApiError(error);
  }
}

export async function getGeminiResponseWithImage(prompt: string, base64Image: string, mimeType: string, systemInstruction: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction
      }
    });

    return response.text || "No response from AI.";
  } catch (error) {
    return await handleApiError(error);
  }
}
