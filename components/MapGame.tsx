'use client';

import { useEffect, useRef, useState } from 'react';
import { MapController } from '@/lib/mapController';
import { formatPop } from '@/lib/text';
import type { CityModalData, ModalState, PanelKind, PickedCity, StateStats } from '@/lib/types';
import { loadSave, persistSave, emptySave, type BirthRecord, type SaveData } from '@/lib/storage';
import { ACHIEVEMENTS, newlyUnlocked, type AchievementContext } from '@/lib/achievements';
import { rarityFor } from '@/lib/rarity';
import { seededRng, todayKey } from '@/lib/daily';
import CitydexModal from '@/components/CitydexModal';
import AchievementsModal from '@/components/AchievementsModal';
import StatesModal from '@/components/StatesModal';
import StatePanel from '@/components/StatePanel';
import HeatLegend from '@/components/HeatLegend';
import RankingModal from '@/components/RankingModal';
import SettingsPanel from '@/components/SettingsPanel';
import HomeDashboard from '@/components/HomeDashboard';
import TopNav from '@/components/TopNav';
import MobileNav from '@/components/MobileNav';
import AdInterstitial from '@/components/AdInterstitial';
import { spawnRipple } from '@/components/NavButton';
import { bumpBirthCounterAndCheckAd } from '@/lib/ads';
import {
  getAuthState,
  onAuthChange,
  onlineEnabled,
  recordBirth,
  signOut,
  type AuthState,
} from '@/lib/online';

const LOGO_SRC = '/Img/LOGO 1.png';
const BIRTH_COOLDOWN_MS = 1500;

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
  const [manualZoomActive, setManualZoomActive] = useState(false);
  const [save, setSave] = useState<SaveData>(emptySave);
  const [totalCities, setTotalCities] = useState(0);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ signedIn: false, profile: null });
  const sonarRef = useRef<HTMLSpanElement>(null);

  // Totais reais (não hardcoded) usados pelas conquistas de estado/região/país
  const achievementCtx: AchievementContext = {
    totalCities,
    stateTotals: Object.fromEntries(stateStats.map((s) => [s.uf, s.municipios])),
  };

  const refreshAuth = async () => {
    setAuth(await getAuthState());
  };

  // Recupera a sessão do ranking e escuta mudanças de login
  useEffect(() => {
    refreshAuth();
    const unsubscribe = onAuthChange(() => {
      refreshAuth();
    });
    return unsubscribe;
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
      onManualZoomChange: setManualZoomActive,
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
    const unlocked = newlyUnlocked(births, next, achievementCtx);
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
    if (auth.profile && !already) {
      recordBirth(picked.key).then((ok) => {
        if (ok) {
          setAuth((a) =>
            a.profile
              ? { ...a, profile: { ...a.profile, total_births: a.profile.total_births + 1 } }
              : a
          );
        }
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

  const performBirth = () => {
    const controller = controllerRef.current;
    if (!controller) return;
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

  const handleBirth = () => {
    const controller = controllerRef.current;
    if (!controller || cooldown) return;
    setCooldown(true);
    // A cada N nascimentos, mostra o anuncio intersticial antes de sortear —
    // o sorteio em si so acontece quando o anuncio for fechado.
    if (bumpBirthCounterAndCheckAd()) {
      setShowAd(true);
      return;
    }
    performBirth();
  };

  const handleAdContinue = () => {
    setShowAd(false);
    performBirth();
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

  const handleAuthChanged = async () => {
    const before = auth.profile?.nickname;
    const next = await getAuthState();
    setAuth(next);
    if (!before && next.profile) {
      showToast(`🌍 Bem-vindo ao ranking, ${next.profile.nickname}!`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuth({ signedIn: false, profile: null });
    showToast('Você saiu da conta.');
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
  const achCount = Object.keys(save.achievements).length;

  return (
    <>
      {/* Loading screen */}
      <div className={`loading-screen${loading ? '' : ' hidden'}`}>
        <img className="loading-logo" src={LOGO_SRC} alt="DropLife" />
        <div className="loading-bar"></div>
        <span className="loading-text">Carregando Brasil&hellip;</span>
      </div>

      <TopNav
        auth={auth}
        onlineEnabled={onlineEnabled()}
        panel={panel}
        heatmap={heatmap}
        dailyDone={dailyDone}
        citydexCount={save.births.length}
        citydexTotal={totalCities}
        achCount={achCount}
        achTotal={ACHIEVEMENTS.length}
        onNavigate={setPanel}
        onToggleHeatmap={toggleHeatmap}
        onDaily={handleDaily}
        onSignOut={handleSignOut}
      />
      <MobileNav
        auth={auth}
        onlineEnabled={onlineEnabled()}
        panel={panel}
        heatmap={heatmap}
        dailyDone={dailyDone}
        citydexCount={save.births.length}
        citydexTotal={totalCities}
        achCount={achCount}
        achTotal={ACHIEVEMENTS.length}
        onNavigate={setPanel}
        onToggleHeatmap={toggleHeatmap}
        onDaily={handleDaily}
        onSignOut={handleSignOut}
      />

      <div className="frame">
        <div className="map-wrap" ref={containerRef}></div>
      </div>

      <div className="birth-dock">
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
      </div>

      {/* Home: cards de resumo (Citydex + Ranking), só quando nenhum painel está aberto */}
      {!panel && !zoomedState && (
        <HomeDashboard
          save={save}
          total={totalCities}
          auth={auth}
          onOpenCitydex={() => setPanel('citydex')}
          onOpenRanking={() => setPanel('ranking')}
        />
      )}

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
        className={`zoom-reset${zoomedState || manualZoomActive ? ' zoom-reset--visible' : ''}`}
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
        {panel === 'conquistas' && (
          <AchievementsModal save={save} ctx={achievementCtx} onClose={() => setPanel(null)} />
        )}
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
            auth={auth}
            resolveCity={(key) => controllerRef.current?.getCityInfo(key) ?? null}
            onAuthChanged={handleAuthChanged}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'configuracoes' && (
          <SettingsPanel
            auth={auth}
            onlineEnabled={onlineEnabled()}
            onSignOut={handleSignOut}
            onOpenRanking={() => setPanel('ranking')}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      {showAd && <AdInterstitial onContinue={handleAdContinue} />}
    </>
  );
}
