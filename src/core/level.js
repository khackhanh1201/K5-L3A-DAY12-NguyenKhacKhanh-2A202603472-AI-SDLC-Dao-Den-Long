// Hằng số của màn Đêm 1 – Đảo Bến không nằm trong tuning của contract.
// Xem docs/notes/assumptions.md.
export const TICK_RATE = 60;
export const EPS = 1e-6; // dung sai so sánh "khoảng cách ≤ r"

export const NIGHT1 = {
  islandRadius: 40,
  lanternRing: 25, // đèn đặt trên vòng tròn bán kính 25, L1 ở (0,0,25)
  motes: { initial: 40, max: 40, respawnEveryS: 5, spawnMaxR: 37, spawnMinR: 3 },
  shades: { firstAtS: 5, everyS: 15, max: 4, spawnR: 38, minPlayerDist: 12, y: 1.0 },
  jump: { velocity: 7, gravity: 20 },
};

export function defaultLanterns(count = 5) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push({
      id: `L${i + 1}`,
      pos: [round3(NIGHT1.lanternRing * Math.sin(a)), 0, round3(NIGHT1.lanternRing * Math.cos(a))],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

export function round3(x) {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}
