export type FoodId =
  | "pizza"
  | "tteokbokki"
  | "burger"
  | "chicken"
  | "ramen"
  | "kimbap";

export type ReasonId =
  | "chewy"
  | "delicious"
  | "spicy"
  | "cheesy"
  | "hot"
  | "cheap"
  | "crispy"
  | "sweet"
  | "salty"
  | "fresh"
  | "juicy"
  | "filling";

export type PlaceId =
  | "famous_school"
  | "popular_station"
  | "good_park"
  | "popular_mall";

export type ClosingId =
  | "go_eat_there"
  | "go_right_now"
  | "go_together"
  | "cant_wait";

export interface FoodOption {
  id: FoodId;
  title: string;
  spokenName: string;
  korean: string;
  defaultReason: ReasonId;
}

export interface ReasonOption {
  id: ReasonId;
  label: string;
  korean: string;
}

export interface PlaceOption {
  id: PlaceId;
  label: string;
  korean: string;
  sentence: string;
  koreanSentence: string;
  keywords: string[];
}

export interface ClosingOption {
  id: ClosingId;
  label: string;
  korean: string;
  sentence: string;
  koreanSentence: string;
  keywords: string[];
}

export interface PartnerProfile {
  name: string;
  koreanName: string;
  role: string;
}

export const PARTNER_PROFILES: PartnerProfile[] = [
  { name: "Minjun", koreanName: "민준", role: "Friend" },
  { name: "Sora", koreanName: "소라", role: "Friend" },
  { name: "Jiho", koreanName: "지호", role: "Friend" },
  { name: "Yuna", koreanName: "유나", role: "Friend" },
];

// Doubled to 6 Food Options
export const FOOD_OPTIONS: FoodOption[] = [
  {
    id: "pizza",
    title: "Pizza",
    spokenName: "pizza",
    korean: "피자",
    defaultReason: "chewy",
  },
  {
    id: "tteokbokki",
    title: "Tteokbokki",
    spokenName: "tteokbokki",
    korean: "떡볶이",
    defaultReason: "spicy",
  },
  {
    id: "burger",
    title: "Burger",
    spokenName: "burger",
    korean: "햄버거",
    defaultReason: "cheesy",
  },
  {
    id: "chicken",
    title: "Chicken",
    spokenName: "chicken",
    korean: "치킨",
    defaultReason: "crispy",
  },
  {
    id: "ramen",
    title: "Ramen",
    spokenName: "ramen",
    korean: "라면",
    defaultReason: "hot",
  },
  {
    id: "kimbap",
    title: "Kimbap",
    spokenName: "kimbap",
    korean: "김밥",
    defaultReason: "cheap",
  },
];

// Doubled to 12 Reason Options
export const REASON_OPTIONS: ReasonOption[] = [
  { id: "chewy", label: "Chewy", korean: "쫄깃해서" },
  { id: "delicious", label: "Delicious", korean: "맛있어서" },
  { id: "spicy", label: "Spicy", korean: "매콤해서" },
  { id: "cheesy", label: "Cheesy", korean: "치즈가 많아서" },
  { id: "hot", label: "Hot", korean: "따뜻해서" },
  { id: "cheap", label: "Cheap", korean: "저렴해서" },
  { id: "crispy", label: "Crispy", korean: "바삭해서" },
  { id: "sweet", label: "Sweet", korean: "달콤해서" },
  { id: "salty", label: "Salty", korean: "짭짤해서" },
  { id: "fresh", label: "Fresh", korean: "신선해서" },
  { id: "juicy", label: "Juicy", korean: "육즙이 많아서" },
  { id: "filling", label: "Filling", korean: "배불러서" },
];

// Doubled to 4 Place Options (Step 4)
export const PLACE_OPTIONS: PlaceOption[] = [
  {
    id: "famous_school",
    label: "Famous shop near our school",
    korean: "우리 학교 근처에 유명한 가게",
    sentence: "Yes, there is a famous shop near our school.",
    koreanSentence: "응, 우리 학교 근처에 유명한 가게가 있어.",
    keywords: ["famous", "shop", "near"],
  },
  {
    id: "popular_station",
    label: "Famous shop near the station",
    korean: "역 근처에 유명한 가게",
    sentence: "Yes, there is a famous shop near the station.",
    koreanSentence: "응, 역 근처에 유명한 가게가 있어.",
    keywords: ["famous", "shop", "near"],
  },
  {
    id: "good_park",
    label: "Good restaurant near the park",
    korean: "공원 근처에 좋은 식당",
    sentence: "Yes, there is a good restaurant near the park.",
    koreanSentence: "응, 공원 근처에 좋은 식당이 있어.",
    keywords: ["good", "restaurant", "near"],
  },
  {
    id: "popular_mall",
    label: "Popular place near the mall",
    korean: "쇼핑몰 근처에 인기 있는 가게",
    sentence: "Yes, there is a popular place near the mall.",
    koreanSentence: "응, 쇼핑몰 근처에 인기 있는 가게가 있어.",
    keywords: ["popular", "place", "near"],
  },
];

