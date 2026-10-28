import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

function getServerGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

interface FeedbackRequest {
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

function getServerFallbackFeedback(req: FeedbackRequest) {
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
        source: "table_fallback" as const,
      };
    case "partial":
      return {
        english: "Good job just remember these words next time.",
        korean: "잘했는데 다음엔 이 단어들을 잊지마.",
        combined:
          "Good job just remember these words next time. (잘했는데 다음엔 이 단어들을 잊지마.)",
        strategyLabel: "Success + small word missing",
        source: "table_fallback" as const,
      };
    case "fail_1_recast":
      return {
        english: `Nice try but this time can you say: "${targetSentence}"`,
        korean: "잘했는데 이번에는 이렇게 말해 볼까?",
        combined: `Nice try but this time can you say: "${targetSentence}" (잘했는데 이번에는 이렇게 말해 볼까?)`,
        strategyLabel: "1st failure (recast)",
        source: "table_fallback" as const,
      };
    case "fail_2_elicitation":
      return {
        english: `Nice try but when reasoning you need to use a word that starts with ${upperLetter}. "${maskedSentence}"`,
        korean: `'이유'를 말할 땐 ${firstLetter}로 시작하는 단어가 필요해.`,
        combined: `Nice try but when reasoning you need to use a word that starts with ${upperLetter}. "${maskedSentence}" ('이유'를 말할 땐 ${firstLetter}로 시작하는 단어가 필요해.)`,
        strategyLabel: "2nd failure (elicitation)",
        source: "table_fallback" as const,
      };
    case "fail_3_chunking":
      return {
        english: `Let's try saying it in short chunks. Repeat after me: "${chunkWords}."`,
        korean: "이번에는 짧게 나눠서 따라 말해보자",
        combined: `Let's try saying it in short chunks. Repeat after me: "${chunkWords}." (이번에는 짧게 나눠서 따라 말해보자)`,
        strategyLabel: "3rd failure (chunking)",
        source: "table_fallback" as const,
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
        source: "table_fallback" as const,
      };
  }
}

const handleFeedbackRoute: express.RequestHandler = async (req, res) => {
  const body = (req.body || {}) as FeedbackRequest;
  const fallback = getServerFallbackFeedback(body);

  if (body.situation === "no_speech" || !process.env.GEMINI_API_KEY) {
    res.json(fallback);
    return;
  }

  try {
    const ai = getServerGenAIClient();
    const firstMissing = body.missingKeywords?.[0] || "because";
    const firstLetter = firstMissing.charAt(0);

    const systemInstruction = `You are a supportive English speaking feedback coach for Korean middle school 2nd year students (CEFR A2 level).
Follow Section 7 Feedback Rules strictly:
1. Always praise first before giving constructive tips (e.g., "Great job", "Good job", "Nice try").
2. Limit feedback to two sentences max: 1 short English sentence (using simple CEFR A2 grammar) + 1 friendly Korean translation.
3. Minimise use of negative words and NEVER include percentage scores or points.
4. Judge based on communication level.
5. Follow the repair strategy requested by 'situation':
- If situation is "success": Praise the student for communicating their point clearly.
- If situation is "partial": Praise first, then gently remind them of the small missing word(s) (${(body.missingKeywords || []).join(", ")}).
- If situation is "fail_1_recast": Praise with "Nice try", then recast the full target sentence ("${body.targetSentence}").
- If situation is "fail_2_elicitation": Praise with "Nice try", then elicit the missing keyword ("${firstMissing}") by giving its first letter ("${firstLetter.toUpperCase()}") and masking the word in the target sentence.
- If situation is "fail_3_chunking": Encourage them to repeat a short chunk of the target sentence ("${body.targetSentence}").`;

    const prompt = `Partner question: "${body.partnerQuestion}"
Target sentence: "${body.targetSentence}"
Student said: "${body.spokenText}"
Matched key words: [${(body.matchedKeywords || []).join(", ")}]
Missing key words: [${(body.missingKeywords || []).join(", ")}]
Required situation strategy: ${body.situation}

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
    if (!text) {
      res.json(fallback);
      return;
    }

    const parsed = JSON.parse(text);
    const english = parsed.english?.trim() || fallback.english;
    const korean =
      parsed.korean?.trim().replace(/^\(|\)$/g, "") || fallback.korean;

    res.json({
      english,
      korean,
      combined: `${english} (${korean})`,
      strategyLabel: fallback.strategyLabel,
      source: "gemini",
    });
  } catch (err) {
    console.warn("Server Gemini feedback fallback triggered:", err);
    res.json(fallback);
  }
};

app.post("/api/gemini/feedback", handleFeedbackRoute);
app.post("/api/feedback", handleFeedbackRoute);

app.post("/api/gemini/transcribe", async (req, res) => {
  const { mimeType = "audio/webm", base64Data = "", targetSentence = "" } =
    req.body || {};

  if (!base64Data || !process.env.GEMINI_API_KEY) {
    res.json({ text: "" });
    return;
  }

  try {
    const ai = getServerGenAIClient();
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

    res.json({ text: (response.text || "").trim() });
  } catch (err) {
    console.warn("Server primary transcribe fallback:", err);
    try {
      const ai = getServerGenAIClient();
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
      res.json({ text: (fallbackRes.text || "").trim() });
    } catch (innerErr) {
      console.warn("Server secondary transcribe error:", innerErr);
      res.status(500).json({ error: "Transcription failed", text: "" });
    }
  }
});

async function startServer() {
  let viteMiddleware: express.RequestHandler | null = null;

  app.use((req, res, next) => {
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    next();
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    viteMiddleware = vite.middlewares;
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();
