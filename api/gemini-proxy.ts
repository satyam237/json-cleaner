
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME } from '../constants'; // Adjust path if constants.tsx is not in root

// Make sure GEMINI_MODEL_NAME is accessible. If constants.tsx is in the root:
// import { GEMINI_MODEL_NAME } from '../constants'; 
// If constants.tsx is elsewhere, adjust the path.
// For simplicity, if it's not found, we'll redefine it here, but ideally, share it.
const EFFECTIVE_GEMINI_MODEL_NAME = GEMINI_MODEL_NAME || "gemini-2.5-flash-preview-04-17";


export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(500).json({ 
      error: "API key not configured on the server.",
      title: "Server Configuration Error",
      isAiError: true 
    });
  }

  const { jsonString, targetOutputFormat } = req.body;

  if (typeof jsonString !== 'string' || typeof targetOutputFormat !== 'string') {
    return res.status(400).json({ 
      error: "Invalid request body. 'jsonString' and 'targetOutputFormat' are required.",
      title: "Bad Request",
      isAiError: true
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const targetFormatDescription = targetOutputFormat === 'json'
      ? "standard JSON, pretty-printed with 2-space indentation"
      : "Python dictionary/list syntax, pretty-printed with 2-space indentation (using True, False, and None for booleans and nulls respectively; keys and strings should be double-quoted)";

    const prompt = `
You are an expert at identifying and correcting data structures like JSON or Python dictionaries/lists.
Analyze the following input text:
\`\`\`
${jsonString}
\`\`\`
First, determine if the input appears to be an attempt to represent a data structure.
- If the input does NOT appear to be a data structure (e.g., it's plain text, a sentence, a question, etc.), return a JSON object like: {"error": "Input does not appear to be a JSON or Python-like data structure."}
- If the input DOES appear to be an attempt at a data structure, please correct it into valid, well-formed ${targetFormatDescription}.
  Then, return ONLY a JSON object with a single key "correctedText" containing the corrected string.
  For example: {"correctedText": "YOUR_CORRECTED_AND_FORMATTED_STRING_HERE"}
  Ensure the string value within "correctedText" is properly escaped if it contains special characters for JSON.
- If the input appears to be a data structure but is too malformed to reasonably correct into the target format, return a JSON object like: {"error": "The input data structure is too malformed to be corrected."}

Do not add any explanations or conversational text outside of the JSON object. Just the JSON object.
`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: EFFECTIVE_GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });
    
    // The Gemini API (when responseMimeType is application/json) should directly return parseable JSON text.
    // However, sometimes it might be wrapped or have slight variations.
    let aiResponseText = response.text.trim();
    const fenceRegex = /^\`\`\`(\w*)?\s*\n?(.*?)\n?\s*\`\`\`$/s;
    const match = aiResponseText.match(fenceRegex);
    if (match && match[2]) {
      aiResponseText = match[2].trim();
    }

    // Attempt to parse the AI's response text to ensure it's valid JSON before sending.
    // This `aiResponseText` should itself be the JSON like {"correctedText": "..."} or {"error": "..."}
    try {
      const parsedAiResponse = JSON.parse(aiResponseText);
      return res.status(200).json(parsedAiResponse);
    } catch (parseError) {
      console.error("Error parsing AI's JSON response:", parseError);
      console.error("AI's raw response text:", aiResponseText);
      return res.status(500).json({ 
        error: "AI returned a response that was not valid JSON.",
        title: "AI Response Error",
        details: aiResponseText, // Send raw response for debugging
        isAiError: true 
      });
    }

  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({ 
      error: error.message || 'An unknown error occurred while contacting the AI service.',
      title: "AI Service Error",
      isAiError: true 
    });
  }
}
