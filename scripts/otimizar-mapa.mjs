#!/usr/bin/env node

/**
 * Simplifica a geometria do MAPAESTADOS.svg (Douglas-Peucker) sem mexer em
 * nenhum atributo — só reescreve o `d` dos paths com menos vértices.
 *
 * Segurança:
 *  - tolerância pequena (EPSILON em unidades do viewBox de 680): o desvio
 *    máximo fica sub-pixel na visão normal; o forro verde + o traço das
 *    divisas cobrem qualquer micro-fresta entre vizinhos;
 *  - anéis fechados nunca colapsam: municípios minúsculos mantêm no mínimo
 *    4 pontos (senão o original é preservado);
 *  - valida que a contagem de paths e o conjunto de data-name não mudaram
 *    antes de gravar; qualquer comando desconhecido aborta.
 *
 * Uso: npm run otimizar-mapa [-- 0.2]   (epsilon opcional; padrão 0.15)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_FILE = path.join(__dirname, '../public/MAPAESTADOS.svg');
const EPSILON = parseFloat(process.argv[2] || '0.15');

// ── Parser de path (somente m/M l/L h/H v/V z/Z + repetições implícitas) ──

const tokenize = (d) => d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) || [];

// Converte o d em subcaminhos de pontos absolutos [{ closed, pts: [[x,y],...] }]
const parsePath = (d) => {
  const tokens = tokenize(d);
  const subpaths = [];
  let pts = null;
  let closed = false;
  let x = 0;
  let y = 0;
  let sx = 0; // início do subcaminho atual (z volta para cá)
  let sy = 0;
  let cmd = '';
  let i = 0;

  const flush = () => {
    if (pts && pts.length) subpaths.push({ closed, pts });
    pts = null;
    closed = false;
  };
  const num = () => {
    const v = parseFloat(tokens[i++]);
    if (Number.isNaN(v)) throw new Error(`número inválido em: ${d.slice(0, 60)}`);
    return v;
  };
  // desenho continuando após um z (sem moveto): novo subcaminho no ponto atual
  const ensureOpen = () => {
    if (!pts) pts = [[x, y]];
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'z' || cmd === 'Z') {
        closed = true;
        flush();
        x = sx;
        y = sy;
        continue;
      }
    }
    switch (cmd) {
      case 'm':
      case 'M': {
        flush();
        const dx = num();
        const dy = num();
        if (cmd === 'm') { x += dx; y += dy; } else { x = dx; y = dy; }
        sx = x;
        sy = y;
        pts = [[x, y]];
        cmd = cmd === 'm' ? 'l' : 'L'; // pares seguintes são lineto implícito
        break;
      }
      case 'l':
      case 'L': {
        ensureOpen();
        const dx = num();
        const dy = num();
        if (cmd === 'l') { x += dx; y += dy; } else { x = dx; y = dy; }
        pts.push([x, y]);
        break;
      }
      case 'h':
      case 'H': {
        ensureOpen();
        const dx = num();
        x = cmd === 'h' ? x + dx : dx;
        pts.push([x, y]);
        break;
      }
      case 'v':
      case 'V': {
        ensureOpen();
        const dy = num();
        y = cmd === 'v' ? y + dy : dy;
        pts.push([x, y]);
        break;
      }
      default:
        throw new Error(`comando não suportado "${cmd}" em: ${d.slice(0, 60)}`);
    }
  }
  flush();
  return subpaths;
};

// ── Douglas-Peucker iterativo ──

const perpDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const douglasPeucker = (pts, eps) => {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxDist = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const dist = perpDist(pts[i], pts[s], pts[e]);
      if (dist > maxDist) {
        maxDist = dist;
        idx = i;
      }
    }
    if (maxDist > eps && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
};

// ── Emissor compacto (M/l/h/v relativos, 1 decimal, separadores mínimos) ──

const round1 = (v) => Math.round(v * 10) / 10;

const fmt = (v) => {
  let s = String(v);
  if (s.startsWith('0.')) s = s.slice(1);
  else if (s.startsWith('-0.')) s = `-${s.slice(2)}`;
  return s;
};

const emit = (subpaths) => {
  let out = '';
  let lastHadDot = false;
  const push = (numStr, forceSep) => {
    const startsNeg = numStr.startsWith('-');
    const startsDot = numStr.startsWith('.');
    if (forceSep || (!startsNeg && !(startsDot && lastHadDot))) {
      if (out && !/[a-zA-Z]$/.test(out)) out += ' ';
    }
    out += numStr;
    lastHadDot = numStr.includes('.');
  };

  for (const { closed, pts } of subpaths) {
    // posições absolutas arredondadas: deltas exatos, sem erro acumulado
    const rounded = pts.map(([x, y]) => [round1(x), round1(y)]);
    // remove pontos consecutivos idênticos pós-arredondamento
    const clean = rounded.filter(
      (p, i) => i === 0 || p[0] !== rounded[i - 1][0] || p[1] !== rounded[i - 1][1]
    );
    if (!clean.length) continue;
    out += out ? 'm' : 'm';
    lastHadDot = false;
    // primeiro ponto: relativo à origem corrente não é rastreável entre
    // subpaths sem estado — emitimos absoluto com M para simplicidade
    out = out.slice(0, -1) + 'M';
    push(fmt(clean[0][0]), true);
    push(fmt(clean[0][1]));
    let cmd = '';
    for (let i = 1; i < clean.length; i++) {
      const dx = round1(clean[i][0] - clean[i - 1][0]);
      const dy = round1(clean[i][1] - clean[i - 1][1]);
      if (dx === 0 && dy === 0) continue;
      if (dy === 0) {
        if (cmd !== 'h') { out += 'h'; cmd = 'h'; lastHadDot = false; push(fmt(dx), true); }
        else push(fmt(dx));
      } else if (dx === 0) {
        if (cmd !== 'v') { out += 'v'; cmd = 'v'; lastHadDot = false; push(fmt(dy), true); }
        else push(fmt(dy));
      } else {
        if (cmd !== 'l') { out += 'l'; cmd = 'l'; lastHadDot = false; push(fmt(dx), true); }
        else push(fmt(dx));
        push(fmt(dy));
      }
    }
    if (closed) out += 'z';
  }
  return out;
};

// ── Pipeline ──

const svg = fs.readFileSync(SVG_FILE, 'utf-8');
const namesBefore = [...svg.matchAll(/data-name="([^"]*)"/g)].map((m) => m[1]).sort();
const pathsBefore = (svg.match(/<path/g) || []).length;

let totalPtsBefore = 0;
let totalPtsAfter = 0;
let fallbacks = 0;

const optimized = svg.replace(/ d="([^"]+)"/g, (full, d) => {
  const subpaths = parsePath(d);
  const simplified = subpaths.map((sp) => {
    totalPtsBefore += sp.pts.length;
    let pts = douglasPeucker(sp.pts, EPSILON);
    // anel fechado precisa de área: nunca deixa cair abaixo de 4 pontos
    if (sp.closed && pts.length < 4 && sp.pts.length >= 4) {
      pts = sp.pts.slice();
      fallbacks++;
    }
    totalPtsAfter += pts.length;
    return { closed: sp.closed, pts };
  });
  return ` d="${emit(simplified)}"`;
});

const namesAfter = [...optimized.matchAll(/data-name="([^"]*)"/g)].map((m) => m[1]).sort();
const pathsAfter = (optimized.match(/<path/g) || []).length;
const bordersAfter = [...optimized.matchAll(/state-border-\w+/g)].length;

if (pathsAfter !== pathsBefore) throw new Error(`paths mudaram: ${pathsBefore} -> ${pathsAfter}`);
if (namesBefore.length !== namesAfter.length || namesBefore.some((n, i) => n !== namesAfter[i]))
  throw new Error('conjunto de data-name mudou — abortando');
if (bordersAfter !== 27) throw new Error(`state-borders: esperava 27, achei ${bordersAfter}`);

fs.writeFileSync(SVG_FILE, optimized);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✅ ${SVG_FILE}`);
console.log(`   epsilon: ${EPSILON} (unidades do viewBox 680)`);
console.log(`   tamanho: ${kb(svg.length)} -> ${kb(optimized.length)} (${(100 - (optimized.length / svg.length) * 100).toFixed(0)}% menor)`);
console.log(`   vértices: ${totalPtsBefore.toLocaleString('pt-BR')} -> ${totalPtsAfter.toLocaleString('pt-BR')}`);
console.log(`   anéis preservados por segurança: ${fallbacks}`);
console.log(`   paths: ${pathsAfter} | data-names: ${namesAfter.length} | state-borders: 27 ✓`);
