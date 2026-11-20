# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_
> Day 12 · AI SDLC Lab · Nguyễn Khắc Khánh · 2A202603472. Tài liệu lab gốc: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá, đi qua 3 Đêm trên 3 hòn đảo: gom đom đóm, thắp lại các Đèn Lồng Lớn, tránh Bóng Mực và Gió Lạc.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 20)

```bash
npm ci
npm run build
npm run start      # mở http://localhost:4173
```

Phát triển: `npm run dev`.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp đom đóm vào đèn chưa sáng gần nhất (trong 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 | 300 s | |
| 2 | Đảo Cau: hai đảo nối bằng cầu tre | 6 | 330 s | Bục nhảy bay qua biển mây, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông: ba tầng, dốc, tháp chuông | 7 | 360 s | Gió mạnh mỗi 30 s (có lá bay báo trước), Bóng Mực nhanh hơn |

Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì tới màn hình Bình Minh. Thua thì chơi lại Đêm đó.

## Luật và điểm (số chuẩn Ticket-02)

- Mang tối đa 10 đom đóm. Mỗi đèn cần 10, nạp nhiều lần được. Đèn đã sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- Bị Bóng Mực chạm: −1 Ngọn Lửa, rơi một nửa số đom đóm ra xung quanh (nhặt lại được trong 8 s), bất tử 1.5 s.
- Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- Gió Lạc cướp 3 đom đóm khi bạn mang từ 5 trở lên. Tỏa Sáng trúng nó lúc đang chạy trốn thì nó thả lại số đã cướp.
- Bùa Gió: 10 s chạy 7.2 m/s và lướt không hồi chiêu.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm là tổng điểm các Đêm đã thắng.

## Kiểm thử và chế độ headless (Test Contract v1.1)

```bash
npm test                          # 53 test: unit + scenario headless cả 3 Đêm
npm run verify -- --phase 2       # kiểm chứng + bằng chứng vào docs/proof/phase-2
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

- Khai báo: [game.contract.json](game.contract.json) (v1.1, số chuẩn).
- Spec: [PRD-0](docs/requirements/PRD-0.md), [Ticket-02](docs/requirements/TICKET-02.md). Giả định và acceptance criteria: [assumptions.md](docs/notes/assumptions.md).
- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md), [Phase 2](docs/proof/phase-2/README.md).

## Cấu trúc

```text
src/core/level.js   bản đồ chuẩn 3 Đêm + hằng số
src/core/game.js    logic thuần, tất định, 12 bước/tick
src/headless.js     CLI theo Test Contract
src/render/         main.js (màn hình, HUD, vòng lặp), world.js (cảnh 3D), audio.js (WebAudio)
tests/              unit + scenario headless
docs/               requirements, notes, proof
AGENTS.md, CLAUDE.md, .claude/ (hook Stop, skill verify), .github/workflows/ci.yml
```

## Harness AI

- `AGENTS.md`: lệnh, kiến trúc, quy tắc cho agent (`CLAUDE.md` trỏ tới file này). Cập nhật cho phạm vi 3 Đêm ở Phase 2.
- Hook `Stop`: chặn agent kết thúc lượt khi `npm test` đỏ.
- Skill `verify`: kiểm chứng, tất định, hiệu năng, lưu bằng chứng theo phase.
- CI GitHub Actions: build + test + headless smoke trên Ubuntu và macOS.

## Sáng tạo của tôi

- **Đom đóm bay quanh Mây:** số đom đóm đang mang hiện thành các đốm sáng bay vòng quanh nhân vật.
- **Vòng sáng an toàn:** đèn đã sáng có vòng cam trên mặt đất đúng bằng bán kính vùng an toàn 6 m.
- **Bóng Mực bò lên từ sương:** trong trạng thái `spawning`, Bóng Mực nhô dần từ dưới đất lên.
- **Lời Ông Đăng** cho từng Đêm và màn hình Bình Minh.

Tất cả chỉ nằm trong `src/render/`, không đổi output headless. Bằng chứng: `npm test` vẫn xanh ([test-output.txt](docs/proof/phase-2/test-output.txt)).
