export async function getGeminiResponse(prompt: string, history: { role: "user" | "assistant"; content: string }[], systemInstruction: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, systemInstruction })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch AI response");
  }

  const data = await response.json();
  return data.text || "No response from AI.";
}

export async function getGeminiResponseWithImage(prompt: string, base64Image: string, mimeType: string, systemInstruction: string) {
  const response = await fetch("/api/chat-with-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, base64Image, mimeType, systemInstruction })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch AI response");
  }

  const data = await response.json();
  return data.text || "No response from AI.";
}
