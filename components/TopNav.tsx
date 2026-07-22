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

  const items: NavItem[] = [
    { key: 'home', label: 'Home', icon: ICONS.home, active: !panel, onClick: () => onNavigate(null) },
    { key: 'populacao', label: 'Populacao', icon: ICONS.populacao, active: heatmap, onClick: onToggleHeatmap },
    {
      key: 'citydex',
      label: 'Citydex',
      icon: ICONS.citydex,
      active: panel === 'citydex',
      badge: `${citydexCount}/${formatPop(citydexTotal)}`,
      badgeTone: 'red',
      onClick: () => onNavigate('citydex'),
    },
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

  // Priority+: a régua fantasma (cópia invisível de todos os botões) dá a
  // largura real de cada item; contamos quantos cabem na faixa disponível e
  // o resto vai para o menu hambúrguer. Reobserva resize da faixa E da
  // régua (badges como 0/5.567 mudam de largura durante o jogo).
  const recompute = () => {
    const itemsEl = itemsRef.current;
    const ghost = ghostRef.current;
    if (!itemsEl || !ghost) return;
    const widths = Array.from(ghost.children).map((c) => (c as HTMLElement).offsetWidth);
    const GAP = 4;
    const HAMBURGER = 40 + GAP;
    const avail = itemsEl.clientWidth;
    let used = 0;
    let fitAll = 0;
    for (let i = 0; i < widths.length; i++) {
      used += widths[i] + (i > 0 ? GAP : 0);
      if (used <= avail) fitAll = i + 1;
      else break;
    }
    if (fitAll >= widths.length) {
      setVisibleCount(widths.length);
      return;
    }
    let used2 = HAMBURGER;
    let fit = 0;
    for (let i = 0; i < widths.length; i++) {
      used2 += widths[i] + (i > 0 ? GAP : 0);
      if (used2 <= avail) fit = i + 1;
      else break;
    }
    setVisibleCount(fit);
  };

  useLayoutEffect(recompute);

  useEffect(() => {
    const ro = new ResizeObserver(recompute);
    if (itemsRef.current) ro.observe(itemsRef.current);
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

  return (
    <nav className="top-nav" aria-label="Menu principal">
      <div className="top-nav__brand">
        <img src={LOGO_FULL} alt="DropLife logo" className="top-nav__logo-full" />
        <img src={LOGO_ICON} alt="DropLife logo" className="top-nav__logo-icon" />
      </div>

      <div className="top-nav__items" ref={itemsRef}>
        {items.slice(0, visibleCount).map((it) => renderItem(it, false))}
        {overflowItems.length > 0 && (
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
              <div className="top-nav__overflow">{overflowItems.map((it) => renderItem(it, true))}</div>
            )}
          </div>
        )}
      </div>

      {/* Régua fantasma: mesma lista completa, invisível, só para medir */}
      <div className="top-nav__ghost" ref={ghostRef} aria-hidden="true">
        {items.map((it) => (
          <NavButton key={it.key} label={it.label} active={it.active} badge={it.badge} badgeTone={it.badgeTone}>
            {it.icon}
          </NavButton>
        ))}
      </div>

      {onlineEnabled && (
        <div className="profile-chip" ref={chipRef}>
          {auth.signedIn && auth.profile ? (
            <>
              <button className="profile-chip__btn" type="button" onClick={() => setMenuOpen((v) => !v)}>
                <span className="profile-chip__avatar">
                  {auth.profile.nickname.charAt(0).toUpperCase()}
                </span>
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
              onClick={() => onNavigate('ranking')}
            >
              Finalizar perfil
            </button>
          ) : (
            <button
              className="profile-chip__btn profile-chip__btn--login"
              type="button"
              onClick={() => onNavigate('ranking')}
            >
              Entrar
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
