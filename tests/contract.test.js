// Scenario headless end-to-end cho Test Contract v1.1 (Ticket-02).
// Giá trị mong đợi tính TAY từ spec (TICKET-02 + PRD-0) và tuning, KHÔNG copy từ output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, clean, T } from './helpers.js';

const STEP = T.player_speed / 60;
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;
const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const hold = (frames) => ({ frames });

// ---------- Định dạng v1.1 ----------
test('format v1.1: snapshot tick 0, night_start, trường mới, dòng cuối end', () => {
  const r = runHeadless('format', { scenario: clean(), inputs: hold([{ tick: 0, move: [0, 1] }]), ticks: 60 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60]);
  assert.deepEqual(r.lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  const s = r.snapAt(0);
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms', 'sim_tick']) assert.ok(k in s, k);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
  assert.ok(near(r.snapAt(60).player.pos[2], T.player_speed));
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'playing', score: 0 });
});

// Phase 3: thời lượng Đêm và khóa score đổi theo Ticket-03 (thay thế số của Ticket-02)
test('tuning khớp số chuẩn (Ticket-02, cập nhật Ticket-03)', () => {
  const want = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, pulse_cooldown_s: 3, pulse_push_m: 4, safe_radius: 6, shade_speed: 4,
    shade_hit_radius: 1, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, fall_enabled: true,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lantern_at_dawn: 50, per_second_left: 0, per_flame_left: 50 });
});

// ---------- Bản đồ chuẩn ----------
test('Đêm 1 mặc định: đèn chuẩn, 20 đom đóm tại 20 điểm khác nhau trên r=12/33', () => {
  const s = runHeadless('n1-default', { ticks: 0 }).snapAt(0);
  assert.deepEqual(s.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 25]], ['L2', [23.8, 0, 7.7]], ['L3', [14.7, 0, -20.2]], ['L4', [-14.7, 0, -20.2]], ['L5', [-23.8, 0, 7.7]],
  ]);
  assert.equal(s.motes.length, 20);
  assert.equal(new Set(s.motes.map((m) => m.pos.join())).size, 20);
  for (const m of s.motes) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(near(r, 12, 0.01) || near(r, 33, 0.01), String(r));
    assert.equal(m.kind, 'random');
    assert.equal(m.ttl_s, null);
  }
  assert.equal(s.time_left_s, 240); // Ticket-03: 300 → 240
  assert.equal(s.player.flames, 3);
});

