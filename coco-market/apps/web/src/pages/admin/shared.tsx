import type { IncomeType, OpName, OpOutput, Role } from '@coco/core';
import { useState, type ReactNode } from 'react';
import type { ClientError } from '../../api';
import { Empty, ErrorNotice, Loading } from '../../ui/kit';

/** useOp 결과 모양. 큐 데이터는 AdminPage가 불러와 탭과 배지에 같이 쓴다. */
export interface OpQuery<N extends OpName> {
  data: OpOutput<N> | null;
  error: ClientError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** 로딩·오류·빈 상태를 한곳에서 처리한다. */
export function QueryView<T>({
  q, isEmpty, emptyTitle, emptyDesc, lines, children,
}: {
  q: { data: T | null; error: ClientError | null; reload: () => Promise<void> };
  isEmpty?: (d: T) => boolean;
  emptyTitle: string;
  emptyDesc?: ReactNode;
  lines?: number;
  children: (d: T) => ReactNode;
}) {
  if (q.error && !q.data) {
    return (
      <div className="stack-sm">
        <ErrorNotice error={q.error} />
        <div><button type="button" className="btn btn-sm" onClick={() => void q.reload()}>다시 불러오기</button></div>
      </div>
    );
  }
  if (!q.data) return <Loading lines={lines ?? 3} />;
  if (isEmpty?.(q.data)) return <Empty title={emptyTitle}>{emptyDesc}</Empty>;
  return (
    <>
      {q.error && <ErrorNotice error={q.error} />}
      {children(q.data)}
    </>
  );
}

/** 탭 상단의 결과 알림(작업 성공 시) */
export function Flash({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="notice notice-ok admin-flash" role="status">
      <div>{children}</div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="알림 닫기">닫기</button>
    </div>
  );
}

export function TabIntro({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row-between admin-intro">
      <div className="stack-sm">
        <h2>{title}</h2>
        {children && <p className="muted">{children}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function ReloadButton({ q }: { q: { loading: boolean; reload: () => Promise<void> } }) {
  return (
    <button type="button" className="btn btn-sm" onClick={() => void q.reload()} disabled={q.loading}>
      {q.loading ? '불러오는 중…' : '새로고침'}
    </button>
  );
}

export const shortId = (id: string | null | undefined, n = 8) => (id ? (id.length > n ? id.slice(0, n) : id) : '—');

/** "ip:3f2a…" 처럼 대상 문자열의 긴 식별자를 줄인다. */
export function shortTarget(target: string): string {
  return target
    .split(':')
    .map((part) => (part.length > 16 ? `${part.slice(0, 8)}…` : part))
    .join(':');
}

export const INCOME_LABEL: Record<IncomeType, string> = {
  BUSINESS: '사업소득 3.3%',
  OTHER: '기타소득 8.8%',
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: '일반 회원',
  REVIEWER: '심사',
  COMPLIANCE_OFFICER: '컴플라이언스',
  FINANCE: '재무',
  SUPER_ADMIN: '최고 관리자',
};

/**
 * 되돌리기 어려운 작업용 2단계 버튼. 브라우저 confirm()은 Artifact 뷰어 등에서 막히므로 화면 안에서 확인받는다.
 */
export function ConfirmButton({ label, question, confirmLabel = '확인', className = 'btn btn-danger btn-sm', disabled, skip, onConfirm }: {
  label: ReactNode; question: string; confirmLabel?: string; className?: string; disabled?: boolean; skip?: boolean; onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => (skip ? onConfirm() : setAsking(true))}>
        {label}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 6 }} role="group" aria-label={question}>
      <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{question}</span>
      <button type="button" className="btn btn-danger btn-sm" onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>취소</button>
    </span>
  );
}
