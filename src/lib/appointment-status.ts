import { supabase } from "@/integrations/supabase/client";

export type ApptStatus = "confirmed" | "completed" | "cancelled" | "no_show" | "pending";

/**
 * Updates an appointment status directly through the Data API (RLS restricts
 * this to business members) and records the change in the status history.
 */
export async function setAppointmentStatus(input: {
  id: string;
  businessId: string;
  status: ApptStatus;
  note?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("appointments")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("business_id", input.businessId);

  if (error) return { ok: false, message: error.message };

  await supabase.from("appointment_status_history").insert({
    appointment_id: input.id,
    business_id: input.businessId,
    status: input.status,
    note: input.note ?? null,
  });

  return { ok: true };
}
