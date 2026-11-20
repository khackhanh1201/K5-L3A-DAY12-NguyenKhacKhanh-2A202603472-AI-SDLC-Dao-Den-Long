# Retro — Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

## 1. Tổng hợp Evaluation 4 phase

| Phase | Yêu cầu | Kết quả | Hỏng phase trước? | Điều đã chỉnh |
|---|---|---|---|---|
| 1 · PRD-0 / v1.0 | Đêm 1, headless | 26 test, tất định, UI chơi được | — | Dựng harness ngay từ đầu (AGENTS.md, hook Stop, skill verify, CI) |
| 2 · Ticket-02 / v1.1 | Số chuẩn, 3 Đêm, lướt, Gió Lạc, Bùa Gió, pause, rơi, UI đầy đủ | 53 test, 137/120 FPS ở 1280×720 | Có, có chủ đích: số và luật Phase 1 bị thay. Sửa test kèm lý do | Thêm quy tắc "bộ đếm N đặt ở bước k hiệu lực đúng N bước" vào AGENTS.md sau 2 lỗi lệch 1 tick |
| 3 · Ticket-03 / v1.2 | Dầu đèn, drain, thắng lúc bình minh, sức chứa, mù màu | 69 test, ADR-001, CHANGELOG | Đúng 5 test cũ đỏ, đều là luật bị thay; sửa 3, xóa 2 có lý do | Quy tắc lưu dầu bằng số nguyên 1/60; quy tắc "ticket thay luật thì sửa/xóa test có lý do, không skip" |
| 4 · Ticket-04 / v1.3 | Bench, soak, bảng xếp hạng, accessibility, đóng gói | 78 test; bench tốt nhất avg 90.1 / p1 31.8 nhưng dao động mạnh, lần cuối 48.6 / 15.8 (**chưa ổn định đạt trên iGPU tự đo**); soak đạt | Không (69 test cũ vẫn đạt) | Instancing, tắt light thừa; ghi đủ mọi lần đo |

## 2. Điều hiệu quả / không hiệu quả khi làm với AI

**Hiệu quả**
- Lưu mỗi ticket thành file trong `docs/requirements/`, agent đọc từ đó: không phải dán lại spec, ít hiểu nhầm.
- **Viết scenario headless trước, giá trị mong đợi tính tay từ spec.** Ở Phase 2, 51/53 test đạt ngay lần đầu; 2 test đỏ chỉ ra đúng 2 lỗi thật.
- Tách core thuần khỏi render: thay luật ở Phase 3 chỉ đụng `game.js`; UI làm lại thoải mái mà không sợ đổi output.
- Đo thay vì đoán: hiệu năng được giải quyết bằng số liệu (draw call, thời gian bước mô phỏng, khung chậm nhất), không phải bằng cảm giác.

**Không hiệu quả**
- Sửa file bằng heredoc trong Bash: 3 lần vỡ vì dấu nháy, có lần nuốt dấu `\` trong regex. Chuyển sang công cụ Write/Edit thì hết.
- Đo FPS trong pane trình duyệt bị ẩn hoặc mất focus: rAF bị hãm cho ra số sai (1–24 FPS). Phải đổi sang đo thời gian render có ép GPU đồng bộ, rồi dùng cửa sổ trình duyệt riêng cho bench.
- Lần bench đầu chạy cùng lúc với game trong pane dev nên hai bên tranh GPU (57.9 FPS, p1 low 4.7). Phải tắt hết rồi đo lại.

## 3. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa |
|---|---|---|
| Gió đẩy 299 tick thay vì 300 | Test "dịch đúng 10 m" | Coi gió là bộ đếm ở bước 2 |
| Gió Lạc bị pulse biến mất sớm 1 tick | Test so với lúc bị cướp | Cờ `fresh` + quy tắc trong AGENTS.md |
| Menu chính không hiện khi mở game (stack màn hình rỗng) | Chụp ảnh UI | Khởi tạo stack bằng `scr-menu` |
| Bùa Gió hiện vàng thay vì đỏ | Chụp ảnh UI | Mặt đỏ dày hơn viền |
| Quầng sáng đèn vô hình sau tone mapping | Chụp ảnh + đọc giá trị qua hook debug | Màu > 1.0 |
| Test Phase 3 đọc snapshot ở tick không được ghi; tính thiếu lượng hút ở bước 0 | Test đỏ, đọc lại spec trước khi sửa giá trị mong đợi | Sửa test (code đúng) |
| Soak mem ×1.48 | Đo heap từng Đêm: 3.6–3.8 MB ổn định, nghĩa là không rò rỉ mà do JIT | Khởi động JIT, ghi cả 2 số |
| Regex chặn path traversal bị Bash nuốt dấu `\` | Test lệnh xuất bảng xếp hạng đỏ | Viết lại bằng Edit |

Ghi chú: AI không bịa yêu cầu. Chỗ mơ hồ được ghi thành giả định (A1–A18, B1–B20, C1–C9) để hỏi trợ giảng.

## 4. Harness nào giúp nhiều nhất

1. **Scenario headless + `npm test`**: bắt lỗi lệch tick mà mắt thường không thấy, đồng thời là bằng chứng.
2. **AGENTS.md**: các quy tắc rút ra từ lỗi thật (bộ đếm, dầu số nguyên, không skip test) giúp không lặp lại lỗi ở phase sau.
3. **Skill `verify`**: một lệnh sinh lại toàn bộ bằng chứng theo đúng commit.
4. **Hook Stop**: đảm bảo không kết thúc khi test đỏ (đã thử bằng một test đỏ cố ý).
5. Skill ngoài (game-ai, game-ui-ux, audio-design, performance-optimization): gợi ý FSM có ngưỡng trễ, menu dạng stack, bus âm thanh, và "cắt draw call trước tiên". Ý cuối chính là cách đưa bench từ 50 lên 84–90 FPS.

## 5. Token / chi phí AI

- Toàn bộ làm trong 1 phiên Claude Code (Opus). Số chính xác từng phase: _(điền từ trang usage của claude.ai / Claude Code)_.
- Cách tiết kiệm: spec lưu thành file; AGENTS.md ngắn; test viết trước nên ít vòng sửa; sửa bằng thay chuỗi nhỏ thay vì viết lại file; chỉ đọc kỹ 2 skill ngoài, còn lại grep ý chính; ảnh chụp scale nhỏ; khi debug chỉ chạy test liên quan (`--test-name-pattern`).
- Chỗ tốn token nhất: dò lỗi đo FPS trong pane trình duyệt ẩn, và một lần làm lại 3 file vì heredoc Bash vỡ.

## 6. Nếu làm lại thì đổi gì

- Ngay từ Phase 1: dùng InstancedMesh cho thực thể số lượng lớn, có sẵn một cửa sổ đo FPS độc lập (không dùng pane), và CI đo bench.
- Không bao giờ dùng heredoc Bash để sửa code; luôn dùng Write/Edit.
- Hỏi trợ giảng các giả định quan trọng (B4 `invuln` kiểu gì, B5 điểm xuất phát Đêm 3, C1 tốc độ tới đèn yếu) sớm hơn, trước khi viết test.
- Thêm một test "UI smoke" tự động (Playwright) để bắt lỗi như menu không hiện, thay vì chỉ phát hiện qua ảnh chụp.
