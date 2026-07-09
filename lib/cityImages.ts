// Imagens estáticas dos municípios, geradas por `npm run gerar-imagens`
// (Wikidata + Wikipedia → public/cidade_imagens.json). Nenhuma requisição
// externa acontece em runtime: os dois JSONs entram no bundle e o lookup é
// feito em memória.
import { keyFor, normalize } from './text';
import { ufToName } from './geo';

interface MunicipioRow {
  codigo_ibge: string;
  municipio: string;
  estado: string;
  populacao: number;
}

interface CidadeImagem {
  img: string;
  fonte: string;
}

let municipios: MunicipioRow[] = [];
let imagens: Record<string, CidadeImagem> = {};

try {
  municipios = require('@/public/municipios.json');
} catch {
  // municipios.json indisponível — segue sem imagens
}

try {
  imagens = require('@/public/cidade_imagens.json');
} catch {
  // cidade_imagens.json ainda não foi gerado — segue sem imagens
}

// nome do estado por extenso (como vem no municipios.json) → sigla
const nameToUf = new Map(Object.entries(ufToName).map(([uf, nome]) => [normalize(nome), uf]));

// Índice (cidade-estado normalizado) → codigo_ibge, nas DUAS formas de
// estado: por extenso ("belem-para") e sigla ("belem-pa") — o save do jogo
// usa a sigla, o municipios.json usa o nome. Mesmo padrão de population.ts.
let index: Map<string, string> | null = null;

const buildIndex = (): Map<string, string> => {
  const map = new Map<string, string>();
  municipios.forEach(({ codigo_ibge, municipio, estado }) => {
    const baseKey = keyFor(municipio, estado);
    if (!map.has(baseKey)) map.set(baseKey, codigo_ibge);
    const uf = nameToUf.get(normalize(estado));
    if (uf && !map.has(keyFor(municipio, uf))) map.set(keyFor(municipio, uf), codigo_ibge);
  });
  return map;
};

// Imagem do município ou null (o caller decide o placeholder). Aceita o
// estado como sigla ou por extenso.
export const cityImageFor = (city: string, state: string): string | null => {
  if (!index) index = buildIndex();
  const code =
    index.get(keyFor(city, state || '')) || index.get(keyFor(city, ufToName[state] || ''));
  if (!code) return null;
  const img = imagens[code]?.img;
  if (!img) return null;
  // Wikidata devolve URLs http:// — força https para evitar mixed content
  return img.replace(/^http:\/\//, 'https://');
};
