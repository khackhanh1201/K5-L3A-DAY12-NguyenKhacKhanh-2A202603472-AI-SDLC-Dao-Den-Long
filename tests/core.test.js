// Unit test cho phần logic thuần.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldMove } from '../src/core/game.js';
import { createRng } from '../src/core/rng.js';
import { createInputReader, validateInputs, FormatError } from '../src/core/inputs.js';

const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

test('worldMove theo công thức contract', () => {
  assert.ok(close(worldMove([1, 0], 0), [1, 0]));
  assert.ok(close(worldMove([0, 1], 0), [0, 1]));
  assert.ok(close(worldMove([0, 1], 90), [1, 0]));
  assert.ok(close(worldMove([1, 0], 90), [0, -1]));
  const d = worldMove([1, 1], 0);
  assert.ok(Math.abs(Math.hypot(d[0], d[1]) - 1) < 1e-9);
  const s = worldMove([0.5, 0], 0); // vector ngắn hơn 1 giữ nguyên
  assert.ok(close(s, [0.5, 0]));
});

test('rng tất định theo seed', () => {
  const a = createRng(5), b = createRng(5), c = createRng(6);
  const xa = [a(), a(), a()], xb = [b(), b(), b()];
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, [c(), c(), c()]);
});

test('input reader: trường vắng mặt giữ giá trị cũ', () => {
  const read = createInputReader({ frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 30 }, { tick: 5, interact: true }] });
  assert.deepEqual(read(0).move, [0, 1]);
  const at5 = read(5);
  assert.deepEqual([at5.move, at5.cam_yaw_deg, at5.interact], [[0, 1], 30, true]);
  const none = createInputReader(null)(10);
  assert.deepEqual([none.move, none.pulse], [[0, 0], false]);
});

test('validateInputs bắt tick không tăng', () => {
  assert.throws(() => validateInputs({ frames: [{ tick: 3 }, { tick: 2 }] }), FormatError);
  assert.throws(() => validateInputs({}), FormatError);
});
