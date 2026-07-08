'use client';

import Link from 'next/link';
import type { AuthState } from '@/lib/online';

interface Props {
  auth: AuthState;
  onlineEnabled: boolean;
  onSignOut: () => void;
  onOpenRanking: () => void;
  onClose: () => void;
}

export default function SettingsPanel({ auth, onlineEnabled, onSignOut, onOpenRanking, onClose }: Props) {
  return (
    <div className="modal-panel settings-panel">
      <div className="modal-header">
        <h2>Configurações ⚙️</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="settings-list">
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
