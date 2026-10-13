import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { effectiveBrand, MONO } from "@/lib/brand";

const KEY = "sycras-app-color";

/**
 * The colour of the signed-in app. It belongs to the person (saved in their
 * account), not to the business page their clients see.
 */
export function useAppColor() {
  const { user } = useAuth();
  const [local, setLocal] = useState<string | null>(null);

  // A local copy paints the right colour before the session loads.
  useEffect(() => {
    try {
      setLocal(window.localStorage.getItem(KEY));
    } catch {
      // Storage blocked: the account value still applies.
    }
  }, []);

  const saved = user?.user_metadata?.["app_color"] as string | undefined;
  const raw = local ?? saved;
  // Plain black became the black-and-white choice (black on black was unreadable).
  const color = raw === MONO || raw?.toLowerCase() === "#18181b" ? MONO : effectiveBrand(raw);

  // The account wins once it loads (another device may have changed it).
  useEffect(() => {
    if (!saved) return;
    setLocal(saved);
    try {
      window.localStorage.setItem(KEY, saved);
    } catch {
      // Ignore.
    }
  }, [saved]);

  const setColor = useCallback(async (next: string) => {
    setLocal(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Ignore.
    }
    const { error } = await supabase.auth.updateUser({ data: { app_color: next } });
    return !error;
  }, []);

  return { color, setColor };
}
