import { supabase } from './supabaseClient';

export interface OnlineProfile {
  id: string;
  nickname: string;
  total_births: number;
  // Moderação: presentes só depois da migração (colunas em profiles)
  banned?: boolean;
  banned_until?: string | null;
  warning?: string | null;
}

// Ban ativo do perfil: null se não banido (ou ban já expirado).
// until = null significa banimento permanente.
export const activeBan = (
  profile: OnlineProfile | null
): { until: Date | null } | null => {
  if (!profile?.banned) return null;
  if (!profile.banned_until) return { until: null };
  const until = new Date(profile.banned_until);
  return until > new Date() ? { until } : null;
};

export interface AuthState {
  signedIn: boolean;
  userId: string | null; // id da sessão autenticada — chave do isolamento de progresso
  profile: OnlineProfile | null; // sessão pode existir sem perfil (ex.: pós-Google)
}

export interface CityRankRow {
  city_key: string;
  births: number;
}

export interface PlayerRankRow {
  nickname: string;
  total_births: number;
}

// Perfil público de um jogador do ranking. Só agregados — a lista de
// cidades de outra pessoa é protegida por RLS e nunca chega ao cliente.
export interface PublicProfile {
  nickname: string;
  total_births: number;
  membro_desde: string | null;
  posicao: number | null;
  estados_distintos: number | null;
  primeiro_nascimento: string | null;
  ultimo_nascimento: string | null;
  top_estados: { uf: string; n: number }[];
}

export type AuthError =
  | 'offline'
  | 'email_em_uso'
  | 'apelido_em_uso'
  | 'credenciais_invalidas'
  | 'senha_curta'
  | 'email_nao_confirmado'
  | 'limite_email'
  | 'google_indisponivel'
  | 'erro';

export interface AuthResult {
  ok: boolean;
  pending?: boolean; // conta criada, aguardando confirmação por e-mail
  error?: AuthError;
}

const NICK_OK = /^.{2,20}$/;

export const onlineEnabled = (): boolean => Boolean(supabase);

// Busca o perfil com as colunas de moderação; se a migração (banned /
// banned_until) ainda não tiver sido aplicada, cai no select básico.
const fetchProfile = async (uid: string): Promise<OnlineProfile | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nickname,total_births,banned,banned_until,warning')
    .eq('id', uid)
    .maybeSingle();
  if (!error) return data;
  const { data: plain } = await supabase
    .from('profiles')
    .select('id,nickname,total_births')
    .eq('id', uid)
    .maybeSingle();
  return plain;
};

export const getAuthState = async (): Promise<AuthState> => {
  if (!supabase) return { signedIn: false, userId: null, profile: null };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { signedIn: false, userId: null, profile: null };
    const uid = session.user.id;
    const data = await fetchProfile(uid);
    if (data) return { signedIn: true, userId: uid, profile: data };

    // Sessão sem perfil (ex.: primeiro login após confirmar o e-mail):
    // cria o perfil com o apelido guardado nos metadados do cadastro.
    const metaNick = (session.user.user_metadata?.nickname as string | undefined)?.trim();
    if (metaNick && metaNick.length >= 2) {
      const created = await saveNickname(metaNick);
      if (created.ok) {
        const fresh = await fetchProfile(uid);
        return { signedIn: true, userId: uid, profile: fresh ?? null };
      }
    }
    return { signedIn: true, userId: uid, profile: null };
  } catch {
    return { signedIn: false, userId: null, profile: null };
  }
};

export const onAuthChange = (callback: () => void): (() => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
};

// Cria/atualiza o apelido do usuário logado
export const saveNickname = async (
  nickname: string
): Promise<{ ok: boolean; error?: AuthError }> => {
  if (!supabase) return { ok: false, error: 'offline' };
  const nick = nickname.trim();
  if (!NICK_OK.test(nick)) return { ok: false, error: 'erro' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'erro' };
    const uid = session.user.id;

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

export const signUp = async (
  email: string,
  password: string,
  nickname: string
): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'offline' };
  if (password.length < 6) return { ok: false, error: 'senha_curta' };
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // o apelido viaja nos metadados e vira perfil no primeiro login
      options: { data: { nickname: nickname.trim() } },
    });
    if (error) {
      if (/already registered/i.test(error.message)) return { ok: false, error: 'email_em_uso' };
      if (/rate limit/i.test(error.message)) return { ok: false, error: 'limite_email' };
      if (/password/i.test(error.message)) return { ok: false, error: 'senha_curta' };
      return { ok: false, error: 'erro' };
    }
    // Com "Confirm email" ativado a sessão só abre depois do clique no link
    if (!data.session) {
      // e-mail já cadastrado também cai aqui (Supabase mascara por segurança)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { ok: false, error: 'email_em_uso' };
      }
      return { ok: true, pending: true };
    }
    return saveNickname(nickname);
  } catch {
    return { ok: false, error: 'erro' };
  }
};

