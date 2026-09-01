import type { Lang } from "../prefs-types";

export const onboardingDict: Record<Lang, Record<string, string>> = {
  pt: {
    "onb.step.of": (n: number, total: number) => `Passo ${n} de ${total}`,
  } as unknown as Record<string, string>,
  en: {},
};
