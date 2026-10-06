import type { OpOutput } from '@coco/core';
import { Link } from 'react-router';
import { kindName, krw, tierName } from '../../ui/format';
import { Pill } from '../../ui/kit';
import { incomeNote } from './labels';

export type QuestItem = OpOutput<'quests.list'>['quests'][number];

export function QuestCard({ item, showEligibility = true }: { item: QuestItem; showEligibility?: boolean }) {
  const q = item.quest;
  return (
    <Link to={`/quests/${q.id}`} className="card card-link">
      <div className="row" style={{ gap: 6 }}>
        <Pill tone="brand">{kindName(q.kind)}</Pill>
        {showEligibility && (item.eligible ? <Pill tone="ok">수행 가능</Pill> : <Pill>등급 조건 미달</Pill>)}
      </div>
      <h3>{q.title}</h3>
      <div className="stack-sm" style={{ gap: 2 }}>
        <span>
          용역비 <b className="num">{krw(q.rewardKrw)}</b> <span className="faint">(세전 · {incomeNote(q.incomeType)})</span>
        </span>
        <span className="faint">
          {tierName(q.minTier)} 이상 · 남은 모집 <span className="num">{item.remaining.toLocaleString('ko-KR')}</span>건
        </span>
      </div>
    </Link>
  );
}
