// Scenario headless end-to-end cho Test Contract v1.0.
// Giá trị mong đợi tính TAY từ PRD-0 + tuning trong game.contract.json, KHÔNG copy từ output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, clean, T } from './helpers.js';

const STEP = T.player_speed / 60; // mét mỗi tick
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

test('format: snapshot tick 0 trước input, mỗi 10 tick, dòng cuối là end', () => {
  const r = runHeadless('format', { scenario: clean(), inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 60 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60]);
  assert.deepEqual(r.snapAt(0).player.pos, [0, 0, 0]);
  assert.ok(near(r.snapAt(10).player.pos[2], 10 * STEP));
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'playing', score: 0 });
  for (const s of r.snaps) assert.equal(s.sim_tick, s.tick);
});

test('màn mặc định: 5 đèn L1..L5, L1 tại (0,0,25), giá trị đầu từ tuning', () => {
  const r = runHeadless('default-level', { ticks: 0 });
  const s0 = r.snapAt(0);
  assert.deepEqual(s0.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.equal(s0.lanterns.length, T.lantern_count_night1);
  assert.deepEqual(s0.lanterns[0].pos, [0, 0, 25]);
  assert.equal(s0.player.flames, T.flames);
  assert.equal(s0.time_left_s, T.night1_duration_s);
  assert.ok(s0.motes_active > 0);
  assert.equal(r.end.ticks, 0);
});

test('di chuyển: move [0,1] trong 60 tick đi đúng player_speed mét theo +Z', () => {
  const r = runHeadless('move-forward', { scenario: clean(), inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 60 });
  const p = r.snapAt(60).player.pos;
  assert.ok(near(p[0], 0) && near(p[2], T.player_speed), JSON.stringify(p));
  assert.ok(near(r.snapAt(60).time_left_s, T.night1_duration_s - 1));
});

test('di chuyển: cam_yaw_deg 90 biến move [0,1] thành +X', () => {
  const r = runHeadless('move-yaw90', { scenario: clean(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] }, ticks: 60 });
  const p = r.snapAt(60).player.pos;
  assert.ok(near(p[0], T.player_speed) && near(p[2], 0), JSON.stringify(p));
});

test('di chuyển: vector [1,1] được chuẩn hóa về độ dài 1', () => {
  const r = runHeadless('move-diagonal', { scenario: clean(), inputs: { frames: [{ tick: 0, move: [1, 1] }] }, ticks: 60 });
  const p = r.snapAt(60).player.pos;
  const d = T.player_speed / Math.SQRT2;
  assert.ok(near(p[0], d) && near(p[2], d), JSON.stringify(p));
});

