// Bản có giao diện: chuỗi 3 Đêm, HUD, tạm dừng, cài đặt, âm thanh.
// Mọi luật chơi nằm ở src/core; ở đây chỉ gửi input vào core.step() và vẽ lại state.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, capacity, litNeeded } from '../core/game.js';
import { NIGHTS, RULES, TICK_RATE } from '../core/level.js';
import { createWorld } from './world.js';
import { SFX, setVolume, resume as resumeAudio, startMusic, stopMusic } from './audio.js';

const T = contract.tuning;
const DT = 1 / TICK_RATE;
const $ = (id) => document.getElementById(id);

// ---------- Cài đặt (localStorage, có try/catch) ----------
const SETTINGS_KEY = 'ddl-settings-v1';
const settings = { volume: 0.7, sensitivity: 0.6, colorblind: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
setVolume(settings.volume);
$('set-volume').value = settings.volume;
$('set-sens').value = settings.sensitivity;
$('set-volume').addEventListener('input', (e) => { settings.volume = +e.target.value; setVolume(settings.volume); saveSettings(); });
$('set-sens').addEventListener('input', (e) => { settings.sensitivity = +e.target.value; saveSettings(); });
$('set-cb').checked = !!settings.colorblind;
const applyColorblind = () => { document.body.classList.toggle('cb', !!settings.colorblind); world?.setColorblind(!!settings.colorblind); };
$('set-cb').addEventListener('change', (e) => { settings.colorblind = e.target.checked; saveSettings(); applyColorblind(); });

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // skill threejs-scene-setup: giới hạn pixel ratio
document.body.prepend(renderer.domElement);
const world = createWorld(renderer);
world.resize(window.innerWidth, window.innerHeight);
addEventListener('resize', () => world.resize(window.innerWidth, window.innerHeight));
applyColorblind();

// ---------- Màn hình dạng stack (skill game-ui-ux) ----------
const stack = ['scr-menu'];
function showTop() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
  const top = stack[stack.length - 1];
  if (top) {
    const el = $(top);
    el.classList.add('show');
    el.querySelector('button')?.focus();
  }
  $('hud').style.display = stack.length === 0 || top === 'scr-pause' || top === 'scr-settings' ? (game ? 'block' : 'none') : 'none';
}
const push = (id) => { stack.push(id); showTop(); };
const pop = () => { stack.pop(); showTop(); };
const replace = (id) => { stack.length = 0; if (id) stack.push(id); showTop(); };

// ---------- Trạng thái chuỗi 3 Đêm ----------
const QUOTES = {
  1: 'Mây à, sương đen đã phủ kín Đảo Bến. Gom đom đóm, thắp lại năm ngọn đèn lớn trước khi trời sáng nhé. Bóng Mực sợ ánh đèn lắm.',
  2: 'Đảo Cau có hai hòn, nối nhau bằng chiếc cầu tre không lan can. Bục vàng sẽ đưa con bay qua biển mây. Coi chừng Gió Lạc, chúng thích cướp ánh sáng.',
  3: 'Đảo Chuông có ba tầng và những cơn gió mạnh. Thấy lá bay là gió sắp tới. Ngọn đèn cao nhất nằm cạnh tháp chuông, ông tin con làm được.',
};
let night = 1;
let wonScores = {}; // điểm các Đêm đã thắng
let game = null;
let running = false;
let camYaw = 0;
const total = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

function startNight(n) {
  night = n;
  game = createGame(T, { seed: (Date.now() & 0x7fffffff), night: n });
  world.buildLevel(n);
  camYaw = 0;
  lastCountdown = null;
  replace(null);
  running = true;
  resumeAudio();
  startMusic();
}

function showIntro(n) {
  night = n;
  $('intro-title').textContent = `Đêm ${n}`;
  $('intro-island').textContent = NIGHTS[n].name;
  $('intro-quote').textContent = `Ông Đăng: "${QUOTES[n]}"`;
  replace('scr-intro');
}

const REASONS = {
  dawn_survived: 'Bình minh tới, đảo vẫn đủ sáng!',
  dawn: 'Trời đã sáng mà đảo không giữ đủ đèn sáng.',
  no_flames: 'Ngọn lửa của Mây đã tắt.',
};