// Doubled to 4 Closing Options (Step 5)
export const CLOSING_OPTIONS: ClosingOption[] = [
  {
    id: "go_eat_there",
    label: "Yeah, let's go eat there!",
    korean: "좋아 지금 거기로 먹으러 가자!",
    sentence: "Yeah let's go eat there.",
    koreanSentence: "좋아 지금 가자.",
    keywords: ["let's", "go"],
  },
  {
    id: "go_right_now",
    label: "Yeah, let's go right now!",
    korean: "응 지금 바로 가자!",
    sentence: "Yeah let's go right now.",
    koreanSentence: "응 지금 바로 가자.",
    keywords: ["let's", "go"],
  },
  {
    id: "go_together",
    label: "Sounds great, let's go together!",
    korean: "좋아 우리 같이 가자!",
    sentence: "Sounds great let's go together.",
    koreanSentence: "좋아 우리 같이 가자.",
    keywords: ["let's", "go"],
  },
  {
    id: "cant_wait",
    label: "Awesome, let's go eat now!",
    korean: "최고야 지금 먹으러 가자!",
    sentence: "Awesome let's go eat now.",
    koreanSentence: "최고야 지금 먹으러 가자.",
    keywords: ["let's", "go"],
  },
];

export interface ConversationContext {
  initialFoodId: FoodId;
  negotiatedFoodId: FoodId;
}

export interface DialogueStepConfig {
  step: number;
  stageTitle: string;
  selectionPrompt: string;
  partnerLine: (ctx: ConversationContext) => string;
  partnerKorean: (ctx: ConversationContext) => string;
}

function getFoodById(id: FoodId): FoodOption {
  return FOOD_OPTIONS.find((f) => f.id === id) || FOOD_OPTIONS[0];
}

export const DIALOGUE_STEPS: DialogueStepConfig[] = [
  {
    step: 1,
    stageTitle: "Step 1/5: State what you want to eat",
    selectionPrompt: "Choose what you want to eat tonight (6 options):",
    partnerLine: () => "What do you want to eat?",
    partnerKorean: () => "오늘 저녁으로 뭐 먹고 싶어?",
  },
  {
    step: 2,
    stageTitle: "Step 2/5: Explain your reason",
    selectionPrompt: "Why do you want to eat that? Choose a reason (12 options):",
    partnerLine: (ctx) => {
      const f = getFoodById(ctx.initialFoodId);
      return `Oh, ${f.spokenName}? Why do you want to eat that?`;
    },
    partnerKorean: (ctx) => {
      const f = getFoodById(ctx.initialFoodId);
      return `오, ${f.korean}? 왜 그게 먹고 싶어?`;
    },
  },
  {
    step: 3,
    stageTitle: "Step 3/5: Suggest another food",
    selectionPrompt: "Suggest a different food instead:",
    partnerLine: (ctx) => {
      const f = getFoodById(ctx.initialFoodId);
      if (f.id === "tteokbokki" || f.id === "ramen") {
        return `But I ate ${f.spokenName} yesterday! How about something crispy or cheesy?`;
      }
      return `But I ate ${f.spokenName} yesterday! How about something hot and spicy?`;
    },
    partnerKorean: (ctx) => {
      const f = getFoodById(ctx.initialFoodId);
      if (f.id === "tteokbokki" || f.id === "ramen") {
        return `근데 나 어제 ${f.korean} 먹었어! 바삭하거나 치즈가 들어간 건 어때?`;
      }
      return `근데 나 어제 ${f.korean} 먹었어! 따뜻하고 매콤한 건 어때?`;
    },
  },
  {
    step: 4,
    stageTitle: "Step 4/5: Recommend a place nearby",
    selectionPrompt: "Choose a place to recommend (4 options):",
    partnerLine: (ctx) => {
      const f = getFoodById(ctx.negotiatedFoodId);
      return `${f.title} sounds good, but is there a good place near here?`;
    },
    partnerKorean: (ctx) => {
      const f = getFoodById(ctx.negotiatedFoodId);
      return `${f.korean} 좋다! 근데 이 근처에 괜찮은 가게가 있어?`;
    },
  },
  {
    step: 5,
    stageTitle: "Step 5/5: Finalize the dinner plan",
    selectionPrompt: "Choose how to agree and wrap up (4 options):",
    partnerLine: () => "Perfect! Should we go there?",
    partnerKorean: () => "완벽해! 우리 거기로 갈까?",
  },
];

