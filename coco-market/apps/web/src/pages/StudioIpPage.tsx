import { EVIDENCE_KINDS, USAGE_LABEL, USAGES, type EvidenceKind, type IPAsset, type LicenseProduct, type OpOutput, type Usage } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { date, EVIDENCE_LABEL, IP_STATUS, IP_TYPE_LABEL, krw, pct } from '../ui/format';
import { Empty, ErrorNotice, Field, Gate, Loading, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import { ExclusivePill, ScopeList } from './_parts/Scope';
import './pages.css';

type MyIp = OpOutput<'studio.myIps'>[number];

function Timeline({ ip }: { ip: IPAsset }) {
  const s = ip.status;
  const reviewed = s === 'ACTIVE' || s === 'SUSPENDED';
  const steps = [
    { label: '초안 작성', note: date(ip.createdAt), cls: 'done' },
    {
      label: s === 'REJECTED' ? '심사 반려' : '심사 요청',
      note: s === 'DRAFT' ? '증빙·상품·동의를 갖추면 요청할 수 있어요' : s === 'PENDING_REVIEW' ? '심사 담당자가 확인하고 있어요' : s === 'REJECTED' ? '보완 후 다시 요청할 수 있어요' : '',
      cls: s === 'DRAFT' ? 'now' : s === 'PENDING_REVIEW' ? 'now' : s === 'REJECTED' ? 'stop' : 'done',
    },
    { label: '공개·판매', note: ip.activatedAt ? date(ip.activatedAt) : '', cls: s === 'ACTIVE' ? 'done' : '' },
    ...(s === 'SUSPENDED' ? [{ label: '판매 정지', note: '권리 분쟁 결정에 따라 판매가 정지됐어요', cls: 'stop' }] : []),
  ];
  return (
    <section className="card stack" aria-labelledby="tl-title">
      <h2 id="tl-title" style={{ fontSize: 'var(--fs-lg)' }}>진행 상태</h2>
      <ol className="timeline">
        {steps.map((st) => (
          <li key={st.label} className={st.cls}>
            <span><b>{st.label}</b>{st.note && <span className="faint"> · {st.note}</span>}</span>
          </li>
        ))}
      </ol>
      {s === 'REJECTED' && ip.reviewNote && (
        <div className="notice notice-warn"><b>반려 사유</b><span>{ip.reviewNote}</span></div>
      )}
      {reviewed && ip.reviewNote && <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>심사 메모: {ip.reviewNote}</p>}
    </section>
  );
}

function EvidenceSection({ item, editable, onChanged }: { item: MyIp; editable: boolean; onChanged: () => void }) {
  const add = useAction('studio.addEvidence');
  const [kind, setKind] = useState<EvidenceKind>('REGISTRATION_CERT');
  const [reference, setReference] = useState('');
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await add.run({ ipId: item.ip.id, kind, reference: reference.trim() })) {
      setReference('');
      onChanged();
    }
  }
  return (
    <section className="card stack" aria-labelledby="ev-title">
      <h2 id="ev-title" style={{ fontSize: 'var(--fs-lg)' }}>권리 증빙</h2>
      {item.evidence.length === 0 ? (
        <p className="faint">아직 등록한 증빙이 없어요.</p>
      ) : (
        <ul className="bullets">
          {item.evidence.map((e) => <li key={e.id}><b>{EVIDENCE_LABEL[e.kind]}</b> · {e.reference} <span className="faint">({date(e.createdAt)})</span></li>)}
        </ul>
      )}
      {editable && (
        <form className="repeat-row" onSubmit={onSubmit}>
          <Field label="종류">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
              {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{EVIDENCE_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label="내용">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} minLength={2} maxLength={300} required />
          </Field>
          <button type="submit" className="btn" disabled={add.pending}>증빙 추가</button>
        </form>
      )}
      <ErrorNotice error={add.error} />
    </section>
  );
}

