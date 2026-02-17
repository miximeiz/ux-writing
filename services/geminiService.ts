import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { SearchResult, GenerationResult, UploadedFile, BilingualAlignment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-3-flash-preview';
const MAX_TEXT_CHAR_LIMIT = 800000; // Increased limit for larger glossary context

export const checkApiKey = (): boolean => {
  return !!process.env.API_KEY;
};

// Helper to prepare parts from files, handling binary vs text
const filesToParts = (files: UploadedFile[]) => {
  return files.map(f => {
    if (f.isBinary && f.mimeType) {
      // Binary files are passed as inlineData to avoid massive token usage from base64 stringification in prompt
      return { inlineData: { mimeType: f.mimeType, data: f.content } };
    }
    // Text files: Truncate if necessary to avoid 400 errors
    let cleanContent = f.content;
    if (cleanContent.length > MAX_TEXT_CHAR_LIMIT) {
      cleanContent = cleanContent.substring(0, MAX_TEXT_CHAR_LIMIT) + "\n...[TRUNCATED due to size]...";
    }
    return { text: `[SOURCE FILE: ${f.name}]\n${cleanContent}\n[END SOURCE FILE]` };
  });
};

export const searchGlossary = async (
  query: string,
  glossaryFiles: UploadedFile[]
): Promise<SearchResult | null> => {
  if (!glossaryFiles || glossaryFiles.length === 0) return null;

  const prompt = `
    You are a high-recall, bilingual (English/Thai) UX glossary search engine.
    
    USER QUERY: "${query}"
    
    ## TASK
    Find and return every glossary entry that is relevant to the user’s query, without skipping any.
    Work step by step.

    ## HOW TO SEARCH (Follow all steps):
    1. **Normalize**: Read the user’s query and normalize it (case-insensitive; treat hyphens, spaces, and punctuation as equivalent, e.g., “two factor”, “two‑factor”, “2‑factor”).
    2. **Scope**: Search the glossary across all useful fields: term, aliases/synonyms, tags, canonical copy, examples, and usage notes.
    3. **Matching Logic**:
       - **Exact Matches**: On term or aliases.
       - **Bilingual Matches**: Thai ↔ English (e.g., "Save" ↔ "บันทึก"). If query is Thai, look for English equivalents in the row. If English, look for Thai equivalents.
       - **Synonyms/Variants**: Numeric vs Word (2FA vs Two Factor), common synonyms.
       - **Fuzzy Matches**: For minor typos (prefer exact > synonym > fuzzy).
    4. **Relevance**: If query has multiple words, treat as AND (all important words must be relevant) unless they are a phrase.
    5. **Multiple Senses**: If a term has multiple meanings/senses (e.g., different platforms or contexts), return each sense as a separate result.
    6. **No Paraphrasing**: Return the exact canonical copy and fields as they appear in the source.
    
    ## OUTPUT FORMAT (Strict JSON)
    {
      "matchFound": boolean,
      "message": "Brief summary of matches found (e.g., 'Found 5 matches for 'save' (Exact & Bilingual)').",
      "results": [
        {
          "term": "The primary term found (e.g., 'Save / บันทึก')",
          "definitions": [
            { "label": "English", "text": "Exact English copy from file" },
            { "label": "Thai", "text": "Exact Thai copy from file" },
            { "label": "Description", "text": "Context or description column content" }
          ],
          "metadata": [
             { "key": "Match Type", "value": "Why it matched (e.g., Exact, Synonym, Thai-English)" },
             { "key": "Field", "value": "Which field matched" },
             { "key": "Code/ID", "value": "Any ID/Code found" }
          ],
          "source": "Filename",
          "usageNotes": "Usage notes content"
        }
      ]
    }
  `;

  try {
    const fileParts = filesToParts(glossaryFiles);
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: prompt }, ...fileParts]
      },
      config: {
        responseMimeType: "application/json",
      },
    });
    
    if (response.text) {
      return JSON.parse(response.text) as SearchResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return {
      matchFound: false,
      message: "Error processing search. The inputs might be too large or the API key is missing.",
      results: []
    };
  }
};

export const generateMicrocopy = async (
  request: string,
  styleGuideFiles: UploadedFile[],
  glossaryFiles: UploadedFile[]
): Promise<GenerationResult | null> => {
  const prompt = `
    TASK: Generate UX microcopy for: "${request}"

    INSTRUCTIONS:
    1. Check attached Glossary files for approved terms.
    2. Apply Style Guide rules from attached files.
    3. **OUTPUT FORMAT:** Return a strict JSON object.
    4. **CONTENT STRUCTURE:**
       - **Multilingual Support:** If the request asks for multiple languages (e.g. English and Thai), you MUST provide a separate content object for EACH language in the 'content' array. Do not combine them into one text.
       - **UI Components:** For each language object, populate Title, Description, and Buttons.
       - **Variant Name:** Give a short name to the option (e.g., "Direct", "Soft", "Standard").
    5. Provide a primary option, 2-3 alternatives, and a brief rationale.
  `;

  try {
    const glossaryParts = filesToParts(glossaryFiles);
    const styleParts = filesToParts(styleGuideFiles);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
          { text: "--- GLOSSARY FILES ---" },
          ...glossaryParts,
          { text: "--- STYLE GUIDE FILES ---" },
          ...styleParts
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primary: { 
              type: Type.OBJECT,
              properties: {
                variantName: { type: Type.STRING },
                content: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      language: { type: Type.STRING },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      primaryButton: { type: Type.STRING },
                      secondaryButton: { type: Type.STRING }
                    },
                    required: ["description", "language"]
                  }
                }
              },
              required: ["variantName", "content"]
            },
            alternatives: { 
              type: Type.ARRAY, 
              items: { 
                 type: Type.OBJECT,
                 properties: {
                    variantName: { type: Type.STRING },
                    content: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          language: { type: Type.STRING },
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          primaryButton: { type: Type.STRING },
                          secondaryButton: { type: Type.STRING }
                        },
                        required: ["description", "language"]
                      }
                    }
                  },
                  required: ["variantName", "content"]
              }
            },
            rationale: { type: Type.STRING, description: "Why these choices were made." }
          },
          required: ["primary", "alternatives", "rationale"]
        }
      },
    });
    
    if (response.text) {
      return JSON.parse(response.text) as GenerationResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return null;
  }
};

