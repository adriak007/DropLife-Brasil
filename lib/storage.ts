export interface BirthRecord {
  key: string;
  city: string;
  state: string;
  population: number;
  chance: string;
  bornAt: string; // ISO
  daily?: string; // 'AAAA-MM-DD' quando veio do desafio diário
  // Resultado do palpite do Desafio Diário (só quando `daily` está presente)
  dailyCorrect?: boolean;
  dailyGuessCity?: string; // cidade em que o jogador clicou, quando errou
  dailyGuessState?: string;
}

export interface SaveData {
  version: 1;
  births: BirthRecord[];
  achievements: Record<string, string>; // id -> ISO de desbloqueio
  lastDaily?: string;
  dailyResult?: BirthRecord;
}

// ── Escopos de save (isolamento por sessão autenticada) ──
//
// 'local'  -> jogo sem backend (Supabase desligado): não há contas, então o
//             progresso persiste em localStorage como sempre foi.
// 'guest'  -> visitante com backend ligado: progresso TEMPORÁRIO em
//             sessionStorage. Some ao fechar o navegador e é descartado no
//             login — nunca migra para uma conta.
// <uid>    -> usuário logado: cache local em chave exclusiva da conta
//             (droplife-save-v1:<uid>), populado a partir do servidor no
//             login e apagado no logout.
export type SaveScope = 'local' | 'guest' | string;

const LEGACY_KEY = 'droplife-save-v1';
const GUEST_KEY = 'droplife-save-guest';

const keyFor = (scope: SaveScope): string => {
  if (scope === 'local') return LEGACY_KEY;
  if (scope === 'guest') return GUEST_KEY;
  return `${LEGACY_KEY}:${scope}`;
};

const storeFor = (scope: SaveScope): Storage =>
  scope === 'guest' ? sessionStorage : localStorage;

export const emptySave = (): SaveData => ({ version: 1, births: [], achievements: {} });

const parseSave = (raw: string | null): SaveData | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1 || !Array.isArray(data.births)) return null;
    if (!data.achievements || typeof data.achievements !== 'object') data.achievements = {};
    return data;
  } catch {
    return null;
  }
};

export const loadSave = (scope: SaveScope): SaveData => {
  try {
    // Migração única: o save antigo compartilhado (localStorage) vira save de
    // visitante (sessionStorage) e a chave antiga é apagada — a partir daí o
    // progresso anônimo é sempre temporário.
    if (scope === 'guest') {
      const legacy = parseSave(localStorage.getItem(LEGACY_KEY));
      if (legacy && !sessionStorage.getItem(GUEST_KEY)) {
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(legacy));
      }
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    }
    return parseSave(storeFor(scope).getItem(keyFor(scope))) ?? emptySave();
  } catch {
    return emptySave();
  }
};

export const persistSave = (scope: SaveScope, save: SaveData): void => {
  try {
    storeFor(scope).setItem(keyFor(scope), JSON.stringify(save));
  } catch {
    // armazenamento cheio ou bloqueado — o jogo segue funcionando sem persistir
  }
};

export const clearSave = (scope: SaveScope): void => {
  try {
    storeFor(scope).removeItem(keyFor(scope));
    // Descartar o visitante também remove o save antigo compartilhado, para
    // que ele nunca reapareça depois de um login/logout.
    if (scope === 'guest') localStorage.removeItem(LEGACY_KEY);
  } catch {
    // sem acesso ao storage — nada a limpar
  }
};
