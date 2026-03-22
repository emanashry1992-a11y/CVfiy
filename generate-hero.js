import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage() {
  try {
    console.log("Generating image...");
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: 'A professional businessman in a navy blue suit, light blue shirt, and dark blue dotted tie, standing in a modern glass office. The image is strictly cropped at the neck so the face is completely invisible. High quality, corporate photography, 16:9 aspect ratio.',
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      },
    });

    let base64Data = null;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
        break;
      }
    }

    if (base64Data) {
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
      }
      fs.writeFileSync(path.join(publicDir, 'hero-bg.png'), Buffer.from(base64Data, 'base64'));
      console.log("Image generated and saved to public/hero-bg.png");
    } else {
      console.error("No image data found in the response.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

generateImage();
