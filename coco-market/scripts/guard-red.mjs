#!/usr/bin/env node
// RED 등급 기능과 금지 스키마가 코드에 들어오지 못하게 막는 정적 검사(메타 프롬프트 §3, Phase 1 완료 기준).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SCAN = ['packages/core/src', 'apps/api/src', 'apps/api/migrations', 'apps/web/src'];

const RULES = [
  { re: /\b(upline|sponsor|parent_?user|downline|recruiter)(Id|_id)?\b/i, why: '사용자 간 상하 관계 필드(다단계 구조)' },
  { re: /\bwallet_?balance\b/i, why: '잔액 컬럼(잔액은 원장에서만 계산)' },
  { re: /\bturnover_?count\b/i, why: 'LU 회전수(2차 거래 마켓, RED #9)' },
  { re: /\b(tri_?split|bonus_?units?)\b/i, why: '1+2 증정 구조(RED #10)' },
  { re: /\b(royalty_?pool|dividend|ipu_?share|crystalliz)/i, why: '수익 분배·IPU 결정화(RED #11)' },
  { re: /\b(bounty_?delegation|delegate_?quest)\b/i, why: '미션 대행(RED #14)' },
  { re: /\b(overriding|rollup_?bonus|set_?purchase_?promotion)\b/i, why: '오버라이딩·구매 승급(RED #15)' },
  { re: /\b(resident_?registration|rrn|jumin)\b/i, why: '주민등록번호 수집' },
];
// 규칙 자체를 설명하는 파일은 제외
const SKIP = new Set(['packages/core/src/policy/gates.ts', 'packages/core/src/policy/copy.ts']);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|sql|mjs)$/.test(n) ? [p] : [];
  });
}

let hits = 0;
for (const d of SCAN) {
  for (const f of walk(join(root, d))) {
    const rel = relative(root, f);
    if (SKIP.has(rel)) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/--.*$/, '');
      for (const r of RULES) {
        if (r.re.test(code)) {
          hits++;
          console.error(`${rel}:${i + 1}: ${r.why} → ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }
}
if (hits) {
  console.error(`\nguard-red: ${hits}건. RED 기능은 정식 인가 경로(META_PROMPT §2.3) 확정 전까지 구현하지 않습니다.`);
  process.exit(1);
}
console.log('guard-red: 통과');
