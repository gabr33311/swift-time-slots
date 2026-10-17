// Server-only: removes an account for good. Never import from the browser.

/**
 * Deletes the signed-in person's account permanently. Businesses they own go
 * with it (bookings, clients, services, photos) and a Stripe subscription is
 * cancelled; in someone else's business they only leave the team.
 */
export async function deleteAccount(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: memberships, error } = await db
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId);
  if (error) return { ok: false, message: "Não foi possível apagar a conta. Tenta novamente." };

  const owned = (memberships ?? []).filter((m) => m.role === "owner").map((m) => m.business_id);

  for (const businessId of owned) {
    const { data: sub } = await db
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    // Paying through Google / Apple: only the store can stop it, so the person does it first.
    if (
      sub &&
      (sub.store ?? "stripe") !== "stripe" &&
      sub.store_subscription_id &&
      sub.status !== "canceled"
    ) {
      return {
        ok: false,
        message: "Cancela primeiro a subscrição na Google Play e depois apaga a conta.",
      };
    }
    if (sub?.stripe_subscription_id && sub.status !== "canceled") {
      try {
        const { stripe } = await import("@/lib/billing.server");
        await stripe().subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        console.error("[account] stripe cancel failed", e);
        return {
          ok: false,
          message: "Não foi possível cancelar a subscrição. Tenta novamente daqui a pouco.",
        };
      }
    }
  }

  for (const businessId of owned) {
    // Logo, banner and photos live in a folder named after the business.
    const { data: files } = await db.storage
      .from("business-logos")
      .list(businessId, { limit: 1000 });
    if (files?.length) {
      await db.storage.from("business-logos").remove(files.map((f) => `${businessId}/${f.name}`));
    }
    // Everything else belongs to the business and goes with it (on delete cascade).
    const { error: delErr } = await db.from("businesses").delete().eq("id", businessId);
    if (delErr) {
      console.error("[account] business delete failed", delErr);
      return { ok: false, message: "Não foi possível apagar o negócio. Tenta novamente." };
    }
  }

  await db.from("business_members").delete().eq("user_id", userId);
  await db.from("push_tokens").delete().eq("user_id", userId);
  await db.from("profiles").delete().eq("id", userId);
  const { error: userErr } = await db.auth.admin.deleteUser(userId);
  if (userErr) {
    console.error("[account] auth delete failed", userErr);
    return { ok: false, message: "Não foi possível apagar a conta. Tenta novamente." };
  }
  return { ok: true };
}
