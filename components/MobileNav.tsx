'use client';

import { useState } from 'react';
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

export default function MobileNav({
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
  const [open, setOpen] = useState(false);

  const go = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <>
      <div className="mobile-topbar">
        <img src={LOGO_SRC} alt="DropLife logo" className="mobile-topbar__logo" />
        <button
          className="hamburger-btn"
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div
        className={`sidebar-backdrop${open ? ' sidebar-backdrop--open' : ''}`}
        onClick={() => setOpen(false)}
      >
        <aside
          className={`sidebar${open ? ' sidebar--open' : ''}`}
          onClick={(evt) => evt.stopPropagation()}
        >
          <div className="sidebar__header">
            {onlineEnabled && auth.signedIn && auth.profile ? (
              <div className="profile-chip">
                <span className="profile-chip__avatar">
                  {auth.profile.nickname.charAt(0).toUpperCase()}
                </span>
                <span className="profile-chip__name">{auth.profile.nickname}</span>
              </div>
            ) : onlineEnabled ? (
              <button
                className="profile-chip__btn profile-chip__btn--login"
                type="button"
                onClick={() => go(() => onNavigate('ranking'))}
              >
                Entrar
              </button>
            ) : (
              <span className="sidebar__brand">DropLife Brasil</span>
            )}
            <button className="modal-close" type="button" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>

          <div className="sidebar__items">
            <NavButton label="Home" active={!panel} onClick={() => go(() => onNavigate(null))}>
              {ICONS.home}
            </NavButton>
            <NavButton label="Populacao" active={heatmap} onClick={() => go(onToggleHeatmap)}>
              {ICONS.populacao}
            </NavButton>
            <NavButton
              label="Citydex"
              active={panel === 'citydex'}
              badge={`${citydexCount}/${formatPop(citydexTotal)}`}
              onClick={() => go(() => onNavigate('citydex'))}
            >
              {ICONS.citydex}
            </NavButton>
            <NavButton
              label="Estados"
              active={panel === 'estados'}
              onClick={() => go(() => onNavigate('estados'))}
            >
              {ICONS.estados}
            </NavButton>
            <NavButton
              label="Conquistas"
              active={panel === 'conquistas'}
              badge={`${achCount}/${achTotal}`}
              onClick={() => go(() => onNavigate('conquistas'))}
            >
              {ICONS.conquistas}
            </NavButton>
            <NavButton label={dailyDone ? 'Desafio ✓' : 'Desafio'} onClick={() => go(onDaily)}>
              {ICONS.desafio}
            </NavButton>
            <NavButton
              label="Ranking"
              active={panel === 'ranking'}
              onClick={() => go(() => onNavigate('ranking'))}
            >
              {ICONS.ranking}
            </NavButton>
            <NavButton
              label="Configurações"
              active={panel === 'configuracoes'}
              onClick={() => go(() => onNavigate('configuracoes'))}
            >
              {ICONS.configuracoes}
            </NavButton>
          </div>

          {onlineEnabled && auth.signedIn && auth.profile && (
            <button
              className="sidebar__signout"
              type="button"
              onClick={() => go(onSignOut)}
            >
              🚪 Sair da conta
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
