import { CardColorTheme, HabitColor } from '../types';

export const CARD_THEME_STYLES: Record<
  CardColorTheme,
  { bg: string; text: string; muted: string; border: string; dot: string }
> = {
  indigo: {
    bg: 'bg-[#5E4AE3]',
    text: 'text-white',
    muted: 'text-white/80',
    border: 'border-[#4D39D2]',
    dot: 'bg-[#5E4AE3]',
  },
  yellow: {
    bg: 'bg-[#FBC74A]',
    text: 'text-[#161618]',
    muted: 'text-[#161618]/75',
    border: 'border-[#EAB334]',
    dot: 'bg-[#FBC74A]',
  },
  lime: {
    bg: 'bg-[#C4E46C]',
    text: 'text-[#161618]',
    muted: 'text-[#161618]/75',
    border: 'border-[#B2D554]',
    dot: 'bg-[#C4E46C]',
  },
  lavender: {
    bg: 'bg-[#E5D9FF]',
    text: 'text-[#161618]',
    muted: 'text-[#161618]/75',
    border: 'border-[#D2BFFF]',
    dot: 'bg-[#C8B2FF]',
  },
  coral: {
    bg: 'bg-[#D94F48]',
    text: 'text-white',
    muted: 'text-white/85',
    border: 'border-[#C43E37]',
    dot: 'bg-[#D94F48]',
  },
  sky: {
    bg: 'bg-[#A2E3FF]',
    text: 'text-[#161618]',
    muted: 'text-[#161618]/75',
    border: 'border-[#84D5FA]',
    dot: 'bg-[#A2E3FF]',
  },
  pink: {
    bg: 'bg-[#FFC7E8]',
    text: 'text-[#161618]',
    muted: 'text-[#161618]/75',
    border: 'border-[#F7A8D7]',
    dot: 'bg-[#FF77C8]',
  },
};

export const HABIT_COLOR_STYLES: Record<
  HabitColor,
  { label: string; bar: string; soft: string; dot: string; text: string }
> = {
  sky: {
    label: 'Azul Céu',
    bar: 'bg-[#8FD8FA]',
    soft: 'bg-[#E5F6FF]',
    dot: 'bg-[#5AC8FA]',
    text: 'text-[#0C4A6E]',
  },
  pink: {
    label: 'Rosa Chiclete',
    bar: 'bg-[#FF77C8]',
    soft: 'bg-[#FFEAF6]',
    dot: 'bg-[#FF55BA]',
    text: 'text-[#831843]',
  },
  lime: {
    label: 'Verde Lima',
    bar: 'bg-[#B7F272]',
    soft: 'bg-[#EEFCE0]',
    dot: 'bg-[#94E244]',
    text: 'text-[#365314]',
  },
  yellow: {
    label: 'Amarelo Sol',
    bar: 'bg-[#FBC74A]',
    soft: 'bg-[#FFF5DA]',
    dot: 'bg-[#F5B727]',
    text: 'text-[#78350F]',
  },
  lavender: {
    label: 'Lilás Suave',
    bar: 'bg-[#C9B3FF]',
    soft: 'bg-[#F2ECFF]',
    dot: 'bg-[#A88BFF]',
    text: 'text-[#4C1D95]',
  },
};
