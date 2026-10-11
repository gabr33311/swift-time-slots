import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  businessName?: string;
  serviceName?: string;
  date?: string;
  time?: string;
}

const Email = ({ name, businessName, serviceName, date, time }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>A sua marcação foi confirmada</Preview>
    <Body style={main}>
      <Container style={container}>
        {businessName && <Text style={brand}>{businessName}</Text>}
        <Heading style={h1}>Marcação confirmada</Heading>
        <Text style={text}>Olá {name || "cliente"}, a sua marcação está confirmada.</Text>
        <Section style={box}>
          <Text style={row}>
            <b>Serviço:</b> {serviceName || "—"}
          </Text>
          <Text style={row}>
            <b>Data:</b> {date || "—"}
          </Text>
          <Text style={row}>
            <b>Hora:</b> {time || "—"}
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Caso necessite de alterar ou cancelar, por favor contacte-nos.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "A sua marcação foi confirmada!",
  displayName: "Marcação confirmada",
  previewData: {
    name: "Ana",
    businessName: "Barbearia Lisboa",
    serviceName: "Corte",
    date: "sábado, 10 de outubro",
    time: "14:30",
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
const box = {
  border: "1px solid #e5e5e5",
  borderRadius: "10px",
  padding: "12px 16px",
  margin: "16px 0",
};
const row = { fontSize: "15px", color: "#111111", margin: "4px 0" };
const hr = { borderColor: "#eeeeee", margin: "24px 0" };
const footer = { fontSize: "13px", color: "#666666" };
