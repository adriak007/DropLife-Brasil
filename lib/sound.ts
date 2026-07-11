// Motor de som do jogo: TUDO sintetizado com Web Audio API — nenhum arquivo
// de áudio para baixar (zero peso extra, zero direitos autorais).
//
// - Música de fundo: loop generativo calmo (arpejo pentatônico de "marimba"
//   sobre um pad suave, progressão C–Am–F–G com variação aleatória).
// - Efeitos: nascimento (mais notas e brilho quanto mais rara a cidade),
//   fanfarra de conquista e tick discreto de botão.
//
// O AudioContext só nasce após o primeiro gesto do usuário (política de
// autoplay dos navegadores) e as preferências persistem em localStorage.

const PREFS_KEY = 'droplife-sound-v1';

export interface SoundPrefs {
  music: boolean;
  sfx: boolean;
}

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let unlocked = false;
let musicPlaying = false;
let musicTimer = 0;
let nextBarTime = 0;
let barIndex = 0;

const loadPrefs = (): SoundPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SoundPrefs>;
      return { music: p.music !== false, sfx: p.sfx !== false };
    }
  } catch {
    // storage indisponível — usa o padrão
  }
  return { music: true, sfx: true };
};

let prefs: SoundPrefs = typeof window === 'undefined' ? { music: true, sfx: true } : loadPrefs();

const savePrefs = () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sem storage — preferência vale só nesta sessão
  }
};

const ensureCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(ctx.destination);
    // pausa/retoma junto com a aba (não gastar bateria em segundo plano)
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else if (prefs.music || prefs.sfx) ctx.resume().catch(() => {});
    });
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

// Uma nota sintetizada: oscilador + envelope de decaimento exponencial
const note = (
  dest: GainNode,
  freq: number,
  when: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine'
) => {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
};

// ── Música de fundo (generativa) ──

// Pentatônica de dó (C4) — qualquer combinação soa bem
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
// Progressão C – Am – F – G (fundamentais graves do pad)
const CHORD_ROOTS = [130.81, 110.0, 87.31, 98.0];
const BAR_DUR = 3.2;

const scheduleBar = () => {
  if (!ctx || !musicGain || !musicPlaying || !prefs.music) return;
  const now = ctx.currentTime;
  if (nextBarTime < now + 0.05) nextBarTime = now + 0.05;
  const t0 = nextBarTime;
  const root = CHORD_ROOTS[barIndex % CHORD_ROOTS.length];

  // pad: fundamental + quinta + oitava, bem baixinho e macio
  [1, 1.5, 2].forEach((mult, i) => {
    note(musicGain!, root * mult, t0, BAR_DUR * 1.05, 0.028 - i * 0.006, 'triangle');
  });

  // arpejo "marimba": 5–7 notas pentatônicas com jitter humano
  const steps = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < steps; i++) {
    if (Math.random() < 0.18) continue; // pausas respiram
    const freq = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.3 ? 2 : 1);
    const when = t0 + (i * BAR_DUR) / steps + Math.random() * 0.05;
    note(musicGain!, freq, when, 0.9, 0.045, 'sine');
  }

  barIndex++;
  nextBarTime += BAR_DUR;
  musicTimer = window.setTimeout(scheduleBar, (nextBarTime - ctx.currentTime - 0.9) * 1000);
};

const startMusic = () => {
  if (musicPlaying || !prefs.music) return;
  if (!ensureCtx()) return;
  musicPlaying = true;
  nextBarTime = 0;
  scheduleBar();
};

const stopMusic = () => {
  musicPlaying = false;
  window.clearTimeout(musicTimer);
};

// ── API pública ──

// Chamar no primeiro gesto do usuário (pointerdown): destrava o áudio e
// inicia a música, se habilitada.
export const unlockAudio = (): void => {
  if (unlocked) return;
  unlocked = true;
  if (ensureCtx() && prefs.music) startMusic();
};

export const getSoundPrefs = (): SoundPrefs => ({ ...prefs });

export const setMusicEnabled = (on: boolean): void => {
  prefs = { ...prefs, music: on };
  savePrefs();
  if (on) startMusic();
  else stopMusic();
};

export const setSfxEnabled = (on: boolean): void => {
  prefs = { ...prefs, sfx: on };
  savePrefs();
};

const sfxReady = (): boolean => Boolean(prefs.sfx && unlocked && ensureCtx() && sfxGain);

// Tick discreto de botão (bem baixinho)
export const sfxTick = (): void => {
  if (!sfxReady() || !ctx || !sfxGain) return;
  note(sfxGain, 1750, ctx.currentTime, 0.05, 0.04, 'triangle');
};

// Nascimento: pop + arpejo ascendente — quanto mais rara a cidade, mais
// notas e mais brilho (lendário ganha fanfarra com oitava extra)
const TIER_NOTES: Record<string, number> = {
  comum: 1,
  incomum: 2,
  raro: 3,
  epico: 4,
  lendario: 6,
};
const BIRTH_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export const sfxBirth = (tierId: string): void => {
  if (!sfxReady() || !ctx || !sfxGain) return;
  const t = ctx.currentTime;
  // "pop" do nascimento: glide rápido pra cima
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(620, t + 0.09);
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.2);

  const count = TIER_NOTES[tierId] ?? 1;
  for (let i = 0; i < count; i++) {
    note(sfxGain, BIRTH_SCALE[i % BIRTH_SCALE.length], t + 0.1 + i * 0.09, 0.5, 0.11, 'triangle');
  }
  if (tierId === 'lendario') {
    // brilho extra: oitava alta cintilando
    for (let i = 0; i < 3; i++) {
      note(sfxGain, 2093 + i * 262, t + 0.55 + i * 0.07, 0.4, 0.05, 'sine');
    }
  }
};

// Fanfarra curta de conquista desbloqueada
export const sfxAchievement = (): void => {
  if (!sfxReady() || !ctx || !sfxGain) return;
  const t = ctx.currentTime;
  const fanfare = [392.0, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
  fanfare.forEach((freq, i) => {
    note(sfxGain!, freq, t + i * 0.11, 0.55, 0.12, 'triangle');
    note(sfxGain!, freq * 2, t + i * 0.11, 0.35, 0.04, 'sine');
  });
  // acorde final sustentado
  [523.25, 659.25, 783.99].forEach((freq) => {
    note(sfxGain!, freq, t + 0.46, 0.9, 0.07, 'triangle');
  });
};
