# Bằng chứng Phase 2 (Ticket-02, Contract v1.1)

Tái lập ở tag `phase-2`: `npm ci && npm test`, hoặc `npm run verify -- --phase 2` để sinh lại các file trong thư mục này.
Mỗi scenario chạy CLI headless thật và ghi đầu vào/ra vào `out/scenarios/<tên>/`. Giá trị mong đợi được tính tay từ Ticket-02 và `tuning`, không copy từ output.

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Scenario (tests/contract.test.js) | Kết quả |
|---|---|---|---|
| P2-N | Số chuẩn, tuning v1.1, di chuyển 6 m/s, nhảy 7 m/s & g = 20, nhặt XZ ≤ 1 + chênh cao ≤ 1.5, sức chứa 10, đèn 10 đom đóm nạp nhiều lần, bán kính 2 m, chọn đèn gần nhất / id nhỏ hơn, điểm +10/đom đóm nạp | `tuning khớp`, `di chuyển`, `nhảy`, `nhặt`, `sức chứa`, `nạp đèn ×4` | Đạt |
| P2-D | Lướt 14 m/s × 0.2 s, hồi chiêu 1.5 s từ lúc bắt đầu, hướng di chuyển/hướng mặt, trên không giữ độ cao | `lướt ×2` | Đạt |
| P2-P | Tỏa Sáng 3 đom đóm, bán kính 3D 5 m từ chân + 0.8, choáng 120, đẩy 4 m/15 tick, hồi chiêu 3 s, +5 kể cả con đang choáng | `tỏa sáng ×4` | Đạt |
| P2-S | Bóng Mực: lịch sinh 300 + 480k (Đêm 1), spawning, ≥ 15 m, đuổi 12 / bỏ 18, 4.0 và 4.5 m/s, hit → recoil, rơi floor(n/2) ra vành 1.5–2.5 m, TTL 480, bất tử 90 | `lịch sinh`, `Bóng Mực ×3`, `bị đánh`, `TTL` | Đạt |
| P2-Z | Vùng an toàn 6 m chặn ở mép; đèn vừa thắp đẩy bóng ra trong 30 tick, không gây hit | `vùng an toàn ×2` | Đạt |
| P2-F | Rơi Y < −10: −1 lửa, mất hết, chờ 60, hồi sinh tại điểm xuất phát + bất tử; hết lửa thì thua ngay | `rơi ×2` | Đạt |
| P2-M | Bản đồ 3 Đêm: đèn, điểm sinh, cầu, bục Đêm 2 (đáp đảo B sau ≈ 1.4 s), vách tầng, dốc, tháp, bục Đêm 3 lên tầng 2 | `Đêm 1/2/3 mặc định`, `Đêm 2 ×2`, `Đêm 3 ×3` | Đạt |
| P2-W | Gió mạnh Đêm 3: mỗi 30 s, 5 s, 2 m/s (đúng 10 m) | `gió mạnh` | Đạt |
| P2-G | Gió Lạc: chase/idle, cướp 3, flee 240 → removed, pulse lúc chase/flee, bất tử không chặn, không mất lửa, sinh ở tick 1200 | `Gió Lạc ×5` | Đạt |
| P2-C | Bùa Gió: 600 tick, 7.2 m/s, lướt không hồi chiêu (bỏ qua khi đang lướt), xuất hiện lại sau 2700 | `Bùa Gió ×2` | Đạt |
| P2-U | Tạm dừng headless: tick tăng, sim_tick/thời gian/di chuyển đứng yên, state `paused`, event paused/resumed | `tạm dừng` | Đạt |
| P2-WL | Thắng/thua: no_flames > all_lit > dawn; thắng đúng tick hết giờ; điểm thắng | `thắng ×2`, `dựng scenario` | Đạt |
| P2-E | Sai định dạng → mã 2 (gồm `dash`, `state` Bóng Mực) | `input/scenario sai` | Đạt |
| P2-R | Tất định cả 3 Đêm | `tất định ×3`, [determinism.txt](determinism.txt) | Đạt |
| P2-T1 | Headless một Đêm ≤ 30 s | `hiệu năng`, [perf-headless.txt](perf-headless.txt) | Đạt (< 1 s) |
| Regression | Test Phase 1 chạy lại với số chuẩn | Các test Phase 1 đã viết lại theo số chuẩn (xem dưới) | Đạt |
| P2-Q/U/O/H/K | Chuỗi 3 Đêm, menu tạm dừng, cài đặt lưu, HUD, bảng màu | Ảnh trong `screenshots/` + kiểm tra bằng `__game()` (mục UI) | Đạt (kiểm tra bằng mắt) |
| P2-A | Âm thanh: nhạc nền + 10 hiệu ứng | `SFX` trong `src/render/audio.js` được gọi theo event | Có trong code; **chưa nghe thử** bằng tai |
| P2-T2 | ≥ 30 FPS trung bình ở 1280×720 | `__fps()` 30 mẫu, [perf-fps.txt](perf-fps.txt) | Đạt: Đêm 1 137 FPS, Đêm 3 120 FPS (Intel UHD) |

