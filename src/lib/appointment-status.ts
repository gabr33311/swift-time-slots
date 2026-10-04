import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendAppointmentConfirmedEmail } from "@/lib/confirmation-email.functions";

export type ApptStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "pending"
  | "expired";

/**
 * Updates an appointment status directly through the Data API (RLS restricts
 * this to business members) and records the change in the status history.
 * Confirming a pending appointment emails the client and shows the outcome.
 */
export async function setAppointmentStatus(input: {
  id: string;
  businessId: string;
  status: ApptStatus;
  note?: string;
}): Promise<{ ok: true; emailed?: boolean } | { ok: false; message: string }> {
  let wasPending = false;
  if (input.status === "confirmed") {
    const { data } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", input.id)
      .maybeSingle();
    wasPending = data?.status === "pending";
  }

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

  if (wasPending) {
    try {
      const res = await sendAppointmentConfirmedEmail({ data: { appointmentId: input.id } });
      if (res.status === "sent") toast.success("Marcação confirmada e email enviado!");
      else toast.error("A marcação foi confirmada, mas houve um erro ao enviar o email ao cliente.");
    } catch {
      toast.error("A marcação foi confirmada, mas houve um erro ao enviar o email ao cliente.");
    }
    return { ok: true, emailed: true };
  }

  return { ok: true };
}
