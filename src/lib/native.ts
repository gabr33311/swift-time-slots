// Native app (Capacitor) features. Everything is a no-op in the browser.
import { toast } from "sonner";

const OPEN_KEY = "sycras-open-appointment";
const OPEN_EVENT = "sycras:open-appointment";

async function core() {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform() ? Capacitor : null;
}

/** Asks the app to open one appointment (works even before the app has loaded). */
export function requestOpenAppointment(id: string) {
  try {
    window.sessionStorage.setItem(OPEN_KEY, id);
  } catch {
    // Ignore.
  }
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
}

/** Calls `open` for appointments requested by a notification tap (now and later). */
export function onOpenAppointmentRequest(open: (id: string) => void): () => void {
  const take = () => {
    try {
      const id = window.sessionStorage.getItem(OPEN_KEY);
      if (id) {
        window.sessionStorage.removeItem(OPEN_KEY);
        open(id);
      }
    } catch {
      // Ignore.
    }
  };
  take();
  window.addEventListener(OPEN_EVENT, take);
  return () => window.removeEventListener(OPEN_EVENT, take);
}

let shellReady = false;

/** Android back button: go back inside the app; at the start, send the app to the background. */
export async function initNativeShell() {
  if (shellReady || !(await core())) return;
  shellReady = true;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}

/**
 * Turned on once the Android app ships with Firebase (google-services.json).
 * Registering without it would crash the app.
 */
const PUSH_READY = true;

let pushFor: string | null = null;

/** Registers this phone for push notifications of the signed-in owner. */
export async function registerPush(userId: string, labels: { channel: string; open: string }) {
  if (!PUSH_READY || pushFor === userId || !(await core())) return;
  pushFor = userId;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { supabase } = await import("@/integrations/supabase/client");

  await PushNotifications.createChannel({
    id: "bookings",
    name: labels.channel,
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => undefined);

  await PushNotifications.addListener("registration", ({ value }) => {
    void supabase
      .from("push_tokens")
      .upsert(
        {
          token: value,
          user_id: userId,
          platform: "android",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      )
      .then(({ error }) => error && console.error("[push] save token", error));
  });
  await PushNotifications.addListener("registrationError", (e) =>
    console.error("[push] registration", e),
  );
  // App open: show it inside the app instead of the system tray.
  await PushNotifications.addListener("pushNotificationReceived", (n) => {
    const id = (n.data as { appointmentId?: string } | undefined)?.appointmentId;
    void haptic("success");
    toast(n.title ?? "SYCRAS", {
      description: n.body,
      ...(id ? { action: { label: labels.open, onClick: () => requestOpenAppointment(id) } } : {}),
    });
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const id = (notification.data as { appointmentId?: string } | undefined)?.appointmentId;
    if (id) requestOpenAppointment(id);
  });

  const status = await PushNotifications.checkPermissions();
  const granted =
    status.receive === "granted" ||
    (status.receive !== "denied" &&
      (await PushNotifications.requestPermissions()).receive === "granted");
  if (granted) await PushNotifications.register();
}

/** A short vibration on the phone (confirmations, warnings). */
export async function haptic(kind: "light" | "success" | "warning" = "light") {
  if (!(await core())) return;
  const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
  if (kind === "light") await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  else
    await Haptics.notification({
      type: kind === "success" ? NotificationType.Success : NotificationType.Warning,
    }).catch(() => undefined);
}
