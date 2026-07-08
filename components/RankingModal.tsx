'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchCityRanking,
  fetchPlayerRanking,
  onlineEnabled,
  saveNickname,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  type AuthError,
  type AuthResult,
  type AuthState,
  type CityRankRow,
  type PlayerRankRow,
} from '@/lib/online';
import { formatPop } from '@/lib/text';

type Tab = 'cidades' | 'jogadores';
type AuthMode = 'entrar' | 'criar';

const MEDALS = ['🥇', '🥈', '🥉'];

const ERROR_MSG: Record<AuthError, string> = {
  offline: 'Ranking indisponível no momento.',
  email_em_uso: 'Esse e-mail já tem conta. Use a aba Entrar.',
  apelido_em_uso: 'Esse apelido já está em uso. Tente outro!',
  credenciais_invalidas: 'E-mail ou senha incorretos.',
  senha_curta: 'A senha precisa ter pelo menos 6 caracteres.',
  email_nao_confirmado: 'Confirme seu e-mail antes de entrar — olhe sua caixa de entrada.',
  limite_email: 'Muitos cadastros agora. Tente de novo em alguns minutos.',
  google_indisponivel: 'Login com Google chega em breve!',
  erro: 'Algo deu errado. Tente de novo.',
};

interface Props {
  auth: AuthState;
  resolveCity: (key: string) => { city: string; state: string } | null;
  onAuthChanged: () => Promise<void>;
  onClose: () => void;
}

