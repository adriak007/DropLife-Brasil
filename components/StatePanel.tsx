'use client';

import type { StateStats } from '@/lib/types';
import { ufToName } from '@/lib/geo';
import { formatPop } from '@/lib/text';

interface Props {
  uf: string;
  stats: StateStats | undefined;
  captured: number;
}

export default function StatePanel({ uf, stats, captured }: Props) {
  if (!stats) return null;
  const pct = stats.municipios ? (captured / stats.municipios) * 100 : 0;

  return (
    <aside className="state-panel">
      <h3>
        {ufToName[uf] || uf} <span className="state-panel__uf">{uf}</span>
      </h3>
      <dl>
        <div>
          <dt>População</dt>
          <dd>{formatPop(stats.population)}</dd>
        </div>
        <div>
          <dt>Municípios</dt>
          <dd>{stats.municipios}</dd>
        </div>
        <div>
          <dt>Capturados</dt>
          <dd>
            {captured} <small>({pct.toFixed(1)}%)</small>
          </dd>
        </div>
      </dl>
      <div className="progress progress--mini">
        <div className="progress__fill" style={{ width: `${pct}%` }}></div>
      </div>
    </aside>
  );
}
