import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ClientError } from '../api';
import { useSession } from '../state/session';
import { ErrorNotice, Field, PageHeader } from '../ui/kit';
import './pages.css';

export default function SignupPage() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const mismatch = f.confirm.length > 0 && f.password !== f.confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mismatch || !agree) return;
    setBusy(true);
    setError(null);
    try {
      await api.call('auth.register', { name: f.name.trim(), email: f.email.trim(), password: f.password });
      await refresh();
      navigate('/verify');
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError('UNKNOWN', '가입하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="가입하기" desc="가입 후 휴대폰 본인확인을 마치면 이용권 구매, 퀘스트 제출, IP 등록을 할 수 있어요." />
      <form className="card stack" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <Field label="이름">
          <input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={50} required />
        </Field>
        <Field label="이메일">
          <input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </Field>
        <Field label="비밀번호" hint="10자 이상">
          <input className="input" type="password" autoComplete="new-password" minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        </Field>
        <Field label="비밀번호 확인" hint={mismatch ? '비밀번호가 서로 달라요.' : undefined}>
          <input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} aria-invalid={mismatch} required />
        </Field>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span><Link to="/legal/terms">이용약관</Link>과 <Link to="/legal/privacy">개인정보 처리방침</Link>에 동의합니다 (필수)</span>
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || mismatch || !agree}>{busy ? '가입하는 중…' : '가입하기'}</button>
        <ErrorNotice error={error} />
        <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>이미 회원이신가요? <Link to="/login">로그인</Link></p>
      </form>
    </div>
  );
}
