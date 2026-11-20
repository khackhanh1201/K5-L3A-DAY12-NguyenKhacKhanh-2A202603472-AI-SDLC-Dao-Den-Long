// Dựng cảnh 3D cho từng Đêm và đồng bộ thực thể từ state của core (chỉ đọc).
import * as THREE from 'three';
import { RULES, NIGHTS } from '../core/level.js';
import { shadeState } from '../core/game.js';

// Bảng màu chuẩn Ticket-02
export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeRimCB: 0x00b3ff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.sky);
  scene.fog = new THREE.Fog(PAL.fog, 25, 110);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const ambient = new THREE.AmbientLight(0xb8c4ff, 0.15);
  const hemi = new THREE.HemisphereLight(0x5a6aa8, 0x1b2350, 0.35);
  const moon = new THREE.DirectionalLight(0xaab8ff, 0.4);
  moon.position.set(-30, 60, -20);
  scene.add(ambient, hemi, moon);

  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat(PAL.sea));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -12;
  scene.add(sea);

  const level = new THREE.Group();
  scene.add(level);

  // tài nguyên dùng chung (tránh tạo lại mỗi frame)
  const geo = {
    mote: new THREE.SphereGeometry(0.13, 8, 6),
    halo: new THREE.SphereGeometry(0.3, 10, 8),
    shade: new THREE.SphereGeometry(0.7, 16, 12),
    shadeRim: new THREE.SphereGeometry(0.78, 16, 12),
    eye: new THREE.SphereGeometry(0.09, 8, 6),
    charm: new THREE.BoxGeometry(0.5, 0.75, 0.06), // dày hơn viền để mặt đỏ nổi ở cả hai phía
    charmBorder: new THREE.BoxGeometry(0.6, 0.85, 0.03),
  };
  const mats = {
    mote: basic(PAL.moteCore),
    halo: basic(PAL.moteHalo, { transparent: true, opacity: 0.35, depthWrite: false }),
    drop: basic(PAL.moteHalo),
    shade: mat(PAL.shadeBody, { emissive: 0x05020a }),
    rim: basic(PAL.shadeRim, { side: THREE.BackSide }),
    stun: mat(PAL.shadeStun, { transparent: true, opacity: 0.75 }),
    stunRim: basic(PAL.shadeStun, { side: THREE.BackSide }),
    eye: basic(0xd9c2ff),
    charm: basic(PAL.scarf),
    charmBorder: basic(PAL.gold),
    drifter: new THREE.MeshLambertMaterial({ color: PAL.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  };

  // Mây: áo, khăn đỏ, nón lá, đèn lồng nhỏ
  const may = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.6, 4, 12), mat(PAL.shirt));
    body.position.y = 0.65;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), mat(PAL.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.12;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0xf2c9a0));
    head.position.y = 1.38;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.42, 24), mat(PAL.sand));
    hat.position.y = 1.72;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), basic(PAL.lampOn));
    lamp.position.set(0, 1.18, 0.66);
    const light = new THREE.PointLight(PAL.lampOn, 5, 10, 1.5);
    light.position.copy(lamp.position);
    may.add(body, scarf, head, hat, lamp, light);
  }
  scene.add(may);

  // đom đóm đang mang bay quanh Mây (sáng tạo Phase 1)
  const orbit = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(geo.mote, mats.mote);
    m.visible = false;
    scene.add(m);
    return m;
  });

  // vòng Tỏa Sáng
  const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), basic(PAL.lampCore, { transparent: true, opacity: 0, side: THREE.DoubleSide }));
  pulseRing.rotation.x = -Math.PI / 2;
  scene.add(pulseRing);

  // lá bay báo gió
  const leaves = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.12), basic(0x9fc46a, { side: THREE.DoubleSide }));
    l.userData.seed = Math.random() * 100;
    leaves.add(l);
  }
  leaves.visible = false;
  scene.add(leaves);

  const pools = { motes: new Map(), shades: new Map(), lanterns: new Map(), drifters: new Map(), charms: new Map() };
  let fx = { pulse: 0, hitFlash: 0 };

  function clearLevel() {
    for (const m of [...pools.motes.values(), ...pools.shades.values(), ...pools.drifters.values(), ...pools.charms.values()]) scene.remove(m);
    for (const v of pools.lanterns.values()) scene.remove(v.group);
    Object.values(pools).forEach((p) => p.clear());
    level.clear();
  }

  function buildLevel(night) {
    clearLevel();
    const map = NIGHTS[night];
    const disc = (r, h, x = 0, z = 0, color = PAL.grass) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 1.5, h, 64), mat(color));
      m.position.set(x, -h / 2, z);
      level.add(m);
      const rim = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 64), mat(PAL.sand));
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(x, 0.02, z);
      level.add(rim);
    };
    const pad = (p) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 24), basic(PAL.gold));
      m.position.set(p.pos[0], p.pos[1] + 0.06, p.pos[2]);
      level.add(m);
    };
    if (night === 1) disc(40, 6);
    if (night === 2) {
      disc(28, 6);
      disc(28, 6, 70, 0);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(PAL.wood));
      bridge.position.set(35, -0.15, 0);
      level.add(bridge);
      for (let x = 27; x <= 43; x += 2) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 4.05), mat(0x553a24));
        plank.position.set(x, -0.14, 0);
        level.add(plank);
      }
    }
    if (night === 3) {
      disc(45, 6);
      // tầng 1: nửa vành khăn 12–24 m ở z > 0
      const s = new THREE.Shape();
      s.absarc(0, 0, 24, 0, Math.PI, false);
      s.lineTo(-12, 0);
      s.absarc(0, 0, 12, Math.PI, 0, true);
      s.lineTo(24, 0);
      const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 32 }), mat(0x356b5c));
      t1.rotation.x = Math.PI / 2; // (x, y, z) -> (x, -z, y): mặt trên ở Y=3, z = r·sinθ > 0
      t1.position.y = 3;
      level.add(t1);
      // tầng 2: đĩa r = 8 cao 6
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(0x3b7766));
      t2.position.y = 3;
      level.add(t2);
      // dốc 30° và 150°
      for (const a of [30, 150]) {
        const w = new THREE.Shape();
        w.moveTo(24, 0);
        w.lineTo(30, 0);
        w.lineTo(24, 3);
        w.lineTo(24, 0);
        const g = new THREE.ExtrudeGeometry(w, { depth: 3, bevelEnabled: false });
        g.translate(0, 0, -1.5);
        const m = new THREE.Mesh(g, mat(PAL.sand));
        m.rotation.y = (-a * Math.PI) / 180;
        level.add(m);
      }
      // tháp chuông
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), mat(0x7b5a3e));
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 8), mat(0x8a2a1a));
      roof.position.y = 15;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), basic(PAL.gold));
      bell.position.y = 13.4;
      level.add(tower, roof, bell);
    }
    map.pads.forEach(pad);
  }

  function makeLantern() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3), mat(PAL.wood));
    pole.position.y = 1.5;
    const lampMat = new THREE.MeshLambertMaterial({ color: PAL.lampOff, emissive: 0x000000 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), lampMat);
    lamp.position.y = 3.4;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basic(PAL.lampCore));
    core.position.y = 3.4;
    core.visible = false;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 8), mat(0x8a2a1a));
    cap.position.y = 4.05;
    const light = new THREE.PointLight(PAL.lampOn, 0, 20, 1.3);
    light.position.y = 3.4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.85, 6, 64), basic(PAL.lampOn, { transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    // vết rách trên giấy đèn tắt (phân biệt không cần màu, Ticket-03)
    const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), basic(0x111111, { side: THREE.DoubleSide }));
    tear.position.set(0.2, 3.35, 0.5);
    tear.rotation.z = 0.5;
    // thanh dầu (billboard)
    const bar = new THREE.Group();
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), basic(0x000000, { transparent: true, opacity: 0.6, depthWrite: false }));
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), basic(PAL.lampOn, { depthWrite: false }));
    barFill.position.z = 0.01;
    bar.add(barBg, barFill);
    bar.position.y = 4.6;
    g.add(pole, lamp, core, cap, light, ring, tear, bar);
    return { group: g, lamp, lampMat, core, light, ring, tear, bar, barFill, fill: 0, flash: 0 };
  }

  function makeShade() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(geo.shadeRim, mats.rim);
    const body = new THREE.Mesh(geo.shade, mats.shade);
    g.add(rim, body);
    for (const x of [-0.24, 0.24]) {
      const e = new THREE.Mesh(geo.eye, mats.eye);
      e.position.set(x, 0.15, 0.62);
      g.add(e);
    }
    g.userData = { rim, body };
    return g;
  }

  function makeDrifter() {
    const geom = new THREE.PlaneGeometry(2.2, 0.35, 16, 1);
    const m = new THREE.Mesh(geom, mats.drifter);
    m.userData.base = geom.attributes.position.array.slice();
    return m;
  }

  function makeCharm() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.charmBorder, mats.charmBorder), new THREE.Mesh(geo.charm, mats.charm));
    return g;
  }

  function syncPool(pool, list, make, update) {
    const alive = new Set();
    for (const e of list) {
      alive.add(e.id);
      let obj = pool.get(e.id);
      if (!obj) {
        obj = make(e);
        scene.add(obj.group || obj);
        pool.set(e.id, obj);
      }
      update(obj, e);
    }
    for (const [id, obj] of pool) if (!alive.has(id)) {
      scene.remove(obj.group || obj);
      pool.delete(id);
    }
  }

  function sync(g, t, camYawDeg) {
    const p = g.player;
    may.position.set(p.pos[0], p.pos[1], p.pos[2]);
    may.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
    may.visible = !p.waiting && !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);

    const yaw = (camYawDeg * Math.PI) / 180;
    const fx_ = Math.sin(yaw), fz = Math.cos(yaw);
    const cy = Math.max(p.pos[1], -4);
    camera.position.set(p.pos[0] - fx_ * 9, cy + 6, p.pos[2] - fz * 9);
    camera.lookAt(p.pos[0], cy + 1.2, p.pos[2]);

    syncPool(pools.motes, g.motes, (m) => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(geo.mote, m.kind === 'dropped' ? mats.drop : mats.mote), new THREE.Mesh(geo.halo, mats.halo));
      return grp;
    }, (obj, m) => {
      const ph = parseInt(m.id.slice(1), 10);
      obj.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(t * 2 + ph) * 0.2, m.pos[2]);
      obj.visible = m.ttl === null || m.ttl > 90 || Math.floor(t * 8) % 2 === 0;
    });

    orbit.forEach((m, i) => {
      m.visible = !p.waiting && i < p.carried;
      const a = t * 2 + (i * 2 * Math.PI) / Math.max(1, p.carried);
      m.position.set(p.pos[0] + Math.cos(a) * 1.1, p.pos[1] + 1.3 + Math.sin(t * 3 + i) * 0.2, p.pos[2] + Math.sin(a) * 1.1);
    });

    syncPool(pools.shades, g.shades, makeShade, (obj, s) => {
      const st = shadeState(s);
      const rise = st === 'spawning' ? 1 - s.spawnT / RULES.shadeSpawningTicks : 1;
      obj.position.set(s.pos[0], s.pos[1] - (1 - rise) * 1.5 + Math.sin(t * 3 + s.pos[0]) * 0.08, s.pos[2]);
      obj.scale.setScalar(0.4 + 0.6 * rise);
      obj.lookAt(p.pos[0], obj.position.y, p.pos[2]);
      const stun = st === 'stunned';
      obj.userData.body.material = stun ? mats.stun : mats.shade;
      obj.userData.rim.material = stun ? mats.stunRim : mats.rim;
    });

    syncPool(pools.drifters, g.drifters.filter((d) => d.state !== 'removed'), makeDrifter, (m, d) => {
      m.position.set(d.pos[0], d.pos[1], d.pos[2]);
      const pos = m.geometry.attributes.position;
      const base = m.userData.base;
      for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] = Math.sin(t * 8 + base[i * 3] * 3) * 0.25;
      pos.needsUpdate = true;
      m.rotation.y = t * 1.5;
    });

    syncPool(pools.charms, g.charms.filter((c) => c.available), makeCharm, (obj, c) => {
      obj.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(t * 2) * 0.15, c.pos[2]);
      obj.rotation.y = t * 1.6;
    });

    let lit = 0;
    syncPool(pools.lanterns, g.lanterns, makeLantern, (v, l) => {
      v.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const fuel = l.fuelU / 60;
      const low = l.lit && fuel < g.T.low_fuel_threshold;
      const blinkOff = low && Math.floor(t * 2) % 2 === 1; // nhấp nháy chậm 1 Hz khi fuel < 30
      const cost = l.everLit ? g.T.relight_cost : g.T.lantern_cost;
      const target = l.lit ? (blinkOff ? 0.25 : 1) : (l.deposited / cost) * 0.3;
      v.fill += (target - v.fill) * (low ? 0.5 : 0.06);
      v.lamp.scale.y = l.lit ? 1 : 0.8; // đèn tắt xẹp 20%
      v.tear.visible = !l.lit;
      v.bar.visible = l.lit && !blinkOff;
      v.barFill.scale.x = Math.max(0.001, fuel / g.T.fuel_max);
      v.barFill.position.x = -0.75 * (1 - fuel / g.T.fuel_max);
      v.barFill.material.color.set(low ? 0xff5a5f : PAL.lampOn);
      v.bar.quaternion.copy(camera.quaternion);
      v.flash = Math.max(0, v.flash - 0.02);
      v.lampMat.color.set(l.lit ? PAL.lampOn : PAL.lampOff);
      v.lampMat.emissive.setRGB(1.0 * v.fill, 0.7 * v.fill, 0.28 * v.fill);
      v.core.visible = l.lit;
      v.light.intensity = 45 * v.fill + 80 * v.flash;
      v.ring.material.opacity = l.lit ? 0.35 : 0;
      if (l.lit) lit++;
    });

    // ánh sáng môi trường = 0.15 + 0.55 × tiến độ (Ticket-02)
    const k = lit / g.lanterns.length;
    ambient.intensity = 0.15 + 0.55 * k;
    hemi.intensity = 0.35 + 0.3 * k;
    scene.fog.far = 110 + 60 * k;

    if (fx.pulse > 0) {
      fx.pulse = Math.max(0, fx.pulse - 0.04);
      const r = g.T.pulse_radius * (1 - fx.pulse);
      pulseRing.scale.setScalar(Math.max(0.01, r));
      pulseRing.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
      pulseRing.material.opacity = fx.pulse;
    } else pulseRing.material.opacity = 0;

    // lá bay: báo trước gió 2 s và trong lúc gió
    const warn = g.wind.enabled && (g.wind.active || (g.sim % RULES.windEveryTicks) >= RULES.windEveryTicks - RULES.windWarnTicks);
    leaves.visible = warn;
    if (warn) {
      const a = (g.wind.dir * Math.PI) / 180;
      leaves.children.forEach((l, i) => {
        const s = l.userData.seed;
        const d = ((t * 6 + s * 3) % 30) - 15;
        l.position.set(p.pos[0] + Math.cos(a) * d + Math.sin(s) * 8, p.pos[1] + 1 + ((s * 7) % 4), p.pos[2] + Math.sin(a) * d + Math.cos(s) * 8);
        l.rotation.set(t * 3 + s, t * 2 + i, 0);
      });
    }
    return lit;
  }

  return {
    scene, camera, buildLevel, sync,
    pulse: () => (fx.pulse = 1),
    setColorblind: (on) => {
      const c = on ? PAL.shadeRimCB : PAL.shadeRim;
      mats.rim.color.set(c);
      mats.eye.color.set(on ? PAL.shadeRimCB : 0xd9c2ff);
    },
    flashLantern: (id) => { const v = pools.lanterns.get(id); if (v) v.flash = 1; },
    resize: (w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
  };
}
