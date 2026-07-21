#!/usr/bin/env node
// Reconcilia o que os subagentes ja escreveram (varios cairam por limite de
// sessao, mas alguns tinham escrito o arquivo antes de cair) contra os 38
// lotes de entrada, para saber exatamente o que falta reescrever.
import fs from 'fs';
import path from 'path';

const ROOT = 'c:/Users/adria/OneDrive/Documentos/GitHub/DropLife-Brasil';
const LOTES_DIR = path.join(ROOT, 'scripts/data/lotes');
const SCRATCH_DIRS = [
  'C:/Users/adria/AppData/Local/Temp/claude/c--Users-adria-OneDrive-Documentos-GitHub-DropLife-Brasil/999a8722-b3c2-453f-a825-bd864edebb93/scratchpad',
];

// 1) carrega os 38 lotes de ENTRADA (o que deveria ser coberto)
const inputBatches = [];
for (let i = 1; i <= 38; i++) {
  const p = path.join(LOTES_DIR, `lote-${String(i).padStart(2, '0')}.json`);
  if (!fs.existsSync(p)) { console.log(`⚠️  falta arquivo de entrada: ${p}`); continue; }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  inputBatches.push({ n: i, codes: Object.keys(data), data });
}
const allExpected = new Map(); // codigo -> {municipio, estado}
inputBatches.forEach((b) => Object.entries(b.data).forEach(([k, v]) => allExpected.set(k, v)));
console.log(`Esperado: ${allExpected.size} municipios em ${inputBatches.length} lotes\n`);

// 2) varre candidatos a SAIDA em varios lugares e formatos
const candidateFiles = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) { walk(full); continue; }
    if (f.endsWith('.json') || f.endsWith('.js')) candidateFiles.push(full);
  }
};
walk(LOTES_DIR);
SCRATCH_DIRS.forEach(walk);

// Extrai entradas validas de QUALQUER arquivo, em qualquer um dos formatos
// que os subagentes usaram, sem contexto compartilhado entre si:
//   { "cod": { municipio, uf, curiosidade } }   <- formato pedido
//   { "cod": "texto da curiosidade" }            <- alguns simplificaram
//   [ { codigo_ibge, municipio, uf, curiosidade } ]  <- alguns usaram lista
// So aceita se tiver curiosidade nao-vazia (dossies de entrada, que tem
// extract/historia/populacao mas NAO curiosidade, ficam de fora sozinhos).
const found = new Map(); // codigo -> {curiosidade, uf, municipio, fonteArquivo}
const tryExtract = (obj, fonteArquivo) => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      const cod = item?.codigo_ibge || item?.codigo || item?.ibge;
      if (cod && item.curiosidade) {
        found.set(String(cod), { curiosidade: item.curiosidade, uf: item.uf || item.estado, municipio: item.municipio, fonteArquivo });
      }
    });
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d{6,7}$/.test(k)) continue; // chave precisa parecer codigo IBGE
    if (typeof v === 'string' && v.trim()) {
      if (!found.has(k)) found.set(k, { curiosidade: v, uf: null, municipio: null, fonteArquivo });
    } else if (v && typeof v === 'object' && typeof v.curiosidade === 'string' && v.curiosidade.trim()) {
      if (!found.has(k)) {
        found.set(k, { curiosidade: v.curiosidade, uf: v.uf || v.estado, municipio: v.municipio, fonteArquivo });
      }
    }
  }
};

for (const file of candidateFiles) {
  // pula os proprios arquivos de ENTRADA (lote-NN.json puro) e os "-pretty"
  // (sao os dossies de entrada re-formatados para leitura, nao saida)
  const base = path.basename(file);
  if (/^lote-\d+\.json$/.test(base)) continue;
  if (/pretty|snapshot/i.test(base)) continue;
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    let obj;
    if (file.endsWith('.js')) {
      // Extrai so o objeto literal (do primeiro "{" ate o "}" que fecha ele,
      // contando chaves e ignorando as que estao dentro de strings) —
      // arquivos .js as vezes tem codigo ANTES/DEPOIS (const x=..., module.
      // exports=...) que quebraria um JSON.parse direto.
      const start = raw.indexOf('{');
      if (start === -1) continue;
      let depth = 0, inStr = false, quote = '', end = -1;
      for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (inStr) {
          if (ch === '\\') { i++; continue; }
          if (ch === quote) inStr = false;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; quote = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) continue;
      const literal = raw.slice(start, end + 1);
      try {
        obj = JSON.parse(literal);
      } catch {
        // aspas simples / virgula sobrando etc — arquivo confiavel (gerado
        // por nos mesmos), Function() como fallback e seguro aqui
        // eslint-disable-next-line no-new-func
        obj = new Function(`return (${literal})`)();
      }
    } else {
      obj = JSON.parse(raw);
    }
    tryExtract(obj, file);
  } catch {
    // nao e JSON/JS valido ou nao e o formato esperado - ignora
  }
}

console.log(`Candidatos a saida encontrados (entradas com curiosidade valida): ${found.size}\n`);

// 3) calcula cobertura por lote de entrada
const missingByBatch = new Map();
let totalCovered = 0;
for (const b of inputBatches) {
  const missing = b.codes.filter((c) => !found.has(c));
  if (missing.length) missingByBatch.set(b.n, missing);
  totalCovered += b.codes.length - missing.length;
}

console.log(`Cobertos: ${totalCovered} / ${allExpected.size}`);
console.log(`Faltando: ${allExpected.size - totalCovered}\n`);
console.log('Lotes com pendencia:');
for (const [n, missing] of missingByBatch) {
  console.log(`  lote ${String(n).padStart(2, '0')}: faltam ${missing.length}/150`);
}

// 4) salva o consolidado parcial (o que ja temos) + a lista do que falta,
// para o proximo passo (redisparar so o que falta, e no final so juntar)
const outDir = path.join(ROOT, 'scripts/data');
fs.writeFileSync(
  path.join(outDir, 'curiosidades-parcial.json'),
  JSON.stringify(Object.fromEntries(found), null, 1)
);
const pendentes = {};
for (const [n, missing] of missingByBatch) {
  pendentes[n] = missing.map((c) => ({ codigo_ibge: c, ...allExpected.get(c) }));
}
fs.writeFileSync(path.join(outDir, 'curiosidades-pendentes.json'), JSON.stringify(pendentes, null, 1));
console.log('\nSalvos: scripts/data/curiosidades-parcial.json e curiosidades-pendentes.json');
