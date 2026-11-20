---
name: verify
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (unit test, scenario headless cả 3 Đêm, tất định, hiệu năng headless, mẫu output) và lưu bằng chứng vào docs/proof/phase-N/. Dùng sau khi sửa logic game, trước khi gắn tag phase, hoặc khi cần bằng chứng cho bảng truy vết.
---

# Skill: verify

1. Xác định phase hiện tại N (tag gần nhất + 1, hoặc theo ticket đang làm).
2. Chạy: `node scripts/verify.mjs --phase N`
   - `node --test tests/` → `docs/proof/phase-N/test-output.txt`
   - Tất định: mỗi Đêm chạy 2 lần cùng seed, so sha256 → `determinism.txt`
   - Hiệu năng headless: mỗi Đêm 21.600 tick, ghi thời gian + cấu hình máy → `perf-headless.txt` (yêu cầu ≤ 30 s)
   - Mẫu output mỗi Đêm → `sample-n{1,2,3}.jsonl`
3. Có test đỏ: DỪNG, báo test nào đỏ và vì sao. Không sửa giá trị mong đợi để cho qua.
4. Cập nhật cột "Kết quả" trong `docs/proof/phase-N/README.md` theo đúng output vừa chạy.
5. Phần chỉ nhìn mới thấy (HUD, menu, bản đồ, ánh sáng):
   - `npm run dev`, đặt viewport 1280×720, mở pane trình duyệt ở trạng thái **hiển thị** (pane ẩn thì `requestAnimationFrame` dừng).
   - `__startNight(n)` để vào thẳng Đêm n; chụp ảnh vào `docs/proof/phase-N/screenshots/`, mỗi ảnh ghi rõ chứng minh yêu cầu nào.
   - FPS: chơi khoảng 30 s rồi gọi `__fps()` (trung bình 30 mẫu 1 s, kèm kích thước canvas) và ghi vào `perf-fps.txt` cùng cấu hình máy.
