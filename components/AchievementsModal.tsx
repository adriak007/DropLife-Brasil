'use client';

import type { SaveData } from '@/lib/storage';
import {
  ACHIEVEMENTS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type AchievementContext,
  type AchievementDef,
} from '@/lib/achievements';

interface Props {
  save: SaveData;
  ctx: AchievementContext;
  onClose: () => void;
}

function AchievementRow({
  a,
  save,
  ctx,
}: {
  a: AchievementDef;
  save: SaveData;
  ctx: AchievementContext;
}) {
  const unlockedAt = save.achievements[a.id];
  const progress = !unlockedAt && a.progress ? a.progress(save.births, save, ctx) : null;
  const pct = progress && progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;

  return (
    <div className={`ach-row${unlockedAt ? '' : ' ach-row--locked'}${a.category === 'platina' ? ' ach-row--platina' : ''}`}>
      <span className="ach-row__emoji">{unlockedAt ? a.emoji : '🔒'}</span>
      <span className="ach-row__text">
        <strong>{a.name}</strong>
        <small>{a.desc}</small>
        {progress && (
          <span className="ach-row__progress">
            <span className="progress progress--mini">
              <span className="progress__fill" style={{ width: `${pct}%` }}></span>
            </span>
            <small>
              {progress.current}/{progress.target}
            </small>
          </span>
        )}
      </span>
      {unlockedAt ? (
        <span className="dex-row__date">{new Date(unlockedAt).toLocaleDateString('pt-BR')}</span>
      ) : null}
    </div>
  );
}

export default function AchievementsModal({ save, ctx, onClose }: Props) {
  const unlockedCount = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;

  const byCategory = new Map<string, AchievementDef[]>();
  ACHIEVEMENTS.forEach((a) => {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category)!.push(a);
  });

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
        {CATEGORY_ORDER.map((cat) => {
          const list = byCategory.get(cat);
          if (!list || !list.length) return null;
          const catUnlocked = list.filter((a) => save.achievements[a.id]).length;
          return (
            <div key={cat} className="ach-category-group">
              <div className="ach-category">
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="ach-category__count">
                  {catUnlocked}/{list.length}
                </span>
              </div>
              {list.map((a) => (
                <AchievementRow key={a.id} a={a} save={save} ctx={ctx} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
