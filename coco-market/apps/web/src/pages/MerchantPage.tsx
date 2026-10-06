import type { Merchant } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { date, krw } from '../ui/format';
import { Empty, ErrorNotice, Field, Gate, Loading, PageHeader, Pill, ScopeLine } from '../ui/kit';
import { Async } from './_parts/Async';
import { CopyCode } from './_parts/CopyCode';
import './pages.css';

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const register = useAction('merchant.register');
  const [form, setForm] = useState({ name: '', businessNumber: '', region: '', onboardingCode: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await register.run({
      name: form.name.trim(),
      businessNumber: form.businessNumber.trim(),
      region: form.region.trim(),
      onboardingCode: form.onboardingCode.trim() || undefined,
    });
    if (r) {
      setForm({ name: '', businessNumber: '', region: '', onboardingCode: '' });
      onDone();
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit} aria-labelledby="reg-title">
      <h3 id="reg-title">입점 신청</h3>
      {user && !user.identityVerified && (
        <div className="notice notice-warn"><b>대표자 본인확인 후 신청할 수 있어요.</b><Link to="/verify">본인확인하기</Link></div>
      )}
      <Field label="가게 이름">
        <input className="input" value={form.name} onChange={set('name')} minLength={2} maxLength={80} required />
      </Field>
      <Field
        label="사업자등록번호"
        hint={api.mode === 'demo' ? '데모에서는 999-81-00029 또는 999-81-00034를 쓸 수 있어요.' : '국세청 진위 확인을 거쳐요.'}
      >
        <input className="input mono" inputMode="numeric" placeholder="000-00-00000" value={form.businessNumber} onChange={set('businessNumber')} required />
      </Field>
      <Field label="지역" hint="예: 서울 마포구">
        <input className="input" value={form.region} onChange={set('region')} minLength={2} maxLength={60} required />
      </Field>
      <Field label="온보딩 코드 (선택)" hint="입점을 직접 도와준 분이 있다면 그분의 코드를 적어 주세요. 한 사람만 연결돼요.">
        <input className="input mono" value={form.onboardingCode} onChange={set('onboardingCode')} maxLength={16} style={{ textTransform: 'uppercase' }} />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={register.pending}>{register.pending ? '신청하는 중…' : '입점 신청하기'}</button>
      <ErrorNotice error={register.error} />
    </form>
  );
}

function OwnedMerchant({ m, onPaid }: { m: Merchant; onPaid: () => void }) {
  const pay = useAction('merchant.payMembership');
  return (
    <article className="card stack-sm">
      <div className="row-between">
        <h3>{m.name}</h3>
        {m.membershipPaid ? <Pill tone="ok">입점 완료</Pill> : <Pill tone="warn">가입비 결제 대기</Pill>}
      </div>
      <dl className="kv">
        <dt>지역</dt>
        <dd>{m.region}</dd>
        <dt>사업자번호</dt>
        <dd className="mono">{m.businessNumber}</dd>
        <dt>가입비</dt>
        <dd className="num">{krw(m.membershipFeeKrw)}</dd>
        <dt>신청일</dt>
        <dd className="num">{date(m.createdAt)}</dd>
      </dl>
      {!m.membershipPaid && (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pay.pending}
            onClick={async () => { if (await pay.run({ merchantId: m.id })) onPaid(); }}
          >
            {pay.pending ? '결제하는 중…' : `가입비 ${krw(m.membershipFeeKrw)} 결제하기`}
          </button>
          <ErrorNotice error={pay.error} />
        </>
      )}
    </article>
  );
}

function OwnerSection() {
  const mine = useOp('merchant.mine', {});
  return (
    <section className="stack" aria-labelledby="owner-title">
      <h2 id="owner-title">가게 입점하기</h2>
      <ScopeLine buys="가맹점 입점과 가맹점 콘솔 이용" notBuys="IP 이용권·IP 지분·다른 회원을 모집해 받는 수당" />
      <p className="muted">사업자등록번호를 확인한 뒤 입점 신청을 받고, 가입비 결제가 끝나면 입점이 마무리돼요. 가입비 금액은 신청 후 바로 보여 드려요.</p>
      <div className="grid-2">
        <RegisterForm onDone={() => void mine.reload()} />
        <div className="stack">
          <h3>내 가게</h3>
          <Async {...mine}>
            {(d) =>
              d.owned.length === 0 ? (
                <Empty title="아직 신청한 가게가 없어요">왼쪽 양식으로 입점을 신청해 주세요.</Empty>
              ) : (
                d.owned.map((m) => <OwnedMerchant key={m.id} m={m} onPaid={() => void mine.reload()} />)
              )
            }
          </Async>
        </div>
      </div>
    </section>
  );
}

function HelperSection() {
  const { user } = useSession();
  const mine = useOp('merchant.mine', {});
  return (
    <section className="stack" aria-labelledby="helper-title">
      <h2 id="helper-title">내가 도운 가게</h2>
      <p className="muted">
        가게가 입점할 때 내 온보딩 코드를 입력하면, 그 가게와 나만 1단계로 연결돼요. 입점과 가입비 결제가 끝난 가게는 &lsquo;골목 가게 입점 돕기&rsquo; 퀘스트로 제출할 수 있어요.
      </p>
      {user && <CopyCode label="내 온보딩 코드" value={user.onboardingCode} />}
      <div className="notice">
        <span>
          가입비 중 영업대행 수수료는 운영사가 법률 검토를 마친 경우에만 지급돼요. 그 전에는 퀘스트 용역비만 적용돼요.
          자세한 내용은 <Link to="/legal/gates">기능별 법적 검토 현황</Link>에서 볼 수 있어요.
        </span>
      </div>
      <Async {...mine}>
        {(d) =>
          d.onboarded.length === 0 ? (
            <Empty title="아직 내 코드로 입점한 가게가 없어요">동네 가게 사장님께 입점을 안내하고, 신청할 때 내 코드를 적어 달라고 부탁해 보세요.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>가게</th><th>지역</th><th>입점 상태</th><th>퀘스트 제출</th></tr></thead>
                <tbody>
                  {d.onboarded.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.region}</td>
                      <td>{m.membershipPaid ? <Pill tone="ok">입점 완료</Pill> : <Pill tone="warn">가입비 결제 대기</Pill>}</td>
                      <td>
                        {m.claimed ? <Pill>제출함</Pill>
                          : m.membershipPaid ? <Link to="/quests">제출할 수 있어요</Link>
                          : <span className="faint">입점 후 가능</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Async>
    </section>
  );
}

export default function MerchantPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="가맹점" title="동네 가게와 함께해요" desc="가게 사장님은 입점을 신청하고, 기여자는 입점을 도운 가게를 확인할 수 있어요." />
      {loading ? (
        <Loading />
      ) : (
        <Gate ok={!!user} need="login">
          <OwnerSection />
          <hr className="divider" />
          <HelperSection />
        </Gate>
      )}
    </div>
  );
}
