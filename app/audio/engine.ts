// All sounds are synthesized with the Web Audio API: no audio files to load.
import {
  AudioSettings,
  getAudioSettings,
  subscribeAudioSettings,
} from "./settings";

export type Fx =
  | "placeX"
  | "placeO"
  | "select"
  | "click"
  | "invalid"
  | "boardWon"
  | "boardDraw"
  | "gameWin"
  | "gameDraw";

// Loudest gain of each bus when its slider is at 100%
const FX_MAX_GAIN = 0.7;
const MUSIC_MAX_GAIN = 0.35;

let ctx: AudioContext | null = null;
let fxBus: GainNode;
let musicBus: GainNode;
// Browsers only allow audio after a user gesture
let unlocked = false;

const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  fxBus = ctx.createGain();
  fxBus.connect(ctx.destination);

  // Soften the music so it stays in the background
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = "lowpass";
  musicFilter.frequency.value = 2200;
  musicBus = ctx.createGain();
  musicBus.connect(musicFilter).connect(ctx.destination);

  applyVolumes(getAudioSettings());
  subscribeAudioSettings((s) => {
    applyVolumes(s);
    syncMusic();
  });
  return ctx;
};

const applyVolumes = (s: AudioSettings) => {
  if (!ctx) return;
  // Squared curve: the slider feels linear to the ear
  const now = ctx.currentTime;
  fxBus.gain.setTargetAtTime(s.fx * s.fx * FX_MAX_GAIN, now, 0.02);
  musicBus.gain.setTargetAtTime(s.music * s.music * MUSIC_MAX_GAIN, now, 0.05);
};

type ToneOptions = {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  slideTo?: number;
};

const tone = (
  dest: AudioNode,
  start: number,
  freq: number,
  duration: number,
  { type = "sine", gain = 0.3, attack = 0.005, slideTo }: ToneOptions = {}
) => {
  const c = ctx!;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.05);
};

const arpeggio = (
  start: number,
  notes: number[],
  spacing: number,
  duration: number,
  options: ToneOptions
) =>
  notes.forEach((n, i) =>
    tone(fxBus, start + i * spacing, midiToFreq(n), duration, options)
  );

const FX: Record<Fx, (t: number) => void> = {
  placeX: (t) => {
    tone(fxBus, t, 660, 0.12, { type: "triangle", gain: 0.35, slideTo: 990 });
    tone(fxBus, t, 1320, 0.08, { gain: 0.08 });
  },
  placeO: (t) => {
    tone(fxBus, t, 523, 0.14, { type: "triangle", gain: 0.35, slideTo: 392 });
    tone(fxBus, t, 262, 0.1, { gain: 0.1 });
  },
  select: (t) => tone(fxBus, t, 740, 0.07, { gain: 0.2 }),
  click: (t) => tone(fxBus, t, 1000, 0.06, { gain: 0.18, slideTo: 620 }),
  invalid: (t) => {
    tone(fxBus, t, 150, 0.12, { type: "square", gain: 0.06, slideTo: 110 });
    tone(fxBus, t + 0.09, 150, 0.12, { type: "square", gain: 0.05, slideTo: 110 });
  },
  boardWon: (t) =>
    arpeggio(t, [72, 76, 79, 84], 0.07, 0.25, { type: "triangle", gain: 0.25 }),
  boardDraw: (t) =>
    arpeggio(t, [67, 64], 0.12, 0.22, { type: "triangle", gain: 0.2 }),
  gameWin: (t) => {
    arpeggio(t, [60, 64, 67, 72], 0.12, 0.3, { type: "square", gain: 0.1 });
    [72, 76, 79, 84].forEach((n) =>
      tone(fxBus, t + 0.5, midiToFreq(n), 1.2, { type: "triangle", gain: 0.14, attack: 0.02 })
    );
  },
  gameDraw: (t) =>
    arpeggio(t, [64, 62, 60, 55], 0.18, 0.35, { type: "triangle", gain: 0.2 }),
};

export const playFx = (name: Fx, delay = 0) => {
  if (getAudioSettings().fx === 0) return;
  const c = getContext();
  if (!c || !unlocked) return;
  if (c.state === "suspended") c.resume();
  FX[name](c.currentTime + 0.01 + delay);
};

/* --- Background music: a soft looping arpeggio in A minor --- */

const BPM = 92;
const STEP = 60 / BPM / 2; // eighth notes
const STEPS_PER_BAR = 8;
// Am - F - C - G
const PROGRESSION = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const ARP_PATTERN = [0, 1, 2, 1, 0, 2, 1, 2];
const MELODY_SCALE = [69, 72, 74, 76, 79, 81]; // A minor pentatonic
const LOOKAHEAD = 0.25; // seconds scheduled in advance

let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextStepTime = 0;
let step = 0;

const scheduleStep = (t: number, stepIndex: number) => {
  const bar = Math.floor(stepIndex / STEPS_PER_BAR);
  const inBar = stepIndex % STEPS_PER_BAR;
  const chord = PROGRESSION[bar % PROGRESSION.length];
  const barLength = STEP * STEPS_PER_BAR;

  if (inBar === 0) {
    tone(musicBus, t, midiToFreq(chord[0] - 12), barLength, { gain: 0.22, attack: 0.05 });
    chord.forEach((n) =>
      tone(musicBus, t, midiToFreq(n), barLength, { gain: 0.05, attack: 0.4 })
    );
  }

  tone(musicBus, t, midiToFreq(chord[ARP_PATTERN[inBar]] + 12), STEP * 1.6, {
    type: "triangle",
    gain: 0.09,
  });

  // A sparse random melody every other bar
  if (bar % 2 === 1 && inBar % 3 === 0 && Math.random() < 0.6) {
    const note = MELODY_SCALE[Math.floor(Math.random() * MELODY_SCALE.length)];
    tone(musicBus, t, midiToFreq(note), STEP * 2.5, { gain: 0.07, attack: 0.03 });
  }
};

const startMusic = () => {
  const c = getContext();
  if (!c || musicTimer) return;
  nextStepTime = c.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextStepTime < c.currentTime + LOOKAHEAD) {
      scheduleStep(nextStepTime, step);
      nextStepTime += STEP;
      step = (step + 1) % (STEPS_PER_BAR * PROGRESSION.length * 2);
    }
  }, 50);
};

const stopMusic = () => {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
};

// Music plays only once audio is unlocked, the slider is above 0 and the tab is visible
const syncMusic = () => {
  const shouldPlay =
    unlocked && getAudioSettings().music > 0 && document.visibilityState === "visible";
  if (shouldPlay) startMusic();
  else stopMusic();
};

/** Hooks audio up to the first user gesture and to tab visibility. */
export const initAudio = () => {
  const unlock = () => {
    const c = getContext();
    if (!c) return;
    c.resume();
    unlocked = true;
    syncMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  const onVisibility = () => {
    if (!ctx) return;
    if (document.visibilityState === "visible") ctx.resume();
    else ctx.suspend();
    syncMusic();
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    document.removeEventListener("visibilitychange", onVisibility);
  };
};
