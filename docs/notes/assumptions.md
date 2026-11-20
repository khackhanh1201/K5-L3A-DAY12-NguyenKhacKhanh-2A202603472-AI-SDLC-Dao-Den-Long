# Giả định và tiêu chí nghiệm thu

## Phase 1 (PRD-0, Contract v1.0)

### Giả định cho chỗ PRD-0 còn mơ hồ

| # | Chỗ mơ hồ | Giả định đã chọn | Lý do |
|---|---|---|---|
| A1 | "Tỏa sáng tốn ánh sáng": tốn gì? | Tốn `pulse_cost` đom đóm **đang mang**. Mang ít hơn `pulse_cost` thì không tỏa sáng được (không có event) | Đom đóm là "ánh sáng"; flames là máu |
| A2 | `safe_radius` áp dụng cho đèn nào? | Chỉ **đèn đã thắp**. Bóng Mực bị đẩy ra mép vùng an toàn sau mỗi lần di chuyển/bị đẩy | "Bóng Mực sợ những chiếc đèn" + đèn tắt thì không có ánh sáng |
| A3 | Đom đóm rơi khi bị chạm đi đâu? | `dropped = floor(carried × hit_drop_ratio)`, số rơi **biến mất** (không rải lại trên đất) | Đơn giản, tất định |
| A4 | Nạp đèn | Nhấn interact (cạnh lên) trong `interact_radius` của **đèn chưa thắp gần nhất** (hòa thì theo thứ tự id). Nạp `min(carried, lantern_cost − deposited)`. Đủ cost thì thắp | Contract có nút interact |
| A5 | Nhặt đom đóm | Tự động khi trong `pickup_radius` và `carried < carry_capacity`. Nhiều con cùng tick thì xét theo thứ tự id, mỗi con một event | |
| A6 | Điểm | `per_mote` mỗi con nhặt; `per_lantern` mỗi đèn thắp; `per_stun` mỗi Bóng Mực trong `stunned_ids`; **chỉ khi thắng** cộng `floor(time_left_s) × per_second_left + flames × per_flame_left` | Thưởng thời gian chỉ có nghĩa khi thắng |
| A7 | Snapshot khi game dừng ở tick không chia hết cho `--snapshot-every` | Ghi thêm **một snapshot tại tick dừng** trước dòng `end` | Test luôn đọc được trạng thái cuối |
| A8 | Đồng thời nhiều điều kiện kết thúc | Ưu tiên: `all_lit` (thắng) > `no_flames` > `dawn` | Có lợi cho người chơi |
| A9 | Rơi khỏi đảo | `fall_enabled: false`. Đảo có rìa bán kính 40 m, người chơi bị chặn ở rìa. Không có event `player_hit` với `by: "fall"` | Giảm phạm vi Phase 1 |
| A10 | So sánh "≤ r" với số thực | Dùng dung sai 1e-6 (`EPS`) | Tránh lệch 1 tick do lỗi làm tròn số thực |
| A11 | Thời gian các bộ đếm | Đổi giây sang tick: `round(s × 60)`. Bất tử/choáng/hồi chiêu đặt ở bước k thì có hiệu lực đúng `s×60` bước (bước k … k+s×60−1) | Mô hình tick của contract |
| A12 | Bị chạm nhiều con cùng lúc | Tối đa 1 lần trúng mỗi bước (sau đó bất tử) | |
| A13 | Bóng Mực bị choáng | Không di chuyển, không gây sát thương. Trạng thái trong snapshot: `stunned`, còn lại `chase` | |
| A14 | Pulse không trúng con nào | Vẫn tốn ánh sáng, vẫn ghi event `pulse` với `stunned_ids: []` | Hành động đã xảy ra |
| A15 | Sinh thực thể khi `random_*` bật | Đom đóm: 40 con lúc đầu (seed), mỗi 5 s hồi 1 con nếu < 40. Bóng Mực: con đầu ở giây 5, sau đó mỗi 15 s, tối đa 4, sinh ở mép đảo (r = 38) cách người chơi ≥ 12 m, có event `shade_spawned`. Màn mặc định lúc đầu chưa có Bóng Mực | Cho người chơi thời gian làm quen |
| A16 | Scenario có `motes` nhưng `random_motes` không ghi | Danh sách bị thay thế; việc hồi đom đóm vẫn theo cờ `random_motes` (mặc định bật) | Đọc sát contract |
| A17 | Input sai định dạng | Tick không tăng nghiêm ngặt, move ngoài [−1,1], kiểu dữ liệu sai, JSON hỏng, không đọc được file → mã thoát 2. Tham số CLI sai → mã thoát 1 | |
| A18 | Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s². Nhảy không ảnh hưởng khoảng cách (đo theo XZ) | Contract đo khoảng cách theo XZ |

### Thứ tự xử lý trong một bước (k → k+1)

1. Đọc input của tick k, phát hiện cạnh false→true của jump / interact / pulse.
2. Di chuyển người chơi (`worldMove` theo công thức contract, chuẩn hóa nếu dài hơn 1), kẹp trong rìa đảo, nhảy/trọng lực.
3. Nhặt đom đóm.
4. Nạp đèn / thắp đèn.
5. Tỏa sáng (stun, đẩy, kẹp đảo + vùng an toàn).
6. Bóng Mực không choáng đuổi theo người chơi với tốc độ `shade_speed`, sau đó áp vùng an toàn.
7. Va chạm Bóng Mực ↔ người chơi.
8. Giảm bộ đếm (bất tử, hồi chiêu, choáng), sinh thực thể, `steps += 1`.
9. Kiểm tra kết thúc (A8). Thắng thì cộng thưởng (A6).

### Tiêu chí nghiệm thu Phase 1

| ID | Tiêu chí ("làm A thì thấy B") |
|---|---|
| P1-R1 | Chạy headless đúng tham số → JSONL có snapshot tick 0, mỗi N tick, dòng cuối `end`, mã thoát 0 |
| P1-R2 | move [0,1] trong 60 tick → người chơi đi đúng `player_speed` m theo +Z; yaw xoay đúng công thức; vector chéo được chuẩn hóa |
| P1-R3 | Đi qua đom đóm → `mote_picked` đúng tick vào bán kính; đầy sức chứa thì không nhặt |
| P1-R4 | Đủ `lantern_cost` + interact cạnh đèn → `deposit` + `lantern_lit`; nạp một phần; ngoài bán kính thì không có gì |
| P1-R5 | Pulse → stun con trong bán kính, đẩy `pulse_push_m`, hết choáng sau `pulse_stun_s`; tốn ánh sáng; tôn trọng cooldown |
| P1-R6 | Bóng Mực chạm → mất 1 flame, rơi đom đóm, bất tử `invuln_s` |
| P1-R7 | Hết flame → lost/no_flames; hết giờ → lost/dawn; thắp đủ 5 đèn → won/all_lit kèm thưởng |
| P1-R8 | Bóng Mực không vào `safe_radius` của đèn đã thắp |
| P1-R9 | Cùng seed + input → output giống hệt; input sai → mã thoát 2 |
| P1-R10 | Bản có giao diện: đi, nhảy, camera, HUD, thắp đèn làm đảo sáng dần, thắng/thua, chơi lại |
