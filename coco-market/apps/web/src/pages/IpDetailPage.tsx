import type { OpOutput } from '@coco/core';
import { Link, useParams } from 'react-router';
import { useOp } from '../state/useOp';
import { EVIDENCE_LABEL, IP_STATUS, IP_TYPE_LABEL, krw } from '../ui/format';
import { Empty, PageHeader, Pill, ScopeLine } from '../ui/kit';
import { Async } from './_parts/Async';
import { ExclusivePill, LICENSE_SCOPE_LINE, ScopeList } from './_parts/Scope';
import './pages.css';

type Detail = OpOutput<'catalog.getIp'>;
type Product = Detail['products'][number];

function blockReason(d: Detail, p: Product): string | null {
  if (d.ip.status === 'SUSPENDED') return '판매가 정지된 IP예요.';
  if (d.ip.status !== 'ACTIVE') return '아직 심사를 마치지 않은 IP예요.';
  if (d.onHold) return '권리 분쟁을 처리하는 동안 판매가 잠시 멈췄어요.';
  if (p.blockedByExclusive) return '같은 용도의 독점 이용권이 아직 유효해요.';
  return null;
}

function ProductCard({ d, p }: { d: Detail; p: Product }) {
  const reason = blockReason(d, p);
  return (
    <article className="card stack">
      <div className="row-between">
        <h3>{p.name}</h3>
        <ExclusivePill exclusive={p.scope.exclusive} />
      </div>
      <ScopeList scope={p.scope} />
      <div className="row-between">
        <span className="price">{krw(p.priceKrw)}</span>
        {reason ? (
          <button type="button" className="btn" disabled aria-describedby={`why-${p.id}`}>구매할 수 없어요</button>
        ) : (
          <Link className="btn btn-primary" to={`/checkout/${p.id}?ip=${d.ip.id}`}>이용권 구매</Link>
        )}
      </div>
      {reason && <p id={`why-${p.id}`} className="faint" style={{ fontSize: 'var(--fs-sm)' }}>{reason}</p>}
    </article>
  );
}

function RightsInfo({ d }: { d: Detail }) {
  const consented = d.coHolders.filter((c) => c.consented).length;
  return (
    <section className="card stack" aria-labelledby="rights-title">
      <h2 id="rights-title" style={{ fontSize: 'var(--fs-lg)' }}>권리 정보</h2>
      <dl className="kv">
        <dt>대표 권리자</dt>
        <dd>{d.holderName}</dd>
        <dt>등록번호</dt>
        <dd className="mono">{d.ip.registrationNo}</dd>
        <dt>공동권리자</dt>
        <dd>{d.coHolders.length ? `${d.coHolders.length}명 (동의 ${consented}명)` : '없음'}</dd>
        <dt>판매된 이용권</dt>
        <dd className="num">{d.salesCount}건</dd>
      </dl>
      <div className="stack-sm">
        <span className="label">권리 증빙</span>
        {d.evidence.length === 0 ? (
          <p className="faint">등록된 증빙이 없어요.</p>
        ) : (
          <ul className="bullets">
            {d.evidence.map((e, i) => (
              <li key={i}>
                <b>{EVIDENCE_LABEL[e.kind] ?? e.kind}</b> · {e.reference}
                {e.hasFile && <span className="faint"> (파일 해시 등록)</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>증빙은 운영사 심사 담당자가 확인했어요. 권리의 최종 책임은 권리자에게 있어요.</p>
      </div>
      <Link to={`/report?ip=${d.ip.id}`} className="btn btn-sm btn-danger" style={{ justifySelf: 'start' }}>권리 침해 신고</Link>
    </section>
  );
}

function IpDetailView({ d }: { d: Detail }) {
  const st = IP_STATUS[d.ip.status];
  return (
    <>
      <PageHeader
        eyebrow={IP_TYPE_LABEL[d.ip.type]}
        title={d.ip.title}
        desc={d.ip.summary}
        actions={<Pill tone={st.tone}>{st.label}</Pill>}
      />
      {d.onHold && (
        <div className="notice notice-warn" role="status">
          <b>권리 분쟁 신고가 접수되어 검토 중이에요.</b>
          <span>검토가 끝날 때까지 새 이용권 판매와 권리자 정산이 잠시 멈춰요.</span>
        </div>
      )}
      <div className="split">
        <section className="stack" aria-labelledby="products-title">
          <h2 id="products-title">이용권 상품</h2>
          <ScopeLine buys={LICENSE_SCOPE_LINE.buys} notBuys={LICENSE_SCOPE_LINE.notBuys} />
          {d.products.length === 0 ? (
            <Empty title="판매 중인 이용권이 없어요">권리자가 상품을 열면 여기에 보여요.</Empty>
          ) : (
            d.products.map((p) => <ProductCard key={p.id} d={d} p={p} />)
          )}
        </section>
        <RightsInfo d={d} />
      </div>
    </>
  );
}

export default function IpDetailPage() {
  const { ipId = '' } = useParams();
  const res = useOp('catalog.getIp', { ipId });
  return (
    <div className="page">
      <Link to="/ips" className="faint">← IP 목록</Link>
      <Async {...res} lines={5}>{(d) => <IpDetailView d={d} />}</Async>
    </div>
  );
}
