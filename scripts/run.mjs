// Chạy game có giao diện: phục vụ thư mục dist/ + API bảng xếp hạng lưu trên đĩa, rồi mở trình duyệt.
//   node scripts/run.mjs [--port 4173] [--no-open]
//   node scripts/run.mjs --export-leaderboard out.json
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { insertEntry, sortEntries } from '../src/core/leaderboard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dataDir = process.env.DDL_DATA_DIR || join(homedir(), '.dao-den-long');
const lbFile = join(dataDir, 'leaderboard.json');

function loadBoard() {
  try { return sortEntries(JSON.parse(readFileSync(lbFile, 'utf8')).entries || []); } catch { return []; }
}
function saveBoard(entries) {
  mkdirSync(dataDir, { recursive: true });
  const tmp = `${lbFile}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n'); // ghi tạm rồi đổi tên: không hỏng file nếu tắt ngang
  renameSync(tmp, lbFile);
}

const exportPath = arg('--export-leaderboard');
if (exportPath) {
  writeFileSync(exportPath, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
  console.log(`Đã xuất ${loadBoard().length} mục bảng xếp hạng → ${exportPath}`);
  process.exit(0);
}

const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Chưa có dist/. Chạy "npm run build" trước.');
  process.exit(1);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ entries: loadBoard() }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
      req.on('end', () => {
        try {
          const entries = insertEntry(loadBoard(), JSON.parse(body));
          saveBoard(entries);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ entries }));
        } catch (e) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    res.writeHead(405);
    return res.end();
  }
  const p = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, '');
  let file = join(dist, p || 'index.html');
  if (!file.startsWith(dist + sep) && file !== dist || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const port = parseInt(arg('--port', '4173'), 10);
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Đảo Đèn Lồng đang chạy: ${url}  (Ctrl+C để thoát)\nBảng xếp hạng lưu ở: ${lbFile}`);
  if (!process.argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
  }
});
