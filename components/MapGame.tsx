'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapController } from '@/lib/mapController';
import { formatPop } from '@/lib/text';
import { cityImageFor, preloadCityImages } from '@/lib/cityImages';
import { sfxAchievement, sfxBirth, unlockAudio } from '@/lib/sound';
import type { CityModalData, ModalState, PanelKind, PickedCity, StateStats } from '@/lib/types';
import {
  loadSave,
  persistSave,
  clearSave,
  emptySave,
  type BirthRecord,
  type SaveData,
  type SaveScope,
} from '@/lib/storage';
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
import ShareModal from '@/components/ShareModal';
import FeedbackModal from '@/components/FeedbackModal';
import OnboardingModal from '@/components/OnboardingModal';
import { spawnRipple } from '@/components/NavButton';
import { shareDailyCard } from '@/lib/shareCard';
import {
  ackWarning,
  activeBan,
  fetchMyBirths,
  getAuthState,
  onAuthChange,
  onlineEnabled,
  recordBirth,
  signOut,
  type AuthState,
  type ServerBirthRow,
} from '@/lib/online';

const LOGO_SRC = '/Img/logo-nav.png';
// Cobre a roleta do sorteio (~2s de tec-tec-tec + pouso) até o card abrir
const BIRTH_COOLDOWN_MS = 2600;
const ONBOARDING_KEY = 'droplife-onboarding-v1';

const achievementCtxOf = (controller: MapController): AchievementContext => ({
  totalCities: controller.totalCities(),
  stateTotals: Object.fromEntries(controller.getStateStats().map((s) => [s.uf, s.municipios])),
});

// Reconstrói o save de uma conta com o que o servidor retornou (fonte da
// verdade), opcionalmente somando registros locais ainda não sincronizados
// (uma migração/sync interrompida) — esses voltam para a fila de envio.
const buildAccountSave = (
  rows: ServerBirthRow[],
  controller: MapController,
  extras: BirthRecord[] = []
): SaveData => {
  const births: BirthRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.city_key)) continue;
    seen.add(row.city_key);
    const info = controller.getCityByKey(row.city_key);
    if (!info) continue; // chave antiga que não bate com o mapa atual
    births.push({
      key: row.city_key,
      city: info.city,
      state: info.state,
      population: info.population,
      chance: info.chance,
      bornAt: row.created_at ?? new Date().toISOString(),
    });
  }
  for (const b of extras) {
    if (seen.has(b.key)) continue;
    seen.add(b.key);
    births.push(b);
  }
  const save: SaveData = { version: 1, births, achievements: {} };
  const stamp = new Date().toISOString();
  save.achievements = Object.fromEntries(
    newlyUnlocked(births, save, achievementCtxOf(controller)).map((a) => [a.id, stamp])
  );
  return save;
};

// Conta NOVA (zero nascimentos no servidor) + progresso de visitante: o save
// do convidado vira o começo da conta — nascimentos, conquistas e desafio
// diário — e os nascimentos entram na fila de sincronização com o servidor.
const adoptGuestSave = (guest: SaveData, controller: MapController): SaveData => {
  const save: SaveData = {
    version: 1,
    births: guest.births,
    achievements: { ...guest.achievements },
    ...(guest.lastDaily ? { lastDaily: guest.lastDaily } : {}),
    ...(guest.dailyResult ? { dailyResult: guest.dailyResult } : {}),
  };
  const stamp = new Date().toISOString();
  newlyUnlocked(save.births, save, achievementCtxOf(controller)).forEach((a) => {
    save.achievements[a.id] = stamp;
  });
  return save;
};

