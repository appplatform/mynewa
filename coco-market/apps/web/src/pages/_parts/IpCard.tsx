import type { OpOutput } from '@coco/core';
import { Link } from 'react-router';
import { IP_TYPE_LABEL, krw } from '../../ui/format';
import { Pill } from '../../ui/kit';

export type IpSummary = OpOutput<'catalog.listIps'>[number];

export function IpCard({ ip }: { ip: IpSummary }) {
  return (
    <Link to={`/ips/${ip.id}`} className="card card-link">
      <div className="row" style={{ gap: 6 }}>
        <Pill tone="brand">{IP_TYPE_LABEL[ip.type]}</Pill>
        {ip.onHold && <Pill tone="warn">분쟁 처리 중 · 판매 일시 중지</Pill>}
      </div>
      <h3>{ip.title}</h3>
      <p className="muted clamp-2">{ip.summary}</p>
      <div className="stack-sm" style={{ gap: 2 }}>
        <span className="faint">
          권리자 {ip.holderName}
          {ip.coHolderCount > 0 && ` 외 공동권리자 ${ip.coHolderCount}명`}
        </span>
        {ip.productCount > 0 ? (
          <span className="num">
            {ip.productCount}개 이용권 · 최저 <b>{krw(ip.fromPriceKrw)}</b>부터
          </span>
        ) : (
          <span className="faint">지금 판매 중인 이용권이 없어요</span>
        )}
      </div>
    </Link>
  );
}
