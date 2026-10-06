import type { LicenseGrant, OpOutput } from '@coco/core';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { date, IP_TYPE_LABEL, krw } from '../ui/format';
import { Empty, ErrorNotice, Gate, Loading, PageHeader, ScopeLine } from '../ui/kit';
import { Async } from './_parts/Async';
import { LICENSE_SCOPE_LINE, ScopeList } from './_parts/Scope';
import './pages.css';

type Detail = OpOutput<'catalog.getIp'>;
type Product = Detail['products'][number];

const ERROR_HINT: Record<string, string> = {
  AGE_RESTRICTED: '이용권 구매는 만 19세 이상만 할 수 있어요.',
  ON_HOLD: '권리 분쟁이 정리되면 다시 구매할 수 있어요.',
  CONFLICT: '같은 용도의 독점 이용권이 유효하거나, 지금은 판매할 수 없는 상태예요. IP 상세 화면에서 다른 이용권을 확인해 주세요.',
};

const KEY_TERMS = [
  '이 이용권은 다른 사람에게 양도하거나 되팔 수 없어요.',
  '투자 상품이 아니에요. 권리자의 수익을 나눠 받는 권리가 없어요.',
  '정해진 용도·지역·기간·매체를 벗어나 쓰면 권리 침해가 되고, 계약이 해지될 수 있어요.',
  '이용 개시 전에는 청약을 철회할 수 있어요. 개시 후에는 관련 법령이 허용하는 범위에서 제한될 수 있어요.',
  '권리 분쟁이 접수되면 플랫폼이 판매와 정산을 보류할 수 있어요.',
];

function Success({ grant }: { grant: LicenseGrant }) {
  return (
    <div className="stack">
      <div className="notice notice-ok" role="status">
        <b>이용권이 발급됐어요.</b>
        <span>계약서와 서명 기록은 내 이용권에서 언제든 볼 수 있어요.</span>
      </div>
      <dl className="kv card">
        <dt>이용 기간</dt>
        <dd className="num">{date(grant.startsAt)} ~ {date(grant.endsAt)}</dd>
        <dt>결제 금액</dt>
        <dd className="num">{krw(grant.priceKrw)}</dd>
        <dt>결제 번호</dt>
        <dd className="mono break">{grant.paymentRef}</dd>
      </dl>
      <div className="row">
        <Link className="btn btn-primary" to={`/me/licenses/${grant.id}`}>계약서 보기</Link>
        <Link className="btn" to="/ips">계속 둘러보기</Link>
      </div>
    </div>
  );
}

function CheckoutForm({ d, p }: { d: Detail; p: Product }) {
  const { user } = useSession();
  const [agree, setAgree] = useState(false);
  const [grant, setGrant] = useState<LicenseGrant | null>(null);
  const checkout = useAction('license.checkout');

  if (grant) return <Success grant={grant} />;

  async function pay() {
    const g = await checkout.run({ productId: p.id, agreeTerms: true });
    if (g) setGrant(g);
  }

  const hint = checkout.error ? ERROR_HINT[checkout.error.code] : undefined;
  return (
    <div className="split">
      <div className="stack">
        <section className="card stack" aria-labelledby="summary-title">
          <h2 id="summary-title" style={{ fontSize: 'var(--fs-lg)' }}>계약 요약</h2>
          <dl className="kv">
            <dt>대상 IP</dt>
            <dd>{d.ip.title} <span className="faint">({IP_TYPE_LABEL[d.ip.type]})</span></dd>
            <dt>권리자</dt>
            <dd>{d.holderName}</dd>
            <dt>상품</dt>
            <dd>{p.name}</dd>
          </dl>
          <ScopeList scope={p.scope} period={`결제일부터 ${p.scope.termMonths}개월`} />
        </section>
        <section className="card stack" aria-labelledby="terms-title">
          <h2 id="terms-title" style={{ fontSize: 'var(--fs-lg)' }}>꼭 확인해 주세요</h2>
          <ul className="bullets">{KEY_TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
          <Link to="/legal/terms">이용약관 전체 보기</Link>
        </section>
      </div>

      <aside className="card stack" aria-label="결제">
        <div className="row-between">
          <span className="label">결제 금액</span>
          <span className="price">{krw(p.priceKrw)}</span>
        </div>
        {!user?.identityVerified && (
          <div className="notice notice-warn">
            <b>본인확인이 필요해요.</b>
            <span>이용권 구매는 본인확인을 마친 만 19세 이상 회원만 할 수 있어요. <Link to="/verify">본인확인하기</Link></span>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>약관에 동의합니다 (필수)</span>
        </label>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!agree || checkout.pending} onClick={pay}>
          {checkout.pending ? '결제하는 중…' : `${krw(p.priceKrw)} 결제하기`}
        </button>
        <ErrorNotice error={checkout.error} />
        {hint && <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>{hint}</p>}
        <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
          CO-CO Market은 통신판매중개자예요. 결제 후 표준 이용허락 계약서가 전자서명과 함께 발급돼요.
        </p>
      </aside>
    </div>
  );
}

function CheckoutBody({ productId, ipId }: { productId: string; ipId: string }) {
  const res = useOp('catalog.getIp', { ipId });
  return (
    <Async {...res} lines={5}>
      {(d) => {
        const p = d.products.find((x) => x.id === productId);
        if (!p) {
          return (
            <Empty title="판매 중인 상품이 아니에요" action={<Link className="btn" to={`/ips/${ipId}`}>IP 상세로 가기</Link>}>
              상품이 판매 중지되었거나 주소가 잘못되었어요.
            </Empty>
          );
        }
        return <CheckoutForm d={d} p={p} />;
      }}
    </Async>
  );
}

export default function CheckoutPage() {
  const { productId = '' } = useParams();
  const [params] = useSearchParams();
  const ipId = params.get('ip');
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="이용권 결제" title="이용 조건을 확인하고 결제해 주세요" />
      <ScopeLine buys={LICENSE_SCOPE_LINE.buys} notBuys={LICENSE_SCOPE_LINE.notBuys} />
      {loading ? (
        <Loading />
      ) : (
        <Gate ok={!!user} need="login">
          {ipId ? (
            <CheckoutBody productId={productId} ipId={ipId} />
          ) : (
            <Empty title="상품 정보를 찾을 수 없어요" action={<Link className="btn" to="/ips">IP 둘러보기</Link>}>
              IP 상세 화면에서 이용권을 다시 골라 주세요.
            </Empty>
          )}
        </Gate>
      )}
    </div>
  );
}