export default function RankingModal({ auth, resolveCity, onAuthChanged, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cidades');
  const [cities, setCities] = useState<CityRankRow[] | null>(null);
  const [players, setPlayers] = useState<PlayerRankRow[] | null>(null);

  const [mode, setMode] = useState<AuthMode>('criar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!onlineEnabled()) return;
    if (tab === 'cidades' && cities === null) fetchCityRanking().then(setCities);
    if (tab === 'jogadores' && players === null) fetchPlayerRanking().then(setPlayers);
  }, [tab, cities, players]);

  const run = async (fn: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const result = await fn();
    if (result.ok && result.pending) {
      setPendingEmail(email.trim());
    } else if (result.ok) {
      await onAuthChanged();
      setPlayers(null); // recarrega ranking de jogadores
    } else if (result.error) {
      setFormError(ERROR_MSG[result.error]);
    }
    setBusy(false);
  };

  const handleSubmit = () => {
    if (mode === 'criar') {
      if (nick.trim().length < 2) {
        setFormError('Escolha um apelido de 2 a 20 caracteres.');
        return;
      }
      run(() => signUp(email.trim(), password, nick));
    } else {
      run(() => signIn(email.trim(), password));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    await onAuthChanged();
  };

  const loading = tab === 'cidades' ? cities === null : players === null;
  const { signedIn, profile } = auth;

  return (
    <div className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h2>Ranking Global 🌍</h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      {!onlineEnabled() ? (
        <p className="overlay-empty">O ranking global ainda não está disponível. Em breve!</p>
      ) : (
        <>
          {signedIn && profile ? (
            <p className="rank-identity">
              Jogando como <strong>{profile.nickname}</strong> · seus nascimentos contam no
              ranking ·{' '}
              <button className="rank-signout" type="button" onClick={handleSignOut}>
                sair
              </button>
            </p>
          ) : signedIn && !profile ? (
            <div className="join-box">
              <p>Falta só o apelido para aparecer no ranking:</p>
              <div className="join-box__row">
                <input
                  className="dex-input"
                  type="text"
                  maxLength={20}
                  placeholder="Seu apelido (2 a 20 letras)"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && run(() => saveNickname(nick))}
                />
                <button
                  className="share-btn join-box__btn"
                  type="button"
                  disabled={busy || nick.trim().length < 2}
                  onClick={() => run(() => saveNickname(nick))}
                >
                  {busy ? 'Salvando…' : 'Salvar apelido'}
                </button>
              </div>
              {formError && <p className="join-box__error">{formError}</p>}
            </div>
          ) : pendingEmail ? (
            <div className="join-box join-box--pending">
              <p>
                📧 <strong>Conta criada!</strong> Enviamos um link de confirmação para{' '}
                <strong>{pendingEmail}</strong>. Clique no link (confira o spam também) e depois
                entre com seu e-mail e senha.
              </p>
              <button
                className="share-btn"
                type="button"
                onClick={() => {
                  setPendingEmail(null);
                  setMode('entrar');
                }}
              >
                Já confirmei — entrar
              </button>
            </div>
          ) : (
            <div className="join-box">
              <div className="rank-tabs auth-tabs">
                <button
                  className={`rank-tab${mode === 'criar' ? ' rank-tab--active' : ''}`}
                  type="button"
                  onClick={() => { setMode('criar'); setFormError(null); }}
                >
                  Criar conta
                </button>
                <button
                  className={`rank-tab${mode === 'entrar' ? ' rank-tab--active' : ''}`}
                  type="button"
                  onClick={() => { setMode('entrar'); setFormError(null); }}
                >
                  Entrar
                </button>
              </div>

              {mode === 'criar' && (
                <input
                  className="dex-input auth-field"
                  type="text"
                  maxLength={20}
                  placeholder="Apelido (aparece no ranking)"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                />
              )}
              <input
                className="dex-input auth-field"
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="dex-input auth-field"
                type="password"
                placeholder={mode === 'criar' ? 'Senha (mínimo 6 caracteres)' : 'Senha'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />

              <button
                className="share-btn auth-submit"
                type="button"
                disabled={busy || !email.includes('@') || password.length < 6}
                onClick={handleSubmit}
              >
                {busy ? 'Aguarde…' : mode === 'criar' ? 'Criar conta e entrar' : 'Entrar'}
              </button>

              <button
                className="google-btn"
                type="button"
                disabled={busy}
                onClick={() => run(() => signInWithGoogle())}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.55 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.85.55 3.9 1.45l2.15-2.15A9 9 0 1 0 12 21c5.2 0 8.85-3.65 8.85-8.8 0-.4-.05-.75-.1-1.1z"
                  />
                </svg>
                Entrar com Google
              </button>

              {formError && <p className="join-box__error">{formError}</p>}

              <p className="guest-note">
                Ou continue como <strong>visitante</strong> — o jogo funciona normalmente, só
                não entra no ranking.
              </p>
              <p className="guest-note">
                Ao criar uma conta você concorda com nossa{' '}
                <Link href="/politica-de-privacidade" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          )}

          <div className="rank-tabs">
            <button
              className={`rank-tab${tab === 'cidades' ? ' rank-tab--active' : ''}`}
              type="button"
              onClick={() => setTab('cidades')}
            >
              🏙️ Cidades
            </button>
            <button
              className={`rank-tab${tab === 'jogadores' ? ' rank-tab--active' : ''}`}
              type="button"
              onClick={() => setTab('jogadores')}
            >
              👶 Jogadores
            </button>
          </div>

          <div className="overlay-list">
            {loading && <p className="overlay-empty">Carregando ranking…</p>}

            {tab === 'cidades' &&
              cities?.map((row, i) => {
                const info = resolveCity(row.city_key);
                return (
                  <div key={row.city_key} className="dex-row rank-row">
                    <span className="rank-pos">{MEDALS[i] || `${i + 1}º`}</span>
                    <span className="dex-row__city">
                      {info ? (
                        <>
                          {info.city} <em>({info.state})</em>
                        </>
                      ) : (
                        row.city_key
                      )}
                    </span>
                    <span className="dex-row__meta">
                      {formatPop(row.births)} {row.births === 1 ? 'nascimento' : 'nascimentos'}
                    </span>
                  </div>
                );
              })}

            {tab === 'cidades' && cities !== null && cities.length === 0 && (
              <p className="overlay-empty">
                Nenhum nascimento registrado ainda. Seja o primeiro do mundo! 👶
              </p>
            )}

            {tab === 'jogadores' &&
              players?.map((row, i) => {
                const isYou = profile && row.nickname === profile.nickname;
                return (
                  <div
                    key={row.nickname}
                    className={`dex-row rank-row${isYou ? ' rank-row--you' : ''}`}
                  >
                    <span className="rank-pos">{MEDALS[i] || `${i + 1}º`}</span>
                    <span className="dex-row__city">
                      {row.nickname}
                      {isYou ? <span className="rank-you-tag">você</span> : null}
                    </span>
                    <span className="dex-row__meta">
                      {formatPop(row.total_births)}{' '}
                      {row.total_births === 1 ? 'cidade' : 'cidades'}
                    </span>
                  </div>
                );
              })}

            {tab === 'jogadores' && players !== null && players.length === 0 && (
              <p className="overlay-empty">
                Ninguém no ranking ainda. Crie sua conta e abra o placar!
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
