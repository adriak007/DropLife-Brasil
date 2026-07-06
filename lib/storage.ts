export interface BirthRecord {
  key: string;
  city: string;
  state: string;
  population: number;
  chance: string;
  bornAt: string; // ISO
  daily?: string; // 'AAAA-MM-DD' quando veio do desafio diário
}

export interface SaveData {
  version: 1;
  births: BirthRecord[];
  achievements: Record<string, string>; // id -> ISO de desbloqueio
  lastDaily?: string;
  dailyResult?: BirthRecord;
}

const STORAGE_KEY = 'droplife-save-v1';

export const emptySave = (): SaveData => ({ version: 1, births: [], achievements: {} });

export const loadSave = (): SaveData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1 || !Array.isArray(data.births)) return emptySave();
    if (!data.achievements || typeof data.achievements !== 'object') data.achievements = {};
    return data;
  } catch {
    return emptySave();
  }
};

export const persistSave = (save: SaveData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // armazenamento cheio ou bloqueado — o jogo segue funcionando sem persistir
  }
};
