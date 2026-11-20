// Chạy kiểm chứng và lưu bằng chứng: node scripts/verify.mjs [--phase 2]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pi = process.argv.indexOf('--phase');
const phase = pi > 0 ? process.argv[pi + 1] : '2';
const proof = join(root, 'docs', 'proof', `phase-${phase}`);
const tmp = join(root, 'out', 'verify');
mkdirSync(proof, { recursive: true });
mkdirSync(tmp, { recursive: true });

const node = process.execPath;
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim() || 'unknown';
const cpu = os.cpus()[0]?.model || 'cpu?';
const header = `# commit ${commit} · node ${process.version} · ${os.platform()} ${os.arch()} · ${cpu} · ${new Date().toISOString()}\n`;
const headless = (args) => spawnSync(node, ['src/headless.js', ...args], { cwd: root, encoding: 'utf8' });

// 1. Test
const t = spawnSync(node, ['--test', 'tests/'], { cwd: root, encoding: 'utf8' });
writeFileSync(join(proof, 'test-output.txt'), header + t.stdout + t.stderr);
const summary = (t.stdout.match(/^# (tests|pass|fail) \d+/gm) || []).join(', ');

// 2. Tất định cho cả 3 Đêm
const inputs = join(tmp, 'inputs.json');
writeFileSync(inputs, JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0], cam_yaw_deg: 45, dash: true }, { tick: 900, pulse: true }] }));
let det = `${header}lệnh: node src/headless.js --seed 42 --night N --inputs out/verify/inputs.json --ticks 3000 --out <f>\n`;
let detOk = true;
for (const n of [1, 2, 3]) {
  const a = join(tmp, `n${n}-a.jsonl`), b = join(tmp, `n${n}-b.jsonl`);
  headless(['--seed', '42', '--night', String(n), '--inputs', inputs, '--ticks', '3000', '--out', a]);
  headless(['--seed', '42', '--night', String(n), '--inputs', inputs, '--ticks', '3000', '--out', b]);
  const ha = sha(a), hb = sha(b);
  detOk &&= ha === hb;
  det += `Đêm ${n}: ${ha} / ${hb} → ${ha === hb ? 'GIỐNG HỆT' : 'KHÁC NHAU'}\n`;
}
writeFileSync(join(proof, 'determinism.txt'), det);

// 3. Hiệu năng headless: mỗi Đêm chạy đủ 21.600 tick (flames 99 để không kết thúc sớm)
const sc = join(tmp, 'perf-scenario.json');
writeFileSync(sc, JSON.stringify({ player: { flames: 99 } }));
const pin = join(tmp, 'perf-inputs.json');
writeFileSync(pin, JSON.stringify({ frames: [{ tick: 0, move: [1, 0.2] }, { tick: 5000, move: [-0.5, -1], dash: true }, { tick: 5001, dash: false }, { tick: 12000, move: [0, 0] }] }));
let perf = `${header}Yêu cầu: một Đêm đầy đủ (21.600 tick) ≤ 30 s\n`;
let perfOk = true;
for (const n of [1, 2, 3]) {
  const out = join(tmp, `perf-n${n}.jsonl`);
  const t0 = performance.now();
  headless(['--seed', '1', '--night', String(n), '--scenario', sc, '--inputs', pin, '--ticks', '21600', '--out', out]);
  const ms = performance.now() - t0;
  const end = readFileSync(out, 'utf8').trim().split('\n').pop();
  perfOk &&= ms <= 30000;
  perf += `Đêm ${n}: ${ms.toFixed(0)} ms · ${end}\n`;
}
writeFileSync(join(proof, 'perf-headless.txt'), perf);

// 4. Một lần chạy mẫu mỗi Đêm (màn mặc định, người chơi đứng yên)
for (const n of [1, 2, 3]) headless(['--seed', '7', '--night', String(n), '--ticks', '3600', '--snapshot-every', '60', '--out', join(proof, `sample-n${n}.jsonl`)]);

console.log(`test: ${summary} (exit ${t.status})`);
console.log(`tất định 3 Đêm: ${detOk ? 'OK' : 'FAIL'}`);
console.log(perf.split('\n').slice(1).join('\n'));
process.exit(t.status === 0 && detOk && perfOk ? 0 : 1);
