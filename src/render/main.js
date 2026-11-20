// Bản có giao diện: chuỗi 3 Đêm, HUD, tạm dừng, cài đặt, âm thanh.
// Mọi luật chơi nằm ở src/core; ở đây chỉ gửi input vào core.step() và vẽ lại state.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, capacity, litNeeded } from '../core/game.js';
import { NIGHTS, RULES, TICK_RATE } from '../core/level.js';
import { createWorld } from './world.js';
import { createBenchGame, benchCamera, benchStats } from '../core/bench.js';
import { validName, insertEntry, sortEntries, isoWithOffset } from '../core/leaderboard.js';
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

// Giảm chuyển động + chữ lớn (Ticket-04)
const applyA11y = () => {
  document.body.classList.toggle('reduce', !!settings.reduceMotion);
  document.documentElement.classList.toggle('big', !!settings.bigText);
};
$('set-reduce').checked = !!settings.reduceMotion;
$('set-big').checked = !!settings.bigText;
$('set-reduce').addEventListener('change', (e) => { settings.reduceMotion = e.target.checked; saveSettings(); applyA11y(); });
$('set-big').addEventListener('change', (e) => { settings.bigText = e.target.checked; saveSettings(); applyA11y(); });
applyA11y();

// Đổi phím: mọi hành động, phát hiện trùng, khôi phục mặc định, lưu lại
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape' };
const KEY_LABELS = { up: 'Đi tới', down: 'Đi lui', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác (nạp / châm dầu)', pulse: 'Tỏa sáng', pause: 'Tạm dừng' };
settings.keys = { ...DEFAULT_KEYS, ...(settings.keys || {}) };
let rebinding = null;
export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return map[code] || code;
}
function duplicateKeys() {
  const by = {};
  for (const [a, c] of Object.entries(settings.keys)) (by[c] ||= []).push(a);
  return Object.entries(by).filter(([, acts]) => acts.length > 1);
}
function renderKeys() {
  const box = $('keys');
  box.innerHTML = '';
  const dups = duplicateKeys();
  const dupActs = new Set(dups.flatMap(([, a]) => a));
  for (const a of Object.keys(DEFAULT_KEYS)) {
    const lab = document.createElement('span');
    lab.textContent = KEY_LABELS[a];
    const b = document.createElement('button');
    b.className = 'alt' + (dupActs.has(a) ? ' dup' : '') + (rebinding === a ? ' wait' : '');
    b.textContent = rebinding === a ? 'Nhấn phím mới…' : keyName(settings.keys[a]);
    b.addEventListener('click', () => { rebinding = a; renderKeys(); });
    box.append(lab, b);
  }
  $('keys-err').textContent = dups.length
    ? dups.map(([c, acts]) => `Phím ${keyName(c)} bị trùng: ${acts.map((x) => KEY_LABELS[x]).join(' và ')}`).join(' · ')
    : '';
  const k = settings.keys;
  $('menu-hint').textContent = `${keyName(k.up)}${keyName(k.left)}${keyName(k.down)}${keyName(k.right)} đi · Kéo chuột / ← → xoay camera · ${keyName(k.jump)} nhảy · ${keyName(k.dash)} lướt · ${keyName(k.interact)} nạp/châm dầu · ${keyName(k.pulse)} tỏa sáng · ${keyName(k.pause)} tạm dừng`;
  $('cd-dash-key').textContent = keyName(k.dash);
  $('cd-pulse').dataset.key = keyName(k.pulse);
}
renderKeys();

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // skill threejs-scene-setup: giới hạn pixel ratio
renderer.toneMapping = THREE.ACESFilmicToneMapping; // skill threejs-materials-lighting: tone mapping cho ánh đèn ấm
renderer.toneMappingExposure = 1.5;
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
let lastSeed = 0;
const lowFuel = new Set();
let latestShadePos = null;
let shadeArrowUntil = 0;
let lastShadeCaption = 0;
let cameraShake = 0;
const total = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

function addCaption(text, danger = false, durationMs = 3500) {
  const box = $('captions');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'cap' + (danger ? ' danger' : '');
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, durationMs);
}

