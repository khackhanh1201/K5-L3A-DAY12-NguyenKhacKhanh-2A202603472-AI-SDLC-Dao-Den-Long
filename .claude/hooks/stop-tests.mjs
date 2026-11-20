// Hook Stop: chặn agent kết thúc lượt khi `npm test` đang đỏ.
// Exit 2 + stderr => Claude Code buộc agent tiếp tục và sửa.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {}

// Đã bị chặn một lần trong chuỗi này -> cho dừng để tránh vòng lặp vô hạn.
if (input.stop_hook_active) process.exit(0);

const r = spawnSync(process.execPath, ['--test', 'tests/'], { encoding: 'utf8', cwd: input.cwd || process.cwd() });
if (r.status !== 0) {
  const fails = (r.stdout || '').split('\n').filter((l) => /^not ok|^\s+not ok/.test(l)).slice(0, 10).join('\n');
  process.stderr.write(`Test đang ĐỎ, chưa được kết thúc. Sửa code (không sửa giá trị mong đợi) rồi chạy lại npm test.\n${fails}\n`);
  process.exit(2);
}
process.exit(0);
