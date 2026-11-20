# Đảo Đèn Lồng: hướng dẫn cho agent

Spec hiện hành (mới nhất thắng khi trùng): `docs/requirements/TICKET-04.md` (Contract **v1.3**: bench, soak, bảng xếp hạng, accessibility) > `TICKET-03.md` > `TICKET-02.md` > `PRD-0.md`. Giả định: `docs/notes/assumptions.md` (A/B/C/D = Phase 1–4). ADR: `docs/adr/`. Retro: `docs/notes/retro.md`.

## Lệnh
- Cài + build: `npm ci && npm run build`
- Test (unit + scenario headless end-to-end, cả 3 Đêm): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl [--scenario f] [--inputs f]`
- Kiểm chứng + lưu bằng chứng: `npm run verify -- --phase N` (skill `verify`)
- Quyết định thiết kế: `docs/adr/`; breaking changes: `CHANGELOG.md` (cập nhật mỗi khi đổi luật/contract)
- Bench: `npm run bench -- --seed 42 --duration 30 --out bench.json` (cần Chrome/Edge; tắt dev server và pane trình duyệt khi đo). Soak: `npm run soak -- --seed 7 --nights 10 --out soak.json`.
- Chạy bản build: `npm start` (= `node scripts/run.mjs`: server tĩnh + API bảng xếp hạng lưu ở ~/.dao-den-long). Xuất: `node scripts/run.mjs --export-leaderboard out.json`.
- Chơi: `npm run dev`; console trình duyệt có `__game()`, `__fps()`, `__startNight(n)` (chỉ để kiểm thử)

## Kiến trúc
- `src/core/level.js`: bản đồ chuẩn 3 Đêm (`NIGHTS`) + hằng số `RULES` không có trong tuning.
- `src/core/game.js`: logic thuần, tất định, **12 bước mỗi tick theo đúng thứ tự Ticket-02**. KHÔNG import three/DOM.
- `src/headless.js`: CLI contract. `src/render/{main,world,audio}.js`: Three.js, HUD, menu/stack màn hình, WebAudio.
- `tests/contract.test.js` (Phase 1–2), `tests/phase3.test.js`, `tests/phase4.test.js`: mỗi tính năng có ít nhất 1 scenario. Giá trị mong đợi tính từ spec + tuning.
- `src/core/bench.js` (cảnh bench chuẩn + thống kê), `src/core/leaderboard.js` (dùng chung cho UI, server, lệnh xuất); `scripts/{run,bench,soak,verify}.mjs`.

## Quy tắc
- Không dùng `Math.random`/`Date.now` trong core; dùng `g.rng`. Tọa độ output làm tròn 3 chữ số.
- Bộ đếm: giá trị N đặt ở bước k thì được giảm ở đầu các bước sau, nên hiệu lực đúng N bước. Đặt bộ đếm trước bước di chuyển của chính tick đó (vd. pulse → flee) thì phải bỏ qua lần giảm đầu (`fresh`).
- Đổi số trong `tuning` thì game phải dùng đúng số đó (test đọc từ contract). Số không có trong tuning thì đặt ở `RULES`.
- Tên trạng thái Bóng Mực bắt buộc: `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
- Dầu đèn lưu bằng số nguyên đơn vị 1/60 (`fuelU`), không dùng số thực; chỉ làm tròn khi xuất snapshot. Dầu bị trừ ở bước 2, trước bước tương tác.
- Khi ticket thay luật: sửa hoặc xóa test cũ kèm comment lý do, không `skip`; ghi vào bảng "Test bị thay" của `docs/proof/phase-N/README.md` và `CHANGELOG.md`.
- KHÔNG sửa giá trị mong đợi trong test để cho qua. Test sai so với spec thì báo lại kèm trích dẫn spec.
- Phần sáng tạo chỉ nằm ở `src/render/`, không được đổi output headless, và phải tắt trong cảnh bench (`world.setBenchMode`).
- Thực thể số lượng lớn vẽ bằng InstancedMesh; đo FPS bằng `npm run bench` (cửa sổ riêng), không tin số đo từ pane ẩn/mất focus.
- Sửa file bằng Write/Edit hoặc file script; KHÔNG nhét code/markdown có backtick hay dấu nháy vào chuỗi lệnh bash (backtick bị chạy như lệnh con).
- Kết thúc việc chỉ khi `npm test` xanh (hook Stop sẽ chặn nếu đỏ).
- Commit nhỏ: `feat(pN): ...`, `test(pN): ...`, `docs(pN): ...`.
- Skill ngoài (gamedev-skills, nếu đã cài local ở `.claude/skills/`, không commit): `game-ai` (FSM Bóng Mực/Gió Lạc), `game-ui-ux` (HUD, stack màn hình), `audio-design` (bus, âm lượng bình phương), `performance-optimization` và `threejs-*` (FPS, renderer).
