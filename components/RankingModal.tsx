'use client';

import { useEffect, useState } from 'react';
import {
  fetchCityRanking,
  fetchPlayerRanking,
  onlineEnabled,
  type CityRankRow,
  type OnlineProfile,
  type PlayerRankRow,
} from '@/lib/online';
import { formatPop } from '@/lib/text';

type Tab = 'cidades' | 'jogadores';

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  profile: OnlineProfile | null;
  resolveCity: (key: string) => { city: string; state: string } | null;
  onJoin: (nickname: string) => Promise<string | null>; // retorna mensagem de erro ou null
  onClose: () => void;
}

export default function RankingModal({ profile, resolveCity, onJoin, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cidades');
  const [cities, setCities] = useState<CityRankRow[] | null>(null);
  const [players, setPlayers] = useState<PlayerRankRow[] | null>(null);
  const [nick, setNick] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!onlineEnabled()) return;
    if (tab === 'cidades' && cities === null) {
      fetchCityRanking().then(setCities);
    }
    if (tab === 'jogadores' && players === null) {
      fetchPlayerRanking().then(setPlayers);
    }
  }, [tab, cities, players]);

  const handleJoin = async () => {
    if (joining || nick.trim().length < 2) return;
    setJoining(true);
    setJoinError(null);
    const err = await onJoin(nick);
    setJoining(false);
    if (err) setJoinError(err);
  };

  const loading = tab === 'cidades' ? cities === null : players === null;

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
          {profile ? (
            <p className="rank-identity">
              Jogando como <strong>{profile.nickname}</strong> · seus nascimentos contam no
              ranking
            </p>
          ) : (
            <div className="join-box">
              <p>Escolha um apelido para entrar no ranking — seus próximos nascimentos passam a contar:</p>
              <div className="join-box__row">
                <input
                  className="dex-input"
                  type="text"
                  maxLength={20}
                  placeholder="Seu apelido (2 a 20 letras)"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button
                  className="share-btn join-box__btn"
                  type="button"
                  disabled={joining || nick.trim().length < 2}
                  onClick={handleJoin}
                >
                  {joining ? 'Entrando…' : 'Entrar no ranking'}
                </button>
              </div>
              {joinError && <p className="join-box__error">{joinError}</p>}
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
              <p className="overlay-empty">Ninguém no ranking ainda. Escolha seu apelido e abra o placar!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
