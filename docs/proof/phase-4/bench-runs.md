# Các lần chạy benchmark (máy tự đo: i7-12700H, Intel UHD, RAM 8 GB, Windows 11, Chrome 122)

Ghi lại tất cả lần chạy, không chỉ lần đẹp nhất. `bench.json` ở gốc repo là lần chạy chủ động cuối cùng (#10).

| # | Thay đổi trước lần chạy | duration | avg_fps | p1_low_fps | frame_ms_p95 | load_ms | draw calls |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Bản đầu: mỗi Bóng Mực 5 mesh, mỗi đom đóm 2 mesh | 10 s | 50.7 | 21.0 | 35.0 | 5123 | 1197 |
| 2 | InstancedMesh cho Bóng Mực và đom đóm | 10 s | 87.8 | 32.0 | 16.4 | 5722 | 111 |
| 3 | (cùng code, game trong pane dev vẫn chạy song song → tranh GPU) | 30 s | 57.9 | 4.7 | 34.6 | 12116 | 101 |
| 4 | Tắt dev server | 30 s | 73.1 | 28.3 | 29.1 | 8301 | 101 |
| 5 | Lấy mẫu RAM thưa hơn (PowerShell tốn CPU) | 30 s | 75.1 | 28.3 | 25.6 | 6537 | 101 |
| 6 | Tắt trang trí/hiệu ứng sáng tạo trong bench (Ticket-04) | 30 s | 76.8 | 26.3 | 28.1 | 6822 | 49 |
| 6b | Ẩn point light cường độ 0 của đèn chưa sáng | 30 s | 90.1 | 31.8 | 16.6 | — | 49 |
| 7 | Lần chạy chính thức đầu (cùng code với 6b) | 30 s | 83.6 | 28.3 | 18.2 | 7412 | 49 |
| 8 | Chạy ngoài ý muốn (lỗi bash của agent, xem ai-log), cùng code | 30 s | 79.3 | 28.5 | 19.7 | 9589 | 49 |
| 9 | Chạy lại chủ động, cùng code | 30 s | 45.8 | 17.2 | 43.3 | 11828 | 49 |
| 10 | Nghỉ 20 s rồi chạy lại, cùng code (đang cắm sạc, Balanced) | 30 s | 48.6 | 15.8 | 37.8 | 9898 | 49 |

Nhận xét trung thực: cùng một code (#6b → #10) mà avg_fps dao động 45–90 và p1_low_fps 16–32 trên laptop iGPU 8 GB này. Không tìm ra tiến trình nào tranh tài nguyên (đã kiểm tra), CPU tải khoảng 24%, đang cắm sạc. Khả năng cao là laptop bị hạ xung do nhiệt hoặc có hoạt động khác trên máy. Ở trạng thái tốt nhất, game đạt avg ≥ 60, p1 low ≈ 30, load ≤ 10 s. Ở các lần cuối thì **chưa đạt**. Số đo chính thức là trên máy chấm của giảng viên.