function ProductRow({ p, editable, onChanged }: { p: LicenseProduct; editable: boolean; onChanged: () => void }) {
  const toggle = useAction('studio.setProductActive');
  return (
    <article className="panel stack-sm">
      <div className="row-between">
        <b>{p.name}</b>
        <div className="row" style={{ gap: 6 }}>
          <ExclusivePill exclusive={p.scope.exclusive} />
          {p.active ? <Pill tone="ok">판매 중</Pill> : <Pill>판매 중지</Pill>}
        </div>
      </div>
      <ScopeList scope={p.scope} />
      <div className="row-between">
        <span className="num"><b>{krw(p.priceKrw)}</b> <span className="faint">· 플랫폼 수수료 {pct(p.platformFeeBps)}</span></span>
        {editable && (
          <button type="button" className="btn btn-sm" disabled={toggle.pending} onClick={async () => { if (await toggle.run({ productId: p.id, active: !p.active })) onChanged(); }}>
            {p.active ? '판매 중지' : '판매 재개'}
          </button>
        )}
      </div>
      <ErrorNotice error={toggle.error} />
    </article>
  );
}

const EMPTY_PRODUCT = { name: '', usages: [] as Usage[], territory: '대한민국', termMonths: '12', exclusive: false, media: '', priceKrw: '' };

