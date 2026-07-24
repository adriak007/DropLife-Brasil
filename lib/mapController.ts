// Engine Canvas do mapa: renderiza os 5.570 municípios num ÚNICO elemento
// <canvas> (antes eram 5.598 nós SVG vivos no DOM). A geometria vira Path2D
// agrupado em "mega-paths" por cor — o raster completo custa meia dúzia de
// fills — e pan/zoom desliza um bitmap em cache, re-rasterizando só quando o
// gesto assenta. A API pública é idêntica à da engine SVG anterior.
import type { BBox, CityModalData, Municipio, PickedCity, StateStats, ViewBox } from './types';
import { cityAliases, stateLabelOffsets, stateLabelText, ufToName } from './geo';
import { clamp, cleanCity, formatChance, formatPop, keyFor } from './text';
import { buildPopulationIndex } from './population';
import { curiosityFor, loadCuriosities, type CuriosityMap } from './curiosities';
import { HEAT_BUCKETS, heatBucket } from './heatmap';
import { rarityFor } from './rarity';
import { CAPITAL_KEYS } from './achievements';
import { sfxRouletteRiser, sfxRouletteTick } from './sound';

const MAP_URL = '/MAPAESTADOS.svg';
const MUNICIPIOS_URL = '/municipios.json';

// Paleta (antes vivia no <style> injetado no SVG)
const STATE_TONES = ['#1b5438', '#20603f', '#16482c'];
const CAPITAL_FILL = '#e04343';
const BACKING_FILL = '#14432c';
const DIVISA_STROKE = 'rgba(8, 40, 24, 0.6)';
const ESTADO_STROKE = 'rgba(4, 24, 14, 0.9)';
const TIER_FILLS: Record<string, string> = {
  lendario: '#f59e0b',
  epico: '#a78bfa',
  raro: '#38bdf8',
  incomum: '#34d399',
  comum: '#94a3b8',
};
const STATE_HOVER_FILL = 'rgba(230, 255, 240, 0.10)';
const STATE_HOVER_STROKE = 'rgba(214, 245, 224, 0.35)';
const ACTIVE_STATE_STROKE = 'rgba(0, 210, 255, 0.22)';
const CITY_HOVER_FILL = 'rgba(255, 255, 255, 0.22)';
const LABEL_FILL = 'rgba(190, 240, 210, 0.9)';
const LABEL_HALO = 'rgba(0, 0, 0, 0.55)';
const ZOOM_MS = 420;
const MAX_ZOOM = 10; // vezes a vista completa
const RERASTER_IDLE_MS = 140;

interface TooltipData {
  city: string;
  state: string;
  population: number | null;
  key: string;
}

interface CityRec {
  key: string;
  city: string;
  state: string;
  population: number | null;
  title: string;
  path: Path2D;
  bbox: BBox;
  capital: boolean;
  capturedTier: string | null;
}

interface Cam {
  scale: number; // px CSS por unidade do mundo
  tx: number;
  ty: number;
}

export interface MapControllerOptions {
  container: HTMLElement;
  tooltip: HTMLElement;
  tooltipTitle: HTMLElement;
  tooltipSubtitle: HTMLElement;
  setStatus: (message: string) => void;
  openMessageModal: (message: string, title?: string) => void;
  openCityModal: (data: CityModalData) => void;
  onZoomChange: (state: string | null) => void;
  // Zoom manual (pinça/roda), independente de um estado especifico —
  // controla so a visibilidade do botao "Voltar".
  onManualZoomChange: (active: boolean) => void;
}

// BBox de um path SVG (m/l/h/v/z, absolutos e relativos) por matemática pura
// — sem getBBox, que exige o path vivo no DOM e força reflow.
const bboxOfPathD = (d: string): BBox => {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) || [];
  let x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const mark = () => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'z' || cmd === 'Z') { x = sx; y = sy; continue; }
    }
    switch (cmd) {
      case 'm': x += num(); y += num(); sx = x; sy = y; mark(); cmd = 'l'; break;
      case 'M': x = num(); y = num(); sx = x; sy = y; mark(); cmd = 'L'; break;
      case 'l': x += num(); y += num(); mark(); break;
      case 'L': x = num(); y = num(); mark(); break;
      case 'h': x += num(); mark(); break;
      case 'H': x = num(); mark(); break;
      case 'v': y += num(); mark(); break;
      case 'V': y = num(); mark(); break;
      default: i++; // comando desconhecido: pula (não deve ocorrer no nosso mapa)
    }
  }
  return { minX, minY, maxX, maxY };
};

const unionBBox = (a: BBox | null, b: BBox): BBox =>
  !a
    ? { ...b }
    : {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
      };

export class MapController {
  private opts: MapControllerOptions;
  private destroyed = false;

  // canvas / câmera
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private world: ViewBox = { x: 0, y: 0, w: 680, h: 680 };
  private cam: Cam = { scale: 1, tx: 0, ty: 0 };
  private isZoomed = false;
  private zoomedState: string | null = null;
  private manualZoomActive = false;

  // dados
  private cities: CityRec[] = [];
  private byKey = new Map<string, CityRec>();
  private availableCities: CityRec[] = [];
  private allCities: CityRec[] = []; // só municípios com população (sorteáveis)
  private stateStats = new Map<string, StateStats>();
  private stateBBoxes = new Map<string, BBox>();
  private statePaths = new Map<string, Path2D>();
  private curiosities: CuriosityMap = new Map();
  private missing: string[] = [];

  // camadas de desenho
  private borderPath = new Path2D();
  private tonePaths: Path2D[] = [];
  private capitalPath = new Path2D();
  private strokeAll = new Path2D();
  private capturedPaths = new Map<string, Path2D>();
  private heatPaths: Path2D[] | null = null;
  private heatmapOn = false;

  // cache de raster (pan/zoom desliza este bitmap)
  private cache: { bmp: HTMLCanvasElement | null; scale: number; tx: number; ty: number; stale: boolean } = {
    bmp: null, scale: 1, tx: 0, ty: 0, stale: true,
  };
  private drawRaf = 0;
  private rerasterTimer = 0;
  // Snapshot da vista completa (fallback de desenho no zoom-out)
  private baseSnap: { bmp: HTMLCanvasElement; scale: number; tx: number; ty: number } | null = null;
  private baseSnapTimer = 0;

