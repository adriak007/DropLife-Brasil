'use client';

import { useEffect, useRef, useState } from 'react';
import type { PanelKind } from '@/lib/types';
import type { AuthState } from '@/lib/online';
import { formatPop } from '@/lib/text';
import NavButton, { ICONS } from '@/components/NavButton';

const LOGO_SRC = '/Img/logo-nav.png';

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
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (evt: MouseEvent) => {
      if (!chipRef.current?.contains(evt.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [menuOpen]);

  return (
    <nav className="top-nav" aria-label="Menu principal">
      <div className="top-nav__brand">
        <img src={LOGO_SRC} alt="DropLife logo" />
      </div>

      <div className="top-nav__items">
        <NavButton label="Home" active={!panel} onClick={() => onNavigate(null)}>
          {ICONS.home}
        </NavButton>
        <NavButton label="Populacao" active={heatmap} onClick={onToggleHeatmap}>
          {ICONS.populacao}
        </NavButton>
        <NavButton
          label="Citydex"
          active={panel === 'citydex'}
          badge={`${citydexCount}/${formatPop(citydexTotal)}`}
          badgeTone="red"
          onClick={() => onNavigate('citydex')}
        >
          {ICONS.citydex}
        </NavButton>
        <NavButton label="Estados" active={panel === 'estados'} onClick={() => onNavigate('estados')}>
          {ICONS.estados}
        </NavButton>
        <NavButton
          label="Conquistas"
          active={panel === 'conquistas'}
          badge={`${achCount}/${achTotal}`}
          onClick={() => onNavigate('conquistas')}
        >
          {ICONS.conquistas}
        </NavButton>
        <NavButton label={dailyDone ? 'Desafio ✓' : 'Desafio'} onClick={onDaily}>
          {ICONS.desafio}
        </NavButton>
        <NavButton label="Ranking" active={panel === 'ranking'} onClick={() => onNavigate('ranking')}>
          {ICONS.ranking}
        </NavButton>
        <NavButton
          label="Config"
          active={panel === 'configuracoes'}
          onClick={() => onNavigate('configuracoes')}
        >
          {ICONS.configuracoes}
        </NavButton>
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
