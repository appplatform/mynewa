import { EVIDENCE_KINDS, IP_TYPES, type EvidenceKind, type IPType } from '@coco/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../state/session';
import { useAction } from '../state/useOp';
import { EVIDENCE_LABEL, IP_TYPE_LABEL } from '../ui/format';
import { ErrorNotice, Field, Gate, Loading, PageHeader } from '../ui/kit';
import './pages.css';

const STEPS = ['기본 정보', '권리 증빙', '공동권리자', '확인'];

interface Basics { title: string; type: IPType; summary: string; registrationNo: string }
interface EvidenceRow { kind: EvidenceKind; reference: string }
interface CoRow { email: string; share: string }

const shareNum = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmtPct = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;

function StepNav({ step }: { step: number }) {
  return (
    <ol className="steps" aria-label="등록 단계">
      {STEPS.map((s, i) => (
        <li key={s} className={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>
      ))}
    </ol>
  );
}

function BasicsStep({ v, set }: { v: Basics; set: (v: Basics) => void }) {
  return (
    <div className="stack">
      <Field label="IP 이름">
        <input className="input" value={v.title} onChange={(e) => set({ ...v, title: e.target.value })} minLength={2} maxLength={120} required />
      </Field>
      <Field label="권리 유형">
        <select className="select" value={v.type} onChange={(e) => set({ ...v, type: e.target.value as IPType })}>
          {IP_TYPES.map((t) => <option key={t} value={t}>{IP_TYPE_LABEL[t]}</option>)}
        </select>
      </Field>
      <Field label="소개" hint="무엇을 어떤 용도로 쓸 수 있는지 10자 이상 적어 주세요.">
        <textarea className="textarea" value={v.summary} onChange={(e) => set({ ...v, summary: e.target.value })} minLength={10} maxLength={2000} required />
      </Field>
      <Field label="등록번호" hint="저작권·특허·상표 등록번호를 적어 주세요.">
        <input className="input mono" value={v.registrationNo} onChange={(e) => set({ ...v, registrationNo: e.target.value })} minLength={3} maxLength={60} required />
      </Field>
      <div className="notice">
        <span>투자나 수익 배분을 암시하는 표현은 등록할 수 없어요. 이름과 소개는 제출할 때 자동으로 검사해요.</span>
      </div>
    </div>
  );
}

function EvidenceStep({ rows, set }: { rows: EvidenceRow[]; set: (r: EvidenceRow[]) => void }) {
  return (
    <div className="stack">
      <p className="muted">등록증, 등록원부, 계약서처럼 권리를 보여 주는 자료를 적어 주세요. 심사 요청 전까지 1건 이상 필요해요.</p>
      {rows.map((r, i) => (
        <div key={i} className="repeat-row">
          <Field label={`증빙 ${i + 1} 종류`}>
            <select className="select" value={r.kind} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as EvidenceKind } : x)))}>
              {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{EVIDENCE_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label={`증빙 ${i + 1} 내용`}>
            <input className="input" placeholder="예: 저작권 등록증 사본" value={r.reference} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} maxLength={300} />
          </Field>
          <button type="button" className="btn btn-ghost" onClick={() => set(rows.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={() => set([...rows, { kind: 'REGISTRATION_CERT', reference: '' }])} disabled={rows.length >= 20}>
        증빙 추가
      </button>
    </div>
  );
}

function CoHolderStep({ rows, set }: { rows: CoRow[]; set: (r: CoRow[]) => void }) {
  const total = rows.reduce((s, r) => s + shareNum(r.share), 0);
  const mine = 100 - total;
  return (
    <div className="stack">
      <p className="muted">함께 권리를 가진 분이 있다면 이메일과 정산 지분을 적어 주세요. 모든 공동권리자가 동의해야 심사를 요청할 수 있어요.</p>
      {rows.map((r, i) => (
        <div key={i} className="repeat-row">
          <Field label={`공동권리자 ${i + 1} 지분(%)`}>
            <input className="input num" type="number" inputMode="decimal" min={0.01} max={99.99} step={0.01} value={r.share} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, share: e.target.value } : x)))} />
          </Field>
          <Field label={`공동권리자 ${i + 1} 이메일`}>
            <input className="input" type="email" value={r.email} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
          </Field>
          <button type="button" className="btn btn-ghost" onClick={() => set(rows.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
      <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={() => set([...rows, { email: '', share: '' }])} disabled={rows.length >= 10}>
        공동권리자 추가
      </button>
      <div className={`notice ${mine > 0 ? '' : 'notice-bad'}`} role="status" aria-live="polite">
        <b>내 지분 <span className="num">{fmtPct(mine)}</span></b>
        <span>{mine > 0 ? '공동권리자 지분을 뺀 나머지가 대표 권리자 몫이에요.' : '공동권리자 지분 합계는 100% 미만이어야 해요.'}</span>
      </div>
    </div>
  );
}

function ReviewStep({ b, ev, co }: { b: Basics; ev: EvidenceRow[]; co: CoRow[] }) {
  const total = co.reduce((s, r) => s + shareNum(r.share), 0);
  return (
    <div className="stack">
      <dl className="kv">
        <dt>IP 이름</dt><dd>{b.title}</dd>
        <dt>권리 유형</dt><dd>{IP_TYPE_LABEL[b.type]}</dd>
        <dt>등록번호</dt><dd className="mono">{b.registrationNo}</dd>
        <dt>소개</dt><dd>{b.summary}</dd>
        <dt>권리 증빙</dt>
        <dd>{ev.length ? ev.map((e) => `${EVIDENCE_LABEL[e.kind]} · ${e.reference}`).join(' / ') : '없음 (나중에 추가할 수 있어요)'}</dd>
        <dt>공동권리자</dt>
        <dd>{co.length ? co.map((c) => `${c.email} (${fmtPct(shareNum(c.share))})`).join(', ') : '없음'}</dd>
        <dt>내 지분</dt><dd className="num">{fmtPct(100 - total)}</dd>
      </dl>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        저장하면 초안으로 만들어져요. 다음 화면에서 이용권 상품을 만들고, 공동권리자 동의를 받은 뒤 심사를 요청해 주세요.
      </p>
    </div>
  );
}

function Wizard() {
  const navigate = useNavigate();
  const { user } = useSession();
  const create = useAction('studio.createIp');
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState<Basics>({ title: '', type: 'CHARACTER', summary: '', registrationNo: '' });
  const [evidence, setEvidence] = useState<EvidenceRow[]>([{ kind: 'REGISTRATION_CERT', reference: '' }]);
  const [coHolders, setCoHolders] = useState<CoRow[]>([]);

  const filledEvidence = evidence.filter((e) => e.reference.trim().length >= 2);
  const coTotal = coHolders.reduce((s, r) => s + shareNum(r.share), 0);
  const stepOk = [
    basics.title.trim().length >= 2 && basics.summary.trim().length >= 10 && basics.registrationNo.trim().length >= 3,
    true,
    coTotal < 100 && coHolders.every((c) => /\S+@\S+\.\S+/.test(c.email.trim()) && shareNum(c.share) > 0),
    true,
  ];

  async function save() {
    const ip = await create.run({
      title: basics.title.trim(),
      type: basics.type,
      summary: basics.summary.trim(),
      registrationNo: basics.registrationNo.trim(),
      evidence: filledEvidence.map((e) => ({ kind: e.kind, reference: e.reference.trim() })),
      coHolders: coHolders.map((c) => ({ email: c.email.trim(), shareBps: Math.round(shareNum(c.share) * 100) })),
    });
    if (ip) navigate(`/studio/${ip.id}`);
  }

  return (
    <div className="stack-lg">
      <StepNav step={step} />
      {user && !user.identityVerified && (
        <div className="notice notice-warn"><b>IP 등록은 본인확인을 마친 만 19세 이상 회원만 할 수 있어요.</b><Link to="/verify">본인확인하기</Link></div>
      )}
      <section className="card stack" aria-labelledby="step-title">
        <h2 id="step-title" style={{ fontSize: 'var(--fs-lg)' }}>{step + 1}. {STEPS[step]}</h2>
        {step === 0 && <BasicsStep v={basics} set={setBasics} />}
        {step === 1 && <EvidenceStep rows={evidence} set={setEvidence} />}
        {step === 2 && <CoHolderStep rows={coHolders} set={setCoHolders} />}
        {step === 3 && <ReviewStep b={basics} ev={filledEvidence} co={coHolders} />}
        <ErrorNotice error={create.error} />
        {create.error?.code === 'COMPLIANCE_BLOCKED' && (
          <button type="button" className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => { create.clearError(); setStep(0); }}>기본 정보 고치기</button>
        )}
        <div className="row-between">
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>이전</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={!stepOk[step]} onClick={() => setStep(step + 1)}>다음</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={create.pending || !stepOk.every(Boolean)} onClick={save}>
              {create.pending ? '저장하는 중…' : '초안 저장하기'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function StudioNewPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <Link to="/studio" className="faint">← 권리자 스튜디오</Link>
      <PageHeader eyebrow="권리자 스튜디오" title="새 IP 등록" desc="기본 정보와 권리 증빙, 공동권리자를 차례로 입력해요. 심사를 통과해야 공개돼요." />
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><Wizard /></Gate>}
    </div>
  );
}
