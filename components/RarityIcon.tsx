'use client';

// Ícone flat de cada raridade (mesmo estilo dos ícones da nav: preenchido,
// duas camadas de cor). A cor acompanha o tier de lib/rarity.ts:
//   lendário = coroa dourada, épico = gema roxa, raro = estrela azul,
//   incomum = folha verde, comum = pedra cinza.
const ICONS: Record<string, React.ReactNode> = {
  lendario: (
    <svg viewBox="0 0 24 24">
      <path
        d="M3.4 7.2 8 11.4l3.2-5.9a.9.9 0 0 1 1.6 0l3.2 5.9 4.6-4.2c.6-.5 1.5 0 1.4.8l-1.6 9.3H3.6L2 8c-.1-.8.8-1.3 1.4-.8Z"
        fill="#f59e0b"
      />
      <path d="M12 5.1a.9.9 0 0 1 .8.4l3.2 5.9 4.6-4.2c.6-.5 1.5 0 1.4.8l-1.6 9.3H12Z" fill="#d97706" />
      <path d="M3.9 18.9h16.2v1.6a1.3 1.3 0 0 1-1.3 1.3H5.2a1.3 1.3 0 0 1-1.3-1.3Z" fill="#b45309" />
      <circle cx="12" cy="14.6" r="1.5" fill="#fff7e0" />
    </svg>
  ),
  epico: (
    <svg viewBox="0 0 24 24">
      <path d="M6.6 3.4h10.8L21 8.6 12 21.4 3 8.6Z" fill="#a78bfa" />
      <path d="M12 3.4h5.4L21 8.6 12 21.4Z" fill="#8b62f0" />
      <path d="M8.4 8.6 12 21.4 15.6 8.6Z" fill="#c4b0ff" />
      <path d="M6.6 3.4 8.4 8.6h7.2l1.8-5.2Z" fill="#8b62f0" opacity="0.45" />
    </svg>
  ),
  raro: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 2.2l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.1l6.5-1Z"
        fill="#38bdf8"
      />
      <path d="M12 2.2l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3.1Z" fill="#0d9be0" />
      <path d="M12 6.2l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7Z" fill="#8fdcff" opacity="0.7" />
    </svg>
  ),
  incomum: (
    <svg viewBox="0 0 24 24">
      <path d="M20.6 3.4C10.2 3.6 4.6 9 4.1 19.9c10.9-.5 16.3-6.1 16.5-16.5Z" fill="#34d399" />
      <path d="M20.6 3.4c-.2 10.4-5.6 16-16.5 16.5C15 18 19 13.5 20.6 3.4Z" fill="#0fa571" />
      <path
        d="M6.4 17.6C9.6 13 13.4 9.4 18.4 5.6"
        fill="none"
        stroke="#d7fbe9"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  comum: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 4.2c4.9 0 8.6 3 8.6 7.4 0 4.7-3.7 8.2-8.6 8.2s-8.6-3.5-8.6-8.2c0-4.4 3.7-7.4 8.6-7.4Z"
        fill="#94a3b8"
      />
      <path d="M12 4.2c4.9 0 8.6 3 8.6 7.4 0 4.7-3.7 8.2-8.6 8.2Z" fill="#7a8a9e" />
      <ellipse cx="9" cy="9.2" rx="2.6" ry="1.8" fill="#c3cedb" transform="rotate(-18 9 9.2)" />
    </svg>
  ),
};

export default function RarityIcon({ tier, className }: { tier: string; className?: string }) {
  return (
    <span className={`rarity-icon${className ? ` ${className}` : ''}`} aria-hidden="true">
      {ICONS[tier] || ICONS.comum}
    </span>
  );
}
