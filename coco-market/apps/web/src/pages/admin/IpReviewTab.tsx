import { USAGE_LABEL, type OpOutput } from '@coco/core';
import { useState } from 'react';
import { useAction } from '../../state/useOp';
import { ErrorNotice, Field, Pill } from '../../ui/kit';
import { date, dateTime, EVIDENCE_LABEL, IP_TYPE_LABEL, krw, pct } from '../../ui/format';
import { Flash, QueryView, ReloadButton, TabIntro, type OpQuery } from './shared';

type Item = OpOutput<'review.ipQueue'>[number];

export function IpReviewTab({ q }: { q: OpQuery<'review.ipQueue'> }) {
  const [flash, setFlash] = useState<string | null>(null);

  const done = (msg: string) => {
    setFlash(msg);
    void q.reload();
  };

  return (
    <>
      <TabIntro title="IP 심사 대기열" actions={<ReloadButton q={q} />}>
        권리 증빙과 공동권리자 동의를 확인한 뒤 승인해요. 승인하면 바로 판매가 열려요. 본인이 권리자인 IP는 심사할 수 없어요.
      </TabIntro>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}
      <QueryView q={q} isEmpty={(d) => d.length === 0} emptyTitle="심사할 IP가 없어요" emptyDesc="새로 제출된 IP가 생기면 여기에 보여요.">
        {(list) => (
          <div className="admin-list">
            {list.map((item) => <IpCard key={item.ip.id} item={item} onDone={done} />)}
          </div>
        )}
      </QueryView>
    </>
  );
}

function IpCard({ item, onDone }: { item: Item; onDone: (msg: string) => void }) {
  const { ip, holderName, evidence, products } = item;
  const [note, setNote] = useState('');
  const decide = useAction('review.decideIp');
  const coShare = ip.coHolders.reduce((s, c) => s + c.shareBps, 0);
  const allConsented = ip.coHolders.every((c) => c.consented);
  const noteOk = note.trim().length >= 2;

  const submit = async (approve: boolean) => {
    if (!approve && !noteOk) return;
    const r = await decide.run({ ipId: ip.id, approve, note: note.trim() });
    if (r) onDone(approve ? `‘${ip.title}’을 승인했어요. 이제 판매가 열려요.` : `‘${ip.title}’을 반려했어요.`);
  };

  return (
    <article className="card admin-card" aria-labelledby={`ip-${ip.id}`}>
      <div className="row-between">
        <div className="stack-sm">
          <div className="row">
            <Pill tone="info">{IP_TYPE_LABEL[ip.type]}</Pill>
            <span className="faint">제출 {dateTime(ip.createdAt)}</span>
          </div>
          <h3 id={`ip-${ip.id}`}>{ip.title}</h3>
        </div>
      </div>

      <dl className="admin-dl">
        <dt>대표 권리자</dt><dd>{holderName} · 지분 {pct(10_000 - coShare)}</dd>
        <dt>등록번호</dt><dd className="mono">{ip.registrationNo || '—'}</dd>
        <dt>소개</dt><dd>{ip.summary}</dd>
      </dl>

      <div className="admin-sub">
        <h4>권리 증빙 {evidence.length}건</h4>
        {evidence.length === 0 ? (
          <div className="notice notice-warn">증빙이 없어요. 반려 사유로 안내해 주세요.</div>
        ) : (
          <ul className="admin-ul">
            {evidence.map((ev) => (
              <li key={ev.id}>
                <b>{EVIDENCE_LABEL[ev.kind] ?? ev.kind}</b>
                <span>{ev.reference}</span>
                {ev.fileHash && <span className="hash faint">SHA-256 {ev.fileHash}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-sub">
        <h4>이용권 상품 {products.length}개</h4>
        {products.length === 0 ? (
          <p className="faint">등록된 상품이 없어요.</p>
        ) : (
          <ul className="admin-ul">
            {products.map((p) => (
              <li key={p.id}>
                <div className="row-between">
                  <b>{p.name}</b>
                  <span className="num">{krw(p.priceKrw)}</span>
                </div>
                <span className="muted">{p.scope.usages.map((u) => USAGE_LABEL[u]).join(', ')}</span>
                <span className="faint">
                  {p.scope.territory} · {p.scope.termMonths}개월 · {p.scope.exclusive ? '독점' : '비독점'}
                  {p.scope.media.length > 0 && ` · ${p.scope.media.join(', ')}`} · 플랫폼 수수료 {pct(p.platformFeeBps)}
                  {!p.active && ' · 비활성'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-sub">
        <h4>공동권리자 {ip.coHolders.length}명</h4>
        {ip.coHolders.length === 0 ? (
          <p className="faint">공동권리자가 없어요.</p>
        ) : (
          <>
            {!allConsented && <div className="notice notice-warn">아직 동의하지 않은 공동권리자가 있어요.</div>}
            <ul className="admin-ul">
              {ip.coHolders.map((c) => (
                <li key={c.email}>
                  <div className="row-between">
                    <span>{c.email}</span>
                    {c.consented ? <Pill tone="ok">동의 {date(c.consentedAt)}</Pill> : <Pill tone="warn">동의 대기</Pill>}
                  </div>
                  <span className="faint">정산 지분 {pct(c.shareBps)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Field label="심사 메모" hint="반려할 때는 사유를 2자 이상 적어 주세요. 권리자에게 그대로 보여요.">
        <textarea className="textarea" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="예: 등록원부 사본이 흐려 확인이 어려워요." />
      </Field>
      <ErrorNotice error={decide.error} />
      <div className="admin-actions">
        <button type="button" className="btn btn-primary" disabled={decide.pending} onClick={() => void submit(true)}>승인</button>
        <button type="button" className="btn btn-danger" disabled={decide.pending || !noteOk} onClick={() => void submit(false)}>반려</button>
      </div>
    </article>
  );
}
