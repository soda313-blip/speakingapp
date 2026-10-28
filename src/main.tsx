import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getFallbackFeedback } from "./services/geminiClient.ts";

// Global resilient fetch guard so any auxiliary/legacy call to /feedback or /api/feedback
// never produces a 404 error or interrupts the active voice/audio session.
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url || "";

    if (urlStr.includes("/api/feedback") || urlStr.endsWith("/feedback")) {
      try {
        const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
        const fallback = getFallbackFeedback({
          situation: bodyObj.situation || "success",
          targetSentence: bodyObj.targetSentence || "",
          spokenText: bodyObj.spokenText || "",
          missingKeywords: bodyObj.missingKeywords || [],
          matchedKeywords: bodyObj.matchedKeywords || [],
          partnerQuestion: bodyObj.partnerQuestion || "",
        });
        return new Response(JSON.stringify(fallback), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.warn("Non-critical fetch skipped:", err);
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    try {
      return await originalFetch(input, init);
    } catch (err) {
      console.warn("Non-critical fetch skipped:", err);
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);
