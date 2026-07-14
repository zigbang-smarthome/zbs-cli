# zbs-cli

CLI for [zbs.zigbang.in](https://zbs.zigbang.in/) — 직방 본사 B2B 포털. IDP(도어록)·HMS(홈네트워크)
VOC 콜센터 상담·조치결과·양품화 데이터, SUPPORT 게시판, 공통코드를 터미널/cron/Claude에서 한 줄로 받아옵니다.

API 분석 원본: `smarthome-iot/docs/operations/zbs-portal.md`

## 설치

```bash
brew install zigbang-smarthome/tap/zbs-cli
# 또는
npm i -g @zigbang-smarthome/zbs-cli
# 또는
curl -fsSL https://github.com/zigbang-smarthome/zbs-cli/releases/latest/download/install.sh | sh
```

## 사용

```bash
zbs login                                     # 비밀번호 → macOS Keychain 저장
zbs whoami

# VOC
zbs voc consult --pillar idp --since 7d       # 콜센터 상담 (raw)
zbs voc repair  --pillar hms --from 2026-01-01 --to 2026-04-27
zbs voc refurb  --since 30d --status P50

# 게시판 (검색은 제목만 동작)
zbs board list   0000000                      # 공지사항
zbs board list   0000002 --keyword 펌웨어     # 도어록-자료실 제목 검색
zbs board get    0000002 91
zbs board attach 0000002 91 --out ~/Downloads
zbs board attach 0000002 91 --all             # 전체 zip

# Dashboard — 로그인 직후 신착 공지/자료/popup 한 방
zbs dashboard
zbs dashboard --section notice                # notice|data|qna|popup

# 보조
zbs codes --upper PRDUCT_GROUP_CODE,CMPNS_GRTS_CODE,RCEPT_SE_CODE
zbs menu --tree

# Escape hatch — 매핑 안 된 엔드포인트
zbs call /biz/main/getInitData.json
zbs call /biz/managt/.../something.json --data '{"searchDtFrom":"2026-04-01"}'
```

### Pillar

`--pillar` 는 endpoint 별로 다른 파라미터 키에 매핑됩니다:

| Pillar | 코드 | tchnlgyCnsltManage | managtResultDownload |
|---|---|---|---|
| idp (도어록) | DDL | `searchPrdtgrpCode=DDL` | `searchPrductGroupCode=DDL` |
| hms (월패드) | HN  | `searchPrdtgrpCode=HN`  | `searchPrductGroupCode=HN`  |

### 출력 포맷

| 옵션 | 동작 |
|---|---|
| (default, TTY) | 박스 표 |
| (default, pipe) / `--plain` | TSV |
| `--json` | envelope 벗긴 `resultList` (전체 컬럼) |
| `--csv` | UTF-8 BOM (Excel 한글 호환) |
| `--full` | 컬럼 cap 해제 — 모든 필드 표시 |

### 인증

- **로그인:** username/password 모두 인터랙티브 프롬프트 (또는 `--id <ID>` / `$ZBS_LOGIN_ID` / `$ZBS_PASSWORD` env). 첫 로그인 후 cached.
- **세션:** `~/.config/zbs/session.json` (mode 0600). JSESSIONID + ss\* 컨텍스트 + 캐시된 loginId.
- **비밀번호:** `$ZBS_PASSWORD` env > macOS Keychain (service `zbs-cli`, account `<loginId>`).
  파일 저장 안 함. **Windows / Linux 에서는 Keychain 미지원 — `$ZBS_PASSWORD` env 를 사용하세요.**
- **자동 재로그인:** 응답이 `noAuth` 거나 `/noAuth.json` 으로 리다이렉트되면, 캐시된 loginId + Keychain/env 비번으로 1회 재로그인 후 재시도.
- **로그아웃:** `zbs logout` — 세션 파일 + Keychain 항목 삭제.

### 자동화 예시

```bash
# 매시 5분 — IDP VOC 증분을 jsonl 로
5 * * * * /usr/local/bin/zbs voc consult --pillar idp --since 2h --json \
            >> /var/log/zbs/idp-consult.jsonl
```

```bash
# 1년치 백필 (페이지네이션 없음 — 도메인 가드 365일이라 연 단위 분할)
for y in 2024 2025 2026; do
  zbs voc repair --pillar idp --from $y-01-01 --to $y-12-31 --json \
    > repair-idp-$y.jsonl
done
```

## 알려진 제약 (research §7.4)

- 페이지네이션 없음. 큰 결과셋(>10k row)은 미검증.
- `tchnlgyCnsltManage` 는 클라이언트 가드 365일. 다른 endpoint 는 미확인.
- 세션 TTL 미공개 (Servlet 기본 30분 idle 추정).
- 비밀번호 무통보 회전 가능 — `LOGIN_FAILED` 시 Slack 운영 채널 확인.
- 동시 로그인 정책 미검증 (공유 계정 사용 시).

## 개발

```bash
bun install
bun run dev                                  # 로컬 실행
bun run build                                # dist/zbs 컴파일
```

릴리즈: `gh workflow run release.yml` — oneup 으로 자동 버전 증가, 4 플랫폼 빌드, npm + Homebrew + GitHub Releases 동시 배포.