function startNight(n) {
  night = n;
  lastSeed = Date.now() & 0x7fffffff;
  game = createGame(T, { seed: lastSeed, night: n });
  lowFuel.clear();
  latestShadePos = null;
  shadeArrowUntil = 0;
  cameraShake = 0;
  const capBox = $('captions');
  if (capBox) capBox.innerHTML = '';
  const sa = $('hud-shade-arrow');
  if (sa) sa.style.display = 'none';
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
  const capBox = $('captions');
  if (capBox) capBox.innerHTML = '';
  const sa = $('hud-shade-arrow');
  if (sa) sa.style.display = 'none';
  cameraShake = 0;
  if (result === 'won') {
    SFX.win();
    wonScores[night] = game.score;
    if (night === 3) {
      $('dawn-total').textContent = total();
      renderSaveBox('dawn');
      replace('scr-dawn');
      return;
    }
  } else SFX.lose();
  // thua ở bất kỳ Đêm nào thì cho lưu điểm; thắng Đêm 1–2 thì đi tiếp
  const box = document.querySelector('[data-save="result"]');
  if (result === 'won') box.innerHTML = '';
  else renderSaveBox('result');
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
  if (act === 'menu') {
    running = false;
    game = null;
    stopMusic();
    const capBox = $('captions');
    if (capBox) capBox.innerHTML = '';
    const sa = $('hud-shade-arrow');
    if (sa) sa.style.display = 'none';
    cameraShake = 0;
    replace('scr-menu');
  }
  if (act === 'board') showBoard();
  if (act === 'keys-reset') { settings.keys = { ...DEFAULT_KEYS }; rebinding = null; saveSettings(); renderKeys(); }
});

