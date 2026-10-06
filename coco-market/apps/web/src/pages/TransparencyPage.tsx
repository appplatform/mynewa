import type { OpOutput } from '@coco/core';
import type { ReactNode } from 'react';
import { useOp } from '../state/useOp';
import { dateTime, krw } from '../ui/format';
import { PageHeader, Stat } from '../ui/kit';
import { Async } from './_parts/Async';
import './pages.css';

type Stats = OpOutput<'transparency.stats'>;
const n = (v: number, unit: string) => `${v.toLocaleString('ko-KR')}${unit}`;

function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="card stack" aria-label={title}>
      <h2 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h2>
      <div className="stat-strip">{children}</div>
      {note && <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{note}</p>}
    </section>
  );
}

function Board({ s }: { s: Stats }) {
  const latest = s.anchoring.latest;
  return (
    <>
      <div className="notice" role="note">
        <b>기준 시각 {dateTime(s.asOf)}</b>
        <span>과거 집계치만 공개하며 미래 수익이나 가격을 예측하지 않습니다.</span>
      </div>
      <div className="grid-2">
        <Group title="IP">
          <Stat label="판매 중인 IP" value={n(s.ips.active, '개')} />
          <Stat label="권리자 수" value={n(s.ips.rightsHolders, '명')} />
          <Stat label="심사 대기" value={n(s.ips.pendingReview, '건')} />
        </Group>
        <Group title="이용권 판매" note="권리자 정산 적립액은 판매 대금에서 플랫폼 수수료를 뺀 금액이에요.">
          <Stat label="판매 건수" value={n(s.licenses.count, '건')} />
          <Stat label="판매 금액 누계" value={krw(s.licenses.salesKrw)} />
          <Stat label="권리자 정산 적립 누계" value={krw(s.licenses.toRightsHoldersKrw)} />
        </Group>
        <Group title="기여·용역비" note="용역비는 원천징수 전 금액이에요.">
          <Stat label="검증된 기여" value={n(s.contributions.verified, '건')} />
          <Stat label="제출된 기여" value={n(s.contributions.submitted, '건')} />
          <Stat label="용역비 누계(세전)" value={krw(s.contributions.rewardsGrossKrw)} />
          <Stat label="원천징수 누계" value={krw(s.contributions.withholdingKrw)} />
          <Stat label="모집 중인 퀘스트" value={n(s.contributions.openQuests, '개')} />
        </Group>
        <Group title="가맹점">
          <Stat label="입점 신청" value={n(s.merchants.registered, '곳')} />
          <Stat label="입점 완료" value={n(s.merchants.active, '곳')} />
        </Group>
        <Group title="분쟁 처리">
          <Stat label="검토 중" value={n(s.disputes.open, '건')} />
          <Stat label="인용(판매 정지)" value={n(s.disputes.upheld, '건')} />
          <Stat label="기각" value={n(s.disputes.dismissed, '건')} />
        </Group>
        <Group title="출금" note="출금은 재무 담당자 2인이 승인한 뒤 지급돼요.">
          <Stat label="지급 건수" value={n(s.payouts.count, '건')} />
          <Stat label="지급액 누계" value={krw(s.payouts.paidKrw)} />
        </Group>
      </div>
      <section className="card stack" aria-labelledby="anchor-title">
        <h2 id="anchor-title" style={{ fontSize: 'var(--fs-lg)' }}>블록체인 기록</h2>
        <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>이용권 계약과 검증된 기여의 해시만 묶어서 기록해요. 개인정보와 금액은 체인에 올리지 않아요.</p>
        <Stat label="기록 묶음 수" value={n(s.anchoring.batches, '회')} />
        {latest ? (
          <dl className="kv">
            <dt>최근 기록 시각</dt><dd>{dateTime(latest.createdAt)}</dd>
            <dt>Merkle root</dt><dd className="mono break">{latest.merkleRoot}</dd>
            <dt>체인 기록 번호</dt><dd className="mono break">{latest.chainTxRef}</dd>
            <dt>묶인 기록 수</dt><dd className="num">{latest.leafCount}건</dd>
          </dl>
        ) : (
          <p className="faint">아직 기록된 묶음이 없어요.</p>
        )}
      </section>
    </>
  );
}

export default function TransparencyPage() {
  const res = useOp('transparency.stats', {});
  return (
    <div className="page">
      <PageHeader eyebrow="투명성" title="운영 현황을 그대로 공개해요" desc="IP 등록, 이용권 판매, 용역비 지급, 분쟁 처리 기록을 집계해 보여 드려요." />
      <Async {...res} lines={6}>{(s) => <Board s={s} />}</Async>
    </div>
  );
}
