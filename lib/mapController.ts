import type { BBox, CityModalData, Municipio, PickedCity, StateEntry, StateStats, ViewBox } from './types';
import { cityAliases, stateLabelOffsets, stateLabelText, ufToName } from './geo';
import { clamp, cleanCity, formatChance, formatPop, keyFor } from './text';
import { buildPopulationIndex, getPopulation, type PopulationIndex } from './population';
import { curiosityFor, loadCuriosities, type CuriosityMap } from './curiosities';
import { HEAT_BUCKETS, heatBucket } from './heatmap';

const MAP_URL = '/MAPAESTADOS.svg';
const MUNICIPIOS_URL = '/municipios.json';
const SVG_NS = 'http://www.w3.org/2000/svg';

interface TooltipData {
  city: string;
  state: string;
  population: number | null;
  key: string;
}

interface AvailableCity {
  key: string;
  path: SVGPathElement;
  population: number;
  city: string;
  state: string;
  title: string;
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
  // Zoom manual (pinça com 2 dedos), independente de um estado especifico —
  // controla so a visibilidade do botao "Voltar".
  onManualZoomChange: (active: boolean) => void;
}

export class MapController {
  private opts: MapControllerOptions;
  private stateGroups = new Map<string, StateEntry>();
  private currentSvg: SVGSVGElement | null = null;
  private baseViewBox: ViewBox | null = null;
  private isZoomed = false;
  private zoomedState: string | null = null;
  private manualZoomActive = false;
  private hoverState: string | null = null;
  private viewBoxAnimation: number | null = null;
  // Zoom com dois dedos (pinça): so rastreia toques (nunca mouse), entao
  // nao interfere em nada da interacao por clique existente.
  private pinchPointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; viewBox: ViewBox; svgMid: { x: number; y: number } } | null =
    null;
  private suppressNextClick = false;
  private availableCities: AvailableCity[] = [];
  private allCities: AvailableCity[] = [];
  private stateStats = new Map<string, StateStats>();
  private populationIndex: PopulationIndex | null = null;
  private curiosities: CuriosityMap = new Map();
  private missing: string[] = [];
  private destroyed = false;
  private heatmapApplied = false;

  private tooltipState = {
    isPinned: false,
    pinnedKey: null as string | null,
    pinnedTarget: null as SVGPathElement | null,
    pinnedData: null as TooltipData | null,
    lastHoverKey: null as string | null,
  };

  private docPointerDown = (evt: PointerEvent) => {
    if (!this.tooltipState.isPinned) return;
    const target = evt.target as Node | null;
    if (target && this.opts.tooltip.contains(target)) return;
    if (target && this.tooltipState.pinnedTarget?.contains(target)) return;
    this.clearPinnedTooltip();
  };

  private docClick = (evt: MouseEvent) => {
    // Em zoom manual (pinça, sem estado especifico associado) nao existe
    // "fora da area" — so o botao Voltar ou pinçar de volta encerram o zoom.
    if (!this.isZoomed || this.zoomedState === null) return;
    const el = evt.target as Element | null;
    // Cliques dentro de modais/paineis ou do tooltip fixado não devem resetar
    // o zoom. (React delega eventos no document, então stopPropagation nos
    // handlers não impede este listener — o filtro precisa ser feito aqui.)
    // Se o alvo já foi removido do DOM (React fecha o painel antes de o evento
    // chegar aqui), também não há como julgar o clique — ignora.
    if (!el || !el.isConnected) return;
    if (
      el.closest('.modal-backdrop') ||
      el.closest('.modal-panel') ||
      el.closest('.city-tooltip')
    ) {
      return;
    }
    const region = el.closest('.region') as SVGPathElement | null;
    if (!region || region.dataset.state !== this.zoomedState) this.resetZoom();
  };

  private winReposition = () => this.positionPinnedTooltip();

  constructor(opts: MapControllerOptions) {
    this.opts = opts;
  }

  // ── Ciclo de vida ──

  async init(): Promise<void> {
    document.addEventListener('pointerdown', this.docPointerDown, true);
    document.addEventListener('click', this.docClick);
    window.addEventListener('resize', this.winReposition);
    window.addEventListener('scroll', this.winReposition, true);
    await this.loadMap();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.viewBoxAnimation) cancelAnimationFrame(this.viewBoxAnimation);
    document.removeEventListener('pointerdown', this.docPointerDown, true);
    document.removeEventListener('click', this.docClick);
    window.removeEventListener('resize', this.winReposition);
    window.removeEventListener('scroll', this.winReposition, true);
    this.opts.container.innerHTML = '';
    this.currentSvg = null;
  }

  // ── ViewBox / zoom ──

  private parseViewBox(str = ''): ViewBox {
    const [x = 0, y = 0, w = 1000, h = 1000] = String(str)
      .split(/\s+/)
      .map((n) => Number(n));
    return { x, y, w, h };
  }

  private setViewBox(svgEl: SVGSVGElement, vb: ViewBox): void {
    svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  private animateViewBox(svgEl: SVGSVGElement, target: ViewBox, duration = 420): void {
    if (this.viewBoxAnimation) cancelAnimationFrame(this.viewBoxAnimation);
    const startBox = this.parseViewBox(svgEl.getAttribute('viewBox') || '');
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = t * t * (3 - 2 * t);
      const mix = (a: number, b: number) => a + (b - a) * ease;
      this.setViewBox(svgEl, {
        x: mix(startBox.x, target.x),
        y: mix(startBox.y, target.y),
        w: mix(startBox.w, target.w),
        h: mix(startBox.h, target.h),
      });
      if (t < 1) this.viewBoxAnimation = requestAnimationFrame(step);
    };
    this.viewBoxAnimation = requestAnimationFrame(step);
  }

  private expandBBox(bbox: BBox, paddingFactor = 0.15, bounds?: ViewBox | null): ViewBox {
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const padX = width * paddingFactor;
    const padY = height * paddingFactor;
    const expanded = {
      x: bbox.minX - padX,
      y: bbox.minY - padY,
      w: width + padX * 2,
      h: height + padY * 2,
    };
    if (!bounds) return expanded;
    return {
      x: Math.max(bounds.x, expanded.x),
      y: Math.max(bounds.y, expanded.y),
      w: Math.min(bounds.w, expanded.w),
      h: Math.min(bounds.h, expanded.h),
    };
  }

  resetZoom(): void {
    if (!this.isZoomed || !this.baseViewBox || !this.currentSvg) return;
    if (this.viewBoxAnimation) cancelAnimationFrame(this.viewBoxAnimation);
    this.animateViewBox(this.currentSvg, this.baseViewBox);
    this.isZoomed = false;
    this.zoomedState = null;
    this.manualZoomActive = false;
    this.pinchStart = null;
    this.clearStateHover();
    this.stateGroups.forEach(({ paths }) =>
      paths.forEach((p) => p.classList.remove('region--state-hover'))
    );
    this.clearActiveState();
    this.currentSvg
      .querySelectorAll('.region--hover')
      .forEach((p) => p.classList.remove('region--hover'));
    this.currentSvg.classList.remove('svg--zoomed');
    this.opts.onZoomChange(null);
    this.opts.onManualZoomChange(false);
    this.clearPinnedTooltip();
  }

  private focusState(state: string): void {
    if (!state || !this.stateGroups.has(state) || !this.baseViewBox || !this.currentSvg) return;
    const entry = this.stateGroups.get(state);
    if (!entry || !entry.bbox) return;
    if (this.viewBoxAnimation) cancelAnimationFrame(this.viewBoxAnimation);
    const target = this.expandBBox(entry.bbox, 0.2, this.baseViewBox);
    this.animateViewBox(this.currentSvg, target);
    this.isZoomed = true;
    this.zoomedState = state;
    this.currentSvg.classList.add('svg--zoomed');
    this.opts.onZoomChange(state);
    this.clearStateHover();
    this.clearActiveState();
    entry.paths.forEach((p) => p.classList.add('region--active-state'));
    entry.paths.forEach((p) => p.classList.add('region--state-hover'));
  }

  // ── Hover de estado ──

  private registerStatePath(state: string, path: SVGPathElement): void {
    if (!state) return;
    const bbox = path.getBBox();
    const entry = this.stateGroups.get(state) || { paths: [], bbox: null };
    const current = entry.bbox || {
      minX: bbox.x,
      minY: bbox.y,
      maxX: bbox.x + bbox.width,
      maxY: bbox.y + bbox.height,
    };
    entry.bbox = {
      minX: Math.min(current.minX, bbox.x),
      minY: Math.min(current.minY, bbox.y),
      maxX: Math.max(current.maxX, bbox.x + bbox.width),
      maxY: Math.max(current.maxY, bbox.y + bbox.height),
    };
    entry.paths.push(path);
    this.stateGroups.set(state, entry);
  }

  private clearStateHover(): void {
    if (!this.hoverState) return;
    const entry = this.stateGroups.get(this.hoverState);
    if (entry) entry.paths.forEach((p) => p.classList.remove('region--state-hover'));
    this.hoverState = null;
  }

  private clearActiveState(): void {
    this.stateGroups.forEach(({ paths }) =>
      paths.forEach((p) => p.classList.remove('region--active-state'))
    );
  }

  private setStateHover(state: string | null | undefined): void {
    if (!state) return;
    if (this.isZoomed) return;
    if (this.hoverState === state) return;
    this.clearStateHover();
    const entry = this.stateGroups.get(state);
    if (!entry) return;
    entry.paths.forEach((p) => p.classList.add('region--state-hover'));
    this.hoverState = state;
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

  private showTooltipHover(data: TooltipData, mouseX: number, mouseY: number): void {
    if (this.tooltipState.isPinned) {
      if (this.tooltipState.pinnedKey !== data.key) return;
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
    if (!this.tooltipState.isPinned || !this.tooltipState.pinnedTarget) return;
    const targetRect = this.tooltipState.pinnedTarget.getBoundingClientRect();
    const tooltipRect = this.opts.tooltip.getBoundingClientRect();
    const x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    let y = targetRect.top - tooltipRect.height - 12;
    if (y < 12) y = targetRect.bottom + 12;
    this.setTooltipPosition(x, y);
  }

  private pinTooltip(data: TooltipData, target: SVGPathElement): void {
    this.tooltipState.isPinned = true;
    this.tooltipState.pinnedKey = data.key;
    this.tooltipState.pinnedTarget = target;
    this.tooltipState.pinnedData = data;
    this.opts.tooltip.classList.add('city-tooltip--pinned');
    this.setTooltipContent(data);
    this.showTooltip();
    this.positionPinnedTooltip();
  }

  clearPinnedTooltip(): void {
    this.tooltipState.isPinned = false;
    this.tooltipState.pinnedKey = null;
    this.tooltipState.pinnedTarget = null;
    this.tooltipState.pinnedData = null;
    this.opts.tooltip.classList.remove('city-tooltip--pinned');
    this.hideTooltip();
  }

  // Botão "i" do tooltip fixado: abre o modal de detalhes do município
  openPinnedCityDetails(): void {
    if (!this.tooltipState.isPinned || !this.tooltipState.pinnedData) return;
    const { city, state, population } = this.tooltipState.pinnedData;
    const curiosity = curiosityFor(this.curiosities, city, state);
    this.clearPinnedTooltip();
    this.opts.openCityModal({ city, state, population, curiosity });
  }

  // ── Rótulos de estado ──

  private renderStateLabels(svgEl: SVGSVGElement): void {
    const existing = svgEl.querySelector('.state-labels');
    if (existing) existing.remove();
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('state-labels');
    this.stateGroups.forEach((entry, stateKey) => {
      if (!entry?.bbox) return;
      const offset = stateLabelOffsets[stateKey] || { x: 0, y: 0 };
      const cx = (entry.bbox.minX + entry.bbox.maxX) / 2 + offset.x;
      const cy = (entry.bbox.minY + entry.bbox.maxY) / 2 + offset.y;
      const text = document.createElementNS(SVG_NS, 'text');
      text.classList.add('state-label');
      text.setAttribute('x', String(cx));
      text.setAttribute('y', String(cy));
      text.textContent = stateLabelText(stateKey);
      g.appendChild(text);
    });
    svgEl.appendChild(g);
  }

  // ── Eventos delegados do SVG ──

  private setupDelegatedEvents(svgEl: SVGSVGElement): void {
    const regionOf = (target: EventTarget | null): SVGPathElement | null =>
      ((target as Element | null)?.closest?.('.region') as SVGPathElement | null) || null;

    // Reseta a cada novo toque (ou clique): garante que um clique "fantasma"
    // gerado ao soltar os dois dedos de uma pinça nao seja confundido com
    // uma interacao futura legitima — o pointerdown de qualquer nova
    // interacao sempre chega antes do click correspondente a ela.
    svgEl.addEventListener('pointerdown', () => {
      this.suppressNextClick = false;
    });

    svgEl.addEventListener('pointerover', (evt) => {
      const region = regionOf(evt.target);
      if (!region || !svgEl.contains(region)) return;
      if (this.isZoomed) {
        region.classList.add('region--hover');
        return;
      }
      this.setStateHover(region.dataset.state);
    });

    svgEl.addEventListener('pointerout', (evt) => {
      if (this.isZoomed) {
        const leaving = regionOf(evt.target);
        if (leaving) leaving.classList.remove('region--hover');
        if (!this.tooltipState.isPinned) this.hideTooltip();
        return;
      }
      const related = evt.relatedTarget as Node | null;
      if (!related || !svgEl.contains(related)) {
        this.clearStateHover();
        return;
      }
      const leaving = regionOf(evt.target);
      const entering = regionOf(related);
      if (leaving && entering && leaving.dataset.state === entering.dataset.state) return;
      this.setStateHover(entering?.dataset.state || null);
    });

    svgEl.addEventListener('pointermove', (evt) => {
      const region = regionOf(evt.target);
      if (!region || !svgEl.contains(region)) {
        this.hideTooltip();
        return;
      }
      if (!this.isZoomed || region.dataset.state !== this.zoomedState) {
        this.hideTooltip();
        return;
      }
      const city = region.dataset.city;
      if (!city) {
        this.hideTooltip();
        return;
      }
      const state = region.dataset.state || '';
      const population =
        Number(region.dataset.population) || getPopulation(this.populationIndex, state, city);
      this.showTooltipHover(
        { city, state, population, key: region.dataset.key || keyFor(city, state) },
        evt.clientX,
        evt.clientY
      );
    });

    svgEl.addEventListener('click', (evt) => {
      // Engole o clique fantasma que alguns navegadores sinteizam ao soltar
      // o segundo dedo de uma pinça, senao ele acabaria fixando um tooltip
      // ou resetando o zoom sem o usuario ter realmente tocado ali.
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      const region = regionOf(evt.target);
      // So existe "fora da area" quando zoomado numa estado especifico via
      // clique; em zoom manual (pinça) qualquer cidade pode ser tocada.
      const inStateZoom = this.isZoomed && this.zoomedState !== null;
      if (inStateZoom && (!region || region.dataset.state !== this.zoomedState)) {
        this.resetZoom();
        return;
      }
      if (!region) return;
      evt.stopPropagation();
      const city = region.dataset.city;
      const stateKey = region.dataset.state || '';
      const pop = Number(region.dataset.population) || getPopulation(this.populationIndex, stateKey, city || '');
      const rawName = region.dataset.rawname;
      if (this.isZoomed && city) {
        this.pinTooltip(
          { city, state: stateKey, population: pop, key: region.dataset.key || keyFor(city, stateKey) },
          region
        );
      }
      if (city && pop) {
        this.opts.setStatus(`${city}${stateKey ? ` (${stateKey})` : ''} - ${formatPop(pop)} habitantes`);
      } else {
        this.opts.setStatus(`Sem populacao encontrada para ${rawName || 'municipio'}.`);
      }
      if (!this.isZoomed) this.focusState(stateKey);
    });
  }

  // ── Zoom com dois dedos (pinça livre no mapa) ──

  private clientToSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = this.currentSvg;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  // Se o usuario pinçou de volta perto do tamanho original, encaixa
  // exatamente na vista completa em vez de deixar um zoom quase-1:1 torto.
  private finishPinch(): void {
    this.pinchStart = null;
    if (!this.manualZoomActive || !this.currentSvg || !this.baseViewBox) return;
    const current = this.parseViewBox(this.currentSvg.getAttribute('viewBox') || '');
    if (current.w >= this.baseViewBox.w * 0.97 && current.h >= this.baseViewBox.h * 0.97) {
      this.resetZoom();
    }
  }

  private setupPinchZoom(svgEl: SVGSVGElement): void {
    const MIN_SCALE = 0.1; // ate ~10x de zoom em relacao a vista completa

    svgEl.addEventListener('pointerdown', (evt) => {
      if (evt.pointerType !== 'touch') return;
      this.pinchPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
      if (this.pinchPointers.size === 2 && this.currentSvg) {
        const pts = [...this.pinchPointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midClientX = (pts[0].x + pts[1].x) / 2;
        const midClientY = (pts[0].y + pts[1].y) / 2;
        this.pinchStart = {
          dist,
          viewBox: this.parseViewBox(this.currentSvg.getAttribute('viewBox') || ''),
          svgMid: this.clientToSvgPoint(midClientX, midClientY),
        };
        // A partir daqui o zoom e livre — solta qualquer estado "clicado"
        // especifico e qualquer tooltip fixado, que nao fazem mais sentido.
        if (this.zoomedState !== null) {
          this.zoomedState = null;
          this.opts.onZoomChange(null);
        }
        this.clearPinnedTooltip();
      }
    });

    svgEl.addEventListener(
      'pointermove',
      (evt) => {
        if (evt.pointerType !== 'touch' || !this.pinchPointers.has(evt.pointerId)) return;
        this.pinchPointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
        if (this.pinchPointers.size !== 2 || !this.pinchStart || !this.currentSvg || !this.baseViewBox) {
          return;
        }
        evt.preventDefault();
        this.suppressNextClick = true;

        const pts = [...this.pinchPointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midClientX = (pts[0].x + pts[1].x) / 2;
        const midClientY = (pts[0].y + pts[1].y) / 2;

        const scale = this.pinchStart.dist / Math.max(dist, 1);
        const maxW = this.baseViewBox.w;
        const maxH = this.baseViewBox.h;
        const newW = clamp(this.pinchStart.viewBox.w * scale, maxW * MIN_SCALE, maxW);
        const newH = clamp(this.pinchStart.viewBox.h * scale, maxH * MIN_SCALE, maxH);

        const svgRect = this.currentSvg.getBoundingClientRect();
        const fracX = (midClientX - svgRect.left) / svgRect.width;
        const fracY = (midClientY - svgRect.top) / svgRect.height;

        let newX = this.pinchStart.svgMid.x - fracX * newW;
        let newY = this.pinchStart.svgMid.y - fracY * newH;
        // Nao deixa afastar o mapa inteiro pra fora da vista.
        newX = clamp(newX, this.baseViewBox.x - newW * 0.4, this.baseViewBox.x + maxW - newW * 0.6);
        newY = clamp(newY, this.baseViewBox.y - newH * 0.4, this.baseViewBox.y + maxH - newH * 0.6);

        this.setViewBox(this.currentSvg, { x: newX, y: newY, w: newW, h: newH });

        if (!this.manualZoomActive) {
          this.manualZoomActive = true;
          this.isZoomed = true;
          this.currentSvg.classList.add('svg--zoomed');
          this.opts.onManualZoomChange(true);
        }
      },
      { passive: false }
    );

    const onPointerEnd = (evt: PointerEvent) => {
      if (evt.pointerType !== 'touch') return;
      this.pinchPointers.delete(evt.pointerId);
      if (this.pinchPointers.size < 2 && this.pinchStart) this.finishPinch();
    };
    svgEl.addEventListener('pointerup', onPointerEnd);
    svgEl.addEventListener('pointercancel', onPointerEnd);
    svgEl.addEventListener('pointerleave', onPointerEnd);
  }

  // ── Sorteio ponderado por população ──

  private weightedPick(list: AvailableCity[], rng: () => number): AvailableCity {
    const totalWeight = list.reduce((sum, city) => sum + city.population, 0);
    let r = rng() * totalWeight;
    let selected = list[list.length - 1];
    for (const city of list) {
      r -= city.population;
      if (r <= 0) {
        selected = city;
        break;
      }
    }
    return selected;
  }

  private toPicked(selected: AvailableCity): PickedCity {
    const { key, path, population, city, state } = selected;
    const idx = this.availableCities.findIndex((c) => c.key === key);
    if (idx !== -1) this.availableCities.splice(idx, 1);

    path.classList.add('region--selected');
    const chance = formatChance(population);
    const curiosity = curiosityFor(this.curiosities, city, state);
    this.opts.setStatus(
      `Nasceu em ${city} (${state}) — ${formatPop(population)} hab. — chance ${chance}%`
    );
    return { key, city, state, population, chance, curiosity };
  }

  // Sorteio normal: só municípios ainda não capturados
  pickBirth(): PickedCity | null {
    if (!this.availableCities.length) {
      this.opts.setStatus('Nenhum municipio restante para nascer.');
      return null;
    }
    return this.toPicked(this.weightedPick(this.availableCities, Math.random));
  }

  // Desafio diário: sorteia sobre TODOS os municípios com o RNG semeado,
  // para que todo jogador receba a mesma cidade no mesmo dia.
  pickDaily(rng: () => number): PickedCity | null {
    if (!this.allCities.length) return null;
    return this.toPicked(this.weightedPick(this.allCities, rng));
  }

  // ── Coleção persistida ──

  totalCities(): number {
    return this.allCities.length;
  }

  // Pinta as cidades já capturadas e as remove do pool de sorteio
  restoreCaptured(keys: Set<string>): void {
    if (!keys.size) return;
    this.allCities.forEach(({ key, path }) => {
      if (keys.has(key)) path.classList.add('region--selected');
    });
    this.availableCities = this.availableCities.filter((c) => !keys.has(c.key));
  }

  // ── Heatmap de população ──

  setHeatmap(enabled: boolean): void {
    if (!this.currentSvg) return;
    if (enabled && !this.heatmapApplied) {
      this.allCities.forEach(({ path, population }) => {
        path.dataset.heat = String(heatBucket(population));
      });
      this.heatmapApplied = true;
    }
    this.currentSvg.classList.toggle('svg--heatmap', enabled);
  }

  // ── Estatísticas por estado ──

  getStateStats(): StateStats[] {
    return [...this.stateStats.values()].sort((a, b) => a.uf.localeCompare(b.uf));
  }

  getCityInfo(key: string): { city: string; state: string } | null {
    const hit = this.allCities.find((c) => c.key === key);
    return hit ? { city: hit.city, state: hit.state } : null;
  }

  focusStateByKey(uf: string): void {
    this.focusState(uf);
  }

  // ── Carga do mapa e dos dados ──

  private fallbackViewBox(svg: SVGSVGElement): string {
    const w = parseFloat(svg.getAttribute('width') || '') || 1000;
    const h = parseFloat(svg.getAttribute('height') || '') || 912;
    return `0 0 ${w} ${h}`;
  }

  private async loadMap(): Promise<void> {
    const { container, setStatus } = this.opts;
    try {
      // As três cargas são independentes entre si — dispara todas de uma vez
      // em vez de esperar uma para começar a próxima (antes era sequencial:
      // mapa -> municipios -> curiosidades).
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
      container.innerHTML = svgText;
      const svg = container.querySelector('svg');
      if (!svg) throw new Error('SVG nao encontrado');
      this.currentSvg = svg;

      const viewBoxAttr = svg.getAttribute('viewBox') || svg.getAttribute('viewbox');
      const originalViewBox = viewBoxAttr || this.fallbackViewBox(svg);
      svg.setAttribute('viewBox', originalViewBox);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.baseViewBox = this.parseViewBox(originalViewBox);

      svg.addEventListener('click', (evt) => {
        if (this.isZoomed && evt.target === svg) this.resetZoom();
      });

      const styleEl = document.createElementNS(SVG_NS, 'style');
      styleEl.textContent = `
        .region { fill: #1b5438; cursor: pointer; transition: fill 160ms ease, filter 160ms ease; stroke: transparent; }
        .region.region--hover { fill: #2b7350; filter: brightness(1.15); }
        .region.region--selected { fill: #ef4444 !important; stroke: #991b1b; stroke-width: 0.85; animation: selectedGlow 1.8s ease-in-out infinite; }
        .region.region--state-hover { fill: #235f40; }
        .region.region--state-hover.region--hover { fill: #2b7350; }
        .svg--zoomed .region { stroke: transparent; }
        .svg--zoomed .region--active-state { stroke: rgba(0,210,255,0.22); stroke-width: 0.6; }
        ${HEAT_BUCKETS.map((b, i) => `.svg--heatmap .region[data-heat="${i}"] { fill: ${b.color}; }`).join('\n        ')}
        .svg--heatmap .region.region--state-hover { filter: brightness(1.3); }
        .svg--heatmap .region.region--hover { filter: brightness(1.5); }
        .state-label { fill: rgba(190,240,210,0.9); font: 700 13px "Segoe UI", Arial, sans-serif; paint-order: stroke; stroke: rgba(0,0,0,0.55); stroke-width: 1.4; text-anchor: middle; dominant-baseline: middle; pointer-events: none; opacity: 0.85; }
        .svg--zoomed .state-label { opacity: 0; transition: opacity 200ms ease; }
        @keyframes selectedGlow {
          0%,100% { filter: drop-shadow(0 0 6px rgba(239,68,68,0.7)); }
          50%      { filter: drop-shadow(0 0 18px rgba(239,68,68,1)); }
        }
      `;
      svg.appendChild(styleEl);

      const [municipios, curiosities] = await Promise.all([municipiosPromise, curiositiesPromise]);
      if (this.destroyed) return;
      this.populationIndex = buildPopulationIndex(municipios);
      this.curiosities = curiosities;
      if (this.destroyed) return;

      const regions = svg.querySelectorAll<SVGPathElement>('path[data-name]');
      let matched = 0;
      let processed = 0;
      this.missing = [];
      this.availableCities = [];

      regions.forEach((path) => {
        const rawName = path.getAttribute('data-name') || '';
        const [cidadeRaw = '', ufRaw = ''] = rawName.split(',').map((s) => s.trim());
        const cidade = cleanCity(cidadeRaw);
        const uf = ufRaw.toUpperCase();
        const estadoNome = ufToName[uf] || ufRaw;
        const aliasCity =
          cityAliases.get(keyFor(cidade, uf)) || cityAliases.get(keyFor(cidade, estadoNome));
        const lookupCities = [cidade, aliasCity].filter((c): c is string => Boolean(c));
        const stateKey = uf || estadoNome || '';
        if (stateKey) path.dataset.state = stateKey;
        path.dataset.rawname = rawName;
        this.registerStatePath(stateKey, path);

        const candidates: string[] = [];
        lookupCities.forEach((cityName) => {
          candidates.push(keyFor(cityName, uf));
          candidates.push(keyFor(cityName, estadoNome));
          candidates.push(keyFor(cityName, ufToName[uf] || ''));
        });

        let populacao: number | null = null;
        for (const candidate of candidates) {
          const found = this.populationIndex?.get(candidate);
          if (found !== undefined) {
            populacao = found;
            break;
          }
        }

        path.classList.add('region');
        if (!cidade) return;

        processed += 1;
        const uniqueKey = keyFor(cidade, stateKey);
        path.dataset.city = cidade;
        path.dataset.key = uniqueKey;
        if (populacao) {
          matched += 1;
          const title = `${cidade}${uf ? ` (${uf})` : ''} - ${formatPop(populacao)} habitantes`;
          path.dataset.population = String(populacao);
          path.setAttribute('title', title);
          this.availableCities.push({
            key: uniqueKey,
            path,
            population: Number(populacao),
            city: cidade,
            state: stateKey,
            title,
          });
        } else {
          this.missing.push(rawName || '(sem nome)');
        }
      });

      this.allCities = [...this.availableCities];
      this.stateStats.clear();
      this.allCities.forEach(({ state, population }) => {
        const stats = this.stateStats.get(state) || { uf: state, municipios: 0, population: 0 };
        stats.municipios += 1;
        stats.population += population;
        this.stateStats.set(state, stats);
      });

      this.renderStateLabels(svg);
      this.setupDelegatedEvents(svg);
      this.setupPinchZoom(svg);

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
      throw err;
    }
  }
}
