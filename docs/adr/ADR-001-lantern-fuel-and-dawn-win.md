# ADR-001: Đèn có nhiên liệu và luật thắng "giữ đảo sáng tới bình minh"

- Trạng thái: Chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- Thay cho: luật "đèn sáng là vĩnh viễn", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi thắp hết đèn", công thức điểm Ticket-02

## Bối cảnh
Đến Phase 2, đèn chỉ có 2 trạng thái: `unlit` (đang nạp `deposited`) → `lit` (vĩnh viễn). Game kết thúc ngay khi tất cả đèn sáng. Ticket-03 muốn đèn tắt được, Bóng Mực có lý do quay lại đèn, và Đêm luôn kéo dài tới bình minh.

## Quyết định

### 1. Mô hình trạng thái đèn
```
          nạp đủ cost (10, hoặc 5 nếu ever_lit)
 UNLIT ─────────────────────────────────────────▶ LIT (fuel = 100)
   ▲                                               │  mỗi tick: fuel −= 1/60 (+5/60 cho mỗi Bóng Mực drain)
   │        fuel ≤ 0: lantern_out, deposited = 0   │  châm dầu: fuel += 10 × used
   └───────────────────────────────────────────────┘
 Thuộc tính lâu dài: ever_lit, relit_count.  Vùng an toàn chỉ có khi LIT và fuel ≥ 30.
```
- Dầu lưu bằng **số nguyên đơn vị 1/60** (`fuelU`, tối đa 6000), nên hao 1/s = −1 đơn vị/tick và hút 5/s = −5 đơn vị/tick. Không có sai số số thực; chỉ chia 60 và làm tròn 1 chữ số khi xuất snapshot.
- Trừ dầu là một "bộ đếm" ở bước 2 (đúng Ticket-03). Ngay sau bước 2, đèn hết dầu thì tắt. Bóng Mực đang `drain` từ tick trước được tính vào lượng hút của tick này.
- Tương tác chọn trong các đèn "nhận được" (chưa sáng, hoặc sáng nhưng `used > 0`). Đèn chưa sáng phát `deposit`, đèn đang sáng phát `refuel`.

### 2. Bóng Mực thêm trạng thái `drain`
FSM: `spawning → wander ⇄ chase`, `wander → drain` (≤ 2 m tới đèn yếu mục tiêu), `drain → chase` (Mây ≤ 6 m) / `stunned` (pulse) / `wander` (đèn tắt, fuel ≥ 30, hoặc > 2 m); `stunned → wander`; `recoil` dùng chung cho bị đẩy ra khỏi vùng an toàn. Ngưỡng vào chase của `drain` (6 m) khác của `wander` (12 m), nên kiểm tra theo trạng thái hiện tại chứ không dùng chung một luật khoảng cách.

### 3. Luật thắng
Bỏ kết thúc sớm. Bước 11 chỉ còn: hết lửa → `no_flames` (luôn trước); khi `time_left ≤ 0`: số đèn sáng ≥ ceil(0.6 × n) → `won/dawn_survived`, ngược lại `lost/dawn`. Thưởng bình minh tính trên trạng thái sau mọi cập nhật của tick cuối.

### 4. Sức chứa
`capacity = min(20, 10 + 2 × successful_lights)`, tính lại mỗi khi thắp thành công (kể cả thắp lại). Sức chứa không giảm khi đèn tắt.

## Hệ quả
- Test Phase 1–2 về "thắng khi thắp hết", điểm, thời lượng Đêm phải sửa (danh sách trong `docs/proof/phase-3/README.md`).
- Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`. Tool đọc output cũ cần thêm 3 trường này.
- Đêm luôn chạy tới bình minh nếu Mây còn sống, nên bài test hiệu năng chạy đủ thời lượng Đêm.
- Phương án đã cân nhắc và loại: lưu fuel bằng số thực rồi làm tròn mỗi tick. Bị loại vì sau hàng nghìn tick sai số làm lệch tick `lantern_out`.
