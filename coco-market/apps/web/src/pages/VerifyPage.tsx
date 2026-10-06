import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useSession } from '../state/session';
import { useAction } from '../state/useOp';
import { ErrorNotice, Field, Gate, Loading, PageHeader } from '../ui/kit';
import './pages.css';

const RULES = [
  '본인확인기관이 돌려준 연계정보(CI)는 해시로만 저장해요.',
  '주민등록번호는 수집하지 않아요.',
  '한 사람은 계정 하나만 쓸 수 있어요.',
  '만 14세 미만은 가입할 수 없어요.',
  '이용권 구매와 IP 등록은 만 19세 이상만 할 수 있어요.',
];

function VerifyForm() {
  const { user, refresh } = useSession();
  const verify = useAction('identity.verify');
  const [f, setF] = useState({ name: user?.name ?? '', birthDate: '', phone: '' });
  const [adult, setAdult] = useState<boolean | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await verify.run({ name: f.name.trim(), birthDate: f.birthDate, phone: f.phone.trim() });
    if (r) {
      setAdult(r.adult);
      await refresh();
    }
  }

  if (user?.identityVerified) {
    return (
      <div className="stack">
        <div className="notice notice-ok" role="status">
          <b>본인확인을 마쳤어요.</b>
          {adult === false && <span>만 19세 미만이라 이용권 구매와 IP 등록은 할 수 없어요. 퀘스트 제출은 할 수 있어요.</span>}
        </div>
        <div className="row">
          <Link className="btn btn-primary" to="/ips">IP 둘러보기</Link>
          <Link className="btn" to="/quests">퀘스트 보기</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
      <Field label="이름">
        <input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </Field>
      <Field label="생년월일">
        <input className="input" type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} required />
      </Field>
      <Field label="휴대폰 번호" hint={api.mode === 'demo' ? '데모에서는 000으로 시작하는 번호를 넣으면 실패 화면을 볼 수 있어요.' : undefined}>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
      </Field>
      <button type="submit" className="btn btn-primary btn-block" disabled={verify.pending}>{verify.pending ? '확인하는 중…' : '본인확인하기'}</button>
      <ErrorNotice error={verify.error} />
    </form>
  );
}

export default function VerifyPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="본인확인" title="휴대폰 본인확인" desc="돈이 오가는 기능을 쓰기 전에 한 번만 확인해요." />
      <div className="panel stack-sm">
        <span className="label">이렇게 처리해요</span>
        <ul className="bullets">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><VerifyForm /></Gate>}
    </div>
  );
}
