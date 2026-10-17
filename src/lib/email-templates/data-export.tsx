import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
}

/** The owner asked for a copy of their data: it goes attached to this email. */
const Email = ({ name }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>A cópia dos teus dados da SYCRAS</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>SYCRAS</Text>
        <Heading style={h1}>Os teus dados</Heading>
        <Text style={text}>
          Olá{name ? ` ${name}` : ""}, em anexo está a cópia dos teus dados da SYCRAS: conta,
          negócio, serviços, equipa, horários, clientes e marcações, num ficheiro JSON.
        </Text>
        <Text style={footer}>
          Se não pediste esta cópia, responde a este email para falarmos contigo.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A cópia dos teus dados da SYCRAS",
  displayName: "Exportação de dados",
  previewData: { name: "Gabriel" },
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
const footer = { fontSize: "13px", color: "#666666", marginTop: "24px" };
