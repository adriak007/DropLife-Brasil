// Raridade de um nascimento: o sorteio é ponderado por população, então
// quanto menor o município, mais raro é nascer nele.
export interface RarityTier {
  id: string;
  label: string;
  color: string;
  max: number; // população máxima (exclusiva) para cair neste tier
}

export const RARITY_TIERS: RarityTier[] = [
  { id: 'lendario', label: 'Lendário', color: '#f59e0b', max: 3_000 },
  { id: 'epico', label: 'Épico', color: '#a78bfa', max: 15_000 },
  { id: 'raro', label: 'Raro', color: '#38bdf8', max: 80_000 },
  { id: 'incomum', label: 'Incomum', color: '#34d399', max: 500_000 },
  { id: 'comum', label: 'Comum', color: '#94a3b8', max: Infinity },
];

export const rarityFor = (population: number): RarityTier =>
  RARITY_TIERS.find((t) => population < t.max) || RARITY_TIERS[RARITY_TIERS.length - 1];
