import type { IPType, IPStatus, QuestKind, Tier } from '@coco/core';
import { KIND_LABEL, TIER_LABEL } from '@coco/core';

export const krw = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('ko-KR')}원`);
export const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '—');
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const pct = (bps: number) => `${(bps / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;

export const IP_TYPE_LABEL: Record<IPType, string> = {
  PATENT: '특허', COPYRIGHT: '저작권', TRADEMARK: '상표', DESIGN: '디자인', CHARACTER: '캐릭터', OTHER: '기타',
};
export const IP_STATUS: Record<IPStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | '' }> = {
  DRAFT: { label: '작성 중', tone: '' },
  PENDING_REVIEW: { label: '심사 중', tone: 'info' },
  ACTIVE: { label: '판매 중', tone: 'ok' },
  SUSPENDED: { label: '판매 정지', tone: 'bad' },
  REJECTED: { label: '반려', tone: 'warn' },
};
export const tierName = (t: Tier) => TIER_LABEL[t].ko;
export const kindName = (k: QuestKind) => KIND_LABEL[k];
export const EVIDENCE_LABEL: Record<string, string> = {
  REGISTRATION_CERT: '등록증', REGISTRY_EXTRACT: '등록원부', ASSIGNMENT_CONTRACT: '양도·이용 계약서', CO_OWNER_CONSENT: '공동권리자 동의서', OTHER: '기타 증빙',
};
