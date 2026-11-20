// Chạy CLI headless thật (end-to-end) với scenario/inputs ghi ra out/scenarios/<name>/.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
export const T = contract.tuning;

/** Scenario "sạch": không sinh ngẫu nhiên, không Bóng Mực, không đom đóm. */
export function clean(extra = {}) {
  return { random_motes: false, random_shades: false, motes: [], shades: [], ...extra };
}

export function runHeadless(name, { scenario, inputs, rawInputs, ticks = 60, seed = 1, every = 10 } = {}) {
  const dir = join(root, 'out', 'scenarios', name);
  mkdirSync(dir, { recursive: true });
  const args = ['src/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--snapshot-every', String(every)];
  if (scenario) {
    writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario, null, 2));
    args.push('--scenario', join(dir, 'scenario.json'));
  }
  if (inputs || rawInputs !== undefined) {
    writeFileSync(join(dir, 'inputs.json'), rawInputs !== undefined ? rawInputs : JSON.stringify(inputs, null, 2));
    args.push('--inputs', join(dir, 'inputs.json'));
  }
  const outFile = join(dir, 'out.jsonl');
  args.push('--out', outFile);
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  let lines = [];
  if (r.status === 0) {
    const text = readFileSync(outFile, 'utf8');
    lines = text.trim().split('\n').map((l) => JSON.parse(l));
    return { code: r.status, stderr: r.stderr, text, lines, ...index(lines) };
  }
  return { code: r.status, stderr: r.stderr, lines };
}

function index(lines) {
  const snaps = lines.filter((l) => l.type === 'snapshot');
  const events = lines.filter((l) => l.type === 'event');
  return {
    snaps,
    events,
    end: lines[lines.length - 1],
    snapAt: (t) => snaps.find((s) => s.tick === t),
    ev: (name) => events.filter((e) => e.name === name),
  };
}