// ---------- Bảng xếp hạng (Ticket-04): lưu qua server cục bộ (đĩa), dự phòng localStorage ----------
const LB_KEY = 'ddl-leaderboard-v1';
let boardWhere = 'browser';
async function apiJson(res) {
  return res.ok && (res.headers.get('content-type') || '').includes('application/json') ? res.json() : null;
}
async function loadBoard() {
  try {
    const j = await apiJson(await fetch('/api/leaderboard'));
    if (j) { boardWhere = 'disk'; return sortEntries(j.entries || []); }
  } catch {}
  boardWhere = 'browser';
  try { return sortEntries(JSON.parse(localStorage.getItem(LB_KEY) || '{"entries":[]}').entries || []); } catch { return []; }
}
async function saveEntry(entry) {
  try {
    const res = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    const j = await apiJson(res);
    if (j && j.entries) return j.entries;
    if (j && j.error) throw new Error(j.error);
  } catch (e) { if (e.message && !/fetch|network/i.test(e.message) && /Tên/.test(e.message)) throw e; }
  const entries = insertEntry(await loadBoard(), entry);
  try { localStorage.setItem(LB_KEY, JSON.stringify({ entries })); } catch {}
  return entries;
}
async function showBoard() {
  const entries = await loadBoard();
  $('board-body').innerHTML = entries.length
    ? entries.map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${escapeHtml(e.achieved_at.replace('T', ' ').slice(0, 16))}</td></tr>`).join('')
    : '<tr><td colspan="5">Chưa có ai. Hãy là người đầu tiên!</td></tr>';
  $('board-where').textContent = boardWhere === 'disk' ? 'Lưu trên đĩa (~/.dao-den-long/leaderboard.json).' : 'Bản đang chạy không có server cục bộ: lưu trong trình duyệt (localStorage).';
  push('scr-board');
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderSaveBox(kind) {
  const box = document.querySelector(`[data-save="${kind}"]`);
  box.innerHTML = '<label style="min-width:0">Tên của bạn <input type="text" maxlength="12" placeholder="3–12 ký tự" /></label><p class="err"></p><button type="button">Lưu điểm</button>';
  const input = box.querySelector('input'), err = box.querySelector('.err'), btn = box.querySelector('button');
  btn.addEventListener('click', async () => {
    if (!validName(input.value)) { err.textContent = 'Tên cần 3–12 ký tự: chữ (có dấu cũng được), số hoặc _'; return; }
    btn.disabled = true;
    try {
      await saveEntry({ name: input.value, score: total(), nights_won: Object.keys(wonScores).length, achieved_at: isoWithOffset(), seed: lastSeed });
      box.innerHTML = '<p>Đã lưu điểm!</p>';
      showBoard();
    } catch (e) { err.textContent = e.message; btn.disabled = false; }
  });
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') btn.click(); });
}

// ---------- Input ----------
const keys = new Set();
let dragging = false, lastX = 0;
function togglePause() {
  if (!game || game.state !== 'playing') return;
  if (running) { running = false; replace('scr-pause'); }
  else if (stack[stack.length - 1] === 'scr-pause') { replace(null); running = true; }
}
addEventListener('keydown', (e) => {
  if (rebinding) { settings.keys[rebinding] = e.code; rebinding = null; saveSettings(); renderKeys(); e.preventDefault(); return; }
  if (e.code === settings.keys.pause) { togglePause(); return; }
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
  const k = settings.keys;
  const x = (keys.has(k.left) ? 1 : 0) - (keys.has(k.right) ? 1 : 0);
  const z = (keys.has(k.up) ? 1 : 0) - (keys.has(k.down) ? 1 : 0);
  return {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: keys.has(k.jump), interact: keys.has(k.interact), pulse: keys.has(k.pulse),
    dash: keys.has(k.dash), pause: false,
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
    if (s !== lastCountdown) {
      lastCountdown = s;
      SFX.countdown();
      if (s === 10) addCaption('10 giây cuối cùng!', true, 3000);
    }
  }
  $('hud-lit').textContent = `${lit}/${g.lanterns.length} (cần ${litNeeded(g)})`;
  const cap = capacity(g);
  $('hud-cap').textContent = `${p.carried}/${cap}`;
  $('hud-score').textContent = g.score;
  [...$('hud-motes').children].forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? '' : 'none'; });

  // Cảnh báo đèn có dầu dưới 30 (Ticket-04: phụ đề / chỉ báo hình ảnh)
  for (const l of g.lanterns) {
    const fuel = l.fuelU / 60;
    if (l.lit && fuel < g.T.low_fuel_threshold) {
      if (!lowFuel.has(l.id)) {
        lowFuel.add(l.id);
        addCaption(`Đèn ${l.id} dầu dưới 30! Cần châm dầu`, true, 3500);
      }
    } else if (!l.lit || fuel >= g.T.low_fuel_threshold) {
      lowFuel.delete(l.id);
    }
  }

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
  cdPulse.innerHTML = `Tỏa sáng<small>${p.carried < T.pulse_cost ? `cần ${T.pulse_cost}` : keyName(settings.keys.pulse)}</small>`;

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
  const ik = keyName(settings.keys.interact);
  if (near) prompt.textContent = near.lit
    ? `${ik} — Châm dầu (${Math.round(near.fuelU / 60)}/${T.fuel_max})`
    : `${ik} — Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;

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

  // Mũi tên tới Bóng Mực vừa xuất hiện ở mép màn hình (Ticket-04)
  const shadeArrow = $('hud-shade-arrow');
  if (shadeArrow) {
    if (latestShadePos && performance.now() < shadeArrowUntil) {
      const v = new THREE.Vector3(latestShadePos[0], latestShadePos[1] + 1, latestShadePos[2]).project(world.camera);
      const behind = v.z > 1;
      shadeArrow.style.display = 'block';
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const a = Math.atan2(y, x);
      const W = window.innerWidth, H = window.innerHeight;
      const m = 0.85;
      const k = Math.min(m / Math.abs(Math.cos(a) || 1e-6), m / Math.abs(Math.sin(a) || 1e-6));
      const sx = (Math.cos(a) * k * 0.5 + 0.5) * W, sy = (-Math.sin(a) * k * 0.5 + 0.5) * H;
      shadeArrow.style.left = `${sx - 14}px`;
      shadeArrow.style.top = `${sy - 15}px`;
      shadeArrow.style.transform = `rotate(${Math.PI / 2 - a}rad)`;
    } else {
      shadeArrow.style.display = 'none';
    }
  }
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
      case 'player_hit': {
        SFX.hit();
        if (!settings.reduceMotion) {
          cameraShake = 0.45;
          const fl = $('flash');
          if (fl) {
            fl.style.opacity = '0.5';
            setTimeout(() => { fl.style.opacity = '0'; }, 180);
          }
        }
        break;
      }
      case 'dash': SFX.dash(); break;
      case 'shade_spawned': {
        SFX.shadeSpawn();
        const now = performance.now();
        if (now - lastShadeCaption > 1200) {
          addCaption('Bóng Mực xuất hiện!', true, 3000);
          lastShadeCaption = now;
        }
        const sh = game?.shades?.find((s) => s.id === e.data?.id);
        if (sh) {
          latestShadePos = [...sh.pos];
          shadeArrowUntil = now + 4500;
        }
        break;
      }
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
      if (warn && !wasWarn) {
        SFX.windWarn();
        addCaption('Gió sắp thổi!', true, 2500);
      }
      wasWarn = warn;
    } else acc = 0;
    const lit = world.sync(game, now / 1000, camYaw);
    if (cameraShake > 0) {
      if (!settings.reduceMotion) {
        world.camera.position.x += (Math.random() - 0.5) * cameraShake * 1.5;
        world.camera.position.y += (Math.random() - 0.5) * cameraShake * 1.5;
        world.camera.position.z += (Math.random() - 0.5) * cameraShake * 1.5;
      }
      cameraShake = Math.max(0, cameraShake - dt * 2.5);
    }
    updateHud(game, lit);
  }
  renderer.render(world.scene, world.camera);
});