test('nhặt đom đóm: mote ở (0,0,5) được nhặt khi khoảng cách ≤ pickup_radius', () => {
  const r = runHeadless('pickup', {
    scenario: clean({ motes: [[0, 0, 5]] }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    ticks: 60,
  });
  const expectedTick = Math.ceil((5 - T.pickup_radius) / STEP - 1e-9);
  assert.deepEqual(r.ev('mote_picked'), [{ type: 'event', tick: expectedTick, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(r.end.score, T.score.per_mote);
  assert.equal(r.snapAt(60).motes_active, 0);
});

test('sức chứa: đang mang carry_capacity thì không nhặt thêm', () => {
  const r = runHeadless('capacity', { scenario: clean({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }), ticks: 10 });
  assert.equal(r.ev('mote_picked').length, 0);
  assert.equal(r.snapAt(10).player.carried, T.carry_capacity);
  assert.equal(r.snapAt(10).motes_active, 1);
});

test('nạp đèn: đủ lantern_cost thì deposit + lantern_lit, cộng per_lantern', () => {
  const r = runHeadless('deposit-lit', {
    scenario: clean({ player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] },
    ticks: 10,
  });
  assert.deepEqual(r.ev('deposit'), [{ type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost } }]);
  assert.deepEqual(r.ev('lantern_lit').map((e) => [e.tick, e.data.lantern_id]), [[1, 'L1']]);
  assert.equal(r.end.score, T.score.per_lantern);
  assert.equal(r.snapAt(10).player.carried, 0);
  assert.equal(r.snapAt(10).lanterns[0].lit, true);
});

test('nạp đèn: mang ít hơn cost thì nạp một phần, chưa thắp', () => {
  const r = runHeadless('deposit-partial', {
    scenario: clean({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    ticks: 10,
  });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: 2 });
  assert.equal(r.ev('lantern_lit').length, 0);
});

test('nạp đèn: ngoài interact_radius thì không có gì', () => {
  const r = runHeadless('deposit-out-of-range', {
    scenario: clean({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.5] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    ticks: 5,
  });
  assert.equal(r.ev('deposit').length, 0);
});

test('nút chỉ kích hoạt ở cạnh false→true (giữ interact không nạp lặp)', () => {
  const r = runHeadless('edge-trigger', {
    scenario: clean({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    ticks: 30,
  });
  assert.equal(r.ev('deposit').length, 1);
});

test('tỏa sáng: stun Bóng Mực trong pulse_radius, đẩy pulse_push_m, tốn pulse_cost', () => {
  const r = runHeadless('pulse-stun', {
    scenario: clean({ player: { carried: T.pulse_cost }, shades: [{ id: 'S1', pos: [4, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    ticks: 200,
  });
  assert.deepEqual(r.ev('pulse'), [{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }]);
  assert.equal(r.snapAt(10).player.carried, 0);
  assert.equal(r.end.score, T.score.per_stun);
  const stunTicks = T.pulse_stun_s * 60;
  const during = r.snapAt(stunTicks - 10).shades[0];
  assert.equal(during.state, 'stunned');
  assert.ok(near(during.pos[0], 4 + T.pulse_push_m), JSON.stringify(during));
  const after = r.snapAt(stunTicks + 10).shades[0];
  assert.notEqual(after.state, 'stunned');
  assert.ok(after.pos[0] < 4 + T.pulse_push_m);
});

test('tỏa sáng: không đủ ánh sáng thì không có pulse', () => {
  const r = runHeadless('pulse-no-light', {
    scenario: clean({ player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [4, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
    ticks: 5,
  });
  assert.equal(r.ev('pulse').length, 0);
});

test('tỏa sáng: tôn trọng pulse_cooldown_s', () => {
  const cd = T.pulse_cooldown_s * 60;
  const r = runHeadless('pulse-cooldown', {
    scenario: clean({ player: { carried: T.pulse_cost * 3 } }),
    inputs: {
      frames: [
        { tick: 0, pulse: true }, { tick: 1, pulse: false },
        { tick: cd - 30, pulse: true }, { tick: cd - 29, pulse: false },
        { tick: cd + 10, pulse: true }, { tick: cd + 11, pulse: false },
      ],
    },
    ticks: cd + 20,
  });
  assert.deepEqual(r.ev('pulse').map((e) => e.tick), [1, cd + 11]);
});

test('bị chạm: mất 1 flame, rơi floor(carried*hit_drop_ratio), bất tử invuln_s', () => {
  const inv = T.invuln_s * 60;
  const r = runHeadless('hit-invuln', {
    scenario: clean({ player: { carried: 4 }, shades: [{ pos: [0.5, 1, 0] }] }),
    ticks: inv + 10,
  });
  const hits = r.ev('player_hit');
  const d1 = Math.floor(4 * T.hit_drop_ratio);
  const d2 = Math.floor((4 - d1) * T.hit_drop_ratio);
  assert.deepEqual(hits.map((h) => [h.tick, h.data]), [
    [1, { by: 'shade', flames: T.flames - 1, dropped: d1 }],
    [1 + inv, { by: 'shade', flames: T.flames - 2, dropped: d2 }],
  ]);
});

test('thua: hết flame -> game_over lost/no_flames, dừng ngay', () => {
  const r = runHeadless('lose-no-flames', { scenario: clean({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }), ticks: 100 });
  assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data]), [[1, { result: 'lost', reason: 'no_flames' }]]);
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  assert.equal(r.snapAt(1).state, 'lost');
});

test('thua: hết giờ -> lost/dawn đúng tick time_left_s*60', () => {
  const r = runHeadless('lose-dawn', { scenario: clean({ time_left_s: 1 }), ticks: 200 });
  assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data.reason]), [[60, 'dawn']]);
  assert.equal(r.end.ticks, 60);
  assert.equal(r.end.state, 'lost');
});

test('thắng: thắp đèn cuối -> won/all_lit, cộng thưởng giây và flame còn lại', () => {
  const r = runHeadless('win', {
    scenario: clean({
      player: { carried: 1 },
      lanterns: [
        { id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true },
        { id: 'L5', pos: [0, 0, 2], deposited: T.lantern_cost - 1 },
      ],
    }),
    inputs: { frames: [{ tick: 0, interact: true }] },
    ticks: 100,
  });
  assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data]), [[1, { result: 'won', reason: 'all_lit' }]]);
  const expected = T.score.per_lantern
    + Math.floor(T.night1_duration_s - 1 / 60) * T.score.per_second_left
    + T.flames * T.score.per_flame_left;
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: expected });
});

test('dựng scenario không cộng điểm: đèn đặt sẵn lit không tính per_lantern', () => {
  const r = runHeadless('scenario-no-score', { scenario: clean({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 1 });
  assert.equal(r.snapAt(0).score, 0);
  assert.equal(r.events.length, 0);
});

test('vùng an toàn: Bóng Mực không vào safe_radius của đèn đã thắp', () => {
  const r = runHeadless('safe-zone', {
    scenario: clean({ player: { pos: [0, 0, 11.5] }, lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true }], shades: [{ pos: [0, 1, 0] }] }),
    ticks: 300,
    every: 1,
  });
  for (const s of r.snaps) {
    const sh = s.shades[0];
    assert.ok(Math.hypot(sh.pos[0], sh.pos[2] - 10) >= T.safe_radius - 1e-3, `tick ${s.tick}: ${sh.pos}`);
  }
  assert.equal(r.ev('player_hit').length, 0);
});

test('input sai định dạng -> mã thoát 2', () => {
  const dup = runHeadless('bad-input-ticks', { inputs: { frames: [{ tick: 5 }, { tick: 5 }] } });
  assert.equal(dup.code, 2);
  assert.match(dup.stderr, /tăng nghiêm ngặt/);
  const json = runHeadless('bad-input-json', { rawInputs: '{ not json' });
  assert.equal(json.code, 2);
  const range = runHeadless('bad-input-range', { inputs: { frames: [{ tick: 0, move: [2, 0] }] } });
  assert.equal(range.code, 2);
});

test('tất định: cùng seed + input cho output giống hệt, kể cả id tự sinh', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1] }, { tick: 400, move: [-1, 0], cam_yaw_deg: 45 }, { tick: 900, pulse: true }] };
  const a = runHeadless('determinism-a', { seed: 42, inputs, ticks: 3000 });
  const b = runHeadless('determinism-b', { seed: 42, inputs, ticks: 3000 });
  assert.equal(a.text, b.text);
  assert.ok(a.ev('shade_spawned').length > 0);
  const c = runHeadless('determinism-c', { seed: 7, inputs, ticks: 3000 });
  assert.notEqual(a.text, c.text);
});