test('Đêm 2 và 3 mặc định: đèn, bùa, thời gian, điểm xuất phát', () => {
  const n2 = runHeadless('n2-default', { night: 2, ticks: 0 }).snapAt(0);
  assert.deepEqual(n2.lanterns.map((l) => l.pos), [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
  assert.deepEqual(n2.charms, [{ id: 'C1', pos: [35, 0, 0], available: true, respawn_s: 0 }]);
  assert.equal(n2.time_left_s, 270); // Ticket-03: 330 → 270
  assert.equal(n2.night, 2);
  const n3 = runHeadless('n3-default', { night: 3, ticks: 0 }).snapAt(0);
  assert.deepEqual(n3.lanterns.map((l) => l.pos), [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
  assert.deepEqual(n3.charms.map((c) => c.pos), [[30, 0, 25], [-30, 0, 25]]);
  assert.equal(n3.time_left_s, 300); // Ticket-03: 360 → 300
  assert.deepEqual(n3.player.pos, [0, 0, -30]);
  for (const m of n3.motes) assert.ok([0, 3, 6].includes(m.pos[1]));
});

test('lịch sinh: Bóng Mực 2 con ở tick 300 rồi mỗi 480 (Đêm 1), spawning, cách người chơi ≥ 15 m; đom đóm +1 mỗi 240', () => {
  const r = runHeadless('spawn-schedule', { scenario: { random_drifters: false }, ticks: 800, every: 10 });
  assert.deepEqual(r.ev('shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  const s300 = r.snapAt(300);
  for (const sh of s300.shades) {
    assert.equal(sh.state, 'spawning');
    assert.ok(near(Math.hypot(sh.pos[0], sh.pos[2]), 37, 0.01));
    assert.ok(xz(sh.pos, s300.player.pos) >= 15);
  }
  const n = (t) => r.snapAt(t).motes.filter((m) => m.kind === 'random').length;
  assert.equal(n(230), 20);
  assert.equal(n(240), 21);
  assert.equal(n(480), 22);
});

// ---------- Di chuyển, nhảy ----------
test('di chuyển: 6 m/s, yaw 90 → +X, vector chéo chuẩn hóa', () => {
  const f = runHeadless('move-forward', { scenario: clean(), inputs: hold([{ tick: 0, move: [0, 1] }]), ticks: 60 });
  assert.ok(near(f.snapAt(60).player.pos[2], 6));
  assert.deepEqual(f.snapAt(60).player.vel, [0, 0, 6]);
  const y = runHeadless('move-yaw90', { scenario: clean(), inputs: hold([{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }]), ticks: 60 });
  assert.ok(near(y.snapAt(60).player.pos[0], 6) && near(y.snapAt(60).player.pos[2], 0));
  const d = runHeadless('move-diagonal', { scenario: clean(), inputs: hold([{ tick: 0, move: [1, 1] }]), ticks: 60 });
  const k = 6 / Math.SQRT2;
  assert.ok(near(d.snapAt(60).player.pos[0], k) && near(d.snapAt(60).player.pos[2], k));
});

test('nhảy: 7 m/s, g = 20 → đỉnh ≈ 1.225 m, chạm đất sau ≈ 0.7 s; không nhảy kép trên không', () => {
  const r = runHeadless('jump', {
    scenario: clean(),
    inputs: hold([{ tick: 0, jump: true }, { tick: 5, jump: false }, { tick: 10, jump: true }]),
    ticks: 80, every: 1,
  });
  assert.equal(r.snapAt(1).player.grounded, false);
  const peak = Math.max(...r.snaps.map((s) => s.player.pos[1]));
  assert.ok(peak > 1.1 && peak < 1.35, String(peak));
  const land = r.snaps.find((s) => s.tick > 1 && s.player.grounded).tick;
  assert.ok(land >= 40 && land <= 46, String(land));
});

// ---------- Lướt ----------
test('lướt: 14 m/s × 12 tick = 2.8 m theo hướng mặt khi đứng yên; hồi chiêu 90 tick từ lúc bắt đầu', () => {
  const r = runHeadless('dash-basic', {
    scenario: clean(),
    inputs: hold([{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 90, dash: true }]),
    ticks: 100, every: 1,
  });
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, 91]);
  assert.ok(near(r.snapAt(12).player.pos[2], 2.8), JSON.stringify(r.snapAt(12).player));
  assert.ok(near(r.snapAt(20).player.pos[2], 2.8));
  assert.ok(near(r.snapAt(10).player.dash_cd_s, (90 - 9) / 60));
});

test('lướt: theo hướng đang di chuyển; trên không giữ nguyên độ cao', () => {
  const r = runHeadless('dash-move', {
    scenario: clean(),
    inputs: hold([{ tick: 0, move: [1, 0], jump: true }, { tick: 10, dash: true }]),
    ticks: 40, every: 1,
  });
  const y10 = r.snapAt(10).player.pos[1];
  for (let t = 11; t <= 22; t++) assert.ok(near(r.snapAt(t).player.pos[1], y10), `tick ${t}`);
  assert.ok(near(r.snapAt(22).player.pos[0] - r.snapAt(10).player.pos[0], 2.8));
  assert.ok(near(r.snapAt(22).player.pos[2], 0));
});

// ---------- Nhặt, nạp đèn, điểm ----------
test('nhặt: XZ ≤ 1.0 và chênh cao ≤ 1.5; không cộng điểm khi nhặt', () => {
  const r = runHeadless('pickup', {
    scenario: clean({ motes: [[0, 0, 5], [0, 2, 8]] }),
    inputs: hold([{ tick: 0, move: [0, 1] }]),
    ticks: 90,
  });
  const picks = r.ev('mote_picked');
  assert.equal(picks.length, 1, 'mote ở độ cao 2 m không được nhặt');
  assert.equal(picks[0].tick, Math.ceil((5 - T.pickup_radius) / STEP - 1e-9));
  assert.equal(r.end.score, 0);
});

test('sức chứa 10', () => {
  const r = runHeadless('capacity', { scenario: clean({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }), ticks: 5 });
  assert.equal(r.ev('mote_picked').length, 0);
});

test('nạp đèn: 10 đom đóm, +10 mỗi đom đóm nạp, +100 khi thắp', () => {
  const r = runHeadless('deposit-lit', {
    scenario: clean({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }] }),
    inputs: hold([{ tick: 0, interact: true }]),
    ticks: 5,
  });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.equal(r.ev('lantern_lit').length, 1);
  assert.equal(r.end.score, 10 * T.score.per_mote + T.score.per_lantern);
});

test('nạp đèn nhiều lần, đèn nhớ tiến độ', () => {
  const r = runHeadless('deposit-multi', {
    scenario: clean({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], deposited: 6 }] }),
    inputs: hold([{ tick: 0, interact: true }]),
    ticks: 5,
  });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.equal(r.ev('lantern_lit').length, 1);
});

