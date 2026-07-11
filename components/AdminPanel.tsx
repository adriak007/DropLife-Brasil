'use client';

// Painel /admin: interface de moderação. Todo o poder está nas funções RPC
// do Supabase (SECURITY DEFINER + is_admin) — sem a flag no perfil, cada
// chamada volta "nao_autorizado", não importa o que o navegador tente.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { signIn, signOut } from '@/lib/online';
import { formatPop } from '@/lib/text';

interface PlayerRow {
  id: string;
  nickname: string;
  total_births: number;
  banned: boolean;
  banned_until: string | null;
  warning: string | null;
}

type Gate = 'carregando' | 'login' | 'negado' | 'admin';
type BanUnidade = 'minutos' | 'horas' | 'dias' | 'meses' | 'permanente';

const AVISO_PADRAO =
  '⚠️ Detectamos atividade suspeita na sua conta. O uso de programas, scripts ou qualquer manipulação do jogo viola as regras do DropLife Brasil. Se continuar, sua conta poderá ser banida permanentemente.';

const banAtivo = (p: PlayerRow): boolean =>
  p.banned && (!p.banned_until || new Date(p.banned_until) > new Date());

export default function AdminPanel() {
  const [gate, setGate] = useState<Gate>('carregando');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [novoTotal, setNovoTotal] = useState('');
  const [banindo, setBanindo] = useState<string | null>(null);
  const [banQtd, setBanQtd] = useState('24');
  const [banUnidade, setBanUnidade] = useState<BanUnidade>('horas');
  const [avisando, setAvisando] = useState<string | null>(null);
  const [avisoTexto, setAvisoTexto] = useState(AVISO_PADRAO);

  const checarAcesso = async () => {
    if (!supabase) {
      setGate('negado');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setGate('login');
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .maybeSingle();
    setGate(data?.is_admin ? 'admin' : 'negado');
  };

  useEffect(() => {
    checarAcesso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = async (filtro: string) => {
    if (!supabase) return;
    let query = supabase
      .from('profiles')
      .select('id,nickname,total_births,banned,banned_until,warning')
      .order('total_births', { ascending: false })
      .limit(100);
    if (filtro.trim()) query = query.ilike('nickname', `%${filtro.trim()}%`);
    const { data } = await query;
    setPlayers((data as PlayerRow[]) ?? []);
  };

  useEffect(() => {
    if (gate !== 'admin') return;
    const t = window.setTimeout(() => carregar(busca), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, busca]);

  const entrar = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErro('');
    const r = await signIn(email, senha);
    if (!r.ok) {
      setErro('Login inválido.');
      return;
    }
    setGate('carregando');
    checarAcesso();
  };

  const rpc = async (fn: string, args: Record<string, unknown>, okMsg: string) => {
    if (!supabase) return;
    setAviso('');
    const { error, data } = await supabase.rpc(fn, args);
    if (error) {
      setAviso(`❌ ${error.message}`);
      return;
    }
    setAviso(`✅ ${okMsg}${typeof data === 'number' ? ` (${data} removidas)` : ''}`);
    carregar(busca);
  };

  const aplicarBan = (p: PlayerRow) => {
    let ate: string | null = null;
    if (banUnidade !== 'permanente') {
      const qtd = parseInt(banQtd, 10);
      if (Number.isNaN(qtd) || qtd < 1) {
        setAviso('❌ Quantidade inválida.');
        return;
      }
      const d = new Date();
      if (banUnidade === 'minutos') d.setMinutes(d.getMinutes() + qtd);
      else if (banUnidade === 'horas') d.setHours(d.getHours() + qtd);
      else if (banUnidade === 'dias') d.setDate(d.getDate() + qtd);
      else d.setMonth(d.getMonth() + qtd);
      ate = d.toISOString();
    }
    setBanindo(null);
    rpc(
      'admin_set_ban',
      { alvo: p.id, banir: true, ate },
      `${p.nickname} banido ${banUnidade === 'permanente' ? 'permanentemente' : `por ${banQtd} ${banUnidade}`}`
    );
  };

  const desbanir = (p: PlayerRow) =>
    rpc('admin_set_ban', { alvo: p.id, banir: false, ate: null }, `${p.nickname} desbanido`);

  const enviarAviso = (p: PlayerRow) => {
    setAvisando(null);
    rpc(
      'admin_set_warning',
      { alvo: p.id, mensagem: avisoTexto },
      avisoTexto.trim() ? `aviso enviado a ${p.nickname}` : `aviso de ${p.nickname} removido`
    );
  };

  const aplicarTotal = (p: PlayerRow) => {
    const n = parseInt(novoTotal, 10);
    if (Number.isNaN(n) || n < 0) {
      setAviso('❌ Número inválido.');
      return;
    }
    if (n >= p.total_births) {
      setAviso('❌ Só é possível REDUZIR (inventar nascimento não existe nem para admin).');
      return;
    }
    setEditando(null);
    rpc('admin_trim_births', { alvo: p.id, manter: n }, `${p.nickname} ajustado para ${n} cidades`);
  };

  if (gate === 'carregando') {
    return <main className="admin"><p className="admin__estado">Carregando…</p></main>;
  }

  if (gate === 'login') {
    return (
      <main className="admin">
        <form className="admin__card admin__login" onSubmit={entrar}>
          <h1>🛡️ DropLife Admin</h1>
          <input
            className="dex-input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="dex-input"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro && <p className="admin__erro">{erro}</p>}
          <button className="admin__btn admin__btn--principal" type="submit">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  if (gate === 'negado') {
    return (
      <main className="admin">
        <div className="admin__card">
          <h1>⛔ Acesso negado</h1>
          <p className="admin__estado">Esta conta não tem permissão de administrador.</p>
          <button
            className="admin__btn"
            type="button"
            onClick={async () => {
              await signOut();
              setGate('login');
            }}
          >
            Trocar de conta
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin__card admin__painel">
        <div className="admin__topo">
          <h1>🛡️ DropLife Admin</h1>
          <button
            className="admin__btn"
            type="button"
            onClick={async () => {
              await signOut();
              setGate('login');
            }}
          >
            Sair
          </button>
        </div>

        <input
          className="dex-input"
          type="search"
          placeholder="Buscar apelido…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {aviso && <p className="admin__aviso">{aviso}</p>}

        <div className="admin__lista">
          {players.length === 0 && <p className="admin__estado">Nenhum jogador encontrado.</p>}
          {players.map((p) => (
            <div key={p.id} className={`admin__row${banAtivo(p) ? ' admin__row--banido' : ''}`}>
              <div className="admin__info">
                <strong>{p.nickname}</strong>
                <span>
                  {formatPop(p.total_births)} cidades
                  {banAtivo(p) &&
                    ` · 🚫 banido${p.banned_until ? ` até ${new Date(p.banned_until).toLocaleString('pt-BR')}` : ' (permanente)'}`}
                  {p.warning && ' · ⚠️ aviso pendente'}
                </span>
              </div>
              <div className="admin__acoes">
                {editando === p.id ? (
                  <>
                    <input
                      className="dex-input admin__num"
                      type="number"
                      min={0}
                      max={p.total_births - 1}
                      value={novoTotal}
                      onChange={(e) => setNovoTotal(e.target.value)}
                      autoFocus
                    />
                    <button className="admin__btn admin__btn--principal" type="button" onClick={() => aplicarTotal(p)}>
                      OK
                    </button>
                    <button className="admin__btn" type="button" onClick={() => setEditando(null)}>
                      ✕
                    </button>
                  </>
                ) : banindo === p.id ? (
                  <>
                    {banUnidade !== 'permanente' && (
                      <input
                        className="dex-input admin__num"
                        type="number"
                        min={1}
                        value={banQtd}
                        onChange={(e) => setBanQtd(e.target.value)}
                        autoFocus
                      />
                    )}
                    <select
                      className="dex-input admin__sel"
                      value={banUnidade}
                      onChange={(e) => setBanUnidade(e.target.value as BanUnidade)}
                    >
                      <option value="minutos">minutos</option>
                      <option value="horas">horas</option>
                      <option value="dias">dias</option>
                      <option value="meses">meses</option>
                      <option value="permanente">permanente</option>
                    </select>
                    <button className="admin__btn admin__btn--perigo" type="button" onClick={() => aplicarBan(p)}>
                      Banir
                    </button>
                    <button className="admin__btn" type="button" onClick={() => setBanindo(null)}>
                      ✕
                    </button>
                  </>
                ) : avisando === p.id ? (
                  <div className="admin__avisobox">
                    <textarea
                      className="dex-input admin__texto"
                      value={avisoTexto}
                      onChange={(e) => setAvisoTexto(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="admin__acoes">
                      <button className="admin__btn admin__btn--principal" type="button" onClick={() => enviarAviso(p)}>
                        Enviar aviso
                      </button>
                      <button className="admin__btn" type="button" onClick={() => setAvisando(null)}>
                        ✕
                      </button>
                      <span className="admin__dica">enviar vazio remove o aviso</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="admin__btn"
                      type="button"
                      title="Reduzir número de cidades"
                      onClick={() => {
                        setEditando(p.id);
                        setNovoTotal(String(p.total_births));
                      }}
                    >
                      ✏️ cidades
                    </button>
                    <button
                      className="admin__btn"
                      type="button"
                      title="Enviar aviso de moderação"
                      onClick={() => {
                        setAvisando(p.id);
                        setAvisoTexto(p.warning || AVISO_PADRAO);
                      }}
                    >
                      ⚠️ aviso
                    </button>
                    {banAtivo(p) ? (
                      <button className="admin__btn admin__btn--ok" type="button" onClick={() => desbanir(p)}>
                        Desbanir
                      </button>
                    ) : (
                      <button
                        className="admin__btn admin__btn--perigo"
                        type="button"
                        onClick={() => {
                          setBanindo(p.id);
                          setBanQtd('24');
                          setBanUnidade('horas');
                        }}
                      >
                        🚫 banir…
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
