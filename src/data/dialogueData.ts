export type FoodId = "pizza" | "tteokbokki" | "burger";
export type ReasonId = "chewy" | "spicy" | "cheesy" | "hot" | "cheap" | "delicious";

export interface FoodOption {
  id: FoodId;
  title: string;
  korean: string;
  defaultReason: ReasonId;
}

export interface ReasonOption {
  id: ReasonId;
  label: string;
  korean: string;
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

export const FOOD_OPTIONS: FoodOption[] = [
  {
    id: "pizza",
    title: "Pizza",
    korean: "피자",
    defaultReason: "chewy",
  },
  {
    id: "tteokbokki",
    title: "Tteokbokki",
    korean: "떡볶이",
    defaultReason: "spicy",
  },
  {
    id: "burger",
    title: "Burger",
    korean: "햄버거",
    defaultReason: "cheesy",
  },
];

export const REASON_OPTIONS: ReasonOption[] = [
  { id: "spicy", label: "Spicy", korean: "매콤해서" },
  { id: "cheesy", label: "Cheesy", korean: "치즈가 많아서" },
  { id: "hot", label: "Hot", korean: "따뜻해서" },
  { id: "cheap", label: "Cheap", korean: "저렴해서" },
  { id: "chewy", label: "Chewy", korean: "쫄깃해서" },
  { id: "delicious", label: "Delicious", korean: "맛있어서" },
];

export interface DialogueStepConfig {
  step: number;
  partnerLine: (selectedFood: FoodOption) => string;
  partnerKorean: (selectedFood: FoodOption) => string;
  canonicalSentence: string;
  canonicalKorean: string;
  canonicalKeywords: string[];
  recommendedFood: FoodId;
  recommendedReason: ReasonId;
}

export const DIALOGUE_STEPS: DialogueStepConfig[] = [
  {
    step: 1,
    partnerLine: () => "What do you want to eat tonight?",
    partnerKorean: () => "오늘 저녁으로 뭐 먹고 싶어?",
    canonicalSentence: "I want to eat pizza tonight.",
    canonicalKorean: "나 오늘 저녁으로 피자 먹고 싶어.",
    canonicalKeywords: ["want", "pizza"],
    recommendedFood: "pizza",
    recommendedReason: "chewy",
  },
  {
    step: 2,
    partnerLine: (food) => `Oh, ${food.title.toLowerCase()}? Why do you want to eat that?`,
    partnerKorean: (food) => `오, ${food.korean}? 왜 그게 먹고 싶어?`,
    canonicalSentence: "I want to eat pizza because it is chewy.",
    canonicalKorean: "피자가 쫄깃해서 먹고 싶어.",
    canonicalKeywords: ["pizza", "because", "chewy"],
    recommendedFood: "pizza",
    recommendedReason: "chewy",
  },
  {
    step: 3,
    partnerLine: () => "But I ate pizza yesterday! How about something hot and spicy?",
    partnerKorean: () => "근데 나 어제 피자 먹었어! 따뜻하고 매콤한 건 어때?",
    canonicalSentence: "Then how about eating tteokbokki instead?",
    canonicalKorean: "그럼 대신에 떡볶이 먹는 건 어때?",
    canonicalKeywords: ["how about", "tteokbokki"],
    recommendedFood: "tteokbokki",
    recommendedReason: "spicy",
  },
  {
    step: 4,
    partnerLine: (food) => `${food.title} sounds good, but is there a good place near here?`,
    partnerKorean: (food) => `${food.korean} 좋다! 근데 이 근처에 괜찮은 가게가 있어?`,
    canonicalSentence: "Yes, there is a famous shop near our school.",
    canonicalKorean: "응, 우리 학교 근처에 유명한 가게가 있어.",
    canonicalKeywords: ["famous", "shop", "near"],
    recommendedFood: "tteokbokki",
    recommendedReason: "spicy",
  },
  {
    step: 5,
    partnerLine: () => "Perfect! Should we go there?",
    partnerKorean: () => "완벽해! 우리 거기로 갈까?",
    canonicalSentence: "Yeah let's go eat there.",
    canonicalKorean: "좋아 지금 가자.",
    canonicalKeywords: ["let's", "go"],
    recommendedFood: "tteokbokki",
    recommendedReason: "spicy",
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
    "delicious",
    "yummy",
    "tasty",
  ],
  delicious: ["delicious", "chewy", "yummy", "tasty", "good"],
  spicy: ["spicy", "spice", "spicie", "spiky"],
  cheesy: ["cheesy", "cheese", "cheesie", "easy"],
  hot: ["hot", "warm", "heart", "hat"],
  cheap: ["cheap", "cheep", "chip", "inexpensive"],
  "how about": ["how about", "how bout", "what about"],
  famous: ["famous", "popular", "good", "great"],
  shop: ["shop", "place", "store", "restaurant", "spot", "sharp"],
  near: ["near", "close", "around", "by", "here"],
  "let's": ["let's", "lets", "let us", "let"],
  go: ["go", "eat", "head"],
};

export function buildDynamicTarget(
  step: number,
  foodId: FoodId,
  reasonId: ReasonId | null
): DynamicSentenceResult {
  const food = FOOD_OPTIONS.find((f) => f.id === foodId) || FOOD_OPTIONS[0];
  const reason = REASON_OPTIONS.find((r) => r.id === reasonId) || null;

  if (step === 1) {
    if (reason) {
      return {
        sentence: `I want to eat ${food.id} because it is ${reason.id}.`,
        korean: `나 ${food.korean}가 ${reason.korean} 먹고 싶어.`,
        keywords: ["want", food.id, "because", reason.id],
        acceptedSynonyms: SYNONYM_MAP,
      };
    }
    return {
      sentence: `I want to eat ${food.id} tonight.`,
      korean: `나 오늘 저녁으로 ${food.korean} 먹고 싶어.`,
      keywords: ["want", food.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  if (step === 2) {
    const activeReason = reason || REASON_OPTIONS.find((r) => r.id === food.defaultReason) || REASON_OPTIONS[4];
    return {
      sentence: `I want to eat ${food.id} because it is ${activeReason.id}.`,
      korean: `${food.korean}가 ${activeReason.korean} 먹고 싶어.`,
      keywords: [food.id, "because", activeReason.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  if (step === 3) {
    if (reason) {
      return {
        sentence: `Then how about eating ${food.id} because it is ${reason.id}?`,
        korean: `그럼 ${reason.korean} 대신에 ${food.korean} 먹는 건 어때?`,
        keywords: ["how about", food.id, reason.id],
        acceptedSynonyms: SYNONYM_MAP,
      };
    }
    return {
      sentence: `Then how about eating ${food.id} instead?`,
      korean: `그럼 대신에 ${food.korean} 먹는 건 어때?`,
      keywords: ["how about", food.id],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  if (step === 4) {
    if (reason) {
      return {
        sentence: `Yes, there is a famous ${food.id} shop near our school.`,
        korean: `응, 우리 학교 근처에 유명한 ${food.korean} 가게가 있어.`,
        keywords: ["famous", "shop", "near"],
        acceptedSynonyms: SYNONYM_MAP,
      };
    }
    return {
      sentence: "Yes, there is a famous shop near our school.",
      korean: "응, 우리 학교 근처에 유명한 가게가 있어.",
      keywords: ["famous", "shop", "near"],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }

  // Step 5
  if (reason) {
    return {
      sentence: `Yeah let's go eat ${food.id} there.`,
      korean: `좋아 지금 거기서 ${food.korean} 먹으러 가자.`,
      keywords: ["let's", "go"],
      acceptedSynonyms: SYNONYM_MAP,
    };
  }
  return {
    sentence: "Yeah let's go eat there.",
    korean: "좋아 지금 가자.",
    keywords: ["let's", "go"],
    acceptedSynonyms: SYNONYM_MAP,
  };
}

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

  // All key words matched
  if (missingKeywords.length === 0) {
    return {
      situation: "success",
      matchedKeywords,
      missingKeywords: [],
      passed: true,
    };
  }

  // Main idea communicated (most key words matched or at least 1 key word in a 3+ word utterance)
  const wordCount = spokenText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (
    matchedKeywords.length > 0 &&
    matchedKeywords.length >= Math.ceil(target.keywords.length * 0.5) &&
    wordCount >= 3
  ) {
    return {
      situation: "partial",
      matchedKeywords,
      missingKeywords,
      passed: true,
    };
  }

  // Repair sequence on consecutive failures:
  // 1st fail -> Recast
  // 2nd fail -> Elicitation (with first letter)
  // 3rd+ fail -> Chunking
  const failIndex = consecutiveFailures + 1;
  if (failIndex === 1) {
    return {
      situation: "fail_1_recast",
      matchedKeywords,
      missingKeywords,
      passed: false,
    };
  } else if (failIndex === 2) {
    return {
      situation: "fail_2_elicitation",
      matchedKeywords,
      missingKeywords,
      passed: false,
    };
  } else {
    return {
      situation: "fail_3_chunking",
      matchedKeywords,
      missingKeywords,
      passed: false,
    };
  }
}
