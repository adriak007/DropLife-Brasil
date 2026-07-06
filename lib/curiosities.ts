import { editDistanceCap, keyFor, normalize, repairText } from './text';
import { CURIOSITY_SOURCES, ufToName } from './geo';

export type CuriosityMap = Map<string, string>;

interface RawCuriosity {
  municipio?: string;
  city?: string;
  nome?: string;
  estado?: string;
  uf?: string;
  state?: string;
  curiosidade?: string;
  texto?: string;
  text?: string;
}

// Corrige colagens "][", "[{...}][{...}]" e "},[" que surgem em alguns arquivos.
const parseCuriosityText = (text: string): RawCuriosity[] => {
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/^\uFEFF/, '')
    // Muitos arquivos trazem quebras de linha dentro das strings; trocar por espaços.
    .replace(/\n+/g, ' ')
    .trim();
  cleaned = cleaned.replace(/\}\s*,?\s*\[\s*\{/g, '},{');
  cleaned = cleaned.replace(/\]\s*\[\s*/g, ',');
  cleaned = cleaned.replace(/\]\s*\]+$/g, ']');
  cleaned = cleaned.replace(/,\s*\]/g, ']');
  if (!cleaned.startsWith('[')) cleaned = `[${cleaned}`;
  if (!cleaned.endsWith(']')) cleaned = `${cleaned}]`;
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Falha ao fazer parse de curiosidade (tentando fallback)', err);
    try {
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket > 0) return JSON.parse(cleaned.slice(0, lastBracket + 1));
    } catch (err2) {
      console.warn('Fallback tambem falhou', err2);
    }
    return [];
  }
};

const fallbackExtractCuriosities = (text: string): RawCuriosity[] => {
  const results: RawCuriosity[] = [];
  const regex =
    /"municipio"\s*:\s*"([^"]*?)"\s*,\s*"estado"\s*:\s*"([^"]*?)"\s*,\s*"curiosidade"\s*:\s*"([^"]*?)"/gi;
  let match;
  while ((match = regex.exec(text))) {
    results.push({ municipio: match[1], estado: match[2], curiosidade: match[3] });
  }
  return results;
};

export const loadCuriosities = async (): Promise<CuriosityMap> => {
  const curiosities: CuriosityMap = new Map();
  const loaders = CURIOSITY_SOURCES.map(async (path) => {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        console.warn('Curiosidade nao carregada de', path);
        return;
      }
      const buffer = await res.arrayBuffer();
      const decode = (enc: string) => new TextDecoder(enc, { fatal: false }).decode(buffer);
      let text = '';
      let data: RawCuriosity[] = [];
      try {
        text = decode('utf-8');
        data = parseCuriosityText(text);
      } catch {
        data = [];
      }
      if (!data.length) {
        try {
          text = decode('iso-8859-1');
          data = parseCuriosityText(text);
        } catch {
          data = [];
        }
      }
      if (!Array.isArray(data)) data = [];
      if (!data.length) data = fallbackExtractCuriosities(text);
      let added = 0;
      data.forEach((item) => {
        const city = repairText((item.municipio || item.city || item.nome || '').trim());
        const state = repairText((item.estado || item.uf || item.state || '').trim());
        const textCur = repairText(item.curiosidade || item.texto || item.text);
        if (city && state && textCur) {
          curiosities.set(keyFor(city, state), String(textCur));
          added += 1;
        }
      });
      if (!added) console.warn('Nenhuma curiosidade adicionada de', path);
    } catch (err) {
      console.warn('Erro ao carregar curiosidade de', path, err);
    }
  });
  await Promise.all(loaders);
  return curiosities;
};

export const curiosityFor = (
  curiosities: CuriosityMap,
  city: string,
  state: string
): string => {
  const stateName = ufToName[state] || state || 'Brasil';
  const stored =
    curiosities.get(keyFor(city, state)) || curiosities.get(keyFor(city, stateName));
  if (stored) return stored;

  // Fallback aproximado para lidar com acentuação corrompida em alguns JSONs
  const target = normalize(city);
  const stateVariants = new Set([normalize(state || ''), normalize(stateName || '')]);
  let best: string | null = null;
  let bestScore = 3;
  curiosities.forEach((value, k) => {
    const suffix = k.split('-').pop();
    if (!suffix || !stateVariants.has(suffix)) return;
    const cityKey = k.replace(/-[^-]+$/, '');
    const score = editDistanceCap(target, cityKey, 2);
    if (score < bestScore) {
      bestScore = score;
      best = value;
    }
  });
  if (best) return best;

  return 'Curiosidade nao disponivel.';
};
