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
    const itemsEl = itemsRef.current;
    const ghost = ghostRef.current;
    if (!itemsEl || !ghost) return;
    const widths = Array.from(ghost.children).map((c) => (c as HTMLElement).offsetWidth);
    const GAP = 4;
    const HAMBURGER = 40 + GAP;
    const avail = itemsEl.clientWidth;
    const chipWidth = onlineEnabled ? (chipGhostRef.current?.offsetWidth ?? 0) : 0;

    // 1) melhor caso: todos os icones + o chip cabem sem hamburguer nenhum
    let usedNoHamb = 0;
    let fitNoHamb = 0;
    for (let i = 0; i < widths.length; i++) {
      usedNoHamb += widths[i] + (i > 0 ? GAP : 0);
      if (usedNoHamb <= avail) fitNoHamb = i + 1;
      else break;
    }
    const allNavFit = fitNoHamb >= widths.length;
    if (allNavFit && avail - usedNoHamb >= chipWidth) {
      setVisibleCount(widths.length);
      setChipInline(true);
      return;
    }

    // 2) precisa de hamburguer (pra sobra de icones e/ou pro chip) — reserva
    // a largura dele e recalcula quantos icones cabem com esse desconto
    let used2 = HAMBURGER;
    let fit2 = 0;
    for (let i = 0; i < widths.length; i++) {
      used2 += widths[i] + (i > 0 ? GAP : 0);
      if (used2 <= avail) fit2 = i + 1;
      else break;
    }
    setVisibleCount(fit2);
    setChipInline(onlineEnabled && avail - used2 >= chipWidth);
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
    <nav className="top-nav" aria-label="Menu principal">
      <div className="top-nav__brand">
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
