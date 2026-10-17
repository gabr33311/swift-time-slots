import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  code?: string;
  businessName?: string;
}

/** The code the client types to finish a booking (when the business asks for it). */
const Email = ({ code, businessName }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>O seu código de confirmação: {code ?? ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        {businessName && <Text style={brand}>{businessName}</Text>}
        <Heading style={h1}>Confirme a sua marcação</Heading>
        <Text style={text}>Escreva este código na página de marcação para a concluir:</Text>
        <Text style={codeStyle}>{code}</Text>
        <Text style={footer}>
          O código é válido durante 10 minutos. Se não pediu esta marcação, ignore este email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) => `${d["code"] ?? ""} é o seu código de confirmação`,
  displayName: "Código de confirmação",
  previewData: { code: "482913", businessName: "Barbearia Lisboa" },
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
const codeStyle = {
  fontSize: "34px",
  fontWeight: 800,
  letterSpacing: "0.3em",
  color: "#111111",
  margin: "20px 0",
};
const footer = { fontSize: "13px", color: "#666666" };
