'use client';

import { useMemo, useState } from 'react';
import type { SaveData } from '@/lib/storage';
import { RARITY_TIERS, rarityFor } from '@/lib/rarity';
import { formatPop, normalize } from '@/lib/text';
import { ufToName } from '@/lib/geo';
import { cityImageFor } from '@/lib/cityImages';
import RarityIcon from '@/components/RarityIcon';

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
                const imgUrl = cityImageFor(b.city, b.state);
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
                // Placeholder leve quando o município não tem imagem
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