test('nạp đèn: bán kính 2.0 m, chọn đèn gần nhất, bằng nhau thì id nhỏ hơn', () => {
  const out = runHeadless('deposit-range', {
    scenario: clean({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.3] }] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 3,
  });
  assert.equal(out.ev('deposit').length, 0);
  const tie = runHeadless('deposit-tie', {
    scenario: clean({ player: { carried: 5 }, lanterns: [{ id: 'L2', pos: [0, 0, 1.5] }, { id: 'L1', pos: [0, 0, -1.5] }] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 3,
  });
  assert.equal(tie.ev('deposit')[0].data.lantern_id, 'L1');
  const nearest = runHeadless('deposit-nearest', {
    scenario: clean({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }, { id: 'L2', pos: [0, 0, -1] }] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 3,
  });
  assert.equal(nearest.ev('deposit')[0].data.lantern_id, 'L2');
});

// ---------- Tỏa Sáng ----------
test('tỏa sáng: tốn 3, choáng 120 tick, đẩy 4 m trong 15 tick, +5 mỗi con', () => {
  const r = runHeadless('pulse-stun', {
    scenario: clean({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] }),
    inputs: hold([{ tick: 0, pulse: true }]),
    ticks: 140, every: 1,
  });
  assert.deepEqual(r.ev('pulse'), [{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }]);
  assert.equal(r.snapAt(1).player.carried, 0);
  assert.equal(r.end.score, T.score.per_stun);
  assert.ok(near(r.snapAt(8).shades[0].pos[0], 3 + (4 * 8) / 15));
  assert.ok(near(r.snapAt(15).shades[0].pos[0], 7));
  assert.ok(near(r.snapAt(60).shades[0].pos[0], 7));
  assert.equal(r.snapAt(120).shades[0].state, 'stunned');
  assert.notEqual(r.snapAt(121).shades[0].state, 'stunned');
});

test('tỏa sáng: bán kính đo 3D từ chân + 0.8 m', () => {
  const r = runHeadless('pulse-3d', {
    scenario: clean({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [4, 1, 0] }, { id: 'S2', pos: [3, 5, 0] }] }),
    inputs: hold([{ tick: 0, pulse: true }]), ticks: 2,
  });
  assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['S1']); // S2: √(9 + 4.2²) ≈ 5.16 > 5
});

test('tỏa sáng: pulse lại con đang choáng vẫn +5 và làm mới choáng', () => {
  const r = runHeadless('pulse-refresh', {
    scenario: clean({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [2, 1, 0], state: 'stunned', state_ticks_left: 50 }] }),
    inputs: hold([{ tick: 0, pulse: true }]), ticks: 110, every: 10,
  });
  assert.equal(r.end.score, 5);
  assert.equal(r.snapAt(100).shades[0].state, 'stunned');
});

