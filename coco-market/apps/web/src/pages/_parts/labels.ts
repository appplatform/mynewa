import type { ContributionStatus, GrantStatus, IncomeType, PayoutStatus, Role } from '@coco/core';
import { WITHHOLDING_BPS } from '@coco/core';
import { pct } from '../../ui/format';

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'brand' | '';
export interface StatusLabel { label: string; tone: Tone }

export const GRANT_STATUS: Record<GrantStatus, StatusLabel> = {
  ACTIVE: { label: '이용 중', tone: 'ok' },
  EXPIRED: { label: '기간 만료', tone: '' },
  REVOKED: { label: '해지됨', tone: 'bad' },
};

export const CONTRIB_STATUS: Record<ContributionStatus, StatusLabel> = {
  SUBMITTED: { label: '검증 대기', tone: 'info' },
  VERIFIED: { label: '검증 완료', tone: 'ok' },
  REJECTED: { label: '반려', tone: 'bad' },
};

export const PAYOUT_STATUS: Record<PayoutStatus, StatusLabel> = {
  REQUESTED: { label: '승인 대기', tone: 'info' },
  PAID: { label: '지급 완료', tone: 'ok' },
  REJECTED: { label: '반려', tone: 'bad' },
};

export const INCOME_NAME: Record<IncomeType, string> = { BUSINESS: '사업소득', OTHER: '기타소득' };

/** 예: "사업소득 3.3% 원천징수" */
export const incomeNote = (t: IncomeType) => `${INCOME_NAME[t]} ${pct(WITHHOLDING_BPS[t])} 원천징수`;

export const ROLE_LABEL: Record<Role, string> = {
  USER: '회원',
  REVIEWER: '심사 담당',
  COMPLIANCE_OFFICER: '준법 담당',
  FINANCE: '재무 담당',
  SUPER_ADMIN: '운영 관리자',
};

/** 만료일이 지났으면 ACTIVE라도 만료로 보여 준다. */
export function effectiveGrantStatus(status: GrantStatus, endsAt: string): GrantStatus {
  return status === 'ACTIVE' && endsAt <= new Date().toISOString() ? 'EXPIRED' : status;
}
