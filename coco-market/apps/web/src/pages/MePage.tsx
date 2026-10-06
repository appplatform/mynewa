import { Link } from 'react-router';
import { useSession } from '../state/session';
import { useOp } from '../state/useOp';
import { date, tierName } from '../ui/format';
import { Gate, Loading, PageHeader, Pill } from '../ui/kit';
import { CopyCode } from './_parts/CopyCode';
import { ROLE_LABEL } from './_parts/labels';
import './pages.css';

function MyBadge() {
  const mine = useOp('quests.mine', {});
  if (!mine.data) return null;
  return <Pill tone="brand">기여 배지 · {tierName(mine.data.progress.tier)}</Pill>;
}

function Profile() {
  const { user, hasRole } = useSession();
  if (!user) return null;
  const staff = hasRole('REVIEWER', 'COMPLIANCE_OFFICER', 'FINANCE');
  const links = [
    { to: '/me/licenses', title: '내 이용권', desc: '구매한 이용권과 계약서' },
    { to: '/me/wallet', title: '정산·출금', desc: '용역비·판매 정산 내역과 출금 신청' },
    { to: '/quests', title: '내 기여', desc: '기여 배지와 제출 내역' },
    { to: '/studio', title: '권리자 스튜디오', desc: '내 IP와 이용권 상품 관리' },
    { to: '/merchant', title: '가맹점', desc: '가게 입점과 내가 도운 가게' },
    ...(staff ? [{ to: '/admin', title: '운영 콘솔', desc: '심사·검증·승인 업무' }] : []),
  ];
  return (
    <div className="split">
      <section className="card stack" aria-labelledby="profile-title">
        <h2 id="profile-title" style={{ fontSize: 'var(--fs-lg)' }}>내 정보</h2>
        <dl className="kv">
          <dt>이름</dt><dd>{user.name}</dd>
          <dt>이메일</dt><dd className="break">{user.email}</dd>
          <dt>가입일</dt><dd className="num">{date(user.createdAt)}</dd>
          <dt>본인확인</dt>
          <dd>{user.identityVerified ? <Pill tone="ok">완료</Pill> : <><Pill tone="warn">필요</Pill> <Link to="/verify">본인확인하기</Link></>}</dd>
          <dt>역할</dt>
          <dd className="row" style={{ gap: 6 }}>{user.roles.map((r) => <Pill key={r}>{ROLE_LABEL[r]}</Pill>)}<MyBadge /></dd>
        </dl>
        <CopyCode label="내 온보딩 코드" value={user.onboardingCode} />
        <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>온보딩 코드는 내가 직접 입점을 도운 가게와 나를 연결하는 데만 써요. 다른 회원과의 관계는 만들지 않아요.</p>
      </section>
      <nav className="stack-sm" aria-label="내 메뉴">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="card card-link" style={{ gap: 2 }}>
            <b>{l.title}</b>
            <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>{l.desc}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function MePage() {
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="내 정보" title={user ? `${user.name}님` : '내 정보'} />
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><Profile /></Gate>}
    </div>
  );
}
