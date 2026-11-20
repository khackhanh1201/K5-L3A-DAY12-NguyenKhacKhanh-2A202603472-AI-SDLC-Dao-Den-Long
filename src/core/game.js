// Logic game thuần, tất định, không phụ thuộc DOM/Three.js.
// Thứ tự xử lý trong một bước: xem docs/notes/assumptions.md mục "Thứ tự bước".
import { createRng } from './rng.js';
import { NIGHT1, TICK_RATE, EPS, defaultLanterns, round3 } from './level.js';

const secToTicks = (s) => Math.round(s * TICK_RATE);

function distXZ(a, b) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Tạo game mới.
 * @param {object} tuning  phần "tuning" của game.contract.json
 * @param {{seed?:number, scenario?:object}} opts
 */
export function createGame(tuning, { seed = 0, scenario = null } = {}) {
  const sc = scenario || {};
  const g = {
    tuning,
    rng: createRng(seed),
    steps: 0,
    state: 'playing',
    result: null,
    score: 0,
    timeLeftStart: 'time_left_s' in sc ? sc.time_left_s : tuning.night1_duration_s,
    player: {
      pos: [0, 0, 0],
      vy: 0,
      flames: tuning.flames,
      carried: 0,
      invuln: 0, // tick còn lại
      pulseCd: 0,
    },
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
    lanterns: defaultLanterns(tuning.lantern_count_night1),
    motes: [],
    shades: [],
    nextMoteId: 1,
    nextShadeId: 1,
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    // đếm ngược sinh thực thể (tick)
    moteRespawnIn: secToTicks(NIGHT1.motes.respawnEveryS),
    shadeSpawnIn: secToTicks(NIGHT1.shades.firstAtS),
  };

  if (g.randomMotes) {
    for (let i = 0; i < NIGHT1.motes.initial; i++) spawnRandomMote(g);
  }

  // --- áp scenario (không phát sự kiện, không cộng điểm) ---
  if (sc.player) {
    if (sc.player.pos) g.player.pos = [...sc.player.pos];
    if ('carried' in sc.player) g.player.carried = sc.player.carried;
    if ('flames' in sc.player) g.player.flames = sc.player.flames;
  }
  if (sc.motes) {
    g.motes = [];
    g.nextMoteId = 1;
    for (const p of sc.motes) addMote(g, [p[0], 0, p[2]]);
  }
  if (sc.shades) {
    g.shades = [];
    const explicit = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of sc.shades) {
      const id = s.id || nextShadeId(g, explicit);
      g.shades.push({ id, pos: [...s.pos], stun: 0 });
    }
    g.reservedShadeIds = explicit;
  }
  if (sc.lanterns) {
    for (const l of sc.lanterns) {
      const target = g.lanterns.find((x) => x.id === l.id);
      if (!target) continue; // id lạ: bỏ qua
      if (l.pos) target.pos = [...l.pos];
      if ('deposited' in l) target.deposited = l.deposited;
      if ('lit' in l) target.lit = l.lit;
    }
  }
  return g;
}

function nextShadeId(g, reserved = g.reservedShadeIds || new Set()) {
  let id;
  do {
    id = `S${g.nextShadeId++}`;
  } while (reserved.has(id) || g.shades.some((s) => s.id === id));
  return id;
}

function addMote(g, pos) {
  g.motes.push({ id: `M${g.nextMoteId++}`, pos });
}

function spawnRandomMote(g) {
  const { spawnMaxR, spawnMinR } = NIGHT1.motes;
  let x, z;
  do {
    const r = spawnMaxR * Math.sqrt(g.rng());
    const a = g.rng() * 2 * Math.PI;
    x = r * Math.sin(a);
    z = r * Math.cos(a);
  } while (Math.hypot(x, z) < spawnMinR);
  addMote(g, [round3(x), 0, round3(z)]);
}

function spawnRandomShade(g, events, tick) {
  const { spawnR, minPlayerDist, y } = NIGHT1.shades;
  let a = g.rng() * 2 * Math.PI;
  let pos = [spawnR * Math.sin(a), y, spawnR * Math.cos(a)];
  if (distXZ(pos, g.player.pos) < minPlayerDist) {
    a += Math.PI;
    pos = [spawnR * Math.sin(a), y, spawnR * Math.cos(a)];
  }
  const id = nextShadeId(g);
  g.shades.push({ id, pos: [round3(pos[0]), y, round3(pos[2])], stun: 0 });
  events.push({ type: 'event', tick, name: 'shade_spawned', data: { id } });
}

