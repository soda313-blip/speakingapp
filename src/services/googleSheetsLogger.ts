/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (Code.gs) FOR EXTENSIONS > APPS SCRIPT
 * ============================================================================
 * SPREADSHEET TARGET ID: 1WB8yPbKsqTAfyH-6da0r4HqpqEKSZcLsz_mOUqMHEtc
 * 
 * Instructions to deploy:
 * 1. Open your Google Spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1WB8yPbKsqTAfyH-6da0r4HqpqEKSZcLsz_mOUqMHEtc/edit
 * 2. In Google Sheets, click "Extensions" > "Apps Script".
 * 3. Delete any default code in Code.gs and paste the code below:
 * 
 * ------------------- [COPY CODE BELOW INTO Code.gs] -------------------
 * const SPREADSHEET_ID = "1WB8yPbKsqTAfyH-6da0r4HqpqEKSZcLsz_mOUqMHEtc";
 * 
 * function doPost(e) {
 *   try {
 *     var data = {};
 *     if (e && e.postData && e.postData.contents) {
 *       try {
 *         data = JSON.parse(e.postData.contents);
 *       } catch (parseErr) {
 *         data = e.parameter || {};
 *       }
 *     } else if (e && e.parameter) {
 *       data = e.parameter;
 *     }
 * 
 *     var timestamp = data.timestamp || new Date().toISOString();
 *     var name = data.name || "Student";
 *     var playCount = Number(data.play_count !== undefined ? data.play_count : data.playCount) || 0;
 *     var correctCount = Number(data.correct_count !== undefined ? data.correct_count : data.correctCount) || 0;
 *     var wrongCount = Number(data.wrong_count !== undefined ? data.wrong_count : data.wrongCount) || 0;
 * 
 *     var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
 *     var sheet = ss.getActiveSheet();
 * 
 *     // Append header row if the sheet is completely blank
 *     if (sheet.getLastRow() === 0) {
 *       sheet.appendRow(["timestamp", "name", "play_count", "correct_count", "wrong_count"]);
 *     }
 * 
 *     sheet.appendRow([timestamp, name, playCount, correctCount, wrongCount]);
 * 
 *     return ContentService.createTextOutput(JSON.stringify({
 *       status: "success",
 *       row: [timestamp, name, playCount, correctCount, wrongCount]
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({
 *       status: "error",
 *       message: err.toString()
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 * 
 * function doGet(e) {
 *   // Supports query-param test logging or health check
 *   if (e && e.parameter && (e.parameter.name || e.parameter.play_count)) {
 *     return doPost(e);
 *   }
 *   return ContentService.createTextOutput(JSON.stringify({
 *     status: "ready",
 *     spreadsheetId: SPREADSHEET_ID,
 *     schema: ["timestamp", "name", "play_count", "correct_count", "wrong_count"]
 *   })).setMimeType(ContentService.MimeType.JSON);
 * }
 * ------------------- [END OF Code.gs SNIPPET] -------------------
 * 
 * 4. Click "Save" (floppy disk icon).
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app".
 *    - Description: Speaking App Performance Logger
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (crucial for client-side logging without student login)
 * 7. Click "Deploy", review permissions, and copy the Web App URL (starts with https://script.google.com/macros/s/...).
 * 8. Optional: Paste the Web App URL into the app's "Sheet Settings" modal or set VITE_GOOGLE_SHEETS_WEBAPP_URL in your environment.
 * ============================================================================
 */

export const GOOGLE_APPS_SCRIPT_SNIPPET = `const SPREADSHEET_ID = "1WB8yPbKsqTAfyH-6da0r4HqpqEKSZcLsz_mOUqMHEtc";

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var timestamp = data.timestamp || new Date().toISOString();
    var name = data.name || "Student";
    var playCount = Number(data.play_count !== undefined ? data.play_count : data.playCount) || 0;
    var correctCount = Number(data.correct_count !== undefined ? data.correct_count : data.correctCount) || 0;
    var wrongCount = Number(data.wrong_count !== undefined ? data.wrong_count : data.wrongCount) || 0;

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getActiveSheet();

    // Ensure header row exists if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["timestamp", "name", "play_count", "correct_count", "wrong_count"]);
    }

    sheet.appendRow([timestamp, name, playCount, correctCount, wrongCount]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      row: [timestamp, name, playCount, correctCount, wrongCount]
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  if (e && e.parameter && (e.parameter.name || e.parameter.play_count)) {
    return doPost(e);
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "ready",
    spreadsheetId: SPREADSHEET_ID,
    schema: ["timestamp", "name", "play_count", "correct_count", "wrong_count"]
  })).setMimeType(ContentService.MimeType.JSON);
}`;

export const TARGET_SPREADSHEET_ID = "1WB8yPbKsqTAfyH-6da0r4HqpqEKSZcLsz_mOUqMHEtc";
export const TARGET_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`;

export interface PerformanceLogEntry {
  timestamp: string;
  name: string;
  play_count: number;
  correct_count: number;
  wrong_count: number;
}

const STORAGE_KEY_WEBAPP_URL = "speaking_app_sheets_webapp_url";

export function getCustomWebAppUrl(): string {
  try {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY_WEBAPP_URL);
      if (stored && stored.trim().startsWith("https://script.google.com/")) {
        return stored.trim();
      }
    }
  } catch {
    // ignore
  }
  return (import.meta.env.VITE_GOOGLE_SHEETS_WEBAPP_URL as string) || "";
}

export function saveCustomWebAppUrl(url: string): void {
  try {
    if (typeof window !== "undefined") {
      if (!url.trim()) {
        window.localStorage.removeItem(STORAGE_KEY_WEBAPP_URL);
      } else {
        window.localStorage.setItem(STORAGE_KEY_WEBAPP_URL, url.trim());
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Log student performance safely.
 * Wraps all network calls in try/catch so network failures NEVER halt speech or audio.
 */
export async function logStudentPerformance(
  entry: PerformanceLogEntry
): Promise<{ success: boolean; destination: string }> {
  const payload = {
    timestamp: entry.timestamp || new Date().toISOString(),
    name: entry.name.trim() || "Student",
    play_count: Number(entry.play_count) || 0,
    correct_count: Number(entry.correct_count) || 0,
    wrong_count: Number(entry.wrong_count) || 0,
  };

  const webAppUrl = getCustomWebAppUrl();

  // 1. Direct Google Apps Script Web App call if URL configured
  if (webAppUrl) {
    try {
      // Note: Google Apps Script Web App redirects (302). mode: 'no-cors' guarantees submission without CORS block.
      await fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain", // prevents preflight in Apps Script
        },
        body: JSON.stringify(payload),
      });
      return { success: true, destination: "Google Spreadsheet (Web App)" };
    } catch (err) {
      console.warn("Non-critical direct Google Sheets fetch skipped:", err);
    }
  }

  // 2. Safe fallback through local backend proxy route (/api/log-performance)
  try {
    const res = await fetch("/api/log-performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { success: true, destination: "Performance Logger API" };
    }
  } catch (err) {
    console.warn("Non-critical local logger fetch skipped:", err);
  }

  return { success: false, destination: "Local buffer" };
}
