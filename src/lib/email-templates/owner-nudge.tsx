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
  businessName?: string;
  pageUrl?: string;
}

/** Day 3 with no booking yet: three small steps that usually bring the first one. */
const Email = ({ businessName, pageUrl }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Três passos para receberes a primeira marcação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>SYCRAS</Text>
        <Heading style={h1}>A primeira marcação está perto</Heading>
        <Text style={text}>
          A página {businessName ? `de ${businessName} ` : ""}já está pronta. Estes três passos
          costumam trazer a primeira marcação em poucos dias:
        </Text>
        <Text style={step}>
          <b>1.</b> Põe o link na bio do Instagram e no perfil do Google.
        </Text>
        <Text style={step}>
          <b>2.</b> Envia-o por WhatsApp aos clientes habituais: «Agora já podes marcar aqui.»
        </Text>
        <Text style={step}>
          <b>3.</b> Faz tu uma marcação de teste, para veres o que o cliente vê.
        </Text>
        {pageUrl && (
          <Button href={pageUrl} style={button}>
            Abrir a minha página
          </Button>
        )}
        <Text style={footer}>Alguma dúvida? Responde a este email.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Três passos para a primeira marcação",
  displayName: "Ajuda: ainda sem marcações",
  previewData: { businessName: "Barbearia Lisboa", pageUrl: "https://sycras.com/exemplo" },
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
const step = { fontSize: "15px", lineHeight: "22px", color: "#111111", margin: "6px 0" };
const button = {
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: "10px",
  padding: "12px 20px",
  marginTop: "16px",
  backgroundColor: "#0a6cf0",
  color: "#ffffff",
};
const footer = { fontSize: "13px", color: "#666666", marginTop: "24px" };
