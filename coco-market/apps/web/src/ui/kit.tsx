import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { ClientError } from '../api';

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="row-between" style={{ alignItems: 'flex-end' }}>
      <div className="stack-sm" style={{ maxWidth: 720 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Pill({ tone = '', children }: { tone?: 'ok' | 'warn' | 'bad' | 'info' | 'brand' | ''; children: ReactNode }) {
  return <span className={`pill${tone ? ` pill-${tone}` : ''}`}>{children}</span>;
}

export function ErrorNotice({ error }: { error: ClientError | null | undefined }) {
  if (!error) return null;
  const action =
    error.code === 'UNAUTHENTICATED' ? <Link to="/login">로그인하기</Link>
    : error.code === 'IDENTITY_REQUIRED' ? <Link to="/verify">본인확인하기</Link>
    : null;
  return (
    <div className="notice notice-bad" role="alert">
      <b>{error.message}</b>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b style={{ color: 'var(--ink)' }}>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton" style={{ width: `${90 - i * 15}%` }} />)}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** 금전이 오가는 화면 상단의 "무엇을 사는지 / 무엇을 살 수 없는지" 한 줄 고지 */
export function ScopeLine({ buys, notBuys }: { buys: ReactNode; notBuys: ReactNode }) {
  return (
    <div className="scope-line" role="note">
      <span><b>사는 것</b> · {buys}</span>
      <span><b>살 수 없는 것</b> · {notBuys}</span>
    </div>
  );
}

/** 로그인·역할이 필요한 화면 */
export function Gate({ ok, need, children }: { ok: boolean; need: 'login' | 'role'; children: ReactNode }) {
  if (ok) return <>{children}</>;
  return need === 'login' ? (
    <Empty title="로그인이 필요합니다" action={<Link className="btn btn-primary" to="/login">로그인</Link>}>
      이 화면은 로그인한 회원만 볼 수 있어요.
    </Empty>
  ) : (
    <Empty title="권한이 없습니다">운영 담당자 계정으로 로그인해 주세요.</Empty>
  );
}
