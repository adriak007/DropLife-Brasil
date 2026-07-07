import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sem as variáveis de ambiente o jogo funciona normalmente, apenas offline
// (ranking desabilitado).
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
