import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Volume2,
  Turtle,
  RotateCcw,
  ArrowRight,
  Star,
  AlertTriangle,
  Play,
  Keyboard,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import {
  FOOD_OPTIONS,
  REASON_OPTIONS,
  PLACE_OPTIONS,
  CLOSING_OPTIONS,
  DIALOGUE_STEPS,
  PARTNER_PROFILES,
  FoodId,
  ReasonId,
  PlaceId,
  ClosingId,
  ConversationContext,
  buildDynamicTarget,
  evaluateSpeech,
} from "./data/dialogueData";
import {
  FriendsWalkingIllustration,
  FoodIllustration,
  PartnerAvatar,
  CoachAvatar,
} from "./components/Illustrations";
import {
  generateFeedbackClientSide,
  getFallbackFeedback,
} from "./services/geminiClient";

type ScreenMode = "start" | "practice" | "result";
type MicState = "ready" | "listening" | "error";

interface FeedbackData {
  english: string;
  korean: string;
  combined: string;
  strategyLabel: string;
  situation:
    | "success"
    | "partial"
    | "fail_1_recast"
    | "fail_2_elicitation"
    | "fail_3_chunking"
    | "no_speech";
  source?: string;
}

export interface TurnRecord {
  step: number;
  partnerQuestion: string;
  targetSentence: string;
  koreanMeaning: string;
  spokenText: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  feedback: FeedbackData;
  foodId: FoodId;
  reasonId: ReasonId | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitAudioContext?: typeof AudioContext;
  }
}

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>("start");
  const [partnerIndex, setPartnerIndex] = useState<number>(0);

  // Coherent 5-turn conversation state following PRD Section 6
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [initialFoodId, setInitialFoodId] = useState<FoodId>("pizza");
  const [negotiatedFoodId, setNegotiatedFoodId] =
    useState<FoodId>("tteokbokki");

  // Per-turn student selections
  const [selectedFood, setSelectedFood] = useState<FoodId | null>(null);
  const [selectedReason, setSelectedReason] = useState<ReasonId | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceId | null>(null);
  const [selectedClosing, setSelectedClosing] = useState<ClosingId | null>(
    null
  );

  // Speech & Audio state
  const [micState, setMicState] = useState<MicState>("ready");
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(
    null
  );
  const [evaluationPassed, setEvaluationPassed] = useState<boolean | null>(
    null
  );
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);

  // Completed turn records for Screen 3 Result Screen
  const [turnRecords, setTurnRecords] = useState<TurnRecord[]>([]);

  // Browser & Mic environment checks
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] =
    useState<boolean>(false);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualTextInput, setManualTextInput] = useState<string>("");

  // Refs for SpeechRecognition auto-restart loop & AnalyserNode visualizer
  const isRecordingRef = useRef<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const feedbackCardRef = useRef<HTMLDivElement | null>(null);

  // Transcript accumulators across auto-restarts
  const committedFinalRef = useRef<string>("");
  const currentSessionFinalRef = useRef<string>("");
  const currentSessionInterimRef = useRef<string>("");
  const latestTranscriptRef = useRef<string>("");
  const alternativesAccumulatorRef = useRef<string[]>([]);
  const postSpeechSilenceTimerRef = useRef<number | null>(null);

  const partner = PARTNER_PROFILES[partnerIndex] || PARTNER_PROFILES[0];
  const stepConfig = DIALOGUE_STEPS[currentStep - 1] || DIALOGUE_STEPS[0];

  const conversationCtx: ConversationContext = {
    initialFoodId,
    negotiatedFoodId,
  };

  // Active food for current step:
  // Step 1: selectedFood (or initialFoodId)
  // Step 2: locked to initialFoodId (the food chosen in Step 1!)
  // Step 3: selectedFood (the alternative food chosen in Step 3)
  // Step 4 & 5: locked to negotiatedFoodId (the agreed food from Step 3!)
  const activeFoodId: FoodId =
    currentStep === 1
      ? selectedFood || initialFoodId
      : currentStep === 2
      ? initialFoodId
      : currentStep === 3
      ? selectedFood || negotiatedFoodId
      : negotiatedFoodId;

  // Check if current step's required choice is completed
  const isSentenceComplete =
    currentStep === 1
      ? selectedFood !== null
      : currentStep === 2
      ? selectedReason !== null
      : currentStep === 3
      ? selectedFood !== null
      : currentStep === 4
      ? selectedPlace !== null
      : selectedClosing !== null;

  const dynamicTarget = buildDynamicTarget(
    currentStep,
    activeFoodId,
    selectedReason,
    selectedPlace,
    selectedClosing
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        return;
      }
      const ua = navigator.userAgent || "";
      const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line|NAVER/i.test(ua);
      setIsInAppBrowser(inApp);

      const SpeechRec =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        setSpeechSupported(false);
      }

      setPartnerIndex(Math.floor(Math.random() * PARTNER_PROFILES.length));
    } catch (err) {
      console.warn("Non-critical mount check skipped:", err);
    }
  }, []);

  const clearPostSpeechTimer = useCallback(() => {
    if (typeof window !== "undefined" && postSpeechSilenceTimerRef.current) {
      window.clearTimeout(postSpeechSilenceTimerRef.current);
      postSpeechSilenceTimerRef.current = null;
    }
  }, []);

  const stopVisualizerAndRecognition = useCallback(() => {
    isRecordingRef.current = false;
    clearPostSpeechTimer();

    if (typeof window !== "undefined" && rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setVolumeLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, [clearPostSpeechTimer]);

  const initializeStepDefaults = useCallback(
    (_stepNum: number) => {
      stopVisualizerAndRecognition();
      setSelectedFood(null);
      setSelectedReason(null);
      setSelectedPlace(null);
      setSelectedClosing(null);
      setLiveTranscript("");
      committedFinalRef.current = "";
      currentSessionFinalRef.current = "";
      currentSessionInterimRef.current = "";
      latestTranscriptRef.current = "";
      alternativesAccumulatorRef.current = [];
      setCurrentFeedback(null);
      setEvaluationPassed(null);
      setConsecutiveFailures(0);
      setMatchedKeywords([]);
      setMissingKeywords([]);
      setMicState("ready");
    },
    [stopVisualizerAndRecognition]
  );

  const speakText = useCallback(
    (text: string, rate: 0.9 | 0.7 = 0.9) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      if (micState === "listening") return;

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = rate;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsPlayingAudio(true);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);

        setIsPlayingAudio(true);
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Non-critical speechSynthesis skipped:", err);
        setIsPlayingAudio(false);
      }
    },
    [micState]
  );

  useEffect(() => {
    return () => {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
      stopVisualizerAndRecognition();
    };
  }, [stopVisualizerAndRecognition]);

  // Scroll feedback card into view whenever new feedback arrives
  useEffect(() => {
    if (currentFeedback && feedbackCardRef.current) {
      try {
        feedbackCardRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } catch {
        // ignore
      }
    }
  }, [currentFeedback]);

  const processSpokenAttempt = useCallback(
    (
      spoken: string,
      alternatives: string[] = [],
      forcedSituation?:
        | "success"
        | "partial"
        | "fail_1_recast"
        | "fail_2_elicitation"
        | "fail_3_chunking"
        | "no_speech"
    ) => {
      const evaluation = evaluateSpeech(
        spoken,
        dynamicTarget,
        consecutiveFailures,
        alternatives
      );
      const situation = forcedSituation || evaluation.situation;
      const passed =
        situation === "success" ||
        situation === "partial" ||
        evaluation.passed;

      setEvaluationPassed(passed);

      const isFailure =
        situation === "fail_1_recast" ||
        situation === "fail_2_elicitation" ||
        situation === "fail_3_chunking";

      if (isFailure) {
        setConsecutiveFailures((prev) => prev + 1);
      } else if (passed) {
        setConsecutiveFailures(0);
      }

      const computedMatched =
        forcedSituation === "success"
          ? dynamicTarget.keywords
          : forcedSituation === "partial"
          ? dynamicTarget.keywords.slice(
              0,
              Math.max(1, dynamicTarget.keywords.length - 1)
            )
          : evaluation.matchedKeywords;

      const computedMissing =
        forcedSituation === "success"
          ? []
          : forcedSituation === "partial"
          ? [
              dynamicTarget.keywords[dynamicTarget.keywords.length - 1] ||
                "tonight",
            ]
          : evaluation.missingKeywords.length > 0
          ? evaluation.missingKeywords
          : [dynamicTarget.keywords[0] || "because"];

      setMatchedKeywords(computedMatched);
      setMissingKeywords(computedMissing);

      const partnerQ = stepConfig.partnerLine(conversationCtx);
      const feedbackReq = {
        situation,
        targetSentence: dynamicTarget.sentence,
        spokenText: spoken,
        missingKeywords: computedMissing,
        matchedKeywords: computedMatched,
        partnerQuestion: partnerQ,
      };

      // Immediately display the PRD Section 7 feedback synchronously so the UI NEVER gets stuck on transcribing
      const immediatePrdFeedback: FeedbackData = {
        ...getFallbackFeedback(feedbackReq),
        situation,
      };

      setCurrentFeedback(immediatePrdFeedback);
      setMicState("ready");

      const initialRecord: TurnRecord = {
        step: currentStep,
        partnerQuestion: partnerQ,
        targetSentence: dynamicTarget.sentence,
        koreanMeaning: dynamicTarget.korean,
        spokenText: spoken.trim() || "(No speech detected)",
        matchedKeywords: computedMatched,
        missingKeywords: computedMissing,
        feedback: immediatePrdFeedback,
        foodId: activeFoodId,
        reasonId: selectedReason,
      };

      setTurnRecords((prev) => {
        const filtered = prev.filter((r) => r.step !== currentStep);
        return [...filtered, initialRecord].sort((a, b) => a.step - b.step);
      });

      // Optionally enhance via server-side Gemini in the background without blocking the UI
      if (situation !== "no_speech") {
        generateFeedbackClientSide(feedbackReq)
          .then((res) => {
            if (res && res.source === "gemini") {
              const updatedFb: FeedbackData = {
                ...res,
                situation,
              };
              setCurrentFeedback(updatedFb);
            }
          })
          .catch(() => {
            // Keep immediate PRD Section 7 feedback
          });
      }
    },
    [
      activeFoodId,
      consecutiveFailures,
      conversationCtx,
      currentStep,
      dynamicTarget,
      selectedReason,
      stepConfig,
    ]
  );

  const stopAndEvaluate = useCallback(() => {
    isRecordingRef.current = false;
    stopVisualizerAndRecognition();

    const combinedFromRefs = [
      committedFinalRef.current,
      currentSessionFinalRef.current,
      currentSessionInterimRef.current,
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const fullText = combinedFromRefs || latestTranscriptRef.current.trim();
    const alts = alternativesAccumulatorRef.current;

    if (!fullText) {
      processSpokenAttempt("", [], "no_speech");
    } else {
      setLiveTranscript(fullText);
      processSpokenAttempt(fullText, alts);
    }
  }, [processSpokenAttempt, stopVisualizerAndRecognition]);

  const stopAndEvaluateRef = useRef(stopAndEvaluate);
  useEffect(() => {
    stopAndEvaluateRef.current = stopAndEvaluate;
  }, [stopAndEvaluate]);

  const handleMicToggle = useCallback(async () => {
    if (!isSentenceComplete || isPlayingAudio) return;

    if (isRecordingRef.current || micState === "listening") {
      stopAndEvaluateRef.current();
      return;
    }

    const SpeechRec =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRec) {
      setSpeechSupported(false);
      setShowManualInput(true);
      return;
    }

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      }
    } catch {
      // ignore
    }

    stopVisualizerAndRecognition();

    setLiveTranscript("");
    committedFinalRef.current = "";
    currentSessionFinalRef.current = "";
    currentSessionInterimRef.current = "";
    latestTranscriptRef.current = "";
    alternativesAccumulatorRef.current = [];
    setCurrentFeedback(null);
    setEvaluationPassed(null);
    setMicPermissionDenied(false);

    // Capture getUserMedia({ audio: true }) strictly for AnalyserNode green volume visualizer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const tracks = stream.getAudioTracks();
        if (tracks[0]) {
          tracks[0].enabled = true;
        }
        mediaStreamRef.current = stream;

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          audioCtxRef.current = audioContext;
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVisualizer = () => {
            if (!isRecordingRef.current || !analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 100) * 100));
            setVolumeLevel(normalized);
            rafIdRef.current = window.requestAnimationFrame(updateVisualizer);
          };
          rafIdRef.current = window.requestAnimationFrame(updateVisualizer);
        }
      }
    } catch (err) {
      console.warn("[Audio] Visualizer getUserMedia warning:", err);
      setMicPermissionDenied(true);
      setShowManualInput(true);
      setMicState("error");
      return;
    }

    // Configure SpeechRecognition with resilient auto-restart loop on onend
    isRecordingRef.current = true;
    setMicState("listening");

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isRecordingRef.current) return;

      let sessionFinal = "";
      let sessionInterim = "";
      const altList: string[] = [];

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPiece = result[0]?.transcript || "";
        if (result.isFinal) {
          sessionFinal += transcriptPiece + " ";
        } else {
          sessionInterim += transcriptPiece + " ";
        }
        for (let a = 0; a < result.length; a++) {
          if (result[a]?.transcript) {
            altList.push(result[a].transcript);
          }
        }
      }

      currentSessionFinalRef.current = sessionFinal.trim();
      currentSessionInterimRef.current = sessionInterim.trim();
      if (altList.length > 0) {
        alternativesAccumulatorRef.current = [
          ...alternativesAccumulatorRef.current,
          ...altList,
        ];
      }

      const fullTranscript = [
        committedFinalRef.current,
        currentSessionFinalRef.current,
        currentSessionInterimRef.current,
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (fullTranscript) {
        latestTranscriptRef.current = fullTranscript;
        setLiveTranscript(fullTranscript);

        clearPostSpeechTimer();
        postSpeechSilenceTimerRef.current = window.setTimeout(() => {
          if (isRecordingRef.current) {
            stopAndEvaluateRef.current();
          }
        }, 3000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        console.log("[SpeechRecognition] no-speech (continuing session)");
        return;
      }
      if (event.error === "aborted") {
        return;
      }
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        isRecordingRef.current = false;
        stopVisualizerAndRecognition();
        setMicPermissionDenied(true);
        setShowManualInput(true);
        setMicState("error");
        return;
      }
      console.warn("[SpeechRecognition] error:", event.error);
    };

    recognition.onend = () => {
      if (
        currentSessionFinalRef.current ||
        currentSessionInterimRef.current
      ) {
        committedFinalRef.current = [
          committedFinalRef.current,
          currentSessionFinalRef.current || currentSessionInterimRef.current,
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        currentSessionFinalRef.current = "";
        currentSessionInterimRef.current = "";
      }

      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("[SpeechRecognition] Auto-restart warning:", err);
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn("[SpeechRecognition] Initial start error:", err);
    }
  }, [
    clearPostSpeechTimer,
    isPlayingAudio,
    isSentenceComplete,
    micState,
    stopVisualizerAndRecognition,
  ]);

  const handleSelectFood = (foodId: FoodId) => {
    setSelectedFood(foodId);
    if (currentStep === 1) {
      setInitialFoodId(foodId);
      // Set a sensible default alternative for Step 3
      setNegotiatedFoodId(foodId === "tteokbokki" ? "pizza" : "tteokbokki");
    } else if (currentStep === 3) {
      setNegotiatedFoodId(foodId);
    }
    setCurrentFeedback(null);
    setEvaluationPassed(null);
  };

  const handleSelectReason = (reasonId: ReasonId) => {
    setSelectedReason(reasonId);
    setCurrentFeedback(null);
    setEvaluationPassed(null);
  };

  const handleSelectPlace = (placeId: PlaceId) => {
    setSelectedPlace(placeId);
    setCurrentFeedback(null);
    setEvaluationPassed(null);
  };

  const handleSelectClosing = (closingId: ClosingId) => {
    setSelectedClosing(closingId);
    setCurrentFeedback(null);
    setEvaluationPassed(null);
  };

  const handleResetChoices = () => {
    stopVisualizerAndRecognition();
    setSelectedFood(null);
    setSelectedReason(null);
    setSelectedPlace(null);
    setSelectedClosing(null);
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    setCurrentFeedback(null);
    setEvaluationPassed(null);
    setMatchedKeywords([]);
    setMissingKeywords([]);
    setMicState("ready");
  };

  const handleTryAgain = () => {
    stopVisualizerAndRecognition();
    setLiveTranscript("");
    committedFinalRef.current = "";
    currentSessionFinalRef.current = "";
    currentSessionInterimRef.current = "";
    latestTranscriptRef.current = "";
    alternativesAccumulatorRef.current = [];
    setCurrentFeedback(null);
    setEvaluationPassed(null);
    setMicState("ready");
  };

  const handleNextPhase = () => {
    if (!isSentenceComplete || evaluationPassed !== true) return;
    stopVisualizerAndRecognition();

    if (!turnRecords.some((r) => r.step === currentStep)) {
      const partnerQ = stepConfig.partnerLine(conversationCtx);
      const defaultRecord: TurnRecord = {
        step: currentStep,
        partnerQuestion: partnerQ,
        targetSentence: dynamicTarget.sentence,
        koreanMeaning: dynamicTarget.korean,
        spokenText: liveTranscript.trim() || dynamicTarget.sentence,
        matchedKeywords: dynamicTarget.keywords,
        missingKeywords: [],
        feedback: currentFeedback || {
          english: "Great job I understood your point.",
          korean: "잘했어 네가 뭐라고 말하는지 이해했어.",
          combined:
            "Great job I understood your point. (잘했어 네가 뭐라고 말하는지 이해했어.)",
          strategyLabel: "Completed",
          situation: "success",
        },
        foodId: activeFoodId,
        reasonId: selectedReason,
      };
      setTurnRecords((prev) =>
        [...prev, defaultRecord].sort((a, b) => a.step - b.step)
      );
    }

    if (currentStep < 5) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      initializeStepDefaults(nextStep);
    } else {
      setScreen("result");
    }
  };

  const handleStartPractice = () => {
    setPartnerIndex((prev) => (prev + 1) % PARTNER_PROFILES.length);
    setTurnRecords([]);
    setInitialFoodId("pizza");
    setNegotiatedFoodId("tteokbokki");
    setCurrentStep(1);
    initializeStepDefaults(1);
    setScreen("practice");
  };

  const completedCount = turnRecords.length;
  const earnedStars = completedCount >= 5 ? 3 : completedCount >= 3 ? 2 : 1;

  // Compute visible repair helper text when a mistake occurs (Recast / Elicitation / Chunking)
  const getRepairPracticePrompt = (): {
    badge: string;
    practiceText: string;
  } | null => {
    if (!currentFeedback || evaluationPassed) return null;
    const firstMissing = missingKeywords[0] || "because";
    const firstLetter = firstMissing.charAt(0).toLowerCase();
    const maskedSentence = dynamicTarget.sentence.replace(
      new RegExp(`\\b${firstMissing}\\b`, "i"),
      `${firstLetter}__`
    );
    const words = dynamicTarget.sentence.replace(/[.!?]+$/, "").split(/\s+/);
    const chunkWords =
      words.length > 3 ? words.slice(-4).join(" ") : words.join(" ");

    if (currentFeedback.situation === "fail_1_recast") {
      return {
        badge: "1st Correction — Recast (Say the full sentence)",
        practiceText: dynamicTarget.sentence,
      };
    }
    if (currentFeedback.situation === "fail_2_elicitation") {
      return {
        badge: `2nd Correction — Elicitation (Hint: starts with "${firstLetter.toUpperCase()}")`,
        practiceText: maskedSentence,
      };
    }
    if (currentFeedback.situation === "fail_3_chunking") {
      return {
        badge: "3rd Correction — Chunking (Repeat this short chunk)",
        practiceText: `${chunkWords}.`,
      };
    }
    return {
      badge: "Try Speaking Again",
      practiceText: dynamicTarget.sentence,
    };
  };

  const repairPrompt = getRepairPracticePrompt();

  const renderHighlightedSentence = (sentence: string, keywords: string[]) => {
    const words = sentence.split(" ");
    return words.map((word, idx) => {
      const cleanWord = word.toLowerCase().replace(/[.,!?"]/g, "");
      const isKey = keywords.some((kw) =>
        kw.toLowerCase().split(" ").includes(cleanWord)
      );
      const isMatched = matchedKeywords.some((kw) =>
        kw.toLowerCase().split(" ").includes(cleanWord)
      );
      const isMissing =
        evaluationPassed === false &&
        missingKeywords.some((kw) =>
          kw.toLowerCase().split(" ").includes(cleanWord)
        );

      return (
        <span
          key={idx}
          className={`inline-block mr-1.5 transition-colors ${
            isMatched
              ? "text-emerald-700 underline decoration-emerald-500 decoration-2 underline-offset-4"
              : isMissing
              ? "text-rose-700 bg-rose-100 px-1.5 rounded-md underline decoration-rose-500 decoration-2 underline-offset-4"
              : isKey
              ? "text-amber-700 underline decoration-amber-400 decoration-2 underline-offset-4"
              : "text-slate-900"
          }`}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Browser / Microphone Compatibility Guidance Banner */}
      {(!speechSupported || isInAppBrowser || micPermissionDenied) && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-950"
        >
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {!speechSupported || isInAppBrowser
                  ? "Please open it in Chrome."
                  : "Microphone access is blocked. Please allow microphone permission in Chrome."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-900 text-white rounded-md hover:bg-amber-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Type Instead
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col justify-center">
        {/* =========================================================
            SCREEN 1: START SCREEN (HOME)
           ========================================================= */}
        {screen === "start" && (
          <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs space-y-6">
            {/* Top: App title "Whats For Dinner?" with subtitle "Dinner with friends" */}
            <div className="text-center">
              <h1
                className="text-3xl sm:text-4xl font-bold text-slate-900 font-display tracking-tight"
                style={{ textWrap: "balance" }}
              >
                Whats For Dinner?
              </h1>
              <p className="mt-1 text-base text-slate-600 font-medium">
                Dinner with friends
              </p>
            </div>

            {/* Middle: Illustration of 3 friends walking home after school, talking about food */}
            <div className="rounded-2xl overflow-hidden border border-amber-200/80 bg-[#FFF7ED]">
              <FriendsWalkingIllustration />
            </div>

            {/* Bottom: Primary Entry Button labeled "Start" + Small privacy notice */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStartPractice}
                className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-display font-bold text-lg sm:text-xl flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Start</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <p className="text-center text-xs text-slate-500">
                Your voice is processed to turn it into text and is not recorded
                or saved.
              </p>
            </div>
          </section>
        )}

        {/* =========================================================
            SCREEN 2: SENTENCE SELECTION & PRACTICE SCREEN
           ========================================================= */}
        {screen === "practice" && (
          <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
            {/* TOP: Progress Indicator (Step X/5) + Partner Character Speech Bubble */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 tabular-nums">
                <span>{stepConfig.stageTitle}</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`h-2 rounded-full transition-all ${
                        n === currentStep
                          ? "w-6 bg-amber-500"
                          : n < currentStep
                          ? "w-2 bg-emerald-500"
                          : "w-2 bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Partner Character Speech Bubble */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/90">
                <PartnerAvatar name={partner.name} className="w-11 h-11" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-blue-700">
                      {partner.name}
                    </span>
                    <button
                      type="button"
                      disabled={micState === "listening"}
                      onClick={() =>
                        speakText(stepConfig.partnerLine(conversationCtx), 0.9)
                      }
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Listen</span>
                    </button>
                  </div>
                  <p className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                    &ldquo;{stepConfig.partnerLine(conversationCtx)}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stepConfig.partnerKorean(conversationCtx)}
                  </p>
                </div>
              </div>
            </div>

            {/* MIDDLE: Coherent Turn-by-Turn Choice Options (disappear once chosen) */}
            <div className="space-y-4">
              {!isSentenceComplete ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">
                      {stepConfig.selectionPrompt}
                    </p>

                    {/* STEP 1: Choose initial food ("I want to eat [food] tonight.") */}
                    {currentStep === 1 && (
                      <div className="grid grid-cols-3 gap-2.5">
                        {FOOD_OPTIONS.map((food) => {
                          const isSelected = selectedFood === food.id;
                          return (
                            <button
                              key={food.id}
                              type="button"
                              onClick={() => handleSelectFood(food.id)}
                              className={`rounded-2xl p-3 text-center transition-all flex flex-col items-center justify-center border cursor-pointer min-h-[100px] ${
                                isSelected
                                  ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <FoodIllustration
                                foodId={food.id}
                                className="w-11 h-11"
                              />
                              <span className="mt-1.5 font-bold text-sm text-slate-900 whitespace-nowrap">
                                {food.title}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {food.korean}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* STEP 2: Choose reason for Step 1's food ("I want to eat [food] because it is [reason].") */}
                    {currentStep === 2 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200">
                          <FoodIllustration
                            foodId={initialFoodId}
                            className="w-8 h-8"
                          />
                          <span className="text-xs font-semibold text-amber-950">
                            Explaining why you want{" "}
                            <span className="font-bold underline">
                              {initialFoodId}
                            </span>
                            :
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {REASON_OPTIONS.map((reason) => {
                            const isActive = selectedReason === reason.id;
                            return (
                              <button
                                key={reason.id}
                                type="button"
                                onClick={() => handleSelectReason(reason.id)}
                                className={`min-h-[48px] px-3 py-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-center ${
                                  isActive
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="text-xs sm:text-sm font-bold">
                                  {reason.label}
                                </span>
                                <span
                                  className={`text-[11px] ${
                                    isActive
                                      ? "text-slate-300"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {reason.korean}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Partner ate Step 1's food yesterday -> Suggest another food instead */}
                    {currentStep === 3 && (
                      <div className="grid grid-cols-3 gap-2.5">
                        {FOOD_OPTIONS.map((food) => {
                          const isAteYesterday = food.id === initialFoodId;
                          const isSelected = selectedFood === food.id;
                          return (
                            <button
                              key={food.id}
                              type="button"
                              disabled={isAteYesterday}
                              onClick={() => handleSelectFood(food.id)}
                              className={`rounded-2xl p-3 text-center transition-all flex flex-col items-center justify-center border min-h-[104px] ${
                                isAteYesterday
                                  ? "bg-slate-100 border-slate-200 opacity-45 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 cursor-pointer"
                                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                              }`}
                            >
                              <FoodIllustration
                                foodId={food.id}
                                className="w-11 h-11"
                              />
                              <span className="mt-1.5 font-bold text-sm text-slate-900 whitespace-nowrap">
                                {food.title}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {isAteYesterday
                                  ? "Ate yesterday"
                                  : food.korean}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* STEP 4: Partner asks if there's a good place near here -> Choose place response */}
                    {currentStep === 4 && (
                      <div className="grid grid-cols-1 gap-2.5">
                        {PLACE_OPTIONS.map((place) => {
                          const isSelected = selectedPlace === place.id;
                          return (
                            <button
                              key={place.id}
                              type="button"
                              onClick={() => handleSelectPlace(place.id)}
                              className={`rounded-2xl p-3.5 text-left transition-all border cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {place.label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {place.korean}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* STEP 5: Partner asks "Perfect! Should we go there?" -> Choose final agreement */}
                    {currentStep === 5 && (
                      <div className="grid grid-cols-1 gap-2.5">
                        {CLOSING_OPTIONS.map((closing) => {
                          const isSelected = selectedClosing === closing.id;
                          return (
                            <button
                              key={closing.id}
                              type="button"
                              onClick={() => handleSelectClosing(closing.id)}
                              className={`rounded-2xl p-3.5 text-left transition-all border cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {closing.label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {closing.korean}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Prompt while sentence is incomplete */}
                  <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-300 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Select or complete your sentence to start speaking.
                    </p>
                  </div>
                </>
              ) : (
                /* Completed Target Sentence Area (Options hidden to reduce screen clutter) */
                <div className="rounded-2xl bg-amber-50/60 border border-amber-200/90 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-900">
                      Your Target Sentence
                    </span>
                    <button
                      type="button"
                      disabled={micState === "listening"}
                      onClick={handleResetChoices}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200 hover:bg-white cursor-pointer disabled:opacity-40"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Change choice</span>
                    </button>
                  </div>

                  <p className="text-2xl sm:text-3xl font-bold font-display leading-snug tracking-tight text-slate-900">
                    &ldquo;
                    {renderHighlightedSentence(
                      dynamicTarget.sentence,
                      dynamicTarget.keywords
                    )}
                    &rdquo;
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {dynamicTarget.korean}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={micState === "listening"}
                      onClick={() => speakText(dynamicTarget.sentence, 0.9)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-xs font-semibold text-slate-900 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="w-4 h-4 text-amber-700" />
                      <span>Listen</span>
                    </button>
                    <button
                      type="button"
                      disabled={micState === "listening"}
                      onClick={() => speakText(dynamicTarget.sentence, 0.7)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-xs font-semibold text-slate-900 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Turtle className="w-4 h-4 text-amber-700" />
                      <span>Slow</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PROMINENT FEEDBACK & REPAIR CARD (Recast -> Elicitation -> Chunking) */}
            {currentFeedback && (
              <div
                ref={feedbackCardRef}
                role="region"
                aria-label="Speaking feedback and correction"
                className={`rounded-2xl p-4 sm:p-5 border-2 shadow-sm transition-all ${
                  evaluationPassed
                    ? "bg-emerald-50 border-emerald-400"
                    : "bg-rose-50 border-rose-500 ring-4 ring-rose-500/20"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <CoachAvatar className="w-12 h-12" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                          evaluationPassed
                            ? "bg-emerald-200/70 text-emerald-900"
                            : "bg-rose-200 text-rose-950"
                        }`}
                      >
                        {repairPrompt
                          ? repairPrompt.badge
                          : currentFeedback.strategyLabel}
                      </span>

                      <button
                        type="button"
                        disabled={micState === "listening"}
                        onClick={() =>
                          speakText(
                            repairPrompt
                              ? dynamicTarget.sentence
                              : currentFeedback.english,
                            0.9
                          )
                        }
                        className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-rose-700" />
                        <span>Hear Correction</span>
                      </button>
                    </div>

                    <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {currentFeedback.english}
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-slate-700">
                      ({currentFeedback.korean})
                    </p>

                    {/* Reminder box when Success + small word missing (PRD Section 7) */}
                    {evaluationPassed === true &&
                      currentFeedback.situation === "partial" &&
                      missingKeywords.length > 0 && (
                        <div className="mt-2 rounded-xl bg-white border border-emerald-300 p-3 space-y-1">
                          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                            Small word(s) to remember next time:
                          </p>
                          <p className="text-sm font-bold text-slate-900">
                            &ldquo;{missingKeywords.join(", ")}&rdquo; &rarr;{" "}
                            <span className="text-emerald-800">
                              {dynamicTarget.sentence}
                            </span>
                          </p>
                        </div>
                      )}

                    {/* High-visibility Correction Practice Box for Recast / Elicitation / Chunking */}
                    {repairPrompt && (
                      <div className="mt-2 rounded-xl bg-white border-2 border-rose-400 p-3.5 space-y-1.5">
                        <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">
                          Correction — Try saying this:
                        </p>
                        <p className="text-xl sm:text-2xl font-bold font-display text-slate-900">
                          &ldquo;{repairPrompt.practiceText}&rdquo;
                        </p>
                        {missingKeywords.length > 0 && (
                          <p className="text-xs text-rose-800 font-semibold">
                            Key word(s) to include:{" "}
                            <span className="underline font-bold">
                              {missingKeywords.join(", ")}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM: Conditional Microphone Visibility + Post-Recording Highlighted Actions */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              {isSentenceComplete ? (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    disabled={isPlayingAudio}
                    onClick={handleMicToggle}
                    style={
                      micState === "listening"
                        ? {
                            transform: `scale(${1 + (volumeLevel / 100) * 0.16})`,
                          }
                        : undefined
                    }
                    aria-label={
                      micState === "listening"
                        ? "Listening - Tap to finish speaking"
                        : "Tap to Speak"
                    }
                    className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 text-white font-display font-bold shadow-md transition-transform duration-75 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      micState === "listening"
                        ? "bg-emerald-600 hover:bg-emerald-700 ring-8 ring-emerald-500/25"
                        : micState === "error"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-slate-600 hover:bg-slate-700 active:scale-95"
                    }`}
                  >
                    <Mic className="w-8 h-8" />
                    <span className="text-xs">
                      {micState === "listening"
                        ? "Tap Done"
                        : micState === "error"
                        ? "Error"
                        : "Tap to Speak"}
                    </span>
                  </button>

                  {/* On-Screen State Indicator & Reactive Green Volume Bar */}
                  <div className="mt-3 w-full max-w-xs flex flex-col items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold ${
                        micState === "listening"
                          ? "text-emerald-700"
                          : micState === "error"
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {micState === "listening"
                        ? "Listening... Speak clearly, then tap mic or pause 3s"
                        : micState === "error"
                        ? "Error accessing microphone"
                        : evaluationPassed === true
                        ? "Sentence verified! You can go to the next step."
                        : "Tap the mic and say your sentence to unlock Go Next"}
                    </span>

                    {micState === "listening" && (
                      <div
                        className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden"
                        aria-label="Microphone volume meter"
                      >
                        <div
                          className="h-full bg-emerald-500 transition-all duration-75"
                          style={{ width: `${Math.max(8, volumeLevel)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Real-Time Spoken Text Display */}
                  <div className="mt-2 min-h-[28px] text-center">
                    {liveTranscript ? (
                      <p className="text-base font-semibold text-slate-900">
                        You said: &ldquo;{liveTranscript}&rdquo;
                      </p>
                    ) : null}
                  </div>

                  {/* Optional Keyboard Fallback toggle */}
                  <button
                    type="button"
                    onClick={() => setShowManualInput((prev) => !prev)}
                    className="mt-1 text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Keyboard className="w-3 h-3" />
                    <span>
                      {showManualInput
                        ? "Hide keyboard input"
                        : "Type or test response"}
                    </span>
                  </button>
                </div>
              ) : null}

              {showManualInput && isSentenceComplete && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!manualTextInput.trim()) return;
                      setLiveTranscript(manualTextInput);
                      processSpokenAttempt(manualTextInput);
                      setManualTextInput("");
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={manualTextInput}
                      onChange={(e) => setManualTextInput(e.target.value)}
                      placeholder="Type sentence to test feedback..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs focus:outline-2 focus:outline-amber-600"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Submit
                    </button>
                  </form>
                </div>
              )}

              {/* Post-Recording Action Buttons: Go Next is ONLY available after evaluationPassed === true */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  disabled={!isSentenceComplete || micState === "listening"}
                  onClick={handleTryAgain}
                  className={`min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    evaluationPassed === false
                      ? "flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-sm ring-4 ring-amber-400/40"
                      : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {evaluationPassed === false
                      ? "Record Again"
                      : "Try Again"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={
                    !isSentenceComplete ||
                    evaluationPassed !== true ||
                    micState === "listening"
                  }
                  onClick={handleNextPhase}
                  className={`min-h-[48px] px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:ring-0 disabled:cursor-not-allowed ${
                    evaluationPassed === true
                      ? "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-4 ring-emerald-400/50"
                      : "flex-1 bg-slate-200 text-slate-400"
                  }`}
                >
                  {evaluationPassed === true && (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {evaluationPassed === true
                      ? currentStep < 5
                        ? "Great job! Go Next"
                        : "Great job! See Results"
                      : currentStep < 5
                      ? "Go Next (Speak Correct Sentence First)"
                      : "See Results (Speak Correct Sentence First)"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            SCREEN 3: RESULT SCREEN
           ========================================================= */}
        {screen === "result" && (
          <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            {/* TOP: Celebration Graphic + "Dinner Choice Finalized!" Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-18 h-18 rounded-3xl bg-amber-100 text-amber-700 mx-auto">
                <FoodIllustration foodId={activeFoodId} className="w-12 h-12" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">
                Dinner Choice Finalized!
              </h1>

              {/* Star Performance Badge */}
              <div className="pt-1 flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((starNum) => (
                    <Star
                      key={starNum}
                      className={`w-8 h-8 ${
                        starNum <= earnedStars
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-200 fill-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Finished the whole dialogue
                </p>
              </div>
            </div>

            {/* MIDDLE: Summary List Showing the Student's 5 Recorded Responses */}
            <div className="divide-y divide-slate-100 border-t border-b border-slate-200">
              {DIALOGUE_STEPS.map((stepItem) => {
                const rec = turnRecords.find((r) => r.step === stepItem.step);
                const fallbackTarget = buildDynamicTarget(
                  stepItem.step,
                  stepItem.step <= 2 ? initialFoodId : negotiatedFoodId,
                  rec?.reasonId || null
                );
                const targetSent =
                  rec?.targetSentence || fallbackTarget.sentence;
                const spokenSent = rec?.spokenText || fallbackTarget.sentence;

                return (
                  <div
                    key={stepItem.step}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 tabular-nums">
                        Step {stepItem.step} &bull;{" "}
                        {stepItem.partnerLine(conversationCtx)}
                      </p>
                      <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        &ldquo;{spokenSent}&rdquo;
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakText(targetSent, 0.9)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* BOTTOM: [Practice Again] Button */}
            <button
              type="button"
              onClick={handleStartPractice}
              className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Practice Again</span>
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
