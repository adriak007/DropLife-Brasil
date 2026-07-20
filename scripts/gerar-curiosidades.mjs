#!/usr/bin/env node

/**
 * FASE 1 das novas curiosidades: coleta o "dossiê" verificável de cada
 * município (Wikipedia PT + Wikidata via código IBGE) e salva em
 * scripts/data/curiosidades-material.json.
 *
 * Esse material é a matéria-prima da FASE 2 (reescrita em 1 frase densa,
 * estilo "Porto Velho: nasceu em 1907 com a ferrovia do diabo..."), feita
 * por IA com a regra de usar SOMENTE fatos presentes no dossiê. A URL da
 * fonte fica guardada por cidade — auditável.
 *
 * Idempotente e resumível: pode interromper e rodar de novo (salva a cada
 * 50 cidades). Respeita rate limits (concorrência 3, backoff exponencial).
 *
 * Uso: npm run gerar-curiosidades
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MUNICIPIOS_FILE = path.join(__dirname, '../public/municipios.json');
const OUTPUT_FILE = path.join(__dirname, 'data/curiosidades-material.json');
const USER_AGENT = 'DropLife-Brasil/1.0 (+https://github.com/adriak007/DropLife-Brasil)';

const CONCURRENT = 3;
const DELAY_MS = 150;
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000;

class RateLimiter {
  constructor(concurrency, delayMs) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.running = 0;
    this.queue = [];
    this.lastRequestTime = 0;
  }

  async run(fn) {
    while (this.running >= this.concurrency) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.running++;
    const now = Date.now();
    const since = now - this.lastRequestTime;
    if (since < this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs - since));
    }
    this.lastRequestTime = Date.now();
    try {
      return await fn();
    } finally {
      this.running--;
      const resume = this.queue.shift();
      if (resume) resume();
    }
  }
}

const limiter = new RateLimiter(CONCURRENT, DELAY_MS);

async function fetchWithRetry(url, options = {}) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...options.headers },
      });
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, BACKOFF_BASE * Math.pow(2, attempt)));
          continue;
        }
      }
      return response;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_BASE * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

const sparql = async (query) => {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetchWithRetry(url);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()).results.bindings;
  } catch {
    return null;
  }
};

// Entidade + fatos estruturados numa consulta só (via código IBGE, sem
// risco de homônimo)
async function wikidataFacts(codigoIBGE) {
  const rows = await limiter.run(() =>
    sparql(`SELECT ?item ?inception ?demonym ?elevation ?area ?namedAfterLabel WHERE {
      ?item wdt:P1585 "${codigoIBGE}".
      OPTIONAL { ?item wdt:P571 ?inception. }
      OPTIONAL { ?item wdt:P1549 ?demonym. FILTER(LANG(?demonym) = "pt") }
      OPTIONAL { ?item wdt:P2044 ?elevation. }
      OPTIONAL { ?item wdt:P2046 ?area. }
      OPTIONAL { ?item wdt:P138 ?namedAfter. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "pt". }
    } LIMIT 1`)
  );
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const val = (k) => (r[k] ? r[k].value : null);
  return {
    entity: val('item') ? val('item').split('/').pop() : null,
    fundacao: val('inception'),
    gentilico: val('demonym'),
    altitude: val('elevation') ? Math.round(parseFloat(val('elevation'))) : null,
    area: val('area') ? Math.round(parseFloat(val('area'))) : null,
    nomeadaPor: val('namedAfterLabel'),
  };
}

// Pessoas notáveis nascidas na cidade (fama medida por nº de wikis com
// artigo). Consulta pesada em capitais — falha vira lista vazia, sem drama.
async function wikidataNotaveis(entityId) {
  if (!entityId) return [];
  const rows = await limiter.run(() =>
    sparql(`SELECT ?pLabel ?links WHERE {
      ?p wdt:P19 wd:${entityId}.
      ?p wikibase:sitelinks ?links.
      FILTER(?links >= 15)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
    } ORDER BY DESC(?links) LIMIT 3`)
  );
  if (!rows) return [];
  return rows
    .map((r) => (r.pLabel ? r.pLabel.value : null))
    .filter((n) => n && !/^Q\d+$/.test(n));
}

async function wikipediaSummary(titulo) {
  const slug = titulo.replace(/\s+/g, '_');
  const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
  const res = await limiter.run(() => fetchWithRetry(url));
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const isMunicipioArticle = (summary) =>
  /munic[ií]pio/i.test(`${summary?.description || ''} ${summary?.extract || ''}`);

// Extract validado: primeiro o título desambiguado "Cidade (Estado)",
// depois "Cidade" simples — sempre confirmando que o artigo é de município
async function wikipediaExtract(municipio, estado) {
  for (const titulo of [`${municipio} (${estado})`, municipio]) {
    const s = await wikipediaSummary(titulo);
    if (s?.extract && isMunicipioArticle(s)) {
      return {
        extract: s.extract.replace(/\s+/g, ' ').trim(),
        fonte: s.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(titulo)}`,
      };
    }
  }
  return null;
}

// Seção "História" do artigo (texto puro): é onde moram os fatos bons —
// ferrovia do diabo, origem do nome, fundadores — que o resumo demográfico
// não traz. Uma requisição só: artigo inteiro em plaintext, seção extraída
// localmente e limitada a ~1.200 caracteres (corte em fim de frase).
async function wikipediaHistoria(fonte) {
  if (!fonte) return null;
  const title = decodeURIComponent((fonte.split('/wiki/').pop() || '')).replace(/_/g, ' ');
  if (!title) return null;
  const url =
    `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1` +
    `&exsectionformat=wiki&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  const res = await limiter.run(() => fetchWithRetry(url));
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const text = page?.extract || '';
    if (!text) return null;
    // seções vêm como "== Título ==" no plaintext
    const parts = text.split(/^==\s*([^=\n]+?)\s*==$/m);
    for (let i = 1; i < parts.length - 1; i += 2) {
      if (/hist[óo]ria/i.test(parts[i])) {
        let corpo = parts[i + 1]
          .replace(/^===[^=\n]+===$/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (corpo.length > 1200) {
          const cut = corpo.slice(0, 1200);
          const lastDot = cut.lastIndexOf('. ');
          corpo = cut.slice(0, lastDot > 600 ? lastDot + 1 : 1200);
        }
        return corpo || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function coletaDossie(m) {
  const facts = await wikidataFacts(m.codigo_ibge);
  const wiki = await wikipediaExtract(m.municipio, m.estado);
  const notaveis = facts?.entity ? await wikidataNotaveis(facts.entity) : [];
  if (!facts && !wiki) return null;
  return {
    municipio: m.municipio,
    estado: m.estado,
    populacao: m.populacao,
    extract: wiki?.extract || null,
    historia: wiki ? await wikipediaHistoria(wiki.fonte) : null,
    fonte: wiki?.fonte || null,
    fundacao: facts?.fundacao || null,
    gentilico: facts?.gentilico || null,
    altitude: facts?.altitude ?? null,
    area: facts?.area ?? null,
    nomeadaPor: facts?.nomeadaPor || null,
    notaveis,
  };
}

async function main() {
  const municipios = JSON.parse(fs.readFileSync(MUNICIPIOS_FILE, 'utf-8'));
  console.log(`📍 ${municipios.length} municípios`);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  let material = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    material = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`📂 Retomando: ${Object.keys(material).length} dossiês já coletados`);
  }

  // Pendente = nunca coletado OU coletado antes do enriquecimento com a
  // seção "História" (retro-preenchimento: só busca o que falta)
  const pendentes = municipios.filter((m) => {
    const d = material[m.codigo_ibge];
    return !d || !('historia' in d);
  });
  console.log(`⏳ Pendentes: ${pendentes.length}\n`);
  const t0 = Date.now();
  let ok = 0;
  let vazios = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const m = pendentes[i];
    try {
      const existente = material[m.codigo_ibge];
      if (existente) {
        // já tem extract/fatos: busca só a História e marca como enriquecido
        existente.historia = await wikipediaHistoria(existente.fonte);
        ok++;
      } else {
        const dossie = await coletaDossie(m);
        if (dossie) {
          material[m.codigo_ibge] = dossie;
          ok++;
        } else {
          vazios++;
        }
      }
    } catch {
      vazios++;
    }
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(material, null, 1));
    }
    const total = i + 1;
    process.stdout.write(
      `\r${total} / ${pendentes.length} (${Math.round((total / pendentes.length) * 100)}%) | ✅ ${ok} | ⊘ ${vazios}`
    );
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(material, null, 1));
  console.log(`\n\n✅ ${OUTPUT_FILE}`);
  console.log(`   coletados nesta execução: ${ok} | sem material: ${vazios}`);
  console.log(`   total no banco: ${Object.keys(material).length}`);
  console.log(`   tempo: ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
