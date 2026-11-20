# Nhật ký dùng AI

Công cụ: Claude Code (desktop app), model Claude Opus 5.5.

## Phase 1

| Bước | Việc giao cho AI | Ghi chú / lỗi AI và cách phát hiện |
|---|---|---|
| Đọc lab | Tóm tắt 6 tài liệu lab thành hướng dẫn | |
| Spec | Lưu PRD-0 vào `docs/requirements/PRD-0.md`, phân tích Test Contract, liệt kê chỗ mơ hồ | Agent đọc spec từ file thay vì dán lại cả đoạn vào prompt mỗi lần, đỡ tốn token |
| Build | Dựng khung: core tất định + CLI headless + 26 test + render Three.js + harness | Lần thử nhạy (dispatch phím 200 ms) không nạp được đèn: tab nền bị throttle `requestAnimationFrame`. Giữ phím lâu hơn thì chạy đúng. Lỗi nằm ở cách thử, không phải ở game |
| Build | Cài vite qua Git Bash lỗi (`node` không có trong PATH của cmd.exe) | Chuyển sang PowerShell |
| Verify | Chạy `npm run verify`, chụp ảnh UI, thử hook với một test đỏ cố ý | |

**Token / chi phí ước tính Phase 1:** _(điền từ trang usage của claude.ai / Claude Code khi hết phase)_

**Cách tiết kiệm token:**
- Lưu spec thành file, agent đọc khi cần.
- `AGENTS.md` ngắn (khoảng 30 dòng).
- Viết test trước để sửa đúng chỗ ngay, không phải đoán lỗi qua nhiều vòng.
- Kiểm chứng UI bằng `window.__game()` + screenshot nhỏ (scale 0.6).

## Phase 2

| Bước | Việc giao cho AI | Ghi chú / lỗi AI và cách phát hiện |
|---|---|---|
| Spec | Lưu Ticket-02 vào `docs/requirements/TICKET-02.md`; viết 20 giả định B1–B20 và acceptance criteria cho từng mục Phần 3 | |
| Skill ngoài | Clone `gamedev-skills/awesome-gamedev-agent-skills` (Apache-2.0) vào scratchpad, đọc lướt tìm nội dung đáng ngờ, chỉ chép 6 skill liên quan vào `.claude/skills/` và thêm vào `.gitignore` (không commit theo yêu cầu) | Áp dụng: FSM có ngưỡng trễ 12/18 (`game-ai`), stack màn hình + focus nút đầu (`game-ui-ux`), bus nhạc/SFX + âm lượng bình phương + biến thể cao độ (`audio-design`), giới hạn pixel ratio 1.5 + `setAnimationLoop` (`threejs-scene-setup`) |
| Core | Viết lại `game.js` theo 12 bước Ticket-02, bản đồ 3 Đêm ở `level.js` | Lỗi 1: gió đẩy 299 tick thay vì 300 (bộ đếm giảm trước khi dùng). Test "đúng 10 m" bắt được, sửa bằng cách coi gió là bộ đếm ở bước 2. Lỗi 2: Gió Lạc bị pulse biến mất sớm 1 tick so với lúc bị cướp. Test bắt được, thêm cờ `fresh`. Cả hai sửa ở code, không sửa giá trị mong đợi |
| Test | 53 test (Phase 1 viết lại theo số chuẩn + scenario cho mỗi tính năng mới) | Test gió: đổi mốc đo từ tick 1800 sang 1790 để cửa sổ đo chứa đủ 300 bước có gió, giá trị mong đợi 10 m giữ nguyên |
| UI | Menu/giới thiệu/kết quả/Bình Minh, pause, cài đặt (localStorage), WebAudio, HUD theo bố cục, mũi tên tới đèn, bảng màu chuẩn | Lần đầu pane trình duyệt bị ẩn nên rAF dừng: ghi "chưa đo" thay vì đoán. Sau khi mở pane: đo được 137/120 FPS (Đêm 1/3), chụp 10 ảnh. Kiểm tra UI bắt được 2 lỗi AI viết sai: menu không hiện lúc mở (stack rỗng), bùa vàng thay vì đỏ (độ dày hộp) |

**Token / chi phí ước tính Phase 2:** _(điền từ trang usage)_

**Cách tiết kiệm token:** chỉ đọc 2 skill ngoài đầy đủ, còn lại grep ý chính; lưu ticket thành file; test viết trước nên 51/53 đạt ngay lần chạy đầu, chỉ sửa 2 lỗi thật.

## Phase 3

| Bước | Việc giao cho AI | Ghi chú / lỗi AI và cách phát hiện |
|---|---|---|
| Spec | Lưu Ticket-03; viết ADR-001 (mô hình trạng thái đèn + luật thắng), CHANGELOG breaking changes, giả định C1–C9 | Chọn lưu dầu bằng số nguyên 1/60 theo khuyến nghị của ticket |
| Core | Dầu đèn, châm dầu, thắp lại, drain, luật thắng bình minh, sức chứa, điểm mới | Chạy test cũ trước: đúng 5 test đỏ, khớp các luật bị thay. Sửa/xóa kèm comment lý do |
| Test | 16 scenario mới trong tests/phase3.test.js | 6 test đỏ ở lần chạy đầu. 5 là lỗi viết test: đọc snapshot ở tick không được ghi, cửa sổ thời gian quá ngắn. 1 là giá trị mong đợi tính thiếu: bóng drain từ scenario hút ngay ở bước 0 (49.9 chứ không phải 50). Đã xem lại luật trước khi sửa giá trị mong đợi; code không đổi |
| Phát hiện từ spec | "Đèn đầy (used = 0) không được chọn" gần như không xảy ra, vì dầu bị trừ ở bước 2 trước bước tương tác, nên đèn luôn thiếu ≥ 1/60 và tốn 1 đom đóm. Giữ đúng công thức của ticket, ghi thành test riêng | |
| UI | Thanh dầu, nhấp nháy 1 Hz, HUD sức chứa và số đèn cần giữ, chế độ mù màu | Kiểm tra bằng ảnh 1280×720 |

**Token / chi phí ước tính Phase 3:** _(điền từ trang usage)_ · Tiết kiệm: sửa bằng script thay chuỗi thay vì viết lại file, chỉ chạy lại test liên quan khi debug.
| UI (làm đẹp) | Bầu trời, biển mây, sương, cây cỏ, quầng sáng, HUD kính mờ (`src/render/decor.js`) | Lỗi 1: quầng đèn gần như vô hình sau tone mapping ACES, phát hiện qua ảnh chụp và sửa bằng màu > 1.0. Lỗi 2: số đo FPS theo rAF tụt còn khoảng 20 vì cửa sổ mất focus. A/B bật/tắt trang trí cho kết quả như nhau, nên chuyển sang đo thời gian render có ép GPU đồng bộ (10.3 ms) |
