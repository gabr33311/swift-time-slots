import type { CapacitorConfig } from "@capacitor/cli";

// The native app shows the live site (always up to date) inside a real Android
// app: edge-to-edge with transparent system bars, splash screen and, later,
// push notifications. native/www is only the offline fallback page.
const config: CapacitorConfig = {
  appId: "com.sycras.app",
  appName: "SYCRAS",
  webDir: "native/www",
  server: {
    url: "https://sycras.com/today",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#f4f7fb",
  },
  plugins: {
    SystemBars: {
      // Transparent bars; the page gets --safe-area-inset-* to keep clear of them.
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    SplashScreen: {
      // Hidden by the app once the page has loaded (no white flash); 4 s safety net.
      launchAutoHide: true,
      launchShowDuration: 4000,
      backgroundColor: "#0a6cf0",
      showSpinner: false,
    },
  },
};

export default config;
