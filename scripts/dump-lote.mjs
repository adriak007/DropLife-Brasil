// Imprime um lote de refazer/ em forma compacta para reescrita das
// curiosidades: remove o texto-padrão de IBGE (mesorregião/microrregião/
// "população recenseada em"), que é igual em milhares de verbetes e não
// rende curiosidade nenhuma, e corta o que sobra num teto de caracteres.
//   node scripts/dump-lote.mjs 12
import { readFileSync } from 'node:fs';

const n = String(process.argv[2]).padStart(2, '0');
const base = new URL('./data/refazer/', import.meta.url);
const rows = JSON.parse(readFileSync(new URL(`refazer-${n}.json`, base), 'utf8'));

// Frases-padrão que se repetem em milhares de verbetes e não rendem
// curiosidade nenhuma (localização administrativa, área, população, censo).
// Cortar isso reduz o dossiê a ~1/3 sem perder nenhum fato aproveitável.
const LIXO = [
  // localização administrativa
  /O município de [^.]+ pertence à região intermediária[^.]*\.\s*/gi,
  /(?:Está|Encontra-se) localizad[oa] na mesorregião[^.]*\.\s*/gi,
  /Pertence à mesorregião[^.]*\.\s*/gi,
  /[A-ZÀ-Ú][^.]*é um município brasileiro[^.]*\.\s*/gi,
  /Localiza-se n[oa][^.]*(?:estando situad|distando|a cerca de \d+\s*km)[^.]*\.\s*/gi,
  /Integra a região geográfica imediata[^.]*\.\s*/gi,
  /Est[áa] situad[oa] na [Mm]esorregião[^.]*\.\s*/gi,
  /O município encontra-se a uma distância[^.]*\.\s*/gi,
  // área / população / censo
  /Ocupa uma área de[^.]*\.\s*/gi,
  /Possui uma área de[^.]*\.\s*/gi,
  /A área municipal é de[^.]*\.\s*/gi,
  /Sua população[^.]{0,80}(?:recenseada|estimada|era de|foi de)[^.]*\.\s*/gi,
  /Sua população (?:em \d{4} )?foi recenseada[^.]*\.\s*/gi,
  /De acordo com (?:o|a) (?:IBGE|Instituto Brasileiro|censo|recenseamento|estimativa)[^.]*\.\s*/gi,
  /Segundo (?:o|a) (?:IBGE|Instituto Brasileiro|censo|estimativa)[^.]*\.\s*/gi,
  /,? sua população[^.]*\.\s*/gi,
  /\bSua população[^.]*\.\s*/gi,
  // ruído de fonte
  /\[carece de fontes\?\]/gi,
  /Nota histórica:[^.]*\.\s*/gi,
  /(?:Contudo|Porém), não há dados documentados[^.]*\.\s*/gi,
  /,? no Brasil\b/gi,
];

const limpa = (txt) => {
  let t = typeof txt === 'string' ? txt : '';
  for (const re of LIXO) t = t.replace(re, '');
  return t.replace(/\s+/g, ' ').trim();
};

const corta = (t, max) => (t.length > max ? `${t.slice(0, max)}…` : t);

const list = Object.entries(rows);
const ini = Number(process.argv[3] || 0);
const fim = Number(process.argv[4] || list.length);
for (const [cod, r] of list.slice(ini, fim)) {
  const ex = corta(limpa(r.extract), 260);
  const hi = corta(limpa(r.historia), 560);
  console.log(`\n### ${cod} | ${r.municipio} (${r.estado}) | pop ${r.populacao}`);
  // dados soltos salvam as cidades cujo verbete é puro boilerplate
  const extras = [
    r.fundacao && `fund ${String(r.fundacao).slice(0, 4)}`,
    r.altitude && `alt ${r.altitude}`,
    r.area && `área ${r.area}`,
    r.gentilico && `gent ${r.gentilico}`,
    r.nomeadaPor && `nomeada por ${r.nomeadaPor}`,
    r.notaveis?.length && `notáveis: ${(Array.isArray(r.notaveis) ? r.notaveis : [r.notaveis]).slice(0, 4).join('; ')}`,
  ].filter(Boolean);
  if (extras.length) console.log(`D: ${extras.join(' | ')}`);
  if (ex) console.log(`E: ${ex}`);
  if (hi) console.log(`H: ${hi}`);
}
console.log(`\n[MOSTRADOS ${list.slice(ini, fim).length} de ${list.length}]`);
