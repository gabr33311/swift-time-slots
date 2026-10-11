// Server-only: push notifications to the business's phones through Firebase
// Cloud Messaging (HTTP v1). Never import from the browser.

type ServiceAccount = { client_email: string; private_key: string; project_id: string };
type Push = { title: string; body: string; appointmentId?: string | null };

let cachedToken: { value: string; expires: number } | null = null;

function account(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

const b64url = (data: ArrayBuffer | string) =>
  Buffer.from(typeof data === "string" ? data : new Uint8Array(data))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

/** OAuth token for FCM, from the service account (cached ~55 minutes). */
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/**
 * Sends a push to every phone of every member of the business. Never throws.
 * Returns how many phones it reached (-1 when push is not configured).
 */
export async function pushToBusiness(businessId: string, push: Push): Promise<number> {
  const sa = account();
  if (!sa) return -1;
  let sent = 0;
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: members } = await db
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (!userIds.length) return 0;
    const { data: tokens } = await db.from("push_tokens").select("token").in("user_id", userIds);
    if (!tokens?.length) return 0;

    const auth = await accessToken(sa);
    await Promise.all(
      tokens.map(async ({ token }) => {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: push.title, body: push.body },
                data: push.appointmentId ? { appointmentId: push.appointmentId } : {},
                android: {
                  priority: "high",
                  notification: { channel_id: "bookings", color: "#0a6cf0", sound: "default" },
                },
              },
            }),
          },
        );
        if (res.ok) sent++;
        // Uninstalled app or expired token: forget it.
        if (res.status === 404 || res.status === 400) {
          const text = await res.text();
          if (/UNREGISTERED|INVALID_ARGUMENT|registration-token/i.test(text)) {
            await db.from("push_tokens").delete().eq("token", token);
          } else console.error("[push] send failed", res.status, text);
        } else if (!res.ok) console.error("[push] send failed", res.status, await res.text());
      }),
    );
  } catch (e) {
    console.error("[push] failed", e);
  }
  return sent;
}
