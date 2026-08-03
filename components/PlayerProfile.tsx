'use client';

import { useEffect, useState } from 'react';
import { fetchPublicProfile, type PublicProfile } from '@/lib/online';
import { ufToName } from '@/lib/geo';
import { formatPop } from '@/lib/text';

const MEDALS = ['🥇', '🥈', '🥉'];
const UF_TOTAL = 27; // 26 estados + Distrito Federal

const formatData = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

interface Props {
  nickname: string;
  totalCities: number;
  isYou: boolean;
  onBack: () => void;
}

export default function PlayerProfile({ nickname, totalCities, isYou, onBack }: Props) {
  const [perfil, setPerfil] = useState<PublicProfile | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setPerfil(null);
    setErro(false);
    fetchPublicProfile(nickname).then((p) => {
      if (cancelado) return;
      if (p) setPerfil(p);
      else setErro(true);
    });
    return () => {
      cancelado = true;
    };
  }, [nickname]);

  const pct = perfil && totalCities ? (perfil.total_births / totalCities) * 100 : 0;
  const desde = formatData(perfil?.membro_desde ?? null);
  const ultima = formatData(perfil?.ultimo_nascimento ?? null);
  const maxEstado = perfil?.top_estados?.[0]?.n || 1;

  return (
    <div className="perfil">
      <button className="perfil__voltar" type="button" onClick={onBack}>
        ← Voltar ao ranking
      </button>

      {!perfil && !erro && <p className="overlay-empty">Carregando perfil…</p>}
      {erro && <p className="overlay-empty">Não foi possível carregar este perfil.</p>}

      {perfil && (
        <>
          <div className="perfil__topo">
            <span className="perfil__avatar">{perfil.nickname.charAt(0).toUpperCase()}</span>
            <div className="perfil__id">
              <h3>
                {perfil.nickname}
                {isYou && <span className="rank-you-tag">você</span>}
              </h3>
              {perfil.posicao !== null && (
                <span className="perfil__pos">
                  {MEDALS[perfil.posicao - 1] || `${perfil.posicao}º`} no ranking global
                </span>
              )}
            </div>
          </div>

          <div className="perfil__barra">
            <div className="perfil__barra-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="perfil__barra-txt">
            <strong>{formatPop(perfil.total_births)}</strong> de {formatPop(totalCities)} cidades
            do Brasil · {pct.toFixed(pct < 1 ? 2 : 1)}%
          </p>

          <div className="perfil__cards">
            {perfil.estados_distintos !== null && (
              <div className="perfil__card">
                <span className="perfil__card-num">
                  {perfil.estados_distintos}
                  <em>/{UF_TOTAL}</em>
                </span>
                <span className="perfil__card-lbl">estados explorados</span>
              </div>
            )}
            {desde && (
              <div className="perfil__card">
                <span className="perfil__card-num perfil__card-num--sm">{desde}</span>
                <span className="perfil__card-lbl">joga desde</span>
              </div>
            )}
            {ultima && (
              <div className="perfil__card">
                <span className="perfil__card-num perfil__card-num--sm">{ultima}</span>
                <span className="perfil__card-lbl">último nascimento</span>
              </div>
            )}
          </div>

          {perfil.top_estados.length > 0 && (
            <div className="perfil__estados">
              <h4>Onde mais nasceu</h4>
              {perfil.top_estados.map((e) => (
                <div key={e.uf} className="perfil__estado">
                  <span className="perfil__estado-uf">{e.uf}</span>
                  <span className="perfil__estado-bar">
                    <span style={{ width: `${(e.n / maxEstado) * 100}%` }} />
                  </span>
                  <span className="perfil__estado-n">{formatPop(e.n)}</span>
                  <span className="perfil__estado-nome">{ufToName[e.uf] || ''}</span>
                </div>
              ))}
            </div>
          )}

          {perfil.posicao === null && (
            <p className="perfil__nota">
              Estatísticas detalhadas ainda não disponíveis para este perfil.
            </p>
          )}
        </>
      )}
    </div>
  );
}