export default function MapGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTitleRef = useRef<HTMLDivElement>(null);
  const tooltipSubtitleRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  // Ponto de origem (coordenadas de tela) de onde o modal de cidade deve
  // "crescer" — o pin dela no mapa. Nulo cai no zoom padrão a partir do
  // centro (ex.: modal aberto pelo tooltip, sem sorteio/roleta antes).
  const [modalOrigin, setModalOrigin] = useState<{ x: number; y: number } | null>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const [zoomedState, setZoomedState] = useState<string | null>(null);
  const [manualZoomActive, setManualZoomActive] = useState(false);
  // Banner do Desafio Diário: nome + estado da cidade sorteada, visível
  // enquanto o jogador procura ela no mapa (some ao palpitar ou desistir)
  const [dailyBanner, setDailyBanner] = useState<{ city: string; state: string } | null>(null);
  const [save, setSave] = useState<SaveData>(emptySave);
  const [totalCities, setTotalCities] = useState(0);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ signedIn: false, userId: null, profile: null });
  const [mapReady, setMapReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  // Só carregamos qualquer save depois de saber QUEM está na sessão — evita
  // exibir progresso de visitante para uma conta (e vice-versa) no boot.
  const [authResolved, setAuthResolved] = useState(!onlineEnabled());
  const sonarRef = useRef<HTMLSpanElement>(null);

  // Escopo do save da sessão atual: sem backend -> 'local' (persistente);
  // visitante -> 'guest' (temporário, sessionStorage); logado -> uid da conta.
  const saveScope: SaveScope = !onlineEnabled()
    ? 'local'
    : auth.signedIn && auth.userId
      ? auth.userId
      : 'guest';
  const scopeRef = useRef<SaveScope | null>(null);
  // Cidade a destacar no mapa (pin + pulso) quando o modal de nascimento fechar
  const pendingHighlightRef = useRef<string | null>(null);
  // Cidade sorteada do Desafio Diário aguardando o palpite do jogador (o
  // mapa está em modo de adivinhação — ver startDailyGuess)
  const dailyPendingRef = useRef<PickedCity | null>(null);
  // Fila de nascimentos a subir para o servidor (migração de visitante ou
  // sync interrompida): drena 1 a cada ~1,7s respeitando o rate limit do banco
  const syncQueueRef = useRef<string[]>([]);
  const syncTriesRef = useRef(new Map<string, number>());
  const syncTimerRef = useRef(0);

  const drainSyncQueue = (uid: SaveScope) => {
    window.clearTimeout(syncTimerRef.current);
    const tick = () => {
      if (scopeRef.current !== uid) return; // trocou de dono: fila morre
      const key = syncQueueRef.current[0];
      if (!key) return;
      recordBirth(key).then((r) => {
        if (scopeRef.current !== uid) return;
        if (r === 'ok') {
          syncQueueRef.current.shift();
          setAuth((a) =>
            a.profile
              ? { ...a, profile: { ...a.profile, total_births: a.profile.total_births + 1 } }
              : a
          );
        } else if (r === 'duplicado') {
          // já estava no servidor: sai da fila sem recontar
          syncQueueRef.current.shift();
        } else {
          // falha de verdade (rede/rate limit): tenta de novo mais tarde
          const tries = (syncTriesRef.current.get(key) || 0) + 1;
          syncTriesRef.current.set(key, tries);
          if (tries >= 6) syncQueueRef.current.shift();
        }
        syncTimerRef.current = window.setTimeout(tick, 1700);
      });
    };
    syncTimerRef.current = window.setTimeout(tick, 900);
  };

  // Totais reais (não hardcoded) usados pelas conquistas de estado/região/país
  const achievementCtx: AchievementContext = {
    totalCities,
    stateTotals: Object.fromEntries(stateStats.map((s) => [s.uf, s.municipios])),
  };

  const refreshAuth = async () => {
    setAuth(await getAuthState());
    setAuthResolved(true);
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

    const controller = new MapController({
      container,
      tooltip,
      tooltipTitle,
      tooltipSubtitle,
      setStatus,
      openMessageModal: (message, title = 'Aviso') =>
        setModal({ type: 'message', title, message }),
      openCityModal: (data) => {
        // Aberto pelo botão "i" do tooltip, sem sorteio/roleta antes — usa o
        // crescimento padrão a partir do centro.
        setModalOrigin(null);
        setModal({ type: 'city', data });
      },
      onZoomChange: setZoomedState,
      onManualZoomChange: setManualZoomActive,
    });
    controllerRef.current = controller;

    let cancelled = false;
    controller
      .init()
      .then(() => {
        if (cancelled) return;
        setTotalCities(controller.totalCities());
        setStateStats(controller.getStateStats());
        // O save do dono da sessão é carregado pelo efeito de identidade,
        // que espera o mapa (aqui) e a autenticação (refreshAuth) resolverem.
        setMapReady(true);
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

  // ── Isolamento de progresso por identidade ──
  // Sempre que o dono da sessão muda (visitante -> conta, conta -> visitante,
  // conta A -> conta B), TODO o estado em memória e o mapa são zerados e
  // recriados do zero para o novo dono:
  //   - login em conta EXISTENTE: visitante é descartado e a conta carrega
  //     o que o servidor retornar (+ extras locais de sync interrompida);
  //   - login em conta NOVA (zero nascimentos no banco): o progresso de
  //     visitante é ADOTADO como início da conta e sobe em fila p/ o servidor;
  //   - logout: o cache local da conta é apagado e o site volta ao estado de
  //     visitante sem nenhuma cidade;
  //   - troca de conta: nada da conta anterior sobrevive.
  useEffect(() => {
    if (!mapReady || !authResolved) return;
    if (scopeRef.current === saveScope) return;
    const previous = scopeRef.current;
    scopeRef.current = saveScope;
    const controller = controllerRef.current;
    if (!controller) return;

    // Zera memória, UI, mapa e fila de sync antes do novo dono da sessão
    pendingHighlightRef.current = null;
    dailyPendingRef.current = null; // cancela desafio em aberto (resetZoom já limpa o modo no controller)
    setDailyBanner(null);
    syncQueueRef.current = [];
    syncTriesRef.current = new Map();
    window.clearTimeout(syncTimerRef.current);
    setSave(emptySave());
    setPanel(null);
    setModal(null);
    setStatus('');
    controller.resetCaptured();
    controller.resetZoom();

    if (saveScope === 'local' || saveScope === 'guest') {
      // Logout: o cache local da conta anterior é removido por completo
      if (previous && previous !== 'guest' && previous !== 'local') clearSave(previous);
      const loaded = loadSave(saveScope);
      setSave(loaded);
      controller.restoreCaptured(new Set(loaded.births.map((b) => b.key)));
      return;
    }

    // Login / troca de conta
    const guest = loadSave('guest');
    clearSave('guest');
    let cancelled = false;
    (async () => {
      const rows = await fetchMyBirths();
      let account: SaveData;
      const toSync: string[] = [];
      let adopted = false;

      if (rows === null) {
        // Sem rede: cai no cache local EXCLUSIVO desta conta (nunca no de
        // visitante nem no de outra conta).
        account = loadSave(saveScope);
      } else if (rows.length === 0 && guest.births.length > 0) {
        // Conta nova + progresso de visitante: "login anônimo" — o que a
        // pessoa jogou como convidada vira o começo da conta dela.
        account = adoptGuestSave(guest, controller);
        toSync.push(...guest.births.map((b) => b.key));
        adopted = true;
      } else {
        // Conta existente: banco é a fonte da verdade. Extras do cache local
        // DESTA conta (sync interrompida) entram e voltam para a fila.
        const cached = loadSave(saveScope);
        const serverKeys = new Set(rows.map((r) => r.city_key));
        const extras = cached.births.filter(
          (b) => !serverKeys.has(b.key) && controller.getCityByKey(b.key)
        );
        account = buildAccountSave(rows, controller, extras);
        toSync.push(...extras.map((b) => b.key));
      }

      persistSave(saveScope, account);
      if (cancelled || scopeRef.current !== saveScope) return;
      setSave(account);
      controller.restoreCaptured(new Set(account.births.map((b) => b.key)));
      if (toSync.length) {
        syncQueueRef.current = toSync;
        syncTriesRef.current = new Map();
        drainSyncQueue(saveScope);
      }
      if (adopted) {
        showToast(
          `🎉 Suas ${guest.births.length} cidades de visitante agora são da sua conta!`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saveScope, mapReady, authResolved]);

  // ── Aviso de banimento ──
  // Se o perfil logado está banido (profiles.banned), mostra um modal com a
  // data de término do ban — ou avisa que é permanente. Uma vez por conta
  // por sessão. Declarado DEPOIS do efeito de identidade para o modal não
  // ser apagado pela limpeza de troca de dono.
  const banNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    const ban = activeBan(auth.profile);
    if (!ban || !auth.userId) return;
    if (banNotifiedRef.current === auth.userId) return;
    banNotifiedRef.current = auth.userId;
    const message = ban.until
      ? `Sua conta está banida do ranking até ${ban.until.toLocaleDateString('pt-BR')} às ${ban.until.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Até lá, seus nascimentos não contam para o ranking global.`
      : 'Sua conta está banida do ranking permanentemente. Seus nascimentos não contam para o ranking global.';
    setModal({ type: 'message', title: '🚫 Conta banida', message });
  }, [auth]);

  // ── Aviso da moderação ──
  // Mensagem enviada pelo admin (ex.: "pare de usar scripts"): aparece uma
  // vez num modal e é confirmada no servidor ao ser exibida. Ban tem
  // prioridade — se os dois existirem, o aviso fica para a próxima sessão.
  const warnNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    const p = auth.profile;
    if (!p?.warning || !auth.userId) return;
    if (activeBan(p)) return;
    const marca = `${auth.userId}:${p.warning}`;
    if (warnNotifiedRef.current === marca) return;
    warnNotifiedRef.current = marca;
    setModal({ type: 'message', title: '⚠️ Aviso da moderação', message: p.warning });
    ackWarning();
  }, [auth]);

  // Imagens das cidades: JSONs (~1 MB brutos) baixados fora do caminho
  // crítico, quando o navegador estiver ocioso — não bloqueia o load.
  useEffect(() => {
    let alive = true;
    const start = () => {
      preloadCityImages().then(() => {
        if (alive) setImagesReady(true);
      });
    };
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idleId = hasIdle ? window.requestIdleCallback(start, { timeout: 4000 }) : 0;
    const timerId = hasIdle ? 0 : window.setTimeout(start, 1500);
    return () => {
      alive = false;
      if (idleId) window.cancelIdleCallback(idleId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  // Áudio: destrava no primeiro gesto (política de autoplay) e, se a música
  // estiver habilitada, ela começa aí.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  // Onboarding: telinha de boas-vindas no primeiro acesso (uma vez por navegador)
  useEffect(() => {
    if (!mapReady) return;
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
    } catch {
      // storage bloqueado — segue sem onboarding
    }
  }, [mapReady]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // sem storage, o aviso volta na próxima visita — aceitável
    }
  };

  // Esc fecha o que estiver aberto: primeiro o modal, depois o painel
  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key !== 'Escape') return;
      if (modal) setModal(null);
      else if (panel) setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, panel]);

  // Ao fechar o modal de nascimento, destaca a cidade onde o jogador acabou
  // de nascer (pin + pulso) na view atual — sem mexer no zoom.
  useEffect(() => {
    if (modal || !pendingHighlightRef.current) return;
    const key = pendingHighlightRef.current;
    pendingHighlightRef.current = null;
    controllerRef.current?.highlightCity(key);
  }, [modal]);

  // Se o jogador desistir do palpite (botão "Voltar" ou zoom para fora),
  // zoomedState volta a null — cancela o desafio em aberto e some o banner.
  useEffect(() => {
    if (zoomedState !== null || !dailyPendingRef.current) return;
    dailyPendingRef.current = null;
    setDailyBanner(null);
  }, [zoomedState]);

  const registerBirth = (
    picked: PickedCity,
    daily?: string,
    guess?: { correct: boolean; guessCity?: string; guessState?: string }
  ) => {
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
      ...(daily && guess
        ? {
            dailyCorrect: guess.correct,
            ...(guess.guessCity ? { dailyGuessCity: guess.guessCity, dailyGuessState: guess.guessState } : {}),
          }
        : {}),
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
    persistSave(scopeRef.current ?? saveScope, next);
    setSave(next);
    sfxBirth(rarityFor(picked.population).id);
    if (unlocked.length) window.setTimeout(sfxAchievement, 700);
    unlocked.forEach((a) => showToast(`🏆 Conquista desbloqueada: ${a.emoji} ${a.name}`));

    // Ranking global: registra o nascimento (o servidor valida cidade,
    // duplicata, ban e rate limit). Se falhar (ex.: rate limit por jitter de
    // rede), tenta uma única vez de novo após o intervalo mínimo do servidor.
    if (auth.profile && !already) {
      recordBirth(picked.key).then((r) => {
        if (r === 'ok') {
          setAuth((a) =>
            a.profile
              ? { ...a, profile: { ...a.profile, total_births: a.profile.total_births + 1 } }
              : a
          );
          return;
        }
        if (r === 'duplicado') return; // já estava salvo: nada a fazer
        // Falhou (rede instável no celular, rate limit em sequência rápida):
        // antes tentava UMA vez e desistia calado, e o nascimento ficava só
        // no aparelho — daí o "score dessincronizou" de quem joga muito.
        // Agora entra na fila persistente, que repete respeitando o intervalo
        // mínimo do banco; o que ainda escapar é reconciliado no próximo
        // carregamento, que compara o save local com o servidor.
        if (!syncQueueRef.current.includes(picked.key)) {
          syncQueueRef.current.push(picked.key);
          syncTriesRef.current.delete(picked.key);
        }
        drainSyncQueue(scopeRef.current ?? saveScope);
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
      ...(daily && guess
        ? {
            dailyCorrect: guess.correct,
            ...(guess.guessCity ? { dailyGuessCity: guess.guessCity, dailyGuessState: guess.guessState } : {}),
          }
        : {}),
    };
    // Quando o jogador fechar o modal, o mapa mostra onde a cidade fica
    pendingHighlightRef.current = picked.key;
    // O pin já está pousado nela (roleta ou revelação do palpite) — o modal
    // "nasce" crescendo a partir desse ponto na tela.
    setModalOrigin(controllerRef.current?.getCityScreenPoint(picked.key) ?? null);
    setModal({ type: 'city', data });
  };

  const performBirth = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    // deferVisual: a pintura da cidade fica pendente até a roleta pousar —
    // senão a cor de raridade no mapa entregaria o resultado no 1º frame
    const picked = controller.pickBirth(true);
    if (!picked) {
      setModal({
        type: 'message',
        title: 'Coleção completa!',
        message: 'Você já nasceu em todos os municípios do Brasil. Parabéns!',
      });
      return;
    }
    // tec-tec-tec pelo mapa → pouso com pin + pulso → card com a curiosidade
    controller.playBirthRoulette(picked.key, () => registerBirth(picked));
  };

  const handleBirth = () => {
    const controller = controllerRef.current;
    if (!controller || cooldown) return;
    setCooldown(true);
    performBirth();
  };

  // Desafio Diário: sorteia a cidade do dia (mesma para todo mundo) e entra
  // em modo de adivinhação — o mapa dá zoom no estado dela e o próximo
  // clique em qualquer município é o palpite do jogador.
  const handleDaily = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    // O palpite exige ver o mapa — fecha qualquer painel (Citydex etc.) que
    // esteja por cima dele.
    setPanel(null);
    const today = todayKey();
    const current = saveRef.current;
    if (current.lastDaily === today) {
      const result = current.dailyResult;
      if (result && result.daily === today) {
        // Reabrindo um resultado antigo (não acabou de ser revelado agora)
        // — sem pin fresco na tela, usa o crescimento padrão do centro.
        setModalOrigin(null);
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
            ...(result.dailyCorrect !== undefined
              ? {
                  dailyCorrect: result.dailyCorrect,
                  dailyGuessCity: result.dailyGuessCity,
                  dailyGuessState: result.dailyGuessState,
                }
              : {}),
          },
        });
      } else {
        showToast('Desafio de hoje já concluído. Volte amanhã! 📅');
      }
      return;
    }
    // deferVisual: a cidade-alvo só é pintada na revelação do palpite
    const picked = controller.pickDaily(seededRng(`droplife-${today}`), true);
    if (!picked) return;
    dailyPendingRef.current = picked;
    // Mostra o nome e o estado da cidade sorteada — o palpite é ACHAR ela
    // no mapa, não adivinhar qual é. O banner some quando o jogador clicar.
    setDailyBanner({ city: picked.city, state: picked.state });
    controller.startDailyGuess(picked.key, (guessedKey) => handleDailyGuess(guessedKey));
  };

  // Chamado pelo mapa quando o jogador toca uma cidade em modo de palpite.
  const handleDailyGuess = (guessedKey: string) => {
    const picked = dailyPendingRef.current;
    const controller = controllerRef.current;
    if (!picked || !controller) return;
    dailyPendingRef.current = null;
    setDailyBanner(null);
    const today = todayKey();
    const correct = guessedKey === picked.key;
    const guessedInfo = correct ? null : controller.getCityInfo(guessedKey);
    controller.revealGuess(picked.key, guessedKey);
    registerBirth(picked, today, {
      correct,
      guessCity: guessedInfo?.city,
      guessState: guessedInfo?.state,
    });
  };

  const handleShare = async (data: CityModalData) => {
    const date = data.daily || todayKey();
    const [y, m, d] = date.split('-');
    const tier = rarityFor(data.population || 0);
    // Texto sem o nome da cidade (estilo Wordle: sem spoiler do dia)
    const text = [
      `🇧🇷 DropLife Brasil — Desafio Diário ${d}/${m}/${y}`,
      data.dailyCorrect === true
        ? '🎯 Acertei o palpite de primeira!'
        : data.dailyCorrect === false
          ? '❌ Não acertei o palpite dessa vez...'
          : '',
      `Tirei ${tier.label} · Chance: ${data.chance}%`,
      `Onde você vai nascer? droplife.life`,
    ]
      .filter(Boolean)
      .join('\n');
    const feedback = await shareDailyCard(
      {
        date,
        tier,
        chance: data.chance || '?',
        population: data.population || 0,
        correct: data.dailyCorrect,
      },
      text
    );
    showToast(feedback);
  };

  const locateState = (uf: string) => {
    setPanel(null);
    controllerRef.current?.focusStateByKey(uf);
  };

  // Citydex: fecha o painel, dá zoom no estado e destaca a cidade (pin + pulso)
  const locateCity = (uf: string, key?: string) => {
    setPanel(null);
    const controller = controllerRef.current;
    if (!controller) return;
    if (key) controller.focusCity(key);
    else controller.focusStateByKey(uf);
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
    // O efeito de identidade cuida da limpeza total (save, mapa, painéis)
    setAuth({ signedIn: false, userId: null, profile: null });
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
        ? modal.data.dailyCorrect === false
          ? 'Desafio Diário: quase lá!'
          : `Desafio Diário: ${modal.data.city}!`
        : modal?.type === 'city' && modal.data.chance
          ? `Voce nasceu em ${modal.data.city}!`
          : 'Detalhes do municipio';

  const cityData = modal?.type === 'city' ? modal.data : null;
  const cityTier = cityData ? rarityFor(cityData.population || 0) : null;
  const popText = cityData?.population
    ? `${formatPop(cityData.population)} habitantes`
    : 'Populacao indisponivel';

  // Imagem estática da cidade para o modal de nascimento (null até o
  // preload em idle terminar; imagesReady re-renderiza quando fica pronto)
  const cityImage = cityData && imagesReady ? cityImageFor(cityData.city, cityData.state) : null;

  // Em internet mais lenta a curiosidade (texto, já embutido) aparecia uns
  // ms antes da foto terminar de baixar — sincroniza os dois: sem imagem
  // pra essa cidade, mostra na hora; com imagem, espera o <img> onLoad (com
  // um teto de 900ms pra não travar o texto se a foto falhar/demorar).
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    setImgLoaded(false);
    if (!cityImage) return;
    const timeout = window.setTimeout(() => setImgLoaded(true), 900);
    return () => window.clearTimeout(timeout);
  }, [cityImage]);
  const contentReady = !cityImage || imgLoaded;

  // O modal "nasce" de onde o pin está no mapa (efeito de origem), em vez
  // de sempre crescer do centro da tela — roda em layout effect (antes do
  // browser pintar) pra a 1ª animação já sair com o transform-origin certo.
  useLayoutEffect(() => {
    const panelEl = modalPanelRef.current;
    if (!panelEl) return;
    if (modal?.type === 'city' && modalOrigin) {
      const rect = panelEl.getBoundingClientRect();
      panelEl.style.transformOrigin = `${modalOrigin.x - rect.left}px ${modalOrigin.y - rect.top}px`;
      panelEl.classList.add('modal-panel--grow-from-pin');
    } else {
      panelEl.style.transformOrigin = '';
      panelEl.classList.remove('modal-panel--grow-from-pin');
    }
  }, [modal, modalOrigin]);

  const capturedInZoomed = zoomedState
    ? save.births.filter((b) => b.state === zoomedState).length
    : 0;

  const dailyDone = save.lastDaily === todayKey();
  const achCount = Object.keys(save.achievements).length;

  return (
    <>
      {/* Loading screen */}
      <div className={`loading-screen${loading ? '' : ' hidden'}`}>
        <img
          className="loading-logo"
          src={LOGO_SRC}
          alt="DropLife"
          width={900}
          height={236}
          fetchPriority="high"
        />
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
          stateStats={stateStats}
          achievementCtx={achievementCtx}
          auth={auth}
          onOpenCitydex={() => setPanel('citydex')}
          onOpenRanking={() => setPanel('ranking')}
          onOpenConquistas={() => setPanel('conquistas')}
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

      {/* Desafio Diário: nome + estado da cidade sorteada, enquanto o
          jogador procura ela no mapa */}
      {dailyBanner && (
        <div className="daily-banner">
          🎯 Desafio de hoje: <strong>{dailyBanner.city}</strong> ({dailyBanner.state}) — clique no
          mapa onde ela fica!
        </div>
      )}

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
        <div className="modal-panel" ref={modalPanelRef}>
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
              {cityData?.daily && cityData.dailyCorrect !== undefined ? (
                <p
                  className={`modal-city__guess${
                    cityData.dailyCorrect ? ' modal-city__guess--certo' : ' modal-city__guess--errado'
                  }`}
                >
                  {cityData.dailyCorrect
                    ? '✅ Você acertou de primeira!'
                    : `❌ Você clicou em ${cityData.dailyGuessCity || 'outro lugar'}${
                        cityData.dailyGuessState ? ` (${cityData.dailyGuessState})` : ''
                      }. A cidade certa era esta:`}
                </p>
              ) : null}
              {cityImage && (
                <img
                  className="modal-city__img"
                  src={cityImage}
                  alt={cityData?.city}
                  decoding="async"
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />
              )}
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
                <p className={`modal-city__curiosity${contentReady ? '' : ' modal-city__curiosity--wait'}`}>
                  {cityData.curiosity}
                </p>
              ) : null}
              {cityData?.daily ? (
                <button className="share-btn" type="button" onClick={() => handleShare(cityData)}>
                  📋 Compartilhar resultado
                </button>
              ) : null}
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
            onLocate={locateCity}
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
            totalCities={totalCities}
            resolveCity={(key) => controllerRef.current?.getCityInfo(key) ?? null}
            onAuthChanged={handleAuthChanged}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'compartilhar' && (
          <ShareModal
            nickname={auth.signedIn && auth.profile ? auth.profile.nickname : null}
            citydexCount={save.births.length}
            citydexTotal={totalCities}
            achCount={achCount}
            achTotal={ACHIEVEMENTS.length}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'feedback' && (
          <FeedbackModal
            nickname={auth.signedIn && auth.profile ? auth.profile.nickname : null}
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

      {showOnboarding && <OnboardingModal onClose={dismissOnboarding} />}
    </>
  );
}