test('tỏa sáng: hồi chiêu 180 tick; thiếu đom đóm thì không kích hoạt', () => {
  const r = runHeadless('pulse-cooldown', {
    scenario: clean({ player: { carried: 9 } }),
    inputs: hold([{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 100, pulse: true }, { tick: 101, pulse: false }, { tick: 180, pulse: true }]),
    ticks: 190,
  });
  assert.deepEqual(r.ev('pulse').map((e) => e.tick), [1, 181]);
  const none = runHeadless('pulse-no-light', { scenario: clean({ player: { carried: 2 } }), inputs: hold([{ tick: 0, pulse: true }]), ticks: 3 });
  assert.equal(none.ev('pulse').length, 0);
});

// ---------- Bóng Mực ----------
test('Bóng Mực: đuổi trong 12 m với 4.0 m/s; ngoài 12 m thì wander', () => {
  const r = runHeadless('shade-chase', { scenario: clean({ shades: [{ id: 'S1', pos: [10, 1, 0] }, { id: 'S2', pos: [-15, 1, 0] }] }), ticks: 30 });
  const s = r.snapAt(30);
  assert.equal(s.shades[0].state, 'chase');
  assert.ok(near(s.shades[0].pos[0], 10 - 2));
  assert.equal(s.shades[1].state, 'wander');
});

test('Bóng Mực: bỏ đuổi khi xa hơn 18 m', () => {
  const r = runHeadless('shade-giveup', {
    scenario: clean({ shades: [{ id: 'S1', pos: [17, 1, 0], state: 'chase' }] }),
    inputs: hold([{ tick: 0, move: [-1, 0] }]), ticks: 60, every: 1,
  });
  assert.equal(r.snapAt(10).shades[0].state, 'chase');
  assert.equal(r.snapAt(60).shades[0].state, 'wander');
});

test('Bóng Mực Đêm 3: 4.5 m/s', () => {
  const r = runHeadless('shade-n3-speed', { night: 3, scenario: clean({ shades: [{ id: 'S1', pos: [10, 1, -30] }] }), ticks: 30 });
  assert.ok(near(r.snapAt(30).shades[0].pos[0], 10 - 2.25));
});

test('bị đánh: −1 lửa, rơi floor(n/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90, bóng recoil', () => {
  const r = runHeadless('hit', { scenario: clean({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }), ticks: 100, every: 1 });
  assert.deepEqual(r.ev('player_hit').map((e) => [e.tick, e.data]), [
    [1, { by: 'shade', flames: 2, dropped: 2 }],
    [91, { by: 'shade', flames: 1, dropped: 1 }],
  ]);
  const s1 = r.snapAt(1);
  assert.equal(s1.player.carried, 3);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.shades[0].state, 'recoil');
  const drops = s1.motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 2);
  for (const m of drops) {
    const d = xz(m.pos, s1.player.pos);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, String(d));
    assert.equal(m.ttl_s, 8);
  }
  assert.ok(near(xz(r.snapAt(61).shades[0].pos, [0, 0, 0]), (0.5 - 4 / 60) + 2, 0.01));
});

test('đom đóm rơi hết hạn sau TTL', () => {
  const r = runHeadless('drop-ttl', { scenario: clean({ motes: [{ pos: [5, 0, 5], kind: 'dropped', ttl_ticks: 30 }] }), ticks: 40, every: 10 });
  assert.ok(near(r.snapAt(20).motes[0].ttl_s, 10 / 60));
  assert.equal(r.snapAt(30).motes.length, 0);
});