## Test Phase 1 bị Ticket-02 thay đổi (sửa có lý do, không tắt)

| Test Phase 1 | Thay đổi | Lý do |
|---|---|---|
| `pickup` | Bỏ kiểm tra `+per_mote` khi nhặt, thêm điều kiện chênh cao | Ticket-02: +10 cho mỗi đom đóm **nạp**, nhặt cần chênh cao ≤ 1.5 |
| `deposit-*` | Đèn cần 10, bán kính 2.0 (cũ 2.5), thêm tie-break id | Số chuẩn |
| `pulse-*` | 3 đom đóm, choáng 120 tick (cũ 3 s), đẩy trong 15 tick (cũ đẩy tức thì), hồi chiêu 180 tick, đo 3D | Số chuẩn + luật mới |
| `hit-invuln` → `hit` | Rơi đom đóm ra vành thay vì biến mất (A3 bị thay), bóng recoil | Luật mới |
| `safe-zone` | Bán kính 6, thêm trường hợp đẩy ra khi đèn vừa thắp | Luật mới |
| `win` | Thưởng giây ×2, điểm nạp ×10 | Điểm chuẩn hóa |
| Giả định A9 (không rơi) | Bỏ: `fall_enabled: true` | Ticket-02 có luật rơi |

## UI (kiểm tra bằng trình duyệt, 1280×720)

| Ảnh | Chứng minh |
|---|---|
| [01-menu](screenshots/01-menu.jpg) | Menu chính |
| [02-intro-ong-dang](screenshots/02-intro-ong-dang.jpg) | Giới thiệu Đêm: tên đảo + lời Ông Đăng |
| [03-n1-hud-arrow](screenshots/03-n1-hud-arrow.jpg) | HUD đủ vị trí: lửa trên trái, đồng hồ giữa, đèn/điểm phải, 10 ô đom đóm, hồi chiêu dưới phải; mũi tên tới đèn chưa sáng gần nhất (L3, ở sau lưng) |
| [04-n1-shades-wander](screenshots/04-n1-shades-wander.jpg) | Bóng Mực thân đen viền tím, đang wander ở xa |
| [05-n1-prompt-shade](screenshots/05-n1-prompt-shade.jpg) | Nhắc "E — Nạp ánh sáng (4/10)"; đèn đã sáng có vòng an toàn; thanh đom đóm đầy |
| [06-n2-bridge-orbit](screenshots/06-n2-bridge-orbit.jpg) | Đêm 2: cầu tre giữa 2 đảo, đom đóm bay quanh Mây |
| [07-n2-charm-red](screenshots/07-n2-charm-red.png) | Bùa Gió đỏ viền vàng trên cầu |
| [08-pause-menu](screenshots/08-pause-menu.jpg) | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| [09-n3-wind-leaves](screenshots/09-n3-wind-leaves.jpg) | Đêm 3: tầng 1 và tầng 2, gió mạnh với lá bay + chữ cảnh báo |
| [10-dawn](screenshots/10-dawn.jpg) | Thắng Đêm 3 → màn hình Bình Minh với tổng điểm |

- Cài đặt: kéo âm lượng → `localStorage['ddl-settings-v1']` được ghi; mở lại trang vẫn đọc giá trị đó.
- Trạng thái trong ảnh 03–10 được dựng nhanh bằng console (`__startNight`, đặt vị trí/số đom đóm, flames 99, đặt đèn sáng) để chụp. Luật chơi vẫn do core xử lý.
- Lỗi phát hiện khi kiểm tra UI và đã sửa: (1) menu chính không hiện khi mới mở (stack màn hình khởi tạo rỗng); (2) Bùa Gió hiện toàn màu vàng vì mặt đỏ mỏng hơn viền.
