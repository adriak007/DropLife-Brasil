import type { BirthRecord, SaveData } from './storage';
import { keyFor } from './text';
import { ufToName } from './geo';
import { rarityFor, RARITY_TIERS } from './rarity';

export const REGIONS: Record<string, { name: string; ufs: string[] }> = {
  norte: { name: 'Norte', ufs: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'] },
  nordeste: { name: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  centrooeste: { name: 'Centro-Oeste', ufs: ['DF', 'GO', 'MT', 'MS'] },
  sudeste: { name: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  sul: { name: 'Sul', ufs: ['PR', 'RS', 'SC'] },
};

const CAPITAL_NAMES: Record<string, string> = {
  AC: 'Rio Branco', AL: 'Maceio', AP: 'Macapa', AM: 'Manaus', BA: 'Salvador',
  CE: 'Fortaleza', DF: 'Brasilia', ES: 'Vitoria', GO: 'Goiania', MA: 'Sao Luis',
  MT: 'Cuiaba', MS: 'Campo Grande', MG: 'Belo Horizonte', PA: 'Belem',
  PB: 'Joao Pessoa', PR: 'Curitiba', PE: 'Recife', PI: 'Teresina',
  RJ: 'Rio de Janeiro', RN: 'Natal', RS: 'Porto Alegre', RO: 'Porto Velho',
  RR: 'Boa Vista', SC: 'Florianopolis', SP: 'Sao Paulo', SE: 'Aracaju', TO: 'Palmas',
};

export const CAPITAL_KEYS = new Set(
  Object.entries(CAPITAL_NAMES).map(([uf, city]) => keyFor(city, uf))
);

// Totais de municípios "capturáveis" (com população vinculada no mapa), vindos
// de MapController.getStateStats()/totalCities() em tempo real — nunca
// hardcoded, para nunca dessincronizar de eventuais falhas de correspondência.
export interface AchievementContext {
  totalCities: number;
  stateTotals: Record<string, number>;
}

export type AchievementCategory =
  | 'marco'
  | 'raridade'
  | 'regiao-visitada'
  | 'estado-completo'
  | 'regiao-completa'
  | 'brasil-completo'
  | 'platina';

export const CATEGORY_ORDER: AchievementCategory[] = [
  'marco',
  'raridade',
  'regiao-visitada',
  'estado-completo',
  'regiao-completa',
  'brasil-completo',
  'platina',
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  marco: 'Marcos',
  raridade: 'Raridades',
  'regiao-visitada': 'Exploração',
  'estado-completo': 'Estados Completos',
  'regiao-completa': 'Regiões Completas',
  'brasil-completo': 'O Brasil Inteiro',
  platina: 'Platina',
};

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  check: (births: BirthRecord[], save: SaveData, ctx: AchievementContext) => boolean;
  progress?: (births: BirthRecord[], save: SaveData, ctx: AchievementContext) => AchievementProgress;
}

const statesOf = (births: BirthRecord[]) => new Set(births.map((b) => b.state));

const hasRegion = (births: BirthRecord[], regionId: string) => {
  const states = statesOf(births);
  return REGIONS[regionId].ufs.every((uf) => states.has(uf));
};

const citiesInState = (births: BirthRecord[], uf: string) =>
  new Set(births.filter((b) => b.state === uf).map((b) => b.key)).size;

const dailyCount = (births: BirthRecord[]) => births.filter((b) => b.daily).length;

// ── Marcos e raridades já existentes ──

const CORE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'primeiro-choro', emoji: '👶', name: 'Primeiro Choro',
    desc: 'Nasça pela primeira vez.',
    category: 'marco',
    check: (b) => b.length >= 1,
    progress: (b) => ({ current: Math.min(b.length, 1), target: 1 }),
  },
  {
    id: 'dez-vidas', emoji: '🍼', name: 'Maternidade Lotada',
    desc: 'Nasça 10 vezes.',
    category: 'marco',
    check: (b) => b.length >= 10,
    progress: (b) => ({ current: Math.min(b.length, 10), target: 10 }),
  },
  {
    id: 'cinquenta-vidas', emoji: '🎂', name: 'Cinquenta Vidas',
    desc: 'Nasça 50 vezes.',
    category: 'marco',
    check: (b) => b.length >= 50,
    progress: (b) => ({ current: Math.min(b.length, 50), target: 50 }),
  },
  {
    id: 'cem-vidas', emoji: '💯', name: 'Cem Vidas',
    desc: 'Nasça 100 vezes.',
    category: 'marco',
    check: (b) => b.length >= 100,
    progress: (b) => ({ current: Math.min(b.length, 100), target: 100 }),
  },
  {
    id: 'capital', emoji: '🏛️', name: 'Filho da Capital',
    desc: 'Nasça em uma capital estadual.',
    category: 'marco',
    check: (b) => b.some((r) => CAPITAL_KEYS.has(r.key)),
  },
  {
    id: 'noronha', emoji: '🏝️', name: 'Paraíso Isolado',
    desc: 'Nasça em Fernando de Noronha.',
    category: 'marco',
    check: (b) => b.some((r) => r.key === keyFor('Fernando de Noronha', 'PE')),
  },
  {
    id: 'ritual-diario', emoji: '📅', name: 'Ritual Diário',
    desc: 'Jogue o desafio diário.',
    category: 'marco',
    check: (_b, save) => Boolean(save.lastDaily),
  },
  {
    id: 'semana-completa', emoji: '🗓️', name: 'Semana Completa',
    desc: 'Complete o desafio diário 7 vezes.',
    category: 'marco',
    check: (b) => dailyCount(b) >= 7,
    progress: (b) => ({ current: Math.min(dailyCount(b), 7), target: 7 }),
  },
  {
    id: 'mes-completo', emoji: '📆', name: 'Mês Completo',
    desc: 'Complete o desafio diário 30 vezes.',
    category: 'marco',
    check: (b) => dailyCount(b) >= 30,
    progress: (b) => ({ current: Math.min(dailyCount(b), 30), target: 30 }),
  },
  {
    id: 'gemeos', emoji: '👯', name: 'Quase Gêmeos',
    desc: 'Nasça em duas cidades no mesmo dia.',
    category: 'marco',
    check: (b) => {
      const byDay = new Map<string, number>();
      b.forEach((r) => byDay.set(r.bornAt.slice(0, 10), (byDay.get(r.bornAt.slice(0, 10)) || 0) + 1));
      return [...byDay.values()].some((n) => n >= 2);
    },
  },
  {
    id: 'ave-noturna', emoji: '🦉', name: 'Ave Noturna',
    desc: 'Nasça entre meia-noite e 5h da manhã.',
    category: 'marco',
    check: (b) => b.some((r) => new Date(r.bornAt).getHours() < 5),
  },
  {
    id: 'andarilho', emoji: '🚶', name: 'Andarilho',
    desc: 'Nasça em 15 estados diferentes.',
    category: 'marco',
    check: (b) => statesOf(b).size >= 15,
    progress: (b) => ({ current: statesOf(b).size, target: 15 }),
  },
  {
    id: 'prefeito-de-plantao', emoji: '🎩', name: 'Prefeito de Plantão',
    desc: 'Nasça em todas as 27 capitais estaduais.',
    category: 'marco',
    check: (b) => [...CAPITAL_KEYS].every((k) => b.some((r) => r.key === k)),
    progress: (b) => ({
      current: [...CAPITAL_KEYS].filter((k) => b.some((r) => r.key === k)).length,
      target: CAPITAL_KEYS.size,
    }),
  },
  {
    id: 'metropole', emoji: '🌆', name: 'Gente como a Gente',
    desc: 'Nasça em uma cidade com mais de 1 milhão de habitantes.',
    category: 'raridade',
    check: (b) => b.some((r) => r.population >= 1_000_000),
  },
  {
    id: 'selva-de-pedra', emoji: '🏗️', name: 'Selva de Pedra',
    desc: 'Nasça em um município com mais de 10 milhões de habitantes.',
    category: 'raridade',
    check: (b) => b.some((r) => r.population >= 10_000_000),
  },
  {
    id: 'cidade-rara', emoji: '💠', name: 'Caçador de Raras',
    desc: 'Nasça em um município Raro.',
    category: 'raridade',
    check: (b) => b.some((r) => rarityFor(r.population).id === 'raro'),
  },
  {
    id: 'cidade-epica', emoji: '🔮', name: 'Caçador de Épicas',
    desc: 'Nasça em um município Épico.',
    category: 'raridade',
    check: (b) => b.some((r) => rarityFor(r.population).id === 'epico'),
  },
  {
    id: 'lendario', emoji: '👑', name: 'Agulha no Palheiro',
    desc: 'Nasça em um município lendário (menos de 3 mil habitantes).',
    category: 'raridade',
    check: (b) => b.some((r) => r.population > 0 && r.population < 3_000),
  },
  {
    id: 'ultra-raro', emoji: '🍀', name: 'Improvável',
    desc: 'Nasça em um município com menos de 1.000 habitantes.',
    category: 'raridade',
    check: (b) => b.some((r) => r.population > 0 && r.population < 1_000),
  },
  {
    id: 'arco-iris-raridades', emoji: '🌈', name: 'Arco-Íris de Raridades',
    desc: 'Nasça em ao menos uma cidade de cada nível de raridade.',
    category: 'raridade',
    check: (b) => new Set(b.map((r) => rarityFor(r.population).id)).size >= RARITY_TIERS.length,
    progress: (b) => ({
      current: new Set(b.map((r) => rarityFor(r.population).id)).size,
      target: RARITY_TIERS.length,
    }),
  },
  {
    id: 'cinco-estados', emoji: '🗺️', name: 'Espírito Viajante',
    desc: 'Nasça em 5 estados diferentes.',
    category: 'regiao-visitada',
    check: (b) => statesOf(b).size >= 5,
    progress: (b) => ({ current: Math.min(statesOf(b).size, 5), target: 5 }),
  },
  {
    id: 'regiao-norte', emoji: '🌳', name: 'Coração da Floresta',
    desc: 'Nasça em todos os estados do Norte.',
    category: 'regiao-visitada',
    check: (b) => hasRegion(b, 'norte'),
    progress: (b) => ({
      current: REGIONS.norte.ufs.filter((uf) => statesOf(b).has(uf)).length,
      target: REGIONS.norte.ufs.length,
    }),
  },
  {
    id: 'regiao-nordeste', emoji: '☀️', name: 'Arretado',
    desc: 'Nasça em todos os estados do Nordeste.',
    category: 'regiao-visitada',
    check: (b) => hasRegion(b, 'nordeste'),
    progress: (b) => ({
      current: REGIONS.nordeste.ufs.filter((uf) => statesOf(b).has(uf)).length,
      target: REGIONS.nordeste.ufs.length,
    }),
  },
  {
    id: 'regiao-centrooeste', emoji: '🌾', name: 'Cerrado Adentro',
    desc: 'Nasça em todos os estados do Centro-Oeste.',
    category: 'regiao-visitada',
    check: (b) => hasRegion(b, 'centrooeste'),
    progress: (b) => ({
      current: REGIONS.centrooeste.ufs.filter((uf) => statesOf(b).has(uf)).length,
      target: REGIONS.centrooeste.ufs.length,
    }),
  },
  {
    id: 'regiao-sudeste', emoji: '🏙️', name: 'Garoa e Café',
    desc: 'Nasça em todos os estados do Sudeste.',
    category: 'regiao-visitada',
    check: (b) => hasRegion(b, 'sudeste'),
    progress: (b) => ({
      current: REGIONS.sudeste.ufs.filter((uf) => statesOf(b).has(uf)).length,
      target: REGIONS.sudeste.ufs.length,
    }),
  },
  {
    id: 'regiao-sul', emoji: '❄️', name: 'Esquenta o Chimarrão',
    desc: 'Nasça em todos os estados do Sul.',
    category: 'regiao-visitada',
    check: (b) => hasRegion(b, 'sul'),
    progress: (b) => ({
      current: REGIONS.sul.ufs.filter((uf) => statesOf(b).has(uf)).length,
      target: REGIONS.sul.ufs.length,
    }),
  },
  {
    id: 'brasileiro', emoji: '🇧🇷', name: 'Brasileiro de Verdade',
    desc: 'Nasça em todos os 27 estados.',
    category: 'regiao-visitada',
    check: (b) => statesOf(b).size >= 27,
    progress: (b) => ({ current: statesOf(b).size, target: 27 }),
  },
];

