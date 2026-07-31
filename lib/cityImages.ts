// Imagens estáticas dos municípios, geradas por `npm run gerar-imagens`
// (Wikidata + Wikipedia → public/cidade_imagens.json).
//
// Performance: os JSONs NÃO entram no bundle JS (um require() aqui os
// embutiria e somaria ~215 KB de parse na thread principal — foi o que
// derrubou o TBT no Lighthouse). Eles são buscados via fetch dos arquivos
// estáticos do próprio site, fora do caminho crítico (preloadCityImages é
// chamado em idle), e ficam em cache do navegador. Nenhuma API externa é
// consultada em runtime.
import { keyFor, normalize, stripNota } from './text';
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

let index: Map<string, string> | null = null;
let imagens: Record<string, CidadeImagem> | null = null;
let loading: Promise<void> | null = null;

// Baixa os JSONs e monta o índice (cidade-estado normalizado) → codigo_ibge
// nas DUAS formas de estado: por extenso ("belem-para") e sigla ("belem-pa").
// O save do jogo usa a sigla, o municipios.json usa o nome (padrão de
// population.ts). Idempotente: chamadas repetidas reusam a mesma promise.
export const preloadCityImages = (): Promise<void> => {
  if (loading) return loading;
  loading = (async () => {
    try {
      const [munRes, imgRes] = await Promise.all([
        fetch('/municipios.json'),
        fetch('/cidade_imagens.json'),
      ]);
      if (!munRes.ok || !imgRes.ok) return;
      const municipios = (await munRes.json()) as MunicipioRow[];
      const imgs = (await imgRes.json()) as Record<string, CidadeImagem>;

      const nameToUf = new Map(
        Object.entries(ufToName).map(([uf, nome]) => [normalize(nome), uf])
      );
      const map = new Map<string, string>();
      for (const { codigo_ibge, municipio, estado } of municipios) {
        const nome = stripNota(municipio);
        const baseKey = keyFor(nome, estado);
        if (!map.has(baseKey)) map.set(baseKey, codigo_ibge);
        const uf = nameToUf.get(normalize(estado));
        if (uf && !map.has(keyFor(nome, uf))) map.set(keyFor(nome, uf), codigo_ibge);
      }
      index = map;
      imagens = imgs;
    } catch {
      // sem rede/arquivo — o jogo segue sem imagens nesta sessão
    }
  })();
  return loading;
};

// Imagem do município ou null (o caller decide o placeholder). Síncrono:
// devolve null até o preload terminar. Aceita o estado como sigla ou por
// extenso.
export const cityImageFor = (city: string, state: string): string | null => {
  if (!index || !imagens) return null;
  const code =
    index.get(keyFor(city, state || '')) || index.get(keyFor(city, ufToName[state] || ''));
  if (!code) return null;
  const img = imagens[code]?.img;
  if (!img) return null;
  // Wikidata devolve URLs http:// — força https para evitar mixed content
  return img.replace(/^http:\/\//, 'https://');
};
