# Đảo Đèn Lồng: hướng dẫn cho agent

Spec hiện hành: `docs/requirements/` (Test Contract là chuẩn tuyệt đối). Giả định đã chốt: `docs/notes/assumptions.md`.

## Lệnh
- Cài + build: `npm ci && npm run build`
- Test (unit + scenario headless end-to-end): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f] [--inputs f]`
- Kiểm chứng + lưu bằng chứng: `npm run verify` (xem skill `verify`)
- Chơi: `npm run dev` (dev) hoặc `npm run start` (bản build)

## Kiến trúc
- `src/core/`: logic thuần, tất định. KHÔNG import three/DOM. Mọi số luật lấy từ `game.contract.json` (tuning) hoặc `src/core/level.js`.
- `src/headless.js`: CLI theo contract. `src/render/`: Three.js + HUD, chỉ đọc state và gửi input.
- `tests/contract.test.js`: scenario chạy CLI thật. Giá trị mong đợi tính từ spec + tuning.

## Quy tắc
- Không dùng `Math.random`/`Date.now` trong core; dùng `g.rng`. Tọa độ output làm tròn 3 chữ số.
- Thứ tự xử lý trong một bước theo `assumptions.md`. Muốn đổi thì cập nhật file đó trước.
- Đổi số trong `tuning` thì game phải dùng đúng số đó (test đọc từ contract).
- KHÔNG sửa giá trị mong đợi trong test để cho qua. Test sai so với spec thì báo lại kèm trích dẫn spec.
- Phần sáng tạo chỉ nằm ở `src/render/`, không được đổi output headless.
- Kết thúc việc chỉ khi `npm test` xanh (hook Stop sẽ chặn nếu đỏ).
- Commit nhỏ, mỗi commit một việc, message dạng `feat(p1): ...`, `test(p1): ...`, `docs(p1): ...`.
