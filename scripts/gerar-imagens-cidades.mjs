#!/usr/bin/env node

/**
 * Gera banco de imagens dos municípios brasileiros usando Wikidata + Wikipedia.
 *
 * Estratégia:
 * 1º Wikidata: busca código IBGE → P1585, depois P18 (imagem)
 * 2º Wikipedia PT: busca /page/summary/<Municipio>, usa thumbnail
 * 3º Sem imagem: deixa vazio (frontend mostra placeholder)
 *
 * Idempotente e resumível: carrega resultado anterior e continua apenas
 * cidades pendentes.
 *
 * Uso: npm run gerar-imagens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MUNICIPIOS_FILE = path.join(__dirname, '../public/municipios.json');
const OUTPUT_FILE = path.join(__dirname, '../public/cidade_imagens.json');
const USER_AGENT = 'DropLife-Brasil/1.0 (+https://github.com/adriak007/DropLife-Brasil)';

// Controle de rate limiting
const CONCURRENT = 3;
const DELAY_MS = 150; // ms entre requisições (dentro do limite da Wikimedia)
const MAX_RETRIES = 3;
const BACKOFF_BASE = 1000; // 1s, 2s, 4s

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
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs - timeSinceLastRequest));
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

      // Retry em 429, 5xx
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        if (attempt < MAX_RETRIES - 1) {
          const waitMs = BACKOFF_BASE * Math.pow(2, attempt);
          process.stdout.write(`⏱️  Retry em ${waitMs}ms (status ${response.status})...\n`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
      }

      return response;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        const waitMs = BACKOFF_BASE * Math.pow(2, attempt);
        process.stdout.write(`⏱️  Erro de rede, retry em ${waitMs}ms...\n`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
}

// Busca entidade Wikidata pelo código IBGE (P1585)
async function findWikidataByIBGE(codigoIBGE) {
  const query = `SELECT ?entity WHERE { ?entity wdt:P1585 "${codigoIBGE}". }`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.results.bindings.length === 0) return null;

    // Extrai ID da entidade (ex: http://www.wikidata.org/entity/Q1234 → Q1234)
    const entityUrl = data.results.bindings[0].entity.value;
    return entityUrl.split('/').pop();
  } catch {
    return null;
  }
}

// Busca imagem de uma entidade Wikidata (P18)
async function getWikidataImage(entityId) {
  const query = `SELECT ?image WHERE { wd:${entityId} wdt:P18 ?image. }`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.results.bindings.length === 0) return null;

    const imageUrl = data.results.bindings[0].image.value;
    return formatWikimediaUrl(imageUrl, 400);
  } catch {
    return null;
  }
}

// Formata URL do Wikimedia Commons para dimensão específica
function formatWikimediaUrl(fileUrl, width) {
  // Exemplo: http://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg
  // → https://commons.wikimedia.org/w/index.php?title=Special:FilePath/...&width=400px
  try {
    const url = new URL(fileUrl);
    if (url.hostname.includes('wikimedia.org')) {
      return `${fileUrl}?width=${width}px`;
    }
  } catch {
    // Ignorar URLs inválidas
  }
  return null;
}

// Consulta o summary de um título e devolve a thumbnail SOMENTE se o artigo
// for de um município brasileiro (evita homônimos: "Piranhas" = peixe,
// "Betânia" = cidade bíblica).
async function getWikipediaSummary(titulo) {
  const slug = titulo.replace(/\s+/g, '_');
  const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function isMunicipioArticle(summary) {
  const texto = `${summary?.description || ''} ${summary?.extract || ''}`;
  return /munic[ií]pio/i.test(texto);
}

// Busca imagem na Wikipedia PT: primeiro o título desambiguado
// "Cidade (Estado)", depois "Cidade" simples — sempre validando que o
// artigo fala de um município.
async function getWikipediaImage(municipio, estado) {
  const candidatos = [`${municipio} (${estado})`, municipio];
  for (const titulo of candidatos) {
    const summary = await limiter.run(() => getWikipediaSummary(titulo));
    if (summary?.thumbnail?.source && isMunicipioArticle(summary)) {
      return summary.thumbnail.source;
    }
  }
  return null;
}

// Resolve imagem de um município
async function resolveImagemMunicipio(municipio) {
  const { codigo_ibge: codigoIBGE, municipio: nome, estado } = municipio;

  // 1º Wikidata (via código IBGE — sem risco de homônimo)
  const wikidataId = await limiter.run(() => findWikidataByIBGE(codigoIBGE));
  if (wikidataId) {
    const image = await limiter.run(() => getWikidataImage(wikidataId));
    if (image) return { img: image, fonte: 'wikidata' };
  }

  // 2º Wikipedia PT (título desambiguado + validação de município)
  const wikipediaImage = await getWikipediaImage(nome, estado);
  if (wikipediaImage) return { img: wikipediaImage, fonte: 'wikipedia' };

  // 3º Sem imagem
  return null;
}

async function main() {
  console.log('📍 Carregando municipios.json...');
  if (!fs.existsSync(MUNICIPIOS_FILE)) {
    console.error(`❌ Arquivo não encontrado: ${MUNICIPIOS_FILE}`);
    process.exit(1);
  }

  const municipios = JSON.parse(fs.readFileSync(MUNICIPIOS_FILE, 'utf-8'));
  console.log(`✅ ${municipios.length} municípios encontrados\n`);

  // Carregar resultado anterior (se existir)
  let resultado = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    resultado = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`📂 Carregado cache anterior: ${Object.keys(resultado).length} cidades\n`);
  }

  // --refazer-wikipedia: reprocessa as entradas vindas da Wikipedia (as do
  // Wikidata vêm do código IBGE e não têm risco de homônimo).
  if (process.argv.includes('--refazer-wikipedia')) {
    let removidas = 0;
    for (const [codigo, info] of Object.entries(resultado)) {
      if (info.fonte === 'wikipedia') {
        delete resultado[codigo];
        removidas++;
      }
    }
    console.log(`🔁 --refazer-wikipedia: ${removidas} entradas marcadas para reprocessar\n`);
  }

  const startTime = Date.now();
  let resolvidas = 0;
  let semImagem = 0;
  let pendentes = municipios.filter((m) => !resultado[m.codigo_ibge]);

  console.log(`⏳ Processando ${pendentes.length} cidades pendentes...\n`);

  for (let i = 0; i < pendentes.length; i++) {
    const municipio = pendentes[i];
    const { codigo_ibge } = municipio;

    const imagem = await resolveImagemMunicipio(municipio);
    if (imagem) {
      resultado[codigo_ibge] = imagem;
      resolvidas++;
    } else {
      semImagem++;
    }

    // Save incremental: interromper o script não perde o progresso
    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2));
    }

    const total = i + 1;
    const percent = Math.round((total / pendentes.length) * 100);
    process.stdout.write(`\r${total} / ${pendentes.length} (${percent}%) | ✅ ${resolvidas} | ⊘ ${semImagem}`);
  }

  console.log('\n');

  // Salvar resultado
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2));
  console.log(`✅ Salvo: ${OUTPUT_FILE}\n`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalCacheada = Object.keys(resultado).length - resolvidas;
  console.log('📊 Resumo:');
  console.log(`   Resolvidas nesta execução: ${resolvidas}`);
  console.log(`   Sem imagem: ${semImagem}`);
  console.log(`   Do cache anterior: ${totalCacheada}`);
  console.log(`   Total no banco: ${Object.keys(resultado).length}`);
  console.log(`   Tempo: ${totalTime}s\n`);
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