export interface DynamicSentenceResult {
  sentence: string;
  korean: string;
  keywords: string[];
  acceptedSynonyms: Record<string, string[]>;
}

const SYNONYM_MAP: Record<string, string[]> = {
  want: ["want", "wanna", "wan", "won't", "one"],
  pizza: ["pizza", "piza", "pizzas", "피자", "peter", "pita"],
  tteokbokki: [
    "tteokbokki",
    "tokbokki",
    "topokki",
    "tukbokki",
    "ddukbokki",
    "teokbokki",
    "ttokbokki",
    "tteok-bokki",
    "rice cake",
    "rice cakes",
    "떡볶이",
    "toboki",
    "dukbokki",
    "taco",
    "teriyaki",
  ],
  burger: ["burger", "burgers", "hamburger", "햄버거", "버거"],
  chicken: ["chicken", "chickens", "fried chicken", "치킨"],
  ramen: ["ramen", "ramyeon", "noodle", "noodles", "라면"],
  kimbap: ["kimbap", "gimbap", "kim bap", "gim bap", "김밥"],
  because: ["because", "cause", "cuz", "cos", "bcz", "be cause"],
  chewy: [
    "chewy",
    "chew",
    "chewie",
    "chooee",
    "chuwi",
    "tree",
    "chilly",
    "cherry",
  ],
  delicious: ["delicious", "yummy", "tasty"],
  spicy: ["spicy", "spice", "spicie", "spiky"],
  cheesy: ["cheesy", "cheese", "cheesie", "easy"],
  hot: ["hot", "warm", "heart", "hat"],
  cheap: ["cheap", "cheep", "chip", "inexpensive"],
  crispy: ["crispy", "crisp", "crunchy"],
  sweet: ["sweet", "suite"],
  salty: ["salty", "salt"],
  fresh: ["fresh", "flash"],
  juicy: ["juicy", "juice"],
  filling: ["filling", "full", "feeling"],
  "how about": ["how about", "how bout", "what about"],
  famous: ["famous", "popular", "good", "great"],
  popular: ["popular", "famous", "good"],
  good: ["good", "great", "famous", "nice"],
  shop: ["shop", "place", "store", "restaurant", "spot", "sharp"],
  restaurant: ["restaurant", "shop", "place", "store"],
  place: ["place", "shop", "spot", "restaurant"],
  near: ["near", "close", "around", "by", "here"],
  "let's": ["let's", "lets", "let us", "let"],
  go: ["go", "eat", "head"],
};

