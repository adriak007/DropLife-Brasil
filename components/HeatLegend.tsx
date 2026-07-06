'use client';

import { HEAT_BUCKETS } from '@/lib/heatmap';

export default function HeatLegend() {
  return (
    <div className="heat-legend" role="img" aria-label="Legenda: população por município">
      <span className="heat-legend__title">Habitantes</span>
      {HEAT_BUCKETS.map((b) => (
        <span key={b.label} className="heat-legend__item">
          <span className="heat-legend__swatch" style={{ background: b.color }}></span>
          {b.label}
        </span>
      ))}
    </div>
  );
}
