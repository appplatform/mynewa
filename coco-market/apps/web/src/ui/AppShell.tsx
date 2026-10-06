import { DEMO_PASSWORD, DEMO_USERS } from '@coco/core';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../api';
import { useSession } from '../state/session';
import { Logo } from './Logo';
import './shell.css';

const NAV = [
  { to: '/ips', label: 'IP 둘러보기' },
  { to: '/quests', label: '기여 퀘스트' },
  { to: '/merchant', label: '가맹점' },
  { to: '/studio', label: '권리자 스튜디오' },
  { to: '/transparency', label: '투명성' },
];

function DemoBar() {
  const { user, login, refresh } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (api.mode !== 'demo') return null;
  return (
    <div className="demo-bar" role="region" aria-label="데모 모드 안내">
      <span><b>데모 모드</b> 결제·본인확인·블록체인 기록은 모의로 동작하고, 데이터는 이 브라우저에만 저장됩니다.</span>
      <span className="row" style={{ gap: 8 }}>
        <label className="sr-only" htmlFor="demo-switch">데모 계정 전환</label>
        <select
          id="demo-switch"
          className="select demo-select"
          value={user?.email ?? ''}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            try { await login(e.target.value, DEMO_PASSWORD); navigate('/'); } finally { setBusy(false); }
          }}
        >
          <option value="" disabled>계정 바꿔 보기</option>
          {DEMO_USERS.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
        </select>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await api.reset?.(); await refresh(); navigate('/'); } finally { setBusy(false); }
          }}
        >
          데이터 초기화
        </button>
      </span>
    </div>
  );
}

function UserMenu() {
  const { user, logout, hasRole } = useSession();
  const navigate = useNavigate();
  if (!user) {
    return (
      <div className="row" style={{ gap: 8 }}>
        <Link className="btn btn-ghost btn-sm" to="/login">로그인</Link>
        <Link className="btn btn-primary btn-sm" to="/signup">가입하기</Link>
      </div>
    );
  }
  const staff = hasRole('REVIEWER', 'COMPLIANCE_OFFICER', 'FINANCE');
  return (
    <details className="user-menu">
      <summary className="btn btn-sm">
        <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
        <span className="user-name">{user.name}</span>
      </summary>
      <div className="menu-pop" role="menu">
        {!user.identityVerified && <Link to="/verify" role="menuitem" className="menu-warn">본인확인 필요</Link>}
        <Link to="/me" role="menuitem">내 정보</Link>
        <Link to="/me/licenses" role="menuitem">내 이용권</Link>
        <Link to="/me/wallet" role="menuitem">정산·출금</Link>
        {staff && <Link to="/admin" role="menuitem">운영 콘솔</Link>}
        <button type="button" role="menuitem" onClick={async () => { await logout(); navigate('/'); }}>로그아웃</button>
      </div>
    </details>
  );
}

export function AppShell() {
  return (
    <div className="shell">
      <a className="skip" href="#main">본문 바로가기</a>
      <DemoBar />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="CO-CO Market 홈">
            <Logo />
            <span>CO-CO <em>Market</em></span>
          </Link>
          <nav className="nav" aria-label="주요 메뉴">
            {NAV.map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <div className="stack-sm">
            <div className="row" style={{ gap: 8 }}><Logo size={20} /><b>CO-CO Market</b><span className="faint">메타콤 운영 (데모)</span></div>
            <p className="faint">CO-CO Market은 통신판매중개자로서 IP 이용권 거래의 당사자가 아니며, 이용권의 내용과 권리 보증은 각 권리자에게 있습니다.</p>
            <p className="faint">이 플랫폼의 이용권은 IP를 정해진 범위에서 쓸 수 있는 권리입니다. 투자 상품이 아니며, 다른 회원에게 되팔 수 없고, 수익을 나눠 받는 권리가 없습니다.</p>
          </div>
          <nav className="footer-links" aria-label="정책">
            <Link to="/legal/terms">이용약관</Link>
            <Link to="/legal/privacy">개인정보처리방침</Link>
            <Link to="/legal/gates">기능별 법적 검토 현황</Link>
            <Link to="/report">권리 침해 신고</Link>
          </nav>
        </div>
      </footer>
      <nav className="tabbar" aria-label="하단 메뉴">
        <NavLink to="/" end>홈</NavLink>
        <NavLink to="/ips">둘러보기</NavLink>
        <NavLink to="/quests">퀘스트</NavLink>
        <NavLink to="/me">내 정보</NavLink>
      </nav>
    </div>
  );
}