/** Hướng di chuyển trong thế giới theo công thức contract mục C. */
export function worldMove(move, camYawDeg) {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const t = (camYawDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

function clampToIsland(pos) {
  const r = Math.hypot(pos[0], pos[2]);
  if (r > NIGHT1.islandRadius) {
    pos[0] *= NIGHT1.islandRadius / r;
    pos[2] *= NIGHT1.islandRadius / r;
  }
}

/** Đẩy Bóng Mực ra khỏi vùng an toàn của các đèn đã thắp. */
function enforceSafeZones(g, pos) {
  const R = g.tuning.safe_radius;
  if (!R) return;
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    const d = distXZ(pos, l.pos);
    if (d < R) {
      let dx = pos[0] - l.pos[0];
      let dz = pos[2] - l.pos[2];
      if (d < 1e-9) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      pos[0] = l.pos[0] + dx * R;
      pos[2] = l.pos[2] + dz * R;
    }
  }
}

/**
 * Chạy một bước: đọc input của tick k = g.steps, tạo trạng thái k+1.
 * @returns {Array} danh sách event (tick = k+1)
 */
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const T = g.tuning;
  const tick = g.steps + 1;
  const events = [];
  const p = g.player;

  // 1. Cạnh nút false -> true
  const pressed = {};
  for (const b of Object.keys(g.prevButtons)) {
    pressed[b] = !!input[b] && !g.prevButtons[b];
    g.prevButtons[b] = !!input[b];
  }

  // 2. Di chuyển người chơi + nhảy
  const [mx, mz] = worldMove(input.move, input.cam_yaw_deg);
  const v = T.player_speed / TICK_RATE;
  p.pos[0] += mx * v;
  p.pos[2] += mz * v;
  clampToIsland(p.pos);
  if (pressed.jump && p.pos[1] <= 0) p.vy = NIGHT1.jump.velocity;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.pos[1] += p.vy / TICK_RATE;
    p.vy -= NIGHT1.jump.gravity / TICK_RATE;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vy = 0;
    }
  }

  // 3. Nhặt đom đóm
  if (g.motes.length) {
    const keep = [];
    for (const m of g.motes) {
      if (p.carried < T.carry_capacity && distXZ(p.pos, m.pos) <= T.pickup_radius + EPS) {
        p.carried += 1;
        g.score += T.score.per_mote;
        events.push({ type: 'event', tick, name: 'mote_picked', data: { carried: p.carried } });
      } else keep.push(m);
    }
    g.motes = keep;
  }

  // 4. Nạp ánh sáng vào đèn
  if (pressed.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius + EPS && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        events.push({ type: 'event', tick, name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        events.push({ type: 'event', tick, name: 'lantern_lit', data: { lantern_id: best.id } });
      }
    }
  }

  // 5. Tỏa sáng (tốn pulse_cost đom đóm đang mang)
  if (pressed.pulse && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const stunned = [];
    for (const s of g.shades) {
      const d = distXZ(p.pos, s.pos);
      if (d <= T.pulse_radius + EPS) {
        s.stun = secToTicks(T.pulse_stun_s);
        let dx = s.pos[0] - p.pos[0];
        let dz = s.pos[2] - p.pos[2];
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] += dx * T.pulse_push_m;
        s.pos[2] += dz * T.pulse_push_m;
        clampToIsland(s.pos);
        enforceSafeZones(g, s.pos);
        stunned.push(s.id);
        g.score += T.score.per_stun;
      }
    }
    events.push({ type: 'event', tick, name: 'pulse', data: { stunned_ids: stunned } });
  }

  // 6. Bóng Mực đuổi theo
  const sv = T.shade_speed / TICK_RATE;
  for (const s of g.shades) {
    if (s.stun > 0) continue;
    const d = distXZ(s.pos, p.pos);
    if (d <= sv) {
      s.pos[0] = p.pos[0];
      s.pos[2] = p.pos[2];
    } else {
      s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * sv;
      s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * sv;
    }
    enforceSafeZones(g, s.pos);
  }

  // 7. Va chạm
  if (p.invuln <= 0) {
    for (const s of g.shades) {
      if (s.stun > 0) continue;
      if (distXZ(s.pos, p.pos) <= T.shade_hit_radius + EPS) {
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        p.invuln = secToTicks(T.invuln_s);
        events.push({ type: 'event', tick, name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
        break;
      }
    }
  }

  // 8. Bộ đếm, sinh thực thể, thời gian
  if (p.invuln > 0) p.invuln--;
  if (p.pulseCd > 0) p.pulseCd--;
  for (const s of g.shades) if (s.stun > 0) s.stun--;
  if (g.randomMotes && --g.moteRespawnIn <= 0) {
    g.moteRespawnIn = secToTicks(NIGHT1.motes.respawnEveryS);
    if (g.motes.length < NIGHT1.motes.max) spawnRandomMote(g);
  }
  if (g.randomShades && g.shades.length < NIGHT1.shades.max && --g.shadeSpawnIn <= 0) {
    g.shadeSpawnIn = secToTicks(NIGHT1.shades.everyS);
    spawnRandomShade(g, events, tick);
  }
  g.steps += 1;

  // 9. Kết thúc: all_lit > no_flames > dawn
  let over = null;
  if (g.lanterns.every((l) => l.lit)) over = ['won', 'all_lit'];
  else if (p.flames <= 0) over = ['lost', 'no_flames'];
  else if (timeLeft(g) <= EPS) over = ['lost', 'dawn'];
  if (over) {
    g.state = over[0];
    g.result = over[1];
    if (over[0] === 'won') {
      g.score += Math.floor(Math.max(0, timeLeft(g)) + EPS) * T.score.per_second_left + p.flames * T.score.per_flame_left;
    }
    events.push({ type: 'event', tick, name: 'game_over', data: { result: over[0], reason: over[1] } });
  }
  return events;
}

export function timeLeft(g) {
  return g.timeLeftStart - g.steps / TICK_RATE;
}

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.steps,
    sim_tick: g.steps,
    state: g.state,
    time_left_s: round3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: g.player.pos.map(round3), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: s.pos.map(round3), state: s.stun > 0 ? 'stunned' : 'chase' })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: m.pos.map(round3) })),
  };
}
