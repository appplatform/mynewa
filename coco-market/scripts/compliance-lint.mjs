#!/usr/bin/env node
// 사용자에게 보이는 문자열에서 투자·수익 암시 표현을 찾는다(메타 프롬프트 §7.4).
// 대상: apps/web/src 의 문자열 리터럴과 JSX 텍스트. 금지어 목록은 core와 같은 규칙을 쓴다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const { BANNED_TERMS, findBannedTerms } = await import(join(root, 'packages/core/src/policy/copy.ts')).catch(async () => {
  // Node가 .ts를 직접 못 읽는 환경: tsx로 다시 실행
  const { execFileSync } = await import('node:child_process');
  execFileSync('npx', ['tsx', join(root, 'scripts/compliance-lint.mjs')], { stdio: 'inherit', env: { ...process.env, COCO_LINT_TSX: '1' } });
  process.exit(0);
});

const TARGETS = ['apps/web/src'];
// 금지 기능을 "설명"하는 데이터(법적 검토 표)는 예외로 둔다.
const ALLOW_FILES = new Set(['packages/core/src/policy/gates.ts']);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|md|json|html)$/.test(n) ? [p] : [];
  });
}

/** 주석을 지우고 문자열 리터럴·JSX 텍스트만 뽑는다. */
function userFacingText(src) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out = [];
  for (const m of noComments.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of noComments.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  return out.filter((s) => /[가-힣a-zA-Z]/.test(s));
}

let problems = 0;
for (const t of TARGETS) {
  for (const file of walk(join(root, t))) {
    const rel = relative(root, file);
    if (ALLOW_FILES.has(rel)) continue;
    for (const text of userFacingText(readFileSync(file, 'utf8'))) {
      for (const v of findBannedTerms(text)) {
        problems++;
        console.error(`${rel}: 금지 표현 "${v.term}" → …${v.excerpt}…`);
      }
    }
  }
}
if (problems) {
  console.error(`\ncompliance-lint: ${problems}건. 금지어 ${BANNED_TERMS.length}개 규칙은 packages/core/src/policy/copy.ts 참고.`);
  process.exit(1);
}
console.log('compliance-lint: 통과');
