import type { IncomeType } from '../types';

// 원천징수율(소득세 + 지방소득세). 사업소득 3.3%, 기타소득 8.8%(필요경비 60% 의제 후 22%).
// 최종 소득 구분과 소액부징수 등 예외는 세무 자문으로 확정한다(LEGAL_QUESTIONS Q2).
export const WITHHOLDING_BPS: Record<IncomeType, number> = {
  BUSINESS: 330,
  OTHER: 880,
};

/** 원천징수액. 원 단위 미만은 절사한다. */
export function withholding(grossKrw: number, type: IncomeType): number {
  if (!Number.isInteger(grossKrw) || grossKrw < 0) throw new Error('grossKrw must be a non-negative integer');
  return Math.floor((grossKrw * WITHHOLDING_BPS[type]) / 10_000);
}
