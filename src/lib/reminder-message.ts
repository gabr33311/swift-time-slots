/** Suggested reminder text; the business can rewrite it. */
export const DEFAULT_REMINDER_MESSAGE =
  "Olá {nome}, lembramos que tem {serviço} marcado para {data} às {hora}. Até já!";

/** Words the business can use in its message, replaced for each client. */
export const REMINDER_VARIABLES = ["{nome}", "{serviço}", "{data}", "{hora}", "{negócio}"] as const;

export type ReminderValues = {
  nome?: string | undefined;
  serviço?: string | undefined;
  data?: string | undefined;
  hora?: string | undefined;
  negócio?: string | undefined;
};

/** Fills the variables in a message (unknown ones are left as typed). */
export function renderReminderMessage(
  message: string | null | undefined,
  v: ReminderValues,
): string {
  const text = message?.trim() || DEFAULT_REMINDER_MESSAGE;
  return text.replace(
    /\{(nome|serviço|servico|data|hora|negócio|negocio)\}/gi,
    (_, key: string) => {
      const k = key.toLowerCase().replace("servico", "serviço").replace("negocio", "negócio");
      return v[k as keyof ReminderValues] ?? "";
    },
  );
}
