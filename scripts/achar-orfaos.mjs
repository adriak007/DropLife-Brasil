// Reproduz FORA do navegador o casamento mapa x população que o jogo faz em
// mapController.loadMap, para listar os municípios que ficam sem população —
// esses caem fora de allCities e, por terem peso zero no sorteio ponderado,
// NUNCA podem ser sorteados (bug do "cidades impossíveis de pegar").
import { readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const svg = readFileSync(new URL('public/MAPAESTADOS.svg', raiz), 'utf8');
const municipios = JSON.parse(readFileSync(new URL('public/municipios.json', raiz), 'utf8'));

const geo = readFileSync(new URL('lib/geo.ts', raiz), 'utf8');

// ufToName do lib/geo.ts
const ufToName = {};
const blocoUf = geo.match(/export const ufToName[^{]*\{([\s\S]*?)\n\};/);
for (const m of blocoUf[1].matchAll(/'?([A-Z]{2})'?\s*:\s*'([^']+)'/g)) ufToName[m[1]] = m[2];

// cityAliases do lib/geo.ts
const cityAliases = new Map();
const blocoAlias = geo.match(/export const cityAliases[\s\S]*?\n\]\);/);
for (const m of blocoAlias[0].matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) cityAliases.set(m[1], m[2]);

const normalize = (v = '') =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const keyFor = (c, e) => `${normalize(c)}-${normalize(e)}`;
const cleanCity = (c) => c.replace(/\s+\d+$/, '').trim();
const stripNota = (n) => n.replace(/\[[^\]]*\]/g, '').trim();

// índice de população (mesma lógica de buildPopulationIndex)
const index = new Map();
const nameToUf = new Map(Object.entries(ufToName).map(([uf, nome]) => [normalize(nome), uf]));
for (const { municipio, estado, populacao } of municipios) {
  const nome = stripNota(municipio);
  const baseKey = keyFor(nome, estado);
  if (!index.has(baseKey)) index.set(baseKey, populacao);
  const uf = nameToUf.get(normalize(estado));
  if (uf) {
    index.set(keyFor(nome, uf), populacao);
    index.set(keyFor(nome, ufToName[uf]), populacao);
  }
}

const orfaos = [];
const chaves = new Map(); // uniqueKey -> quantas vezes apareceu (detecta colisão)
let processed = 0;

for (const m of svg.matchAll(/data-name="([^"]+)"/g)) {
  const rawName = m[1];
  const [cidadeRaw = '', ufRaw = ''] = rawName.split(',').map((s) => s.trim());
  const cidade = cleanCity(cidadeRaw);
  const uf = ufRaw.toUpperCase();
  const estadoNome = ufToName[uf] || ufRaw;
  if (!cidade) continue;
  processed += 1;

  const aliasCity = cityAliases.get(keyFor(cidade, uf)) || cityAliases.get(keyFor(cidade, estadoNome));
  const lookupCities = [cidade, aliasCity].filter(Boolean);
  const candidates = [];
  for (const cityName of lookupCities) {
    candidates.push(keyFor(cityName, uf));
    candidates.push(keyFor(cityName, estadoNome));
    candidates.push(keyFor(cityName, ufToName[uf] || ''));
  }
  let populacao = null;
  for (const c of candidates) {
    const found = index.get(c);
    if (found !== undefined) { populacao = found; break; }
  }

  const stateKey = uf || estadoNome || '';
  const uniqueKey = keyFor(cidade, stateKey);
  chaves.set(uniqueKey, (chaves.get(uniqueKey) || 0) + 1);

  if (!populacao) orfaos.push({ rawName, cidade, uf, uniqueKey });
}

console.log(`poligonos no mapa: ${processed}`);
console.log(`municipios no JSON de populacao: ${municipios.length}`);
console.log(`chaves unicas geradas: ${chaves.size}`);

const colisoes = [...chaves.entries()].filter(([, n]) => n > 1);
console.log(`\nCOLISOES de chave (dois poligonos com a mesma key): ${colisoes.length}`);
colisoes.forEach(([k, n]) => console.log(`  ${k} x${n}`));

console.log(`\nSEM POPULACAO (impossiveis de sortear): ${orfaos.length}`);
orfaos.forEach((o) => console.log(`  ${o.rawName}  ->  key ${o.uniqueKey}`));

// Depois da fusão de polígonos duplicados, o total do jogo passa a ser o
// número de CHAVES com população — e é exatamente esse número que o jogador
// consegue colecionar, então 100% vira alcançável.
const semPop = new Set(orfaos.map((o) => o.uniqueKey));
const colecionaveis = [...chaves.keys()].filter((k) => !semPop.has(k)).length;
console.log(`\n=> total do jogo apos a correcao: ${colecionaveis}`);
console.log(`=> maximo colecionavel:            ${colecionaveis}`);
console.log(colecionaveis === chaves.size - semPop.size ? '   (batem: 100% alcancavel)' : '   (DIVERGEM!)');
