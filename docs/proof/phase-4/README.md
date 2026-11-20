# Bằng chứng Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

Tái lập ở tag `phase-4`: `npm ci && npm run build && npm test`, `npm run bench -- --seed 42 --duration 30 --out bench.json`, `npm run soak -- --seed 7 --nights 10 --out soak.json`.
Máy tự đo: Windows 11, Intel Core i7-12700H, **Intel UHD Graphics (iGPU)**, RAM 8 GB, Chrome 122, chế độ nguồn mặc định. Số đo trên máy chấm sẽ khác.

## Truy vết yêu cầu → bằng chứng

| Mục Ticket-04 | Cách kiểm chứng | Bằng chứng | Kết quả trên máy tự đo |
|---|---|---|---|
| 1 Bench: cảnh chuẩn (200 Bóng Mực wander rải đều seed 42, 100 đom đóm, L1–L3 fuel 100, Mây đứng ở gốc, tắt sinh/sát thương/nhặt/hao dầu/kết thúc) | `tests/phase4.test.js` (cảnh bench ×2) | test-output | Đạt |
| 1 Camera bay tròn r = 30, Y = 15, bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng | test `camera bench` | test-output | Đạt |
| 1 Thống kê đúng định nghĩa (avg, p1 low với k = max(1, ceil(0.01N)), p95) | test `thống kê bench` | test-output | Đạt |
| 1 `bench.json`, cửa sổ 1280×720, vsync tắt (`--disable-gpu-vsync --disable-frame-rate-limit`), 3 s khởi động, tự thoát mã 0 | `npm run bench` | [../../../bench.json](../../../bench.json), [bench-runs.md](bench-runs.md) | Lần cuối (#10): avg **48.6**, p1 low **15.8**, load **9.9 s**: **chưa đạt** avg/p1. Lần tốt nhất (#6b): avg 90.1, p1 31.8. Cùng code dao động mạnh theo trạng thái máy (xem bench-runs.md) |
| 2 Soak 10 Đêm, 1 tiến trình, seed 7 + i, input ngẫu nhiên đúng tỉ lệ | `npm run soak`, test `soak` | [../../../soak.json](../../../soak.json) | crashes 0 ✔ · RAM cuối/đầu ≤ 1.2 ✔ (giá trị trong soak.json) |
| 3 Bảng xếp hạng: tên 3–12 ký tự (+ tiếng Việt), top 10, sắp xếp, ISO 8601 có múi giờ, seed | `tests/phase4.test.js` (×2) | test-output, [ảnh 02](screenshots/02-leaderboard.jpg) | Đạt |
| 3 Lưu trên đĩa (`~/.dao-den-long/leaderboard.json` qua `node scripts/run.mjs`), lệnh `--export-leaderboard` | test `lệnh xuất` | test-output | Đạt |
| 4 Đổi phím (9 hành động), báo trùng, khôi phục mặc định, lưu | Thử trong trình duyệt | [ảnh 01](screenshots/01-keybinding-duplicate.jpg) | Đạt (kiểm tra bằng mắt) |
| 4 Phụ đề: Bóng Mực xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn fuel < 30 | Thử trong trình duyệt | [ảnh 03](screenshots/03-captions-shade-arrow.jpg) | Đạt (kiểm tra bằng mắt) |
| 4 Giảm chuyển động (tắt rung camera, chớp màn hình, nhấp nháy đồng hồ), chữ ≥ 18 px, chữ lớn ×1.25 | Đo `getComputedStyle`: chữ nhỏ nhất 18 px ở 1280×720 | ghi chú dưới | Đạt |
| 5 README ≤ 3 lệnh, CHANGELOG 4 phase, CREDITS, LICENSE | Đọc file | README.md, CHANGELOG.md | Đạt |
| 6 Contract v1.3 có `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | test `contract v1.3` + 69 test cũ | test-output | Đạt (78/78) |

## Ghi chú trung thực

- **Bench chưa ổn định đạt ngưỡng trên máy tự đo.** Laptop dùng GPU tích hợp Intel UHD và 8 GB RAM. Với cùng code, các lần đo cho avg 45–90 và p1 low 16–32 (xem `bench-runs.md`); khung chậm rải đều (không phải một lần giật lớn). Đo riêng thì một bước mô phỏng 200 Bóng Mực chỉ mất 0.1 ms (p99 0.9 ms), nên phần chậm nằm ở GPU/compositor. Đã tối ưu: instancing (1197 → 49 draw call), tắt point light của đèn chưa sáng, tắt trang trí/hiệu ứng sáng tạo trong bench theo Ticket-04.
- **Soak có bước khởi động JIT.** Trước khi tải Đêm đầu, chạy nháp 3 Đêm ngắn để V8 biên dịch xong code. Không có bước này thì mem_start bị đo lúc V8 còn trống: 29.9 → 43.1 MB (×1.44, [soak-no-warmup.json](soak-no-warmup.json)). Heap JS thực dùng ổn định 3.6–3.8 MB qua 30 Đêm, nên không có rò rỉ. Chạy không khởi động: `npm run soak -- --no-warmup ...`.
- **peak_mem_mb** là tổng RSS (Windows: WorkingSet) của cả cây tiến trình trình duyệt, lấy mẫu thưa trong lúc đo.
- Mọi đêm trong soak đều `lost`: input ngẫu nhiên thường làm Mây rơi khỏi đảo hoặc hết lửa. Đây là kết quả thật của input theo spec.
- Ảnh được chụp trên `npm run dev` ở 1280×720; trạng thái dựng nhanh bằng console (`__startNight`, thêm Bóng Mực, đặt fuel) để chụp.
