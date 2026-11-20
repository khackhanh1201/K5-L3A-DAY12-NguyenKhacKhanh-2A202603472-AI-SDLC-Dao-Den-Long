// Logic game thuần, tất định, không phụ thuộc DOM/Three.js.
// Thứ tự 12 bước mỗi tick theo Ticket-02 (docs/requirements/TICKET-02.md); giả định ở docs/notes/assumptions.md.
import { createRng } from './rng.js';
import { NIGHTS, RULES as R, TICK_RATE, EPS, round3, durationFor } from './level.js';

const DT = 1 / TICK_RATE;
const secToTicks = (s) => Math.round(s * TICK_RATE);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function dirXZ(from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
}
const idNum = (id) => parseInt(String(id).replace(/\D/g, ''), 10) || 0;

/** Hướng di chuyển trong thế giới theo công thức contract mục C. */
export function worldMove(move, camYawDeg) {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const t = (camYawDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

export function createGame(tuning, { seed = 0, night = 1, scenario = null } = {}) {
  const map = NIGHTS[night];
  if (!map) throw new Error(`night không hợp lệ: ${night}`);
  const sc = scenario || {};
  const T = tuning;
  const g = {
    T,
    map,
    night,
    rng: createRng(seed),
    tick: 0,
    sim: 0,
    paused: false,
    state: 'playing',
    result: null,
    score: 0,
    timeLeftStart: 'time_left_s' in sc ? sc.time_left_s : durationFor(T, night),
    shadeSpeed: night === 3 ? T.shade_speed + 0.5 : T.shade_speed,
    player: {
      pos: [...map.start],
      vel: [0, 0, 0],
      facing: [0, 1],
      grounded: true,
      flames: T.flames,
      carried: 0,
      invuln: 0,
      dashCd: 0,
      dashT: 0,
      dashDir: [0, 1],
      pulseCd: 0,
      charm: 0,
      launch: null,
      waiting: false,
      waitT: 0,
    },
    prev: Object.fromEntries(BUTTONS.map((b) => [b, false])),
    // fuelU: dầu tính bằng đơn vị nguyên 1/60 (ADR-001)
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0, justLit: false, fuelU: 0, everLit: false, relit: 0 })),
    successfulLights: 0,
    motes: [],
    shades: [],
    drifters: [],
    charms: map.charms.map((c) => ({ id: c.id, pos: [...c.pos], available: true, respawn: 0 })),
    wind: { enabled: map.wind, active: false, dir: 0, t: 0 },
    ids: { mote: 1, shade: 1, drifter: 1 },
    reservedShadeIds: new Set(),
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    randomDrifters: sc.random_drifters !== false && map.drifters,
  };
  if ('wind_enabled' in sc) g.wind.enabled = sc.wind_enabled;

  if (g.randomMotes) {
    const pts = map.moteSpawns.map((_, i) => i);
    for (let i = 0; i < R.moteInitial && pts.length; i++) {
      const k = Math.floor(g.rng() * pts.length);
      const idx = pts.splice(k, 1)[0];
      addMote(g, [...map.moteSpawns[idx]], 'random', null, idx);
    }
  }

  // --- scenario (không phát sự kiện, không cộng điểm) ---
  const p = g.player;
  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) p.pos = [...sp.pos];
    if ('carried' in sp) p.carried = sp.carried;
    if ('flames' in sp) p.flames = sp.flames;
    if ('invuln_ticks' in sp) p.invuln = sp.invuln_ticks;
    if ('dash_cd_ticks' in sp) p.dashCd = sp.dash_cd_ticks;
    if ('pulse_cd_ticks' in sp) p.pulseCd = sp.pulse_cd_ticks;
    if ('charm_ticks' in sp) p.charm = sp.charm_ticks;
    if ('successful_lights' in sp) g.successfulLights = sp.successful_lights;
  }
  const gh = groundAt(g, p.pos[0], p.pos[2]);
  p.grounded = gh !== null && Math.abs(p.pos[1] - gh) < 1e-6;
  if (sc.motes) {
    g.motes = [];
    g.ids.mote = 1;
    for (const m of sc.motes) {
      if (Array.isArray(m)) addMote(g, [...m], 'random', null, -1);
      else {
        const kind = m.kind === 'dropped' ? 'dropped' : 'random';
        const ttl = 'ttl_ticks' in m ? m.ttl_ticks : 'ttl_s' in m && m.ttl_s != null ? secToTicks(m.ttl_s) : kind === 'dropped' ? R.dropTtlTicks : null;
        addMote(g, [...m.pos], kind, ttl, -1);
      }
    }
  }
  if (sc.shades) {
    g.shades = [];
    g.reservedShadeIds = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of sc.shades) {
      const sh = newShade(s.id || nextShadeId(g), [...s.pos]);
      const st = s.state;
      const left = s.state_ticks_left;
      const d = distXZ(sh.pos, p.pos);
      sh.mode = d <= R.shadeDetect ? 'chase' : 'wander';
      if (st === 'chase' || st === 'wander') sh.mode = st;
      else if (st === 'spawning') sh.spawnT = left ?? R.shadeSpawningTicks;
      else if (st === 'stunned') sh.stun = left ?? R.pulseStunTicks;
      else if (st === 'recoil') {
        sh.recoilT = left ?? R.shadeRecoilTicks;
        const dir = dirXZ(p.pos, sh.pos);
        sh.recoilDir = dir;
      }
      g.shades.push(sh);
    }
  }
  if (sc.drifters) {
    g.drifters = [];
    for (const d of sc.drifters) {
      const id = d.id || `D${g.ids.drifter}`;
      g.ids.drifter = Math.max(g.ids.drifter, idNum(id) + 1);
      g.drifters.push({
        id, pos: [...d.pos], state: d.state || 'idle', stolen: d.stolen || 0,
        fleeT: d.state === 'flee' ? (d.state_ticks_left ?? R.drifterFleeTicks) : 0,
        stoleOnce: (d.stolen || 0) > 0, dir: [1, 0], dirT: 0,
      });
    }
  }
  if (sc.charms) {
    g.charms = sc.charms.map((c, i) => ({
      id: c.id || `C${i + 1}`, pos: [...c.pos],
      available: c.available !== false,
      respawn: c.available === false ? (c.respawn_ticks ?? (c.respawn_s != null ? secToTicks(c.respawn_s) : R.charmRespawnTicks)) : 0,
    }));
  }
  if (sc.lanterns) {
    for (const l of sc.lanterns) {
      const t = g.lanterns.find((x) => x.id === l.id);
      if (!t) continue;
      if (l.pos) t.pos = [...l.pos];
      if ('deposited' in l) t.deposited = l.deposited;
      if ('lit' in l) t.lit = l.lit;
      if ('ever_lit' in l) t.everLit = l.ever_lit;
      if ('relit_count' in l) t.relit = l.relit_count;
      if (t.lit) {
        t.fuelU = Math.round(('fuel' in l ? l.fuel : T.fuel_max) * TICK_RATE);
        t.everLit = 'ever_lit' in l ? l.ever_lit : true;
        if (!('deposited' in l)) t.deposited = t.everLit && t.relit > 0 ? T.relight_cost : T.lantern_cost;
      } else t.fuelU = 0;
    }
  }
  // Bóng Mực drain trong scenario: mục tiêu là target_lantern_id hoặc đèn gần nhất
  if (sc.shades) {
    sc.shades.forEach((s, i) => {
      const sh = g.shades[i];
      if (s.target_lantern_id) sh.target = s.target_lantern_id;
      if (s.state === 'drain') {
        sh.mode = 'drain';
        if (!sh.target) sh.target = nearestLantern(g, sh.pos, () => true)?.id ?? null;
      }
    });
  }
  return g;
}

