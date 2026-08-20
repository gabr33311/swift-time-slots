import type { LucideIcon } from "lucide-react";
import {
  Scissors,
  Sparkle,
  Hand,
  Eye,
  Sparkles,
  Leaf,
  PenTool,
  Dumbbell,
  Camera,
  PawPrint,
  BookOpen,
  Briefcase,
  Car,
  CalendarDays,
} from "lucide-react";

export type BusinessTypeDef = {
  value: string;
  label: string;
  icon: LucideIcon;
  sampleServices: { name: string; duration: number; price: number }[];
};

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  {
    value: "barbershop",
    label: "Barbearia",
    icon: Scissors,
    sampleServices: [
      { name: "Corte", duration: 30, price: 1500 },
      { name: "Corte + Barba", duration: 45, price: 2000 },
      { name: "Barba", duration: 20, price: 1000 },
    ],
  },
  {
    value: "hair",
    label: "Cabeleireiro",
    icon: Sparkle,
    sampleServices: [
      { name: "Corte", duration: 45, price: 2000 },
      { name: "Coloração", duration: 90, price: 4500 },
      { name: "Brushing", duration: 40, price: 1800 },
    ],
  },
  {
    value: "nails",
    label: "Manicure / Nail art",
    icon: Hand,
    sampleServices: [
      { name: "Manicure", duration: 45, price: 1800 },
      { name: "Pedicure", duration: 60, price: 2200 },
      { name: "Gelinho", duration: 75, price: 2800 },
    ],
  },
  {
    value: "lashes",
    label: "Pestanas & Sobrancelhas",
    icon: Eye,
    sampleServices: [
      { name: "Extensões de pestanas", duration: 90, price: 4000 },
      { name: "Design de sobrancelhas", duration: 30, price: 1200 },
    ],
  },
  {
    value: "beauty",
    label: "Estética",
    icon: Sparkles,
    sampleServices: [
      { name: "Limpeza de pele", duration: 60, price: 3500 },
      { name: "Depilação perna inteira", duration: 45, price: 2500 },
    ],
  },
  {
    value: "massage",
    label: "Massagens",
    icon: Leaf,
    sampleServices: [
      { name: "Massagem relaxante", duration: 60, price: 4000 },
      { name: "Massagem desportiva", duration: 45, price: 3500 },
    ],
  },
  {
    value: "tattoo",
    label: "Tatuagens & Piercings",
    icon: PenTool,
    sampleServices: [
      { name: "Sessão de tatuagem", duration: 120, price: 12000 },
      { name: "Piercing", duration: 30, price: 3000 },
    ],
  },
  {
    value: "fitness",
    label: "Personal trainer",
    icon: Dumbbell,
    sampleServices: [
      { name: "Treino individual", duration: 60, price: 3000 },
      { name: "Avaliação física", duration: 45, price: 2500 },
    ],
  },
  {
    value: "photo",
    label: "Fotografia",
    icon: Camera,
    sampleServices: [
      { name: "Sessão retrato", duration: 90, price: 12000 },
      { name: "Sessão família", duration: 120, price: 18000 },
    ],
  },
  {
    value: "pets",
    label: "Pet grooming",
    icon: PawPrint,
    sampleServices: [
      { name: "Banho e tosquia", duration: 90, price: 3000 },
      { name: "Banho", duration: 45, price: 1800 },
    ],
  },
  {
    value: "tutoring",
    label: "Explicações",
    icon: BookOpen,
    sampleServices: [
      { name: "Explicação individual", duration: 60, price: 1500 },
    ],
  },
  {
    value: "consulting",
    label: "Consultoria",
    icon: Briefcase,
    sampleServices: [{ name: "Sessão de consultoria", duration: 60, price: 7500 }],
  },
  {
    value: "auto",
    label: "Oficina / Detailing",
    icon: Car,
    sampleServices: [
      { name: "Lavagem completa", duration: 90, price: 4500 },
      { name: "Polimento", duration: 180, price: 15000 },
    ],
  },
  {
    value: "other",
    label: "Outro",
    icon: CalendarDays,
    sampleServices: [{ name: "Serviço", duration: 60, price: 3000 }],
  },
];

export function businessType(value: string | null | undefined): BusinessTypeDef {
  return BUSINESS_TYPES.find((t) => t.value === value) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1]!;
}
