'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SaveData } from '@/lib/storage';
import type { StateStats } from '@/lib/types';
import { ACHIEVEMENTS, type AchievementContext, type AchievementDef, type AchievementProgress } from '@/lib/achievements';
import { fetchPlayerRanking, onlineEnabled, type AuthState, type PlayerRankRow } from '@/lib/online';
import { formatPop } from '@/lib/text';

interface Props {
  save: SaveData;
  total: number;
  stateStats: StateStats[];
  achievementCtx: AchievementContext;
  auth: AuthState;
  onOpenCitydex: () => void;
  onOpenRanking: () => void;
  onOpenConquistas: () => void;
}

// Medalhas do painel (mesmas cores/tons dos ícones da nav): destravam por
// número de municípios únicos no Citydex.
const MEDAL_TIERS = [
  { min: 1, color: '#58cc02', dark: '#3ca002' },
  { min: 10, color: '#1cb0f6', dark: '#0d8fce' },
  { min: 50, color: '#d7873c', dark: '#b56a24' },
  { min: 100, color: '#ffc800', dark: '#e6a500' },
  { min: 500, color: '#c7d0d8', dark: '#8f99a3' },
];

const AVATAR_COLORS = ['#1cb0f6', '#58cc02', '#ff9600', '#ce82ff', '#ff4b4b'];

function Medal({ color, dark, earned }: { color: string; dark: string; earned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`medal${earned ? '' : ' medal--locked'}`} aria-hidden="true">
      <path d="M7 1.4h4.4l-2.7 7.8-4.3-1Z" fill={dark} />
      <path d="M17 1.4h-4.4l2.7 7.8 4.3-1Z" fill={color} />
      <circle cx="12" cy="14.8" r="6.5" fill={color} />
      <circle cx="12" cy="14.8" r="6.5" fill="none" stroke={dark} strokeWidth="1.5" />
      <path
        d="M12 11.3l1.1 2.2 2.4.35-1.75 1.7.4 2.4L12 16.8l-2.15 1.15.4-2.4-1.75-1.7 2.4-.35Z"
        fill="#fff"
      />
    </svg>
  );
}

export default function HomeDashboard({
  save,
  total,
  stateStats,
  achievementCtx,
  auth,
  onOpenCitydex,
  onOpenRanking,
  onOpenConquistas,
}: Props) {
  const [players, setPlayers] = useState<PlayerRankRow[] | null>(null);

  useEffect(() => {
    if (!onlineEnabled()) return;
    fetchPlayerRanking(3).then(setPlayers);
  }, []);

  const uniqueCities = useMemo(() => new Set(save.births.map((b) => b.key)).size, [save.births]);

  // Top 5 estados por municípios únicos coletados, como no painel "Meu Citydex"
  const stateRows = useMemo(() => {
    const perState = new Map<string, Set<string>>();
    for (const b of save.births) {
      if (!perState.has(b.state)) perState.set(b.state, new Set());
      perState.get(b.state)!.add(b.key);
    }
    const totals = new Map(stateStats.map((s) => [s.uf, s.municipios]));
    return [...perState.entries()]
      .map(([uf, keys]) => ({ uf, count: keys.size, total: totals.get(uf) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [save.births, stateStats]);

  // Conquista incompleta mais próxima de destravar (maior razão current/target)
  const next = useMemo(() => {
    let best: { def: AchievementDef; p: AchievementProgress; ratio: number } | null = null;
    for (const def of ACHIEVEMENTS) {
      if (save.achievements[def.id] || !def.progress) continue;
      const p = def.progress(save.births, save, achievementCtx);
      if (p.target <= 0 || p.current >= p.target) continue;
      const ratio = p.current / p.target;
      if (!best || ratio > best.ratio) best = { def, p, ratio };
    }
    return best;
  }, [save, achievementCtx]);

  return (
    <aside className="home-dash">
      <div className="home-card">
        <div className="home-card__header home-card__header--green">
          Meu Citydex
          <span className="home-card__sub">
            ({formatPop(uniqueCities)}/{formatPop(total)} cidades)
          </span>
        </div>
        <div className="home-card__body">
          {stateRows.length ? (
            <div className="state-rows">
              {stateRows.map((r) => {
                const pct = r.total ? (r.count / r.total) * 100 : 0;
                return (
                  <div className="state-row" key={r.uf}>
                    <span className="state-row__uf">{r.uf}</span>
                    <div className="progress progress--state">
                      <div
                        className={`progress__fill${pct < 8 ? ' progress__fill--gold' : ''}`}
                        style={{ width: `${Math.max(pct, 2.5)}%` }}
                      ></div>
                    </div>
                    <span className="state-row__count">
                      {r.count}/{r.total ? formatPop(r.total) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="home-card__empty">Nasça pela primeira vez para começar seu Citydex!</p>
          )}
          <div className="medal-row">
            {MEDAL_TIERS.map((t) => (
              <Medal key={t.min} color={t.color} dark={t.dark} earned={uniqueCities >= t.min} />
            ))}
          </div>
          <button className="home-card__link" type="button" onClick={onOpenCitydex}>
            Ver Citydex completo →
          </button>
        </div>
      </div>

      {next && (
        <button className="home-card next-ach" type="button" onClick={onOpenConquistas}>
          <span className="next-ach__badge">{next.def.emoji}</span>
          <span className="next-ach__info">
            <span className="next-ach__label">Próxima conquista:</span>
            <span className="next-ach__name">{next.def.name}</span>
            <span className="next-ach__meta">
              ({next.p.current}/{next.p.target}) {next.def.desc}
            </span>
          </span>
        </button>
      )}

      {onlineEnabled() && (
        <div className="home-card">
          <div className="home-card__header home-card__header--green">Ranking Global</div>
          <div className="home-card__body">
            {!players ? (
              <p className="home-card__empty">Carregando…</p>
            ) : players.length === 0 ? (
              <p className="home-card__empty">Ninguém no ranking ainda. Seja o primeiro!</p>
            ) : (
              <div className="home-card__list">
                {players.map((p, i) => (
                  <div key={p.nickname} className="mini-row">
                    <span className="mini-row__pos">{i + 1}.</span>
                    <span
                      className="mini-row__avatar"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {p.nickname.charAt(0).toUpperCase()}
                    </span>
                    <span className="mini-row__name">
                      {auth.profile?.nickname === p.nickname ? 'Você' : p.nickname}
                    </span>
                    <span className="mini-row__meta">({formatPop(p.total_births)} cidades)</span>
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
