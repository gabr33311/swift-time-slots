import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  total?: string;
  /** One line per error: "12× Cannot read property… (screen)". */
  lines?: string;
}

/** Monday morning: what went wrong in the phone app last week (internal, to the SYCRAS team). */
const Email = ({ total, lines }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Erros da app na última semana: {total ?? "0"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Erros da app: {total ?? "0"} na última semana</Heading>
        {(lines ?? "").split("\n").map((l, i) => (
          <Text key={i} style={row}>
            {l}
          </Text>
        ))}
        <Text style={footer}>Detalhes completos: Supabase → Table Editor → app_errors.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) => `SYCRAS: ${d["total"] ?? "0"} erros da app na última semana`,
  displayName: "Resumo semanal de erros",
  previewData: {
    total: "3",
    lines: "2× Network request failed (global)\n1× undefined is not an object (screen)",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "32px 24px", maxWidth: "600px" };
const h1 = { fontSize: "20px", fontWeight: 800, color: "#111111", margin: "0 0 16px" };
const row = {
  fontSize: "13px",
  lineHeight: "18px",
  color: "#111111",
  margin: "4px 0",
  fontFamily: "monospace",
};
const footer = { fontSize: "13px", color: "#666666", marginTop: "24px" };
