// Scenario headless cho Ticket-03 (Contract v1.2): nhiên liệu đèn, drain, luật thắng bình minh, sức chứa, điểm.
// Giá trị mong đợi tính tay từ TICKET-03. Lưu ý thứ tự tick: dầu bị trừ ở bước 2, TRƯỚC bước tương tác.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, clean, T } from './helpers.js';

const hold = (frames) => ({ frames });
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;
const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const L = (id, extra) => ({ id, ...extra });
const far = { pos: [0, 0, -30] }; // Mây ở xa để Bóng Mực không chase

test('tuning v1.2: khóa mới và thời lượng Đêm 240/270/300', () => {
  const want = { fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
});

test('dầu: đèn đặt lit không có fuel → 100, ever_lit; hao 1/giây', () => {
  const r = runHeadless('fuel-decay', { scenario: clean({ player: far, lanterns: [L('L1', { lit: true })] }), ticks: 600, every: 600 });
  const l0 = r.snapAt(0).lanterns[0];
  assert.deepEqual([l0.fuel, l0.ever_lit, l0.relit_count], [100, true, 0]);
  assert.equal(r.snapAt(600).lanterns[0].fuel, 90);
  assert.equal(r.snapAt(0).lanterns[1].fuel, 0); // đèn tắt có fuel 0
});

test('dầu: hết dầu → lantern_out, tắt, deposited 0, vẫn nhớ ever_lit', () => {
  const r = runHeadless('fuel-out', { scenario: clean({ player: far, lanterns: [L('L1', { lit: true, fuel: 1 })] }), ticks: 70, every: 1 });
  assert.deepEqual(r.ev('lantern_out').map((e) => [e.tick, e.data]), [[60, { lantern_id: 'L1' }]]);
  const l = r.snapAt(60).lanterns[0];
  assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
  assert.equal(r.snapAt(59).lanterns[0].lit, true);
});

test('châm dầu: used = min(mang, ceil((100 − fuel)/10)), +5 mỗi đom đóm, event refuel', () => {
  // fuel 20 → sau bước 2 còn 19.983 → cần ceil(8.0017) = 9, mang 3 → used 3 → 49.983 → xuất 50.0
  const r = runHeadless('refuel', {
    scenario: clean({ player: { carried: 3 }, lanterns: [L('L1', { pos: [0, 0, 1.5], lit: true, fuel: 20 })] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 3, every: 1,
  });
  assert.deepEqual(r.ev('refuel'), [{ type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 3, fuel: 50 } }]);
  assert.equal(r.ev('deposit').length, 0);
  assert.equal(r.end.score, 3 * T.score.per_mote);
  assert.equal(r.snapAt(1).player.carried, 0);
});

test('châm dầu: không vượt 100; đèn gần đầy vẫn tốn 1 đom đóm', () => {
  const r = runHeadless('refuel-cap', {
    scenario: clean({ player: { carried: 10 }, lanterns: [L('L1', { pos: [0, 0, 1.5], lit: true, fuel: 55 })] }),
    inputs: hold([{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true }]), ticks: 4, every: 1,
  });
  const ev = r.ev('refuel');
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 }); // ceil(45.017/10) = 5
  assert.deepEqual(ev[1].data, { lantern_id: 'L1', amount: 1, fuel: 100 }); // 99.97 → ceil(0.003) = 1
  assert.equal(r.snapAt(3).player.carried, 4);
});

