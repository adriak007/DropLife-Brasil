'use client';

import { useEffect, useState } from 'react';
import type { SaveData } from '@/lib/storage';
import { fetchPlayerRanking, onlineEnabled, type AuthState, type PlayerRankRow } from '@/lib/online';
import { formatPop } from '@/lib/text';

interface Props {
  save: SaveData;
  total: number;
  auth: AuthState;
  onOpenCitydex: () => void;
  onOpenRanking: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function HomeDashboard({ save, total, auth, onOpenCitydex, onOpenRanking }: Props) {
  const [players, setPlayers] = useState<PlayerRankRow[] | null>(null);

  useEffect(() => {
    if (!onlineEnabled()) return;
    fetchPlayerRanking(3).then(setPlayers);
  }, []);

  const pct = total ? (save.births.length / total) * 100 : 0;

  return (
    <aside className="home-dash">
      <div className="home-card">
        <div className="home-card__header home-card__header--green">Meu Citydex</div>
        <div className="home-card__body">
          <p className="home-card__stat">
            {formatPop(save.births.length)} <span>/ {formatPop(total)} municípios</span>
          </p>
          <div className="progress">
            <div className="progress__fill" style={{ width: `${pct}%` }}></div>
          </div>
          <button className="home-card__link" type="button" onClick={onOpenCitydex}>
            Ver Citydex completo →
          </button>
        </div>
      </div>

      {onlineEnabled() && (
        <div className="home-card">
          <div className="home-card__header home-card__header--blue">Ranking Global</div>
          <div className="home-card__body">
            {!players ? (
              <p className="home-card__empty">Carregando…</p>
            ) : players.length === 0 ? (
              <p className="home-card__empty">Ninguém no ranking ainda. Seja o primeiro!</p>
            ) : (
              <div className="home-card__list">
                {players.map((p, i) => (
                  <div key={p.nickname} className="mini-row">
                    <span className="mini-row__pos">{MEDALS[i] || `${i + 1}º`}</span>
                    <span className="mini-row__name">{p.nickname}</span>
                    <span className="mini-row__meta">{formatPop(p.total_births)}</span>
                  </div>
                ))}
              </div>
            )}
            {!auth.profile && <p className="home-card__empty">Entre para aparecer aqui!</p>}
            <button className="home-card__link" type="button" onClick={onOpenRanking}>
              Ver ranking completo →
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
