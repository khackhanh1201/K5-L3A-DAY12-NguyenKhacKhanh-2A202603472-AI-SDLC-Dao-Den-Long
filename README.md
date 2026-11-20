# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_
> Day 12 · AI SDLC Lab · Nguyễn Khắc Khánh · 2A202603472. Tài liệu lab gốc: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Mây, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại 5 Đèn Lồng Lớn của Đảo Bến và tránh Bóng Mực trong sương đen.

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
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| F | Tỏa sáng: tốn 2 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| R | Chơi lại sau khi thắng/thua |

## Luật và cách tính điểm

- Nhặt đom đóm bằng cách chạm vào (mang tối đa 10). Mỗi đèn cần 5 đom đóm để thắp.
- Bóng Mực đuổi theo Mây. Bị chạm thì mất 1 lửa (máu), rơi một nửa số đom đóm đang mang, sau đó bất tử 1.5 s.
- Bóng Mực không vào được vòng 5 m quanh đèn **đã thắp**.
- Thắp đủ 5 đèn thì **thắng**. Hết 3 lửa hoặc hết 300 s (bình minh) thì **thua**.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi lửa còn lại | +50 |

## Kiểm thử và chế độ headless (Test Contract v1.0)

```bash
npm test                                   # 26 test: unit + scenario headless end-to-end
npm run verify                             # chạy kiểm chứng + lưu bằng chứng vào docs/proof/phase-1
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

- Khai báo: [game.contract.json](game.contract.json). `fall_enabled: false` vì đảo có rìa chặn, Mây không rơi được, nên không bao giờ có `player_hit` với `by: "fall"`.
- Giả định cho chỗ PRD-0 còn mơ hồ: [docs/notes/assumptions.md](docs/notes/assumptions.md).
- Bằng chứng: [docs/proof/phase-1/](docs/proof/phase-1/README.md).

## Cấu trúc

```text
src/core/        logic thuần, tất định (không dùng DOM/Three.js)
src/headless.js  CLI theo Test Contract
src/render/      Three.js + HUD
tests/           unit + scenario headless
docs/            requirements, notes (giả định, nhật ký AI), proof
AGENTS.md, CLAUDE.md, .claude/ (hook Stop, skill verify), .github/workflows/ci.yml
```

## Harness AI

- `AGENTS.md`: lệnh, kiến trúc, quy tắc cho agent (`CLAUDE.md` trỏ tới file này).
- Hook `Stop` (`.claude/settings.json` → `.claude/hooks/stop-tests.mjs`): chặn agent kết thúc lượt khi `npm test` đỏ.
- Skill `verify` (`.claude/skills/verify/`): chạy kiểm chứng và lưu bằng chứng theo phase.
- CI GitHub Actions: build + test + headless smoke trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi

- **Đom đóm bay quanh Mây:** số đom đóm đang mang hiện thành các đốm sáng bay vòng quanh nhân vật.
- **Vòng sáng an toàn:** đèn đã thắp có vòng cam trên mặt đất đúng bằng `safe_radius`, để người chơi thấy chỗ trú.

Cả hai chỉ nằm trong `src/render/` và không đổi output headless. Bằng chứng: toàn bộ `npm test` vẫn xanh ([test-output.txt](docs/proof/phase-1/test-output.txt)).
