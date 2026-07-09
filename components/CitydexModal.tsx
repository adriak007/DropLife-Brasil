'use client';

import { useMemo, useState } from 'react';
import type { SaveData } from '@/lib/storage';
import { RARITY_TIERS, rarityFor } from '@/lib/rarity';
import { formatPop, normalize } from '@/lib/text';
import { ufToName } from '@/lib/geo';
import RarityIcon from '@/components/RarityIcon';

interface MunicipioWithIBGE {
  codigo_ibge: string;
  municipio: string;
  estado: string;
  populacao: number;
}

interface CidadeImagem {
  img: string;
  fonte: 'wikidata' | 'wikipedia';
}

// Importa os JSONs estáticos gerados pelo script npm run gerar-imagens.
// Se não existirem, gracefully degrade para sem imagens.
let municipiosData: MunicipioWithIBGE[] | null = null;
let imagensData: Record<string, CidadeImagem> | null = null;

try {
  municipiosData = require('@/public/municipios.json');
} catch {
  // municipios.json pode não estar acessível em alguns builds
}

try {
  imagensData = require('@/public/cidade_imagens.json');
} catch {
  // cidade_imagens.json ainda não foi gerado ou não existe (não é erro crítico)
}

interface MunicipioWithIBGE {
  codigo_ibge: string;
  municipio: string;
  estado: string;
  populacao: number;
}

interface CidadeImagem {
  img: string;
  fonte: 'wikidata' | 'wikipedia';
}

interface Props {
  save: SaveData;
  total: number;
  onClose: () => void;
  onLocate: (uf: string) => void;
}

export default function CitydexModal({ save, total, onClose, onLocate }: Props) {
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState('');
  // Raridades selecionadas nos chips; vazio = mostra todas
  const [tierFilter, setTierFilter] = useState<string[]>([]);

  const toggleTier = (id: string) =>
    setTierFilter((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));

  const births = useMemo(() => [...save.births].reverse(), [save.births]);

  const ufsPresent = useMemo(
    () => [...new Set(save.births.map((b) => b.state))].sort(),
    [save.births]
  );

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();
    save.births.forEach((b) => {
      const tier = rarityFor(b.population);
      counts.set(tier.id, (counts.get(tier.id) || 0) + 1);
    });
    return counts;
  }, [save.births]);

  // Mapa (city-state normalizado) → codigo_ibge, preenchido uma única vez.
  // Permite lookup rápido de imagem pelo (city, state) que vem do save.
  const municipioIndex = useMemo(() => {
    const index = new Map<string, string>();
    if (municipiosData) {
      municipiosData.forEach(({ codigo_ibge, municipio, estado }) => {
        const key = `${normalize(municipio)}-${normalize(estado)}`;
        index.set(key, codigo_ibge);
      });
    }
    return index;
  }, []);

  // Mapa codigo_ibge → imagem, carregado uma única vez.
  // Preenchido pelo script npm run gerar-imagens.
  const imagemMap = useMemo(() => {
    const map = new Map<string, CidadeImagem>();
    if (imagensData) {
      Object.entries(imagensData).forEach(([codigoIBGE, info]) => {
        if (info.img) map.set(codigoIBGE, info);
      });
    }
    return map;
  }, []);

  // Busca imagem pelo (city, state) vindo do save local
  const getImagemMunicipio = (city: string, state: string): string | null => {
    const key = `${normalize(city)}-${normalize(state)}`;
    const codigoIBGE = municipioIndex.get(key);
    if (!codigoIBGE) return null;
    const imagem = imagemMap.get(codigoIBGE);
    return imagem?.img ?? null;
  };

  const filtered = births.filter((b) => {
    if (ufFilter && b.state !== ufFilter) return false;
    if (tierFilter.length && !tierFilter.includes(rarityFor(b.population).id)) return false;
    if (search && !normalize(b.city).includes(normalize(search))) return false;
    return true;
  });

  const pct = total ? ((save.births.length / total) * 100).toFixed(1) : '0';

  return (
    <div className="modal-panel modal-panel--wide">
      <div className="modal-header">
        <h2>
          Citydex <span className="dex-count">{save.births.length} / {formatPop(total)}</span>
        </h2>
        <button className="modal-close" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div className="progress" aria-label={`Progresso: ${pct}%`}>
        <div className="progress__fill" style={{ width: `${pct}%` }}></div>
      </div>

      <div className="tier-chips">
        {RARITY_TIERS.map((t) => {
          const active = tierFilter.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`tier-chip${active ? ' tier-chip--active' : ''}`}
              style={
                active
                  ? { background: t.color, borderColor: t.color, color: '#fff' }
                  : { borderColor: t.color, color: t.color }
              }
              onClick={() => toggleTier(t.id)}
              aria-pressed={active}
              title={active ? `Remover filtro ${t.label}` : `Mostrar só ${t.label}`}
            >
              <RarityIcon tier={t.id} />
              {t.label}: {tierCounts.get(t.id) || 0}
            </button>
          );
        })}
      </div>

      <div className="dex-controls">
        <input
          className="dex-input"
          type="search"
          placeholder="Buscar cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="dex-input dex-select"
          value={ufFilter}
          onChange={(e) => setUfFilter(e.target.value)}
        >
          <option value="">Todos os estados</option>
          {ufsPresent.map((uf) => (
            <option key={uf} value={uf}>
              {uf} — {ufToName[uf] || uf}
            </option>
          ))}
        </select>
      </div>

      <div className="overlay-list">
        {filtered.length === 0 && (
          <p className="overlay-empty">
            {save.births.length === 0
              ? 'Nenhuma cidade capturada ainda. Aperte NASCER para começar sua coleção!'
              : 'Nenhuma cidade encontrada com esse filtro.'}
          </p>
        )}
        {filtered.map((b) => {
          const tier = rarityFor(b.population);
          return (
            <button
              key={b.key + b.bornAt}
              className="dex-row"
              type="button"
              title={`Ver ${ufToName[b.state] || b.state} no mapa`}
              onClick={() => onLocate(b.state)}
            >
              {(() => {
                const imgUrl = getImagemMunicipio(b.city, b.state);
                if (imgUrl) {
                  return (
                    <img
                      className="dex-row__img"
                      src={imgUrl}
                      alt={b.city}
                      loading="lazy"
                      decoding="async"
                    />
                  );
                }
                // Placeholder: mostrar ícone de raridade maior
                return <div className="dex-row__placeholder" />;
              })()}
              <RarityIcon tier={tier.id} className="rarity-icon--row" />
              <span className="dex-row__city">
                {b.city} <em>({b.state})</em>
                {b.daily ? <span className="dex-daily" title="Desafio diário">📅</span> : null}
              </span>
              <span className="dex-row__meta">
                {formatPop(b.population)} hab · {b.chance}%
              </span>
              <span className="dex-row__date">
                {new Date(b.bornAt).toLocaleDateString('pt-BR')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
