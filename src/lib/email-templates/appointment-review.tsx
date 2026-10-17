import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  businessName?: string;
  serviceName?: string;
  reviewUrl?: string;
  brandColor?: string;
  brandText?: string;
}

/** The day after a visit: a thank-you and the business's review link. */
const Email = ({ name, businessName, serviceName, reviewUrl, brandColor, brandText }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Como correu a sua visita{businessName ? ` a ${businessName}` : ""}?</Preview>
    <Body style={main}>
      <Container style={container}>
        {businessName && <Text style={brand}>{businessName}</Text>}
        <Heading style={h1}>Como correu?</Heading>
        <Text style={text}>
          Olá {name || "cliente"}, obrigado pela sua visita
          {serviceName ? ` (${serviceName})` : ""}. Se gostou, uma avaliação ajuda muito o nosso
          negócio. Demora menos de um minuto.
        </Text>
        {reviewUrl && (
          <Button
            href={reviewUrl}
            style={{
              ...button,
              backgroundColor: brandColor || "#0a6cf0",
              color: brandText || "#ffffff",
            }}
          >
            Deixar avaliação
          </Button>
        )}
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) => `Como correu a sua visita${d["businessName"] ? ` a ${d["businessName"]}` : ""}?`,
  displayName: "Pedido de avaliação",
  previewData: {
    name: "Ana",
    businessName: "Barbearia Lisboa",
    serviceName: "Corte",
    reviewUrl: "https://g.page/r/exemplo/review",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "32px 24px", maxWidth: "520px" };
const brand = {
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#666666",
  margin: "0 0 8px",
};
const h1 = { fontSize: "24px", fontWeight: 800, color: "#111111", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "22px", color: "#111111" };
const button = {
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: "10px",
  padding: "12px 20px",
  marginTop: "8px",
};
