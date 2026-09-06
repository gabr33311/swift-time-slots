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
  /** i18n key — render with t() */
  label: string;
  icon: LucideIcon;
  /** sample service `name` is an i18n key — render with t() */
  sampleServices: { name: string; duration: number; price: number }[];
};

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  {
    value: "barbershop",
    label: "biz.type.barbershop",
    icon: Scissors,
    sampleServices: [
      { name: "biz.svc.cut", duration: 30, price: 1500 },
      { name: "biz.svc.cutBeard", duration: 45, price: 2000 },
      { name: "biz.svc.beard", duration: 20, price: 1000 },
    ],
  },
  {
    value: "hair",
    label: "biz.type.hair",
    icon: Sparkle,
    sampleServices: [
      { name: "biz.svc.cut", duration: 45, price: 2000 },
      { name: "biz.svc.color", duration: 90, price: 4500 },
      { name: "biz.svc.blowdry", duration: 40, price: 1800 },
    ],
  },
  {
    value: "nails",
    label: "biz.type.nails",
    icon: Hand,
    sampleServices: [
      { name: "biz.svc.manicure", duration: 45, price: 1800 },
      { name: "biz.svc.pedicure", duration: 60, price: 2200 },
      { name: "biz.svc.gel", duration: 75, price: 2800 },
    ],
  },
  {
    value: "lashes",
    label: "biz.type.lashes",
    icon: Eye,
    sampleServices: [
      { name: "biz.svc.lashExt", duration: 90, price: 4000 },
      { name: "biz.svc.browDesign", duration: 30, price: 1200 },
    ],
  },
  {
    value: "beauty",
    label: "biz.type.beauty",
    icon: Sparkles,
    sampleServices: [
      { name: "biz.svc.facial", duration: 60, price: 3500 },
      { name: "biz.svc.waxLegs", duration: 45, price: 2500 },
    ],
  },
  {
    value: "massage",
    label: "biz.type.massage",
    icon: Leaf,
    sampleServices: [
      { name: "biz.svc.relaxMassage", duration: 60, price: 4000 },
      { name: "biz.svc.sportsMassage", duration: 45, price: 3500 },
    ],
  },
  {
    value: "tattoo",
    label: "biz.type.tattoo",
    icon: PenTool,
    sampleServices: [
      { name: "biz.svc.tattooSession", duration: 120, price: 12000 },
      { name: "biz.svc.piercing", duration: 30, price: 3000 },
    ],
  },
  {
    value: "fitness",
    label: "biz.type.fitness",
    icon: Dumbbell,
    sampleServices: [
      { name: "biz.svc.pt", duration: 60, price: 3000 },
      { name: "biz.svc.assessment", duration: 45, price: 2500 },
    ],
  },
  {
    value: "photo",
    label: "biz.type.photo",
    icon: Camera,
    sampleServices: [
      { name: "biz.svc.portrait", duration: 90, price: 12000 },
      { name: "biz.svc.family", duration: 120, price: 18000 },
    ],
  },
  {
    value: "pets",
    label: "biz.type.pets",
    icon: PawPrint,
    sampleServices: [
      { name: "biz.svc.bathGroom", duration: 90, price: 3000 },
      { name: "biz.svc.bath", duration: 45, price: 1800 },
    ],
  },
  {
    value: "tutoring",
    label: "biz.type.tutoring",
    icon: BookOpen,
    sampleServices: [{ name: "biz.svc.lesson", duration: 60, price: 1500 }],
  },
  {
    value: "consulting",
    label: "biz.type.consulting",
    icon: Briefcase,
    sampleServices: [{ name: "biz.svc.consultation", duration: 60, price: 7500 }],
  },
  {
    value: "auto",
    label: "biz.type.auto",
    icon: Car,
    sampleServices: [
      { name: "biz.svc.fullWash", duration: 90, price: 4500 },
      { name: "biz.svc.polish", duration: 180, price: 15000 },
    ],
  },
  {
    value: "other",
    label: "biz.type.other",
    icon: CalendarDays,
    sampleServices: [{ name: "biz.svc.generic", duration: 60, price: 3000 }],
  },
];

export function businessType(value: string | null | undefined): BusinessTypeDef {
  return BUSINESS_TYPES.find((t) => t.value === value) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1]!;
}
