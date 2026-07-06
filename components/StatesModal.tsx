'use client';

import { useMemo } from 'react';
import type { SaveData } from '@/lib/storage';
import type { StateStats } from '@/lib/types';
import { ufToName } from '@/lib/geo';
import { formatPop } from '@/lib/text';

interface Props {
  save: SaveData;
  stats: StateStats[];
  onSelect: (uf: string) => void;
  onClose: () => void;
}

export default function StatesModal({ save, stats, onSelect, onClose }: Props) {
  const capturedByState = useMemo(() => {
    const counts = new Map<string, number>();
    save.births.forEach((b) => counts.set(b.state, (counts.get(b.state) || 0) + 1));
    return counts;
  }, [save.births]);

  return (
    <div className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h2>Estados</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="overlay-list">
        {stats.map((s) => {
          const captured = capturedByState.get(s.uf) || 0;
          const pct = s.municipios ? (captured / s.municipios) * 100 : 0;
          return (
            <button
              key={s.uf}
              className="dex-row state-row"
              type="button"
              onClick={() => onSelect(s.uf)}
            >
              <span className="state-row__uf">{s.uf}</span>
              <span className="dex-row__city">
                {ufToName[s.uf] || s.uf}
                <small className="state-row__sub">
                  {formatPop(s.population)} hab · {s.municipios} municípios
                </small>
              </span>
              <span className="state-row__progress">
                <span className="progress progress--mini">
                  <span className="progress__fill" style={{ width: `${pct}%` }}></span>
                </span>
                <small>
                  {captured}/{s.municipios}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