// ---------- Vùng an toàn ----------
test('vùng an toàn 6 m: Bóng Mực bị chặn ở mép', () => {
  const r = runHeadless('safe-block', {
    scenario: clean({ player: { pos: [0, 0, 11.5] }, lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true }], shades: [{ id: 'S1', pos: [0, 1, 0] }] }),
    ticks: 300, every: 1,
  });
  for (const s of r.snaps) assert.ok(xz(s.shades[0].pos, [0, 0, 10]) >= 6 - 1e-3, `tick ${s.tick}`);
  assert.equal(r.ev('player_hit').length, 0);
});

test('vùng an toàn: đèn vừa thắp đẩy bóng bên trong ra mép trong 30 tick, không gây hit', () => {
  const r = runHeadless('safe-evict', {
    scenario: clean({ player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], deposited: 9 }], shades: [{ id: 'S1', pos: [0.5, 1, 0] }] }),
    inputs: hold([{ tick: 0, interact: true }]), ticks: 120, every: 1,
  });
  assert.equal(r.ev('lantern_lit')[0].tick, 1);
  assert.equal(r.snapAt(1).shades[0].state, 'recoil');
  assert.ok(near(xz(r.snapAt(30).shades[0].pos, [0, 0, 1.5]), 6, 0.01));
  assert.equal(r.ev('player_hit').length, 0);
});

// ---------- Rơi khỏi đảo ----------
test('rơi: −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát với bất tử', () => {
  const r = runHeadless('fall', {
    scenario: clean({ player: { pos: [39.5, 0, 0], carried: 4 } }),
    inputs: hold([{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }]), ticks: 200, every: 1,
  });
  const hits = r.ev('player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const tf = hits[0].tick;
  assert.ok(r.snapAt(tf).player.pos[1] < -10);
  assert.deepEqual(r.snapAt(tf + 59).player.pos, r.snapAt(tf).player.pos);
  assert.deepEqual(r.snapAt(tf + 60).player.pos, [0, 0, 0]);
  assert.equal(r.snapAt(tf + 60).player.invuln, true);
  assert.equal(r.snapAt(tf + 60).player.carried, 0);
});

test('rơi khi còn 1 lửa: thua ngay, không hồi sinh', () => {
  const r = runHeadless('fall-lose', { scenario: clean({ player: { pos: [39.5, 0, 0], flames: 1 } }), inputs: hold([{ tick: 0, move: [1, 0] }]), ticks: 300 });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.ev('game_over')[0].data.reason, 'no_flames');
  assert.equal(r.ev('game_over')[0].tick, r.ev('player_hit')[0].tick);
});

// ---------- Đêm 2: cầu, bục nhảy ----------
test('Đêm 2: đi qua cầu tre sang đảo B; bước ra ngoài cầu thì rơi', () => {
  const ok = runHeadless('n2-bridge', { night: 2, scenario: clean({ player: { pos: [24, 0, 0] } }), inputs: hold([{ tick: 0, move: [1, 0] }]), ticks: 240 });
  assert.equal(ok.ev('player_hit').length, 0);
  assert.ok(near(ok.snapAt(240).player.pos[0], 48) && ok.snapAt(240).player.grounded);
  const off = runHeadless('n2-off-bridge', { night: 2, scenario: clean({ player: { pos: [35, 0, 1.5] } }), inputs: hold([{ tick: 0, move: [0, 1] }]), ticks: 200 });
  assert.equal(off.ev('player_hit')[0].data.by, 'fall');
});

test('Đêm 2: bục nhảy bắn sang đảo kia (vy 14, ngang 24 m/s), đáp sau ≈ 1.4 s', () => {
  const r = runHeadless('n2-pad', {
    night: 2, scenario: clean({ player: { pos: [20, 0, 18] } }),
    inputs: hold([{ tick: 0, move: [-1, 0] }]), // phím di chuyển không ghi đè vận tốc phóng
    ticks: 120, every: 1,
  });
  const v = r.snapAt(2).player.vel;
  assert.ok(near(Math.hypot(v[0], v[2]), 24, 0.01), JSON.stringify(v));
  const land = r.snaps.find((s) => s.tick > 2 && s.player.grounded);
  assert.ok(land, 'phải chạm đất');
  assert.ok(land.tick >= 80 && land.tick <= 90, String(land.tick));
  assert.ok(xz(land.player.pos, [70, 0, 0]) <= 28);
  assert.equal(r.ev('player_hit').length, 0);
});

