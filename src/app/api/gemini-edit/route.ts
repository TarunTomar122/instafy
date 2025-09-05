import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import { geminiImageEdit, geminiImageEditInline } from "@/utils/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { prompt, imagesBase64, imagesInline } = await req.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    if (!Array.isArray(imagesBase64) && !Array.isArray(imagesInline)) {
      return NextResponse.json(
        { error: "Provide imagesBase64[] or imagesInline[]" },
        { status: 400 }
      );
    }

    let geminiResp: Record<string, unknown>;
    if (Array.isArray(imagesInline) && imagesInline.length > 0) {
      // Inline base64 with mime types
      geminiResp = await geminiImageEditInline(prompt, imagesInline);
    } else {
      // Fallback: save base64 images to temporary files
      const tempFiles: string[] = [];
      for (const base64 of imagesBase64 as string[]) {
        const tempFile = path.join("/tmp", `gemini-upload-${Date.now()}-${Math.random()}.png`);
        const buffer = Buffer.from(base64, "base64");
        await writeFile(tempFile, buffer);
        tempFiles.push(tempFile);
      }
      geminiResp = await geminiImageEdit(prompt, tempFiles);
      await Promise.all(tempFiles.map((f) => unlink(f).catch(() => {})));
    }

    // Extract the image from Gemini response
    type GeminiPart = { inlineData?: { data?: string } };
    const respObj = geminiResp as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    const parts: GeminiPart[] = respObj?.candidates?.[0]?.content?.parts || [];
    const geminiImage = parts.find((p) => p.inlineData)?.inlineData?.data;
    if (!geminiImage) {
      return NextResponse.json({ error: "No image returned from Gemini" }, { status: 500 });
    }

    return NextResponse.json({ imageBase64: geminiImage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
