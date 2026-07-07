import { supabase } from './supabaseClient';

export interface OnlineProfile {
  id: string;
  nickname: string;
  total_births: number;
}

export interface CityRankRow {
  city_key: string;
  births: number;
}

export interface PlayerRankRow {
  nickname: string;
  total_births: number;
}

export const onlineEnabled = (): boolean => Boolean(supabase);

// Perfil da sessão atual (conta anônima persistida no navegador)
export const getSessionProfile = async (): Promise<OnlineProfile | null> => {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id,nickname,total_births')
      .eq('id', session.user.id)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
};

// Entra no ranking: cria conta anônima (se preciso) e registra o apelido
export const joinRanking = async (
  nickname: string
): Promise<{ ok: boolean; error?: 'apelido_em_uso' | 'offline' | 'erro' }> => {
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) return { ok: false, error: 'erro' };
      session = data.session;
    }
    const uid = session.user.id;
    const nick = nickname.trim();

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', uid)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from('profiles').update({ nickname: nick }).eq('id', uid)
      : await supabase.from('profiles').insert({ id: uid, nickname: nick });

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'apelido_em_uso' };
      return { ok: false, error: 'erro' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'erro' };
  }
};

// Registra um nascimento no ranking global (dispara e esquece).
// O servidor garante: cidade real, 1x por jogador e rate-limit.
export const recordBirth = async (cityKey: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { error } = await supabase
      .from('births')
      .insert({ user_id: session.user.id, city_key: cityKey });
    if (error && error.code !== '23505') {
      console.warn('recordBirth:', error.message);
      return false;
    }
    return !error;
  } catch {
    return false;
  }
};

export const fetchCityRanking = async (limit = 100): Promise<CityRankRow[]> => {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('city_counts')
      .select('city_key,births')
      .order('births', { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
};

export const fetchPlayerRanking = async (limit = 100): Promise<PlayerRankRow[]> => {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('profiles')
      .select('nickname,total_births')
      .gt('total_births', 0)
      .order('total_births', { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
};