export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/not confirmed/i.test(error.message)) return { ok: false, error: 'email_nao_confirmado' };
      return { ok: false, error: 'credenciais_invalidas' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'erro' };
  }
};

// Preparado para quando o provedor Google for configurado no Supabase.
// Ligue com NEXT_PUBLIC_GOOGLE_LOGIN=1 (senão o botão avisa "em breve"
// sem navegar para uma página de erro).
export const signInWithGoogle = async (): Promise<{ ok: boolean; error?: AuthError }> => {
  if (!supabase) return { ok: false, error: 'offline' };
  if (process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== '1') {
    return { ok: false, error: 'google_indisponivel' };
  }
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: 'google_indisponivel' };
    return { ok: true }; // navegador redireciona para o Google
  } catch {
    return { ok: false, error: 'google_indisponivel' };
  }
};

export const signOut = async (): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {}
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

// O jogador confirma que viu o aviso da moderação (limpa só o dele)
export const ackWarning = async (): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.rpc('ack_warning');
  } catch {
    // sem rede — o aviso reaparece na próxima sessão, sem problema
  }
};

export interface ServerBirthRow {
  city_key: string;
  created_at: string | null;
}

// Busca TODOS os nascimentos salvos da conta logada — fonte da verdade do
// progresso após o login. Retorna null em falha (para o caller decidir o
// fallback) e [] quando a conta realmente não tem nascimentos.
export const fetchMyBirths = async (): Promise<ServerBirthRow[] | null> => {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const uid = session.user.id;
    const { data, error } = await supabase
      .from('births')
      .select('city_key,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    if (!error) return data ?? [];
    // Tabela sem a coluna created_at: busca só as chaves
    const { data: plain, error: err2 } = await supabase
      .from('births')
      .select('city_key')
      .eq('user_id', uid);
    if (err2) return null;
    return (plain ?? []).map((r) => ({ city_key: r.city_key, created_at: null }));
  } catch {
    return null;
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

// Perfil público de um jogador. Usa a RPC perfil_publico (supabase/
// perfil-publico.sql), que é quem consegue agregar os nascimentos sem furar
// a RLS. Se a função ainda não existir no banco, cai no que a tabela de
// perfis já expõe publicamente — a tela continua funcionando, só com menos
// estatísticas.
export const fetchPublicProfile = async (nickname: string): Promise<PublicProfile | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('perfil_publico', { p_nickname: nickname });
    if (!error && data) return data as PublicProfile;
  } catch {
    // RPC ausente: segue para o modo reduzido
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('nickname,total_births,created_at')
      .eq('nickname', nickname)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      nickname: data.nickname,
      total_births: data.total_births,
      membro_desde: (data as { created_at?: string }).created_at ?? null,
      posicao: null,
      estados_distintos: null,
      primeiro_nascimento: null,
      ultimo_nascimento: null,
      top_estados: [],
    };
  } catch {
    return null;
  }
};

export const fetchPlayerRanking = async (limit = 100): Promise<PlayerRankRow[]> => {
  if (!supabase) return [];
  try {
    // banned exige a coluna criada no banco (migração de moderação); se ela
    // ainda não existir, o fallback abaixo busca sem o filtro.
    const { data, error } = await supabase
      .from('profiles')
      .select('nickname,total_births')
      .eq('banned', false)
      .gt('total_births', 0)
      .order('total_births', { ascending: false })
      .limit(limit);
    if (!error) return data ?? [];
    const { data: plain } = await supabase
      .from('profiles')
      .select('nickname,total_births')
      .gt('total_births', 0)
      .order('total_births', { ascending: false })
      .limit(limit);
    return plain ?? [];
  } catch {
    return [];
  }
};
