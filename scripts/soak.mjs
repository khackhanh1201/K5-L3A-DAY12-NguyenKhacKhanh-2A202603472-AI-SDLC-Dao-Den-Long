// Soak test Ticket-04: node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json
// 10 Đêm liên tiếp trong 1 tiến trình (1 → 2 → 3 xoay vòng), Đêm i dùng seed + i, input ngẫu nhiên theo seed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step } from '../src/core/game.js';
import { createRng } from '../src/core/rng.js';
import { durationFor } from '../src/core/level.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seed = parseInt(arg('--seed', '7'), 10);
const nights = parseInt(arg('--nights', '10'), 10);
const out = arg('--out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('soak: --seed và --nights phải là số nguyên (nights ≥ 1)\n');
  process.exit(1);
}
const T = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8')).tuning;
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const rssMb = () => +(process.memoryUsage().rss / 1048576).toFixed(1);

/** Input ngẫu nhiên: đổi hướng mỗi 30 tick; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác. */
function randomInput(rng) {
  let move = [0, 0];
  return (k) => {
    if (k % 30 === 0) {
      const a = rng() * 2 * Math.PI;
      move = [Math.cos(a), Math.sin(a)];
    }
    return { move, cam_yaw_deg: 0, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false };
  };
}

// Khởi động JIT (là một phần của "tải" engine): chạy nháp 1 Đêm mỗi loại với seed khác rồi bỏ đi,
// để mem_start không bị đo lúc V8 chưa biên dịch code (xem docs/proof/phase-4/README.md).
const warm = !process.argv.includes('--no-warmup');
if (warm) {
  for (const night of [1, 2, 3]) {
    let w = createGame(T, { seed: 999 + night, night });
    const inp = randomInput(createRng(4242 + night));
    for (let k = 0; k < 3600 && w.state === 'playing'; k++) step(w, inp(k));
    w = null;
  }
}
const t0 = performance.now();
const results = [];
let crashes = 0;
let memStart = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const s = seed + i;
  try {
    let g = createGame(T, { seed: s, night });
    if (i === 0) { gc(); memStart = rssMb(); } // sau khi tải xong Đêm đầu tiên
    const input = randomInput(createRng((s * 7919) ^ 0x5bd1e995));
    const maxTicks = Math.ceil(durationFor(T, night) * 60) + 600;
    for (let k = 0; k < maxTicks && g.state === 'playing'; k++) step(g, input(k));
    results.push(g.state);
    g = null; // reset Đêm: bỏ toàn bộ state
  } catch (e) {
    crashes++;
    results.push('crash');
    process.stderr.write(`soak: Đêm ${i + 1} (night ${night}, seed ${s}) lỗi: ${e.stack || e}\n`);
  }
}
gc();
const memEnd = rssMb(); // sau khi reset xong Đêm cuối
const report = { nights, crashes, warmup: warm, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: +((performance.now() - t0) / 1000).toFixed(1) };
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);
