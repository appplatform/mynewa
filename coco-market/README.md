# CO-CO Market

IP 이용권(라이선스) 마켓 + 기여 퀘스트 + 골목상권 가맹점을 하나로 묶은 플랫폼의 Phase 1 MVP입니다.
설계 기준은 [`docs/coco-market/META_PROMPT.md`](../docs/coco-market/META_PROMPT.md)이며, 첨부 기획서와 다른 결정은 [`docs/COMPLIANCE_CONFLICTS.md`](docs/COMPLIANCE_CONFLICTS.md)에 정리했습니다.

> 이 코드는 법률 자문을 대체하지 않습니다. AMBER 기능은 법무법인 의견서가 등록돼야만 켜지고, RED 기능은 코드에 없습니다.

## 구성

```
packages/core   도메인 로직(작업 50개, 원장, 등급, 원천징수, Legal Gate, 감사 로그, Merkle). 서버와 브라우저가 같이 쓴다
apps/api        Fastify RPC 서버 + PostgreSQL(Drizzle). SERIALIZABLE 트랜잭션, HttpOnly 쿠키 세션
apps/web        React 19 + Vite. 서버 모드 / 데모 모드(core를 브라우저에서 실행, localStorage 저장)
scripts         compliance-lint(투자 암시 문구 차단), guard-red(RED 기능·금지 스키마 차단)
docs            PRD, 아키텍처, ADR, 법무 질의서, 위협 모델, 디자인 시스템
```

## 실행

요구 사항: Node 22+, pnpm 10, PostgreSQL 16

```bash
pnpm install

# 1) 데모 모드: 서버 없이 브라우저만으로 전체 흐름 확인
pnpm --filter @coco/web dev            # http://localhost:5173

# 2) 서버 모드
createdb coco_dev                         # 또는 DATABASE_URL 지정
pnpm --filter @coco/api seed              # 마이그레이션 + 데모 데이터
pnpm --filter @coco/api dev               # http://localhost:4000
pnpm --filter @coco/web dev:server        # /api 를 4000으로 프록시
```

데모 계정 비밀번호는 모두 `coco-demo-2026`입니다.

| 계정 | 역할 |
|---|---|
| admin@coco.demo | 운영 관리자(심사·컴플라이언스·전체 관리) |
| finance1@coco.demo, finance2@coco.demo | 재무(출금 2인 승인) |
| creator@coco.demo | 권리자(캐릭터·특허 IP) |
| illust@coco.demo | 공동권리자(캐릭터 지분 20%) |
| mapmaker@coco.demo | 다른 권리자(지도 일러스트 IP) |
| scout@coco.demo | 기여자(퀘스트 수행·가맹점 온보딩) |
| shop@coco.demo | 가맹점 대표 |
| buyer@coco.demo | 이용권 구매자(카페 대표) |

## 검사

```bash
pnpm check     # typecheck + compliance-lint + guard-red + 전체 테스트
```

API 테스트는 `TEST_DATABASE_URL`(기본 `postgresql://coco:coco@localhost:5432/coco_test`)의 public 스키마를 **지우고** 다시 만듭니다. 운영 DB를 가리키지 않게 주의하세요.

## Mock으로 구현된 것 (실계약 전)

| 영역 | 현재 | 실서비스 전환 |
|---|---|---|
| 결제(PG) | `mockPayments` (금액 끝자리 7원이면 거절) | 토스페이먼츠/포트원 등 어댑터 + 승인 웹훅 서명 검증 |
| 본인확인 | `mockIdentity` (전화번호 000으로 시작하면 실패) | PASS 등 본인확인기관 대행 |
| 체인 기록 | `mockAnchor` (가짜 tx 참조) | EVM L2 앵커 컨트랙트(멀티시그, 감사 후) |
| 은행 지급 | 원장에 `clearing:bank`로만 기록 | 펌뱅킹/지급대행 연동 |

`NODE_ENV=production`에서는 `ALLOW_MOCK_ADAPTERS=true` 없이 서버가 시작되지 않습니다.
