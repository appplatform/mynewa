import type { OpOutput } from '@coco/core';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { date, dateTime, krw } from '../ui/format';
import { ErrorNotice, Gate, Loading, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import { effectiveGrantStatus, GRANT_STATUS } from './_parts/labels';
import { ScopeList } from './_parts/Scope';
import './pages.css';

type Verify = OpOutput<'anchor.verify'>;

function AnchorResult({ r }: { r: Verify }) {
  if (!r.anchored) {
    return (
      <div className="notice" role="status">
        <b>아직 블록체인에 기록되기 전이에요.</b>
        <span>운영사가 새 계약을 주기적으로 묶어서 기록해요. 기록되면 여기에서 확인할 수 있어요.</span>
      </div>
    );
  }
  return (
    <div className="stack-sm" role="status">
      <div className={`notice ${r.valid ? 'notice-ok' : 'notice-bad'}`}>
        <b>{r.valid ? '기록이 일치해요. 계약서가 기록 이후 바뀌지 않았어요.' : '기록과 일치하지 않아요. 고객센터에 알려 주세요.'}</b>
      </div>
      <dl className="kv">
        <dt>Merkle root</dt>
        <dd className="mono break">{r.batch.merkleRoot}</dd>
        <dt>체인 기록 번호</dt>
        <dd className="mono break">{r.batch.chainTxRef}</dd>
        <dt>기록 시각</dt>
        <dd>{dateTime(r.batch.createdAt)}</dd>
        <dt>함께 묶인 기록</dt>
        <dd className="num">{r.batch.leafCount}건</dd>
        <dt>증명 단계</dt>
        <dd className="num">{r.proof.length}단계</dd>
      </dl>
    </div>
  );
}

function AnchorCheck({ grantId }: { grantId: string }) {
  const verify = useAction('anchor.verify');
  const [result, setResult] = useState<Verify | null>(null);
  return (
    <section className="card stack" aria-labelledby="anchor-title">
      <h2 id="anchor-title" style={{ fontSize: 'var(--fs-lg)' }}>블록체인 기록 확인</h2>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        체인에는 계약서의 해시(지문)만 묶어서 기록하고, 이름·연락처 같은 개인정보나 가격은 올리지 않아요.
      </p>
      <button
        type="button"
        className="btn"
        style={{ justifySelf: 'start' }}
        disabled={verify.pending}
        onClick={async () => setResult(await verify.run({ kind: 'grant', id: grantId }))}
      >
        {verify.pending ? '확인하는 중…' : '블록체인 기록 확인'}
      </button>
      <ErrorNotice error={verify.error} />
      {result && <AnchorResult r={result} />}
    </section>
  );
}

function LicenseDetail({ grantId }: { grantId: string }) {
  const res = useOp('license.get', { grantId });
  return (
    <Async {...res} lines={6}>
      {({ grant: g, ipTitle }) => {
        const st = GRANT_STATUS[effectiveGrantStatus(g.status, g.endsAt)];
        return (
          <>
            <PageHeader eyebrow="이용권 계약서" title={ipTitle || '이용권'} actions={<Pill tone={st.tone}>{st.label}</Pill>} />
            <div className="split">
              <section className="stack" aria-labelledby="contract-title">
                <h2 id="contract-title" style={{ fontSize: 'var(--fs-lg)' }}>계약서 원문</h2>
                <pre className="contract" tabIndex={0}>{g.contractText}</pre>
                <AnchorCheck grantId={g.id} />
              </section>
              <aside className="card stack" aria-label="계약 정보">
                <ScopeList scope={g.scope} period={`${date(g.startsAt)} ~ ${date(g.endsAt)}`} />
                <hr className="divider" />
                <dl className="kv">
                  <dt>이용료</dt>
                  <dd className="num">{krw(g.priceKrw)}</dd>
                  <dt>약관 버전</dt>
                  <dd>{g.termsVersion}</dd>
                  <dt>결제 번호</dt>
                  <dd className="mono break">{g.paymentRef}</dd>
                  <dt>전자서명 해시</dt>
                  <dd className="mono break">{g.signatureHash}</dd>
                  <dt>체결 시각</dt>
                  <dd>{dateTime(g.createdAt)}</dd>
                </dl>
              </aside>
            </div>
          </>
        );
      }}
    </Async>
  );
}

export default function LicenseDetailPage() {
  const { grantId = '' } = useParams();
  const { user, loading } = useSession();
  return (
    <div className="page">
      <Link to="/me/licenses" className="faint">← 내 이용권</Link>
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><LicenseDetail grantId={grantId} /></Gate>}
    </div>
  );
}
