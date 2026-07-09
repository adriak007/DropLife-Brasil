'use client';

// Ícone de raridade: a mesma medalha com fita do painel Meu Citydex
// (fita em V atrás + círculo com estrela branca), mudando só a cor
// conforme o tier de lib/rarity.ts.
const MEDAL_COLORS: Record<string, { color: string; dark: string }> = {
  lendario: { color: '#f59e0b', dark: '#b45309' },
  epico: { color: '#a78bfa', dark: '#7c5cd6' },
  raro: { color: '#38bdf8', dark: '#0d8fce' },
  incomum: { color: '#34d399', dark: '#0fa571' },
  comum: { color: '#94a3b8', dark: '#64748b' },
};

export default function RarityIcon({ tier, className }: { tier: string; className?: string }) {
  const { color, dark } = MEDAL_COLORS[tier] || MEDAL_COLORS.comum;
  return (
    <span className={`rarity-icon${className ? ` ${className}` : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M7 1.4h4.4l-2.7 7.8-4.3-1Z" fill={dark} />
        <path d="M17 1.4h-4.4l2.7 7.8 4.3-1Z" fill={color} />
        <circle cx="12" cy="14.8" r="6.5" fill={color} />
        <circle cx="12" cy="14.8" r="6.5" fill="none" stroke={dark} strokeWidth="1.5" />
        <path
          d="M12 11.3l1.1 2.2 2.4.35-1.75 1.7.4 2.4L12 16.8l-2.15 1.15.4-2.4-1.75-1.7 2.4-.35Z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}
