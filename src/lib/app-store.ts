/**
 * The phone app on Google Play. The website is for clients booking and for
 * owners on a computer; owners on a phone should use the app (it is made for
 * it). Turn APP_ON_PLAY on once the app is published: the homepage then
 * offers Google Play first, and phone browsers get a gentle "install the app".
 */
export const APP_ON_PLAY = false;

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.sycras.app";

/** True inside the old Android shell (Capacitor), where "install the app" makes no sense. */
export function inNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** An Android phone in a browser: the people the app is for. */
export function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) && !inNativeShell();
}
