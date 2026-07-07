'use client';

import { useEffect, useRef, useState } from 'react';
import { MapController } from '@/lib/mapController';
import { formatPop } from '@/lib/text';
import type { CityModalData, ModalState, PickedCity, StateStats } from '@/lib/types';
import { loadSave, persistSave, emptySave, type BirthRecord, type SaveData } from '@/lib/storage';
import { newlyUnlocked } from '@/lib/achievements';
import { rarityFor } from '@/lib/rarity';
import { seededRng, todayKey } from '@/lib/daily';
import CitydexModal from '@/components/CitydexModal';
import AchievementsModal from '@/components/AchievementsModal';
import StatesModal from '@/components/StatesModal';
import StatePanel from '@/components/StatePanel';
import HeatLegend from '@/components/HeatLegend';
import RankingModal from '@/components/RankingModal';
import {
  getSessionProfile,
  joinRanking,
  recordBirth,
  type OnlineProfile,
} from '@/lib/online';

const LOGO_SRC = '/Img/LOGO 1.png';
const BIRTH_COOLDOWN_MS = 1500;

type PanelKind = 'citydex' | 'conquistas' | 'estados' | 'ranking' | null;

const spawnRipple = (evt: React.PointerEvent<HTMLButtonElement>) => {
  const btn = evt.currentTarget;
  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${evt.clientX - rect.left - size / 2}px;top:${evt.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
};

function NavButton({
  label,
  active,
  wide,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  wide?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`nav-btn ui-btn${active ? ' nav-btn--active' : ''}${wide ? ' nav-btn--wide' : ''}`}
      type="button"
      onPointerDown={spawnRipple}
      onClick={onClick}
    >
      <svg
        className="btn-icon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="btn-label">{label}</span>
    </button>
  );
}

