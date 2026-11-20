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

---

## Phase 2 (Ticket-02, Contract v1.1)

Ticket-02 **thay** các số và luật tự chọn ở Phase 1. Các giả định Phase 1 bị thay hoặc bỏ được ghi ở cột "Thay cho".

### Giả định cho chỗ Ticket-02 còn mơ hồ

| # | Chỗ mơ hồ | Giả định | Thay cho |
|---|---|---|---|
| B1 | Gia tốc "≤ 0.1 s" | Vận tốc ngang đạt ngay giá trị đích trong 1 tick (0 s ≤ 0.1 s) | |
| B2 | Tích phân trọng lực | Mỗi tick: `pos += vel/60` rồi `vel.y -= 20/60`. Chạm đất khi `y ≤ mặt đất` và `vel.y ≤ 0` thì đặt `y` = mặt đất, `vel.y` = 0 | A18 |
| B3 | Bám mặt đất khi xuống dốc | Đang đứng trên đất và mặt đất mới thấp hơn ≤ 0.35 m thì bám theo (không bay). Vách cao hơn chân > 0.35 m thì chặn, thử trượt theo từng trục X/Z | |
| B4 | `invuln` trong snapshot | Kiểu **boolean** (đang bất tử hay không). Các bộ đếm khác xuất ra theo giây (`*_s`) | |
| B5 | Điểm xuất phát Đêm 2 / Đêm 3 | Đêm 2: (0,0,0) trên đảo A. **Đêm 3: (0,0,−30)** trên tầng 0, vì (0,0,0) nằm trong tháp chuông. Quay mặt về +Z | |
| B6 | Bóng Mực và địa hình | Bóng Mực lướt trên mặt đất: `y` = mặt đất + 1.0. Không bị vách tầng chặn. Bị chặn bởi: biển mây (không có đất), tháp chuông, vùng an toàn của đèn đã sáng | A2 (cách chặn) |
| B7 | Trạng thái `spawning` | Kéo dài 60 tick (bò lên từ sương), không di chuyển, không gây hit | |
| B8 | Trạng thái `wander` | Trôi 1.5 m/s theo hướng ngẫu nhiên (seed), đổi hướng mỗi 120 tick hoặc khi gặp vật cản | |
| B9 | Bóng bị đẩy ra khi đèn vừa thắp | Đẩy theo bán kính, mỗi tick (6 − d₀)/30 m, trong đúng 30 tick. Trạng thái `recoil`, không gây hit | |
| B10 | Trạng thái Bóng Mực trong scenario không ghi `state` | Trong 12 m thì `chase`, ngoài thì `wander` | |
| B11 | Trần 30 đom đóm | Chỉ đếm đom đóm `random`. "Điểm trống" là điểm sinh chưa có đom đóm random nào đứng đó. Chọn ngẫu nhiên (seed) trong các điểm trống | |
| B12 | Đom đóm rơi ra chỗ không có đất | Vẫn đặt tại vị trí đó với `y` = chân Mây (có thể không nhặt được) | A3 |
| B13 | Rơi khỏi đảo | `player_hit {by:"fall", flames, dropped:0, lost:n}`. Trong 60 tick chờ, Mây đứng yên tại chỗ rơi, input bị bỏ qua | A9 |
| B14 | Điểm trong headless | `score` trong snapshot/end là điểm của Đêm đang chạy (cộng dồn khi nạp/thắp/pulse/thưởng thắng). Tổng điểm "các Đêm đã thắng" chỉ áp dụng cho chuỗi 3 Đêm trên UI | A6 |
| B15 | `night_start` | Ghi ngay sau snapshot tick 0, với `tick: 0` | |
| B16 | Pause | Cạnh lên của `pause` bật/tắt. Lúc đang pause, trạng thái các nút khác vẫn được cập nhật để tính cạnh (giữ nút qua lúc pause rồi thả ra không kích hoạt). Tick bật lại (`resumed`) chạy tiếp bước bình thường | |
| B17 | Gió Lạc | Bay ở `y` = mặt đất + 1.5. Sinh trên các điểm sinh Bóng Mực của Đêm. `idle` lượn 2 m/s, quay về tâm đảo nếu sắp ra biển. Snapshot giữ con đã `removed` (vị trí đứng yên). Pulse trúng `idle` thì không có tác dụng | |
| B18 | Gió mạnh | Chỉ có ở Đêm 3 (mặc định `wind_enabled` = true ở Đêm 3). Mỗi cơn kéo dài các sim tick [1800k, 1800k+300), k ≥ 1. Hướng `dir_deg` là số nguyên ngẫu nhiên 0–359, đẩy (cos, sin)·2 m/s theo (x, z) | |
| B19 | Lướt khi đang bay theo bục | Lướt thay vận tốc ngang trong 12 tick (giữ độ cao), xong thì vận tốc phóng tiếp tục tới khi chạm đất | |
| B20 | Tương tác với đèn | Bán kính đo theo XZ (theo contract v1.0) | |

