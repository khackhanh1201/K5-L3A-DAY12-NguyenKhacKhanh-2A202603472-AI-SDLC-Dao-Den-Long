// Phần hiển thị Three.js. Chỉ ĐỌC state từ core và gửi input vào core.step().
// Mọi luật chơi nằm ở src/core; hiệu ứng ở đây không ảnh hưởng headless.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft } from '../core/game.js';
import { NIGHT1, TICK_RATE } from '../core/level.js';

const T = contract.tuning;
const DT = 1 / TICK_RATE;

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT_COLOR = new THREE.Color(0x120a24);
const WARM_COLOR = new THREE.Color(0x3a2440);
scene.background = NIGHT_COLOR.clone();
scene.fog = new THREE.Fog(NIGHT_COLOR.clone(), 18, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
const ambient = new THREE.AmbientLight(0x6a5a9a, 0.35);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);

// Đảo tròn + biển mây
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(NIGHT1.islandRadius, NIGHT1.islandRadius - 3, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2c3b2a, roughness: 1 }),
);
island.position.y = -2;
scene.add(island);
const sea = new THREE.Mesh(
  new THREE.CircleGeometry(200, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a1d45, roughness: 1 }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -5;
scene.add(sea);
// vài khóm cỏ/đá trang trí (cố định, chỉ hiển thị)
{
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3b3550, roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, r = 6 + ((i * 37) % 31);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + (i % 4) * 0.15), rockMat);
    rock.position.set(Math.sin(a) * r, 0.1, Math.cos(a) * r);
    scene.add(rock);
  }
}

// ---------- Mây: nón lá + đèn lồng nhỏ ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5f8fcf }));
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
  head.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0xe6cf8f }));
  hat.position.y = 1.8;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  string.position.set(0, 1.42, 0.7);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  lamp.position.set(0, 1.2, 0.7);
  const light = new THREE.PointLight(0xffb347, 6, 9, 1.5);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- Pools đồng bộ theo id ----------
const moteGeo = new THREE.SphereGeometry(0.12, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
const shadeGeo = new THREE.SphereGeometry(0.75, 18, 14);
const shadeMat = new THREE.MeshStandardMaterial({ color: 0x1a0d2e, emissive: 0x3d1466, emissiveIntensity: 0.6, roughness: 0.3 });
const shadeStunMat = new THREE.MeshStandardMaterial({ color: 0x6b5a85, emissive: 0x9b7bd0, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });

const moteMeshes = new Map();
const shadeMeshes = new Map();
const lanternViews = new Map();

function makeShade() {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(shadeGeo, shadeMat);
  g.add(blob);
  for (const x of [-0.25, 0.25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    eye.position.set(x, 0.15, 0.65);
    g.add(eye);
  }
  g.userData.blob = blob;
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3), new THREE.MeshStandardMaterial({ color: 0x4a2f20 }));
  pole.position.y = 1.5;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a2a, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), lampMat);
  lamp.position.y = 3.4;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x8a2a1a }));
  cap.position.y = 4.05;
  const light = new THREE.PointLight(0xffa040, 0, 18, 1.3);
  light.position.y = 3.4;
  // vòng an toàn (chỉ hiện khi đã thắp)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(pole, lamp, cap, light, ring);
  return { group: g, lampMat, light, ring, fill: 0 };
}

// Sáng tạo: đom đóm đang mang bay vòng quanh Mây
const orbitGroup = new THREE.Group();
scene.add(orbitGroup);
const orbitMeshes = [];
for (let i = 0; i < T.carry_capacity; i++) {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.visible = false;
  orbitGroup.add(m);
  orbitMeshes.push(m);
}

// Hiệu ứng tỏa sáng
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 1, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseAnim = 0;
let hitFlash = 0;

// ---------- Input ----------
const keys = new Set();
let camYaw = 0; // độ, cùng quy ước với cam_yaw_deg của contract
let dragging = false, lastX = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR' && game && game.state !== 'playing') restart();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});

function readInput() {
  // Camera nhìn theo hướng tiến; phía phải màn hình là -x của contract khi yaw = 0,
  // nên phím D gửi x = -1 để "sang phải" trên màn hình.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  return {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF'),
    dash: false,
  };
}

// ---------- Game loop ----------
let game = null;
let running = false;

function restart() {
  for (const m of moteMeshes.values()) scene.remove(m);
  for (const m of shadeMeshes.values()) scene.remove(m);
  for (const v of lanternViews.values()) scene.remove(v.group);
  moteMeshes.clear(); shadeMeshes.clear(); lanternViews.clear();
  game = createGame(T, { seed: (Date.now() & 0x7fffffff) });
  camYaw = 0;
  document.getElementById('overlay').style.display = 'none';
  running = true;
}

function handleEvents(events) {
  for (const e of events) {
    if (e.name === 'pulse') pulseAnim = 1;
    if (e.name === 'player_hit') hitFlash = 1;
    if (e.name === 'lantern_lit') {
      const v = lanternViews.get(e.data.lantern_id);
      if (v) v.flash = 1;
    }
    if (e.name === 'game_over') showGameOver(e.data);
  }
}

const REASONS = {
  all_lit: 'Cả năm Đèn Lồng Lớn đã sáng. Đảo Bến ấm áp trở lại!',
  dawn: 'Trời đã sáng mà đảo vẫn chưa được thắp hết đèn.',
  no_flames: 'Ngọn lửa của Mây đã tắt. Hãy nghỉ một chút rồi thử lại nhé.',
};
function showGameOver({ result, reason }) {
  running = false;
  document.getElementById('o-title').textContent = result === 'won' ? 'Chiến thắng!' : 'Thua rồi';
  document.getElementById('o-reason').textContent = REASONS[reason] || reason;
  document.getElementById('o-score').textContent = game.score;
  document.getElementById('overlay').style.display = 'flex';
}

