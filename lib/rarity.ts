// Raridade de um nascimento: o sorteio é ponderado por população, então
// quanto menor o município, mais raro é nascer nele.
export interface RarityTier {
  id: string;
  label: string;
  color: string;
  max: number; // população máxima (exclusiva) para cair neste tier
}

// Cortes calibrados pela PROBABILIDADE ponderada por população (não pelo
// tamanho da cidade): Lendário ~0,9% (1/109), Épico ~4,7% (1/21),
// Raro ~12% (1/8), Incomum ~23% (1/4), Comum ~60%. Antes, "Incomum" era o
// resultado mais frequente do jogo e "Épico" saía 1 a cada 9 nascimentos.
export const RARITY_TIERS: RarityTier[] = [
  { id: 'lendario', label: 'Lendário', color: '#f59e0b', max: 3_500 },
  { id: 'epico', label: 'Épico', color: '#a78bfa', max: 9_000 },
  { id: 'raro', label: 'Raro', color: '#38bdf8', max: 23_000 },
  { id: 'incomum', label: 'Incomum', color: '#34d399', max: 85_000 },
  { id: 'comum', label: 'Comum', color: '#94a3b8', max: Infinity },
];

export const rarityFor = (population: number): RarityTier =>
  RARITY_TIERS.find((t) => population < t.max) || RARITY_TIERS[RARITY_TIERS.length - 1];
