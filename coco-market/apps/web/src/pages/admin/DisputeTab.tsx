import type { Dispute, OpOutput } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { useAction } from '../../state/useOp';
import { ErrorNotice, Field, Pill } from '../../ui/kit';
import { dateTime } from '../../ui/format';
import { Flash, QueryView, ReloadButton, TabIntro, type OpQuery } from './shared';

const STATUS: Record<Dispute['status'], { label: string; tone: 'warn' | 'bad' | '' }> = {
  OPEN: { label: '처리 중', tone: 'warn' },
  UPHELD: { label: '인용', tone: 'bad' },
  DISMISSED: { label: '기각', tone: '' },
};

type Item = OpOutput<'disputes.queue'>[number];

export function DisputeTab({ q }: { q: OpQuery<'disputes.queue'> }) {
  const [flash, setFlash] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const done = (msg: string) => {
    setFlash(msg);
    void q.reload();
  };

  return (
    <>
      <TabIntro title="권리 분쟁" actions={<ReloadButton q={q} />}>
        신고가 접수되면 해당 IP의 판매와 권리자 정산이 자동으로 멈춰요. 양쪽 소명을 확인한 뒤 결정해 주세요.
      </TabIntro>
      <div className="notice" role="note">
        <span><b>인용</b>하면 해당 IP의 판매가 정지돼요.</span>
        <span><b>기각</b>하면 판매와 정산이 다시 열려요.</span>
      </div>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}
      <QueryView q={q} isEmpty={(d) => d.length === 0} emptyTitle="접수된 분쟁이 없어요">
        {(list) => {
          const open = list.filter((x) => x.dispute.status === 'OPEN');
          const closed = list.filter((x) => x.dispute.status !== 'OPEN');
          return (
            <div className="stack-lg">
              {open.length === 0 ? (
                <div className="notice notice-ok">처리할 분쟁이 없어요.</div>
              ) : (
                <div className="admin-list">
                  {open.map((item) => <DisputeCard key={item.dispute.id} item={item} onDone={done} />)}
                </div>
              )}
              {closed.length > 0 && (
                <div className="stack">
                  <label className="check">
                    <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                    처리 완료 {closed.length}건 보기
                  </label>
                  {showClosed && (
                    <div className="admin-list">
                      {closed.map((item) => <DisputeCard key={item.dispute.id} item={item} onDone={done} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function DisputeCard({ item, onDone }: { item: Item; onDone: (msg: string) => void }) {
  const { dispute: d, ipTitle } = item;
  const [uphold, setUphold] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const decide = useAction('disputes.decide');
  const st = STATUS[d.status];
  const canSubmit = uphold !== null && note.trim().length >= 2 && !decide.pending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (uphold === null || !canSubmit) return;
    const r = await decide.run({ disputeId: d.id, uphold, note: note.trim() });
    if (r) onDone(uphold ? `‘${ipTitle}’ 분쟁을 인용했어요. 판매가 정지됐어요.` : `‘${ipTitle}’ 분쟁을 기각했어요. 판매와 정산이 다시 열려요.`);
  };

  return (
    <article className="card admin-card" aria-labelledby={`d-${d.id}`}>
      <div className="row-between">
        <h3 id={`d-${d.id}`}>{ipTitle || '삭제된 IP'}</h3>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <dl className="admin-dl">
        <dt>접수</dt><dd>{dateTime(d.createdAt)}</dd>
        {d.decidedAt && (<><dt>결정</dt><dd>{dateTime(d.decidedAt)}</dd></>)}
      </dl>
      <div className="admin-sub">
        <h4>신고 내용</h4>
        <pre className="admin-pre">{d.reason}</pre>
      </div>
      {d.decisionNote && (
        <div className="admin-sub">
          <h4>결정 사유</h4>
          <pre className="admin-pre">{d.decisionNote}</pre>
        </div>
      )}
      {d.status === 'OPEN' && (
        <form className="stack" onSubmit={(e) => void submit(e)}>
          <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">결정</legend>
            <div className="chips">
              <label className="chip-toggle">
                <input type="radio" name={`uphold-${d.id}`} checked={uphold === true} onChange={() => setUphold(true)} />
                인용 (판매 정지)
              </label>
              <label className="chip-toggle">
                <input type="radio" name={`uphold-${d.id}`} checked={uphold === false} onChange={() => setUphold(false)} />
                기각 (판매·정산 재개)
              </label>
            </div>
          </fieldset>
          <Field label="결정 사유" hint="2자 이상 적어 주세요. 처리 이력으로 공개돼요.">
            <textarea className="textarea" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorNotice error={decide.error} />
          <div className="admin-actions">
            <button type="submit" className={`btn ${uphold ? 'btn-danger' : 'btn-primary'}`} disabled={!canSubmit}>
              {decide.pending ? '처리 중…' : '결정 저장'}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
