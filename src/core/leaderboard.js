// Bảng xếp hạng cục bộ (Ticket-04): logic thuần dùng chung cho game, server và lệnh xuất.
export const MAX_ENTRIES = 10;

/** Tên 3–12 ký tự: chữ (kể cả tiếng Việt có dấu), số, gạch dưới. Đếm theo ký tự sau chuẩn hóa NFC. */
export function normalizeName(name) {
  return String(name ?? '').normalize('NFC').trim();
}
export function validName(name) {
  const n = normalizeName(name);
  const len = [...n].length;
  return len >= 3 && len <= 12 && /^[\p{L}\p{M}\p{N}_]+$/u.test(n);
}

/** Score giảm dần; bằng điểm thì ai đạt trước (achieved_at sớm hơn) đứng trên. */
export function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
}

export function insertEntry(entries, entry) {
  if (!validName(entry.name)) throw new Error('Tên phải có 3–12 ký tự: chữ, số hoặc _');
  const e = {
    name: normalizeName(entry.name),
    score: Math.max(0, Math.floor(entry.score)),
    nights_won: Math.min(3, Math.max(0, Math.floor(entry.nights_won))),
    achieved_at: entry.achieved_at,
    seed: entry.seed,
  };
  return [...entries, e].sort(compareEntries).slice(0, MAX_ENTRIES);
}

export function sortEntries(entries) {
  return [...entries].sort(compareEntries).slice(0, MAX_ENTRIES);
}

/** ISO 8601 kèm múi giờ địa phương, ví dụ 2026-11-20T15:04:05+07:00. */
export function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}