// ---------- Đêm 3: tầng, dốc, vách, tháp, bục ----------
test('Đêm 3: vách tầng 1 chặn đi lên', () => {
  const r = runHeadless('n3-wall', { night: 3, scenario: clean({ player: { pos: [0, 0, 28] } }), inputs: hold([{ tick: 0, move: [0, -1] }]), ticks: 120 });
  const p = r.snapAt(120).player;
  assert.ok(p.pos[2] >= 24 - 1e-3 && p.pos[1] === 0, JSON.stringify(p));
});

test('Đêm 3: đi lên dốc 30° tới tầng 1 (Y = 3)', () => {
  const a = Math.PI / 6;
  const r = runHeadless('n3-ramp', {
    night: 3, scenario: clean({ player: { pos: [30.5 * Math.cos(a), 0, 30.5 * Math.sin(a)] } }),
    inputs: hold([{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }]), ticks: 120,
  });
  const p = r.snapAt(120).player;
  assert.ok(near(Math.hypot(p.pos[0], p.pos[2]), 18.5, 0.01));
  assert.equal(p.pos[1], 3);
  assert.equal(p.grounded, true);
});

test('Đêm 3: bục (0,3,13) đáp lên tầng 2; tháp chuông chặn', () => {
  const r = runHeadless('n3-pad', { night: 3, scenario: clean({ player: { pos: [0, 3, 13] } }), ticks: 120, every: 1 });
  const land = r.snaps.find((s) => s.tick > 2 && s.player.grounded);
  assert.ok(land, 'phải chạm đất');
  assert.equal(land.player.pos[1], 6);
  const rr = Math.hypot(land.player.pos[0], land.player.pos[2]);
  assert.ok(rr <= 8 && rr >= 2, String(rr));
  const t = runHeadless('n3-tower', { night: 3, scenario: clean({ player: { pos: [0, 6, 5] } }), inputs: hold([{ tick: 0, move: [0, -1] }]), ticks: 60 });
  assert.ok(t.snapAt(60).player.pos[2] >= 2 - 1e-3);
});

test('Đêm 3: gió mạnh mỗi 30 s, kéo dài 5 s, đẩy 2 m/s', () => {
  const r = runHeadless('n3-wind', { night: 3, scenario: clean({ wind_enabled: true }), ticks: 2110, every: 10 });
  assert.equal(r.snapAt(1790).wind.active, false);
  const w = r.snapAt(1800).wind;
  assert.equal(w.active, true);
  assert.ok(Number.isInteger(w.dir_deg) && w.dir_deg >= 0 && w.dir_deg < 360);
  assert.equal(r.snapAt(2090).wind.active, true);
  assert.equal(r.snapAt(2100).wind.active, false);
  const a = r.snapAt(1790).player.pos, b = r.snapAt(2100).player.pos; // 300 bước có gió: sim 1800..2099
  assert.ok(near(xz(a, b), 10, 0.01));
  const rad = (w.dir_deg * Math.PI) / 180;
  assert.ok(near(b[0] - a[0], 10 * Math.cos(rad), 0.01) && near(b[2] - a[2], 10 * Math.sin(rad), 0.01));
});

// ---------- Gió Lạc ----------
test('Gió Lạc: chase khi mang ≥ 5 và cách ≤ 15 m; chạm cướp 3; flee 240 tick rồi removed', () => {
  const r = runHeadless('drifter-steal', {
    night: 2, scenario: clean({ player: { carried: 6, invuln_ticks: 200 }, drifters: [{ id: 'D1', pos: [5, 1.5, 0] }] }),
    ticks: 300, every: 1,
  });
  assert.equal(r.snapAt(1).drifters[0].state, 'chase');
  assert.deepEqual(r.ev('drifter_steal'), [{ type: 'event', tick: 33, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 3 } }]);
  assert.equal(r.snapAt(33).drifters[0].state, 'flee');
  assert.equal(r.snapAt(33).drifters[0].stolen, 3);
  assert.equal(r.snapAt(33 + 239).drifters[0].state, 'flee');
  assert.equal(r.snapAt(33 + 240).drifters[0].state, 'removed');
  assert.equal(r.snapAt(299).player.flames, 3); // không mất lửa
});

