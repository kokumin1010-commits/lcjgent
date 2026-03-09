/**
 * Image generation helper using OpenAI DALL-E 3 API
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = ENV.forgeApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY (or BUILT_IN_FORGE_API_KEY) is not configured");
  }

  // Use OpenAI Images API (DALL-E 3)
  const apiUrl = "https://api.openai.com/v1/images/generations";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: options.size || "1792x1024",
      response_format: "b64_json",
      quality: "standard",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data: Array<{
      b64_json: string;
      revised_prompt?: string;
    }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("No image data returned from DALL-E 3");
  }

  const base64Data = result.data[0].b64_json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return {
    url,
  };
}