export function capacity(g) {
  return Math.min(g.T.capacity_max ?? g.T.carry_capacity, g.T.carry_capacity + 2 * g.successfulLights);
}

const LOW = (g) => g.T.low_fuel_threshold * TICK_RATE;
export const fuelOf = (l) => l.fuelU / TICK_RATE;

function nearestLantern(g, pos, pred) {
  let best = null, bd = Infinity;
  for (const l of g.lanterns) {
    if (!pred(l)) continue;
    const d = distXZ(pos, l.pos);
    if (d < bd - EPS || (Math.abs(d - bd) <= EPS && best && idNum(l.id) < idNum(best.id))) [best, bd] = [l, d];
  }
  return best;
}

function evictFrom(g, l) {
  for (const s of g.shades) {
    const d = distXZ(s.pos, l.pos);
    if (d < g.T.safe_radius - EPS) {
      s.evictT = R.evictTicks;
      s.evictStep = (g.T.safe_radius - d) / R.evictTicks;
      s.evictDir = dirXZ(l.pos, s.pos);
      if (s.mode === 'drain') s.mode = 'wander';
    }
  }
}

function newShade(id, pos) {
  return { id, pos, mode: 'wander', target: null, drainT: 0, spawnT: 0, stun: 0, pushT: 0, pushDir: [1, 0], recoilT: 0, recoilDir: [1, 0], evictT: 0, evictStep: 0, evictDir: [1, 0], wanderDir: [1, 0], wanderT: 0 };
}

