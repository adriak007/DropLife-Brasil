'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AuthState } from '@/lib/online';
import { getSoundPrefs, setMusicEnabled, setSfxEnabled } from '@/lib/sound';

interface Props {
  auth: AuthState;
  onlineEnabled: boolean;
  onSignOut: () => void;
  onOpenRanking: () => void;
  onClose: () => void;
}

export default function SettingsPanel({ auth, onlineEnabled, onSignOut, onOpenRanking, onClose }: Props) {
  const [sound, setSound] = useState(getSoundPrefs());

  const toggleMusic = () => {
    const on = !sound.music;
    setMusicEnabled(on);
    setSound((s) => ({ ...s, music: on }));
  };

  const toggleSfx = () => {
    const on = !sound.sfx;
    setSfxEnabled(on);
    setSound((s) => ({ ...s, sfx: on }));
  };

  return (
    <div className="modal-panel settings-panel">
      <div className="modal-header">
        <h2>Configurações ⚙️</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="settings-list">
        <button
          className="settings-row settings-row--toggle"
          type="button"
          role="switch"
          aria-checked={sound.music}
          onClick={toggleMusic}
        >
          🎵 Música de fundo
          <span className={`toggle${sound.music ? ' toggle--on' : ''}`} aria-hidden="true" />
        </button>
        <button
          className="settings-row settings-row--toggle"
          type="button"
          role="switch"
          aria-checked={sound.sfx}
          onClick={toggleSfx}
        >
          🔔 Efeitos sonoros
          <span className={`toggle${sound.sfx ? ' toggle--on' : ''}`} aria-hidden="true" />
        </button>

        {onlineEnabled && auth.signedIn && auth.profile ? (
          <>
            <p className="settings-row__info">
              Conectado como <strong>{auth.profile.nickname}</strong>
            </p>
            <button className="settings-row settings-row--danger" type="button" onClick={onSignOut}>
              🚪 Sair da conta
            </button>
          </>
        ) : onlineEnabled ? (
          <button className="settings-row" type="button" onClick={onOpenRanking}>
            🌍 Entrar ou criar conta
          </button>
        ) : null}

        <Link className="settings-row" href="/politica-de-privacidade" target="_blank">
          📄 Política de Privacidade
        </Link>
      </div>
    </div>
  );
}
