import 'dotenv/config';
import * as fs from "node:fs";
import { GoogleAuth } from "google-auth-library";

/**
 * Reads a file and returns its base64-encoded string.
 */
function fileToBase64(path: string): string {
  const data = fs.readFileSync(path);
  return data.toString("base64");
}

/**
 * Calls Gemini API with two images and a prompt.
 * @param prompt - The text prompt for Gemini.
 * @param imagePaths - Array of image file paths (should be base64-encoded PNG/JPEG).
 * @returns The response from Gemini API.
 */
export async function geminiImageEdit(prompt: string, imagePaths: string[]) {
  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/generative-language",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  const client = await auth.getClient();
  const headers = await client.getRequestHeaders();
  headers.set("Content-Type", "application/json");

  // Prepare the prompt and images as parts
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  for (const path of imagePaths) {
    // You can adjust the mimeType if needed
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: fileToBase64(path),
      },
    });
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";
  const body = {
    generationConfig: { responseModalities: ["IMAGE"] },
    contents: [{ role: "user", parts }],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errText}`);
  }
  const json = (await resp.json()) as unknown;
  // Return the full response for flexibility
  return json as Record<string, unknown>;
}

/**
 * Calls Gemini API with base64 inline images (no filesystem writes).
 * @param prompt - The text prompt for Gemini.
 * @param images - Array of { data, mimeType } objects.
 */
export async function geminiImageEditInline(
  prompt: string,
  images: Array<{ data: string; mimeType: string }>
) {
  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/generative-language",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  const client = await auth.getClient();
  const headers = await client.getRequestHeaders();
  headers.set("Content-Type", "application/json");

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  for (const { data, mimeType } of images) {
    parts.push({ inlineData: { mimeType, data } });
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";
  const body = {
    generationConfig: { responseModalities: ["IMAGE"] },
    contents: [{ role: "user", parts }],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errText}`);
  }
  const json = (await resp.json()) as unknown;
  return json as Record<string, unknown>;
}

// Example usage:
// const result = await geminiImageEdit("Make the background blue", ["removed-bg.png", "other-image.png"]);
// // Handle result as needed