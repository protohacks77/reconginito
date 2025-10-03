import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const MODEL_NAME = "gemini-pro-vision";
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Ensure the API key is available
if (!API_KEY) {
  throw new Error("VITE_GEMINI_API_KEY is not defined in your environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// Configuration for content generation
const generationConfig = {
  temperature: 0.4,
  topK: 32,
  topP: 1,
  maxOutputTokens: 4096,
};

// Safety settings to minimize blocking
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Converts a base64 image string to a GenerativePart object.
 * @param imageData The base64 encoded image data.
 * @returns An object suitable for the Gemini API.
 */
function fileToGenerativePart(imageData: string) {
  return {
    inlineData: {
      data: imageData.split(',')[1], // Remove the "data:image/jpeg;base64," prefix
      mimeType: "image/jpeg",
    },
  };
}

/**
 * Generates a description of a person's clothing from an image.
 * @param imageData The base64 encoded image of the person.
 * @returns A promise that resolves to a string describing the clothing.
 */
export async function generateClothingDescription(imageData: string): Promise<string> {
  try {
    const parts = [
      fileToGenerativePart(imageData),
      { text: "Describe the clothing of the person in this image in a concise sentence. For example: 'A person wearing a red t-shirt and blue jeans.'" },
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
      safetySettings,
    });

    const response = result.response;
    const description = response.text();
    return description.trim();
  } catch (error) {
    console.error("Error generating description from Gemini:", error);
    return "Could not generate description.";
  }
}