// hook chỉ-đọc cho kiểm thử trong trình duyệt
window.__game = () => game;
window.__world = world;
window.__renderer = renderer;
window.__fps = () => ({ samples: fpsLog.slice(-30), avg: fpsLog.slice(-30).reduce((a, b) => a + b, 0) / Math.max(1, fpsLog.slice(-30).length), size: [renderer.domElement.width, renderer.domElement.height] });
window.__startNight = (n) => { showIntro(n); startNight(n); };
showTop();

// ---------- Chế độ benchmark (Ticket-04): /?bench=1&seed=42&duration=30 ----------
const BQ = new URLSearchParams(location.search);
if (BQ.get('bench')) {
  const seed = parseInt(BQ.get('seed') || '42', 10);
  const duration = parseFloat(BQ.get('duration') || '30');
  const WARMUP = 3;
  renderer.setAnimationLoop(null); // dừng vòng lặp chơi thường
  stack.length = 0;
  showTop();
  $('hud').style.display = 'none';
  game = createBenchGame(T, seed);
  world.setBenchMode(true); // tắt trang trí/hiệu ứng sáng tạo (cây cỏ, mây, sương, hào quang Bóng Mực) theo Ticket-04
  world.buildLevel(1);
  world.setColorblind(false);
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const dts = [];
  let first = null, prev = null, accB = 0, done = false;
  renderer.setAnimationLoop((now) => {
    if (done) return;
    if (first === null) {
      first = now;
      window.__benchFirstFrameEpoch = Date.now(); // load_ms tính tới khung hình đầu tiên
    } else {
      const dt = now - prev;
      accB += Math.min(dt, 250) / 1000;
      while (accB >= DT) { step(game, idle); accB -= DT; }
      if ((now - first) / 1000 >= WARMUP) dts.push(dt);
    }
    prev = now;
    const t = (now - first) / 1000;
    world.sync(game, t, 0);
    const c = benchCamera(t);
    world.camera.position.set(c[0], c[1], c[2]);
    world.camera.lookAt(0, 0, 0);
    renderer.render(world.scene, world.camera);
    if (t >= WARMUP + duration) {
      done = true;
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      window.__benchResult = {
        ...benchStats(dts),
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        three: THREE.REVISION,
        canvas: [renderer.domElement.width, renderer.domElement.height],
        drawCalls: renderer.info.render.calls,
        shades: game.shades.length,
        motes: game.motes.length,
        worst: dts.map((d, i) => [Math.round(d), i]).sort((a, b) => b[0] - a[0]).slice(0, 25),
      };
    }
  });
}
