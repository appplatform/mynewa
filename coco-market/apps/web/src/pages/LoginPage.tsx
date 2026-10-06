import { DEMO_PASSWORD, DEMO_USERS } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ClientError } from '../api';
import { useSession } from '../state/session';
import { ErrorNotice, Field, PageHeader } from '../ui/kit';
import './pages.css';

const DEMO_ROLE: Record<string, string> = {
  admin: '운영 관리자 · IP 심사, 기여 검증, 준법 업무를 맡아요',
  finance1: '재무 담당 1 · 출금 신청을 승인해요',
  finance2: '재무 담당 2 · 두 번째 출금 승인을 해요',
  creator: '권리자 · 캐릭터와 특허 IP를 등록했어요',
  illustrator: '공동권리자 · 캐릭터 IP에 지분이 있어요',
  mapmaker: '권리자 · 일러스트 지도 IP를 등록했어요',
  scout: '기여자 · 가게 입점을 돕고 퀘스트를 수행해요',
  shop: '가맹점 대표 · 골목 칼국수를 입점시켰어요',
  buyer: '이용자 · 카페에서 IP 이용권을 샀어요',
};

function DemoAccounts({ onPick, busy }: { onPick: (email: string) => void; busy: boolean }) {
  return (
    <section className="card stack" aria-labelledby="demo-title">
      <h2 id="demo-title" style={{ fontSize: 'var(--fs-lg)' }}>데모 계정으로 둘러보기</h2>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>모든 데모 계정은 본인확인을 마친 상태예요. 버튼을 누르면 바로 로그인돼요.</p>
      <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {DEMO_USERS.map((u) => (
          <li key={u.key} className="row-between panel" style={{ padding: 'var(--s3)' }}>
            <span className="stack-sm" style={{ gap: 0 }}>
              <b>{u.name}</b>
              <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{DEMO_ROLE[u.key] ?? u.email}</span>
            </span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onPick(u.email)}>이 계정으로 로그인</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  async function doLogin(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      await login(e, p);
      navigate(next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError('UNKNOWN', '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void doLogin(email.trim(), password);
  }

  return (
    <div className="page">
      <PageHeader title="로그인" desc="이메일과 비밀번호로 로그인해요." />
      <div className={api.mode === 'demo' ? 'grid-2' : ''} style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
          <Field label="이메일">
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="비밀번호">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? '로그인하는 중…' : '로그인'}</button>
          <ErrorNotice error={error} />
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>아직 회원이 아니신가요? <Link to="/signup">가입하기</Link></p>
        </form>
        {api.mode === 'demo' && <DemoAccounts busy={busy} onPick={(em) => void doLogin(em, DEMO_PASSWORD)} />}
      </div>
    </div>
  );
}
