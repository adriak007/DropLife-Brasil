'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PanelKind } from '@/lib/types';
import type { AuthState } from '@/lib/online';
import { formatPop } from '@/lib/text';
import NavButton, { ICONS } from '@/components/NavButton';

const LOGO_FULL = '/Img/logo-nav.png';
const LOGO_ICON = '/Img/Icon-Logo.png';

interface Props {
  auth: AuthState;
  onlineEnabled: boolean;
  panel: PanelKind;
  heatmap: boolean;
  dailyDone: boolean;
  citydexCount: number;
  citydexTotal: number;
  achCount: number;
  achTotal: number;
  onNavigate: (panel: PanelKind) => void;
  onToggleHeatmap: () => void;
  onDaily: () => void;
  onSignOut: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: string;
  badgeTone?: 'red' | 'tan';
  onClick: () => void;
}

export default function TopNav({
  auth,
  onlineEnabled,
  panel,
  heatmap,
  dailyDone,
  citydexCount,
  citydexTotal,
  achCount,
  achTotal,
  onNavigate,
  onToggleHeatmap,
  onDaily,
  onSignOut,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const chipGhostRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);

  // Citydex antes de Populacao: em telas bem estreitas, quando só cabe 1-2
  // itens além do Home, o Citydex é o mais importante pra aparecer primeiro.
  const items: NavItem[] = [
    { key: 'home', label: 'Home', icon: ICONS.home, active: !panel, onClick: () => onNavigate(null) },
    {
      key: 'citydex',
      label: 'Citydex',
      icon: ICONS.citydex,
      active: panel === 'citydex',
      badge: `${citydexCount}/${formatPop(citydexTotal)}`,
      badgeTone: 'red',
      onClick: () => onNavigate('citydex'),
    },
    { key: 'populacao', label: 'Populacao', icon: ICONS.populacao, active: heatmap, onClick: onToggleHeatmap },
    { key: 'estados', label: 'Estados', icon: ICONS.estados, active: panel === 'estados', onClick: () => onNavigate('estados') },
    {
      key: 'conquistas',
      label: 'Conquistas',
      icon: ICONS.conquistas,
      active: panel === 'conquistas',
      badge: `${achCount}/${achTotal}`,
      onClick: () => onNavigate('conquistas'),
    },
    { key: 'desafio', label: dailyDone ? 'Desafio ✓' : 'Desafio', icon: ICONS.desafio, onClick: onDaily },
    { key: 'ranking', label: 'Ranking', icon: ICONS.ranking, active: panel === 'ranking', onClick: () => onNavigate('ranking') },
    {
      key: 'compartilhar',
      label: 'Compartilhar',
      icon: ICONS.compartilhar,
      active: panel === 'compartilhar',
      onClick: () => onNavigate('compartilhar'),
    },
    { key: 'feedback', label: 'Feedback', icon: ICONS.feedback, active: panel === 'feedback', onClick: () => onNavigate('feedback') },
    {
      key: 'config',
      label: 'Config',
      icon: ICONS.configuracoes,
      active: panel === 'configuracoes',
      onClick: () => onNavigate('configuracoes'),
    },
  ];

  const [visibleCount, setVisibleCount] = useState(items.length);
  // Em telas bem estreitas (Mobile S, ~320px) o chip de login/nome sozinho
  // já ocupava boa parte da faixa — quando não sobra espaço pra ele depois
  // dos ícones de navegação, ele migra pra dentro do menu hambúrguer.
  const [chipInline, setChipInline] = useState(true);

  // Priority+: a régua fantasma (cópia invisível de todos os botões) dá a
  // largura real de cada item; contamos quantos cabem na faixa disponível e
  // o resto vai para o menu hambúrguer. O chip de perfil entra por último
  // nessa conta — ícones de navegação têm prioridade sobre ele. Reobserva
  // resize da faixa E das réguas (badges/nome mudam de largura no jogo).
  const recompute = () => {
    const navEl = navRef.current;
    const brandEl = brandRef.current;
    const ghost = ghostRef.current;
    if (!navEl || !brandEl || !ghost) return;
    const widths = Array.from(ghost.children).map((c) => (c as HTMLElement).offsetWidth);
    const GAP = 4;
    const HAMBURGER = 40 + GAP;
    const chipWidth = onlineEnabled ? (chipGhostRef.current?.offsetWidth ?? 0) : 0;

    // O espaço precisa ser medido a partir da NAV, não da faixa de ícones.
    // A faixa é flex:1 — ela encolhe quando o chip está nela e cresce quando
    // o chip sai. Medir por ela fazia a decisão depender do próprio
    // resultado: chip entra -> espaço diminui -> chip sai -> espaço aumenta
    // -> chip entra... laço infinito de render (tela branca entre ~1150 e
    // 1200px). Estes valores aqui não dependem do estado atual.
    const est = getComputedStyle(navEl);
    const padding = (parseFloat(est.paddingLeft) || 0) + (parseFloat(est.paddingRight) || 0);
    const gapNav = parseFloat(est.columnGap) || parseFloat(est.gap) || 0;
    const espaco = navEl.clientWidth - padding - brandEl.offsetWidth - gapNav * 2;

    const somaItens = widths.reduce((s, w, i) => s + w + (i > 0 ? GAP : 0), 0);

    // 1) tudo cabe junto com o chip: nem precisa de hambúrguer
    if (somaItens + chipWidth <= espaco) {
      setVisibleCount(widths.length);
      setChipInline(true);
      return;
    }

    // 2) com hambúrguer: quantos ícones cabem, com e sem o chip na faixa
    const cabem = (disponivel: number) => {
      let usado = HAMBURGER;
      let n = 0;
      for (let i = 0; i < widths.length; i++) {
        usado += widths[i] + (i > 0 ? GAP : 0);
        if (usado <= disponivel) n = i + 1;
        else break;
      }
      return n;
    };
    const comChip = cabem(espaco - chipWidth);
    const semChip = cabem(espaco);

    // Ícone tem prioridade sobre o chip: se tirar o chip da faixa faz caber
    // mais ícone, ele migra para dentro do hambúrguer (era o pedido original
    // para telas estreitas). Ambos os números vêm do MESMO espaço fixo, então
    // a decisão é determinística e não oscila.
    if (onlineEnabled && semChip > comChip) {
      setVisibleCount(semChip);
      setChipInline(false);
    } else {
      setVisibleCount(comChip);
      setChipInline(true);
    }
  };

  useLayoutEffect(recompute);

  useEffect(() => {
    // Observa a NAV (largura estável) e a régua fantasma (os badges mudam de
    // tamanho durante o jogo). Observar a faixa de ícones realimentaria a
    // medição com o próprio resultado.
    const ro = new ResizeObserver(recompute);
    if (navRef.current) ro.observe(navRef.current);
    if (ghostRef.current) ro.observe(ghostRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    const handler = (evt: MouseEvent) => {
      const t = evt.target as Node;
      if (menuOpen && !chipRef.current?.contains(t)) setMenuOpen(false);
      if (moreOpen && !moreRef.current?.contains(t)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [menuOpen, moreOpen]);

  const overflowItems = items.slice(visibleCount);
  const showHamburger = overflowItems.length > 0 || (onlineEnabled && !chipInline);

  const renderItem = (it: NavItem, closeMore: boolean) => (
    <NavButton
      key={it.key}
      label={it.label}
      active={it.active}
      badge={it.badge}
      badgeTone={it.badgeTone}
      onClick={() => {
        if (closeMore) setMoreOpen(false);
        it.onClick();
      }}
    >
      {it.icon}
    </NavButton>
  );

  // Conteúdo do chip de perfil (login / finalizar perfil / avatar+menu) —
  // uma única fonte, reusada tanto na faixa principal quanto dentro do
  // hambúrguer, pra nunca duplicar a lógica dos 3 estados de auth.
  const profileChipContent = (
    <>
      {auth.signedIn && auth.profile ? (
        <>
          <button className="profile-chip__btn" type="button" onClick={() => setMenuOpen((v) => !v)}>
            <span className="profile-chip__avatar">{auth.profile.nickname.charAt(0).toUpperCase()}</span>
            <span className="profile-chip__name">{auth.profile.nickname}</span>
          </button>
          {menuOpen && (
            <div className="profile-chip__menu">
              <div className="profile-chip__stat">
                {formatPop(auth.profile.total_births)}{' '}
                {auth.profile.total_births === 1 ? 'cidade' : 'cidades'} no ranking
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setMoreOpen(false);
                  onNavigate('ranking');
                }}
              >
                🌍 Ver ranking
              </button>
              <button
                className="profile-chip__signout"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setMoreOpen(false);
                  onSignOut();
                }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </>
      ) : auth.signedIn ? (
        <button
          className="profile-chip__btn profile-chip__btn--pending"
          type="button"
          onClick={() => {
            setMoreOpen(false);
            onNavigate('ranking');
          }}
        >
          Finalizar perfil
        </button>
      ) : (
        <button
          className="profile-chip__btn profile-chip__btn--login"
          type="button"
          onClick={() => {
            setMoreOpen(false);
            onNavigate('ranking');
          }}
        >
          Entrar
        </button>
      )}
    </>
  );

  return (
    <nav className="top-nav" aria-label="Menu principal" ref={navRef}>
      <div className="top-nav__brand" ref={brandRef}>
        <img src={LOGO_FULL} alt="DropLife logo" className="top-nav__logo-full" />
        <img src={LOGO_ICON} alt="DropLife logo" className="top-nav__logo-icon" />
      </div>

      <div className="top-nav__items" ref={itemsRef}>
        {items.slice(0, visibleCount).map((it) => renderItem(it, false))}
        {showHamburger && (
          <div className="top-nav__more" ref={moreRef}>
            <button
              className="hamburger-btn"
              type="button"
              aria-label="Mais opções"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            {moreOpen && (
              <div className="top-nav__overflow">
                {onlineEnabled && !chipInline && (
                  <>
                    <div className="top-nav__overflow-chip" ref={chipRef}>
                      {profileChipContent}
                    </div>
                    <div className="top-nav__overflow-divider" />
                  </>
                )}
                {overflowItems.map((it) => renderItem(it, true))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Réguas fantasma: cópias invisíveis só para medir larguras reais */}
      <div className="top-nav__ghost" ref={ghostRef} aria-hidden="true">
        {items.map((it) => (
          <NavButton key={it.key} label={it.label} active={it.active} badge={it.badge} badgeTone={it.badgeTone}>
            {it.icon}
          </NavButton>
        ))}
      </div>
      {onlineEnabled && (
        <div className="top-nav__ghost" ref={chipGhostRef} aria-hidden="true">
          {/* wrapper proprio (nao reusa a classe .profile-chip no MESMO nó):
              essa classe define position:relative mais adiante no CSS e
              sobrescreveria o position:absolute do ghost, vazando largura
              de layout pra faixa de navegacao de verdade */}
          <div className="profile-chip">{profileChipContent}</div>
        </div>
      )}

      {onlineEnabled && chipInline && (
        <div className="profile-chip" ref={chipRef}>
          {profileChipContent}
        </div>
      )}
    </nav>
  );
}
