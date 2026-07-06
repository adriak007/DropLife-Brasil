'use client';

import type { SaveData } from '@/lib/storage';
import { ACHIEVEMENTS } from '@/lib/achievements';

interface Props {
  save: SaveData;
  onClose: () => void;
}

export default function AchievementsModal({ save, onClose }: Props) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;

  return (
    <div className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h2>
          Conquistas{' '}
          <span className="dex-count">
            {unlockedCount} / {ACHIEVEMENTS.length}
          </span>
        </h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="progress" aria-label={`${unlockedCount} de ${ACHIEVEMENTS.length}`}>
        <div
          className="progress__fill"
          style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
        ></div>
      </div>

      <div className="overlay-list">
        {ACHIEVEMENTS.map((a) => {
          const unlockedAt = save.achievements[a.id];
          return (
            <div key={a.id} className={`ach-row${unlockedAt ? '' : ' ach-row--locked'}`}>
              <span className="ach-row__emoji">{unlockedAt ? a.emoji : '🔒'}</span>
              <span className="ach-row__text">
                <strong>{a.name}</strong>
                <small>{a.desc}</small>
              </span>
              {unlockedAt ? (
                <span className="dex-row__date">
                  {new Date(unlockedAt).toLocaleDateString('pt-BR')}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
