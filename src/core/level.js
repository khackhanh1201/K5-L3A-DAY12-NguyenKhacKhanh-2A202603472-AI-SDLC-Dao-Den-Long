// Bản đồ chuẩn và hằng số Ticket-02 không nằm trong tuning của contract.
// Góc đo từ +X, ngược chiều kim đồng hồ nhìn từ trên: điểm = (r·cosθ, y, r·sinθ).
export const TICK_RATE = 60;
export const EPS = 1e-6;

export const RULES = {
  gravity: 20,
  jumpVelocity: 7,
  stepUp: 0.35, // vách cao hơn chân quá mức này thì chặn (B3)
  stepDown: 0.35, // đang đứng đất thì bám theo đất thấp hơn tối đa mức này
  fallY: -10,
  respawnWaitTicks: 60,
  charmSpeed: 7.2,
  charmTicks: 600,
  charmRespawnTicks: 2700,
  pickupDy: 1.5,
  pulseCenterDy: 0.8,
  pulseStunTicks: 120,
  pulsePushTicks: 15,
  shadeDetect: 12,
  shadeGiveUp: 18,
  shadeHitDy: 1.5,
  shadeHover: 1.0,
  shadeSpawningTicks: 60, // B7
  shadeWanderSpeed: 1.5, // B8
  shadeWanderTurnTicks: 120,
  shadeRecoilM: 2,
  shadeRecoilTicks: 60,
  shadeSpawnMinDist: 15,
  shadeFirstSpawnTick: 300,
  evictTicks: 30,
  dropTtlTicks: 480,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  moteInitial: 20,
  moteCap: 30,
  moteEveryTicks: 240,
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterHover: 1.5,
  drifterMax: 2,
  drifterEveryTicks: 1200,
  drifterChaseCarry: 5,
  drifterChaseDist: 15,
  drifterTouch: 1.2,
  drifterSteal: 3,
  drifterFleeTicks: 240,
  drifterDropFleeTicks: 120,
  windEveryTicks: 1800,
  windTicks: 300,
  windWarnTicks: 120,
  windSpeed: 2,
};

const rad = (d) => (d * Math.PI) / 180;
export function round3(x) {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
const polar = (r, d, y = 0, cx = 0, cz = 0) => [round3(cx + r * Math.cos(rad(d))), y, round3(cz + r * Math.sin(rad(d)))];
const ring = (r, startDeg, stepDeg, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => polar(r, startDeg + i * stepDeg, y, cx, cz));
const lanterns = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));
const hyp = Math.hypot;

function unitTo(from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = hyp(dx, dz);
  return [dx / d, dz / d];
}

const N1 = {
  night: 1,
  name: 'Đảo Bến',
  start: [0, 0, 0],
  centers: [[0, 0, 0]],
  ground: (x, z) => (hyp(x, z) <= 40 ? 0 : null),
  tower: null,
  lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadeSpawns: ring(37, 15, 30, 12),
  shadeEveryTicks: 480,
  shadeMax: 6,
  shadeSpeed: 4.0,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
};

const N2 = {
  night: 2,
  name: 'Đảo Cau',
  start: [0, 0, 0],
  centers: [[0, 0, 0], [70, 0, 0]],
  ground: (x, z) => (hyp(x, z) <= 28 || hyp(x - 70, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null),
  tower: null,
  lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  moteSpawns: [
    ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
    ...ring(10, 0, 90, 4, 0, 70, 0), ...ring(22, 0, 45, 8, 0, 70, 0),
  ],
  shadeSpawns: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70, 0)],
  shadeEveryTicks: 420,
  shadeMax: 8,
  shadeSpeed: 4.0,
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, h: unitTo([20, 0, 18], [70, 0, 0]).map((v) => v * 24) },
    { pos: [50, 0, -18], r: 1, vy: 14, h: unitTo([50, 0, -18], [0, 0, 0]).map((v) => v * 24) },
  ],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  drifters: true,
  wind: false,
};

function ground3(x, z) {
  const r = hyp(x, z);
  if (r > 45) return null;
  let h = 0;
  if (r >= 12 && r <= 24 && z > 0) h = 3;
  if (r <= 8) h = 6;
  for (const a of [30, 150]) {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    const t = x * c + z * s; // khoảng cách dọc bán kính
    const perp = -x * s + z * c;
    if (t >= 24 && t <= 30 && Math.abs(perp) <= 1.5) h = Math.max(h, (3 * (30 - t)) / 6);
  }
  return h;
}

const N3 = {
  night: 3,
  name: 'Đảo Chuông',
  start: [0, 0, -30], // B5
  centers: [[0, 0, 0]],
  ground: ground3,
  tower: { x: 0, z: 0, r: 2, top: 14 }, // tầng 2 (Y=6) + tháp cao 8 m
  lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  moteSpawns: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadeSpawns: ring(43, 0, 22.5, 16),
  shadeEveryTicks: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, h: [0, -8] }],
  charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
  drifters: true,
  wind: true,
};

export const NIGHTS = { 1: N1, 2: N2, 3: N3 };

export function durationFor(tuning, night) {
  return tuning[`night${night}_duration_s`] ?? [300, 330, 360][night - 1];
}
