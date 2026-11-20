// Đọc và kiểm tra file inputs / scenario theo Test Contract v1.0 (mục C, D).
// Sai định dạng -> ném FormatError (CLI thoát mã 2).
export class FormatError extends Error {}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function isVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every(isNum);
}

export function validateInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) {
    throw new FormatError('inputs: thiếu mảng "frames"');
  }
  let last = -1;
  obj.frames.forEach((f, i) => {
    if (!f || typeof f !== 'object') throw new FormatError(`inputs: frame ${i} không phải object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`inputs: frame ${i} tick không hợp lệ`);
    if (f.tick <= last) throw new FormatError(`inputs: tick phải tăng nghiêm ngặt (frame ${i})`);
    last = f.tick;
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum) || m.some((v) => v < -1 || v > 1)) {
        throw new FormatError(`inputs: frame ${i} move phải là [x,z] trong [-1,1]`);
      }
    }
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) throw new FormatError(`inputs: frame ${i} cam_yaw_deg không hợp lệ`);
    for (const b of BUTTONS) {
      if (b in f && typeof f[b] !== 'boolean') throw new FormatError(`inputs: frame ${i} ${b} phải là boolean`);
    }
  });
  return obj;
}

/** Trả về hàm inputAt(k): trạng thái input đang có hiệu lực ở tick k (k tăng dần). */
export function createInputReader(inputs) {
  const frames = inputs ? inputs.frames : [];
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let idx = 0;
  return function inputAt(k) {
    while (idx < frames.length && frames[idx].tick <= k) {
      const f = frames[idx++];
      if ('move' in f) cur.move = [f.move[0], f.move[1]];
      if ('cam_yaw_deg' in f) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (b in f) cur[b] = f[b];
    }
    return { ...cur, move: [...cur.move] };
  };
}

export function validateScenario(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new FormatError('scenario: phải là object');
  if ('player' in s) {
    const p = s.player;
    if (!p || typeof p !== 'object') throw new FormatError('scenario: player không hợp lệ');
    if ('pos' in p && !isVec3(p.pos)) throw new FormatError('scenario: player.pos phải là [x,y,z]');
    if ('carried' in p && !(Number.isInteger(p.carried) && p.carried >= 0)) throw new FormatError('scenario: player.carried không hợp lệ');
    if ('flames' in p && !(Number.isInteger(p.flames) && p.flames >= 0)) throw new FormatError('scenario: player.flames không hợp lệ');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (k in s && typeof s[k] !== 'boolean') throw new FormatError(`scenario: ${k} phải là boolean`);
  }
  if ('motes' in s) {
    if (!Array.isArray(s.motes) || !s.motes.every(isVec3)) throw new FormatError('scenario: motes phải là mảng [x,y,z]');
  }
  if ('shades' in s) {
    if (!Array.isArray(s.shades)) throw new FormatError('scenario: shades phải là mảng');
    s.shades.forEach((sh, i) => {
      if (!sh || typeof sh !== 'object' || !isVec3(sh.pos)) throw new FormatError(`scenario: shades[${i}].pos không hợp lệ`);
      if ('id' in sh && typeof sh.id !== 'string') throw new FormatError(`scenario: shades[${i}].id phải là chuỗi`);
    });
  }
  if ('lanterns' in s) {
    if (!Array.isArray(s.lanterns)) throw new FormatError('scenario: lanterns phải là mảng');
    s.lanterns.forEach((l, i) => {
      if (!l || typeof l !== 'object' || typeof l.id !== 'string') throw new FormatError(`scenario: lanterns[${i}].id thiếu`);
      if ('pos' in l && !isVec3(l.pos)) throw new FormatError(`scenario: lanterns[${i}].pos không hợp lệ`);
      if ('deposited' in l && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new FormatError(`scenario: lanterns[${i}].deposited không hợp lệ`);
      if ('lit' in l && typeof l.lit !== 'boolean') throw new FormatError(`scenario: lanterns[${i}].lit phải là boolean`);
    });
  }
  if ('time_left_s' in s && !(isNum(s.time_left_s) && s.time_left_s >= 0)) throw new FormatError('scenario: time_left_s không hợp lệ');
  return s;
}
