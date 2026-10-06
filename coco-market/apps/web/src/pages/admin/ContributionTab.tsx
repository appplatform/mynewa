import type { OpOutput, Reward } from '@coco/core';
import { useState } from 'react';
import { useAction } from '../../state/useOp';
import { ErrorNotice, Field, Pill } from '../../ui/kit';
import { dateTime, kindName, krw } from '../../ui/format';
import { INCOME_LABEL, QueryView, ReloadButton, TabIntro, type OpQuery } from './shared';

type Item = OpOutput<'review.contributionQueue'>[number];

type Outcome = { kind: 'approved'; title: string; reward: Reward } | { kind: 'rejected'; title: string };

export function ContributionTab({ q }: { q: OpQuery<'review.contributionQueue'> }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const done = (o: Outcome) => {
    setOutcome(o);
    void q.reload();
  };

  return (
    <>
      <TabIntro title="기여 검증 대기열" actions={<ReloadButton q={q} />}>
        제출한 증빙이 퀘스트 조건에 맞는지 확인해요. 승인하면 용역비가 원천징수 후 기여자 정산 계정에 적립돼요. 본인 기여는 검증할 수 없어요.
      </TabIntro>
      {outcome && <OutcomeNotice o={outcome} onClose={() => setOutcome(null)} />}
      <QueryView q={q} isEmpty={(d) => d.length === 0} emptyTitle="검증할 기여가 없어요" emptyDesc="새로 제출된 기여가 생기면 여기에 보여요.">
        {(list) => (
          <div className="admin-list">
            {list.map((item) => <ContributionCard key={item.contribution.id} item={item} onDone={done} />)}
          </div>
        )}
      </QueryView>
    </>
  );
}

function OutcomeNotice({ o, onClose }: { o: Outcome; onClose: () => void }) {
  return (
    <div className={`notice ${o.kind === 'approved' ? 'notice-ok' : ''} admin-flash`} role="status">
      {o.kind === 'approved' ? (
        <div className="stack-sm">
          <b>‘{o.title}’ 기여를 승인했어요.</b>
          <dl className="admin-dl">
            <dt>용역비</dt><dd className="num">{krw(o.reward.grossKrw)}</dd>
            <dt>원천징수</dt><dd className="num">− {krw(o.reward.withholdingKrw)} ({INCOME_LABEL[o.reward.incomeType]})</dd>
            <dt>실수령 적립</dt><dd className="num"><b>{krw(o.reward.netKrw)}</b></dd>
          </dl>
        </div>
      ) : (
        <b>‘{o.title}’ 기여를 반려했어요.</b>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="알림 닫기">닫기</button>
    </div>
  );
}

function ContributionCard({ item, onDone }: { item: Item; onDone: (o: Outcome) => void }) {
  const { contribution: c, questTitle, rewardKrw, userName, merchantName } = item;
  const [note, setNote] = useState('');
  const decide = useAction('review.decideContribution');

  const submit = async (approve: boolean) => {
    const r = await decide.run({ contributionId: c.id, approve, note: note.trim() });
    if (!r) return;
    onDone(r.reward ? { kind: 'approved', title: questTitle, reward: r.reward } : { kind: 'rejected', title: questTitle });
  };

  return (
    <article className="card admin-card" aria-labelledby={`c-${c.id}`}>
      <div className="stack-sm">
        <div className="row">
          <Pill tone="info">{kindName(c.kind)}</Pill>
          <span className="faint">제출 {dateTime(c.createdAt)}</span>
        </div>
        <h3 id={`c-${c.id}`}>{questTitle || '삭제된 퀘스트'}</h3>
      </div>
      <dl className="admin-dl">
        <dt>제출자</dt><dd>{userName || '—'}</dd>
        {merchantName && (<><dt>온보딩 가맹점</dt><dd>{merchantName}</dd></>)}
        <dt>용역비(세전)</dt><dd className="num">{krw(rewardKrw)}</dd>
      </dl>
      <div className="admin-sub">
        <h4>제출 증빙</h4>
        <pre className="admin-pre">{c.evidence}</pre>
      </div>
      <Field label="검증 메모 (선택)" hint="반려할 때는 이유를 적어 주면 기여자가 다시 제출하기 쉬워요.">
        <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNotice error={decide.error} />
      <div className="admin-actions">
        <button type="button" className="btn btn-primary" disabled={decide.pending} onClick={() => void submit(true)}>승인하고 지급</button>
        <button type="button" className="btn btn-danger" disabled={decide.pending} onClick={() => void submit(false)}>반려</button>
      </div>
    </article>
  );
}