export default function MapGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTitleRef = useRef<HTMLDivElement>(null);
  const tooltipSubtitleRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [zoomedState, setZoomedState] = useState<string | null>(null);
  const [save, setSave] = useState<SaveData>(emptySave);
  const [totalCities, setTotalCities] = useState(0);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [profile, setProfile] = useState<OnlineProfile | null>(null);
  const sonarRef = useRef<HTMLSpanElement>(null);

  // Recupera o perfil do ranking (conta anônima persistida no navegador)
  useEffect(() => {
    getSessionProfile().then((p) => {
      if (p) setProfile(p);
    });
  }, []);

  const saveRef = useRef(save);
  saveRef.current = save;

  // Varredura do sonar: preenche o "gráfico de pizza" de 0 a 360 graus
  // durante o cooldown do botão Nascer.
  useEffect(() => {
    if (!cooldown) return;
    const el = sonarRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / BIRTH_COOLDOWN_MS);
      el?.style.setProperty('--sweep', `${t * 360}deg`);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const timer = window.setTimeout(() => setCooldown(false), BIRTH_COOLDOWN_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  // fila de toasts (conquistas podem desbloquear várias de uma vez)
  const toastQueue = useRef<string[]>([]);
  const toastBusy = useRef(false);
  const pumpToast = () => {
    if (toastBusy.current) return;
    const next = toastQueue.current.shift();
    if (next === undefined) return;
    toastBusy.current = true;
    setToast(next);
    window.setTimeout(() => {
      setToast(null);
      window.setTimeout(() => {
        toastBusy.current = false;
        pumpToast();
      }, 300);
    }, 2600);
  };
  const showToast = (msg: string) => {
    toastQueue.current.push(msg);
    pumpToast();
  };

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    const tooltipTitle = tooltipTitleRef.current;
    const tooltipSubtitle = tooltipSubtitleRef.current;
    if (!container || !tooltip || !tooltipTitle || !tooltipSubtitle) return;

    const loaded = loadSave();
    setSave(loaded);

    const controller = new MapController({
      container,
      tooltip,
      tooltipTitle,
      tooltipSubtitle,
      setStatus,
      openMessageModal: (message, title = 'Aviso') =>
        setModal({ type: 'message', title, message }),
      openCityModal: (data) => setModal({ type: 'city', data }),
      onZoomChange: setZoomedState,
    });
    controllerRef.current = controller;

    let cancelled = false;
    controller
      .init()
      .then(() => {
        if (cancelled) return;
        controller.restoreCaptured(new Set(loaded.births.map((b) => b.key)));
        setTotalCities(controller.totalCities());
        setStateStats(controller.getStateStats());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const registerBirth = (picked: PickedCity, daily?: string) => {
    const prev = saveRef.current;
    const already = prev.births.some((b) => b.key === picked.key);
    const record: BirthRecord = {
      key: picked.key,
      city: picked.city,
      state: picked.state,
      population: picked.population,
      chance: picked.chance,
      bornAt: new Date().toISOString(),
      ...(daily ? { daily } : {}),
    };
    const births = already ? prev.births : [...prev.births, record];
    const next: SaveData = {
      ...prev,
      births,
      ...(daily ? { lastDaily: daily, dailyResult: record } : {}),
    };
    const unlocked = newlyUnlocked(births, next);
    if (unlocked.length) {
      const stamp = new Date().toISOString();
      next.achievements = {
        ...prev.achievements,
        ...Object.fromEntries(unlocked.map((a) => [a.id, stamp])),
      };
    }
    persistSave(next);
    setSave(next);
    unlocked.forEach((a) => showToast(`🏆 Conquista desbloqueada: ${a.emoji} ${a.name}`));

    // Ranking global: registra o nascimento (o servidor valida e conta)
    if (profile && !already) {
      recordBirth(picked.key).then((ok) => {
        if (ok) setProfile((p) => (p ? { ...p, total_births: p.total_births + 1 } : p));
      });
    }

    const data: CityModalData = {
      city: picked.city,
      state: picked.state,
      population: picked.population,
      curiosity: picked.curiosity,
      chance: picked.chance,
      key: picked.key,
      daily,
      isNewCapture: !already,
    };
    setModal({ type: 'city', data });
  };

  const handleBirth = () => {
    const controller = controllerRef.current;
    if (!controller || cooldown) return;
    setCooldown(true);
    const picked = controller.pickBirth();
    if (!picked) {
      setModal({
        type: 'message',
        title: 'Coleção completa!',
        message: 'Você já nasceu em todos os municípios do Brasil. Parabéns!',
      });
      return;
    }
    registerBirth(picked);
  };

  const handleDaily = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    const today = todayKey();
    const current = saveRef.current;
    if (current.lastDaily === today) {
      const result = current.dailyResult;
      if (result && result.daily === today) {
        setModal({
          type: 'city',
          data: {
            city: result.city,
            state: result.state,
            population: result.population,
            curiosity: '',
            chance: result.chance,
            key: result.key,
            daily: today,
          },
        });
      } else {
        showToast('Desafio de hoje já concluído. Volte amanhã! 📅');
      }
      return;
    }
    const picked = controller.pickDaily(seededRng(`droplife-${today}`));
    if (!picked) return;
    registerBirth(picked, today);
  };

  const handleShare = async (data: CityModalData) => {
    const [y, m, d] = (data.daily || todayKey()).split('-');
    const tier = rarityFor(data.population || 0);
    const text = [
      `🇧🇷 DropLife Brasil — Desafio Diário ${d}/${m}/${y}`,
      `👶 Nasci em ${data.city} (${data.state})`,
      `🎲 Chance: ${data.chance}% · ${tier.label}`,
      `🎮 www.droplife.life`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Resultado copiado! Cole onde quiser. 📋');
    } catch {
      showToast('Nao foi possivel copiar o resultado.');
    }
  };

  const locateState = (uf: string) => {
    setPanel(null);
    controllerRef.current?.focusStateByKey(uf);
  };

  const handleJoinRanking = async (nickname: string): Promise<string | null> => {
    const result = await joinRanking(nickname);
    if (result.ok) {
      const p = await getSessionProfile();
      setProfile(p);
      showToast(`🌍 Bem-vindo ao ranking, ${nickname.trim()}!`);
      return null;
    }
    if (result.error === 'apelido_em_uso') return 'Esse apelido já está em uso. Tente outro!';
    return 'Não foi possível entrar no ranking agora. Tente de novo.';
  };

  const toggleHeatmap = () => {
    const next = !heatmap;
    setHeatmap(next);
    controllerRef.current?.setHeatmap(next);
  };

  const modalTitle =
    modal?.type === 'message'
      ? modal.title
      : modal?.type === 'city' && modal.data.daily
        ? `Desafio Diário: ${modal.data.city}!`
        : modal?.type === 'city' && modal.data.chance
          ? `Voce nasceu em ${modal.data.city}!`
          : 'Detalhes do municipio';

  const cityData = modal?.type === 'city' ? modal.data : null;
  const cityTier = cityData ? rarityFor(cityData.population || 0) : null;
  const popText = cityData?.population
    ? `${formatPop(cityData.population)} habitantes`
    : 'Populacao indisponivel';

  const capturedInZoomed = zoomedState
    ? save.births.filter((b) => b.state === zoomedState).length
    : 0;

  const dailyDone = save.lastDaily === todayKey();

  return (
    <>
      {/* Loading screen */}
      <div className={`loading-screen${loading ? '' : ' hidden'}`}>
        <img className="loading-logo" src={LOGO_SRC} alt="DropLife" />
        <div className="loading-bar"></div>
        <span className="loading-text">Carregando Brasil&hellip;</span>
      </div>

      <div className="frame">
        <div className="game-logo">
          <img src={LOGO_SRC} alt="DropLife logo" />
        </div>

        <div className="controls bottom-bar" role="navigation" aria-label="Menu principal">
          <NavButton label="Populacao" active={heatmap} onClick={toggleHeatmap}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </NavButton>

          <NavButton label="Citydex" onClick={() => setPanel('citydex')}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </NavButton>

          <NavButton label="Ranking" onClick={() => setPanel('ranking')}>
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 6h3a1 1 0 0 1 1 1c0 2-2 3-4 3" />
            <path d="M7 6H4a1 1 0 0 0-1 1c0 2 2 3 4 3" />
          </NavButton>

          <button
            id="birthBtn"
            className={cooldown ? 'birth-cooldown' : ''}
            type="button"
            aria-disabled={cooldown}
            onPointerDown={(evt) => {
              if (!cooldown) spawnRipple(evt);
            }}
            onClick={handleBirth}
          >
            {cooldown && <span ref={sonarRef} className="sonar-sweep" aria-hidden="true"></span>}
            <span className="btn-label">Nascer</span>
          </button>

          <NavButton label="Estados" onClick={() => setPanel('estados')}>
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </NavButton>

          <NavButton label="Conquistas" onClick={() => setPanel('conquistas')}>
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </NavButton>

          <NavButton label={dailyDone ? 'Desafio ✓' : 'Desafio'} onClick={handleDaily}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </NavButton>
        </div>

        <div className="map-wrap" ref={containerRef}></div>
      </div>

      {/* Barra de status (oculta via CSS, mantida para leitores de tela) */}
      <p className="status-bar" role="status" aria-live="polite">
        {status}
      </p>

      {/* Painel do estado em zoom */}
      {zoomedState && (
        <StatePanel
          uf={zoomedState}
          stats={stateStats.find((s) => s.uf === zoomedState)}
          captured={capturedInZoomed}
        />
      )}

      {/* Legenda do heatmap */}
      {heatmap && <HeatLegend />}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="city-tooltip hidden"
        aria-live="polite"
        aria-hidden="true"
        onClick={(evt) => evt.stopPropagation()}
      >
        <div className="city-tooltip__header">
          <div className="city-tooltip__title" ref={tooltipTitleRef}></div>
          <div className="city-tooltip__actions">
            <button
              className="city-tooltip__btn city-tooltip__btn--info"
              type="button"
              aria-label="Detalhes do municipio"
              onClick={(evt) => {
                evt.stopPropagation();
                controllerRef.current?.openPinnedCityDetails();
              }}
            >
              i
            </button>
            <button
              className="city-tooltip__btn city-tooltip__btn--close"
              type="button"
              aria-label="Fechar"
              onClick={(evt) => {
                evt.stopPropagation();
                controllerRef.current?.clearPinnedTooltip();
              }}
            >
              &#x2715;
            </button>
          </div>
        </div>
        <div className="city-tooltip__subtitle" ref={tooltipSubtitleRef}></div>
      </div>

      <button
        className={`zoom-reset${zoomedState ? ' zoom-reset--visible' : ''}`}
        type="button"
        onClick={() => controllerRef.current?.resetZoom()}
      >
        Voltar
      </button>

      {/* Toast */}
      <div className={`toast${toast ? ' toast--visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>

      {/* Modal de nascimento / mensagem */}
      <div
        className={`modal-backdrop${modal ? ' modal-backdrop--open' : ''}`}
        onClick={(evt) => {
          evt.stopPropagation();
          if (!(evt.target as Element).closest('.modal-panel')) setModal(null);
        }}
      >
        <div className="modal-panel">
          <div className="modal-header">
            <h2>{modalTitle}</h2>
            <button className="modal-close" type="button" onClick={() => setModal(null)}>
              Fechar
            </button>
          </div>
          <div className="modal-body">
            <p className={`modal-message${modal?.type === 'message' ? '' : ' hidden'}`}>
              {modal?.type === 'message' ? modal.message : ''}
            </p>
            <div className={`modal-city${cityData ? '' : ' hidden'}`}>
              <p className="modal-city__meta">
                {cityData ? `${cityData.state} • ${popText}` : ''}
                {cityTier && cityData?.chance ? (
                  <span
                    className="rarity-badge"
                    style={{ borderColor: cityTier.color, color: cityTier.color }}
                  >
                    {cityTier.label}
                  </span>
                ) : null}
                {cityData?.isNewCapture ? <span className="new-capture">NOVA!</span> : null}
              </p>
              <p className={`modal-city__chance${cityData?.chance ? '' : ' hidden'}`}>
                {cityData?.chance ? `Probabilidade de nascer aqui: ${cityData.chance}%` : ''}
              </p>
              {cityData?.curiosity ? (
                <p className="modal-city__curiosity">{cityData.curiosity}</p>
              ) : null}
              {cityData?.daily ? (
                <button className="share-btn" type="button" onClick={() => handleShare(cityData)}>
                  📋 Compartilhar resultado
                </button>
              ) : (
                <p className="modal-city__placeholder">Mais dados em breve&hellip;</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painéis (Citydex / Conquistas / Estados) */}
      <div
        className={`modal-backdrop${panel ? ' modal-backdrop--open' : ''}`}
        onClick={(evt) => {
          evt.stopPropagation();
          if (!(evt.target as Element).closest('.modal-panel')) setPanel(null);
        }}
      >
        {panel === 'citydex' && (
          <CitydexModal
            save={save}
            total={totalCities}
            onClose={() => setPanel(null)}
            onLocate={locateState}
          />
        )}
        {panel === 'conquistas' && <AchievementsModal save={save} onClose={() => setPanel(null)} />}
        {panel === 'estados' && (
          <StatesModal
            save={save}
            stats={stateStats}
            onSelect={locateState}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'ranking' && (
          <RankingModal
            profile={profile}
            resolveCity={(key) => controllerRef.current?.getCityInfo(key) ?? null}
            onJoin={handleJoinRanking}
            onClose={() => setPanel(null)}
          />
        )}
      </div>
    </>
  );
}
