// Chạy kiểm chứng và lưu bằng chứng: node scripts/verify.mjs [--phase 1]
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pi = process.argv.indexOf('--phase');
const phase = pi > 0 ? process.argv[pi + 1] : '1';
const proof = join(root, 'docs', 'proof', `phase-${phase}`);
const tmp = join(root, 'out', 'verify');
mkdirSync(proof, { recursive: true });
mkdirSync(tmp, { recursive: true });

const node = process.execPath;
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim() || 'unknown';
const header = `# commit ${commit} · node ${process.version} · ${os.platform()} ${os.arch()} · ${new Date().toISOString()}\n`;

// 1. Test
const t = spawnSync(node, ['--test', 'tests/'], { cwd: root, encoding: 'utf8' });
writeFileSync(join(proof, 'test-output.txt'), header + t.stdout + t.stderr);
const summary = (t.stdout.match(/^# (tests|pass|fail) \d+/gm) || []).join(', ');

// 2. Tất định: seed 42, inputs mẫu, 3000 tick, chạy 2 lần
const inputs = join(tmp, 'inputs.json');
writeFileSync(inputs, JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0], cam_yaw_deg: 45 }, { tick: 900, pulse: true }] }));
const runOnce = (out) => spawnSync(node, ['src/headless.js', '--seed', '42', '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', out], { cwd: root });
runOnce(join(tmp, 'a.jsonl'));
runOnce(join(tmp, 'b.jsonl'));
const ha = sha(join(tmp, 'a.jsonl'));
const hb = sha(join(tmp, 'b.jsonl'));
writeFileSync(join(proof, 'determinism.txt'), `${header}lệnh: node src/headless.js --seed 42 --night 1 --inputs out/verify/inputs.json --ticks 3000 --out <f>\nlần 1 sha256: ${ha}\nlần 2 sha256: ${hb}\nkết quả: ${ha === hb ? 'GIỐNG HỆT' : 'KHÁC NHAU'}\n`);

// 3. Một lần chạy mẫu đầy đủ (màn mặc định, đứng yên tới khi thua)
const sample = join(proof, 'sample-run.jsonl');
const t0 = performance.now();
spawnSync(node, ['src/headless.js', '--seed', '7', '--night', '1', '--ticks', '18000', '--out', sample], { cwd: root });
const ms = (performance.now() - t0).toFixed(0);
const end = readFileSync(sample, 'utf8').trim().split('\n').pop();

console.log(`test: ${summary} (exit ${t.status})`);
console.log(`tất định: ${ha === hb ? 'OK' : 'FAIL'}`);
console.log(`sample-run: ${end} (${ms} ms)`);
process.exit(t.status === 0 && ha === hb ? 0 : 1);
