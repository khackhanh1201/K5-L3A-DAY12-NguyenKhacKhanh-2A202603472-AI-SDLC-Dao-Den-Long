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
