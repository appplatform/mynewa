import { Link } from 'react-router';
import { useSession } from '../state/session';
import { useOp } from '../state/useOp';
import { date, krw } from '../ui/format';
import { Empty, Gate, Loading, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import { GRANT_STATUS } from './_parts/labels';
import './pages.css';

function LicenseList() {
  const res = useOp('license.mine', {});
  return (
    <Async {...res}>
      {(list) =>
        list.length === 0 ? (
          <Empty title="아직 구매한 이용권이 없어요" action={<Link className="btn btn-primary" to="/ips">IP 둘러보기</Link>}>
            필요한 IP를 찾아 정해진 범위만큼 빌려 써 보세요.
          </Empty>
        ) : (
          <div className="grid-cards">
            {list.map(({ grant: g, ipTitle, productName }) => {
              const st = GRANT_STATUS[g.status];
              return (
                <Link key={g.id} to={`/me/licenses/${g.id}`} className="card card-link">
                  <div className="row-between">
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <span className="num">{krw(g.priceKrw)}</span>
                  </div>
                  <h3>{ipTitle || '삭제된 IP'}</h3>
                  <p className="muted">{productName}</p>
                  <span className="faint num">{date(g.startsAt)} ~ {date(g.endsAt)}</span>
                </Link>
              );
            })}
          </div>
        )
      }
    </Async>
  );
}

export default function LicensesPage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="내 정보" title="내 이용권" desc="구매한 이용권과 계약서를 확인해요. 이용권은 양도하거나 되팔 수 없어요." />
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><LicenseList /></Gate>}
    </div>
  );
}
