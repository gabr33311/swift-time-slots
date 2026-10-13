import { createFileRoute } from "@tanstack/react-router";

// The phone app moved an appointment to a new time: email the client the new
// day and hour. The Supabase session token proves it is the business.
export const Route = createFileRoute("/api/appointments/moved")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ sent: false }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user) return Response.json({ sent: false }, { status: 401 });

        let appointmentId = "";
        try {
          appointmentId = String(
            ((await request.json()) as { appointmentId?: unknown }).appointmentId ?? "",
          );
        } catch {
          // Checked below.
        }
        const { data: appt } = await supabaseAdmin
          .from("appointments")
          .select("business_id")
          .eq("id", appointmentId)
          .maybeSingle();
        if (!appt) return Response.json({ sent: false });
        const { data: member } = await supabaseAdmin
          .from("business_members")
          .select("user_id")
          .eq("business_id", appt.business_id)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (!member) return Response.json({ sent: false }, { status: 403 });

        const { sendConfirmedEmail } = await import("@/lib/confirmation-email.server");
        return Response.json({ sent: await sendConfirmedEmail(appointmentId, { changed: true }) });
      },
    },
  },
});
