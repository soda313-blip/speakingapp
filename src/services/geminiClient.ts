import { GoogleGenAI, Type } from "@google/genai";

export interface FeedbackRequest {
  situation:
    | "success"
    | "partial"
    | "fail_1_recast"
    | "fail_2_elicitation"
    | "fail_3_chunking"
    | "no_speech";
  targetSentence: string;
  spokenText: string;
  missingKeywords: string[];
  matchedKeywords: string[];
  partnerQuestion: string;
}

export interface FeedbackResponse {
  english: string;
  korean: string;
  combined: string;
  strategyLabel: string;
  source: "gemini" | "table_fallback";
}

function getSafeApiKey(): string {
  try {
    // Vite replaces process.env.GEMINI_API_KEY at build time
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      return key;
    }
  } catch {
    // ignore ReferenceError if process is not defined
  }
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> })
      .env;
    if (metaEnv?.VITE_GEMINI_API_KEY) {
      return metaEnv.VITE_GEMINI_API_KEY;
    }
  } catch {
    // ignore
  }
  return "";
}

function getGenAIClient(): GoogleGenAI | null {
  try {
    const apiKey = getSafeApiKey();
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn("Non-critical Gemini init skipped:", err);
    return null;
  }
}

export function getFallbackFeedback(req: FeedbackRequest): FeedbackResponse {
  const { situation, targetSentence, missingKeywords } = req;
  const firstMissing = missingKeywords?.[0] || "because";
  const firstLetter = firstMissing.charAt(0).toLowerCase();
  const upperLetter = firstMissing.charAt(0).toUpperCase();

  const maskedSentence = (targetSentence || "").replace(
    new RegExp(`\\b${firstMissing}\\b`, "i"),
    `${firstLetter}__`
  );

  const words = (targetSentence || "").replace(/[.!?]+$/, "").split(/\s+/);
  const chunkWords =
    words.length > 3 ? words.slice(-4).join(" ") : words.join(" ");

  switch (situation) {
    case "success":
      return {
        english: "Great job I understood your point.",
        korean: "잘했어 네가 뭐라고 말하는지 이해했어.",
        combined:
          "Great job I understood your point. (잘했어 네가 뭐라고 말하는지 이해했어.)",
        strategyLabel: "Success",
        source: "table_fallback",
      };
    case "partial":
      return {
        english: "Good job just remember these words next time.",
        korean: "잘했는데 다음엔 이 단어들을 잊지마.",
        combined:
          "Good job just remember these words next time. (잘했는데 다음엔 이 단어들을 잊지마.)",
        strategyLabel: "Success + small word missing",
        source: "table_fallback",
      };
    case "fail_1_recast":
      return {
        english: `Nice try but this time can you say: "${targetSentence}"`,
        korean: "잘했는데 이번에는 이렇게 말해 볼까?",
        combined: `Nice try but this time can you say: "${targetSentence}" (잘했는데 이번에는 이렇게 말해 볼까?)`,
        strategyLabel: "1st failure (recast)",
        source: "table_fallback",
      };
    case "fail_2_elicitation":
      return {
        english: `Nice try but when reasoning you need to use a word that starts with ${upperLetter}. "${maskedSentence}"`,
        korean: `'이유'를 말할 땐 ${firstLetter}로 시작하는 단어가 필요해.`,
        combined: `Nice try but when reasoning you need to use a word that starts with ${upperLetter}. "${maskedSentence}" ('이유'를 말할 땐 ${firstLetter}로 시작하는 단어가 필요해.)`,
        strategyLabel: "2nd failure (elicitation)",
        source: "table_fallback",
      };
    case "fail_3_chunking":
      return {
        english: `Let's try saying it in short chunks. Repeat after me: "${chunkWords}."`,
        korean: "이번에는 짧게 나눠서 따라 말해보자",
        combined: `Let's try saying it in short chunks. Repeat after me: "${chunkWords}." (이번에는 짧게 나눠서 따라 말해보자)`,
        strategyLabel: "3rd failure (chunking)",
        source: "table_fallback",
      };
    case "no_speech":
    default:
      return {
        english:
          "I couldn't hear you, could you tap the mic and try speaking again?",
        korean: "소리가 안들렸어. 마이크를 누르고 다시 말해 주겠어?",
        combined:
          "I couldn't hear you, could you tap the mic and try speaking again? (소리가 안들렸어. 마이크를 누르고 다시 말해 주겠어?)",
        strategyLabel: "No speech recognized",
        source: "table_fallback",
      };
  }
}