export function buildDynamicTarget(
  step: number,
  foodId: FoodId,
  reasonId: ReasonId | null,
  placeId: PlaceId | null = "famous_school",
  closingId: ClosingId | null = "go_eat_there"
): DynamicSentenceResult {
  const food = getFoodById(foodId);
  const reason =
    REASON_OPTIONS.find((r) => r.id === reasonId) ||
    REASON_OPTIONS.find((r) => r.id === food.defaultReason) ||
    REASON_OPTIONS[0];

  // Step 1 (PRD Turn 1): "I want to eat pizza tonight."
  if (step === 1) {
    return {
      sentence: `I want to eat ${food.spokenName} tonight.`,
      korean: `나 오늘 저녁으로 ${food.korean} 먹고 싶어.`,
      keywords: ["want", food.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  // Step 2 (PRD Turn 2): "I want to eat pizza because it is chewy."
  if (step === 2) {
    return {
      sentence: `I want to eat ${food.spokenName} because it is ${reason.id}.`,
      korean: `${food.korean}가 ${reason.korean} 먹고 싶어.`,
      keywords: [food.id, "because", reason.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  // Step 3 (PRD Turn 3): "Then how about eating tteokbokki instead?"
  if (step === 3) {
    return {
      sentence: `Then how about eating ${food.spokenName} instead?`,
      korean: `그럼 대신에 ${food.korean} 먹는 건 어때?`,
      keywords: ["how about", food.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  // Step 4 (PRD Turn 4): "Yes, there is a famous shop near our school."
  if (step === 4) {
    const place =
      PLACE_OPTIONS.find((p) => p.id === placeId) || PLACE_OPTIONS[0];
    return {
      sentence: place.sentence,
      korean: place.koreanSentence,
      keywords: place.keywords,
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  // Step 5 (PRD Turn 5): "Yeah let's go eat there."
  const closing =
    CLOSING_OPTIONS.find((c) => c.id === closingId) || CLOSING_OPTIONS[0];
  return {
    sentence: closing.sentence,
    korean: closing.koreanSentence,
    keywords: closing.keywords,
    acceptedSynonyms: SYNONYM_MAP,
  };
}

/**
 * Evaluates student speech against the target sentence following Section 7 of the PRD:
 * - "success": All target keywords AND supporting words are spoken -> Passes
 * - "partial" ("Success + small word missing"): All core keywords are spoken, only minor/small words (e.g., "tonight", "instead", "there", "our") are missing -> Passes
 * - Mistakes (when any core keyword is missing -> passed: false):
 *   1. Severity-based + consecutive repair progression:
 *      - "fail_1_recast": Moderate error on 1st attempt (at least 1 keyword or partial phrase spoken, or 1st fail) -> models full target sentence
 *      - "fail_2_elicitation": Missing the connector/reasoning word (e.g., "because" -> "b__") or 2nd consecutive fail -> prompts with first letter
 *      - "fail_3_chunking": Severe error (0 keywords matched in a short/fragmented attempt on retry, or 3rd+ consecutive fail) -> breaks into short chunks
 */
export function evaluateSpeech(
  spokenText: string,
  target: DynamicSentenceResult,
  consecutiveFailures: number,
  allAlternatives: string[] = []
): {
  situation:
    | "success"
    | "partial"
    | "fail_1_recast"
    | "fail_2_elicitation"
    | "fail_3_chunking"
    | "no_speech";
  matchedKeywords: string[];
  missingKeywords: string[];
  passed: boolean;
} {
  const combinedPool = [spokenText, ...allAlternatives]
    .join(" ")
    .toLowerCase()
    .replace(/[.,!?"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!combinedPool) {
    return {
      situation: "no_speech",
      matchedKeywords: [],
      missingKeywords: target.keywords,
      passed: false,
    };
  }

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of target.keywords) {
    const candidates = target.acceptedSynonyms[kw] || [kw];
    const isMatched = candidates.some((cand) =>
      combinedPool.includes(cand.toLowerCase())
    );
    if (isMatched) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  // Check if any small/supporting words from the target sentence were omitted
  const targetAllWords = target.sentence
    .toLowerCase()
    .replace(/[.,!?"]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const missingSmallWords = targetAllWords.filter((w) => {
    const isPartOfKeyword = target.keywords.some((kw) =>
      kw.toLowerCase().split(" ").includes(w)
    );
    if (isPartOfKeyword) return false;
    return !combinedPool.includes(w);
  });

  // 1. All core keywords matched!
  if (missingKeywords.length === 0) {
    if (missingSmallWords.length === 0) {
      return {
        situation: "success",
        matchedKeywords,
        missingKeywords: [],
        passed: true,
      };
    } else {
      // "Success + small word missing" from PRD Section 7 Table
      return {
        situation: "partial",
        matchedKeywords,
        missingKeywords: missingSmallWords.slice(0, 2),
        passed: true,
      };
    }
  }

  // 2. Core keyword(s) missing -> Error (passed: false).
  // Determine correction strategy based on PRD rules & mistake severity:
  const matchRatio = matchedKeywords.length / Math.max(1, target.keywords.length);

  // Severe error (0 keywords matched after already failing once, or 3rd+ consecutive failure) -> Chunking
  if (
    consecutiveFailures >= 2 ||
    (matchedKeywords.length === 0 && consecutiveFailures >= 1)
  ) {
    return {
      situation: "fail_3_chunking",
      matchedKeywords,
      missingKeywords,
      passed: false,
    };
  }

  // Missing "because" while other words matched (exact PRD Elicitation rule), or 2nd consecutive failure -> Elicitation with first letter
  if (
    consecutiveFailures === 1 ||
    (missingKeywords.length === 1 &&
      missingKeywords[0] === "because" &&
      matchRatio >= 0.5)
  ) {
    return {
      situation: "fail_2_elicitation",
      matchedKeywords,
      missingKeywords,
      passed: false,
    };
  }

  // Default 1st failure / moderate mistake -> Recast
  return {
    situation: "fail_1_recast",
    matchedKeywords,
    missingKeywords,
    passed: false,
  };
}
