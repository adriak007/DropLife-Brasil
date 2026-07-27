// Confere um lote reescrito: entrada x saída, chaves faltando/sobrando,
// frases vazias, curtas demais ou com boilerplate que deveria ter sumido.
//   node scripts/conferir-lote.mjs 12
import { readFileSync, existsSync } from 'node:fs';

const n = String(process.argv[2]).padStart(2, '0');
const base = new URL('./data/refazer/', import.meta.url);
const entrada = JSON.parse(readFileSync(new URL(`refazer-${n}.json`, base), 'utf8'));
const saidaPath = new URL(`refazer-${n}-saida.json`, base);
if (!existsSync(saidaPath)) {
  console.log(`lote ${n}: SEM SAIDA`);
  process.exit(1);
}
const saida = JSON.parse(readFileSync(saidaPath, 'utf8'));

const kIn = Object.keys(entrada);
const kOut = Object.keys(saida);
const faltando = kIn.filter((k) => !(k in saida));
const sobrando = kOut.filter((k) => !(k in entrada));
const vazias = kOut.filter((k) => !saida[k] || saida[k].trim().length < 40);
const ruins = kOut.filter((k) => /é um município brasileiro|Sua população|recenseada/i.test(saida[k]));

console.log(`lote ${n}: entrada ${kIn.length} | saida ${kOut.length}`);
if (faltando.length) console.log(`  FALTANDO (${faltando.length}):`, faltando.slice(0, 10).join(', '));
if (sobrando.length) console.log(`  SOBRANDO (${sobrando.length}):`, sobrando.slice(0, 10).join(', '));
if (vazias.length) console.log(`  CURTAS (${vazias.length}):`, vazias.slice(0, 10).join(', '));
if (ruins.length) console.log(`  BOILERPLATE (${ruins.length}):`, ruins.slice(0, 10).join(', '));
if (!faltando.length && !sobrando.length && !vazias.length && !ruins.length) console.log('  OK');
