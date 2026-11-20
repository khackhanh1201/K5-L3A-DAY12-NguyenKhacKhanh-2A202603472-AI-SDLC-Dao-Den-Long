// Test Ticket-04 (Contract v1.3): cảnh bench, thống kê bench, soak, bảng xếp hạng, lệnh xuất.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root, contract, T } from './helpers.js';
import { createBenchGame, benchCamera, benchStats } from '../src/core/bench.js';
import { step, snapshot } from '../src/core/game.js';
import { validName, insertEntry, sortEntries, isoWithOffset } from '../src/core/leaderboard.js';

test('contract v1.3 có bench_cmd và soak_cmd', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.ok(contract.bench_cmd && contract.soak_cmd);
});

test('cảnh bench: 200 Bóng Mực wander trên đảo, 100 đom đóm, L1–L3 sáng fuel 100, Mây ở gốc', () => {
  const g = createBenchGame(T, 42);
  const s = snapshot(g);
  assert.equal(s.shades.length, 200);
  assert.ok(s.shades.every((x) => x.state === 'wander' && Math.hypot(x.pos[0], x.pos[2]) <= 38));
  assert.equal(s.motes.length, 100);
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => [l.id, l.lit, l.fuel]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100]]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  // cùng seed → cùng cảnh
  assert.deepEqual(snapshot(createBenchGame(T, 42)).shades, s.shades);
});

test('cảnh bench: không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc; bóng vẫn di chuyển', () => {
  const g = createBenchGame(T, 42);
  const before = snapshot(g).shades.map((x) => x.pos);
  const idle = { move: [0, 0], cam_yaw_deg: 0 };
  const events = [];
  for (let k = 0; k < 60 * 60 * 5; k++) events.push(...step(g, idle)); // 5 phút > thời lượng Đêm 1
  const s = snapshot(g);
  assert.deepEqual(events, []);
  assert.equal(s.state, 'playing');
  assert.equal(s.shades.length, 200);
  assert.equal(s.motes.length, 100);
  assert.equal(s.player.flames, T.flames);
  assert.deepEqual(s.lanterns.slice(0, 3).map((l) => l.fuel), [100, 100, 100]);
  assert.ok(s.shades.every((x) => x.state === 'wander'));
  const moved = s.shades.filter((x, i) => Math.hypot(x.pos[0] - before[i][0], x.pos[2] - before[i][2]) > 1).length;
  assert.ok(moved > 150, `chỉ ${moved} bóng di chuyển`);
});

test('camera bench: bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng', () => {
  const c0 = benchCamera(0), c1 = benchCamera(3.75), c2 = benchCamera(15);
  assert.deepEqual(c0.map((v) => +v.toFixed(6)), [30, 15, 0]);
  assert.ok(Math.abs(c1[0]) < 1e-9 && Math.abs(c1[2] - 30) < 1e-9); // 90°: (0,15,30) theo quy ước (r·cosθ, r·sinθ)
  assert.ok(Math.abs(c2[0] - 30) < 1e-9 && Math.abs(c2[2]) < 1e-9);
});

test('thống kê bench theo định nghĩa Ticket-04', () => {
  const dts = [...Array(98).fill(10), 40, 50]; // N = 100, k = 1
  const s = benchStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, +(1000 * 100 / (980 + 90)).toFixed(1));
  assert.equal(s.p1_low_fps, 20); // 1000 / 50
  assert.equal(s.frame_ms_p95, 10);
  const s2 = benchStats([...Array(150).fill(10), 30, 40]); // N = 152 → k = ceil(1.52) = 2 → trung bình 35
  assert.equal(s2.p1_low_fps, +(1000 / 35).toFixed(1));
});

test('soak: 3 Đêm, không crash, đủ trường, results theo số Đêm', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-soak-'));
  const out = join(dir, 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', 'scripts/soak.mjs', '--seed', '7', '--nights', '3', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(j.nights, 3);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 3);
  assert.ok(j.results.every((x) => ['won', 'lost'].includes(x)));
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof j[k], 'number');
});

test('bảng xếp hạng: tên 3–12 ký tự chữ/số/_ (có hỗ trợ tiếng Việt)', () => {
  for (const ok of ['Mây', 'abc', 'Player_01', 'NguyễnKhánh', 'a'.repeat(12)]) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'a'.repeat(13), 'có cách', 'x-y', '', 'a!b']) assert.ok(!validName(bad), bad);
});

test('bảng xếp hạng: điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ top 10', () => {
  let e = [];
  const add = (name, score, t) => (e = insertEntry(e, { name, score, nights_won: 1, achieved_at: t, seed: 1 }));
  add('BBB', 500, '2026-11-20T10:00:00+07:00');
  add('AAA', 500, '2026-11-20T09:00:00+07:00');
  add('CCC', 900, '2026-11-20T11:00:00+07:00');
  assert.deepEqual(e.map((x) => x.name), ['CCC', 'AAA', 'BBB']);
  for (let i = 0; i < 12; i++) add(`P${String(i).padStart(2, '0')}`, i, `2026-11-20T12:00:${String(i).padStart(2, '0')}+07:00`);
  assert.equal(e.length, 10);
  assert.equal(e[0].name, 'CCC');
  assert.equal(e[9].score, 5);
  assert.throws(() => insertEntry([], { name: 'x', score: 1, nights_won: 0, achieved_at: isoWithOffset(), seed: 1 }));
  assert.match(isoWithOffset(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.deepEqual(sortEntries([...e].reverse()), e);
});

test('lệnh xuất bảng xếp hạng: run_cmd --export-leaderboard out.json → {entries} đúng thứ tự', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-lb-'));
  writeFileSync(join(dir, 'leaderboard.json'), JSON.stringify({ entries: [
    { name: 'Low', score: 10, nights_won: 0, achieved_at: '2026-11-20T08:00:00+07:00', seed: 3 },
    { name: 'High', score: 990, nights_won: 3, achieved_at: '2026-11-20T09:00:00+07:00', seed: 4 },
  ] }));
  const out = join(dir, 'out.json');
  const r = spawnSync(process.execPath, ['scripts/run.mjs', '--export-leaderboard', out], { cwd: root, encoding: 'utf8', env: { ...process.env, DDL_DATA_DIR: dir } });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(j.entries.map((x) => x.name), ['High', 'Low']);
  assert.deepEqual(Object.keys(j.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});