### Thứ tự bước (Ticket-02, bắt buộc) — thay cho thứ tự Phase 1

Theo đúng 12 bước của Ticket-02. Cách đếm bộ đếm: giá trị N đặt ở bước k thì được giảm ở đầu các bước sau, nên hiệu lực đúng N bước. Ví dụ hồi chiêu lướt 90 tick: lướt ở bước k thì bước k+90 lướt lại được.

### Acceptance criteria Phase 2

| ID | Tiêu chí | Scenario |
|---|---|---|
| P2-N | Số chuẩn: chạy 60 tick đi 6 m; nhảy đúng chỉ khi chạm đất; nhặt XZ ≤ 1 và chênh cao ≤ 1.5; đèn 10 đom đóm nạp nhiều lần; tương tác 2 m; điểm +10/đom đóm **nạp** | `move-forward`, `jump-*`, `pickup-*`, `deposit-*` |
| P2-D | Lướt: 14 m/s × 12 tick = 2.8 m; hồi chiêu 90 tick tính từ lúc bắt đầu; hướng = hướng di chuyển, đứng yên thì theo mặt; trên không giữ độ cao; event `dash` | `dash-*` |
| P2-P | Tỏa Sáng: 3 đom đóm, bán kính 3D 5 m tính từ chân + 0.8, choáng 120 tick, bị đẩy 4 m trong 15 tick, hồi chiêu 180 tick, +5 mỗi con | `pulse-*` |
| P2-S | Bóng Mực: đuổi ≤ 12 m, bỏ > 18 m, 4.0/4.5 m/s, hit → recoil 2 m/60 tick, rơi floor(n/2) đom đóm ra vành 1.5–2.5 m, TTL 480, bất tử 90 | `shade-*`, `hit-*` |
| P2-Z | Vùng an toàn 6 m: chặn ở mép; bóng ở trong lúc đèn vừa thắp bị đẩy ra trong ≤ 30 tick, không gây hit | `safe-*` |
| P2-F | Rơi (Y < −10): −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh tại điểm xuất phát, bất tử 90; hết lửa thì thua ngay | `fall-*` |
| P2-M | Bản đồ: đúng đèn và điểm sinh của 3 Đêm; cầu, bục nhảy Đêm 2 đáp sang đảo kia; tầng, dốc, vách, tháp, bục Đêm 3 đáp lên tầng 2 | `night2-*`, `night3-*` |
| P2-W | Gió mạnh Đêm 3 đúng lịch, đẩy 2 m/s | `wind` |
| P2-G | **Gió Lạc:** chase khi mang ≥ 5 và cách ≤ 15 m, về idle khi mất điều kiện; chạm (XZ ≤ 1.2) cướp min(3, mang), flee 240 tick rồi removed; pulse lúc chase → flee không cướp; pulse lúc flee có đồ → thả lại thành đom đóm rơi, biến mất sau 120 tick; bất tử không chặn; không mất lửa | `drifter-*` |
| P2-C | **Bùa Gió:** nhặt như đom đóm; 600 tick (nhặt lại làm mới); tốc độ 7.2; lướt không hồi chiêu nhưng nhấn khi đang lướt bị bỏ qua; xuất hiện lại sau 2700 tick | `charm-*` |
| P2-Q | **Chuỗi 3 Đêm (UI):** menu → giới thiệu (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh với tổng điểm các Đêm đã thắng; thua → chơi lại Đêm đó | ảnh/clip |
| P2-U | **Tạm dừng:** Esc/P dừng logic hoàn toàn (headless: tick tăng, sim_tick/thời gian/spawn đứng yên, state `paused`); menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | `pause`, ảnh |
| P2-O | **Cài đặt:** âm lượng, độ nhạy chuột lưu vào localStorage, mở lại vẫn còn | ảnh + reload |
| P2-A | **Âm thanh:** nhạc nền + 10 hiệu ứng liệt kê (WebAudio tổng hợp, không dùng file) | danh sách trong code + thử nghe |
| P2-H | **HUD:** lửa trên trái; đồng hồ trên giữa (đỏ, nhấp nháy ≤ 30 s); đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt/Tỏa Sáng dưới phải; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình | ảnh |
| P2-K | Bảng màu chuẩn + ánh sáng môi trường 0.15 + 0.55 × tiến độ | so hằng số trong code |
| P2-T | Headless một Đêm đầy đủ 21.600 tick ≤ 30 s; ≥ 30 FPS trung bình ở 1280×720 | `perf`, đo FPS |

---

## Phase 3 (Ticket-03, Contract v1.2)

Quyết định thiết kế: [ADR-001](../adr/ADR-001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

| # | Chỗ mơ hồ | Giả định | Thay cho |
|---|---|---|---|
| C1 | Tốc độ Bóng Mực wander khi đi tới đèn | Tới **đèn yếu** (fuel < 30): đi với `shade_speed` (4.0/4.5). Tới đèn tắt: đi chậm 1.5 m/s; tới nơi (≤ 2 m) thì trôi ngẫu nhiên quanh đó. Không còn đèn tắt nào thì trôi ngẫu nhiên như B8 | B8 |
| C2 | Lúc nào chuyển sang `drain` | Ở bước 8. Lượng hút được trừ từ bước 2 của tick sau | |
| C3 | `fuel_drain` | Mỗi Bóng Mực, cứ đủ 60 tick hút (60, 120, …) thì ghi một event với fuel sau khi trừ | |
| C4 | Sự kiện khi nạp | Đèn chưa sáng: `deposit`; đèn đang sáng: `refuel` (không có `deposit`) | |
| C5 | Đẩy ra khi châm dầu | Chỉ khi châm làm fuel đi từ < 30 lên ≥ 30. Bóng trong 6 m (kể cả đang drain) bị đẩy ra mép trong 30 tick (`recoil`, không gây hit), sau đó `wander` | |
| C6 | Đèn sáng có `deposited` | Giữ bằng cost lúc thắp; về 0 khi tắt | |
| C7 | Khóa điểm trong tuning | `per_mote` 5, `per_lantern` 100, `per_relight` 40, `per_stun` 5, `per_stun_drain` 15, `per_lantern_at_dawn` 50, `per_second_left` 0, `per_flame_left` 50 | A6, B14 |
| C8 | Kiểm tra bình minh | Khi `time_left ≤ 0` (dung sai 1e-6) sau bước 10. Đếm đèn đang sáng sau khi trừ dầu và tắt đèn của tick đó | A8 |
| C9 | Sức chứa khi đang mang nhiều hơn | Sức chứa không giảm nên không xảy ra | |
