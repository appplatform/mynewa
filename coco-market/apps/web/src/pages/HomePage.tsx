import { Link } from 'react-router';
import { useOp } from '../state/useOp';
import { dateTime, krw } from '../ui/format';
import { Empty, Stat } from '../ui/kit';
import { Async } from './_parts/Async';
import { IpCard } from './_parts/IpCard';
import { QuestCard } from './_parts/QuestCard';
import './pages.css';

const ROLES = [
  { to: '/ips', eyebrow: '가게·기업', title: 'IP를 쓰고 싶어요', desc: '캐릭터·지도·특허를 정해진 용도와 기간만큼 빌려 써요. 계약서가 바로 발급돼요.', cta: 'IP 둘러보기' },
  { to: '/studio', eyebrow: '권리자', title: '내 IP를 빌려주고 싶어요', desc: '권리 증빙을 올리고 이용 범위와 가격을 직접 정해요. 심사를 거쳐 공개돼요.', cta: '권리자 스튜디오' },
  { to: '/quests', eyebrow: '기여자', title: '동네 일을 돕고 싶어요', desc: '가게 입점 안내, 광고 확인 같은 일을 직접 하고 용역비를 받아요.', cta: '기여 퀘스트 보기' },
];

function Hero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="eyebrow">Co-prosperity Contribution Market</div>
      <h1 id="home-title">IP를 정해진 범위로 빌려 쓰고, 동네 가게와 함께 키우는 마켓</h1>
      <p>창작자는 IP를 이용권으로 내놓고, 가게는 필요한 만큼만 빌려 써요. 동네 일을 도운 사람은 한 일만큼 용역비를 받아요.</p>
      <div className="row">
        <Link className="btn btn-primary btn-lg" to="/ips">IP 둘러보기</Link>
        <Link className="btn btn-lg" to="/transparency">운영 현황 보기</Link>
      </div>
    </section>
  );
}

function RoleEntries() {
  return (
    <section className="stack" aria-labelledby="roles-title">
      <h2 id="roles-title">어떤 일로 오셨어요?</h2>
      <div className="grid-cards">
        {ROLES.map((r) => (
          <Link key={r.to} to={r.to} className="card card-link role-card">
            <span className="eyebrow">{r.eyebrow}</span>
            <h3>{r.title}</h3>
            <p className="muted">{r.desc}</p>
            <span className="label" style={{ color: 'var(--brand)' }}>{r.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedIps() {
  const ips = useOp('catalog.listIps', {});
  return (
    <section className="stack" aria-labelledby="featured-title">
      <div className="row-between">
        <h2 id="featured-title">지금 이용할 수 있는 IP</h2>
        <Link to="/ips">전체 보기</Link>
      </div>
      <Async {...ips}>
        {(list) =>
          list.length === 0 ? (
            <Empty title="아직 공개된 IP가 없어요">심사를 마친 IP가 여기에 보여요.</Empty>
          ) : (
            <div className="grid-cards">{list.slice(0, 3).map((ip) => <IpCard key={ip.id} ip={ip} />)}</div>
          )
        }
      </Async>
    </section>
  );
}

function OpenQuests() {
  const quests = useOp('quests.list', {});
  return (
    <section className="stack" aria-labelledby="quests-title">
      <div className="row-between">
        <h2 id="quests-title">모집 중인 기여 퀘스트</h2>
        <Link to="/quests">퀘스트 보드</Link>
      </div>
      <p className="muted">본인이 직접 한 일에만 용역비가 지급돼요. 다른 사람을 데려오는 것으로는 받을 수 없어요.</p>
      <Async {...quests}>
        {(d) =>
          d.quests.length === 0 ? (
            <Empty title="지금 모집 중인 퀘스트가 없어요">새 퀘스트가 열리면 여기에 보여요.</Empty>
          ) : (
            <div className="grid-cards">{d.quests.slice(0, 3).map((q) => <QuestCard key={q.quest.id} item={q} showEligibility={false} />)}</div>
          )
        }
      </Async>
    </section>
  );
}

function TransparencyStrip() {
  const stats = useOp('transparency.stats', {});
  return (
    <section className="panel stack" aria-labelledby="tp-title">
      <div className="row-between">
        <h2 id="tp-title" style={{ fontSize: 'var(--fs-lg)' }}>지금까지의 운영 기록</h2>
        <Link to="/transparency">자세히 보기</Link>
      </div>
      <Async {...stats} lines={2}>
        {(s) => (
          <>
            <div className="stat-strip">
              <Stat label="판매 중인 IP" value={`${s.ips.active}개`} />
              <Stat label="이용권 판매" value={`${s.licenses.count.toLocaleString('ko-KR')}건`} />
              <Stat label="권리자 정산 적립 누계" value={krw(s.licenses.toRightsHoldersKrw)} />
              <Stat label="검증된 기여" value={`${s.contributions.verified.toLocaleString('ko-KR')}건`} />
            </div>
            <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              기준일 {dateTime(s.asOf)} · 과거 집계치만 보여 드려요. 앞으로의 수익이나 가격은 예측하지 않아요.
            </p>
          </>
        )}
      </Async>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="page">
      <Hero />
      <RoleEntries />
      <FeaturedIps />
      <OpenQuests />
      <TransparencyStrip />
    </div>
  );
}