function sync(t) {
  const g = game;
  const p = g.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const yawRad = (camYaw * Math.PI) / 180;
  const inp = readInput();
  if (inp.move[0] || inp.move[1]) {
    const len = Math.hypot(inp.move[0], inp.move[1]);
    const c = Math.cos(yawRad), s = Math.sin(yawRad);
    const mx = (inp.move[0] * c + inp.move[1] * s) / len;
    const mz = (-inp.move[0] * s + inp.move[1] * c) / len;
    may.rotation.y = Math.atan2(mx, mz);
  }
  may.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);

  // camera phía sau người chơi
  const fx = Math.sin(yawRad), fz = Math.cos(yawRad);
  camera.position.set(p.pos[0] - fx * 9, p.pos[1] + 6, p.pos[2] - fz * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  // đom đóm
  const alive = new Set();
  for (const m of g.motes) {
    alive.add(m.id);
    let mesh = moteMeshes.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeo, moteMat);
      scene.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    const ph = parseInt(m.id.slice(1), 10);
    mesh.position.set(m.pos[0], 0.8 + Math.sin(t * 2 + ph) * 0.25, m.pos[2]);
  }
  for (const [id, mesh] of moteMeshes) if (!alive.has(id)) { scene.remove(mesh); moteMeshes.delete(id); }

  // đom đóm đang mang bay quanh Mây
  orbitMeshes.forEach((m, i) => {
    m.visible = i < p.carried;
    const a = t * 2 + (i * 2 * Math.PI) / Math.max(1, p.carried);
    m.position.set(p.pos[0] + Math.cos(a) * 1.1, p.pos[1] + 1.3 + Math.sin(t * 3 + i) * 0.2, p.pos[2] + Math.sin(a) * 1.1);
  });

  // Bóng Mực
  const sAlive = new Set();
  for (const s of g.shades) {
    sAlive.add(s.id);
    let mesh = shadeMeshes.get(s.id);
    if (!mesh) { mesh = makeShade(); scene.add(mesh); shadeMeshes.set(s.id, mesh); }
    mesh.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.id.length) * 0.1, s.pos[2]);
    mesh.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    mesh.userData.blob.material = s.stun > 0 ? shadeStunMat : shadeMat;
  }
  for (const [id, mesh] of shadeMeshes) if (!sAlive.has(id)) { scene.remove(mesh); shadeMeshes.delete(id); }

  // Đèn lồng
  let lit = 0;
  for (const l of g.lanterns) {
    let v = lanternViews.get(l.id);
    if (!v) { v = makeLantern(); scene.add(v.group); lanternViews.set(l.id, v); }
    v.group.position.set(l.pos[0], 0, l.pos[2]);
    const target = l.lit ? 1 : (l.deposited / T.lantern_cost) * 0.25;
    v.fill += (target - v.fill) * 0.05;
    v.flash = Math.max(0, (v.flash || 0) - 0.02);
    v.lampMat.emissive.setRGB(1.0 * v.fill, 0.55 * v.fill, 0.15 * v.fill);
    v.light.intensity = 40 * v.fill + 60 * v.flash;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
    if (l.lit) lit++;
  }

  // Đảo sáng dần lên theo số đèn đã thắp
  const k = lit / g.lanterns.length;
  ambient.intensity = 0.55 + 0.9 * k;
  scene.background.copy(NIGHT_COLOR).lerp(WARM_COLOR, k);
  scene.fog.color.copy(scene.background);
  scene.fog.far = 60 + 60 * k;

  // hiệu ứng
  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - 0.04);
    const r = T.pulse_radius * (1 - pulseAnim);
    pulseRing.scale.set(r, r, r);
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    pulseRing.material.opacity = pulseAnim;
  } else pulseRing.material.opacity = 0;
  if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - 0.04);
  renderer.domElement.style.filter = hitFlash > 0 ? `saturate(${1 - hitFlash * 0.7}) hue-rotate(${hitFlash * 40}deg)` : '';

  // HUD
  const tl = Math.max(0, timeLeft(g));
  document.getElementById('h-flames').textContent = `${p.flames} / ${T.flames}`;
  document.getElementById('h-carried').textContent = `${p.carried} / ${T.carry_capacity}`;
  document.getElementById('h-lit').textContent = `${lit} / ${g.lanterns.length}`;
  document.getElementById('h-time').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  document.getElementById('h-score').textContent = g.score;
  document.getElementById('h-pulse').textContent =
    p.pulseCd > 0 ? `chờ ${(p.pulseCd / TICK_RATE).toFixed(1)}s` : p.carried >= T.pulse_cost ? 'sẵn sàng' : `cần ${T.pulse_cost} đom đóm`;
}

let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (game) {
    if (running) {
      if (keys.has('ArrowLeft')) camYaw += 120 * dt;
      if (keys.has('ArrowRight')) camYaw -= 120 * dt;
      acc += dt;
      while (acc >= DT && running) {
        handleEvents(step(game, readInput()));
        acc -= DT;
      }
    }
    sync(now / 1000);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('start').addEventListener('click', () => {
  document.getElementById('intro').style.display = 'none';
  restart();
});
document.getElementById('again').addEventListener('click', restart);

// cho kiểm thử qua trình duyệt (chỉ đọc)
window.__game = () => game;
