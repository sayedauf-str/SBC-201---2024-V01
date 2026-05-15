import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getGeminiResponse(prompt: string, history: { role: "user" | "assistant"; content: string }[], systemInstruction: string) {
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  // Add the current prompt
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
}

export async function getGeminiResponseWithImage(prompt: string, base64Image: string, mimeType: string, systemInstruction: string) {
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
}