/**
 * Converts a recorded audio Blob (from MediaRecorder) to a base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64 || "");
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Pure client-side audio transcription using @google/genai from MediaRecorder audio Blob.
 */
export async function transcribeAudioBlobClientSide(
  audioBlob: Blob,
  targetSentence: string
): Promise<string> {
  if (!audioBlob || audioBlob.size < 200) {
    return "";
  }

  const ai = getGenAIClient();
  if (!ai) {
    return "";
  }

  let base64Data = "";
  try {
    base64Data = await blobToBase64(audioBlob);
  } catch (err) {
    console.warn("Non-critical blobToBase64 skipped:", err);
    return "";
  }

  if (!base64Data) return "";

  const mimeType = audioBlob.type
    ? audioBlob.type.split(";")[0]
    : "audio/webm";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: `Transcribe the spoken English sentence in this audio. Return ONLY the plain spoken English words, nothing else. If the speaker is silent or only background noise is present, return an empty string. (Context: student is practicing saying "${targetSentence}")`,
          },
        ],
      },
    });
    return (response.text || "").trim();
  } catch (err) {
    console.warn("Non-critical primary transcribe skipped:", err);
    try {
      const fallbackRes = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Transcribe the spoken English sentence in this audio into plain text only. If no speech is audible, return an empty string.",
            },
          ],
        },
      });
      return (fallbackRes.text || "").trim();
    } catch (innerErr) {
      console.warn("Non-critical secondary transcribe skipped:", innerErr);
      return "";
    }
  }
}

/**
 * Pure client-side feedback generation using @google/genai with guaranteed Section 7 table fallback.
 */
export async function generateFeedbackClientSide(
  req: FeedbackRequest
): Promise<FeedbackResponse> {
  const fallback = getFallbackFeedback(req);

  if (req.situation === "no_speech") {
    return fallback;
  }

  const ai = getGenAIClient();
  if (!ai) {
    return fallback;
  }

  try {
    const firstMissing = req.missingKeywords?.[0] || "because";
    const firstLetter = firstMissing.charAt(0);

    const systemInstruction = `You are a supportive English speaking feedback coach for Korean middle school 2nd year students (CEFR A2 level).
Follow Section 7 Feedback Rules strictly:
1. Always praise first before giving constructive tips (e.g., "Great job", "Good job", "Nice try").
2. Limit feedback to two sentences max: 1 short English sentence (using simple CEFR A2 grammar) + 1 friendly Korean translation.
3. Minimise use of negative words and NEVER include percentage scores or points.
4. Judge based on communication level.
5. Follow the repair strategy requested by 'situation':
- If situation is "success": Praise the student for communicating their point clearly.
- If situation is "partial": Praise first, then gently remind them of the small missing word(s) (${(req.missingKeywords || []).join(", ")}).
- If situation is "fail_1_recast": Praise with "Nice try", then recast the full target sentence ("${req.targetSentence}").
- If situation is "fail_2_elicitation": Praise with "Nice try", then elicit the missing keyword ("${firstMissing}") by giving its first letter ("${firstLetter.toUpperCase()}") and masking the word in the target sentence.
- If situation is "fail_3_chunking": Encourage them to repeat a short chunk of the target sentence ("${req.targetSentence}").`;

    const prompt = `Partner question: "${req.partnerQuestion}"
Target sentence: "${req.targetSentence}"
Student said: "${req.spokenText}"
Matched key words: [${(req.matchedKeywords || []).join(", ")}]
Missing key words: [${(req.missingKeywords || []).join(", ")}]
Required situation strategy: ${req.situation}

Return JSON with 'english' and 'korean'.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: {
              type: Type.STRING,
            },
            korean: {
              type: Type.STRING,
            },
          },
          required: ["english", "korean"],
        },
      },
    });

    const text = response.text;
    if (!text) return fallback;

    const parsed = JSON.parse(text);
    const english = parsed.english?.trim() || fallback.english;
    const korean =
      parsed.korean?.trim().replace(/^\(|\)$/g, "") || fallback.korean;

    return {
      english,
      korean,
      combined: `${english} (${korean})`,
      strategyLabel: fallback.strategyLabel,
      source: "gemini",
    };
  } catch (err) {
    console.warn("Non-critical fetch skipped:", err);
    return fallback;
  }
}