export const createStyleGuide = async (
  files: UploadedFile[],
  refinement?: { currentGuide: string; instruction: string }
): Promise<string> => {
  
  let parts: any[] = [];

  if (refinement) {
    // REFINEMENT MODE
    parts.push({ text: `
      TASK: Update the existing UX Style Guide based on user feedback.

      CURRENT STYLE GUIDE:
      ${refinement.currentGuide}

      USER FEEDBACK/INSTRUCTION:
      "${refinement.instruction}"

      INSTRUCTIONS:
      1. Keep the existing Markdown structure intact.
      2. Modify the content to strictly adhere to the user's feedback.
      3. Return the full, updated Markdown document.
    `});
  } else {
    // GENERATION MODE
    parts.push({ text: `
      TASK: Create a professional, highly structured, and component-focused UX Writing Style Guide based on the provided analysis sources.

      INSTRUCTIONS:
      1. **Analyze Deeply**: Review all attached images, documents, and text to identify recurring patterns, voice, and rules.
      2. **Structure**: The output must use the following structure:
         - # [Project Name] UX Style Guide
         - ## 1. Voice & Tone (with specific attributes and examples)
         - ## 2. Core Principles (concise writing, user-first, etc.)
         - ## 3. Formatting & Mechanics
            - **Date & Time Formats** (Absolute vs Relative, specific examples like 'DD MMM YYYY')
            - Numbers, Currency, Capitalization, Punctuation.
         - ## 4. Component Microcopy Patterns (CRITICAL SECTION - Analyze and breakdown structure for each)
            - **Error Messages/Pop-ups**: Breakdown into Title, Body, and Buttons. Define structure rules.
            - **Confirmation Dialogs**: Breakdown Title, Body, Actions.
            - **Empty States**: Structure (Image, Title, Body, CTA).
            - **Toast Messages/Snackbars**: Structure (Status Icon, Brief Message, Action).
            - **Buttons & CTAs**: Rules for length and verb usage.
         - ## 5. Terminology (Preferred vs. Avoided list)
      3. **Detail Level**: For "Component Microcopy Patterns", explicitly define the *structure* of the text (e.g., "Title: 3-5 words, verb-led. Body: 1-2 sentences explaining why.").
      4. **Examples**: Include clear "Do" and "Don't" examples for every section.
      5. **Format**: Use clean, standard Markdown.
    `});
    
    // Convert files to parts
    parts = [...parts, ...filesToParts(files)];
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Style Guide Error:", error);
    return "Error creating style guide. This is likely due to the size of the uploaded documents exceeding the model's limit. Try uploading smaller files or fewer files.";
  }
};

export const matchBilingualTerms = async (
  files: UploadedFile[]
): Promise<BilingualAlignment> => {
  
  const promptText = `
    You are a bilingual terminology alignment assistant specializing in Thai–English UX and business glossaries.

    ## Objective
    Identify and extract ALL potential terms (English and Thai) from the provided content. 

    ## Task
    1. Extract all meaningful English terms and Thai terms.
    2. Pair English and Thai terms that are semantic equivalents or translations of each other found within the document.
    3. If an English term has no corresponding Thai translation in the document, place it in the "unmatchedEn" list.
    4. If a Thai term has no corresponding English translation in the document, place it in the "unmatchedTh" list.

    ## Rules
    - Match based on semantic meaning and document proximity.
    - Be thorough: capture every individual term, code, or button label you see.
    - Do NOT invent translations. If a partner isn't found in the text, it is "unmatched".

    ## Output
    Return a STRICT JSON object with these keys:
    - "matches": Array of { "en": string, "th": string }
    - "unmatchedEn": Array of strings
    - "unmatchedTh": Array of strings
  `;

  try {
    const parts = [{ text: promptText }, ...filesToParts(files)];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  th: { type: Type.STRING }
                },
                required: ["en", "th"]
              }
            },
            unmatchedEn: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            unmatchedTh: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["matches", "unmatchedEn", "unmatchedTh"]
        }
      },
    });
    
    if (response.text) {
      return JSON.parse(response.text);
    }
    return { matches: [], unmatchedEn: [], unmatchedTh: [] };
  } catch (error) {
    console.error("Gemini Bilingual Match Error:", error);
    return { matches: [], unmatchedEn: [], unmatchedTh: [] };
  }
};