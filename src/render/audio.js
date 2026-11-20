// Âm thanh tổng hợp bằng WebAudio (không dùng file). Bus: master ← music, sfx (skill audio-design).
// Thanh âm lượng 0..1 được bình phương trước khi thành gain; 0 = tắt hẳn.
let ctx = null;
let master, music, sfx, comp;
let musicTimer = null;
let volume = 0.7;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); // giữ headroom, tránh vỡ tiếng khi nhiều SFX cùng lúc
  comp.threshold.value = -10;
  master = ctx.createGain();
  music = ctx.createGain();
  sfx = ctx.createGain();
  music.gain.value = 0.35;
  sfx.gain.value = 0.9;
  music.connect(master);
  sfx.connect(master);
  master.connect(comp).connect(ctx.destination);
  setVolume(volume);
  return true;
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  if (master) master.gain.value = volume * volume;
}

export function resume() {
  if (ensure() && ctx.state === 'suspended') ctx.resume();
}

const vary = (x, pct = 0.06) => x * (1 + (Math.random() * 2 - 1) * pct); // biến thể cao độ nhỏ

function tone(freq, dur, { type = 'sine', gain = 0.3, to = null, delay = 0, bus = sfx } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { gain = 0.25, freq = 800, q = 1, delay = 0, sweepTo = null } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfx);
  src.start(t);
}

export const SFX = {
  pickup: () => tone(vary(1320), 0.12, { type: 'triangle', gain: 0.18, to: vary(1760) }),
  lanternLit: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, { type: 'triangle', gain: 0.2, delay: i * 0.07 })),
  deposit: () => tone(vary(660), 0.15, { type: 'sine', gain: 0.15, to: 880 }),
  pulse: () => { tone(220, 0.5, { type: 'sine', gain: 0.3, to: 880 }); noise(0.4, { gain: 0.12, freq: 2000, sweepTo: 500 }); },
  hit: () => { tone(160, 0.35, { type: 'sawtooth', gain: 0.25, to: 60 }); noise(0.2, { gain: 0.2, freq: 300 }); },
  jump: () => tone(vary(330), 0.18, { type: 'square', gain: 0.08, to: vary(660) }),
  dash: () => noise(0.22, { gain: 0.25, freq: 900, sweepTo: 3000, q: 0.7 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.22, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, { type: 'sine', gain: 0.22, delay: i * 0.18 })),
  shadeSpawn: () => { tone(vary(90), 0.7, { type: 'sawtooth', gain: 0.12, to: 55 }); noise(0.6, { gain: 0.08, freq: 200 }); },
  countdown: () => tone(1000, 0.08, { type: 'square', gain: 0.12 }),
  windWarn: () => noise(1.8, { gain: 0.18, freq: 400, sweepTo: 1600, q: 0.5 }),
  charm: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.15, delay: i * 0.05 })),
  steal: () => tone(700, 0.3, { type: 'triangle', gain: 0.18, to: 300 }),
  click: () => tone(600, 0.05, { type: 'square', gain: 0.06 }),
};

// Nhạc nền đêm: nền trầm + nốt ngũ cung rải chậm
const PENTA = [220, 247, 294, 330, 392, 440, 494, 587];
export function startMusic() {
  if (!ensure() || musicTimer) return;
  const drone = [110, 165].map((f) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.value = 0.08;
    o.connect(g).connect(music);
    o.start();
    return o;
  });
  musicTimer = {
    drone,
    id: setInterval(() => {
      const f = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(f, 1.6, { type: 'sine', gain: 0.12, bus: music });
      if (Math.random() < 0.4) tone(f * 1.5, 1.2, { type: 'triangle', gain: 0.06, bus: music, delay: 0.4 });
    }, 900),
  };
}
export function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer.id);
  musicTimer.drone.forEach((o) => o.stop());
  musicTimer = null;
}
