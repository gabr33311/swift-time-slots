import React from "react";
import {
  Body,
  Button,
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
  address?: string;
  manageUrl?: string;
  brandColor?: string;
  brandText?: string;
}

const Email = ({
  name,
  businessName,
  serviceName,
  date,
  time,
  address,
  manageUrl,
  brandColor,
  brandText,
}: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>
      Lembrete: {serviceName || "marcação"} {date ? `· ${date}` : ""} {time ? `às ${time}` : ""}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {businessName && <Text style={brand}>{businessName}</Text>}
        <Heading style={h1}>Até já!</Heading>
        <Text style={text}>Olá {name || "cliente"}, lembramos que tem uma marcação em breve.</Text>
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
          {address && (
            <Text style={row}>
              <b>Local:</b> {address}
            </Text>
          )}
        </Section>
        {manageUrl && (
          <Button
            href={manageUrl}
            style={{
              ...button,
              backgroundColor: brandColor || "#0a6cf0",
              color: brandText || "#ffffff",
            }}
          >
            Ver ou cancelar marcação
          </Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>
          Se não puder comparecer, cancele com antecedência para libertar o horário.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d) =>
    `Lembrete: ${d["serviceName"] ?? "marcação"} ${d["time"] ? `às ${d["time"]}` : ""}`,
  displayName: "Lembrete de marcação",
  previewData: {
    name: "Ana",
    businessName: "Barbearia Lisboa",
    serviceName: "Corte",
    date: "sábado, 10 de outubro",
    time: "14:30",
    address: "Rua Augusta 10, Lisboa",
    manageUrl: "https://sycras.com/booking/exemplo",
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
const button = {
  display: "inline-block",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: "10px",
  padding: "12px 20px",
};
const hr = { borderColor: "#eeeeee", margin: "24px 0" };
const footer = { fontSize: "13px", color: "#666666" };
