// Cảnh benchmark chuẩn của Ticket-04 (dùng chung cho trình duyệt và test).
import { createGame } from './game.js';
import { createRng } from './rng.js';

const ISLAND_R = 38; // rải trong đảo Đêm 1 (bán kính 40), chừa mép 2 m

function uniformDisk(rng, r, minR = 0) {
  let x, z;
  do {
    const rr = r * Math.sqrt(rng());
    const a = rng() * 2 * Math.PI;
    x = rr * Math.cos(a);
    z = rr * Math.sin(a);
  } while (Math.hypot(x, z) < minR);
  return [x, z];
}

export function benchScenario(seed = 42) {
  const rng = createRng(seed);
  const shades = Array.from({ length: 200 }, (_, i) => {
    const [x, z] = uniformDisk(rng, ISLAND_R, 3);
    return { id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' };
  });
  const motes = Array.from({ length: 100 }, () => {
    const [x, z] = uniformDisk(rng, ISLAND_R, 1.5);
    return [x, 0, z];
  });
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    shades, motes, drifters: [], charms: [],
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
}

export function createBenchGame(tuning, seed = 42) {
  return createGame(tuning, { seed, night: 1, scenario: benchScenario(seed), bench: true });
}

/** Camera bench: tròn bán kính 30 m, Y = 15, bắt đầu (30,15,0), ngược chiều kim đồng hồ nhìn từ trên, 15 s/vòng. */
export function benchCamera(tSec) {
  const a = (2 * Math.PI * tSec) / 15;
  return [30 * Math.cos(a), 15, 30 * Math.sin(a)];
}

/** Thống kê theo định nghĩa Ticket-04 từ mảng dt (ms). */
export function benchStats(dts) {
  const N = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95i = Math.min(N - 1, Math.ceil(0.95 * N) - 1);
  return {
    frames: N,
    avg_fps: N ? +(1000 * N / sum).toFixed(1) : 0,
    p1_low_fps: N ? +(1000 / (worst.reduce((a, b) => a + b, 0) / k)).toFixed(1) : 0,
    frame_ms_p95: N ? +sorted[p95i].toFixed(2) : 0,
  };
}