test('Gió Lạc: mang < 5 thì idle', () => {
  const r = runHeadless('drifter-idle', { night: 2, scenario: clean({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [5, 1.5, 0] }] }), ticks: 30 });
  assert.equal(r.snapAt(30).drifters[0].state, 'idle');
  assert.equal(r.ev('drifter_steal').length, 0);
});

test('Gió Lạc: pulse lúc chase → flee không cướp', () => {
  const r = runHeadless('drifter-pulse-chase', {
    night: 2, scenario: clean({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }),
    inputs: hold([{ tick: 0, pulse: true }]), ticks: 260, every: 10,
  });
  assert.equal(r.snapAt(10).drifters[0].state, 'flee');
  assert.equal(r.ev('drifter_steal').length, 0);
  assert.equal(r.snapAt(250).drifters[0].state, 'removed');
  assert.equal(r.snapAt(250).player.carried, 5);
});

test('Gió Lạc: pulse lúc flee có đồ → thả lại thành đom đóm rơi, biến mất sau 120 tick', () => {
  const r = runHeadless('drifter-pulse-flee', {
    night: 2, scenario: clean({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }),
    inputs: hold([{ tick: 0, pulse: true }]), ticks: 130, every: 1,
  });
  assert.deepEqual(r.ev('drifter_drop').map((e) => [e.tick, e.data]), [[1, { drifter_id: 'D1', amount: 3 }]]);
  const drops = r.snapAt(1).motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 3);
  for (const m of drops) assert.ok(near(m.pos[0], 3) && near(m.pos[2], 0));
  assert.equal(r.snapAt(1).drifters[0].stolen, 0);
  assert.equal(r.snapAt(120).drifters[0].state, 'flee');
  assert.equal(r.snapAt(121).drifters[0].state, 'removed');
});

test('Gió Lạc: sinh ở tick 1200 trên Đêm 2, id D1; không có ở Đêm 1', () => {
  const n2 = runHeadless('drifter-spawn', { night: 2, scenario: { random_shades: false }, ticks: 1200, every: 1200 });
  assert.deepEqual(n2.snapAt(1200).drifters.map((d) => [d.id, d.state]), [['D1', 'idle']]);
  const n1 = runHeadless('drifter-none-n1', { night: 1, scenario: { random_shades: false }, ticks: 1200, every: 1200 });
  assert.equal(n1.snapAt(1200).drifters.length, 0);
});

// ---------- Bùa Gió ----------
test('Bùa Gió: nhặt → 600 tick, tốc độ 7.2, xuất hiện lại sau 2700 tick', () => {
  const r = runHeadless('charm-pick', {
    night: 2, scenario: clean({ charms: [{ id: 'C1', pos: [0, 0, 0.5] }] }),
    inputs: hold([{ tick: 0, move: [0, 1] }, { tick: 61, move: [0, 0] }]), ticks: 2710, every: 1,
  });
  assert.deepEqual(r.ev('charm_picked'), [{ type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } }]);
  assert.equal(r.snapAt(1).player.charm_s, 10);
  assert.ok(near(r.snapAt(61).player.pos[2] - r.snapAt(1).player.pos[2], 7.2));
  assert.equal(r.snapAt(2700).charms[0].available, false);
  assert.equal(r.snapAt(2701).charms[0].available, true);
});

test('Bùa Gió: lướt không hồi chiêu, nhấn khi đang lướt bị bỏ qua', () => {
  const r = runHeadless('charm-dash', {
    night: 2, scenario: clean({ player: { charm_ticks: 600 } }),
    inputs: hold([{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 12, dash: true }]),
    ticks: 30, every: 1,
  });
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, 13]);
  assert.ok(near(r.snapAt(24).player.pos[2], 5.6));
});

