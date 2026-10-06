import { APPROVALS_REQUIRED, MIN_PAYOUT_KRW } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { date, krw } from '../ui/format';
import { Empty, ErrorNotice, Field, Gate, Loading, PageHeader, Pill, Stat } from '../ui/kit';
import { Async } from './_parts/Async';
import { PAYOUT_STATUS } from './_parts/labels';
import './pages.css';

const MIN_PAYOUT = MIN_PAYOUT_KRW;

function signed(n: number) {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${krw(Math.abs(n))}`;
}

function RequestForm({ available, disabled, onDone }: { available: number; disabled: boolean; onDone: () => void }) {
  const { user } = useSession();
  const req = useAction('payouts.request');
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await req.run({ amountKrw: value })) {
      setAmount('');
      onDone();
    }
  }
  return (
    <form className="card stack" onSubmit={onSubmit} aria-labelledby="req-title">
      <h2 id="req-title" style={{ fontSize: 'var(--fs-lg)' }}>출금 신청</h2>
      {user && !user.identityVerified && <div className="notice notice-warn"><b>본인확인 후 출금할 수 있어요.</b><Link to="/verify">본인확인하기</Link></div>}
      <Field label="출금 금액(원)" hint={`최소 ${krw(MIN_PAYOUT)} · 출금 가능 ${krw(available)}`}>
        <input className="input num" type="number" min={MIN_PAYOUT} max={available || undefined} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={disabled || req.pending || !Number.isInteger(value) || value < MIN_PAYOUT || value > available}>
        {req.pending ? '신청하는 중…' : '출금 신청하기'}
      </button>
      <ErrorNotice error={req.error} />
      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>출금은 재무 담당자 2인이 각각 승인한 뒤 등록 계좌로 지급돼요.</p>
    </form>
  );
}

function Wallet() {
  const summary = useOp('wallet.summary', {});
  const history = useOp('wallet.history', {});
  const payouts = useOp('payouts.mine', {});
  const reloadAll = () => { void summary.reload(); void history.reload(); void payouts.reload(); };
  return (
    <>
      <Async {...summary} lines={2}>
        {(s) => (
          <div className="split">
            <section className="card stack" aria-label="정산 잔액">
              <div className="stat-strip">
                <Stat label="정산 적립 잔액" value={krw(s.payableKrw)} />
                <Stat label="출금 신청 중" value={krw(s.pendingKrw)} />
                <Stat label="출금 가능" value={krw(s.availableKrw)} />
              </div>
              {s.hold && <div className="notice notice-warn"><b>출금이 보류됐어요.</b><span>{s.hold}</span></div>}
              <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>잔액은 복식부기 원장에서 계산해요. 퀘스트 용역비는 원천징수 후 금액으로 적립돼요.</p>
            </section>
            <RequestForm available={s.availableKrw} disabled={!!s.hold} onDone={reloadAll} />
          </div>
        )}
      </Async>

      <section className="stack" aria-labelledby="payouts-title">
        <h2 id="payouts-title">출금 신청 내역</h2>
        <Async {...payouts}>
          {(list) =>
            list.length === 0 ? (
              <Empty title="출금 신청 내역이 없어요" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>신청일</th><th className="r">금액</th><th>상태</th><th>승인</th></tr></thead>
                  <tbody>
                    {list.map((p) => {
                      const st = PAYOUT_STATUS[p.status];
                      return (
                        <tr key={p.id}>
                          <td className="num">{date(p.createdAt)}</td>
                          <td className="r num">{krw(p.amountKrw)}</td>
                          <td><Pill tone={st.tone}>{st.label}</Pill></td>
                          <td className="num">{p.status === 'REQUESTED' ? `${p.approvals.length}/${APPROVALS_REQUIRED}` : p.decidedAt ? date(p.decidedAt) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Async>
      </section>

      <section className="stack" aria-labelledby="history-title">
        <h2 id="history-title">정산 계정 거래 내역</h2>
        <Async {...history}>
          {(rows) =>
            rows.length === 0 ? (
              <Empty title="아직 거래 내역이 없어요">이용권 판매 정산이나 퀘스트 용역비가 생기면 여기에 쌓여요.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>날짜</th><th>내용</th><th className="r">금액</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="num">{date(r.at)}</td>
                        <td>{r.memo}</td>
                        <td className="r num">{signed(r.amountKrw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Async>
      </section>
    </>
  );
}

export default function WalletPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="내 정보" title="정산·출금" desc="이용권 판매 정산과 퀘스트 용역비가 쌓이는 계정이에요. 출금은 재무 담당자 2인 승인 후 지급돼요." />
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><Wallet /></Gate>}
    </div>
  );
}
