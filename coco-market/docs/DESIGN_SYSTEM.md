# 디자인 시스템

토큰 원본: `apps/web/src/styles/tokens.css`, 유틸리티: `apps/web/src/styles/base.css`

## 방향
공공 서비스의 명료함 + 동네 가게의 따뜻함. 거래소·카지노·다단계 세미나처럼 보이는 요소를 배제합니다.

| 쓰는 것 | 쓰지 않는 것 |
|---|---|
| 한지 느낌 바탕(`--paper`), 먹색 남색 본문(`--ink`), 상생 녹색 포인트 1색(`--brand`) | 빨강/초록 가격 등락 색, 네온, 그라디언트 히어로 |
| Pretendard 가변 폰트, 숫자 tabular-nums | 장식용 이모지, 동전·로켓·상승 차트 이미지 |
| 상태를 모양으로 표시(pill, notice, 스탬프) | 카운트다운, "곧 마감", 호가창, 수익 그래프 |
| 금전 화면 상단의 "사는 것 / 살 수 없는 것" 한 줄(`ScopeLine`) | 다른 회원을 "내 하위"로 보여 주는 트리 |

## 토큰
- 색: paper, surface, surface-2, ink, ink-2, ink-3, line, brand, brand-soft + 의미색(ok/warn/bad/info). 라이트·다크 모두 정의.
- 글자: 12 / 13.5 / 15 / 18 / 22 / 28 / 36px
- 간격: 4px 그리드(4~48)
- 모서리: 6 / 10 / 16px

## 컴포넌트 (`src/ui/kit.tsx`)
PageHeader, Pill, ErrorNotice(오류 코드별 다음 행동 링크), Empty, Loading(스켈레톤), Stat, Field, ScopeLine, Gate

## 카피 규칙
- 해요체, 짧은 문장, 숫자에는 기준일
- 금지어는 `packages/core/src/policy/copy.ts`. 부정형 법적 고지("원금이 보장되지 않습니다")만 예외
- CI의 `compliance-lint`가 웹 소스의 문자열을 검사하고, 서버는 권리자·운영자 입력을 같은 규칙으로 거절

## 접근성
WCAG 2.2 AA 기준: 모든 입력에 레이블, 포커스 링, 본문 바로가기, 명도 대비 4.5:1 이상, `prefers-reduced-motion` 존중, 모바일 하단 탭 바