function endNight(result, reason) {
  running = false;
  stopMusic();
  if (result === 'won') {
    SFX.win();
    wonScores[night] = game.score;
    if (night === 3) {
      $('dawn-total').textContent = total();
      replace('scr-dawn');
      return;
    }
  } else SFX.lose();
  $('res-title').textContent = result === 'won' ? `Đêm ${night} hoàn thành!` : `Đêm ${night} thất bại`;
  $('res-reason').textContent = REASONS[reason] || reason;
  $('res-night').textContent = game.score;
  $('res-total').textContent = total();
  const btns = $('res-btns');
  btns.innerHTML = '';
  const add = (label, act, alt) => { const b = document.createElement('button'); b.textContent = label; b.dataset.act = act; if (alt) b.className = 'alt'; btns.append(b); };
  if (result === 'won') add(`Đêm ${night + 1}`, 'next');
  else add('Chơi lại Đêm', 'restart');
  add('Về menu', 'menu', true);
  replace('scr-result');
}

// ---------- Nút bấm ----------
document.addEventListener('click', (e) => {
  const act = e.target?.dataset?.act;
  if (!act) return;
  resumeAudio();
  SFX.click();
  if (act === 'new') { wonScores = {}; showIntro(1); }
  if (act === 'play') startNight(night);
  if (act === 'next') showIntro(night + 1);
  if (act === 'restart') { delete wonScores[night]; startNight(night); }
  if (act === 'settings') push('scr-settings');
  if (act === 'back') pop();
  if (act === 'resume') { replace(null); running = true; }
  if (act === 'menu') { running = false; game = null; stopMusic(); replace('scr-menu'); }
});

// ---------- Input ----------
const keys = new Set();
let dragging = false, lastX = 0;
function togglePause() {
  if (!game || game.state !== 'playing') return;
  if (running) { running = false; replace('scr-pause'); }
  else if (stack[stack.length - 1] === 'scr-pause') { replace(null); running = true; }
}
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'].includes(e.code) && running) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (running) togglePause(); });
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging || !running) return;
  camYaw -= (e.clientX - lastX) * 0.5 * settings.sensitivity;
  lastX = e.clientX;
});

function readInput() {
  // Camera nhìn theo hướng tiến; phía phải màn hình là -x của contract khi yaw = 0 → D gửi x = -1.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  return {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), pause: false,
  };
}

// ---------- HUD ----------
const FLAME = '<svg viewBox="0 0 24 30"><path fill="#ffb347" d="M12 1C14 7 21 10 21 19a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 0-7 2-11z"/></svg>';
$('hud-motes').innerHTML = '<i></i>'.repeat(T.capacity_max);
let lastCountdown = null;

