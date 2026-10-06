import { withholding, type Quest } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { kindName, krw, tierName } from '../ui/format';
import { Empty, ErrorNotice, Field, Gate, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import { CopyCode } from './_parts/CopyCode';
import { incomeNote } from './_parts/labels';
import type { QuestItem } from './_parts/QuestCard';
import './pages.css';

function MerchantSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { user } = useSession();
  const mine = useOp('merchant.mine', {});
  return (
    <div className="stack-sm">
      <div className="notice">
        <span>
          본인이 직접 온보딩한 가게만 제출할 수 있어요. 가게가 입점할 때 내 <b>온보딩 코드</b>를 입력하고 <b>가입비 결제</b>까지 마쳐야 목록에 보여요.
          한 가게는 한 번만 제출할 수 있어요.
        </span>
      </div>
      {user && <CopyCode label="내 온보딩 코드" value={user.onboardingCode} />}
      <Async {...mine} lines={1}>
        {(d) => {
          const ready = d.onboarded.filter((m) => m.membershipPaid && !m.claimed);
          if (ready.length === 0) {
            return (
              <Empty title="제출할 수 있는 가게가 없어요" action={<Link className="btn btn-sm" to="/merchant">내가 도운 가게 보기</Link>}>
                내 코드로 입점하고 가입비 결제를 마친 가게가 생기면 선택할 수 있어요.
              </Empty>
            );
          }
          return (
            <Field label="온보딩한 가게">
              <select className="select" value={value} onChange={(e) => onChange(e.target.value)} required>
                <option value="">가게를 골라 주세요</option>
                {ready.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.region}</option>)}
              </select>
            </Field>
          );
        }}
      </Async>
    </div>
  );
}

function SubmitForm({ item }: { item: QuestItem }) {
  const { user } = useSession();
  const q = item.quest;
  const submit = useAction('quests.submit');
  const [evidence, setEvidence] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [done, setDone] = useState(false);
  const isOnboarding = q.kind === 'MERCHANT_ONBOARDING';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await submit.run({ questId: q.id, evidence: evidence.trim(), merchantId: isOnboarding ? merchantId || undefined : undefined });
    if (r) setDone(true);
  }

  if (done) {
    return (
      <div className="stack">
        <div className="notice notice-ok" role="status">
          <b>제출했어요.</b>
          <span>검증 담당자가 확인하면 용역비가 원천징수 후 정산 계정에 쌓여요.</span>
        </div>
        <div className="row">
          <Link className="btn btn-primary" to="/quests">내 기여 내역 보기</Link>
          <button type="button" className="btn" onClick={() => { setDone(false); setEvidence(''); setMerchantId(''); }}>한 건 더 제출</button>
        </div>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={onSubmit} aria-labelledby="submit-title">
      <h2 id="submit-title" style={{ fontSize: 'var(--fs-lg)' }}>수행 결과 제출</h2>
      {!item.eligible && (
        <div className="notice notice-warn"><b>{tierName(q.minTier)} 배지 이상부터 수행할 수 있어요.</b><span>배지는 검증된 본인 기여가 쌓이면 올라가요.</span></div>
      )}
      {user && !user.identityVerified && (
        <div className="notice notice-warn"><b>본인확인 후 제출할 수 있어요.</b><Link to="/verify">본인확인하기</Link></div>
      )}
      {isOnboarding && <MerchantSelect value={merchantId} onChange={setMerchantId} />}
      <Field label="수행 내용과 증빙" hint="언제, 어디서, 무엇을 했는지 10자 이상 적어 주세요. 직접 수행한 일만 제출할 수 있어요.">
        <textarea className="textarea" value={evidence} onChange={(e) => setEvidence(e.target.value)} minLength={10} maxLength={2000} required />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={submit.pending || evidence.trim().length < 10 || (isOnboarding && !merchantId)}>
        {submit.pending ? '제출하는 중…' : '제출하기'}
      </button>
      <ErrorNotice error={submit.error} />
    </form>
  );
}

function QuestInfo({ q, remaining }: { q: Quest; remaining: number }) {
  const net = q.rewardKrw - withholding(q.rewardKrw, q.incomeType);
  return (
    <aside className="card stack" aria-label="퀘스트 조건">
      <dl className="kv">
        <dt>용역비(세전)</dt>
        <dd className="num">{krw(q.rewardKrw)}</dd>
        <dt>원천징수</dt>
        <dd>{incomeNote(q.incomeType)}</dd>
        <dt>지급액(세후)</dt>
        <dd className="num"><b>{krw(net)}</b></dd>
        <dt>수행 가능 배지</dt>
        <dd>{tierName(q.minTier)} 이상</dd>
        <dt>남은 모집</dt>
        <dd className="num">{remaining.toLocaleString('ko-KR')}건</dd>
        <dt>1인 하루 한도</dt>
        <dd className="num">{q.dailyLimitPerUser}건</dd>
      </dl>
      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>용역비는 본인이 수행한 일에 대한 대가예요. 다른 사람에게 대신 맡기거나 제출을 사고팔 수 없어요.</p>
    </aside>
  );
}

export default function QuestDetailPage() {
  const { questId = '' } = useParams();
  const { user } = useSession();
  const list = useOp('quests.list', {});
  return (
    <div className="page">
      <Link to="/quests" className="faint">← 퀘스트 보드</Link>
      <Async {...list} lines={5}>
        {(d) => {
          const item = d.quests.find((x) => x.quest.id === questId);
          if (!item) {
            return (
              <Empty title="진행 중인 퀘스트가 아니에요" action={<Link className="btn" to="/quests">퀘스트 보드로</Link>}>
                모집이 끝났거나 주소가 잘못되었어요.
              </Empty>
            );
          }
          const q = item.quest;
          return (
            <>
              <PageHeader eyebrow={kindName(q.kind)} title={q.title} desc={q.description} actions={user ? (item.eligible ? <Pill tone="ok">수행 가능</Pill> : <Pill>등급 조건 미달</Pill>) : undefined} />
              <div className="split">
                <Gate ok={!!user} need="login"><SubmitForm item={item} /></Gate>
                <QuestInfo q={q} remaining={item.remaining} />
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
