// Test LLM Vision API directly
import { config } from "dotenv";
config();

const ENV = {
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL,
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY,
};

console.log("API URL:", ENV.forgeApiUrl);
console.log("API Key exists:", !!ENV.forgeApiKey);

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

// Test with a simple image URL
const testImageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png";

async function testLLMVision() {
  const payload = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a helpful assistant that describes images." },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image briefly." },
          {
            type: "image_url",
            image_url: {
              url: testImageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  };

  console.log("Sending request to:", resolveApiUrl());
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", response.status, response.statusText);
    
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log("Success! Content:", result.choices?.[0]?.message?.content);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testLLMVision();
