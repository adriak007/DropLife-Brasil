import type { BirthRecord, SaveData } from './storage';
import { keyFor } from './text';

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

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (births: BirthRecord[], save: SaveData) => boolean;
}

const statesOf = (births: BirthRecord[]) => new Set(births.map((b) => b.state));

const hasRegion = (births: BirthRecord[], regionId: string) => {
  const states = statesOf(births);
  return REGIONS[regionId].ufs.every((uf) => states.has(uf));
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'primeiro-choro', emoji: '👶', name: 'Primeiro Choro',
    desc: 'Nasça pela primeira vez.',
    check: (b) => b.length >= 1,
  },
  {
    id: 'dez-vidas', emoji: '🍼', name: 'Maternidade Lotada',
    desc: 'Nasça 10 vezes.',
    check: (b) => b.length >= 10,
  },
  {
    id: 'cinquenta-vidas', emoji: '🎂', name: 'Cinquenta Vidas',
    desc: 'Nasça 50 vezes.',
    check: (b) => b.length >= 50,
  },
  {
    id: 'cem-vidas', emoji: '💯', name: 'Cem Vidas',
    desc: 'Nasça 100 vezes.',
    check: (b) => b.length >= 100,
  },
  {
    id: 'capital', emoji: '🏛️', name: 'Filho da Capital',
    desc: 'Nasça em uma capital estadual.',
    check: (b) => b.some((r) => CAPITAL_KEYS.has(r.key)),
  },
  {
    id: 'metropole', emoji: '🌆', name: 'Gente como a Gente',
    desc: 'Nasça em uma cidade com mais de 1 milhão de habitantes.',
    check: (b) => b.some((r) => r.population >= 1_000_000),
  },
  {
    id: 'lendario', emoji: '👑', name: 'Agulha no Palheiro',
    desc: 'Nasça em um município lendário (menos de 3 mil habitantes).',
    check: (b) => b.some((r) => r.population > 0 && r.population < 3_000),
  },
  {
    id: 'noronha', emoji: '🏝️', name: 'Paraíso Isolado',
    desc: 'Nasça em Fernando de Noronha.',
    check: (b) => b.some((r) => r.key === keyFor('Fernando de Noronha', 'PE')),
  },
  {
    id: 'cinco-estados', emoji: '🗺️', name: 'Espírito Viajante',
    desc: 'Nasça em 5 estados diferentes.',
    check: (b) => statesOf(b).size >= 5,
  },
  {
    id: 'regiao-norte', emoji: '🌳', name: 'Coração da Floresta',
    desc: 'Nasça em todos os estados do Norte.',
    check: (b) => hasRegion(b, 'norte'),
  },
  {
    id: 'regiao-nordeste', emoji: '☀️', name: 'Arretado',
    desc: 'Nasça em todos os estados do Nordeste.',
    check: (b) => hasRegion(b, 'nordeste'),
  },
  {
    id: 'regiao-centrooeste', emoji: '🌾', name: 'Cerrado Adentro',
    desc: 'Nasça em todos os estados do Centro-Oeste.',
    check: (b) => hasRegion(b, 'centrooeste'),
  },
  {
    id: 'regiao-sudeste', emoji: '🏙️', name: 'Garoa e Café',
    desc: 'Nasça em todos os estados do Sudeste.',
    check: (b) => hasRegion(b, 'sudeste'),
  },
  {
    id: 'regiao-sul', emoji: '❄️', name: 'Esquenta o Chimarrão',
    desc: 'Nasça em todos os estados do Sul.',
    check: (b) => hasRegion(b, 'sul'),
  },
  {
    id: 'brasileiro', emoji: '🇧🇷', name: 'Brasileiro de Verdade',
    desc: 'Nasça em todos os 27 estados.',
    check: (b) => statesOf(b).size >= 27,
  },
  {
    id: 'ritual-diario', emoji: '📅', name: 'Ritual Diário',
    desc: 'Jogue o desafio diário.',
    check: (_b, save) => Boolean(save.lastDaily),
  },
];

// Retorna os ids desbloqueados agora (ainda não presentes em save.achievements)
export const newlyUnlocked = (births: BirthRecord[], save: SaveData): AchievementDef[] =>
  ACHIEVEMENTS.filter((a) => !save.achievements[a.id] && a.check(births, save));