// ── Estado Completo: nascer em TODOS os municípios de cada estado ──

const STATE_EMOJI: Record<string, string> = {
  AC: '🌳', AL: '🏖️', AP: '🛶', AM: '🐬', BA: '🥥', CE: '🦐', DF: '🏛️', ES: '⚓',
  GO: '🌻', MA: '🥁', MT: '🐆', MS: '🐊', MG: '🧀', PA: '🦜', PB: '🌵', PR: '💧',
  PE: '🎶', PI: '🏜️', RJ: '🗿', RN: '🐚', RS: '🧉', RO: '💎', RR: '🏔️', SC: '🌊',
  SP: '🏙️', SE: '🦀', TO: '🐢',
};

const STATE_ACHIEVEMENTS: AchievementDef[] = Object.keys(ufToName).map((uf) => ({
  id: `estado-completo-${uf.toLowerCase()}`,
  emoji: STATE_EMOJI[uf] || '📍',
  name: `Conquistador de ${ufToName[uf]}`,
  desc: `Nasça em todos os municípios de ${ufToName[uf]}.`,
  category: 'estado-completo' as const,
  check: (births, _save, ctx) => {
    const total = ctx.stateTotals[uf];
    return Boolean(total) && citiesInState(births, uf) >= total;
  },
  progress: (births, _save, ctx) => ({
    current: citiesInState(births, uf),
    target: ctx.stateTotals[uf] || 0,
  }),
}));