function updateHud(g, lit) {
  const p = g.player;
  const fl = $('hud-flames');
  if (fl.childElementCount !== T.flames) fl.innerHTML = Array.from({ length: T.flames }, () => `<span>${FLAME}</span>`).join('');
  [...fl.children].forEach((c, i) => c.classList.toggle('off', i >= p.flames));

  const tl = Math.max(0, timeLeft(g));
  const timer = $('hud-timer');
  timer.textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  timer.classList.toggle('danger', tl <= 30);
  if (tl <= 30 && settings.colorblind) timer.textContent = `⚠ ${timer.textContent}`;
  if (tl <= 10 && tl > 0) {
    const s = Math.ceil(tl);
    if (s !== lastCountdown) { lastCountdown = s; SFX.countdown(); }
  }
  $('hud-lit').textContent = `${lit}/${g.lanterns.length} (cần ${litNeeded(g)})`;
  const cap = capacity(g);
  $('hud-cap').textContent = `${p.carried}/${cap}`;
  $('hud-score').textContent = g.score;
  [...$('hud-motes').children].forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? '' : 'none'; });

  const dashMax = Math.round(T.dash_cooldown_s * TICK_RATE);
  const cdDash = $('cd-dash');
  const dashFrac = p.charm > 0 ? 0 : p.dashCd / dashMax;
  cdDash.style.setProperty('--p', `${dashFrac * 100}%`);
  cdDash.classList.toggle('ready', dashFrac === 0);
  const pulseMax = Math.round(T.pulse_cooldown_s * TICK_RATE);
  const cdPulse = $('cd-pulse');
  const pulseFrac = p.pulseCd / pulseMax;
  cdPulse.style.setProperty('--p', `${pulseFrac * 100}%`);
  const pulseReady = pulseFrac === 0 && p.carried >= T.pulse_cost;
  cdPulse.classList.toggle('ready', pulseReady);
  cdPulse.innerHTML = `Tỏa sáng<small>${p.carried < T.pulse_cost ? `cần ${T.pulse_cost}` : 'F'}</small>`;

  const ch = $('hud-charm');
  ch.style.display = p.charm > 0 ? 'block' : 'none';
  ch.textContent = `Bùa Gió ${(p.charm / TICK_RATE).toFixed(1)}s`;

  const windSoon = g.wind.enabled && !g.wind.active && (g.sim % RULES.windEveryTicks) >= RULES.windEveryTicks - RULES.windWarnTicks;
  $('hud-wind').style.display = windSoon || g.wind.active ? 'block' : 'none';
  $('hud-wind').textContent = g.wind.active ? 'Gió mạnh!' : 'Gió sắp thổi!';

  // Nhắc nạp đèn khi đứng gần đèn chưa sáng
  let near = null, nearD = Infinity, target = null, targetD = Infinity;
  for (const l of g.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (d <= T.interact_radius && d < nearD && (!l.lit || l.fuelU < T.fuel_max * 60)) [near, nearD] = [l, d];
    if (!l.lit && d < targetD) [target, targetD] = [l, d];
  }
  const prompt = $('hud-prompt');
  prompt.style.display = near ? 'block' : 'none';
  if (near) prompt.textContent = near.lit
    ? `E — Châm dầu (${Math.round(near.fuelU / 60)}/${T.fuel_max})`
    : `E — Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;

  // Mũi tên tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  const arrow = $('hud-arrow');
  if (target) {
    const v = new THREE.Vector3(target.pos[0], target.pos[1] + 3, target.pos[2]).project(world.camera);
    const behind = v.z > 1;
    const off = behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
    arrow.style.display = off ? 'block' : 'none';
    if (off) {
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const a = Math.atan2(y, x);
      const W = window.innerWidth, H = window.innerHeight;
      const m = 0.85;
      const k = Math.min(m / Math.abs(Math.cos(a) || 1e-6), m / Math.abs(Math.sin(a) || 1e-6));
      const sx = (Math.cos(a) * k * 0.5 + 0.5) * W, sy = (-Math.sin(a) * k * 0.5 + 0.5) * H;
      arrow.style.left = `${sx - 14}px`;
      arrow.style.top = `${sy - 15}px`;
      arrow.style.transform = `rotate(${Math.PI / 2 - a}rad)`;
    }
  } else arrow.style.display = 'none';
}

// ---------- Vòng lặp ----------
function handleEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': SFX.pickup(); break;
      case 'deposit': SFX.deposit(); break;
      case 'lantern_out': SFX.hit(); break;
      case 'refuel': SFX.deposit(); break;
      case 'lantern_lit': SFX.lanternLit(); world.flashLantern(e.data.lantern_id); break;
      case 'pulse': SFX.pulse(); world.pulse(); break;
      case 'player_hit': SFX.hit(); break;
      case 'dash': SFX.dash(); break;
      case 'shade_spawned': SFX.shadeSpawn(); break;
      case 'charm_picked': SFX.charm(); break;
      case 'drifter_steal': SFX.steal(); break;
      case 'game_over': endNight(e.data.result, e.data.reason); break;
    }
  }
}

let acc = 0, last = performance.now();
let fpsFrames = 0, fpsT = 0, fps = 0;
let wasWarn = false;
const fpsLog = []; // để đo FPS trung bình (window.__fps())

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  fpsFrames++;
  fpsT += dt;
  if (fpsT >= 1) { fps = fpsFrames / fpsT; fpsLog.push(fps); fpsFrames = 0; fpsT = 0; $('hud-fps').textContent = `${fps.toFixed(0)} FPS`; }

  if (game) {
    if (running) {
      if (keys.has('ArrowLeft')) camYaw += 120 * dt * settings.sensitivity * 1.6;
      if (keys.has('ArrowRight')) camYaw -= 120 * dt * settings.sensitivity * 1.6;
      acc += dt;
      while (acc >= DT && running) {
        const inp = readInput();
        const jumpedBefore = game.player.grounded;
        handleEvents(step(game, inp));
        if (jumpedBefore && !game.player.grounded && game.player.vel[1] === RULES.jumpVelocity - RULES.gravity * DT) SFX.jump();
        acc -= DT;
      }
      const warn = game.wind.enabled && !game.wind.active && (game.sim % RULES.windEveryTicks) >= RULES.windEveryTicks - RULES.windWarnTicks;
      if (warn && !wasWarn) SFX.windWarn();
      wasWarn = warn;
    } else acc = 0;
    const lit = world.sync(game, now / 1000, camYaw);
    updateHud(game, lit);
  }
  renderer.render(world.scene, world.camera);
});

// hook chỉ-đọc cho kiểm thử trong trình duyệt
window.__game = () => game;
window.__fps = () => ({ samples: fpsLog.slice(-30), avg: fpsLog.slice(-30).reduce((a, b) => a + b, 0) / Math.max(1, fpsLog.slice(-30).length), size: [renderer.domElement.width, renderer.domElement.height] });
window.__startNight = (n) => { showIntro(n); startNight(n); };
showTop();
