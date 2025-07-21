const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE"; // Replace if not using env

async function testGemini() {
  if (!apiKey) {
    console.error("No Gemini API key found!");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey });

  try {
    const prompt = "Say hello as JSON: {\"hello\": \"world\"}";
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    console.log("Raw Gemini API response:", response);
    console.log("Gemini response text:", response.text);
    try {
      const parsed = JSON.parse(response.text);
      console.log("Parsed JSON:", parsed);
    } catch (e) {
      console.error("Could not parse response as JSON:", response.text);
    }
  } catch (err) {
    console.error("Gemini API call failed:", err.message || err);
  }
}

testGemini(); 
