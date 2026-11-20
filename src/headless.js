#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0 (mục B, E).
// node src/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createGame, step, snapshot } from './core/game.js';
import { FormatError, validateInputs, validateScenario, createInputReader } from './core/inputs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg, code = 1) {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { snapshotEvery: 10, seed: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    const need = () => {
      if (v === undefined) fail(`thiếu giá trị cho ${k}`);
      i++;
      return v;
    };
    switch (k) {
      case '--seed': a.seed = Number(need()); break;
      case '--night': a.night = Number(need()); break;
      case '--scenario': a.scenario = need(); break;
      case '--inputs': a.inputs = need(); break;
      case '--ticks': a.ticks = Number(need()); break;
      case '--out': a.out = need(); break;
      case '--snapshot-every': a.snapshotEvery = Number(need()); break;
      default: fail(`tham số không hỗ trợ: ${k}`);
    }
  }
  if (!Number.isInteger(a.seed)) fail('--seed phải là số nguyên');
  if (a.night !== 1) fail('--night chỉ hỗ trợ 1 ở Phase 1');
  if (!Number.isInteger(a.ticks) || a.ticks < 0) fail('--ticks phải là số nguyên ≥ 0');
  if (!a.out) fail('thiếu --out');
  if (!Number.isInteger(a.snapshotEvery) || a.snapshotEvery < 1) fail('--snapshot-every phải là số nguyên ≥ 1');
  return a;
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`không đọc được ${label} "${path}": ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${label} không phải JSON hợp lệ: ${e.message}`);
  }
}

export function run(args) {
  const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  const scenario = args.scenario ? validateScenario(readJson(args.scenario, 'scenario')) : null;
  const inputs = args.inputs ? validateInputs(readJson(args.inputs, 'inputs')) : null;

  const g = createGame(contract.tuning, { seed: args.seed, scenario });
  const inputAt = createInputReader(inputs);
  const lines = [];
  const emitSnap = () => lines.push(JSON.stringify(snapshot(g)));

  emitSnap(); // tick 0: sau khi dựng scenario, trước input
  let lastSnap = 0;
  for (let k = 0; k < args.ticks && g.state === 'playing'; k++) {
    for (const ev of step(g, inputAt(k))) lines.push(JSON.stringify(ev));
    if (g.steps % args.snapshotEvery === 0) {
      emitSnap();
      lastSnap = g.steps;
    }
  }
  if (lastSnap !== g.steps) emitSnap(); // snapshot cuối tại tick dừng (giả định A7)
  lines.push(JSON.stringify({ type: 'end', ticks: g.steps, state: g.state, score: g.score }));
  writeFileSync(args.out, lines.join('\n') + '\n');
}

try {
  run(parseArgs(process.argv.slice(2)));
} catch (e) {
  if (e instanceof FormatError) fail(e.message, 2);
  fail(e.stack || String(e), 1);
}
