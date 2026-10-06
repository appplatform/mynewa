import { USAGE_LABEL, type LicenseScope } from '@coco/core';
import { Pill } from '../../ui/kit';

export const LICENSE_SCOPE_LINE = {
  buys: '정해진 용도·기간의 IP 이용권',
  notBuys: 'IP 지분·수익 분배권·재판매 권리',
};

export function ExclusivePill({ exclusive }: { exclusive: boolean }) {
  return exclusive ? <Pill tone="info">독점</Pill> : <Pill>비독점</Pill>;
}

/** 이용 범위(용도·지역·기간·독점·매체) */
export function ScopeList({ scope, period }: { scope: LicenseScope; period?: string }) {
  return (
    <dl className="kv">
      <dt>용도</dt>
      <dd>{scope.usages.map((u) => USAGE_LABEL[u]).join(', ')}</dd>
      <dt>지역</dt>
      <dd>{scope.territory}</dd>
      <dt>기간</dt>
      <dd className="num">{period ?? `${scope.termMonths}개월`}</dd>
      <dt>독점 여부</dt>
      <dd>{scope.exclusive ? '독점 (같은 기간·용도로 다른 사람에게 허락하지 않아요)' : '비독점'}</dd>
      <dt>매체</dt>
      <dd>{scope.media.length ? scope.media.join(', ') : '용도에 필요한 범위'}</dd>
    </dl>
  );
}
