/**
 * Onboarding state helpers.
 *
 * Shows the full app tour only once per app version. Bumping APP_VERSION
 * causes the tour to replay for all existing users (e.g. to highlight newly
 * added features).
 */
export const APP_VERSION = "1.0.0";

const STORAGE_KEY = "onboarding-version";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch {
    return true;
  }
}

export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch {
    // localStorage might be unavailable (private mode on some iOS)
  }
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Detect if the app is running in PWA standalone mode. */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Standard W3C
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari
  if ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

/** Detect the current browser for browser-specific install instructions. */
export type BrowserType =
  | "chrome-android"
  | "safari-ios"
  | "edge"
  | "samsung"
  | "firefox"
  | "other";

export function detectBrowser(): BrowserType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox/i.test(ua)) return "firefox";
  // Must test Chrome before Safari because Chrome on iOS includes "Safari"
  if (/CriOS/i.test(ua) || (/Chrome/i.test(ua) && /Android/i.test(ua))) return "chrome-android";
  if (/Safari/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)) return "safari-ios";
  return "other";
}
