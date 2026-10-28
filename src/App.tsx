import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Volume2,
  Turtle,
  RotateCcw,
  ArrowRight,
  Star,
  AlertTriangle,
  Sparkles,
  Play,
  Keyboard,
} from "lucide-react";
import {
  FOOD_OPTIONS,
  REASON_OPTIONS,
  DIALOGUE_STEPS,
  PARTNER_PROFILES,
  FoodId,
  ReasonId,
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
  transcribePcmAudioClientSide,
} from "./services/geminiClient";

type ScreenMode = "start" | "practice" | "result";
type MicState = "ready" | "listening" | "processing";

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
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
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

  // Practice turn state (Steps 1..5)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedFood, setSelectedFood] = useState<FoodId>("pizza");
  const [selectedReason, setSelectedReason] = useState<ReasonId | null>(null);
  const [hasChosenFood, setHasChosenFood] = useState<boolean>(true);
  const [hasCreatedTargetSentence, setHasCreatedTargetSentence] =
    useState<boolean>(false);

  // Speech & Audio state
  const [micState, setMicState] = useState<MicState>("ready");
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(
    null
  );
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);

  // Completed turn records for Screen 3 Result Screen
  const [turnRecords, setTurnRecords] = useState<TurnRecord[]>([]);

  // Browser & Mic environment checks
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] =
    useState<boolean>(false);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualTextInput, setManualTextInput] = useState<string>("");

  // Refs for Web Speech API, PCM AudioContext pipeline, and timers
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const hadVoiceActivityRef = useRef<boolean>(false);

  const silenceTimerRef = useRef<number | null>(null);
  const initialWaitTimerRef = useRef<number | null>(null);
  const transcriptAccumulatorRef = useRef<string>("");
  const alternativesAccumulatorRef = useRef<string[]>([]);
  const isStoppingRef = useRef<boolean>(false);

  const partner = PARTNER_PROFILES[partnerIndex];
  const stepConfig = DIALOGUE_STEPS[currentStep - 1] || DIALOGUE_STEPS[0];
  const currentFoodObj =
    FOOD_OPTIONS.find((f) => f.id === selectedFood) || FOOD_OPTIONS[0];

  const dynamicTarget = buildDynamicTarget(
    currentStep,
    selectedFood,
    selectedReason
  );

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line|NAVER/i.test(ua);
    setIsInAppBrowser(inApp);

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasGetUserMedia = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
    if (!SpeechRec && !hasGetUserMedia) {
      setSpeechSupported(false);
    }

    setPartnerIndex(Math.floor(Math.random() * PARTNER_PROFILES.length));
  }, []);

  const clearAllTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (initialWaitTimerRef.current) {
      window.clearTimeout(initialWaitTimerRef.current);
      initialWaitTimerRef.current = null;
    }
  }, []);

  const cleanupAudioPipeline = useCallback(() => {
    setMicLevel(0);
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current.onaudioprocess = null;
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null;
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
  }, []);

  const initializeStepDefaults = useCallback(
    (stepNum: number) => {
      clearAllTimers();
      cleanupAudioPipeline();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      const cfg = DIALOGUE_STEPS[stepNum - 1];
      if (!cfg) return;
      setSelectedFood(cfg.recommendedFood);
      setSelectedReason(stepNum === 2 ? cfg.recommendedReason : null);
      setHasChosenFood(true);
      setHasCreatedTargetSentence(false);
      setLiveTranscript("");
      transcriptAccumulatorRef.current = "";
      alternativesAccumulatorRef.current = [];
      pcmChunksRef.current = [];
      hadVoiceActivityRef.current = false;
      isStoppingRef.current = false;
      setCurrentFeedback(null);
      setConsecutiveFailures(0);
      setMatchedKeywords([]);
      setMicState("ready");
    },
    [cleanupAudioPipeline, clearAllTimers]
  );

  const speakText = useCallback(
    (text: string, rate: 0.9 | 0.7 = 0.9) => {
      if (!("speechSynthesis" in window)) return;
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
        console.warn("Non-critical speech synthesis error skipped:", err);
        setIsPlayingAudio(false);
      }
    },
    [micState]
  );

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      clearAllTimers();
      cleanupAudioPipeline();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupAudioPipeline, clearAllTimers]);

  // Pure client-side evaluation & feedback generator (never makes a backend /api/feedback request)
  const processSpokenAttempt = useCallback(
    async (
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
      setMicState("processing");
      setHasCreatedTargetSentence(true);

      const evaluation = evaluateSpeech(
        spoken,
        dynamicTarget,
        consecutiveFailures,
        alternatives
      );
      const situation = forcedSituation || evaluation.situation;

      const isFailure =
        situation === "fail_1_recast" ||
        situation === "fail_2_elicitation" ||
        situation === "fail_3_chunking";

      if (isFailure) {
        setConsecutiveFailures((prev) => prev + 1);
      } else if (situation === "success" || situation === "partial") {
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

      const partnerQ = stepConfig.partnerLine(currentFoodObj);
      const feedbackReq = {
        situation,
        targetSentence: dynamicTarget.sentence,
        spokenText: spoken,
        missingKeywords: computedMissing,
        matchedKeywords: computedMatched,
        partnerQuestion: partnerQ,
      };

      let fb: FeedbackData;
      try {
        const res = await generateFeedbackClientSide(feedbackReq);
        fb = {
          ...res,
          situation,
        };
      } catch (err) {
        console.warn("Non-critical fetch skipped:", err);
        const fallback = getFallbackFeedback(feedbackReq);
        fb = {
          ...fallback,
          situation,
        };
      }

      setCurrentFeedback(fb);

      const record: TurnRecord = {
        step: currentStep,
        partnerQuestion: partnerQ,
        targetSentence: dynamicTarget.sentence,
        koreanMeaning: dynamicTarget.korean,
        spokenText: spoken.trim() || "(No speech detected)",
        matchedKeywords: computedMatched,
        missingKeywords: computedMissing,
        feedback: fb,
        foodId: selectedFood,
        reasonId: selectedReason,
      };

      setTurnRecords((prev) => {
        const filtered = prev.filter((r) => r.step !== currentStep);
        return [...filtered, record].sort((a, b) => a.step - b.step);
      });

      setMicState("ready");
    },
    [
      consecutiveFailures,
      currentFoodObj,
      currentStep,
      dynamicTarget,
      selectedFood,
      selectedReason,
      stepConfig,
    ]
  );

  const finalizeRecordingSession = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    clearAllTimers();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Snapshot captured PCM chunks before closing AudioContext
    const chunks = pcmChunksRef.current;
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const mergedPcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      mergedPcm.set(chunk, offset);
      offset += chunk.length;
    }
    const sampleRate = audioCtxRef.current?.sampleRate || 16000;
    const hadVoice = hadVoiceActivityRef.current;

    cleanupAudioPipeline();
    setMicState("processing");

    let finalSpoken = transcriptAccumulatorRef.current.trim();
    const alts = alternativesAccumulatorRef.current;

    // Standalone Voice Fallback: if browser SpeechRecognition produced no text
    // (e.g. inside an iframe), transcribe the captured PCM audio directly client-side via Gemini SDK.
    if (!finalSpoken && hadVoice && mergedPcm.length > sampleRate * 0.25) {
      try {
        const geminiTranscript = await transcribePcmAudioClientSide(
          mergedPcm,
          sampleRate,
          dynamicTarget.sentence
        );
        if (geminiTranscript) {
          finalSpoken = geminiTranscript;
          setLiveTranscript(finalSpoken);
        }
      } catch (err) {
        console.warn("Non-critical fetch skipped:", err);
      }
    }

    if (!finalSpoken) {
      await processSpokenAttempt("", [], "no_speech");
    } else {
      setLiveTranscript(finalSpoken);
      await processSpokenAttempt(finalSpoken, alts);
    }
  }, [
    cleanupAudioPipeline,
    clearAllTimers,
    dynamicTarget.sentence,
    processSpokenAttempt,
  ]);

  const finalizeRecordingRef = useRef(finalizeRecordingSession);
  useEffect(() => {
    finalizeRecordingRef.current = finalizeRecordingSession;
  }, [finalizeRecordingSession]);

  const handleMicToggle = useCallback(async () => {
    if (isPlayingAudio) return;

    if (micState === "listening") {
      await finalizeRecordingRef.current();
      return;
    }

    if (micState === "processing") return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }

    clearAllTimers();
    cleanupAudioPipeline();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setLiveTranscript("");
    transcriptAccumulatorRef.current = "";
    alternativesAccumulatorRef.current = [];
    pcmChunksRef.current = [];
    hadVoiceActivityRef.current = false;
    isStoppingRef.current = false;
    setCurrentFeedback(null);
    setMicPermissionDenied(false);
    setMicState("listening");

    // Reset the 3-second post-speech silence timer whenever speech or voice energy is detected
    const resetPostSpeechSilenceTimer = () => {
      if (initialWaitTimerRef.current) {
        window.clearTimeout(initialWaitTimerRef.current);
        initialWaitTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(() => {
        finalizeRecordingRef.current();
      }, 3000);
    };

    // 1. Start standalone client-side PCM audio capture for live mic level meter + voice activity + fallback transcription
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Guard if user already stopped while waiting for permission
        if (isStoppingRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (isStoppingRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(inputData.length);
            copy.set(inputData);
            pcmChunksRef.current.push(copy);

            // Compute RMS level for visual feedback and voice activity detection
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) {
              sumSquares += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquares / inputData.length);
            const normalizedLevel = Math.min(1, rms * 8);
            setMicLevel(normalizedLevel);

            if (rms > 0.02) {
              hadVoiceActivityRef.current = true;
              resetPostSpeechSilenceTimer();
            }
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        }
      } catch (err) {
        console.warn("Non-critical getUserMedia warning:", err);
        setMicPermissionDenied(true);
        setShowManualInput(true);
        setMicState("ready");
        return;
      }
    }

    // Allow up to 12 seconds after permission is granted before initial timeout if no speech starts
    initialWaitTimerRef.current = window.setTimeout(() => {
      if (
        !transcriptAccumulatorRef.current.trim() &&
        !hadVoiceActivityRef.current
      ) {
        finalizeRecordingRef.current();
      }
    }, 12000);

    // 2. Start Browser Web Speech API for real-time text streaming
    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognitionRef.current = recognition;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          if (isStoppingRef.current) return;
          let interim = "";
          let finalStr = "";
          const altList: string[] = [];

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            const primaryTranscript = res[0]?.transcript || "";
            if (res.isFinal) {
              finalStr += primaryTranscript + " ";
            } else {
              interim += primaryTranscript + " ";
            }
            for (let a = 0; a < res.length; a++) {
              if (res[a]?.transcript) {
                altList.push(res[a].transcript);
              }
            }
          }

          const combined = (finalStr + interim).replace(/\s+/g, " ").trim();
          if (combined) {
            transcriptAccumulatorRef.current = combined;
            alternativesAccumulatorRef.current = altList;
            setLiveTranscript(combined);
            resetPostSpeechSilenceTimer();
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
          ) {
            // Only abort if we don't have an active PCM AudioContext stream
            if (!mediaStreamRef.current) {
              setMicPermissionDenied(true);
              setShowManualInput(true);
              finalizeRecordingRef.current();
            }
          }
        };

        recognition.onend = () => {
          // If SpeechRecognition already captured final words and user paused, or if no PCM stream is active, finalize
          if (
            !isStoppingRef.current &&
            (transcriptAccumulatorRef.current.trim().length > 0 ||
              !mediaStreamRef.current)
          ) {
            finalizeRecordingRef.current();
          }
        };

        recognition.start();
      } catch (err) {
        console.warn("Non-critical SpeechRecognition start skipped:", err);
      }
    }
  }, [cleanupAudioPipeline, clearAllTimers, isPlayingAudio, micState]);

  const handleSelectFood = (foodId: FoodId) => {
    setSelectedFood(foodId);
    setHasChosenFood(true);
    const foodObj = FOOD_OPTIONS.find((f) => f.id === foodId);
    if (currentStep === 2 && foodObj) {
      setSelectedReason(foodObj.defaultReason);
    }
    setHasCreatedTargetSentence(true);
    setCurrentFeedback(null);
  };

  const handleSelectReason = (reasonId: ReasonId) => {
    if (currentStep !== 2 && selectedReason === reasonId) {
      setSelectedReason(null);
    } else {
      setSelectedReason(reasonId);
    }
    setHasCreatedTargetSentence(true);
    setCurrentFeedback(null);
  };

  const handleTryAgain = () => {
    setLiveTranscript("");
    transcriptAccumulatorRef.current = "";
    alternativesAccumulatorRef.current = [];
    pcmChunksRef.current = [];
    hadVoiceActivityRef.current = false;
    setCurrentFeedback(null);
    setMicState("ready");
  };

  const handleNextPhase = () => {
    if (!hasCreatedTargetSentence) return;

    if (!turnRecords.some((r) => r.step === currentStep)) {
      const partnerQ = stepConfig.partnerLine(currentFoodObj);
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
        foodId: selectedFood,
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
    setCurrentStep(1);
    initializeStepDefaults(1);
    setScreen("practice");
  };

  const completedCount = turnRecords.length;
  const earnedStars = completedCount >= 5 ? 3 : completedCount >= 3 ? 2 : 1;

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

      return (
        <span
          key={idx}
          className={`inline-block mr-1.5 transition-colors ${
            isMatched
              ? "text-emerald-700 underline decoration-emerald-500 decoration-2 underline-offset-4"
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
            SCREEN 1: START SCREEN
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

            {/* Bottom: Large Start Talking button + Small privacy notice right at the bottom */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleStartPractice}
                className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-display font-bold text-lg sm:text-xl flex items-center justify-center gap-3 shadow-sm transition-all cursor-pointer"
              >
                <Mic className="w-6 h-6" />
                <span>Start Talking</span>
              </button>

              <p className="text-center text-xs text-slate-500">
                Your voice is processed to turn it into text and is not recorded
                or saved.
              </p>
            </div>
          </section>
        )}

        {/* =========================================================
            SCREEN 2: PRACTICE SCREEN
           ========================================================= */}
        {screen === "practice" && (
          <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
            {/* TOP: Progress Indicator (Step X/5) + Partner Character Speech Bubble */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 tabular-nums">
                <span>Step {currentStep}/5</span>
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
                        speakText(stepConfig.partnerLine(currentFoodObj), 0.9)
                      }
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Listen</span>
                    </button>
                  </div>
                  <p className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                    &ldquo;{stepConfig.partnerLine(currentFoodObj)}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stepConfig.partnerKorean(currentFoodObj)}
                  </p>
                </div>
              </div>
            </div>

            {/* MIDDLE: 3 Food Visual Cards + Reason Tag Selector + Target Sentence Area */}
            <div className="space-y-4">
              {/* 3 Food Visual Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                {FOOD_OPTIONS.map((food) => {
                  const isSelected = selectedFood === food.id;
                  return (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handleSelectFood(food.id)}
                      className={`rounded-2xl p-3 text-center transition-all flex flex-col items-center justify-center border cursor-pointer min-h-[96px] ${
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
                    </button>
                  );
                })}
              </div>

              {/* Reason Tag Selector (Appears after food choice) */}
              {hasChosenFood && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {REASON_OPTIONS.map((reason) => {
                    const isActive = selectedReason === reason.id;
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => handleSelectReason(reason.id)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                          isActive
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70"
                        }`}
                      >
                        {reason.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Target Sentence Area (Largest Text + Listen Buttons) */}
              <div className="rounded-2xl bg-amber-50/60 border border-amber-200/90 p-4 sm:p-5">
                <p className="text-2xl sm:text-3xl font-bold font-display leading-snug tracking-tight text-slate-900">
                  &ldquo;
                  {renderHighlightedSentence(
                    dynamicTarget.sentence,
                    dynamicTarget.keywords
                  )}
                  &rdquo;
                </p>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  {dynamicTarget.korean}
                </p>

                <div className="mt-3 flex items-center gap-2">
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
            </div>

            {/* BOTTOM: Large Round Mic Button + Spoken Text + Feedback Card + Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={isPlayingAudio || micState === "processing"}
                  onClick={handleMicToggle}
                  style={
                    micState === "listening"
                      ? {
                          transform: `scale(${1 + micLevel * 0.14})`,
                        }
                      : undefined
                  }
                  aria-label={
                    micState === "listening"
                      ? "Listening - Tap to stop"
                      : micState === "processing"
                      ? "Processing speech"
                      : "Tap to Speak"
                  }
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 text-white font-display font-bold shadow-md transition-transform duration-75 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    micState === "listening"
                      ? "bg-emerald-600 hover:bg-emerald-700 ring-8 ring-emerald-500/25"
                      : micState === "processing"
                      ? "bg-blue-600 ring-8 ring-blue-500/20"
                      : "bg-slate-500 hover:bg-slate-600 active:scale-95"
                  }`}
                >
                  {micState === "processing" ? (
                    <>
                      <Sparkles className="w-7 h-7" />
                      <span className="text-xs">Processing</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8" />
                      <span className="text-xs">
                        {micState === "listening"
                          ? "Listening"
                          : "Tap to Speak"}
                      </span>
                    </>
                  )}
                </button>

                {/* Real-Time Spoken Text Display */}
                <div className="mt-3 w-full text-center min-h-[28px]">
                  {liveTranscript ? (
                    <p className="text-base font-semibold text-slate-900">
                      &ldquo;{liveTranscript}&rdquo;
                    </p>
                  ) : micState === "listening" ? (
                    <p className="text-xs font-medium text-emerald-700">
                      Listening... Tap button when done or pause for 3s
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

              {showManualInput && (
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

              {/* Feedback Card (Appears after speaking with Coach avatar) */}
              {currentFeedback && (
                <div
                  role="region"
                  aria-label="Speaking feedback card"
                  className={`rounded-2xl p-4 border ${
                    currentFeedback.situation === "success" ||
                    currentFeedback.situation === "partial"
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-amber-50/80 border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CoachAvatar className="w-11 h-11" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {currentFeedback.english}
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-700">
                        ({currentFeedback.korean})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: [Try Again] [Next Phase →] */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="min-h-[46px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  disabled={
                    !hasCreatedTargetSentence || micState === "listening"
                  }
                  onClick={handleNextPhase}
                  className="flex-1 min-h-[46px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{currentStep < 5 ? "Next Phase" : "See Results"}</span>
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
                <FoodIllustration foodId={selectedFood} className="w-12 h-12" />
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
                const targetSent =
                  rec?.targetSentence || stepItem.canonicalSentence;
                const spokenSent =
                  rec?.spokenText || stepItem.canonicalSentence;

                return (
                  <div
                    key={stepItem.step}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 tabular-nums">
                        Step {stepItem.step}
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