function AddProductForm({ ipId, onDone }: { ipId: string; onDone: () => void }) {
  const add = useAction('studio.addProduct');
  const [f, setF] = useState(EMPTY_PRODUCT);
  const toggleUsage = (u: Usage) => setF({ ...f, usages: f.usages.includes(u) ? f.usages.filter((x) => x !== u) : [...f.usages, u] });
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await add.run({
      ipId,
      name: f.name.trim(),
      usages: f.usages,
      territory: f.territory.trim(),
      termMonths: Number(f.termMonths),
      exclusive: f.exclusive,
      media: f.media.split(',').map((m) => m.trim()).filter(Boolean),
      priceKrw: Number(f.priceKrw),
    });
    if (r) {
      setF(EMPTY_PRODUCT);
      onDone();
    }
  }
  return (
    <form className="stack" onSubmit={onSubmit} aria-labelledby="add-product-title">
      <h3 id="add-product-title">이용권 상품 추가</h3>
      <Field label="상품 이름">
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} minLength={2} maxLength={120} required />
      </Field>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 4 }}>허락할 용도 (1개 이상)</legend>
        <div className="chips">
          {USAGES.map((u) => (
            <label key={u} className="chip-toggle">
              <input type="checkbox" checked={f.usages.includes(u)} onChange={() => toggleUsage(u)} />
              {USAGE_LABEL[u]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid-2" style={{ gap: 'var(--s4)' }}>
        <Field label="지역">
          <input className="input" value={f.territory} onChange={(e) => setF({ ...f, territory: e.target.value })} minLength={2} maxLength={60} required />
        </Field>
        <Field label="기간(개월)">
          <input className="input num" type="number" min={1} max={120} value={f.termMonths} onChange={(e) => setF({ ...f, termMonths: e.target.value })} required />
        </Field>
        <Field label="매체" hint="쉼표로 구분해요. 예: 포스터, SNS">
          <input className="input" value={f.media} onChange={(e) => setF({ ...f, media: e.target.value })} />
        </Field>
        <Field label="가격(원)" hint="1,000원 이상">
          <input className="input num" type="number" min={1000} step={100} value={f.priceKrw} onChange={(e) => setF({ ...f, priceKrw: e.target.value })} required />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={f.exclusive} onChange={(e) => setF({ ...f, exclusive: e.target.checked })} />
        <span>독점 이용권이에요 (유효 기간 동안 같은 용도로 다른 사람에게 팔지 않아요)</span>
      </label>
      <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={add.pending || f.usages.length === 0}>
        {add.pending ? '추가하는 중…' : '상품 추가'}
      </button>
      <ErrorNotice error={add.error} />
    </form>
  );
}

function CoHolders({ ip }: { ip: IPAsset }) {
  const total = ip.coHolders.reduce((s, c) => s + c.shareBps, 0);
  return (
    <section className="card stack" aria-labelledby="co-title">
      <h2 id="co-title" style={{ fontSize: 'var(--fs-lg)' }}>공동권리자 동의</h2>
      <p className="muted num" style={{ fontSize: 'var(--fs-sm)' }}>대표 권리자 지분 {pct(10_000 - total)}</p>
      {ip.coHolders.length === 0 ? (
        <p className="faint">공동권리자가 없어요.</p>
      ) : (
        <ul className="checklist">
          {ip.coHolders.map((c) => (
            <li key={c.email}>
              {c.consented ? <Pill tone="ok">동의함</Pill> : <Pill tone="warn">동의 대기</Pill>}
              <span className="break">{c.email} · <span className="num">{pct(c.shareBps)}</span>{c.consentedAt && <span className="faint"> · {date(c.consentedAt)}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmitReview({ item, onChanged }: { item: MyIp; onChanged: () => void }) {
  const submit = useAction('studio.submitIp');
  const checks = [
    { label: '권리 증빙 1건 이상', ok: item.evidence.length > 0 },
    { label: '이용권 상품 1개 이상', ok: item.products.length > 0 },
    { label: '공동권리자 전원 동의', ok: item.ip.coHolders.every((c) => c.consented) },
  ];
  return (
    <section className="card stack" aria-labelledby="submit-title">
      <h2 id="submit-title" style={{ fontSize: 'var(--fs-lg)' }}>심사 요청</h2>
      <ul className="checklist">
        {checks.map((c) => (
          <li key={c.label}>
            <span className={`mark ${c.ok ? 'ok' : 'no'}`}>{c.ok ? '완료' : '필요'}</span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary" disabled={submit.pending || !checks.every((c) => c.ok)} onClick={async () => { if (await submit.run({ ipId: item.ip.id })) onChanged(); }}>
        {submit.pending ? '요청하는 중…' : '심사 요청하기'}
      </button>
      <ErrorNotice error={submit.error} />
    </section>
  );
}

function StudioIp({ item, onChanged }: { item: MyIp; onChanged: () => void }) {
  const { ip } = item;
  const owner = item.role === 'OWNER';
  const draft = ip.status === 'DRAFT' || ip.status === 'REJECTED';
  const st = IP_STATUS[ip.status];
  return (
    <>
      <PageHeader
        eyebrow={`${IP_TYPE_LABEL[ip.type]} · ${owner ? '대표 권리자' : '공동권리자'}`}
        title={ip.title}
        desc={ip.summary}
        actions={<><Pill tone={st.tone}>{st.label}</Pill>{ip.status !== 'DRAFT' && ip.status !== 'PENDING_REVIEW' && <Link className="btn btn-sm" to={`/ips/${ip.id}`}>공개 화면 보기</Link>}</>}
      />
      {item.openDispute && (
        <div className="notice notice-warn"><b>권리 분쟁이 접수됐어요.</b><span>검토가 끝날 때까지 새 판매와 권리자 정산이 보류돼요.</span></div>
      )}
      {!owner && <div className="notice"><span>공동권리자는 내용을 볼 수 있고, 수정은 대표 권리자만 할 수 있어요.</span></div>}
      <div className="split">
        <div className="stack-lg">
          <section className="card stack" aria-labelledby="prod-title">
            <div className="row-between">
              <h2 id="prod-title" style={{ fontSize: 'var(--fs-lg)' }}>이용권 상품</h2>
              <span className="faint num">판매 {item.salesCount}건 · {krw(item.salesKrw)}</span>
            </div>
            {item.products.length === 0 ? (
              <Empty title="아직 만든 상품이 없어요">용도·지역·기간·가격을 정해 첫 이용권을 만들어 보세요.</Empty>
            ) : (
              item.products.map((p) => <ProductRow key={p.id} p={p} editable={owner} onChanged={onChanged} />)
            )}
            {owner && ip.status !== 'SUSPENDED' && (
              <>
                <hr className="divider" />
                <AddProductForm ipId={ip.id} onDone={onChanged} />
              </>
            )}
          </section>
          <EvidenceSection item={item} editable={owner && draft} onChanged={onChanged} />
        </div>
        <div className="stack-lg">
          <Timeline ip={ip} />
          {owner && draft && <SubmitReview item={item} onChanged={onChanged} />}
          <CoHolders ip={ip} />
        </div>
      </div>
    </>
  );
}

function StudioIpBody({ ipId }: { ipId: string }) {
  const res = useOp('studio.myIps', {});
  return (
    <Async {...res} lines={6}>
      {(list) => {
        const item = list.find((x) => x.ip.id === ipId);
        if (!item) {
          return (
            <Empty title="이 IP를 찾을 수 없어요" action={<Link className="btn" to="/studio">스튜디오로</Link>}>
              내가 대표 권리자나 공동권리자인 IP만 볼 수 있어요.
            </Empty>
          );
        }
        return <StudioIp item={item} onChanged={() => void res.reload()} />;
      }}
    </Async>
  );
}

export default function StudioIpPage() {
  const { ipId = '' } = useParams();
  const { user, loading } = useSession();
  return (
    <div className="page">
      <Link to="/studio" className="faint">← 권리자 스튜디오</Link>
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><StudioIpBody ipId={ipId} /></Gate>}
    </div>
  );
}
