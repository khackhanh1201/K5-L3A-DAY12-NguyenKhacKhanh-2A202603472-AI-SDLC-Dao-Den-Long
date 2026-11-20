# Bằng chứng Phase 1

Tái lập ở tag `phase-1`: `npm ci && npm test` (hoặc `npm run verify` để sinh lại các file trong thư mục này).
Mỗi scenario chạy CLI headless thật và ghi đầu vào/ra vào `out/scenarios/<tên>/` (scenario.json, inputs.json, out.jsonl).
Giá trị mong đợi được tính tay từ PRD-0 và `tuning`, không copy từ output.

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P1-R1 | Định dạng output, mô hình tick, mã thoát 0 | scenario `format`, `default-level` | [test-output.txt](test-output.txt) | Đạt |
| P1-R2 | Di chuyển, yaw, chuẩn hóa | `move-forward`, `move-yaw90`, `move-diagonal`, unit `worldMove` | test-output.txt | Đạt |
| P1-R3 | Nhặt đom đóm, sức chứa | `pickup`, `capacity` | test-output.txt | Đạt |
| P1-R4 | Nạp/thắp đèn, cạnh nút | `deposit-lit`, `deposit-partial`, `deposit-out-of-range`, `edge-trigger` | test-output.txt; [ảnh 02](screenshots/02-lantern-lit-safe-ring.jpg) | Đạt |
| P1-R5 | Tỏa sáng: stun, đẩy, thời gian choáng, chi phí, cooldown | `pulse-stun`, `pulse-no-light`, `pulse-cooldown` | test-output.txt; [ảnh 04](screenshots/04-pulse-stun.jpg) | Đạt |
| P1-R6 | Bị chạm: flame, rơi đom đóm, bất tử | `hit-invuln` | test-output.txt | Đạt |
| P1-R7 | Thắng/thua + điểm thưởng | `lose-no-flames`, `lose-dawn`, `win`, `scenario-no-score` | test-output.txt; [ảnh 03](screenshots/03-win-overlay.jpg) | Đạt |
| P1-R8 | Vùng an toàn quanh đèn đã thắp | `safe-zone` (snapshot mỗi tick, 300 tick) | test-output.txt | Đạt |
| P1-R9 | Tất định; input sai → mã 2 | `determinism`, `bad-input-*`; chạy 2 lần so sha256 | [determinism.txt](determinism.txt) | Đạt |
| P1-R10 | Bản giao diện: đi, camera, HUD, đảo sáng dần, thắng/thua, chơi lại | Chơi thử trên `npm run dev` (Chromium) | [ảnh 01](screenshots/01-start-hud.jpg), 02, 03, 04 | Đạt (kiểm tra bằng mắt) |
| Harness | Hook Stop chặn khi test đỏ | Thêm tạm một test đỏ, chạy hook | [hook-blocks-red.txt](hook-blocks-red.txt) | Đạt |

Ghi chú:
- Ảnh được chụp khi chơi thử trên bản dev. Ở ảnh 02, 03, 04, trạng thái được dựng nhanh bằng console (`window.__game()`: dịch chuyển Mây tới cạnh đèn, đặt số đom đóm) để chụp nhanh. Luật chơi vẫn do core xử lý.
- Hiệu năng: lần chạy mẫu 1115 tick mất khoảng 80 ms trên máy dev (Windows 11, Node 20). Phase 1 chưa có yêu cầu đo.
- Chưa kiểm chứng: chạy trên macOS (CI có job macOS-latest và ubuntu-latest, xem tab Actions sau khi push).