test('thắp lần đầu: 10 đom đóm, +100, relight false; thắp lại: 5 đom đóm, +40, relight true, relit_count', () => {
  const first = runHeadless('light-first', {
    scenario: clean({ player: { carried: 10 }, lanterns: [L('L1', { pos: [0, 0, 1.5] })] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 2, every: 1,
  });
  assert.deepEqual(first.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(first.end.score, 10 * 5 + 100);
  assert.equal(first.snapAt(2).lanterns[0].fuel, 100); // 100 − 1/60 = 99.983 → xuất 100.0
  const re = runHeadless('light-relight', {
    scenario: clean({ player: { carried: 5 }, lanterns: [L('L1', { pos: [0, 0, 1.5], ever_lit: true })] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 2, every: 1,
  });
  assert.deepEqual(re.ev('deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(re.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(re.end.score, 5 * 5 + 40);
  const l = re.snapAt(1).lanterns[0];
  assert.deepEqual([l.lit, l.fuel, l.relit_count], [true, 100, 1]);
});

test('sức chứa = 10 + 2 × successful_lights, tối đa 20; tăng khi thắp', () => {
  const cap = (n) => runHeadless(`cap-${n}`, { scenario: clean({ player: { successful_lights: n } }), ticks: 0 }).snapAt(0).player.capacity;
  assert.equal(cap(0), 10);
  assert.equal(cap(3), 16);
  assert.equal(cap(7), 20);
  const r = runHeadless('cap-grow', {
    scenario: clean({ player: { carried: 10 }, lanterns: [L('L1', { pos: [0, 0, 1.5] })], motes: [[0, 0, 0.5]] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 3, every: 1,
  });
  assert.equal(r.snapAt(1).player.capacity, 12);
  const pick = runHeadless('cap-pickup', { scenario: clean({ player: { carried: 12, successful_lights: 2 }, motes: [[0, 0, 0.5]] }), ticks: 2 });
  assert.deepEqual(pick.ev('mote_picked')[0].data, { carried: 13 });
});

test('drain: bóng wander cách đèn yếu ≤ 2 m thì drain, hút 5/s + hao 1/s, fuel_drain mỗi 60 tick, đèn tắt thì về wander', () => {
  const r = runHeadless('drain-basic', {
    scenario: clean({ player: far, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 12] }] }),
    ticks: 220, every: 1,
  });
  assert.equal(r.snapAt(1).shades[0].state, 'drain');
  // bước 0: chỉ hao (1199); bước 1..60: −6 mỗi tick → 839 → 13.98 → 14.0
  assert.deepEqual(r.ev('fuel_drain')[0], { type: 'event', tick: 61, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 14 } });
  assert.equal(r.snapAt(61).lanterns[0].fuel, 14);
  assert.equal(r.ev('lantern_out')[0].tick, 201); // ceil(1199 / 6) = 200 bước hút
  assert.equal(r.snapAt(202).shades[0].state, 'wander');
});

test('drain: nhiều con cộng dồn', () => {
  const r = runHeadless('drain-stack', {
    scenario: clean({ player: far, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 12] }, { id: 'S2', pos: [2, 1, 10] }] }),
    ticks: 61, every: 61,
  });
  assert.equal(r.snapAt(61).lanterns[0].fuel, Math.round((1199 - 60 * 11) / 6) / 10); // 9.0
});

test('drain: bóng wander ở xa đi tới đèn sáng có fuel < 30 gần nhất', () => {
  const r = runHeadless('drain-seek', {
    scenario: clean({ player: far, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel: 25 }), L('L2', { lit: true })], shades: [{ id: 'S1', pos: [0, 1, 20] }] }),
    ticks: 140, every: 10,
  });
  assert.equal(r.snapAt(140).shades[0].state, 'drain');
  assert.ok(xz(r.snapAt(140).shades[0].pos, [0, 0, 10]) <= 2 + 1e-3);
});

test('drain → chase chỉ khi Mây vào trong 6 m (không phải 12 m)', () => {
  const r = runHeadless('drain-chase', {
    scenario: clean({ player: { pos: [0, 0, 2] }, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 12], state: 'drain', target_lantern_id: 'L1' }] }),
    inputs: hold([{ tick: 30, move: [0, 1] }]), ticks: 120, every: 1,
  });
  assert.equal(r.snapAt(30).shades[0].state, 'drain'); // cách 10 m: vẫn drain
  const t = r.snaps.find((s) => s.shades[0].state === 'chase').tick;
  const p = r.snapAt(t - 1).player.pos;
  assert.ok(xz(p, [0, 0, 12]) <= 6 + 0.11, `chase ở tick ${t}`);
});

