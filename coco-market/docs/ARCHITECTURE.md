# 아키텍처

## 한 장 요약

```
 브라우저(React)                        서버(Fastify)                     PostgreSQL
 ┌──────────────┐   POST /api/rpc/:op  ┌───────────────┐   SERIALIZABLE   ┌──────────────┐
 │ HttpClient   │ ───────────────────▶ │ execute(op)   │ ───────────────▶ │ PgStore      │
 │ (쿠키 세션)   │                      │  ├ zod 검증    │                  │ 18 tables    │
 └──────────────┘                      │  ├ 세션·역할   │                  │ 원장·감사 로그 │
 ┌──────────────┐                      │  └ 서비스 로직 │                  │ = append-only │
 │ LocalClient  │ ── 같은 execute() ──▶ │ (packages/core)│                  └──────────────┘
 │ MemoryStore  │   (데모 모드)         └───────────────┘
 └──────────────┘                              │ 포트
                                               ▼
                         PaymentGateway · IdentityProvider · AnchorClient (현재 Mock)
```

- **core가 유일한 업무 규칙 출처**입니다. 작업(operation)마다 입력 스키마(zod), 인증 수준(public/user/verified), 역할, 실행 함수를 정의합니다.
- 서버는 `POST /api/rpc/:op` 하나로 모든 작업을 노출합니다. 브라우저 데모는 같은 `execute()`를 MemoryStore 위에서 돌립니다. 그래서 데모에서 본 동작과 서버 동작이 같습니다.
- 저장소는 `Collection<T>`(get/find/insert/update/delete, 동등 필터만) 포트로 추상화했습니다. 메모리 구현과 Postgres 구현이 같은 유니크 제약 목록(`UNIQUE_KEYS`)을 따릅니다.

## 데이터 무결성

| 위험 | 대응 |
|---|---|
| 독점 이용권 중복 판매, 출금 이중 승인 | 모든 작업을 SERIALIZABLE 트랜잭션으로 실행하고, 직렬화 충돌 시 재시도 (`apps/api/test/pg.test.ts`에서 동시성 검증) |
| 원장 조작 | `journal_entries`·`journal_lines`·`audit_logs`에 UPDATE/DELETE 거부 트리거. 잔액 컬럼 없음 |
| 분개 오류 | `post()`가 차변=대변, 라인별 한쪽만 금액, 정수만 허용. `idempotency_key` 유니크 |
| 감사 로그 변조 | 해시 체인(seq, prevHash, hash). `audit.list`가 체인을 검증해 끊긴 위치를 알려 줌 |
| RED 기능 유입 | `feature_flags.id` CHECK 제약(AMBER 키만), `guard-red` 정적 검사, core에 RED 키 없음 |

## 인증·세션

- 이메일+비밀번호(scrypt N=2^15). 세션 토큰은 서버에서 HttpOnly·SameSite=Lax 쿠키로만 전달하고 응답 본문에서 지웁니다.
- CSRF: 모든 RPC에 `x-coco-csrf: 1` 헤더 필수(교차 출처 단순 요청으로 보낼 수 없음) + Origin 허용 목록.
- 본인확인: Mock PASS. CI 원문 대신 `sha256('ci|' + CI)`만 저장(`users.ci_hash` 유니크 → 1인 1계정).
- 연령: 만 14세 미만 본인확인 불가, 이용권 구매·IP 등록·가맹점 입점은 만 19세 이상.

## 알려진 한계 (Phase 2 전에 해결)

1. **결제 호출이 DB 트랜잭션 안에 있습니다.** 직렬화 충돌로 재시도하면 PG 승인이 두 번 호출될 수 있습니다. 실제 PG 연동 시 `주문 생성(트랜잭션 1) → 클라이언트 결제창 → 승인 확정 API(멱등키=주문ID) → 이용권 발급(트랜잭션 2)`의 2단계로 나눠야 합니다.
2. `find()`가 동등 필터만 지원하고 일부 집계(투명성 통계, 감사 로그 seq)를 앱 메모리에서 계산합니다. 데이터가 늘면 전용 SQL 쿼리·인덱스·materialized view로 옮깁니다.
3. 레이트 리밋이 프로세스 메모리 기반입니다. 다중 인스턴스에서는 Redis로 옮깁니다.
4. 증빙 파일 업로드(오브젝트 스토리지)는 아직 없습니다. 현재는 문서 참조 문자열과 선택적 SHA-256만 저장합니다.
5. 소셜 로그인·패스키, 관리자 SSO·하드웨어 키는 미구현입니다.
6. 이용권 만료는 조회 시점에 계산합니다(`license.mine`). 만료 배치와 알림은 Phase 2 큐 작업입니다.

## 기술 선택

착수 시점(2026-10) npm의 최신 메이저 일부(TypeScript 7, Vite 8, React Router 8, Zod 4 등)는 검증 범위 밖이라 직전 안정 메이저로 고정했습니다. 자세한 내용은 [ADR 0002](adr/0002-stack-versions.md).