  // interação
  private hoverState: string | null = null;
  private hoverCity: CityRec | null = null;
  private pointerDownAt: { x: number; y: number; id: number } | null = null;
  private pointerMoved = false;
  private suppressNextClick = false;
  private pinchPointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; cam: Cam; midWorld: { x: number; y: number } } | null = null;
  private camAnim = 0;

  // destaque (pin + pulso) e tooltip fixado
  private pinEl: HTMLDivElement | null = null;
  // cidade "dona" de cada marcador flutuante (pin/cruz), para poder
  // reposicioná-los em screen-space a cada frame — sem isso eles ficavam
  // fixos no pixel onde nasceram, "flutuando" fora do lugar ao arrastar
  // ou dar zoom no mapa depois de criados
  private pinCity: CityRec | null = null;
  private pinTimer = 0;
  private focusCityTimer = 0;
  private pulse: { city: CityRec; start: number } | null = null;
  private pulseRaf = 0;

  // Desafio diário em modo "adivinhação": enquanto guessCallback existir, o
  // próximo toque em qualquer município é interpretado como o palpite (não
  // como navegação normal). guessMarkers guarda os pins de revelação
  // (acerto em verde, palpite errado em vermelho); guessMarkerCities guarda
  // a cidade correspondente a cada um, na mesma ordem, para reposicionar.
  private guessCallback: ((key: string) => void) | null = null;
  private guessMarkers: HTMLDivElement[] = [];
  private guessMarkerCities: CityRec[] = [];

  // Roleta do sorteio (tec-tec-tec pelo mapa antes de revelar a cidade).
  // pendingCapture segura a pintura da cidade sorteada até o pouso — senão
  // a cor de raridade apareceria no mapa e entregaria o resultado.
  private birthAnimActive = false;
  private rouletteMarker: HTMLDivElement | null = null;
  private rouletteTimer = 0;
  private pendingCapture: CityRec | null = null;
  private tooltipState = {
    isPinned: false,
    pinnedCity: null as CityRec | null,
    lastHoverKey: null as string | null,
  };

  private docPointerDown = (evt: PointerEvent) => {
    if (!this.tooltipState.isPinned) return;
    const target = evt.target as Node | null;
    if (target && this.opts.tooltip.contains(target)) return;
    if (target && this.opts.container.contains(target)) return; // o canvas decide
    this.clearPinnedTooltip();
  };

  private docClick = (evt: MouseEvent) => {
    // Em zoom manual (pinça/roda, sem estado especifico) nao existe "fora da
    // area" — so o botao Voltar ou o gesto encerram o zoom.
    if (!this.isZoomed || this.zoomedState === null) return;
    const el = evt.target as Element | null;
    if (!el || !el.isConnected) return;
    if (this.opts.container.contains(el)) return; // cliques no mapa: handleTap decide
    if (
      el.closest('.modal-backdrop') ||
      el.closest('.modal-panel') ||
      el.closest('.city-tooltip') ||
      // Botões de navegação (nav bar, sidebar, "Voltar") ficam fora do mapa
      // mas podem disparar um zoom como parte da própria ação (ex.: o
      // Desafio Diário dá zoom ao ser clicado) — sem essa exceção, o MESMO
      // clique que inicia o zoom borbulha até aqui e o desfaz na hora.
      el.closest('.nav-btn')
    ) {
      return;
    }
    this.resetZoom();
  };

  private winReposition = () => this.positionPinnedTooltip();
  private winResize = () => this.resizeCanvas();

  constructor(opts: MapControllerOptions) {
    this.opts = opts;
  }

  // ── Ciclo de vida ──

  async init(): Promise<void> {
    document.addEventListener('pointerdown', this.docPointerDown, true);
    document.addEventListener('click', this.docClick);
    window.addEventListener('resize', this.winResize);
    window.addEventListener('scroll', this.winReposition, true);
    await this.loadMap();
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('pointerdown', this.docPointerDown, true);
    document.removeEventListener('click', this.docClick);
    window.removeEventListener('resize', this.winResize);
    window.removeEventListener('scroll', this.winReposition, true);
    cancelAnimationFrame(this.drawRaf);
    cancelAnimationFrame(this.camAnim);
    cancelAnimationFrame(this.pulseRaf);
    window.clearTimeout(this.rerasterTimer);
    window.clearTimeout(this.baseSnapTimer);
    window.clearTimeout(this.pinTimer);
    window.clearTimeout(this.focusCityTimer);
    this.cancelBirthRoulette();
    this.removePin();
    this.clearGuessMarkers();
    this.opts.container.innerHTML = '';
    this.canvas = null;
    this.ctx = null;
  }

  // ── Câmera ──

  private camForRect(b: BBox): Cam {
    const bw = Math.max(b.maxX - b.minX, 1);
    const bh = Math.max(b.maxY - b.minY, 1);
    const scale = Math.min(this.cssW / bw, this.cssH / bh);
    return {
      scale,
      tx: (this.cssW - bw * scale) / 2 - b.minX * scale,
      ty: (this.cssH - bh * scale) / 2 - b.minY * scale,
    };
  }

  private rectForCam(cam: Cam): BBox {
    return {
      minX: -cam.tx / cam.scale,
      minY: -cam.ty / cam.scale,
      maxX: (this.cssW - cam.tx) / cam.scale,
      maxY: (this.cssH - cam.ty) / cam.scale,
    };
  }

  private baseCam(): Cam {
    return this.camForRect({
      minX: this.world.x,
      minY: this.world.y,
      maxX: this.world.x + this.world.w,
      maxY: this.world.y + this.world.h,
    });
  }

  private expandBBox(b: BBox, pct: number): BBox {
    const padX = (b.maxX - b.minX) * pct;
    const padY = (b.maxY - b.minY) * pct;
    return {
      minX: Math.max(this.world.x, b.minX - padX),
      minY: Math.max(this.world.y, b.minY - padY),
      maxX: Math.min(this.world.x + this.world.w, b.maxX + padX),
      maxY: Math.min(this.world.y + this.world.h, b.maxY + padY),
    };
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx * this.cam.scale + this.cam.tx, y: wy * this.cam.scale + this.cam.ty };
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.cam.tx) / this.cam.scale, y: (sy - this.cam.ty) / this.cam.scale };
  }

  // Anima a câmera interpolando o retângulo visível (mesma sensação da
  // animação de viewBox da engine SVG).
  private animateCamTo(target: Cam, duration = ZOOM_MS): void {
    cancelAnimationFrame(this.camAnim);
    const from = this.rectForCam(this.cam);
    const to = this.rectForCam(target);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = t * t * (3 - 2 * t);
      const lerp = (a: number, b: number) => a + (b - a) * ease;
      this.cam = this.camForRect({
        minX: lerp(from.minX, to.minX),
        minY: lerp(from.minY, to.minY),
        maxX: lerp(from.maxX, to.maxX),
        maxY: lerp(from.maxY, to.maxY),
      });
      this.requestDraw();
      if (t < 1) {
        this.camAnim = requestAnimationFrame(step);
      } else {
        this.cam = target;
        this.cache.stale = true;
        this.requestDraw();
        this.positionPinnedTooltip();
      }
    };
    this.camAnim = requestAnimationFrame(step);
  }

  resetZoom(): void {
    this.removePin();
    this.clearGuessMarkers();
    // Voltar sem ter palpitado cancela o desafio em aberto — o jogador pode
    // clicar em "Desafio Diário" de novo para tentar (a mesma cidade, já
    // que o sorteio do dia é determinístico).
    this.guessCallback = null;
    if (!this.isZoomed || !this.canvas) return;
    this.isZoomed = false;
    this.zoomedState = null;
    this.manualZoomActive = false;
    this.pinchStart = null;
    this.hoverCity = null;
    this.clearStateHover();
    this.animateCamTo(this.baseCam());
    this.opts.onZoomChange(null);
    this.opts.onManualZoomChange(false);
    this.clearPinnedTooltip();
  }

  private focusState(state: string): void {
    this.removePin(); // pin antigo fica em posição errada após mudar a view
    this.clearGuessMarkers();
    const bbox = this.stateBBoxes.get(state);
    if (!state || !bbox || !this.canvas) return;
    this.isZoomed = true;
    this.zoomedState = state;
    this.hoverCity = null;
    this.clearStateHover();
    this.animateCamTo(this.camForRect(this.expandBBox(bbox, 0.2)));
    this.opts.onZoomChange(state);
  }

  focusStateByKey(uf: string): void {
    this.focusState(uf);
  }

  // ── Render ──

  private resizeCanvas(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const keepRect = this.isZoomed ? this.rectForCam(this.cam) : null;
    this.cssW = canvas.clientWidth;
    this.cssH = canvas.clientHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(this.cssW * this.dpr));
    canvas.height = Math.max(1, Math.round(this.cssH * this.dpr));
    this.cam = keepRect ? this.camForRect(keepRect) : this.baseCam();
    this.cache.stale = true;
    this.scheduleBaseSnap(); // o snapshot precisa acompanhar o novo tamanho
    this.requestDraw();
    this.positionPinnedTooltip();
  }

  private applyCam(c: CanvasRenderingContext2D): void {
    c.setTransform(
      this.dpr * this.cam.scale, 0, 0, this.dpr * this.cam.scale,
      this.dpr * this.cam.tx, this.dpr * this.cam.ty
    );
  }

  // Desenha a cena completa num contexto já dimensionado, com a câmera dada.
  // Compartilhado entre o cache do gesto (rasterFull) e o snapshot da vista
  // completa (renderBaseSnap).
  private renderScene(c: CanvasRenderingContext2D, cam: Cam, showLabels: boolean): void {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(this.dpr * cam.scale, 0, 0, this.dpr * cam.scale, this.dpr * cam.tx, this.dpr * cam.ty);

    // forro do país: furinhos entre municípios mostram verde, não o fundo
    c.fillStyle = BACKING_FILL;
    c.fill(this.borderPath);

    if (this.heatmapOn && this.heatPaths) {
      this.heatPaths.forEach((p, i) => {
        c.fillStyle = HEAT_BUCKETS[i].color;
        c.fill(p);
      });
    } else {
      this.tonePaths.forEach((p, i) => {
        c.fillStyle = STATE_TONES[i];
        c.fill(p);
      });
      c.fillStyle = CAPITAL_FILL;
      c.fill(this.capitalPath);
    }

    // capturadas na cor da raridade (vence o heatmap, como na engine SVG)
    this.capturedPaths.forEach((p, tier) => {
      c.fillStyle = TIER_FILLS[tier] || '#ef4444';
      c.fill(p);
    });

    // divisas dos municípios (1 stroke só para o mapa inteiro)
    c.strokeStyle = DIVISA_STROKE;
    c.lineWidth = 0.3;
    c.stroke(this.strokeAll);

    // divisas ESTADUAIS bem marcadas por cima das municipais
    c.strokeStyle = ESTADO_STROKE;
    c.lineWidth = 0.8;
    c.stroke(this.borderPath);

    // rótulos de estado (somem no zoom, como antes)
    if (showLabels) {
      c.font = `700 13px 'Segoe UI', Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 1.4;
      c.globalAlpha = 0.85;
      this.stateBBoxes.forEach((bbox, uf) => {
        const offset = stateLabelOffsets[uf] || { x: 0, y: 0 };
        const cx = (bbox.minX + bbox.maxX) / 2 + offset.x;
        const cy = (bbox.minY + bbox.maxY) / 2 + offset.y;
        const label = stateLabelText(uf);
        c.strokeStyle = LABEL_HALO;
        c.strokeText(label, cx, cy);
        c.fillStyle = LABEL_FILL;
        c.fillText(label, cx, cy);
      });
      c.globalAlpha = 1;
    }
  }

  private rasterFull(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const off = this.cache.bmp && this.cache.bmp.width === canvas.width && this.cache.bmp.height === canvas.height
      ? this.cache.bmp
      : document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const c = off.getContext('2d');
    if (!c) return;
    this.renderScene(c, this.cam, !this.isZoomed);

    this.cache.bmp = off;
    this.cache.scale = this.cam.scale;
    this.cache.tx = this.cam.tx;
    this.cache.ty = this.cam.ty;
    this.cache.stale = false;
  }

  // Snapshot permanente da vista COMPLETA: é o plano de fundo dos quadros em
  // que o gesto sai da área coberta pelo cache (zoom afastando). Um único
  // drawImage por quadro — nada de re-raster durante a animação. Re-tirado
  // em segundo plano quando as cores do mapa mudam (captura, heatmap).
  private renderBaseSnap(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const base = this.baseCam();
    const off =
      this.baseSnap && this.baseSnap.bmp.width === canvas.width && this.baseSnap.bmp.height === canvas.height
        ? this.baseSnap.bmp
        : document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const c = off.getContext('2d');
    if (!c) return;
    this.renderScene(c, base, true);
    this.baseSnap = { bmp: off, scale: base.scale, tx: base.tx, ty: base.ty };
  }

  private scheduleBaseSnap(): void {
    window.clearTimeout(this.baseSnapTimer);
    this.baseSnapTimer = window.setTimeout(() => this.renderBaseSnap(), 250);
  }

  private requestDraw(): void {
    if (this.drawRaf) return;
    this.drawRaf = requestAnimationFrame(() => {
      this.drawRaf = 0;
      this.draw();
    });
  }

  // A blit do bitmap só é válida se a vista atual estiver CONTIDA na área
  // que o bitmap cobre. Ao afastar o zoom, a vista alarga além do cache e
  // apareceriam bordas em branco (o "mapa recortado" por um instante, até a
  // re-raster de idle chegar). Nesses quadros, re-rasteriza na hora — os
  // mega-paths tornam o raster completo barato o bastante para isso.
  private cacheCovers(): boolean {
    if (!this.cache.bmp) return false;
    const eps = 0.5; // meia unidade do mundo de tolerância nas bordas
    const cur = this.rectForCam(this.cam);
    const cached = this.rectForCam({
      scale: this.cache.scale,
      tx: this.cache.tx,
      ty: this.cache.ty,
    });
    return (
      cur.minX >= cached.minX - eps &&
      cur.minY >= cached.minY - eps &&
      cur.maxX <= cached.maxX + eps &&
      cur.maxY <= cached.maxY + eps
    );
  }

  private draw(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    if (this.cache.stale) this.rasterFull();
    const bmp = this.cache.bmp;
    if (!bmp) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // bitmap reprojetado: pan/zoom desliza uma imagem pronta. Se a vista
    // atual sai da área coberta pelo cache do gesto (zoom afastando), o
    // snapshot da vista completa entra por baixo — cobre tudo por um único
    // drawImage, sem re-raster no meio do gesto.
    const blit = (b: HTMLCanvasElement, scale: number, tx: number, ty: number) => {
      const k = this.cam.scale / scale;
      ctx.drawImage(
        b,
        (this.cam.tx - tx * k) * this.dpr,
        (this.cam.ty - ty * k) * this.dpr,
        b.width * k,
        b.height * k
      );
    };
    if (this.cacheCovers()) {
      blit(bmp, this.cache.scale, this.cache.tx, this.cache.ty);
    } else if (this.baseSnap) {
      blit(this.baseSnap.bmp, this.baseSnap.scale, this.baseSnap.tx, this.baseSnap.ty);
    } else {
      this.rasterFull();
      blit(this.cache.bmp!, this.cache.scale, this.cache.tx, this.cache.ty);
    }

    // overlays em espaço do mundo
    this.applyCam(ctx);

    if (!this.isZoomed && this.hoverState) {
      const sp = this.statePaths.get(this.hoverState);
      if (sp) {
        ctx.fillStyle = STATE_HOVER_FILL;
        ctx.fill(sp);
        ctx.strokeStyle = STATE_HOVER_STROKE;
        ctx.lineWidth = 0.45;
        ctx.stroke(sp);
      }
    }

    if (this.isZoomed && this.zoomedState) {
      const sp = this.statePaths.get(this.zoomedState);
      if (sp) {
        ctx.strokeStyle = ACTIVE_STATE_STROKE;
        ctx.lineWidth = 0.6;
        ctx.stroke(sp);
      }
    }

    if (this.hoverCity && this.isZoomed) {
      ctx.fillStyle = CITY_HOVER_FILL;
      ctx.fill(this.hoverCity.path);
    }

    // pulso do destaque: a cidade cresce e volta (2 ciclos)
    if (this.pulse) {
      const elapsed = performance.now() - this.pulse.start;
      const t = Math.min(1, elapsed / 1300);
      const amp = Math.sin(Math.PI * ((t * 2) % 1));
      const s = 1 + 1.3 * amp;
      const b = this.pulse.city.bbox;
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = this.pulse.city.capturedTier
        ? TIER_FILLS[this.pulse.city.capturedTier] || '#ff4b4b'
        : '#ff4b4b';
      ctx.fill(this.pulse.city.path);
      ctx.restore();
    }

    this.repositionMarkers();
  }

  private scheduleReraster(): void {
    window.clearTimeout(this.rerasterTimer);
    this.rerasterTimer = window.setTimeout(() => {
      this.cache.stale = true;
      this.requestDraw();
    }, RERASTER_IDLE_MS);
  }

  // ── Hit-test ──

  private hitCity(clientX: number, clientY: number): CityRec | null {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = this.screenToWorld(clientX - rect.left, clientY - rect.top);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const city of this.cities) {
      const b = city.bbox;
      if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
      if (ctx.isPointInPath(city.path, x, y)) return city;
    }
    return null;
  }

  // ── Hover de estado ──

  private clearStateHover(): void {
    if (!this.hoverState) return;
    this.hoverState = null;
    this.requestDraw();
  }

  private setStateHover(state: string | null): void {
    if (this.isZoomed) return;
    if (this.hoverState === state) return;
    this.hoverState = state;
    this.requestDraw();
  }

  // ── Tooltip ──

  private setTooltipContent({ city, state, population }: TooltipData): void {
    this.opts.tooltipTitle.textContent = `${city || 'Municipio'}${state ? ` (${state})` : ''}`;
    this.opts.tooltipSubtitle.textContent = population
      ? `${formatPop(population)} habitantes`
      : 'Populacao indisponivel';
  }

  private setTooltipPosition(x: number, y: number): void {
    const rect = this.opts.tooltip.getBoundingClientRect();
    const pad = 12;
    const maxX = window.innerWidth - rect.width - pad;
    const maxY = window.innerHeight - rect.height - pad;
    this.opts.tooltip.style.left = `${clamp(x, pad, Math.max(pad, maxX))}px`;
    this.opts.tooltip.style.top = `${clamp(y, pad, Math.max(pad, maxY))}px`;
  }

  private showTooltip(): void {
    this.opts.tooltip.classList.remove('hidden');
    this.opts.tooltip.setAttribute('aria-hidden', 'false');
  }

  private hideTooltip(): void {
    if (this.tooltipState.isPinned) return;
    this.opts.tooltip.classList.add('hidden');
    this.opts.tooltip.setAttribute('aria-hidden', 'true');
    this.tooltipState.lastHoverKey = null;
  }

  // Tooltip do ESTADO (vista completa): nome, sigla, municípios e população
  private showStateTooltip(uf: string, mouseX: number, mouseY: number): void {
    if (this.tooltipState.isPinned) return;
    const stats = this.stateStats.get(uf);
    this.opts.tooltipTitle.textContent = `${ufToName[uf] || uf} (${uf})`;
    this.opts.tooltipSubtitle.textContent = stats
      ? `${stats.municipios} municípios · ${formatPop(stats.population)} habitantes`
      : 'Sem dados';
    this.opts.tooltip.classList.remove('city-tooltip--pinned');
    this.showTooltip();
    this.setTooltipPosition(mouseX + 14, mouseY + 14);
    this.tooltipState.lastHoverKey = `state:${uf}`;
  }

  private showTooltipHover(data: TooltipData, mouseX: number, mouseY: number): void {
    if (this.tooltipState.isPinned) {
      if (this.tooltipState.pinnedCity?.key !== data.key) return;
      this.setTooltipContent(data);
      this.showTooltip();
      this.positionPinnedTooltip();
      return;
    }
    this.opts.tooltip.classList.remove('city-tooltip--pinned');
    this.setTooltipContent(data);
    this.showTooltip();
    this.setTooltipPosition(mouseX + 14, mouseY + 14);
    this.tooltipState.lastHoverKey = data.key;
  }

  private positionPinnedTooltip(): void {
    const city = this.tooltipState.pinnedCity;
    const canvas = this.canvas;
    if (!this.tooltipState.isPinned || !city || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const b = city.bbox;
    const topLeft = this.worldToScreen(b.minX, b.minY);
    const botRight = this.worldToScreen(b.maxX, b.maxY);
    const cxViewport = rect.left + (topLeft.x + botRight.x) / 2;
    const topViewport = rect.top + topLeft.y;
    const tooltipRect = this.opts.tooltip.getBoundingClientRect();
    const x = cxViewport - tooltipRect.width / 2;
    let y = topViewport - tooltipRect.height - 12;
    if (y < 12) y = rect.top + botRight.y + 12;
    this.setTooltipPosition(x, y);
  }

  private pinTooltip(city: CityRec): void {
    this.tooltipState.isPinned = true;
    this.tooltipState.pinnedCity = city;
    this.opts.tooltip.classList.add('city-tooltip--pinned');
    this.setTooltipContent({ city: city.city, state: city.state, population: city.population, key: city.key });
    this.showTooltip();
    this.positionPinnedTooltip();
  }

  clearPinnedTooltip(): void {
    this.tooltipState.isPinned = false;
    this.tooltipState.pinnedCity = null;
    this.opts.tooltip.classList.remove('city-tooltip--pinned');
    this.hideTooltip();
  }

  // Botão "i" do tooltip fixado: abre o modal de detalhes do município
  openPinnedCityDetails(): void {
    const city = this.tooltipState.pinnedCity;
    if (!this.tooltipState.isPinned || !city) return;
    const curiosity = curiosityFor(this.curiosities, city.city, city.state);
    this.clearPinnedTooltip();
    this.opts.openCityModal({
      city: city.city,
      state: city.state,
      population: city.population,
      curiosity,
    });
  }

  // ── Interação (pointer/touch/roda) ──

  private setupEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (evt) => {
      this.suppressNextClick = false;
      this.pointerDownAt = { x: evt.clientX, y: evt.clientY, id: evt.pointerId };
      this.pointerMoved = false;

      if (evt.pointerType === 'touch') {
        this.pinchPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
        if (this.pinchPointers.size === 2) {
          const pts = [...this.pinchPointers.values()];
          const rect = canvas.getBoundingClientRect();
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
          this.pinchStart = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            cam: { ...this.cam },
            midWorld: this.screenToWorld(midX, midY),
          };
          // A partir daqui o zoom é livre — solta o estado "clicado" e o
          // tooltip fixado, que não fazem mais sentido.
          if (this.zoomedState !== null) {
            this.zoomedState = null;
            this.opts.onZoomChange(null);
          }
          this.clearPinnedTooltip();
        }
      }

      // tocar noutra cidade solta o tooltip fixado (o tap decide o próximo)
      if (this.tooltipState.isPinned) {
        const hit = this.hitCity(evt.clientX, evt.clientY);
        if (!hit || hit.key !== this.tooltipState.pinnedCity?.key) this.clearPinnedTooltip();
      }
    });

    canvas.addEventListener(
      'pointermove',
      (evt) => {
        // pinça (2 dedos): zoom livre ancorado no ponto médio
        if (evt.pointerType === 'touch' && this.pinchPointers.has(evt.pointerId)) {
          this.pinchPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
          if (this.pinchPointers.size === 2 && this.pinchStart) {
            evt.preventDefault();
            this.suppressNextClick = true;
            this.pointerMoved = true;
            const pts = [...this.pinchPointers.values()];
            const rect = canvas.getBoundingClientRect();
            const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
            const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
            const base = this.baseCam().scale;
            const scale = clamp(
              this.pinchStart.cam.scale * (dist / Math.max(this.pinchStart.dist, 1)),
              base,
              base * MAX_ZOOM
            );
            this.cam = {
              scale,
              tx: midX - this.pinchStart.midWorld.x * scale,
              ty: midY - this.pinchStart.midWorld.y * scale,
            };
            this.clampPan();
            if (!this.manualZoomActive) {
              this.manualZoomActive = true;
              this.isZoomed = true;
              this.opts.onManualZoomChange(true);
            }
            this.cachePanDraw();
            return;
          }
        }

        // arrasto (1 ponteiro) quando zoomado: pan
        if (this.pointerDownAt && evt.pointerId === this.pointerDownAt.id && this.isZoomed && this.pinchPointers.size < 2) {
          const dx = evt.clientX - this.pointerDownAt.x;
          const dy = evt.clientY - this.pointerDownAt.y;
          if (this.pointerMoved || Math.abs(dx) + Math.abs(dy) > 6) {
            this.pointerMoved = true;
            this.cam.tx += evt.clientX - this.pointerDownAt.x;
            this.cam.ty += evt.clientY - this.pointerDownAt.y;
            this.pointerDownAt = { x: evt.clientX, y: evt.clientY, id: evt.pointerId };
            this.clampPan();
            this.cachePanDraw();
            return;
          }
        }

        // hover (mouse) em dois níveis:
        // - mapa completo: destaca o estado e mostra a info DELE
        // - com zoom (as siglas somem): destaca a cidade e mostra a info DELA
        if (evt.pointerType === 'mouse' && !this.pointerDownAt) {
          if (this.birthAnimActive) return; // roleta dirige o destaque, não o mouse
          const hit = this.hitCity(evt.clientX, evt.clientY);
          canvas.style.cursor = hit ? 'pointer' : 'default';
          // Modo de palpite do Desafio Diário: sem tooltip de nome (nem de
          // cidade, nem de estado) — senão o hover do mouse entregaria a
          // resposta sem precisar clicar. Mantém só o cursor de "clicável".
          if (this.guessCallback) {
            this.hideTooltip();
            return;
          }
          if (!this.isZoomed) {
            this.setStateHover(hit?.state ?? null);
            if (hit) this.showStateTooltip(hit.state, evt.clientX, evt.clientY);
            else this.hideTooltip();
            return;
          }
          const nextHover = hit ?? null;
          if (nextHover !== this.hoverCity) {
            this.hoverCity = nextHover;
            this.requestDraw();
          }
          if (hit) {
            this.showTooltipHover(
              { city: hit.city, state: hit.state, population: hit.population, key: hit.key },
              evt.clientX,
              evt.clientY
            );
          } else {
            this.hideTooltip();
          }
        }
      },
      { passive: false }
    );

    const endPointer = (evt: PointerEvent) => {
      if (evt.pointerType === 'touch') {
        this.pinchPointers.delete(evt.pointerId);
        if (this.pinchPointers.size < 2 && this.pinchStart) this.finishPinch();
      }
      if (this.pointerDownAt && evt.pointerId === this.pointerDownAt.id) {
        const wasTap = !this.pointerMoved && !this.suppressNextClick;
        this.pointerDownAt = null;
        if (wasTap && evt.type === 'pointerup') this.handleTap(evt.clientX, evt.clientY);
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', (evt) => {
      endPointer(evt);
      if (evt.pointerType === 'mouse') {
        this.clearStateHover();
        if (this.hoverCity) {
          this.hoverCity = null;
          this.requestDraw();
        }
        this.hideTooltip();
      }
    });

    // roda do mouse: zoom manual ancorado no cursor (desktop)
    canvas.addEventListener(
      'wheel',
      (evt) => {
        evt.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = evt.clientX - rect.left;
        const my = evt.clientY - rect.top;
        const factor = evt.deltaY < 0 ? 1.15 : 1 / 1.15;
        const base = this.baseCam().scale;
        const next = clamp(this.cam.scale * factor, base, base * MAX_ZOOM);
        if (next === this.cam.scale) return;
        const world = this.screenToWorld(mx, my);
        this.cam = { scale: next, tx: mx - world.x * next, ty: my - world.y * next };
        this.clampPan();
        if (next <= base * 1.02) {
          // voltou ao tamanho original: encaixa na vista completa
          this.cam = this.baseCam();
          if (this.isZoomed) this.resetZoomStateOnly();
        } else if (this.zoomedState !== null || !this.isZoomed) {
          this.zoomedState = null;
          this.isZoomed = true;
          this.manualZoomActive = true;
          this.opts.onZoomChange(null);
          this.opts.onManualZoomChange(true);
          this.clearPinnedTooltip();
        }
        this.cachePanDraw();
        this.positionPinnedTooltip();
      },
      { passive: false }
    );
  }

  // desenho rápido durante gesto + re-raster quando o gesto assenta
  private cachePanDraw(): void {
    this.requestDraw();
    this.scheduleReraster();
    this.positionPinnedTooltip();
  }

  // não deixa afastar o mapa inteiro pra fora da vista
  private clampPan(): void {
    const wpx = this.world.w * this.cam.scale;
    const hpx = this.world.h * this.cam.scale;
    this.cam.tx = clamp(this.cam.tx, this.cssW - wpx - wpx * 0.4 + this.world.x, wpx * 0.4 - this.world.x * this.cam.scale);
    this.cam.ty = clamp(this.cam.ty, this.cssH - hpx - hpx * 0.4 + this.world.y, hpx * 0.4 - this.world.y * this.cam.scale);
  }

  private resetZoomStateOnly(): void {
    this.isZoomed = false;
    this.zoomedState = null;
    this.manualZoomActive = false;
    this.hoverCity = null;
    // Zoom voltando à vista completa (roda do mouse) também cancela um
    // palpite do Desafio Diário em aberto, igual ao botão "Voltar".
    this.guessCallback = null;
    this.clearGuessMarkers();
    this.opts.onZoomChange(null);
    this.opts.onManualZoomChange(false);
    this.cache.stale = true;
    this.requestDraw();
  }

  // Se o usuário pinçou de volta perto do tamanho original, encaixa
  // exatamente na vista completa em vez de deixar um zoom quase-1:1 torto.
  private finishPinch(): void {
    this.pinchStart = null;
    if (!this.manualZoomActive) return;
    if (this.cam.scale <= this.baseCam().scale * 1.03) this.resetZoom();
  }

  private handleTap(clientX: number, clientY: number): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.birthAnimActive) return; // roleta rodando: mapa em modo cinema
    const hit = this.hitCity(clientX, clientY);

    // Modo de palpite do Desafio Diário: QUALQUER município tocado (mesmo
    // fora do estado originalmente zoomado, caso o jogador tenha panejado)
    // é o palpite — navegação normal fica suspensa. Toque vazio (oceano)
    // é ignorado, então errar o dedo não custa a tentativa.
    if (this.guessCallback) {
      if (!hit) return;
      const onGuess = this.guessCallback;
      this.guessCallback = null;
      onGuess(hit.key);
      return;
    }

    // Só existe "fora da área" quando zoomado num estado específico via
    // clique; em zoom manual (pinça/roda) qualquer cidade pode ser tocada.
    const inStateZoom = this.isZoomed && this.zoomedState !== null;
    if (inStateZoom && (!hit || hit.state !== this.zoomedState)) {
      this.resetZoom();
      return;
    }
    if (!hit) return;
    if (this.isZoomed) this.pinTooltip(hit);
    if (hit.population) {
      this.opts.setStatus(
        `${hit.city}${hit.state ? ` (${hit.state})` : ''} - ${formatPop(hit.population)} habitantes`
      );
    } else {
      this.opts.setStatus(`Sem populacao encontrada para ${hit.city}.`);
    }
    if (!this.isZoomed) this.focusState(hit.state);
  }

  // ── Sorteio ponderado por população ──

  private weightedPick(list: CityRec[], rng: () => number): CityRec {
    const totalWeight = list.reduce((sum, city) => sum + (city.population || 0), 0);
    let r = rng() * totalWeight;
    let selected = list[list.length - 1];
    for (const city of list) {
      r -= city.population || 0;
      if (r <= 0) {
        selected = city;
        break;
      }
    }
    return selected;
  }

  private rebuildCapturedPaths(): void {
    this.capturedPaths = new Map();
    for (const city of this.allCities) {
      if (!city.capturedTier) continue;
      let p = this.capturedPaths.get(city.capturedTier);
      if (!p) {
        p = new Path2D();
        this.capturedPaths.set(city.capturedTier, p);
      }
      p.addPath(city.path);
    }
    this.cache.stale = true;
    this.scheduleBaseSnap();
    this.requestDraw();
  }

  // Pinta a cidade sorteada (cor de raridade) e anuncia no status — a parte
  // VISÍVEL da captura, separada para a roleta poder adiá-la até o pouso.
  private commitCaptureVisual(selected: CityRec): void {
    const { population, city, state } = selected;
    selected.capturedTier = rarityFor(population || 0).id;
    let tierPath = this.capturedPaths.get(selected.capturedTier);
    if (!tierPath) {
      tierPath = new Path2D();
      this.capturedPaths.set(selected.capturedTier, tierPath);
    }
    tierPath.addPath(selected.path);
    this.cache.stale = true;
    this.scheduleBaseSnap();
    this.requestDraw();
    this.opts.setStatus(
      `Nasceu em ${city} (${state}) — ${formatPop(population || 0)} hab. — chance ${formatChance(population || 0)}%`
    );
  }

  private toPicked(selected: CityRec, deferVisual = false): PickedCity {
    const { key, population, city, state } = selected;
    const idx = this.availableCities.findIndex((c) => c.key === key);
    if (idx !== -1) this.availableCities.splice(idx, 1);

    if (deferVisual) this.pendingCapture = selected;
    else this.commitCaptureVisual(selected);

    const chance = formatChance(population || 0);
    const curiosity = curiosityFor(this.curiosities, city, state);
    return { key, city, state, population: population || 0, chance, curiosity };
  }

  // Sorteio normal: só municípios ainda não capturados. Com deferVisual, a
  // pintura/status ficam pendentes até a roleta pousar (playBirthRoulette).
  pickBirth(deferVisual = false): PickedCity | null {
    if (!this.availableCities.length) {
      this.opts.setStatus('Nenhum municipio restante para nascer.');
      return null;
    }
    return this.toPicked(this.weightedPick(this.availableCities, Math.random), deferVisual);
  }

  // Desafio diário: sorteia sobre TODOS os municípios com o RNG semeado,
  // para que todo jogador receba a mesma cidade no mesmo dia. deferVisual
  // evita pintar a cidade-alvo antes do palpite (entregaria a resposta a
  // quem procurasse a mancha de cor nova no mapa).
  pickDaily(rng: () => number, deferVisual = false): PickedCity | null {
    if (!this.allCities.length) return null;
    return this.toPicked(this.weightedPick(this.allCities, rng), deferVisual);
  }

  // ── Coleção persistida ──

  totalCities(): number {
    return this.allCities.length;
  }

  // Pinta as cidades já capturadas (na cor da raridade de cada uma) e as
  // remove do pool de sorteio
  restoreCaptured(keys: Set<string>): void {
    if (!keys.size) return;
    this.allCities.forEach((city) => {
      if (keys.has(city.key)) city.capturedTier = rarityFor(city.population || 0).id;
    });
    this.availableCities = this.availableCities.filter((c) => !keys.has(c.key));
    this.rebuildCapturedPaths();
  }

  // Desfaz TODAS as capturas no mapa e devolve o pool completo de sorteio.
  // Usado na troca de identidade (login/logout/troca de conta) antes de
  // restaurar o progresso do novo dono da sessão.
  resetCaptured(): void {
    // troca de dono da sessão no meio da roleta: cancela sem aplicar nada
    this.cancelBirthRoulette();
    this.pendingCapture = null;
    this.allCities.forEach((city) => {
      city.capturedTier = null;
    });
    this.availableCities = [...this.allCities];
    this.rebuildCapturedPaths();
  }

  // ── Destaque visual de um município (pin estilo mapa + pulso) ──

  // Zoom no estado da cidade e, quando a animação de zoom termina (420ms),
  // dispara o pulso e o pin sobre o município.
  focusCity(key: string): void {
    const hit = this.byKey.get(key);
    if (!hit) return;
    this.focusState(hit.state);
    window.clearTimeout(this.focusCityTimer);
    this.focusCityTimer = window.setTimeout(() => this.highlightCity(key), ZOOM_MS + 40);
  }

  // A cidade cresce e volta (2 pulsos) e um pin vermelho estilo Google Maps
  // cai sobre ela, sumindo sozinho depois de alguns segundos.
  highlightCity(key: string): void {
    const hit = this.byKey.get(key);
    if (!hit || !this.canvas) return;

    this.pulse = { city: hit, start: performance.now() };
    cancelAnimationFrame(this.pulseRaf);
    const tick = () => {
      if (!this.pulse) return;
      if (performance.now() - this.pulse.start >= 1300) {
        this.pulse = null;
        this.requestDraw();
        return;
      }
      this.requestDraw();
      this.pulseRaf = requestAnimationFrame(tick);
    };
    this.pulseRaf = requestAnimationFrame(tick);

    this.removePin();
    this.clearGuessMarkers();
    const pin = this.createPin(hit, '#ff4b4b', '#dd3a3a');
    this.opts.container.appendChild(pin);
    this.pinEl = pin;
    this.pinCity = hit;
    this.pinTimer = window.setTimeout(() => this.removePin(), 2800);
  }

  private removePin(): void {
    window.clearTimeout(this.pinTimer);
    this.pinEl?.remove();
    this.pinEl = null;
    this.pinCity = null;
  }

  // Posiciona um marcador flutuante (pin/cruz) em screen-space a partir do
  // centro da bbox da cidade e da câmera ATUAL — chamado tanto na criação
  // quanto a cada frame (repositionMarkers), para acompanhar pan/zoom.
  private positionMarker(el: HTMLDivElement, city: CityRec): void {
    const rect = this.canvas!.getBoundingClientRect();
    const crect = this.opts.container.getBoundingClientRect();
    const b = city.bbox;
    const center = this.worldToScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    el.style.left = `${rect.left - crect.left + center.x}px`;
    el.style.top = `${rect.top - crect.top + center.y}px`;
  }

  // Reposiciona todos os marcadores flutuantes vivos (pin de destaque +
  // pins/cruzes do Desafio Diário) na câmera atual — chamado a cada draw().
  private repositionMarkers(): void {
    if (this.pinEl && this.pinCity) this.positionMarker(this.pinEl, this.pinCity);
    this.guessMarkers.forEach((el, i) => {
      const city = this.guessMarkerCities[i];
      if (city) this.positionMarker(el, city);
    });
  }

  // Elemento de pin estilo Google Maps (mesmo desenho, cor configurável) —
  // usado tanto no destaque de nascimento (vermelho) quanto na revelação de
  // acerto do Desafio Diário (verde).
  private createPin(city: CityRec, colorMain: string, colorDark: string): HTMLDivElement {
    const pin = document.createElement('div');
    pin.className = 'map-pin';
    this.positionMarker(pin, city);
    pin.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1.7c-4.4 0-7.9 3.5-7.9 7.8 0 5.7 6.7 12 7.4 12.7a.8.8 0 0 0 1 0c.7-.7 7.4-7 7.4-12.7 0-4.3-3.5-7.8-7.9-7.8Z" fill="${colorMain}"/><path d="M12 1.7v20.7c.2 0 .4-.1.5-.2.7-.7 7.4-7 7.4-12.7 0-4.3-3.5-7.8-7.9-7.8Z" fill="${colorDark}"/><circle cx="12" cy="9.4" r="3.3" fill="#fff"/></svg>`;
    return pin;
  }

  // Marcador de "palpite errado": um X vermelho centrado no município que o
  // jogador clicou (distinto em forma do pin, não só na cor).
  private createCross(city: CityRec): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'guess-wrong';
    this.positionMarker(el, city);
    el.innerHTML =
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#ef4444" stroke="#fff" stroke-width="1.6"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
    return el;
  }

  private clearGuessMarkers(): void {
    this.guessMarkers.forEach((el) => el.remove());
    this.guessMarkers = [];
    this.guessMarkerCities = [];
  }

  // ── Roleta do sorteio (tec-tec-tec) ──

  // Salta um marcador por cidades aleatórias do mapa, desacelerando, e pousa
  // na cidade sorteada: aplica a captura adiada, dispara o pin + pulso de
  // sempre e chama onDone (~350ms depois, com a cidade ainda pulsando) para
  // o card de resultado abrir. Total ~2s.
  playBirthRoulette(targetKey: string, onDone: () => void): void {
    const target = this.byKey.get(targetKey);
    if (!target || !this.canvas || !this.allCities.length) {
      this.applyPendingCapture();
      onDone();
      return;
    }
    this.cancelBirthRoulette();
    this.birthAnimActive = true;
    this.removePin();
    this.hideTooltip();

    // a raridade do alvo tempera os tiques (prévia sonora crescente) e, em
    // Épico/Lendário, liga o riser que sobe até o pouso
    const tierId = rarityFor(target.population || 0).id;

    const start = () => {
      if (!this.birthAnimActive || this.destroyed) return;
      const delays = [85, 85, 95, 105, 115, 135, 160, 190, 230, 280, 340];
      sfxRouletteRiser(tierId, 1.85);
      const marker = document.createElement('div');
      marker.className = 'map-pin map-pin--roleta';
      marker.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 1.7c-4.4 0-7.9 3.5-7.9 7.8 0 5.7 6.7 12 7.4 12.7a.8.8 0 0 0 1 0c.7-.7 7.4-7 7.4-12.7 0-4.3-3.5-7.8-7.9-7.8Z" fill="#f6b40e"/><circle cx="12" cy="9.4" r="3.3" fill="#fff"/></svg>';
      this.opts.container.appendChild(marker);
      this.rouletteMarker = marker;

      const rect = this.canvas!.getBoundingClientRect();
      const crect = this.opts.container.getBoundingClientRect();
      const place = (c: CityRec) => {
        const b = c.bbox;
        const p = this.worldToScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
        marker.style.left = `${rect.left - crect.left + p.x}px`;
        marker.style.top = `${rect.top - crect.top + p.y}px`;
      };

      let i = 0;
      const hop = () => {
        if (!this.birthAnimActive || this.destroyed) {
          marker.remove();
          return;
        }
        if (i < delays.length) {
          const c = this.allCities[Math.floor(Math.random() * this.allCities.length)];
          place(c);
          this.hoverCity = c; // acende o município do salto
          this.requestDraw();
          sfxRouletteTick(i, tierId);
          this.rouletteTimer = window.setTimeout(hop, delays[i]);
          i++;
        } else {
          marker.remove();
          this.rouletteMarker = null;
          this.hoverCity = null;
          this.birthAnimActive = false;
          // pouso: pinta a captura, pin + pulso de sempre, e card em seguida
          this.applyPendingCapture();
          this.highlightCity(targetKey);
          this.rouletteTimer = window.setTimeout(onDone, 350);
        }
      };
      hop();
    };

    // roleta pede a vista completa — se estiver com zoom, volta primeiro
    if (this.isZoomed) {
      this.resetZoom();
      this.rouletteTimer = window.setTimeout(start, 440);
    } else {
      start();
    }
  }

  private applyPendingCapture(): void {
    if (!this.pendingCapture) return;
    this.commitCaptureVisual(this.pendingCapture);
    this.pendingCapture = null;
  }

  private cancelBirthRoulette(): void {
    this.birthAnimActive = false;
    window.clearTimeout(this.rouletteTimer);
    this.rouletteMarker?.remove();
    this.rouletteMarker = null;
  }

  // ── Desafio Diário: modo de palpite ──

  // Dá zoom no estado da cidade sorteada e passa a interpretar o PRÓXIMO
  // toque em qualquer município como o palpite do jogador — chama onGuess
  // exatamente uma vez, com a chave da cidade tocada.
  startDailyGuess(targetKey: string, onGuess: (guessedKey: string) => void): void {
    const target = this.byKey.get(targetKey);
    if (!target || !this.canvas) return;
    this.clearGuessMarkers();
    this.guessCallback = onGuess;
    this.focusState(target.state);
  }

  // Cancela um palpite em aberto sem revelar nada (ex.: o jogador trocou de
  // conta no meio do desafio).
  cancelDailyGuess(): void {
    this.guessCallback = null;
    this.clearGuessMarkers();
  }

  // Revela o resultado: pin verde na cidade certa e, se o palpite foi
  // diferente dela, um X vermelho na cidade em que o jogador clicou.
  revealGuess(targetKey: string, guessedKey: string): void {
    this.applyPendingCapture(); // pinta a cidade-alvo só agora, na revelação
    this.clearGuessMarkers();
    if (!this.canvas) return;
    const target = this.byKey.get(targetKey);
    if (target) {
      this.guessMarkers.push(this.createPin(target, '#22c55e', '#15803d'));
      this.guessMarkerCities.push(target);
    }
    if (guessedKey !== targetKey) {
      const guessed = this.byKey.get(guessedKey);
      if (guessed) {
        this.guessMarkers.push(this.createCross(guessed));
        this.guessMarkerCities.push(guessed);
      }
    }
    this.guessMarkers.forEach((el) => this.opts.container.appendChild(el));
  }

  // Dados de exibição de um município a partir da chave persistida — permite
  // reconstruir o Citydex de uma conta só com as chaves vindas do servidor.
  getCityByKey(key: string): { city: string; state: string; population: number; chance: string } | null {
    const found = this.byKey.get(key);
    if (!found || !found.population) return null;
    return {
      city: found.city,
      state: found.state,
      population: found.population,
      chance: formatChance(found.population),
    };
  }

  // ── Heatmap de população ──

  setHeatmap(enabled: boolean): void {
    if (enabled && !this.heatPaths) {
      this.heatPaths = HEAT_BUCKETS.map(() => new Path2D());
      this.allCities.forEach((city) => {
        this.heatPaths![heatBucket(city.population || 0)].addPath(city.path);
      });
    }
    this.heatmapOn = enabled;
    this.cache.stale = true;
    this.scheduleBaseSnap();
    this.requestDraw();
  }

  // ── Estatísticas por estado ──

  getStateStats(): StateStats[] {
    return [...this.stateStats.values()].sort((a, b) => a.uf.localeCompare(b.uf));
  }

  getCityInfo(key: string): { city: string; state: string } | null {
    const hit = this.byKey.get(key);
    return hit ? { city: hit.city, state: hit.state } : null;
  }

  // ── Carga do mapa e dos dados ──

  private async loadMap(): Promise<void> {
    const { container, setStatus } = this.opts;
    try {
      // As três cargas são independentes entre si — dispara todas de uma vez.
      const svgPromise = fetch(MAP_URL).then((r) => {
        if (!r.ok) throw new Error('Resposta HTTP nao OK ao carregar o mapa');
        return r.text();
      });
      const municipiosPromise = fetch(MUNICIPIOS_URL).then((r) => {
        if (!r.ok) throw new Error('Nao foi possivel carregar municipios.json');
        return r.json() as Promise<Municipio[]>;
      });
      const curiositiesPromise = loadCuriosities();

      const svgText = await svgPromise;
      if (this.destroyed) return;

      // DOMParser: o SVG é lido como DADO, nunca entra no DOM da página
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svgRoot = doc.querySelector('svg');
      if (!svgRoot) throw new Error('SVG nao encontrado');

      const viewBoxAttr = svgRoot.getAttribute('viewBox') || svgRoot.getAttribute('viewbox');
      if (viewBoxAttr) {
        const [x, y, w, h] = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
        this.world = { x: x || 0, y: y || 0, w: w || 680, h: h || 680 };
      } else {
        const w = parseFloat(svgRoot.getAttribute('width') || '') || 680;
        const h = parseFloat(svgRoot.getAttribute('height') || '') || 680;
        this.world = { x: 0, y: 0, w, h };
      }

      const [municipios, curiosities] = await Promise.all([municipiosPromise, curiositiesPromise]);
      if (this.destroyed) return;
      const populationIndex = buildPopulationIndex(municipios);
      this.curiosities = curiosities;

      // contorno dos estados: forro do país (e base das divisas estaduais)
      doc.querySelectorAll('path[id^="state-border"]').forEach((b) => {
        const d = b.getAttribute('d');
        if (d) this.borderPath.addPath(new Path2D(d));
      });

      this.tonePaths = STATE_TONES.map(() => new Path2D());
      const ufOrder = Object.keys(ufToName);

      const regions = Array.from(doc.querySelectorAll('path[data-name]'));
      let matched = 0;
      let processed = 0;
      this.missing = [];
      this.cities = [];

      // Lotes com yield entre eles: mantém o custo de carga fora do TBT.
      const CHUNK_SIZE = 800;
      for (let startIdx = 0; startIdx < regions.length; startIdx += CHUNK_SIZE) {
        if (this.destroyed) return;
        for (const node of regions.slice(startIdx, startIdx + CHUNK_SIZE)) {
          const rawName = node.getAttribute('data-name') || '';
          const d = node.getAttribute('d') || '';
          const [cidadeRaw = '', ufRaw = ''] = rawName.split(',').map((s) => s.trim());
          const cidade = cleanCity(cidadeRaw);
          const uf = ufRaw.toUpperCase();
          const estadoNome = ufToName[uf] || ufRaw;
          const aliasCity =
            cityAliases.get(keyFor(cidade, uf)) || cityAliases.get(keyFor(cidade, estadoNome));
          const lookupCities = [cidade, aliasCity].filter((c): c is string => Boolean(c));
          const stateKey = uf || estadoNome || '';
          if (!cidade || !d) continue;

          const candidates: string[] = [];
          lookupCities.forEach((cityName) => {
            candidates.push(keyFor(cityName, uf));
            candidates.push(keyFor(cityName, estadoNome));
            candidates.push(keyFor(cityName, ufToName[uf] || ''));
          });
          let populacao: number | null = null;
          for (const candidate of candidates) {
            const found = populationIndex.get(candidate);
            if (found !== undefined) {
              populacao = found;
              break;
            }
          }

          processed += 1;
          const uniqueKey = keyFor(cidade, stateKey);
          const path = new Path2D(d);
          const bbox = bboxOfPathD(d);
          const capital = CAPITAL_KEYS.has(uniqueKey);
          const rec: CityRec = {
            key: uniqueKey,
            city: cidade,
            state: stateKey,
            population: populacao,
            title: populacao
              ? `${cidade}${uf ? ` (${uf})` : ''} - ${formatPop(populacao)} habitantes`
              : cidade,
            path,
            bbox,
            capital,
            capturedTier: null,
          };
          this.cities.push(rec);
          if (!this.byKey.has(uniqueKey)) this.byKey.set(uniqueKey, rec);

          // camadas de cor
          (capital ? this.capitalPath : this.tonePaths[Math.max(0, ufOrder.indexOf(stateKey)) % 3]).addPath(path);
          this.strokeAll.addPath(path);
          let sp = this.statePaths.get(stateKey);
          if (!sp) {
            sp = new Path2D();
            this.statePaths.set(stateKey, sp);
          }
          sp.addPath(path);
          this.stateBBoxes.set(stateKey, unionBBox(this.stateBBoxes.get(stateKey) || null, bbox));

          if (populacao) {
            matched += 1;
          } else {
            this.missing.push(rawName || '(sem nome)');
          }
        }
        if (startIdx + CHUNK_SIZE < regions.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (this.destroyed) return;

      this.allCities = this.cities.filter((c) => c.population);
      this.availableCities = [...this.allCities];
      this.stateStats.clear();
      this.allCities.forEach(({ state, population }) => {
        const stats = this.stateStats.get(state) || { uf: state, municipios: 0, population: 0 };
        stats.municipios += 1;
        stats.population += population || 0;
        this.stateStats.set(state, stats);
      });

      // monta o canvas (único nó do mapa no DOM)
      container.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.className = 'map-canvas';
      container.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.setupEvents(canvas);
      this.resizeCanvas();

      const missingMsg = this.missing.length
        ? `; faltando ${this.missing.length}. Veja o console para exemplos.`
        : '.';
      setStatus(`Populacao vinculada para ${matched}/${processed} municipios${missingMsg}`);
      if (this.missing.length) {
        console.warn(
          'Municipios sem correspondencia de populacao (amostra):',
          this.missing.slice(0, 30)
        );
      }
    } catch (err) {
      setStatus('Nao foi possivel carregar o mapa ou as populacoes.');
      console.error(err);
      this.opts.openMessageModal(
        'Nao foi possivel carregar o mapa do Brasil. Verifique a conexao e recarregue a pagina.',
        'Erro ao carregar'
      );
    }
  }
}