// ── Região Completa: nascer em TODOS os municípios de todos os estados da região ──

const REGION_FULL_EMOJI: Record<string, string> = {
  norte: '🌴',
  nordeste: '🔥',
  centrooeste: '🐂',
  sudeste: '🌆',
  sul: '🧊',
};

const REGION_ACHIEVEMENTS: AchievementDef[] = Object.entries(REGIONS).map(([regionId, region]) => ({
  id: `regiao-completa-${regionId}`,
  emoji: REGION_FULL_EMOJI[regionId] || '🧭',
  name: `Domínio do ${region.name}`,
  desc: `Nasça em todos os municípios da região ${region.name}.`,
  category: 'regiao-completa' as const,
  check: (births, _save, ctx) =>
    region.ufs.every((uf) => ctx.stateTotals[uf] > 0 && citiesInState(births, uf) >= ctx.stateTotals[uf]),
  progress: (births, _save, ctx) => ({
    current: region.ufs.reduce(
      (sum, uf) => sum + Math.min(citiesInState(births, uf), ctx.stateTotals[uf] || 0),
      0
    ),
    target: region.ufs.reduce((sum, uf) => sum + (ctx.stateTotals[uf] || 0), 0),
  }),
}));

// ── O Brasil Inteiro: nascer em todos os municípios do país ──

