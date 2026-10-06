import type { OpOutput } from '@coco/core';
import { Link } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { IP_STATUS, IP_TYPE_LABEL, krw } from '../ui/format';
import { Empty, ErrorNotice, Gate, Loading, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import './pages.css';

type MyIp = OpOutput<'studio.myIps'>[number];

function StudioCard({ item, onChanged }: { item: MyIp; onChanged: () => void }) {
  const consent = useAction('coholder.consent');
  const { ip } = item;
  const st = IP_STATUS[ip.status];
  return (
    <article className="card stack">
      <div className="row" style={{ gap: 6 }}>
        <Pill tone={st.tone}>{st.label}</Pill>
        <Pill tone="brand">{item.role === 'OWNER' ? '대표 권리자' : '공동권리자'}</Pill>
        <Pill>{IP_TYPE_LABEL[ip.type]}</Pill>
      </div>
      <h3>{ip.title}</h3>
      <p className="muted num" style={{ fontSize: 'var(--fs-sm)' }}>
        이용권 상품 {item.products.length}개 · 판매 {item.salesCount}건 · 판매액 {krw(item.salesKrw)}
      </p>
      {item.openDispute && (
        <div className="notice notice-warn"><b>권리 분쟁이 접수됐어요.</b><span>검토가 끝날 때까지 새 판매와 정산이 보류돼요.</span></div>
      )}
      {item.myConsentPending && (
        <div className="notice">
          <b>공동권리자 동의를 기다리고 있어요.</b>
          <span>동의하면 이 IP의 등록과 이용권 판매에 전자서명으로 동의하게 돼요.</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ justifySelf: 'start' }}
            disabled={consent.pending}
            onClick={async () => { if (await consent.run({ ipId: ip.id })) onChanged(); }}
          >
            {consent.pending ? '처리하는 중…' : '공동권리자로 동의하기'}
          </button>
          <ErrorNotice error={consent.error} />
        </div>
      )}
      <Link className="btn btn-sm" style={{ justifySelf: 'start' }} to={`/studio/${ip.id}`}>
        {item.role === 'OWNER' ? '관리하기' : '자세히 보기'}
      </Link>
    </article>
  );
}

function MyIps() {
  const res = useOp('studio.myIps', {});
  return (
    <Async {...res}>
      {(list) =>
        list.length === 0 ? (
          <Empty title="아직 등록한 IP가 없어요" action={<Link className="btn btn-primary" to="/studio/new">새 IP 등록</Link>}>
            권리 증빙과 이용권 상품을 준비해 첫 IP를 등록해 보세요.
          </Empty>
        ) : (
          <div className="grid-cards">{list.map((it) => <StudioCard key={it.ip.id} item={it} onChanged={() => void res.reload()} />)}</div>
        )
      }
    </Async>
  );
}

export default function StudioPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader
        eyebrow="권리자 스튜디오"
        title="내 IP를 이용권으로 내놓아요"
        desc="이용 범위와 가격은 권리자가 정해요. 판매 대금은 플랫폼 수수료를 뺀 뒤 권리자 지분대로 정산 계정에 쌓여요."
        actions={user && <Link className="btn btn-primary" to="/studio/new">새 IP 등록</Link>}
      />
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><MyIps /></Gate>}
    </div>
  );
}
