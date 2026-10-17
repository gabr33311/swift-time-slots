import { useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/format";

const KEY = "sycras-hide-money";
const listeners = new Set<() => void>();
/** Fallback when the browser blocks storage. */
let memory = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memory;
  }
}

/** Hide the amounts of money (Today, Statistics), e.g. with a client looking at the screen. Saved on this device. */
export function useMoneyHidden(): [boolean, (hidden: boolean) => void] {
  const hidden = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
  const set = (v: boolean) => {
    memory = v;
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // Storage blocked: kept in memory until the page reloads.
    }
    listeners.forEach((l) => l());
  };
  return [hidden, set];
}

/** What is shown instead of an amount while hidden. */
export const HIDDEN_MONEY = "••••";

/** formatPrice that respects "hide amounts" (earnings and what clients paid; not the price list). */
export function useMoney(): (cents: number, currency?: string) => string {
  const [hidden] = useMoneyHidden();
  return (cents, currency) => (hidden ? HIDDEN_MONEY : formatPrice(cents, currency));
}
