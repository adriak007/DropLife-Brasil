import type { Municipio } from './types';
import { keyFor, normalize } from './text';
import { ufToName } from './geo';

export type PopulationIndex = Map<string, number>;

export const buildPopulationIndex = (municipios: Municipio[]): PopulationIndex => {
  const index: PopulationIndex = new Map();
  municipios.forEach(({ municipio, estado, populacao }) => {
    const baseKey = keyFor(municipio, estado);
    if (!index.has(baseKey)) index.set(baseKey, populacao);

    const uf = Object.entries(ufToName).find(
      ([, nome]) => normalize(nome) === normalize(estado)
    )?.[0];

    if (uf) {
      index.set(keyFor(municipio, uf), populacao);
      index.set(keyFor(municipio, ufToName[uf]), populacao);
    }
  });
  return index;
};

export const getPopulation = (
  index: PopulationIndex | null,
  state: string,
  city: string
): number | null => {
  if (!index || !city) return null;
  const lookup =
    index.get(keyFor(city, state || '')) ||
    index.get(keyFor(city, ufToName[state] || ''));
  return lookup || null;
};
