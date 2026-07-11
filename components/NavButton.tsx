'use client';

import { sfxTick } from '@/lib/sound';

export const spawnRipple = (evt: React.PointerEvent<HTMLButtonElement>) => {
  sfxTick();
  const btn = evt.currentTarget;
  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${evt.clientX - rect.left - size / 2}px;top:${evt.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
};

export default function NavButton({
  label,
  active,
  wide,
  badge,
  badgeTone,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  wide?: boolean;
  badge?: string | number;
  badgeTone?: 'red' | 'tan';
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`nav-btn ui-btn${active ? ' nav-btn--active' : ''}${wide ? ' nav-btn--wide' : ''}`}
      type="button"
      onPointerDown={spawnRipple}
      onClick={onClick}
    >
      <span className="btn-icon" aria-hidden="true">
        {children}
      </span>
      <span className="btn-label">{label}</span>
      {badge !== undefined && (
        <span className={`nav-badge${badgeTone === 'red' ? ' nav-badge--red' : ''}`}>{badge}</span>
      )}
    </button>
  );
}

// Ícones flat coloridos (estilo Duolingo): preenchidos, duas camadas de cor
// por ícone (base + sombra) para leitura em fundos claros e no verde ativo.
export const ICONS = {
  home: (
    <svg viewBox="0 0 24 24">
      <path
        d="M4.4 10.6 12 4.4l7.6 6.2V20a1.6 1.6 0 0 1-1.6 1.6H6A1.6 1.6 0 0 1 4.4 20Z"
        fill="#58cc02"
      />
      <path
        d="M11.3 1.9a1.1 1.1 0 0 1 1.4 0l9.5 7.8a1.1 1.1 0 1 1-1.4 1.7L12 4.2l-8.8 7.2a1.1 1.1 0 0 1-1.4-1.7Z"
        fill="#3ca002"
      />
      <rect x="9.5" y="13.6" width="5" height="8" rx="1.1" fill="#fff" />
    </svg>
  ),
  populacao: (
    <svg viewBox="0 0 24 24">
      <circle cx="16.6" cy="8.6" r="2.9" fill="#58cc02" />
      <path
        d="M15.6 14.4c3.1 0 5.6 2.1 6 5 .1.8-.5 1.5-1.3 1.5h-4.2c.1-.5.2-1 .1-1.6-.2-1.9-1.1-3.5-2.4-4.7.5-.1 1.1-.2 1.8-.2Z"
        fill="#58cc02"
      />
      <circle cx="9" cy="7.4" r="3.7" fill="#1cb0f6" />
      <path
        d="M2.3 19.3c.5-3.3 3.3-5.5 6.7-5.5s6.2 2.2 6.7 5.5c.1.9-.6 1.7-1.5 1.7H3.8c-.9 0-1.6-.8-1.5-1.7Z"
        fill="#1cb0f6"
      />
      <circle cx="9" cy="7.4" r="3.7" fill="none" stroke="#0d8fce" strokeWidth="1.1" />
    </svg>
  ),
  citydex: (
    <svg viewBox="0 0 24 24">
      <path
        d="M12 1.7c-4.4 0-7.9 3.5-7.9 7.8 0 5.7 6.7 12 7.4 12.7a.8.8 0 0 0 1 0c.7-.7 7.4-7 7.4-12.7 0-4.3-3.5-7.8-7.9-7.8Z"
        fill="#ff4b4b"
      />
      <path
        d="M12 1.7v20.7c.2 0 .4-.1.5-.2.7-.7 7.4-7 7.4-12.7 0-4.3-3.5-7.8-7.9-7.8Z"
        fill="#dd3a3a"
      />
      <circle cx="12" cy="9.4" r="3.3" fill="#fff" />
    </svg>
  ),
  estados: (
    <svg viewBox="0 0 24 24">
      <path
        d="M8.6 2.8 3.4 5a1.2 1.2 0 0 0-.7 1.1v13.4c0 .8.9 1.4 1.7 1.1l4.2-1.8Z"
        fill="#58cc02"
      />
      <path d="M8.6 2.8l6.8 2.8v15.2l-6.8-3Z" fill="#89e219" />
      <path
        d="M15.4 5.6 20 3.7c.8-.3 1.6.3 1.6 1.1v13.4c0 .5-.3.9-.7 1.1l-5.5 2.3Z"
        fill="#58cc02"
      />
    </svg>
  ),
  conquistas: (
    <svg viewBox="0 0 24 24">
      <path
        d="M5.6 4.5H3.5c-.7 0-1.2.6-1.2 1.3.2 2.6 1.9 4.8 4.3 5.6M18.4 4.5h2.1c.7 0 1.2.6 1.2 1.3-.2 2.6-1.9 4.8-4.3 5.6"
        fill="none"
        stroke="#e6a500"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M6.3 2.6h11.4v6.5a5.7 5.7 0 0 1-11.4 0Z" fill="#ffc800" />
      <path d="M17.7 2.6H12v12.2a5.7 5.7 0 0 0 5.7-5.7Z" fill="#e6a500" />
      <path d="M10.9 14.5h2.2v3.2h-2.2Z" fill="#cf8700" />
      <path
        d="M7.9 19c0-.8.7-1.5 1.5-1.5h5.2c.8 0 1.5.7 1.5 1.5v1.4H7.9Z"
        fill="#cf8700"
      />
      <rect x="6.7" y="20.2" width="10.6" height="1.9" rx=".9" fill="#a56b00" />
      <path
        d="M9 4.6c-.3 1.4-.2 2.7.2 3.9"
        fill="none"
        stroke="#ffe27a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  desafio: (
    <svg viewBox="0 0 24 24">
      <path
        d="M3.2 9.8h17.6V19a2.6 2.6 0 0 1-2.6 2.6H5.8A2.6 2.6 0 0 1 3.2 19Z"
        fill="#fff"
      />
      <path
        d="M5.8 4.4h12.4a2.6 2.6 0 0 1 2.6 2.6v2.8H3.2V7a2.6 2.6 0 0 1 2.6-2.6Z"
        fill="#ff4b4b"
      />
      <rect x="3.2" y="4.4" width="17.6" height="17.2" rx="2.6" fill="none" stroke="#d8cba5" strokeWidth="1.2" />
      <rect x="6.6" y="2" width="2.5" height="4.6" rx="1.2" fill="#dd3a3a" />
      <rect x="14.9" y="2" width="2.5" height="4.6" rx="1.2" fill="#dd3a3a" />
      <rect x="6.6" y="12.4" width="3" height="3" rx=".8" fill="#ffd9d9" />
      <rect x="10.5" y="12.4" width="3" height="3" rx=".8" fill="#ff4b4b" />
      <rect x="14.4" y="12.4" width="3" height="3" rx=".8" fill="#ffd9d9" />
      <rect x="6.6" y="16.4" width="3" height="3" rx=".8" fill="#ffd9d9" />
      <rect x="10.5" y="16.4" width="3" height="3" rx=".8" fill="#ffd9d9" />
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 24 24">
      <path d="M2.6 13.6h5.8V21H2.6Z" fill="#c7d0d8" />
      <path d="M2.6 13.6h5.8v1.8H2.6Z" fill="#aab5bf" />
      <path d="M15.6 15.6h5.8V21h-5.8Z" fill="#d7873c" />
      <path d="M15.6 15.6h5.8v1.8h-5.8Z" fill="#b56a24" />
      <path d="M9 9.8h6V21H9Z" fill="#ffc800" />
      <path d="M9 9.8h6v1.9H9Z" fill="#e6a500" />
      <path
        d="M12 1.6l1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4Z"
        fill="#ffc800"
        stroke="#e6a500"
        strokeWidth=".8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  configuracoes: (
    <svg viewBox="0 0 24 24">
      <g fill="#8f99a3">
        <rect x="10.6" y="1.4" width="2.8" height="21.2" rx="1.3" />
        <rect x="10.6" y="1.4" width="2.8" height="21.2" rx="1.3" transform="rotate(45 12 12)" />
        <rect x="10.6" y="1.4" width="2.8" height="21.2" rx="1.3" transform="rotate(90 12 12)" />
        <rect x="10.6" y="1.4" width="2.8" height="21.2" rx="1.3" transform="rotate(135 12 12)" />
      </g>
      <circle cx="12" cy="12" r="6.4" fill="#8f99a3" />
      <path d="M12 5.6a6.4 6.4 0 0 1 0 12.8Z" fill="#7b858f" />
      <circle cx="12" cy="12" r="2.7" fill="#fff" />
    </svg>
  ),
};