test('châm dầu lên ≥ 30: bóng trong 6 m bị đẩy ra mép trong 30 tick, không gây hit', () => {
  const r = runHeadless('drain-evict', {
    scenario: clean({ player: { carried: 3 }, lanterns: [L('L1', { pos: [0, 0, 1.5], lit: true, fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 3.4], state: 'drain', target_lantern_id: 'L1' }] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 90, every: 1,
  });
  // bóng drain từ đầu scenario nên bước 0 trừ 1 + 5: 1200 − 6 + 3×600 = 2994 → 49.9
  assert.equal(r.ev('refuel')[0].data.fuel, 49.9);
  assert.equal(r.snapAt(1).shades[0].state, 'recoil');
  assert.ok(near(xz(r.snapAt(30).shades[0].pos, [0, 0, 1.5]), 6, 0.01));
  assert.equal(r.ev('player_hit').length, 0);
});

test('tỏa sáng trúng bóng đang drain: +15 (con thường +5); hết choáng không còn drain', () => {
  const r = runHeadless('drain-pulse', {
    scenario: clean({ player: { pos: [0, 0, 8.5], carried: 3 }, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel: 20 })], shades: [{ id: 'S1', pos: [0, 1, 12], state: 'drain', target_lantern_id: 'L1' }] }),
    inputs: hold([{ tick: 0, pulse: true }]), ticks: 10,
  });
  assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['S1']);
  assert.equal(r.end.score, T.score.per_stun_drain);
  assert.equal(r.snapAt(10).shades[0].state, 'stunned');
});

test('vùng an toàn mất khi fuel < 30: bóng vào được và đánh trúng; fuel ≥ 30 thì bị chặn', () => {
  const sc = (fuel) => clean({ player: { pos: [0, 0, 11.5] }, lanterns: [L('L1', { pos: [0, 0, 10], lit: true, fuel })], shades: [{ id: 'S1', pos: [0, 1, 0], state: 'chase' }] });
  const weak = runHeadless('zone-weak', { scenario: sc(29), ticks: 300 });
  assert.ok(weak.ev('player_hit').length >= 1);
  const strong = runHeadless('zone-strong', { scenario: sc(40), ticks: 300, every: 1 });
  assert.equal(strong.ev('player_hit').length, 0);
  for (const s of strong.snaps) assert.ok(xz(s.shades[0].pos, [0, 0, 10]) >= 6 - 1e-3);
});

test('không còn thắng sớm: thắp đủ đèn, Đêm vẫn tiếp tục', () => {
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => L(id, { lit: true }));
  const r = runHeadless('no-early-win', { scenario: clean({ player: far, lanterns: all }), ticks: 120 });
  assert.equal(r.ev('game_over').length, 0);
  assert.equal(r.end.state, 'playing');
});

test('bình minh: ≥ ceil(0.6 × 5) = 3 đèn sáng → won/dawn_survived, điểm 50 + floor(fuel) mỗi đèn + 50 mỗi lửa', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => L(id, { lit: true }));
  const r = runHeadless('dawn-win', { scenario: clean({ player: far, time_left_s: 1, lanterns: lit3 }), ticks: 100 });
  assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data]), [[60, { result: 'won', reason: 'dawn_survived' }]]);
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 3 * 50 });
  const lit2 = ['L1', 'L2'].map((id) => L(id, { lit: true }));
  const lose = runHeadless('dawn-lose', { scenario: clean({ player: far, time_left_s: 1, lanterns: lit2 }), ticks: 100 });
  assert.deepEqual(lose.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
  assert.equal(lose.ev('game_over')[0].data.reason, 'dawn');
});

test('bình minh: ngưỡng Đêm 2 = 4/6, Đêm 3 = 5/7', () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => L(`L${i + 1}`, { lit: true }));
  const res = (night, n, pos) => runHeadless(`dawn-n${night}-${n}`, { night, scenario: clean({ player: { pos }, time_left_s: 0.5, lanterns: ids(n) }), ticks: 40 }).end.state;
  assert.equal(res(2, 4, [0, 0, -5]), 'won');
  assert.equal(res(2, 3, [0, 0, -5]), 'lost');
  assert.equal(res(3, 5, [0, 0, -30]), 'won');
  assert.equal(res(3, 4, [0, 0, -30]), 'lost');
});

test('hết lửa ở đúng tick bình minh: luôn thua no_flames', () => {
  const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => L(id, { lit: true }));
  const r = runHeadless('dawn-no-flames', { scenario: clean({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: all, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }), ticks: 5 });
  assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data.reason]), [[1, 'no_flames']]);
});
