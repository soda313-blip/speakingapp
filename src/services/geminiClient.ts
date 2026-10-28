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
        english: `Good job just remember these words next time: "${(missingKeywords || []).join(", ")}".`,
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
 * Calls the server-side /api/gemini/feedback endpoint with a strict 2-second timeout
 * and automatic local Section 7 table fallback so the UI never hangs.
 */
export async function generateFeedbackClientSide(
  req: FeedbackRequest
): Promise<FeedbackResponse> {
  const fallback = getFallbackFeedback(req);

  if (req.situation === "no_speech") {
    return fallback;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch("/api/gemini/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    return {
      english: data.english || fallback.english,
      korean: data.korean || fallback.korean,
      combined: data.combined || fallback.combined,
      strategyLabel: data.strategyLabel || fallback.strategyLabel,
      source: data.source || "gemini",
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Non-critical fetch skipped (using PRD table feedback):", err);
    return fallback;
  }
}
