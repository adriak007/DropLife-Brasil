// Ramp sequencial teal validado (7 passos, hue único, monotônico,
// todos legíveis sobre o fundo #03101f do mapa).
export interface HeatBucket {
  max: number; // população máxima (exclusiva)
  color: string;
  label: string;
}

export const HEAT_BUCKETS: HeatBucket[] = [
  { max: 5_000, color: '#7ee3c5', label: '< 5 mil' },
  { max: 10_000, color: '#55c8ab', label: '5–10 mil' },
  { max: 25_000, color: '#3daf97', label: '10–25 mil' },
  { max: 50_000, color: '#2f9683', label: '25–50 mil' },
  { max: 150_000, color: '#257f6f', label: '50–150 mil' },
  { max: 500_000, color: '#1d685c', label: '150–500 mil' },
  { max: Infinity, color: '#165249', label: '500 mil +' },
];

export const heatBucket = (population: number): number => {
  const idx = HEAT_BUCKETS.findIndex((b) => population < b.max);
  return idx === -1 ? HEAT_BUCKETS.length - 1 : idx;
};
