# Changelog

## [phase-4] / v1.0.0 — Contract v1.3 "Bình minh: phát hành"

### Thêm
- **Benchmark** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`: cửa sổ Chrome/Edge 1280×720, tắt vsync, cảnh chuẩn (200 Bóng Mực, 100 đom đóm, L1–L3 đầy dầu), camera bay vòng, ghi avg/p1 low/p95/frames/load/peak mem.
- **Soak test** `node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json`: 10 Đêm xoay vòng trong 1 tiến trình, input ngẫu nhiên theo seed.
- **Bảng xếp hạng cục bộ**: top 10, lưu trên đĩa qua server `scripts/run.mjs` (dự phòng localStorage), màn hình từ menu, nhập tên sau Bình Minh/khi thua (hỗ trợ tiếng Việt), lệnh `--export-leaderboard`.
- **Dễ tiếp cận**: đổi phím cho 9 hành động (báo trùng, khôi phục mặc định), phụ đề + mũi tên Bóng Mực, giảm chuyển động, chữ ≥ 18 px và chế độ chữ lớn ×1.25.
- Retro, bằng chứng Phase 4, `bench.json`, `soak.json`.

### Thay đổi (không phá vỡ luật headless)
- `game.contract.json` v1.3: thêm `bench_cmd`, `soak_cmd`; `run_cmd` đổi từ `npm run start` (vite preview) thành `node scripts/run.mjs` (server tĩnh + API bảng xếp hạng). `npm start` vẫn chạy được.
- Hiệu năng render: Bóng Mực và đom đóm dùng InstancedMesh (1197 → 49 draw call trong cảnh bench), point light của đèn tắt bị ẩn.
- Core thêm cờ `bench` (chỉ dùng cho cảnh bench); output headless v1.0–v1.2 không đổi (69 test cũ vẫn đạt).

## [phase-3] Contract v1.2 — "Đèn cạn dầu"

### Breaking changes
- **Luật thắng:** bỏ thắng sớm khi thắp hết đèn. Chỉ thắng ở bình minh nếu còn lửa và đèn đang sáng ≥ ceil(0.6 × tổng đèn). `game_over.reason`: thêm `dawn_survived`, bỏ `all_lit`.
- **Thời lượng Đêm:** 300/330/360 s → **240/270/300 s**.
- **Đèn có nhiên liệu:** đèn sáng hao 1 fuel/s, hết dầu thì tắt (`lantern_out`, `deposited` về 0). Thắp lại cần 5 đom đóm. Đèn đang sáng nhận thêm đom đóm để châm dầu (`refuel`) thay vì bị bỏ qua khi tương tác.
- **Vùng an toàn:** chỉ còn ở đèn sáng có fuel ≥ 30.
- **Bóng Mực:** thêm trạng thái `drain` (hút 5 fuel/s). Bóng wander đi tới đèn yếu, nếu không có thì tới đèn tắt gần nhất (không còn trôi ngẫu nhiên khi còn đèn tắt). Hết choáng luôn về `wander`.
- **Điểm:** +5/đom đóm nạp (cũ +10), +100 thắp lần đầu, +40 thắp lại, +5 (hoặc +15 nếu đang drain) mỗi Bóng Mực trúng Tỏa Sáng, bình minh +50 + floor(fuel) mỗi đèn sáng và +50 mỗi lửa. Bỏ thưởng thời gian (`per_second_left` = 0).
- **Sức chứa:** 10 + 2 × số lần thắp thành công, tối đa 20 (cũ cố định 10).
- **Snapshot:** đèn thêm `fuel` (1 chữ số thập phân), `ever_lit`, `relit_count`; player thêm `capacity`.
- **Scenario:** đèn nhận `fuel`, `ever_lit`; player nhận `successful_lights`; Bóng Mực nhận `target_lantern_id` và `state: "drain"`.
- **Sự kiện:** thêm `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.
- **Tuning:** thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`; đổi các khóa `score`.

### Thêm
- Chế độ "Bảng màu dễ phân biệt" (lưu trong Cài đặt), thanh dầu trên đèn, nhấp nháy 1 Hz khi fuel < 30, HUD đang mang/sức chứa và số đèn cần giữ.

## [phase-2] Contract v1.1 — "Ba hòn đảo"
- Số chuẩn, 3 Đêm, lướt, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng, rơi khỏi đảo, menu/HUD/âm thanh. Chi tiết: `docs/proof/phase-2/README.md`.

## [phase-1] Contract v1.0
- Đêm 1, headless theo Test Contract v1.0.