function nextShadeId(g) {
  let id;
  do id = `S${g.ids.shade++}`;
  while (g.reservedShadeIds.has(id) || g.shades.some((s) => s.id === id));
  return id;
}

function addMote(g, pos, kind, ttl, point) {
  g.motes.push({ id: `M${g.ids.mote++}`, pos, kind, ttl, point });
}

export function groundAt(g, x, z) {
  return g.map.ground(x, z);
}

function inTower(g, x, z, y) {
  const t = g.map.tower;
  return !!t && Math.hypot(x - t.x, z - t.z) < t.r && y < t.top;
}

/** Người chơi có đi được tới (x,z) với chân ở độ cao y không. */
function playerCanEnter(g, x, z, y) {
  if (inTower(g, x, z, y)) return false;
  const h = groundAt(g, x, z);
  return h === null || h <= y + R.stepUp;
}

function shadeSpot(g, x, z) {
  const h = groundAt(g, x, z);
  if (h === null) return 'void';
  if (inTower(g, x, z, h)) return 'tower';
  return null;
}

/** Điểm (x,z) nằm trong vùng an toàn nào (trả về đèn). */
function zoneAt(g, x, z) {
  const Rz = g.T.safe_radius;
  for (const l of g.lanterns) if (l.lit && l.fuelU >= LOW(g) && Math.hypot(x - l.pos[0], z - l.pos[2]) < Rz - EPS) return l;
  return null;
}

function setShadeY(g, s) {
  const h = groundAt(g, s.pos[0], s.pos[2]);
  if (h !== null) s.pos[1] = h + R.shadeHover;
}

/** Di chuyển Bóng Mực có vật cản. mode 'block': dừng nếu gặp vật cản (đẩy lùi). 'slide': trượt/kẹp mép. */
function moveShade(g, s, dx, dz, mode) {
  let nx = s.pos[0] + dx, nz = s.pos[2] + dz;
  const z = zoneAt(g, nx, nz);
  if (z) {
    if (mode === 'block') return false;
    const d = dirXZ(z.pos, [nx, 0, nz]);
    nx = z.pos[0] + d[0] * g.T.safe_radius;
    nz = z.pos[2] + d[1] * g.T.safe_radius;
  }
  if (!shadeSpot(g, nx, nz)) {
    s.pos[0] = nx;
    s.pos[2] = nz;
    setShadeY(g, s);
    return true;
  }
  if (mode === 'block') return false;
  for (const [ax, az] of [[dx, 0], [0, dz]]) {
    const tx = s.pos[0] + ax, tz = s.pos[2] + az;
    if ((ax || az) && !shadeSpot(g, tx, tz) && !zoneAt(g, tx, tz)) {
      s.pos[0] = tx;
      s.pos[2] = tz;
      setShadeY(g, s);
      return true;
    }
  }
  return false;
}

export function shadeState(s) {
  if (s.spawnT > 0) return 'spawning';
  if (s.stun > 0) return 'stunned';
  if (s.recoilT > 0 || s.evictT > 0) return 'recoil';
  return s.mode;
}

export function litNeeded(g) {
  return Math.ceil(g.T.win_ratio * g.lanterns.length - EPS);
}

export function timeLeft(g) {
  return g.timeLeftStart - g.sim / TICK_RATE;
}

