import type { Role } from '@coco/core';
import { useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useSession } from '../../state/session';
import { useOp } from '../../state/useOp';
import { Gate, Loading, PageHeader, Pill } from '../../ui/kit';
import { ROLE_LABEL } from './shared';
import { IpReviewTab } from './IpReviewTab';
import { ContributionTab } from './ContributionTab';
import { PayoutTab } from './PayoutTab';
import { LedgerTab } from './LedgerTab';
import { DisputeTab } from './DisputeTab';
import { ComplianceTab } from './ComplianceTab';
import { AuditTab } from './AuditTab';
import { QuestAdminTab } from './QuestAdminTab';
import { UsersTab } from './UsersTab';
import { AnchorTab } from './AnchorTab';
import './admin.css';

type TabId = 'ip' | 'contrib' | 'payout' | 'ledger' | 'disputes' | 'compliance' | 'audit' | 'quests' | 'users' | 'anchor';

const TABS: { id: TabId; label: string; role: Role }[] = [
  { id: 'ip', label: 'IP 심사', role: 'REVIEWER' },
  { id: 'contrib', label: '기여 검증', role: 'REVIEWER' },
  { id: 'payout', label: '출금 승인', role: 'FINANCE' },
  { id: 'ledger', label: '원장', role: 'FINANCE' },
  { id: 'disputes', label: '분쟁', role: 'COMPLIANCE_OFFICER' },
  { id: 'compliance', label: '컴플라이언스', role: 'COMPLIANCE_OFFICER' },
  { id: 'audit', label: '감사 로그', role: 'COMPLIANCE_OFFICER' },
  { id: 'quests', label: '퀘스트 관리', role: 'SUPER_ADMIN' },
  { id: 'users', label: '회원·역할', role: 'SUPER_ADMIN' },
  { id: 'anchor', label: '블록체인 기록', role: 'SUPER_ADMIN' },
];

const OPS_ROLES: Role[] = ['REVIEWER', 'COMPLIANCE_OFFICER', 'FINANCE'];

export default function AdminPage() {
  const { user, loading, hasRole } = useSession();
  const [params, setParams] = useSearchParams();

  const isReviewer = hasRole('REVIEWER');
  const isFinance = hasRole('FINANCE');
  const isCompliance = hasRole('COMPLIANCE_OFFICER');

  // 큐는 여기서 불러와 탭 배지와 탭 본문이 같이 쓴다.
  const ipQ = useOp('review.ipQueue', {}, { skip: !isReviewer });
  const contribQ = useOp('review.contributionQueue', {}, { skip: !isReviewer });
  const payoutQ = useOp('finance.payoutQueue', {}, { skip: !isFinance });
  const disputeQ = useOp('disputes.queue', {}, { skip: !isCompliance });

  const allowed = TABS.filter((t) => hasRole(t.role));
  const requested = params.get('tab');
  const active: TabId | null = allowed.find((t) => t.id === requested)?.id ?? allowed[0]?.id ?? null;

  // 권한 밖이거나 잘못된 ?tab= 값은 첫 번째 허용 탭으로 정리한다.
  useEffect(() => {
    if (active && requested !== active) {
      setParams((p) => { const n = new URLSearchParams(p); n.set('tab', active); return n; }, { replace: true });
    }
  }, [active, requested, setParams]);

  if (loading) return <div className="page"><Loading /></div>;
  if (!user) return <div className="page"><Gate ok={false} need="login">{null}</Gate></div>;
  if (!hasRole(...OPS_ROLES)) return <div className="page"><Gate ok={false} need="role">{null}</Gate></div>;

  const counts: Partial<Record<TabId, number | undefined>> = {
    ip: ipQ.data?.length,
    contrib: contribQ.data?.length,
    payout: payoutQ.data?.length,
    disputes: disputeQ.data?.filter((d) => d.dispute.status === 'OPEN').length,
  };

  const select = (id: TabId) =>
    setParams((p) => { const n = new URLSearchParams(p); n.set('tab', id); return n; });

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = allowed.findIndex((t) => t.id === active);
    const next = allowed[(i + (e.key === 'ArrowRight' ? 1 : -1) + allowed.length) % allowed.length];
    if (!next) return;
    e.preventDefault();
    select(next.id);
    document.getElementById(`admin-tab-${next.id}`)?.focus();
  };

  let body: ReactNode = null;
  switch (active) {
    case 'ip': body = <IpReviewTab q={ipQ} />; break;
    case 'contrib': body = <ContributionTab q={contribQ} />; break;
    case 'payout': body = <PayoutTab q={payoutQ} />; break;
    case 'ledger': body = <LedgerTab />; break;
    case 'disputes': body = <DisputeTab q={disputeQ} />; break;
    case 'compliance': body = <ComplianceTab />; break;
    case 'audit': body = <AuditTab />; break;
    case 'quests': body = <QuestAdminTab />; break;
    case 'users': body = <UsersTab />; break;
    case 'anchor': body = <AnchorTab />; break;
    default: body = null;
  }

  const myRoles = user.roles.filter((r) => r !== 'USER');

  return (
    <div className="page">
      <PageHeader
        eyebrow="관리자 백오피스"
        title="운영 콘솔"
        desc="심사·검증·정산·컴플라이언스 업무를 처리해요. 모든 처리는 감사 로그에 남아요."
        actions={<div className="row">{myRoles.map((r) => <Pill key={r} tone="brand">{ROLE_LABEL[r]}</Pill>)}</div>}
      />
      <div className="stack-lg">
        <div className="admin-tabs" role="tablist" aria-label="운영 업무" onKeyDown={onTabKey}>
          {allowed.map((t) => {
            const n = counts[t.id];
            const selected = t.id === active;
            return (
              <button
                key={t.id}
                id={`admin-tab-${t.id}`}
                type="button"
                role="tab"
                className="admin-tab"
                aria-selected={selected}
                aria-controls={`admin-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.id)}
              >
                {t.label}
                {n !== undefined && (
                  <span className={`admin-badge${n > 0 ? ' has' : ''}`} aria-label={`대기 ${n}건`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        {active && (
          <section
            className="admin-panel"
            role="tabpanel"
            id={`admin-panel-${active}`}
            aria-labelledby={`admin-tab-${active}`}
          >
            {body}
          </section>
        )}
      </div>
    </div>
  );
}
