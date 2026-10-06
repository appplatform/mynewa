import type { AnchorBatch } from '@coco/core';
import { useState } from 'react';
import { useAction, useOp } from '../../state/useOp';
import { ErrorNotice, Pill, Stat } from '../../ui/kit';
import { dateTime } from '../../ui/format';
import { QueryView, ReloadButton, TabIntro } from './shared';

function BatchView({ b }: { b: AnchorBatch }) {
  return (
    <dl className="admin-dl">
      <dt>기록 시각</dt><dd>{dateTime(b.createdAt)}</dd>
      <dt>묶은 항목</dt><dd className="num">{b.leafCount.toLocaleString('ko-KR')}건</dd>
      <dt>Merkle root</dt><dd className="hash">{b.merkleRoot}</dd>
      <dt>체인 기록 참조</dt><dd className="hash">{b.chainTxRef}</dd>
    </dl>
  );
}

export function AnchorTab() {
  const stats = useOp('transparency.stats', {});
  const run = useAction('anchor.run');
  const [results, setResults] = useState<AnchorBatch[]>([]);

  const onRun = async () => {
    const r = await run.run({});
    if (!r) return;
    setResults((prev) => [r, ...prev]);
    void stats.reload();
  };

  return (
    <>
      <TabIntro title="블록체인 기록" actions={<ReloadButton q={stats} />}>
        아직 기록되지 않은 이용권 계약과 검증된 기여를 하나의 Merkle root로 묶어 체인에 남겨요.
      </TabIntro>
      <div className="notice" role="note">
        <b>체인에는 해시만 기록돼요</b>
        <span>계약서 원문, 이름, 연락처 같은 개인정보는 체인에 올리지 않아요. 누구나 이용권·기여 ID로 Merkle 증명을 검증할 수 있어요.</span>
      </div>

      <section className="card stack" aria-labelledby="anchor-run-h">
        <div className="row-between">
          <h3 id="anchor-run-h">지금 기록하기</h3>
          <button type="button" className="btn btn-primary" disabled={run.pending} onClick={() => void onRun()}>
            {run.pending ? '기록 중…' : '새 배치 기록'}
          </button>
        </div>
        <ErrorNotice error={run.error} />
        {results.length === 0 ? (
          <p className="faint">버튼을 누르면 결과가 여기에 보여요.</p>
        ) : (
          <div className="admin-list">
            {results.map((b) => (
              <div key={b.id} className="notice notice-ok" role="status">
                <b>기록했어요</b>
                <BatchView b={b} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="anchor-latest-h">
        <h3 id="anchor-latest-h">기록 현황</h3>
        <QueryView q={stats} emptyTitle="기록 현황을 불러올 수 없어요">
          {(s) => (
            <div className="stack">
              <div className="row" style={{ gap: 'var(--s8)' }}>
                <Stat label="누적 배치" value={`${s.anchoring.batches.toLocaleString('ko-KR')}개`} hint={`${dateTime(s.asOf)} 기준`} />
              </div>
              {s.anchoring.latest ? (
                <div className="card stack-sm">
                  <div className="row"><Pill tone="brand">최근 배치</Pill></div>
                  <BatchView b={s.anchoring.latest} />
                </div>
              ) : (
                <div className="empty"><b>아직 기록한 배치가 없어요</b></div>
              )}
            </div>
          )}
        </QueryView>
      </section>
    </>
  );
}
