import { sendLovableEmail } from "@lovable.dev/email-js";

type ConfirmationInput = {
  appointmentId: string;
  to: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
};

function formatParts(startsAt: string, timezone: string) {
  const date = new Date(startsAt);
  const day = new Intl.DateTimeFormat("pt-PT", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-PT", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return { day, time };
}

/** Sends the black-and-white confirmation email for a newly confirmed appointment. */
export async function sendAppointmentConfirmationEmail(input: ConfirmationInput) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const senderDomain = process.env["EMAIL_SENDER_DOMAIN"] ?? "bookflow.pt";
  if (!apiKey) return { ok: false as const, message: "Envio de email não configurado." };

  const { day, time } = formatParts(input.startsAt, input.timezone);

  const text = [
    `Olá ${input.customerName},`,
    "",
    "A sua marcação foi confirmada.",
    "",
    `Serviço: ${input.serviceName}`,
    `Data: ${day}`,
    `Hora: ${time}`,
    "",
    input.businessName,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;border:1px solid #111111;padding:28px;">
    <p style="margin:0 0 20px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#111111;">${input.businessName}</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111111;">A sua marcação foi confirmada!</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444444;">Olá ${input.customerName}, está tudo pronto.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111111;">
      <tr><td style="padding:10px 0;border-top:1px solid #dddddd;color:#666666;">Serviço</td><td style="padding:10px 0;border-top:1px solid #dddddd;text-align:right;font-weight:700;">${input.serviceName}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid #dddddd;color:#666666;">Data</td><td style="padding:10px 0;border-top:1px solid #dddddd;text-align:right;font-weight:700;">${day}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid #dddddd;border-bottom:1px solid #dddddd;color:#666666;">Hora</td><td style="padding:10px 0;border-top:1px solid #dddddd;border-bottom:1px solid #dddddd;text-align:right;font-weight:700;">${time}</td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#777777;">Se precisar de alterar ou cancelar, responda a este email ou contacte ${input.businessName}.</p>
  </div>
</body></html>`;

  try {
    await sendLovableEmail(
      {
        to: input.to,
        from: `${input.businessName} <noreply@${senderDomain}>`,
        sender_domain: senderDomain,
        subject: "A sua marcação foi confirmada!",
        html,
        text,
        purpose: "transactional",
        idempotency_key: `appointment-confirmed-${input.appointmentId}`,
      },
      { apiKey },
    );
    return { ok: true as const };
  } catch (error) {
    console.error("[email] confirmation send failed", error);
    return { ok: false as const, message: "Não foi possível enviar o email de confirmação." };
  }
}
