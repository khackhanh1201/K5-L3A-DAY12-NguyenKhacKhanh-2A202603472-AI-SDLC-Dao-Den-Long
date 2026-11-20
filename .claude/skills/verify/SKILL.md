---
name: verify
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (unit test, scenario headless, tất định, mẫu output) và lưu bằng chứng vào docs/proof/phase-N/. Dùng sau khi sửa logic game, trước khi gắn tag phase, hoặc khi cần bằng chứng cho bảng truy vết.
---

# Skill: verify

1. Xác định phase hiện tại N (tag gần nhất + 1, hoặc theo ticket đang làm).
2. Chạy: `node scripts/verify.mjs --phase N`
   - Chạy `node --test tests/` → `docs/proof/phase-N/test-output.txt`
   - Chạy headless 2 lần cùng seed → so sha256 → `docs/proof/phase-N/determinism.txt`
   - Lưu một lần chạy mẫu đầy đủ → `docs/proof/phase-N/sample-run.jsonl`
   - In tóm tắt pass/fail.
3. Nếu có test đỏ: DỪNG, báo test nào đỏ và vì sao. Không sửa giá trị mong đợi để cho qua.
4. Cập nhật cột "Kết quả" trong `docs/proof/phase-N/README.md` theo đúng output vừa chạy (không ghi "Đạt" cho mục chưa chạy).
5. Phần chỉ nhìn mới thấy (HUD, ánh sáng): chụp màn hình bản `npm run dev` và lưu vào `docs/proof/phase-N/screenshots/`, mỗi ảnh ghi rõ chứng minh yêu cầu nào.