/** Một bước: đọc input của tick k = g.tick, tạo trạng thái k+1. Trả về event (tick = k+1). */
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const T = g.T;
  const p = g.player;
  g.tick += 1;
  const tick = g.tick;
  const events = [];
  const ev = (name, data) => events.push({ type: 'event', tick, name, data });

  // 1. Input; pause xử lý trước
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!input[b] && !g.prev[b];
    g.prev[b] = !!input[b];
  }
  if (pressed.pause) {
    g.paused = !g.paused;
    ev(g.paused ? 'paused' : 'resumed', {});
    if (g.paused) return events;
  } else if (g.paused) return events;

  // 2. Bộ đếm
  g.sim += 1;
  if (p.invuln > 0) p.invuln--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.charm > 0) p.charm--;
  if (p.waiting && p.waitT > 0) p.waitT--;
  for (const s of g.shades) {
    if (s.stun > 0) s.stun--;
    if (s.spawnT > 0) s.spawnT--;
  }
  g.motes = g.motes.filter((m) => m.ttl === null || --m.ttl > 0);
  for (const c of g.charms) if (!c.available && --c.respawn <= 0) {
    c.available = true;
    c.respawn = 0;
  }
  // Gió mạnh là bộ đếm: hoạt động trong các sim tick [1800k, 1800k + 300) (B18)
  if (g.wind.enabled && g.sim % R.windEveryTicks === 0) {
    g.wind.active = true;
    g.wind.t = R.windTicks;
    g.wind.dir = Math.floor(g.rng() * 360);
  } else if (g.wind.active && --g.wind.t <= 0) g.wind.active = false;
  // Dầu đèn (Ticket-03): hao 1/60 mỗi tick + 5/60 cho mỗi Bóng Mực đang drain; hết dầu thì tắt ngay sau bước 2
  const decayU = Math.round(T.fuel_decay_per_s), drainU = Math.round(T.drain_per_s);
  for (const l of g.lanterns) if (l.lit) l.fuelU -= decayU;
  for (const s of g.shades) {
    if (s.mode !== 'drain' || s.stun > 0 || s.evictT > 0) continue;
    const l = g.lanterns.find((x) => x.id === s.target);
    if (!l || !l.lit) continue;
    l.fuelU -= drainU;
    s.drainT++;
    if (s.drainT % TICK_RATE === 0) ev('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: Math.round(Math.max(0, l.fuelU) / 6) / 10 });
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) {
      l.lit = false;
      l.fuelU = 0;
      l.deposited = 0;
      ev('lantern_out', { lantern_id: l.id });
    }
  }

  // 3. Di chuyển Mây rồi kiểm tra rơi
  if (p.waiting) {
    p.vel = [0, 0, 0];
    if (p.waitT <= 0) {
      p.waiting = false;
      p.pos = [...g.map.start];
      p.grounded = true;
      p.launch = null;
      p.dashT = 0;
      p.invuln = secToTicks(T.invuln_s);
    }
  } else {
    movePlayer(g, input, pressed, ev);
    if (p.pos[1] < R.fallY) {
      p.flames = Math.max(0, p.flames - 1);
      const lost = p.carried;
      p.carried = 0;
      p.waiting = true;
      p.waitT = R.respawnWaitTicks;
      p.vel = [0, 0, 0];
      ev('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. Nhặt đom đóm và bùa
  if (!p.waiting) {
    const keep = [];
    for (const m of g.motes) {
      if (p.carried < capacity(g) && distXZ(p.pos, m.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - m.pos[1]) <= R.pickupDy + EPS) {
        p.carried++;
        ev('mote_picked', { carried: p.carried });
      } else keep.push(m);
    }
    g.motes = keep;
    for (const c of g.charms) {
      if (c.available && distXZ(p.pos, c.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= R.pickupDy + EPS) {
        c.available = false;
        c.respawn = R.charmRespawnTicks;
        p.charm = R.charmTicks;
        ev('charm_picked', { charm_id: c.id, charm_ticks: R.charmTicks });
      }
    }
  }

  // 5. Tương tác với đèn
  if (pressed.interact && !p.waiting && p.carried > 0) {
    const maxU = T.fuel_max * TICK_RATE, perMoteU = T.fuel_per_mote * TICK_RATE;
    const refuelUsed = (l) => Math.min(p.carried, Math.ceil((maxU - l.fuelU) / perMoteU));
    // chỉ xét đèn nhận được: chưa sáng, hoặc sáng nhưng chưa đầy dầu
    const best = nearestLantern(g, p.pos, (l) => distXZ(p.pos, l.pos) <= T.interact_radius + EPS && (!l.lit || refuelUsed(l) > 0));
    if (best && !best.lit) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        g.score += amount * T.score.per_mote;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true;
        best.justLit = true;
        best.fuelU = maxU;
        best.everLit = true;
        if (relight) best.relit++;
        g.successfulLights++;
        g.score += relight ? T.score.per_relight : T.score.per_lantern;
        ev('lantern_lit', { lantern_id: best.id, relight });
      }
    } else if (best) {
      const used = refuelUsed(best);
      const wasLow = best.fuelU < LOW(g);
      best.fuelU = Math.min(maxU, best.fuelU + perMoteU * used);
      p.carried -= used;
      g.score += used * T.score.per_mote;
      ev('refuel', { lantern_id: best.id, amount: used, fuel: Math.round(best.fuelU / 6) / 10 });
      if (wasLow && best.fuelU >= LOW(g)) best.justLit = true; // vùng an toàn trở lại: đẩy bóng ra (C5)
    }
  }

  // 6. Vùng an toàn: đèn vừa thắp đẩy Bóng Mực bên trong ra mép trong 30 tick
  for (const l of g.lanterns) {
    if (!l.justLit) continue;
    l.justLit = false;
    evictFrom(g, l);
  }
  for (const s of g.shades) {
    if (s.evictT <= 0) continue;
    s.pos[0] += s.evictDir[0] * s.evictStep;
    s.pos[2] += s.evictDir[1] * s.evictStep;
    setShadeY(g, s);
    s.evictT--;
  }

  // 7. Tỏa Sáng
  if (pressed.pulse && !p.waiting && p.pulseCd <= 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + R.pulseCenterDy, p.pos[2]];
    const ids = [];
    for (const s of g.shades) {
      if (dist3(c, s.pos) > T.pulse_radius + EPS) continue;
      const wasDrain = s.mode === 'drain' && s.stun <= 0 && s.evictT <= 0 && s.spawnT <= 0;
      s.stun = R.pulseStunTicks;
      s.pushT = R.pulsePushTicks;
      s.pushDir = dirXZ(p.pos, s.pos);
      s.recoilT = 0;
      s.mode = 'wander'; // hết choáng thì về wander (Ticket-03)
      ids.push(s.id);
      g.score += wasDrain ? (T.score.per_stun_drain ?? T.score.per_stun) : T.score.per_stun;
    }
    ev('pulse', { stunned_ids: ids });
    for (const d of g.drifters) {
      if (dist3(c, d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.fleeT = R.drifterFleeTicks;
        d.fresh = true;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const h = groundAt(g, d.pos[0], d.pos[2]);
        for (let i = 0; i < amount; i++) addMote(g, [d.pos[0], h ?? p.pos[1], d.pos[2]], 'dropped', R.dropTtlTicks, -1);
        d.stolen = 0;
        d.fleeT = R.drifterDropFleeTicks;
        d.fresh = true;
        ev('drifter_drop', { drifter_id: d.id, amount });
      }
    }
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  const sv = g.shadeSpeed / TICK_RATE;
  for (const s of g.shades) {
    if (s.evictT > 0 || s.spawnT > 0) continue;
    if (s.stun > 0) {
      if (s.pushT > 0) {
        const k = T.pulse_push_m / R.pulsePushTicks;
        if (moveShade(g, s, s.pushDir[0] * k, s.pushDir[1] * k, 'block')) s.pushT--;
        else s.pushT = 0;
      }
      continue;
    }
    if (s.recoilT > 0) {
      const k = R.shadeRecoilM / R.shadeRecoilTicks;
      moveShade(g, s, s.recoilDir[0] * k, s.recoilDir[1] * k, 'block');
      s.recoilT--;
      continue;
    }
    const d = p.waiting ? Infinity : distXZ(s.pos, p.pos);
    if (s.mode === 'drain') {
      // Từ drain: chase nếu Mây ≤ 6 m; wander nếu đèn tắt, fuel ≥ 30, hoặc cách > 2 m
      const l = g.lanterns.find((x) => x.id === s.target);
      if (d <= T.safe_radius + EPS) s.mode = 'chase';
      else if (!l || !l.lit || l.fuelU >= LOW(g) || distXZ(s.pos, l.pos) > R.drainRange + EPS) s.mode = 'wander';
      else continue; // đứng yên hút dầu
      s.drainT = 0;
    } else if (d <= R.shadeDetect + EPS) s.mode = 'chase';
    else if (d > R.shadeGiveUp + EPS) s.mode = 'wander';
    if (s.mode === 'wander') {
      // Chỉ bóng wander chọn đèn yếu (sáng, fuel < 30) gần nhất; không có thì về đèn tắt gần nhất (C1)
      const weak = nearestLantern(g, s.pos, (l) => l.lit && l.fuelU < LOW(g));
      if (weak) {
        s.target = weak.id;
        const dl = distXZ(s.pos, weak.pos);
        if (dl <= R.drainRange + EPS) {
          s.mode = 'drain';
          s.drainT = 0;
          continue;
        }
        const step_ = Math.min(sv, dl - R.drainRange + 1e-4);
        const u = dirXZ(s.pos, weak.pos);
        moveShade(g, s, u[0] * step_, u[1] * step_, 'slide');
        continue;
      }
      const dark = nearestLantern(g, s.pos, (l) => !l.lit);
      if (dark && distXZ(s.pos, dark.pos) > R.drainRange + EPS) {
        s.target = dark.id;
        const u = dirXZ(s.pos, dark.pos);
        const k = R.shadeWanderSpeed / TICK_RATE;
        if (moveShade(g, s, u[0] * k, u[1] * k, 'slide')) continue;
      }
    }
    if (s.mode === 'chase') {
      if (d <= sv) moveShade(g, s, p.pos[0] - s.pos[0], p.pos[2] - s.pos[2], 'slide');
      else {
        const u = dirXZ(s.pos, p.pos);
        moveShade(g, s, u[0] * sv, u[1] * sv, 'slide');
      }
    } else {
      if (--s.wanderT <= 0) {
        const a = g.rng() * 2 * Math.PI;
        s.wanderDir = [Math.cos(a), Math.sin(a)];
        s.wanderT = R.shadeWanderTurnTicks;
      }
      const k = R.shadeWanderSpeed / TICK_RATE;
      if (!moveShade(g, s, s.wanderDir[0] * k, s.wanderDir[1] * k, 'block')) s.wanderT = 0;
    }
  }
  for (const d of g.drifters) moveDrifter(g, d);

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực
  if (!p.waiting) {
    for (const d of [...g.drifters].sort((a, b) => idNum(a.id) - idNum(b.id))) {
      if (d.state !== 'chase' || p.carried <= 0) continue;
      if (distXZ(d.pos, p.pos) > R.drifterTouch + EPS) continue;
      const amount = Math.min(R.drifterSteal, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.stoleOnce = true;
      d.state = 'flee';
      d.fleeT = R.drifterFleeTicks;
      ev('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln <= 0) {
      for (const s of [...g.shades].sort((a, b) => idNum(a.id) - idNum(b.id))) {
        const st = shadeState(s);
        if (st !== 'chase' && st !== 'wander') continue;
        if (distXZ(s.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(s.pos[1] - p.pos[1]) > R.shadeHitDy + EPS) continue;
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = g.rng() * 2 * Math.PI;
          const r = R.dropRingMin + g.rng() * (R.dropRingMax - R.dropRingMin);
          const x = p.pos[0] + r * Math.cos(a), z = p.pos[2] + r * Math.sin(a);
          addMote(g, [x, groundAt(g, x, z) ?? p.pos[1], z], 'dropped', R.dropTtlTicks, -1);
        }
        p.invuln = secToTicks(T.invuln_s);
        s.recoilT = R.shadeRecoilTicks;
        s.recoilDir = dirXZ(p.pos, s.pos);
        ev('player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }

  // 10. Sinh theo lịch (sim tick)
  spawnScheduled(g, ev);

  // 11. Thắng / thua
  // Ticket-03: không thắng sớm; bình minh cần ≥ ceil(win_ratio × n) đèn đang sáng
  let over = null;
  if (p.flames <= 0) over = ['lost', 'no_flames'];
  else if (timeLeft(g) <= EPS) {
    const litNow = g.lanterns.filter((l) => l.lit).length;
    over = litNow >= litNeeded(g) ? ['won', 'dawn_survived'] : ['lost', 'dawn'];
  }
  if (over) {
    g.state = over[0];
    g.result = over[1];
    if (over[0] === 'won') {
      for (const l of g.lanterns) if (l.lit) g.score += T.score.per_lantern_at_dawn + Math.floor(fuelOf(l) + EPS);
      g.score += p.flames * T.score.per_flame_left;
    }
    ev('game_over', { result: over[0], reason: over[1] });
  }
  return events;
}

function movePlayer(g, input, pressed, ev) {
  const T = g.T;
  const p = g.player;
  const [mx, mz] = worldMove(input.move, input.cam_yaw_deg);
  const mlen = Math.hypot(mx, mz);
  if (mlen > 1e-9) p.facing = [mx / mlen, mz / mlen];

  // Lướt
  if (pressed.dash && p.dashT <= 0 && (p.charm > 0 || p.dashCd <= 0)) {
    p.dashDir = mlen > 1e-9 ? [mx / mlen, mz / mlen] : [...p.facing];
    p.dashT = secToTicks(T.dash_duration_s);
    p.dashCd = p.charm > 0 ? 0 : secToTicks(T.dash_cooldown_s);
    ev('dash', {});
  }
  const dashing = p.dashT > 0;

  // Vận tốc ngang
  let vx, vz;
  if (dashing) [vx, vz] = [p.dashDir[0] * T.dash_speed, p.dashDir[1] * T.dash_speed];
  else if (p.launch) [vx, vz] = p.launch;
  else {
    const sp = p.charm > 0 ? R.charmSpeed : T.player_speed;
    [vx, vz] = [mx * sp, mz * sp];
  }
  if (g.wind.active) {
    const a = (g.wind.dir * Math.PI) / 180;
    vx += Math.cos(a) * R.windSpeed;
    vz += Math.sin(a) * R.windSpeed;
  }

  // Nhảy
  if (pressed.jump && p.grounded && !dashing) {
    p.vel[1] = R.jumpVelocity;
    p.grounded = false;
  }

  // Di chuyển ngang có vách / tháp
  const y0 = p.pos[1];
  const tx = p.pos[0] + vx * DT, tz = p.pos[2] + vz * DT;
  if (playerCanEnter(g, tx, tz, y0)) {
    p.pos[0] = tx;
    p.pos[2] = tz;
  } else if (playerCanEnter(g, tx, p.pos[2], y0)) p.pos[0] = tx;
  else if (playerCanEnter(g, p.pos[0], tz, y0)) p.pos[2] = tz;

  // Phương đứng
  const h = groundAt(g, p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (h !== null && h <= y0 + R.stepUp + EPS && h >= y0 - R.stepDown - EPS) {
      p.pos[1] = h;
      p.vel[1] = 0;
    } else {
      p.grounded = false; // bước ra mép
      p.vel[1] = 0;
    }
  } else if (dashing) {
    p.vel[1] = 0; // lướt trên không giữ độ cao
  } else {
    p.pos[1] += p.vel[1] * DT;
    p.vel[1] -= R.gravity * DT;
    if (h !== null && p.pos[1] <= h + EPS && p.vel[1] <= 0 && y0 >= h - R.stepUp) {
      p.pos[1] = h;
      p.vel[1] = 0;
      p.grounded = true;
      p.launch = null;
    }
  }
  p.vel[0] = vx;
  p.vel[2] = vz;
  if (dashing) p.dashT--;

  // Bục nhảy: chân chạm bục khi đang đứng
  if (p.grounded) {
    for (const pad of g.map.pads) {
      if (distXZ(p.pos, pad.pos) <= pad.r + EPS && Math.abs(p.pos[1] - pad.pos[1]) <= 0.05) {
        p.vel[1] = pad.vy;
        p.launch = [...pad.h];
        p.grounded = false;
        break;
      }
    }
  }
}

function nearestCenter(g, pos) {
  let best = g.map.centers[0], bd = Infinity;
  for (const c of g.map.centers) {
    const d = distXZ(c, pos);
    if (d < bd) [best, bd] = [c, d];
  }
  return best;
}

function moveDrifter(g, d) {
  const p = g.player;
  if (d.state === 'removed') return;
  const fast = R.drifterSpeed / TICK_RATE;
  if (d.state === 'flee') {
    const u = dirXZ(p.pos, d.pos);
    d.pos[0] += u[0] * fast;
    d.pos[2] += u[1] * fast;
    // Bộ đếm flee bắt đầu giảm từ tick sau sự kiện (giống khi cướp ở bước 9)
    if (d.fresh) d.fresh = false;
    else if (--d.fleeT <= 0) d.state = 'removed';
  } else {
    const want = !p.waiting && !d.stoleOnce && p.carried >= R.drifterChaseCarry && distXZ(d.pos, p.pos) <= R.drifterChaseDist + EPS;
    d.state = want ? 'chase' : 'idle';
    if (want) {
      const dd = distXZ(d.pos, p.pos);
      if (dd <= fast) {
        d.pos[0] = p.pos[0];
        d.pos[2] = p.pos[2];
      } else {
        const u = dirXZ(d.pos, p.pos);
        d.pos[0] += u[0] * fast;
        d.pos[2] += u[1] * fast;
      }
    } else {
      const slow = R.drifterIdleSpeed / TICK_RATE;
      if (--d.dirT <= 0) {
        const a = g.rng() * 2 * Math.PI;
        d.dir = [Math.cos(a), Math.sin(a)];
        d.dirT = 120;
      }
      if (groundAt(g, d.pos[0] + d.dir[0] * 3, d.pos[2] + d.dir[1] * 3) === null) {
        d.dir = dirXZ(d.pos, nearestCenter(g, d.pos));
      }
      d.pos[0] += d.dir[0] * slow;
      d.pos[2] += d.dir[1] * slow;
    }
  }
  const h = groundAt(g, d.pos[0], d.pos[2]);
  if (h !== null) d.pos[1] = h + R.drifterHover;
}

function spawnScheduled(g, ev) {
  const s = g.sim;
  const map = g.map;
  if (g.randomMotes && s % R.moteEveryTicks === 0) {
    const randomCount = g.motes.filter((m) => m.kind === 'random').length;
    if (randomCount < R.moteCap) {
      const used = new Set(g.motes.filter((m) => m.kind === 'random' && m.point >= 0).map((m) => m.point));
      const free = map.moteSpawns.map((_, i) => i).filter((i) => !used.has(i));
      if (free.length) {
        const idx = free[Math.floor(g.rng() * free.length)];
        addMote(g, [...map.moteSpawns[idx]], 'random', null, idx);
      }
    }
  }
  if (g.randomShades && s >= R.shadeFirstSpawnTick && (s - R.shadeFirstSpawnTick) % map.shadeEveryTicks === 0) {
    const n = s === R.shadeFirstSpawnTick ? 2 : 1;
    const usedNow = new Set();
    for (let i = 0; i < n && g.shades.length < map.shadeMax; i++) {
      const valid = map.shadeSpawns.map((_, k) => k).filter((k) => !usedNow.has(k) && distXZ(map.shadeSpawns[k], g.player.pos) >= R.shadeSpawnMinDist - EPS);
      if (!valid.length) break;
      const k = valid[Math.floor(g.rng() * valid.length)];
      usedNow.add(k);
      const sp = map.shadeSpawns[k];
      const sh = newShade(nextShadeId(g), [sp[0], sp[1] + R.shadeHover, sp[2]]);
      sh.spawnT = R.shadeSpawningTicks;
      g.shades.push(sh);
      ev('shade_spawned', { id: sh.id });
    }
  }
  if (g.randomDrifters && s % R.drifterEveryTicks === 0) {
    const alive = g.drifters.filter((d) => d.state !== 'removed').length;
    if (alive < R.drifterMax) {
      const sp = map.shadeSpawns[Math.floor(g.rng() * map.shadeSpawns.length)];
      g.drifters.push({ id: `D${g.ids.drifter++}`, pos: [sp[0], sp[1] + R.drifterHover, sp[2]], state: 'idle', stolen: 0, fleeT: 0, stoleOnce: false, dir: [1, 0], dirT: 0 });
    }
  }
}

export function snapshot(g) {
  const p = g.player;
  const r3 = (a) => a.map(round3);
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.sim,
    night: g.night,
    state: g.state === 'playing' && g.paused ? 'paused' : g.state,
    time_left_s: round3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: g.wind.dir },
    player: {
      pos: r3(p.pos),
      vel: r3(p.vel),
      grounded: p.grounded,
      invuln: p.invuln > 0,
      flames: p.flames,
      carried: p.carried,
      capacity: capacity(g),
      dash_cd_s: round3(p.dashCd / TICK_RATE),
      pulse_cd_s: round3(p.pulseCd / TICK_RATE),
      charm_s: round3(p.charm / TICK_RATE),
    },
    lanterns: g.lanterns.map((l) => ({
      id: l.id, pos: r3(l.pos), lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? Math.round(l.fuelU / 6) / 10 : 0, ever_lit: l.everLit, relit_count: l.relit,
    })),
    shades: g.shades.map((s) => ({ id: s.id, pos: r3(s.pos), state: shadeState(s) })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: r3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : round3(m.ttl / TICK_RATE) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: r3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: r3(c.pos), available: c.available, respawn_s: round3(c.respawn / TICK_RATE) })),
  };
}
