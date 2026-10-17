import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES, type TemplateData } from "./registry";

// Server-only: reads RESEND_API_KEY. Never import from client components.

/** Sender shown to clients. The domain must be verified in Resend. */
const DEFAULT_FROM = "SYCRAS <noreply@sycras.com>";

/** Where replies go when nobody more specific is given (every @sycras.com address is forwarded). */
export const SUPPORT_EMAIL = "suporte@sycras.com";

export type SendTemplateEmailResult = { sent: true } | { sent: false; reason: "not_configured" };

export interface SendTemplateEmailOptions {
  templateData?: TemplateData;
  /** Dedupes retries of the same logical send (Resend keeps it for 24 h). */
  idempotencyKey?: string;
  replyTo?: string;
  /** Files sent with the email (content in base64). */
  attachments?: { filename: string; content: string }[];
}

/**
 * Renders a registered template and sends it through Resend
 * (https://resend.com). Without RESEND_API_KEY nothing is sent and the
 * result says so; any other failure throws.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not configured; email not sent:", templateName);
    return { sent: false, reason: "not_configured" };
  }

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env["EMAIL_FROM"] || DEFAULT_FROM,
      to: [recipient],
      subject,
      html,
      text,
      tags: [{ name: "template", value: templateName }],
      // Replies reach a person: the business (when given) or SYCRAS support, never noreply.
      reply_to: options.replyTo || SUPPORT_EMAIL,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return { sent: true };
}
