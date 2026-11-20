// Benchmark Ticket-04: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Mở cửa sổ Chrome/Edge/Chromium 1280×720 (tắt vsync bằng cờ trình duyệt), chạy cảnh bench chuẩn của game, ghi bench.json.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const processStart = Date.now() - process.uptime() * 1000; // mốc "tiến trình bắt đầu"
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seed = parseInt(arg('--seed', '42'), 10);
const duration = parseFloat(arg('--duration', '30'));
const out = arg('--out', 'bench.json');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('bench: chưa có dist/. Chạy "npm run build" trước.');
  process.exit(1);
}

// Server tĩnh tối giản cho dist/
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[\\/]+/, '');
  let f = join(dist, p || 'index.html');
  if ((!f.startsWith(dist + sep) && f !== dist) || !existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

/** RSS của cả cây tiến trình trình duyệt (MB). Windows dùng WorkingSetSize (tương đương RSS). */
function treeRssMb(pid) {
  try {
    let rows;
    if (process.platform === 'win32') {
      const ps = 'Get-CimInstance Win32_Process | ForEach-Object { [string]$_.ProcessId + " " + [string]$_.ParentProcessId + " " + [string]$_.WorkingSetSize }';
      const txt = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      rows = txt.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).map(Number)).map(([p, pp, ws]) => [p, pp, ws / 1024]);
    } else {
      const txt = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });
      rows = txt.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number)); // rss: KB
    }
    const kids = new Map();
    for (const [p, pp] of rows) {
      if (!kids.has(pp)) kids.set(pp, []);
      kids.get(pp).push(p);
    }
    const rss = new Map(rows.map(([p, , r]) => [p, r]));
    let total = 0;
    const todo = [pid];
    const seen = new Set();
    while (todo.length) {
      const p = todo.pop();
      if (seen.has(p)) continue;
      seen.add(p);
      total += rss.get(p) || 0;
      todo.push(...(kids.get(p) || []));
    }
    return total / 1024;
  } catch {
    return null;
  }
}

const { chromium } = await import('playwright-core');
const args = [
  '--window-size=1280,720', '--window-position=40,40',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // tắt vsync / giới hạn khung hình
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--ignore-gpu-blocklist',
];
let bs = null;
let used = null;
for (const opt of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
  try {
    bs = await chromium.launchServer({ headless: false, args, host: '127.0.0.1', ...opt });
    used = opt.channel || 'chromium (playwright)';
    break;
  } catch {
    /* thử trình duyệt tiếp theo */
  }
}
if (!bs) {
  console.error('bench: không tìm thấy Chrome/Edge. Cài Chromium bằng: npx playwright-core install chromium');
  server.close();
  process.exit(1);
}
const pid = bs.process().pid;
const endpoint = bs.wsEndpoint().replace('localhost', '127.0.0.1');
const browser = await chromium.connect(endpoint);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
let peak = null;
const sampler = setInterval(() => {
  const m = treeRssMb(pid);
  if (m !== null) peak = Math.max(peak ?? 0, m);
}, process.platform === "win32" ? 12000 : 3000); // Windows: gọi PowerShell tốn CPU nên lấy mẫu thưa
await page.goto(`http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`);
await page.waitForFunction(() => window.__benchResult, null, { timeout: (duration + 120) * 1000, polling: 500 });
const r = await page.evaluate(() => ({ ...window.__benchResult, first: window.__benchFirstFrameEpoch }));
if (process.env.BENCH_DEBUG) console.error("worst dt [ms, frame]:", JSON.stringify(r.worst));
clearInterval(sampler);
const last = treeRssMb(pid);
if (last !== null) peak = Math.max(peak ?? 0, last);
const version = browser.version();
await browser.close();
await bs.close();
server.close();

const report = {
  contract_version: '1.3',
  avg_fps: r.avg_fps,
  p1_low_fps: r.p1_low_fps,
  frame_ms_p95: r.frame_ms_p95,
  frames: r.frames,
  load_ms: Math.round(r.first - processStart),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `three.js r${r.three} WebGLRenderer · ${used} ${version} · GPU: ${r.gpu} · canvas ${r.canvas.join('x')} · ${r.drawCalls} draw calls · ${r.shades} Bóng Mực, ${r.motes} đom đóm`,
  os: `${os.type()} ${os.release()} ${os.arch()} · ${os.cpus()[0]?.model ?? 'CPU?'} · RAM ${Math.round(os.totalmem() / 2 ** 30)} GB`,
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(0);
