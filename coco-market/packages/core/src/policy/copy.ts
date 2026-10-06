// 카피 규칙(메타 프롬프트 §7.4). 사용자 노출 문자열과 권리자가 입력하는 상품 설명에 같이 적용한다.

export const BANNED_TERMS: string[] = [
  '수익률', '원금', '보장', '확정 수익', '확정수익', '배당', '시세차익', '시세 차익', '투자하세요', '연금',
  '무조건', '떡상', '100% 안전', '손실 없음', '가치 보증', '고수익',
  'guaranteed', 'dividend', 'roi', 'passive income', 'to the moon',
];

/**
 * 법적 고지문에서 부정문으로 쓰는 경우만 허용한다. 예: "원금이 보장되지 않습니다".
 * 금지어 뒤 20자 안에 부정 표현이 있으면 통과.
 */
const NEGATION = /(않|아닙|없습|없음|불가|금지|아니)/;

export interface CopyViolation {
  term: string;
  index: number;
  excerpt: string;
}

export function findBannedTerms(text: string): CopyViolation[] {
  const lower = text.toLowerCase();
  const out: CopyViolation[] = [];
  for (const term of BANNED_TERMS) {
    const needle = term.toLowerCase();
    const ascii = /^[a-z0-9 ]+$/.test(needle);
    let from = 0;
    for (;;) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      from = i + needle.length;
      if (ascii) {
        const before = lower[i - 1] ?? ' ';
        const after = lower[i + needle.length] ?? ' ';
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      }
      const tail = text.slice(i, i + needle.length + 20);
      if (NEGATION.test(tail)) continue;
      out.push({ term, index: i, excerpt: text.slice(Math.max(0, i - 15), i + needle.length + 15) });
    }
  }
  return out;
}
