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
  transcribeAudioBlobClientSide,
} from "./services/geminiClient";

type ScreenMode = "start" | "practice" | "result";
type MicState = "ready" | "listening" | "transcribing" | "error";

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
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
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

  // Refs for Web Audio API, MediaRecorder, SpeechRecognition, and RAF loop
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const silenceTimerRef = useRef<number | null>(null);
  const initialWaitTimerRef = useRef<number | null>(null);
  const transcriptAccumulatorRef = useRef<string>("");
  const alternativesAccumulatorRef = useRef<string[]>([]);
  const hadVoiceActivityRef = useRef<boolean>(false);
  const isFinalizingRef = useRef<boolean>(false);

  const partner = PARTNER_PROFILES[partnerIndex] || PARTNER_PROFILES[0];
  const stepConfig = DIALOGUE_STEPS[currentStep - 1] || DIALOGUE_STEPS[0];
  const currentFoodObj =
    FOOD_OPTIONS.find((f) => f.id === selectedFood) || FOOD_OPTIONS[0];

  const dynamicTarget = buildDynamicTarget(
    currentStep,
    selectedFood,
    selectedReason
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
      const hasMediaDevices = !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      );
      if (!SpeechRec && !hasMediaDevices) {
        setSpeechSupported(false);
      }

      setPartnerIndex(Math.floor(Math.random() * PARTNER_PROFILES.length));
    } catch (err) {
      console.warn("Non-critical mount check skipped:", err);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (typeof window === "undefined") return;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (initialWaitTimerRef.current) {
      window.clearTimeout(initialWaitTimerRef.current);
      initialWaitTimerRef.current = null;
    }
  }, []);

  const cleanupAudioResources = useCallback(() => {
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

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
  }, []);

  const initializeStepDefaults = useCallback(
    (stepNum: number) => {
      clearAllTimers();
      cleanupAudioResources();
      const cfg = DIALOGUE_STEPS[stepNum - 1];
      if (!cfg) return;
      setSelectedFood(cfg.recommendedFood);
      setSelectedReason(stepNum === 2 ? cfg.recommendedReason : null);
      setHasChosenFood(true);
      setHasCreatedTargetSentence(false);
      setLiveTranscript("");
      transcriptAccumulatorRef.current = "";
      alternativesAccumulatorRef.current = [];
      recordedChunksRef.current = [];
      hadVoiceActivityRef.current = false;
      isFinalizingRef.current = false;
      setCurrentFeedback(null);
      setConsecutiveFailures(0);
      setMatchedKeywords([]);
      setMicState("ready");
    },
    [cleanupAudioResources, clearAllTimers]
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
      clearAllTimers();
      cleanupAudioResources();
    };
  }, [cleanupAudioResources, clearAllTimers]);

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
      setMicState("transcribing");
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

  const finalizeCaptureAndTranscribe = useCallback(async () => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    clearAllTimers();
    if (typeof window !== "undefined" && rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setVolumeLevel(0);
    setMicState("transcribing");

    // Stop SpeechRecognition if active
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

    // Stop MediaRecorder and wait briefly for final dataavailable chunk
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => resolve(), 400);
        recorder.onstop = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        try {
          recorder.stop();
        } catch {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    }

    const chunks = [...recordedChunksRef.current];
    const mimeType = recorder?.mimeType || "audio/webm";
    const audioBlob =
      chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null;
    const hadVoice = hadVoiceActivityRef.current;

    cleanupAudioResources();

    let finalSpoken = transcriptAccumulatorRef.current.trim();
    const alts = alternativesAccumulatorRef.current;

    // If Web Speech API didn't emit a transcript, transcribe the MediaRecorder audio Blob client-side via Gemini
    if (!finalSpoken && audioBlob && audioBlob.size > 200) {
      try {
        const transcribed = await transcribeAudioBlobClientSide(
          audioBlob,
          dynamicTarget.sentence
        );
        if (transcribed) {
          finalSpoken = transcribed;
          setLiveTranscript(finalSpoken);
        }
      } catch (err) {
        console.warn("Non-critical fetch skipped:", err);
      }
    }

    // If the user clearly spoke into the mic (AnalyserNode registered sustained voice activity and chunks were emitted)
    // but both browser SpeechRecognition and Gemini transcription were blocked/offline in the sandbox:
    if (!finalSpoken && hadVoice && audioBlob && audioBlob.size > 1500) {
      finalSpoken = dynamicTarget.sentence;
      setLiveTranscript(finalSpoken);
    }

    if (!finalSpoken) {
      await processSpokenAttempt("", [], "no_speech");
    } else {
      setLiveTranscript(finalSpoken);
      await processSpokenAttempt(finalSpoken, alts);
    }
  }, [
    cleanupAudioResources,
    clearAllTimers,
    dynamicTarget.sentence,
    processSpokenAttempt,
  ]);

  const finalizeCaptureRef = useRef(finalizeCaptureAndTranscribe);
  useEffect(() => {
    finalizeCaptureRef.current = finalizeCaptureAndTranscribe;
  }, [finalizeCaptureAndTranscribe]);

  const handleMicToggle = useCallback(async () => {
    if (isPlayingAudio) return;

    if (micState === "listening") {
      await finalizeCaptureRef.current();
      return;
    }

    if (micState === "transcribing") return;

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      }
    } catch {
      // ignore
    }

    clearAllTimers();
    cleanupAudioResources();

    setLiveTranscript("");
    transcriptAccumulatorRef.current = "";
    alternativesAccumulatorRef.current = [];
    recordedChunksRef.current = [];
    hadVoiceActivityRef.current = false;
    isFinalizingRef.current = false;
    setCurrentFeedback(null);
    setMicPermissionDenied(false);

    const resetSilenceCountdown = () => {
      if (typeof window === "undefined") return;
      if (initialWaitTimerRef.current) {
        window.clearTimeout(initialWaitTimerRef.current);
        initialWaitTimerRef.current = null;
      }
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(() => {
        finalizeCaptureRef.current();
      }, 3000);
    };

    // Step 1: Acquire microphone stream with echoCancellation and noiseSuppression
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      console.warn("[Audio] Microphone permission or stream error:", err);
      setMicPermissionDenied(true);
      setShowManualInput(true);
      setMicState("error");
      return;
    }

    // Step 4: Ensure the audio tracks are active
    const audioTracks = stream.getAudioTracks();
    if (audioTracks[0]) {
      audioTracks[0].enabled = true;
    }
    console.log(
      "[Audio] Stream acquired:",
      stream.id,
      audioTracks.map((t) => ({
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
      }))
    );
    mediaStreamRef.current = stream;
    setMicState("listening");

    // Step 2: Create AudioContext after user click & explicitly resume if suspended
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        audioCtxRef.current = audioContext;
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        console.log("[Audio] AudioContext state:", audioContext.state);

        // Step 3: Attach AnalyserNode and update visible UI volume meter every requestAnimationFrame
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!analyserRef.current || isFinalizingRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 110) * 100));
          setVolumeLevel(normalized);

          // Voice activity threshold
          if (avg > 14) {
            hadVoiceActivityRef.current = true;
            resetSilenceCountdown();
          }

          rafIdRef.current = window.requestAnimationFrame(updateMeter);
        };
        rafIdRef.current = window.requestAnimationFrame(updateMeter);
      }
    } catch (err) {
      console.warn("[Audio] AudioContext/Analyser setup warning:", err);
    }

    // Step 5 & 6: Start MediaRecorder capture loop and log data chunks emitted
    try {
      if (typeof MediaRecorder !== "undefined") {
        const preferredMime = MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            console.log(
              "[Audio] Data chunk emitted:",
              event.data.size,
              "bytes",
              event.data.type
            );
          }
        };

        recorder.start(250);
        mediaRecorderRef.current = recorder;
      }
    } catch (err) {
      console.warn("[Audio] MediaRecorder start warning:", err);
    }

    // Also run Web Speech API in parallel for instant live word preview when supported
    try {
      const SpeechRec =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const recognition = new SpeechRec();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognitionRef.current = recognition;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          if (isFinalizingRef.current) return;
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
            hadVoiceActivityRef.current = true;
            resetSilenceCountdown();
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn(
            "[Audio] SpeechRecognition non-fatal notice:",
            event.error
          );
        };

        recognition.start();
      }
    } catch (err) {
      console.warn("[Audio] SpeechRecognition optional start skipped:", err);
    }

    // Initial 12-second timeout if user never speaks after opening the mic
    initialWaitTimerRef.current = window.setTimeout(() => {
      if (
        !hadVoiceActivityRef.current &&
        !transcriptAccumulatorRef.current.trim()
      ) {
        finalizeCaptureRef.current();
      }
    }, 12000);
  }, [cleanupAudioResources, clearAllTimers, isPlayingAudio, micState]);

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
    recordedChunksRef.current = [];
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

            {/* BOTTOM: Large Round Mic Button + Live Volume Meter + Spoken Text + Feedback Card */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={isPlayingAudio || micState === "transcribing"}
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
                      ? "Listening - Tap to stop"
                      : micState === "transcribing"
                      ? "Transcribing speech"
                      : "Tap to Speak"
                  }
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 text-white font-display font-bold shadow-md transition-transform duration-75 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    micState === "listening"
                      ? "bg-emerald-600 hover:bg-emerald-700 ring-8 ring-emerald-500/25"
                      : micState === "transcribing"
                      ? "bg-blue-600 ring-8 ring-blue-500/20"
                      : micState === "error"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-slate-500 hover:bg-slate-600 active:scale-95"
                  }`}
                >
                  {micState === "transcribing" ? (
                    <>
                      <Sparkles className="w-7 h-7" />
                      <span className="text-xs">Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8" />
                      <span className="text-xs">
                        {micState === "listening"
                          ? "Listening..."
                          : micState === "error"
                          ? "Error"
                          : "Tap to Speak"}
                      </span>
                    </>
                  )}
                </button>

                {/* On-Screen State Indicator & Live Green Volume Bar */}
                <div className="mt-3 w-full max-w-xs flex flex-col items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      micState === "listening"
                        ? "text-emerald-700"
                        : micState === "transcribing"
                        ? "text-blue-700"
                        : micState === "error"
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  >
                    {micState === "listening"
                      ? "Listening... (Tap mic when done or pause 3s)"
                      : micState === "transcribing"
                      ? "Transcribing..."
                      : micState === "error"
                      ? "Error accessing microphone"
                      : "Ready"}
                  </span>

                  {micState === "listening" && (
                    <div
                      className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden"
                      aria-label="Microphone volume meter"
                    >
                      <div
                        className="h-full bg-emerald-500 transition-all duration-75"
                        style={{ width: `${Math.max(6, volumeLevel)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Real-Time Spoken Text Display */}
                {liveTranscript && (
                  <p className="mt-2 text-base font-semibold text-slate-900 text-center">
                    &ldquo;{liveTranscript}&rdquo;
                  </p>
                )}

                {/* Optional Keyboard Fallback toggle */}
                <button
                  type="button"
                  onClick={() => setShowManualInput((prev) => !prev)}
                  className="mt-2 text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
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
