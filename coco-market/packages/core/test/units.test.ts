import { describe, expect, it } from 'vitest';
import {
  computeTier, findBannedTerms, isValidBusinessNumber, merkleProof, merkleRoot, splitByBps, verifyMerkleProof, withholding,
} from '../src';

describe('원천징수', () => {
  it('사업소득 3.3%, 기타소득 8.8%, 원 미만 절사', () => {
    expect(withholding(30_000, 'BUSINESS')).toBe(990);
    expect(withholding(3_000, 'OTHER')).toBe(264);
    expect(withholding(1_001, 'BUSINESS')).toBe(33);
  });
});

describe('지분 분배', () => {
  it('합계가 원금과 같고, 나머지는 첫 몫에 붙는다', () => {
    for (const amount of [1, 7, 99_999, 1_234_567]) {
      const parts = splitByBps(amount, [{ key: 'a', bps: 3_333 }, { key: 'b', bps: 3_333 }, { key: 'c', bps: 3_334 }]);
      expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(amount);
    }
  });
  it('지분 합계가 100%가 아니면 거절', () => {
    expect(() => splitByBps(100, [{ key: 'a', bps: 5_000 }])).toThrow();
  });
});

describe('카피 규칙', () => {
  it('금지어를 찾는다', () => {
    expect(findBannedTerms('연 20% 수익률 보장').map((v) => v.term)).toEqual(expect.arrayContaining(['수익률', '보장']));
  });
  it('법적 고지의 부정문은 허용한다', () => {
    expect(findBannedTerms('이 이용권은 원금이 보장되지 않으며 배당이 없습니다.')).toEqual([]);
  });
  it('영어 단어 경계를 지킨다', () => {
    expect(findBannedTerms('broiler')).toEqual([]);
    expect(findBannedTerms('High ROI!')).toHaveLength(1);
  });
});

describe('사업자등록번호', () => {
  it('검증번호를 확인한다', () => {
    expect(isValidBusinessNumber('999-81-00015')).toBe(true);
    expect(isValidBusinessNumber('999-81-00016')).toBe(false);
    expect(isValidBusinessNumber('12345')).toBe(false);
  });
});

describe('기여 등급', () => {
  const v = (kind: 'MERCHANT_ONBOARDING' | 'AD_VERIFICATION', n: number) => Array.from({ length: n }, () => ({ status: 'VERIFIED' as const, kind }));
  it('조건을 순서대로 만족해야 오른다', () => {
    expect(computeTier([]).tier).toBe('CONSUMER');
    expect(computeTier(v('AD_VERIFICATION', 3)).tier).toBe('TS');
    // 검증 10건이어도 온보딩 3건이 없으면 CS가 아니다
    expect(computeTier(v('AD_VERIFICATION', 10)).tier).toBe('TS');
    expect(computeTier([...v('AD_VERIFICATION', 7), ...v('MERCHANT_ONBOARDING', 3)]).tier).toBe('CS');
  });
  it('반려·대기 기여는 세지 않는다', () => {
    expect(computeTier([{ status: 'REJECTED', kind: 'REVIEW' }, { status: 'SUBMITTED', kind: 'REVIEW' }, ...v('AD_VERIFICATION', 2)]).tier).toBe('CONSUMER');
  });
});

describe('Merkle', () => {
  it('모든 리프의 증명이 검증되고, 다른 리프는 실패한다', () => {
    for (const n of [1, 2, 3, 5, 8, 13]) {
      const leaves = Array.from({ length: n }, (_, i) => `leaf-${i}`);
      const root = merkleRoot(leaves);
      leaves.forEach((leaf, i) => expect(verifyMerkleProof(leaf, merkleProof(leaves, i), root)).toBe(true));
      expect(verifyMerkleProof('forged', merkleProof(leaves, 0), root)).toBe(false);
    }
  });
});
