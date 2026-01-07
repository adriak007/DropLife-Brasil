document.addEventListener('DOMContentLoaded', () => {
      const statusEl = document.getElementById('status');
      const birthBtn = document.getElementById('birthBtn');
      const container = document.getElementById('mapContainer');
      const modal = document.getElementById('modal');
      const modalTitle = document.getElementById('modalTitle');
      const modalMessage = document.getElementById('modalMessage');
      const modalCity = document.getElementById('modalCity');
      const modalCityMeta = document.getElementById('modalCityMeta');
      const modalCityCuriosity = document.getElementById('modalCityCuriosity');
      const modalClose = document.getElementById('modalClose');
      const zoomReset = document.getElementById('zoomReset');
      const tooltip = document.getElementById('cityTooltip');
      const tooltipTitle = document.getElementById('tooltipTitle');
      const tooltipSubtitle = document.getElementById('tooltipSubtitle');
      const tooltipInfo = document.getElementById('tooltipInfo');
      const tooltipClose = document.getElementById('tooltipClose');
      const mapUrl = 'MAPAESTADOS.svg';
      const municipiosUrl = 'municipios.json';
      const curiositySources = [
        'Curiosidades/AC_curiosidades.json',
        'Curiosidades/AL_curiosidades.json',
        'Curiosidades/AM_curiosidades.json',
        'Curiosidades/AP_curiosidades.json',
        'Curiosidades/BA_curiosidades.json',
        'Curiosidades/CE_curiosidades.json',
        'Curiosidades/DF_curiosidades.json',
        'Curiosidades/ES_curiosidades.json',
        'Curiosidades/GO_curiosidades.json',
        'Curiosidades/MA_curiosidades.json',
        'Curiosidades/MG_curiosidades.json',
        'Curiosidades/MS_curiosidades.json',
        'Curiosidades/MT_curiosidades.json',
        'Curiosidades/PA_curiosidades.json',
        'Curiosidades/PB_curiosidades.json',
        'Curiosidades/PE_curiosidades.json',
        'Curiosidades/PI_curiosidades.json',
        'Curiosidades/PR_curiosidades.json',
        'Curiosidades/RJ_curiosidades.json',
        'Curiosidades/RN_curiosidades.json',
        'Curiosidades/RO_curiosidades.json',
        'Curiosidades/RR_curiosidades.json',
        'Curiosidades/RS_curiosidades.json',
        'Curiosidades/SC_curiosidades.json',
        'Curiosidades/SE_curiosidades.json',
        'Curiosidades/SP_curiosidades.json',
        'Curiosidades/TO_curiosidades.json',
      ];
      const BRAZIL_TOTAL_POP = 205_000_000;
      const stateGroups = new Map();
      let currentSvg = null;
      let baseViewBox = null;
      let isZoomed = false;
      let zoomedState = null;
      let hoverState = null;
      let viewBoxAnimation = null;
      let availableCities = [];
      let populationIndex = null;
      let missing = [];
      const curiosities = new Map();
      const tooltipState = {
        isPinned: false,
        pinnedKey: null,
        pinnedTarget: null,
        pinnedData: null,
        lastHoverKey: null,
      };
      const setStatus = (message) => {
        if (!statusEl) return;
        statusEl.textContent = message;
      };

      const openModal = (message, title = 'Aviso') => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalMessage.classList.remove('hidden');
        modalCity.classList.add('hidden');
        modal.classList.add('modal-backdrop--open');
      };

      const openCityModal = ({ city, state, population, curiosity }) => {
        const popText = population ? `${formatPop(population)} habitantes` : 'Populacao indisponivel';
        modalTitle.textContent = 'Detalhes do municipio';
        modalMessage.textContent = '';
        modalMessage.classList.add('hidden');
        modalCity.classList.remove('hidden');
        modalCityMeta.textContent = `${city || 'Municipio'}${state ? ` (${state})` : ''} • ${popText}`;
        modalCityCuriosity.textContent = curiosity || 'Curiosidade nao disponivel.';
        modal.classList.add('modal-backdrop--open');
      };

      const closeModal = () => {
        modal.classList.remove('modal-backdrop--open');
      };

      modal.addEventListener('click', (evt) => {
        evt.stopPropagation();
        if (!evt.target.closest('.modal-panel')) closeModal();
      });
      modalClose.addEventListener('click', closeModal);
      zoomReset.addEventListener('click', () => resetZoom());
      tooltipInfo.addEventListener('click', (evt) => {
        evt.stopPropagation();
        if (!tooltipState.isPinned || !tooltipState.pinnedData) return;
        const { city, state, population } = tooltipState.pinnedData;
        const curiosity = curiosityFor(city, state);
        clearPinnedTooltip();
        openCityModal({ city, state, population, curiosity });
      });
      tooltipClose.addEventListener('click', (evt) => {
        evt.stopPropagation();
        clearPinnedTooltip();
      });
      tooltip.addEventListener('click', (evt) => {
        if (tooltipState.isPinned) evt.stopPropagation();
      });
      document.addEventListener('pointerdown', (evt) => {
        if (!tooltipState.isPinned) return;
        if (tooltip.contains(evt.target)) return;
        if (tooltipState.pinnedTarget && tooltipState.pinnedTarget.contains(evt.target)) return;
        clearPinnedTooltip();
      }, true);
      window.addEventListener('resize', () => positionPinnedTooltip());
      window.addEventListener('scroll', () => positionPinnedTooltip(), true);

      const ufToName = {
        AC: 'Acre', AL: 'Alagoas', AP: 'Amapa', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceara',
        DF: 'Distrito Federal', ES: 'Espirito Santo', GO: 'Goias', MA: 'Maranhao',
        MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Para',
        PB: 'Paraiba', PR: 'Parana', PE: 'Pernambuco', PI: 'Piaui', RJ: 'Rio de Janeiro',
        RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondonia', RR: 'Roraima',
        SC: 'Santa Catarina', SP: 'Sao Paulo', SE: 'Sergipe', TO: 'Tocantins',
      };

      const normalize = (value = '') =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/gi, '')
          .toLowerCase();

      const repairText = (str = '') => {
        if (!str) return '';
        let out = str;
        const hasBrokenMarks = /[\u00c3\u00c2\u00ca\u00d4\u00d5\u00c4\u00cb\u00cf\u00d6\u00dc]/.test(out) || /\uFFFD/.test(out);
        if (hasBrokenMarks) {
          try {
            const bytes = Uint8Array.from([...out].map((ch) => ch.charCodeAt(0) & 0xff));
            const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            if (decoded) out = decoded;
          } catch {}
          try {
            const decoded = decodeURIComponent(escape(out));
            if (decoded) out = decoded;
          } catch {}
        }
        out = out.replace(/\uFFFD0/g, '\u00c9');
        out = out.replace(/\uFFFD/g, '').replace(/\s{2,}/g, ' ').trim();
        if (/^0\s/.test(out)) out = out.replace(/^0\s+/, '\u00c9 ');
        return out;
      };

      const keyFor = (city, state) => `${normalize(city)}-${normalize(state)}`;

      const cityAliases = new Map([
        ['saoluiz-rr', 'Sao Luis'],
        ['santaisabeldopara-pa', 'Santa Izabel do Para'],
        ['coutomagalhaes-to', 'Couto de Magalhaes'],
        ['itapage-ce', 'Itapaje'],
        ['acu-rn', 'Assu'],
        ['ares-rn', 'Arez'],
        ['augustosevero-rn', 'Campo Grande'],
        ['januariocicco-rn', 'Boa Saude'],
        ['presidentejuscelino-rn', 'Serra Caiada'],
        ['santarem-pb', 'Joca Claudino'],
        ['serido-pb', 'Sao Vicente do Serido'],
        ['campodesantana-pb', 'Tacima'],
        ['belemdesaofrancisco-pe', 'Belem do Sao Francisco'],
        ['iguaraci-pe', 'Iguaracy'],
        ['lagoadoitaenga-pe', 'Lagoa de Itaenga'],
        ['saocaitano-pe', 'Sao Caetano'],
        ['fernandodenoronha-pe', 'Fernando de Noronha'],
        ['lajedodotabocal-ba', 'Lagedo do Tabocal'],
        ['muquemdesaofrancisco-ba', 'Muquem do Sao Francisco'],
        ['amparodesaofrancisco-se', 'Amparo do Sao Francisco'],
        ['grachocardoso-se', 'Graccho Cardoso'],
        ['santaluziadoitanhy-se', 'Santa Luzia do Itanhi'],
        ['amparodoserra-mg', 'Amparo da Serra'],
        ['brasopolis-mg', 'Brazopolis'],
        ['donausebia-mg', 'Dona Euzebia'],
        ['donaeusbia-mg', 'Dona Euzebia'],
        ['donaeusebia-mg', 'Dona Euzebia'],
        ['majorisidoro-al', 'Major Izidoro'],
        ['saothomedasletras-mg', 'Sao Tome das Letras'],
        ['embu-sp', 'Embu das Artes'],
        ['florinia-sp', 'Florinea'],
        ['luisantonio-sp', 'Luiz Antonio'],
        ['mojimirim-sp', 'Mogi Mirim'],
        ['saoluisdoparaitinga-sp', 'Sao Luiz do Paraitinga'],
        ['munhozdemelo-pr', 'Munhoz de Mello'],
        ['poxoreo-mt', 'Poxoreu'],
        ['santoantoniodoleverger-mt', 'Santo Antonio de Leverger'],
        ['senadorjoseporfirio-pa', 'Senador Jose Porfirio'],
      ]);

      const parseViewBox = (str = '') => {
        const [x = 0, y = 0, w = 1000, h = 1000] = String(str)
          .split(/\s+/)
          .map((n) => Number(n));
        return { x, y, w, h };
      };

      const setViewBox = (svgEl, vb) => {
        svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      };

      const animateViewBox = (svgEl, target, duration = 420) => {
        if (viewBoxAnimation) cancelAnimationFrame(viewBoxAnimation);
        const startBox = parseViewBox(svgEl.getAttribute('viewBox'));
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const ease = t * t * (3 - 2 * t);
          const mix = (a, b) => a + (b - a) * ease;
          const next = {
            x: mix(startBox.x, target.x),
            y: mix(startBox.y, target.y),
            w: mix(startBox.w, target.w),
            h: mix(startBox.h, target.h),
          };
          setViewBox(svgEl, next);
          if (t < 1) {
            viewBoxAnimation = requestAnimationFrame(step);
          }
        };
        viewBoxAnimation = requestAnimationFrame(step);
      };

      const expandBBox = (bbox, paddingFactor = 0.15, bounds) => {
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
      };

      const registerStatePath = (state, path) => {
        if (!state) return;
        const bbox = path.getBBox();
        const entry = stateGroups.get(state) || { paths: [], bbox: null };
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
        stateGroups.set(state, entry);
      };

      const clearStateHover = () => {
        if (!hoverState) return;
        const entry = stateGroups.get(hoverState);
        if (entry) entry.paths.forEach((p) => p.classList.remove('region--state-hover'));
        hoverState = null;
      };

      const clearActiveState = () => {
        stateGroups.forEach(({ paths }) =>
          paths.forEach((p) => p.classList.remove('region--active-state'))
        );
      };

      const setStateHover = (state) => {
        if (!state) return;
        if (isZoomed) return;
        if (hoverState === state) return;
        clearStateHover();
        const entry = stateGroups.get(state);
        if (!entry) return;
        entry.paths.forEach((p) => p.classList.add('region--state-hover'));
        hoverState = state;
      };

      const resetZoom = () => {
        if (!isZoomed || !baseViewBox || !currentSvg) return;
        if (viewBoxAnimation) cancelAnimationFrame(viewBoxAnimation);
        animateViewBox(currentSvg, baseViewBox);
        isZoomed = false;
        zoomedState = null;
        clearStateHover();
        stateGroups.forEach(({ paths }) =>
          paths.forEach((p) => p.classList.remove('region--state-hover'))
        );
        clearActiveState();
        currentSvg.querySelectorAll('.region--hover').forEach((p) => p.classList.remove('region--hover'));
        currentSvg.classList.remove('svg--zoomed');
        zoomReset.classList.remove('zoom-reset--visible');
        clearPinnedTooltip();
      };

      document.addEventListener('click', (evt) => {
        if (!isZoomed) return;
        const region = evt.target.closest('.region');
        if (!region || region.dataset.state !== zoomedState) resetZoom();
      });

      const cleanCity = (city) => city.replace(/\s+\d+$/, '').trim();

      const buildPopulationIndex = (municipios) => {
        const index = new Map();
        municipios.forEach(({ municipio, estado, populacao }) => {
          const baseKey = keyFor(municipio, estado);
          if (!index.has(baseKey)) index.set(baseKey, populacao);

          const uf = Object.entries(ufToName).find(
            ([, nome]) => normalize(nome) === normalize(estado)
          )?.[0];

          if (uf) {
            index.set(keyFor(municipio, uf), populacao);
            index.set(keyFor(municipio, ufToName[uf]), populacao);
          }
        });
        return index;
      };

      const formatPop = (num) => Number(num || 0).toLocaleString('pt-BR');
      const formatChance = (pop) =>
        ((Number(pop) || 0) / BRAZIL_TOTAL_POP * 100).toFixed(6).replace(/\.?0+$/, '');

      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

      const getPopulation = (state, city) => {
        if (!populationIndex || !city) return null;
        const directKey = keyFor(city, state || '');
        const lookup =
          populationIndex.get(directKey) ||
          populationIndex.get(keyFor(city, ufToName[state] || '')) ||
          populationIndex.get(keyFor(city, state || ''));
        return lookup || null;
      };

      const setTooltipContent = ({ city, state, population }) => {
        tooltipTitle.textContent = `${city || 'Municipio'}${state ? ` (${state})` : ''}`;
        tooltipSubtitle.textContent = population
          ? `${formatPop(population)} habitantes`
          : 'Populacao indisponivel';
      };

      const setTooltipPosition = (x, y) => {
        const rect = tooltip.getBoundingClientRect();
        const pad = 12;
        const maxX = window.innerWidth - rect.width - pad;
        const maxY = window.innerHeight - rect.height - pad;
        const clampedX = clamp(x, pad, Math.max(pad, maxX));
        const clampedY = clamp(y, pad, Math.max(pad, maxY));
        tooltip.style.left = `${clampedX}px`;
        tooltip.style.top = `${clampedY}px`;
      };

      const showTooltip = () => {
        tooltip.classList.remove('hidden');
        tooltip.setAttribute('aria-hidden', 'false');
      };

      const hideTooltip = () => {
        if (tooltipState.isPinned) return;
        tooltip.classList.add('hidden');
        tooltip.setAttribute('aria-hidden', 'true');
        tooltipState.lastHoverKey = null;
      };

      const showTooltipHover = (data, mouseX, mouseY) => {
        if (tooltipState.isPinned) {
          if (tooltipState.pinnedKey !== data.key) return;
          setTooltipContent(data);
          showTooltip();
          positionPinnedTooltip();
          return;
        }
        tooltip.classList.remove('city-tooltip--pinned');
        setTooltipContent(data);
        showTooltip();
        setTooltipPosition(mouseX + 14, mouseY + 14);
        tooltipState.lastHoverKey = data.key;
      };

      const positionPinnedTooltip = () => {
        if (!tooltipState.isPinned || !tooltipState.pinnedTarget) return;
        const targetRect = tooltipState.pinnedTarget.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        let y = targetRect.top - tooltipRect.height - 12;
        if (y < 12) y = targetRect.bottom + 12;
        setTooltipPosition(x, y);
      };

      const pinTooltip = (data, target) => {
        tooltipState.isPinned = true;
        tooltipState.pinnedKey = data.key;
        tooltipState.pinnedTarget = target;
        tooltipState.pinnedData = data;
        tooltip.classList.add('city-tooltip--pinned');
        setTooltipContent(data);
        showTooltip();
        positionPinnedTooltip();
      };

      const clearPinnedTooltip = () => {
        tooltipState.isPinned = false;
        tooltipState.pinnedKey = null;
        tooltipState.pinnedTarget = null;
        tooltipState.pinnedData = null;
        tooltip.classList.remove('city-tooltip--pinned');
        hideTooltip();
      };

      const editDistanceCap = (a, b, cap = 2) => {
        // DistÃ¢ncia de ediÃ§Ã£o simples com limite para performance
        const la = a.length;
        const lb = b.length;
        if (Math.abs(la - lb) > cap) return cap + 1;
        const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
        for (let i = 0; i <= la; i += 1) dp[i][0] = i;
        for (let j = 0; j <= lb; j += 1) dp[0][j] = j;
        for (let i = 1; i <= la; i += 1) {
          let rowMin = cap + 1;
          for (let j = 1; j <= lb; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost
            );
            rowMin = Math.min(rowMin, dp[i][j]);
          }
          if (rowMin > cap) return cap + 1;
        }
        return dp[la][lb];
      };

      const curiosityFor = (city, state) => {
        const stateName = ufToName[state] || state || 'Brasil';
        const key = keyFor(city, state);
        const altKey = keyFor(city, stateName);
        const stored = curiosities.get(key) || curiosities.get(altKey);
        if (stored) return stored;

        // Fallback aproximado para lidar com acentuaÃ§Ã£o corrompida em alguns JSONs
        const target = normalize(city);
        const stateVariants = new Set([
          normalize(state || ''),
          normalize(stateName || ''),
        ]);
        let best = null;
        let bestScore = 3;
        curiosities.forEach((value, k) => {
          const suffix = k.split('-').pop();
          if (!suffix || !stateVariants.has(suffix)) return;
          const cityKey = k.replace(/-[^-]+$/, '');
          const score = editDistanceCap(target, cityKey, 2);
          if (score < bestScore) {
            bestScore = score;
            best = value;
          }
        });
        if (best) return best;

        return 'Curiosidade nao disponivel.';
      };

      const parseCuriosityText = (text) => {
        // Corrige colagens "][", "[{...}][{...}]" e "},[" que surgem em alguns arquivos.
        let cleaned = text
          .replace(/\r\n/g, '\n')
          .replace(/\u0000/g, '')
          .replace(/^\uFEFF/, '')
          // Muitos arquivos trazem quebras de linha dentro das strings; trocar por espaÃ‡os.
          .replace(/\n+/g, ' ')
          .trim();
        cleaned = cleaned.replace(/\}\s*,?\s*\[\s*\{/g, '},{');
        cleaned = cleaned.replace(/\]\s*\[\s*/g, ',');
        cleaned = cleaned.replace(/\]\s*\]+$/g, ']');
        cleaned = cleaned.replace(/,\s*\]/g, ']');
        if (!cleaned.startsWith('[')) cleaned = `[${cleaned}`;
        if (!cleaned.endsWith(']')) cleaned = `${cleaned}]`;
        try {
          return JSON.parse(cleaned);
        } catch (err) {
          console.warn('Falha ao fazer parse de curiosidade (tentando fallback)', err);
          try {
            const lastBracket = cleaned.lastIndexOf(']');
            if (lastBracket > 0) return JSON.parse(cleaned.slice(0, lastBracket + 1));
          } catch (err2) {
            console.warn('Fallback tambem falhou', err2);
          }
          return [];
        }
      };

      const fallbackExtractCuriosities = (text) => {
        const results = [];
        const regex =
          /"municipio"\s*:\s*"([^"]*?)"\s*,\s*"estado"\s*:\s*"([^"]*?)"\s*,\s*"curiosidade"\s*:\s*"([^"]*?)"/gi;
        let match;
        while ((match = regex.exec(text))) {
          results.push({
            municipio: match[1],
            estado: match[2],
            curiosidade: match[3],
          });
        }
        return results;
      };

      const loadCuriosities = async () => {
        curiosities.clear();
        const loaders = curiositySources.map(async (path) => {
          try {
            const res = await fetch(path);
            if (!res.ok) {
              console.warn('Curiosidade nao carregada de', path);
              return;
            }
            const buffer = await res.arrayBuffer();
            const decode = (enc) => new TextDecoder(enc, { fatal: false }).decode(buffer);
            let text = '';
            let data = [];
            try {
              text = decode('utf-8');
              data = parseCuriosityText(text);
            } catch {
              data = [];
            }
            if (!data.length) {
              try {
                text = decode('iso-8859-1');
                data = parseCuriosityText(text);
              } catch {
                data = [];
              }
            }
            if (!Array.isArray(data)) data = [];
            if (!data.length) data = fallbackExtractCuriosities(text);
            let added = 0;
            data.forEach((item) => {
              const city = repairText((item.municipio || item.city || item.nome || '').trim());
              const state = repairText((item.estado || item.uf || item.state || '').trim());
              const textCur = repairText(item.curiosidade || item.texto || item.text);
              if (city && state && textCur) {
                curiosities.set(keyFor(city, state), String(textCur));
                added += 1;
              }
            });
            if (!added) console.warn('Nenhuma curiosidade adicionada de', path);
          } catch (err) {
            console.warn('Erro ao carregar curiosidade de', path, err);
          }
        });
        await Promise.all(loaders);
      };

      const fallbackViewBox = (svg) => {
        const w = parseFloat(svg.getAttribute('width')) || 1000;
        const h = parseFloat(svg.getAttribute('height')) || 912;
        return `0 0 ${w} ${h}`;
      };

      const stateLabelText = (stateKey = '') => {
        if (!stateKey) return '';
        if (/^[A-Z]{2}$/.test(stateKey)) return stateKey;
        return stateKey
          .split(/\s+/)
          .map((p) => p[0] || '')
          .join('')
          .slice(0, 3)
          .toUpperCase();
      };

      const stateLabelOffsets = {
        PE: { x: -8, y: 32 },
        SC: { x: 10, y: -5 },
      };

      const renderStateLabels = (svgEl) => {
        const existing = svgEl.querySelector('.state-labels');
        if (existing) existing.remove();
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('state-labels');
        stateGroups.forEach((entry, stateKey) => {
          if (!entry?.bbox) return;
          const offset = stateLabelOffsets[stateKey] || { x: 0, y: 0 };
          const cx = (entry.bbox.minX + entry.bbox.maxX) / 2 + offset.x;
          const cy = (entry.bbox.minY + entry.bbox.maxY) / 2 + offset.y;
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.classList.add('state-label');
          text.setAttribute('x', cx);
          text.setAttribute('y', cy);
          text.textContent = stateLabelText(stateKey);
          g.appendChild(text);
        });
        svgEl.appendChild(g);
      };

      const setupDelegatedEvents = (svgEl, focusStateFn) => {
        svgEl.addEventListener('pointerover', (evt) => {
          const region = evt.target.closest('.region');
          if (!region || !svgEl.contains(region)) return;
          if (isZoomed) {
            region.classList.add('region--hover');
            return;
          }
          setStateHover(region.dataset.state);
        });

        svgEl.addEventListener('pointerout', (evt) => {
          if (isZoomed) {
            const leaving = evt.target.closest('.region');
            if (leaving) leaving.classList.remove('region--hover');
            if (!tooltipState.isPinned) hideTooltip();
            return;
          }
          if (!evt.relatedTarget || !svgEl.contains(evt.relatedTarget)) {
            clearStateHover();
            return;
          }
          const leaving = evt.target.closest('.region');
          const entering = evt.relatedTarget.closest('.region');
          if (leaving && entering && leaving.dataset.state === entering.dataset.state) return;
          setStateHover(entering?.dataset.state || null);
        });

        svgEl.addEventListener('pointermove', (evt) => {
          const region = evt.target.closest('.region');
          if (!region || !svgEl.contains(region)) {
            hideTooltip();
            return;
          }
          if (!isZoomed || region.dataset.state !== zoomedState) {
            hideTooltip();
            return;
          }
          const city = region.dataset.city;
          if (!city) {
            hideTooltip();
            return;
          }
          const population =
            Number(region.dataset.population) || getPopulation(region.dataset.state, city);
          const data = {
            city,
            state: region.dataset.state,
            population,
            key: region.dataset.key || keyFor(city, region.dataset.state),
          };
          showTooltipHover(data, evt.clientX, evt.clientY);
        });

        svgEl.addEventListener('click', (evt) => {
          const region = evt.target.closest('.region');
          if (isZoomed && (!region || region.dataset.state !== zoomedState)) {
            resetZoom();
            return;
          }
          if (!region) return;
          evt.stopPropagation();
          const city = region.dataset.city;
          const stateKey = region.dataset.state;
          const pop = Number(region.dataset.population) || getPopulation(stateKey, city);
          const rawName = region.dataset.rawname;
          if (isZoomed && city && region.dataset.state === zoomedState) {
            const data = {
              city,
              state: stateKey,
              population: pop,
              key: region.dataset.key || keyFor(city, stateKey),
            };
            pinTooltip(data, region);
          }
          if (city && pop) {
            const title = `${city}${stateKey ? ` (${stateKey})` : ''} - ${formatPop(pop)} habitantes`;
            setStatus(title);
          } else {
            setStatus(`Sem populacao encontrada para ${rawName || 'municipio'}.`);
          }
          if (!isZoomed) focusStateFn?.(stateKey);
        });
      };

      const loadMap = async () => {
        try {
          const loadSvgText = async () => {
            try {
              const res = await fetch(mapUrl);
              if (!res.ok) throw new Error('Resposta HTTP nao OK');
              return await res.text();
            } catch {
              return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', mapUrl, true);
                xhr.overrideMimeType('image/svg+xml');
                xhr.onload = () => {
                  if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                    resolve(xhr.responseText);
                  } else {
                    reject(new Error(`XHR status ${xhr.status}`));
                  }
                };
                xhr.onerror = () => reject(new Error('XHR error'));
                xhr.send();
              });
            }
          };

          const svgText = await loadSvgText();
          const municipiosPromise = fetch(municipiosUrl);

          container.innerHTML = svgText;
          const svg = container.querySelector('svg');
          if (!svg) throw new Error('SVG nao encontrado');
          currentSvg = svg;

          const viewBoxAttr = svg.getAttribute('viewBox') || svg.getAttribute('viewbox');
          const originalViewBox = viewBoxAttr || fallbackViewBox(svg);
          svg.setAttribute('viewBox', originalViewBox);
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          baseViewBox = parseViewBox(originalViewBox);

          svg.addEventListener('click', (evt) => {
            if (isZoomed && evt.target === svg) resetZoom();
          });

          const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          styleEl.textContent = `
            .region { fill: #6f9c76; cursor: pointer; transition: fill 160ms ease, opacity 160ms ease; stroke: transparent; }
            .region.region--hover { fill: #4f6e56; }
            .region.region--selected { fill: #ef4444 !important; stroke: #991b1b; stroke-width: 0.85; }
            .region.region--state-hover { fill: #5f8a63; }
            .region.region--state-hover.region--hover { fill: #4f6e56; }
            .svg--zoomed .region { stroke: transparent; }
            .svg--zoomed .region--active-state { stroke: rgba(15,23,42,0.45); stroke-width: 0.55; }
            .state-label { fill: #0b1224; font: 700 13px "Segoe UI", Arial, sans-serif; paint-order: stroke; stroke: rgba(255,255,255,0.8); stroke-width: 0.8; text-anchor: middle; dominant-baseline: middle; pointer-events: none; opacity: 0.92; }
            .svg--zoomed .state-label { opacity: 0; }
          `;
          svg.appendChild(styleEl);

          const resMunicipios = await municipiosPromise;
          if (!resMunicipios.ok) throw new Error('Nao foi possivel carregar municipios.json');
          const municipios = await resMunicipios.json();
          populationIndex = buildPopulationIndex(municipios);
          await loadCuriosities();
          const regions = svg.querySelectorAll('path[data-name]');
          let matched = 0;
          let processed = 0;
          missing = [];
          availableCities = [];

          const focusState = (state) => {
            if (!state || !stateGroups.has(state) || !baseViewBox || !currentSvg) return;
            const entry = stateGroups.get(state);
            if (!entry || !entry.bbox) return;
            if (viewBoxAnimation) cancelAnimationFrame(viewBoxAnimation);
            const target = expandBBox(entry.bbox, 0.2, baseViewBox);
            animateViewBox(currentSvg, target);
            isZoomed = true;
            zoomedState = state;
            currentSvg.classList.add('svg--zoomed');
            zoomReset.classList.add('zoom-reset--visible');
            clearStateHover();
            clearActiveState();
            entry.paths.forEach((p) => p.classList.add('region--active-state'));
            entry.paths.forEach((p) => p.classList.add('region--state-hover'));
          };

          regions.forEach((path) => {
            const rawName = path.getAttribute('data-name') || '';
            const [cidadeRaw = '', ufRaw = ''] = rawName.split(',').map((s) => s.trim());
            const cidade = cleanCity(cidadeRaw);
            const uf = ufRaw.toUpperCase();
            const estadoNome = ufToName[uf] || ufRaw;
            const aliasCity =
              cityAliases.get(keyFor(cidade, uf)) || cityAliases.get(keyFor(cidade, estadoNome));
            const lookupCities = [cidade, aliasCity].filter(Boolean);
            const stateKey = uf || estadoNome || '';
            if (stateKey) path.dataset.state = stateKey;
            path.dataset.rawname = rawName;
            registerStatePath(stateKey, path);

            const candidates = [];
            lookupCities.forEach((cityName) => {
              candidates.push(keyFor(cityName, uf));
              candidates.push(keyFor(cityName, estadoNome));
              candidates.push(keyFor(cityName, ufToName[uf] || ''));
            });

            let populacao = null;
            for (const candidate of candidates) {
              if (populationIndex.has(candidate)) {
                populacao = populationIndex.get(candidate);
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
            path.dataset.population = populacao;
            path.setAttribute('title', title);

            availableCities.push({
              key: uniqueKey,
              path,
                population: Number(populacao),
                city: cidade,
                state: stateKey,
                title,
              });
            } else {
              missing.push(rawName || '(sem nome)');
            }
          });

          renderStateLabels(svg);
          setupDelegatedEvents(svg, focusState);

          const missingMsg = missing.length
            ? `; faltando ${missing.length}. Veja o console para exemplos.`
            : '.';
          setStatus(`Populacao vinculada para ${matched}/${processed} municipios${missingMsg}`);
          if (missing.length) {
            console.warn('Municipios sem correspondencia de populacao (amostra):', missing.slice(0, 30));
          }
          const pickRandomCity = () => {
            if (!availableCities.length) {
              setStatus('Nenhum municipio restante para nascer.');
              openModal('Nao ha municipios restantes para nascer.');
              return;
            }

            const totalWeight = availableCities.reduce((sum, city) => sum + city.population, 0);
            let r = Math.random() * totalWeight;
            let selected = availableCities[availableCities.length - 1];
            for (const city of availableCities) {
              r -= city.population;
              if (r <= 0) {
                selected = city;
                break;
              }
            }

            const { key, path, population, city, state } = selected;
            const idx = availableCities.findIndex((c) => c.key === key);
            if (idx !== -1) availableCities.splice(idx, 1);

            path.classList.add('region--selected');
            const chance = formatChance(population);
            const curiosityText = curiosityFor(city, state);
            const message = `Voce nasceu em ${city} (${state}). (${formatPop(population)} Habitantes) Chance: ${chance}%. Curiosidade: ${curiosityText}`;
            setStatus(message);
            openModal(message);
          };

          birthBtn.addEventListener('click', pickRandomCity);
        } catch (err) {
          setStatus('Nao foi possivel carregar o mapa ou as populacoes.');
          console.error(err);
        }
      };

      loadMap();
    });
