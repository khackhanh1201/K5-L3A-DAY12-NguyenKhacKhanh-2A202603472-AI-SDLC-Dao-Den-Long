# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Tái lập ở tag `phase-3`: `npm ci && npm test`, hoặc `npm run verify -- --phase 3`.
Quyết định thiết kế: [ADR-001](../../adr/ADR-001-lantern-fuel-and-dawn-win.md) · Breaking changes: [CHANGELOG.md](../../../CHANGELOG.md) · Giả định C1–C9: [assumptions.md](../../notes/assumptions.md).

## Truy vết yêu cầu → bằng chứng (tests/phase3.test.js)

| Mục Ticket-03 | Scenario | Kết quả |
|---|---|---|
| 7 Tuning v1.2, thời lượng 240/270/300 | `tuning v1.2`, `Đêm 1/2/3 mặc định` | Đạt |
| 1 Dầu: lit mặc định 100, hao 1/s, xuất 1 chữ số, đèn tắt fuel 0 | `dầu: … hao 1/giây` | Đạt |
| 1 Hết dầu → `lantern_out`, deposited 0, ever_lit | `dầu: hết dầu` | Đạt |
| 1 Châm dầu: công thức used, giới hạn 100, +5/đom đóm, `refuel` | `châm dầu ×2` | Đạt |
| 1 Thắp lại 5 đom đóm, +40, `relight`, `relit_count` | `thắp lần đầu / thắp lại` | Đạt |
| 4 Sức chứa 10 + 2n ≤ 20, tăng khi thắp, nhặt quá 10 | `sức chứa` | Đạt |
| 2 Drain: ≤ 2 m, 5/s + 1/s, `fuel_drain` mỗi 60 tick, cộng dồn, đèn tắt → wander, bóng ở xa tìm tới đèn yếu | `drain ×3` | Đạt |
| 2 Drain → chase chỉ khi ≤ 6 m | `drain → chase` | Đạt |
| 2 Châm lên ≥ 30 → đẩy bóng ra trong 30 tick, không gây hit | `châm dầu lên ≥ 30` | Đạt |
| 2/5 Pulse trúng bóng drain +15 | `tỏa sáng trúng bóng đang drain` | Đạt |
| 2 Fuel < 30 mất vùng an toàn; ≥ 30 vẫn chặn | `vùng an toàn mất khi fuel < 30` | Đạt |
| 3 Không thắng sớm | `không còn thắng sớm` | Đạt |
| 3/5 Bình minh: ngưỡng ceil(0.6n) cả 3 Đêm, `dawn_survived`, điểm 50 + floor(fuel) + 50/lửa | `bình minh ×2` | Đạt |
| 3 Hết lửa ở tick bình minh → `no_flames` | `hết lửa ở đúng tick bình minh` | Đạt |
| 6 Chế độ mù màu (lưu), viền/mắt #00B3FF, cảnh báo trắng + ⚠, đèn tắt xẹp 20% + vết rách, đèn sắp hết dầu nhấp nháy 1 Hz | [02-colorblind](screenshots/02-colorblind-unlit-squashed.jpg); `localStorage` có `colorblind: true` | Đạt (kiểm tra bằng mắt) |
| 1/4 Thanh dầu trên đèn sáng, HUD đang mang/sức chứa, số đèn cần giữ | [01-fuel-bars](screenshots/01-fuel-bars-capacity.jpg) | Đạt (kiểm tra bằng mắt) |
| Regression Phase 1–2 không bị thay | 48 test trong `tests/contract.test.js` | Đạt |

Toàn bộ: 69/69 test đạt ([test-output.txt](test-output.txt)); tất định 3 Đêm ([determinism.txt](determinism.txt)); hiệu năng headless ([perf-headless.txt](perf-headless.txt)).

## Test cũ bị Ticket-03 thay (sửa/xóa có lý do, không skip)

| Test cũ | Xử lý | Lý do |
|---|---|---|
| `tuning khớp số chuẩn Ticket-02` | Sửa: thời lượng 240/270/300, khóa `score` mới | Mục 3, 5, 7 |
| `Đêm 1 mặc định`, `Đêm 2 và 3 mặc định` | Sửa `time_left_s` | Mục 3 |
| `thắng: điểm = nạp ×10 + 100 + giây×2 + 50×lửa` | **Xóa**, thay bằng `bình minh: … dawn_survived` | Mục 3 (không thắng sớm), mục 5 (bỏ thưởng thời gian) |
| `thắng đúng tick hết giờ vẫn là thắng; … dawn` | **Xóa**, thay bằng `bình minh` + `hết lửa ở đúng tick bình minh` | `all_lit` không còn dùng |
| Các test điểm khác dùng `T.score.*` | Tự đúng theo tuning mới | |

Ảnh được chụp trên `npm run dev` ở 1280×720. Trạng thái trong ảnh được dựng bằng console (đặt fuel, vị trí, thêm một Bóng Mực drain) để chụp nhanh.

## Làm đẹp giao diện (chỉ src/render, không đổi headless)

Bầu trời sao + trăng, biển mây trôi, sương, cỏ/đá/cây (cây cau ở Đêm 2), quầng sáng cho đèn/đom đóm/Bóng Mực, tone mapping ACES, HUD/menu kính mờ: [03](screenshots/03-visual-polish-n1.jpg), [04](screenshots/04-visual-polish-n3.jpg), [05](screenshots/05-menu-polish.jpg).

Hiệu năng sau khi làm đẹp (Đêm 3, canvas 1600×900, Intel UHD): render + `readPixels` để ép GPU đồng bộ, trung bình 40 khung hình = **10.3 ms/khung (≈ 97 FPS)**; tắt phần trang trí còn 8.75 ms; 123 draw call, khoảng 40k tam giác. FPS theo rAF khi cửa sổ mất focus bị trình duyệt hãm (≈ 1–20 FPS ở cả hai trường hợp A/B), nên không dùng số đó làm bằng chứng.