const BRAZIL_ACHIEVEMENT: AchievementDef = {
  id: 'brasil-completo',
  emoji: '🌎',
  name: 'Colecionador Supremo',
  desc: 'Nasça em todos os municípios do Brasil.',
  category: 'brasil-completo',
  check: (births, _save, ctx) => ctx.totalCities > 0 && births.length >= ctx.totalCities,
  progress: (births, _save, ctx) => ({ current: births.length, target: ctx.totalCities }),
};

const NON_PLATINUM: AchievementDef[] = [
  ...CORE_ACHIEVEMENTS,
  ...STATE_ACHIEVEMENTS,
  ...REGION_ACHIEVEMENTS,
  BRAZIL_ACHIEVEMENT,
];

const OTHER_IDS = NON_PLATINUM.map((a) => a.id);

// ── Platina: a conquista das conquistas. Sempre acompanha o total real de
// troféus existentes — cresce automaticamente conforme novos são criados. ──

const PLATINUM_ACHIEVEMENT: AchievementDef = {
  id: 'platina',
  emoji: '🏆',
  name: 'Troféu de Platina',
  desc: 'Desbloqueie todas as outras conquistas do jogo.',
  category: 'platina',
  check: (_b, save) => OTHER_IDS.every((id) => Boolean(save.achievements[id])),
  progress: (_b, save) => ({
    current: OTHER_IDS.filter((id) => Boolean(save.achievements[id])).length,
    target: OTHER_IDS.length,
  }),
};

export const ACHIEVEMENTS: AchievementDef[] = [...NON_PLATINUM, PLATINUM_ACHIEVEMENT];

// Retorna os ids desbloqueados agora (ainda não presentes em save.achievements).
// Iteração em ponto-fixo: permite que a Platina (que depende de todas as outras)
// desbloqueie na MESMA leva em que a última conquista pendente é concluída.
export const newlyUnlocked = (
  births: BirthRecord[],
  save: SaveData,
  ctx: AchievementContext
): AchievementDef[] => {
  const unlocked: AchievementDef[] = [];
  const known: Record<string, string> = { ...save.achievements };
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of ACHIEVEMENTS) {
      if (known[a.id]) continue;
      if (a.check(births, { ...save, achievements: known }, ctx)) {
        known[a.id] = 'pending';
        unlocked.push(a);
        changed = true;
      }
    }
  }
  return unlocked;
};