// ---------- Tạm dừng ----------
test('tạm dừng: tick tăng, sim_tick/thời gian/di chuyển đứng yên, state paused', () => {
  const r = runHeadless('pause', {
    scenario: clean(),
    inputs: hold([{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 70, pause: true }]),
    ticks: 100,
  });
  assert.deepEqual(r.events.filter((e) => ['paused', 'resumed'].includes(e.name)).map((e) => [e.tick, e.name]), [[11, 'paused'], [71, 'resumed']]);
  const s40 = r.snapAt(40);
  assert.equal(s40.state, 'paused');
  assert.equal(s40.sim_tick, 10);
  assert.equal(s40.time_left_s, r.snapAt(20).time_left_s);
  assert.deepEqual(s40.player.pos, r.snapAt(20).player.pos);
  assert.equal(r.snapAt(100).sim_tick, 100 - 60);
  assert.ok(near(r.snapAt(100).player.pos[2], 40 * STEP));
});

// ---------- Thắng / thua ----------
// Phase 3: hai test "thắng khi thắp hết đèn" (điểm thưởng giây, thắng đúng tick hết giờ) đã XÓA vì Ticket-03
// thay luật thắng; test thay thế nằm ở tests/phase3.test.js (thắng/thua lúc bình minh). Test 'lose-dawn' chuyển sang đó.

test('dựng scenario không cộng điểm và không phát sự kiện ngoài night_start', () => {
  const r = runHeadless('scenario-no-score', { scenario: clean({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 1 });
  assert.equal(r.snapAt(0).score, 0);
  assert.deepEqual(r.events.map((e) => e.name), ['night_start']);
});

// ---------- Lỗi, tất định, hiệu năng ----------
test('input/scenario sai định dạng → mã thoát 2', () => {
  assert.equal(runHeadless('bad-ticks', { inputs: hold([{ tick: 5 }, { tick: 5 }]) }).code, 2);
  assert.equal(runHeadless('bad-json', { rawInputs: '{ not json' }).code, 2);
  assert.equal(runHeadless('bad-move', { inputs: hold([{ tick: 0, move: [2, 0] }]) }).code, 2);
  assert.equal(runHeadless('bad-dash', { inputs: hold([{ tick: 0, dash: 1 }]) }).code, 2);
  assert.equal(runHeadless('bad-shade-state', { scenario: clean({ shades: [{ pos: [1, 1, 1], state: 'angry' }] }) }).code, 2);
});

for (const night of [1, 2, 3]) {
  test(`tất định Đêm ${night}: cùng seed + input → output giống hệt`, () => {
    const inputs = hold([{ tick: 0, move: [0.3, 1] }, { tick: 300, move: [-1, 0], cam_yaw_deg: 45, dash: true }, { tick: 900, pulse: true }]);
    const a = runHeadless(`det-${night}-a`, { night, seed: 42, inputs, ticks: 3000 });
    const b = runHeadless(`det-${night}-b`, { night, seed: 42, inputs, ticks: 3000 });
    assert.equal(a.text, b.text);
    const c = runHeadless(`det-${night}-c`, { night, seed: 7, inputs, ticks: 3000 });
    assert.notEqual(a.text, c.text);
  });
}

test('hiệu năng: một Đêm 3 đầy đủ 21.600 tick ≤ 30 s', () => {
  const r = runHeadless('perf-n3', {
    night: 3, scenario: { player: { flames: 99 } }, ticks: 21600, every: 10,
    inputs: hold([{ tick: 0, move: [1, 0.2] }, { tick: 5000, move: [-0.5, -1] }, { tick: 12000, move: [0, 0] }]),
  });
  assert.equal(r.code, 0);
  assert.ok(r.ms < 30000, `${r.ms} ms`);
  assert.ok(r.end.ticks > 0);
});
