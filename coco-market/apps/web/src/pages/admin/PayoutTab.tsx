import { useState } from 'react';
import { useSession } from '../../state/session';
import { useAction } from '../../state/useOp';
import { ErrorNotice, Pill } from '../../ui/kit';
import { dateTime, krw } from '../../ui/format';
import { ConfirmButton, Flash, QueryView, ReloadButton, TabIntro, type OpQuery } from './shared';

export function PayoutTab({ q }: { q: OpQuery<'finance.payoutQueue'> }) {
  const { user } = useSession();
  const approve = useAction('finance.approvePayout');
  const reject = useAction('finance.rejectPayout');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const onApprove = async (id: string, name: string) => {
    reject.clearError();
    setBusyId(id);
    const r = await approve.run({ payoutId: id });
    setBusyId(null);
    if (!r) return;
    setFlash(r.status === 'PAID' ? `${name}님 출금 ${krw(r.amountKrw)}을 지급 처리했어요.` : `${name}님 출금에 1차 승인했어요. 다른 담당자의 승인이 필요해요.`);
    void q.reload();
  };

  const onReject = async (id: string, name: string) => {
    approve.clearError();
    setBusyId(id);
    const r = await reject.run({ payoutId: id });
    setBusyId(null);
    if (!r) return;
    setFlash(`${name}님 출금 신청을 반려했어요. 금액은 정산 계정에 그대로 남아요.`);
    void q.reload();
  };

  return (
    <>
      <TabIntro title="출금 승인" actions={<ReloadButton q={q} />} />
      <div className="notice" role="note">
        <b>2인 승인 규칙</b>
        <span>서로 다른 재무 담당자 두 명이 승인해야 지급돼요. 첫 승인은 대기 상태로 남고, 두 번째 승인 때 원장에 지급이 기록돼요. 본인 출금은 승인할 수 없어요.</span>
      </div>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}
      <ErrorNotice error={approve.error ?? reject.error} />
      <QueryView q={q} isEmpty={(d) => d.length === 0} emptyTitle="대기 중인 출금 신청이 없어요">
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>신청자</th>
                  <th className="r">금액</th>
                  <th>신청 시각</th>
                  <th>승인</th>
                  <th>상태</th>
                  <th><span className="sr-only">처리</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ payout: p, userName, userEmail, hold, approvalsRequired }) => {
                  const mine = !!user && p.userId === user.id;
                  const already = !!user && p.approvals.includes(user.id);
                  const busy = busyId === p.id;
                  const name = userName || userEmail;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div>{userName || '—'}</div>
                        <div className="faint">{userEmail}</div>
                      </td>
                      <td className="r num nowrap">{krw(p.amountKrw)}</td>
                      <td className="nowrap">{dateTime(p.createdAt)}</td>
                      <td className="num nowrap">{p.approvals.length}/{approvalsRequired}</td>
                      <td>
                        {hold ? (
                          <div className="stack-sm">
                            <Pill tone="warn">보류</Pill>
                            <span className="faint">{hold}</span>
                          </div>
                        ) : mine ? (
                          <Pill>본인 신청</Pill>
                        ) : already ? (
                          <Pill tone="info">다른 담당자 승인 대기</Pill>
                        ) : (
                          <Pill tone="brand">승인 가능</Pill>
                        )}
                      </td>
                      <td>
                        <div className="admin-actions" style={{ flexWrap: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy || !!hold || mine || already}
                            title={hold ? '분쟁 처리 중이라 승인할 수 없어요' : undefined}
                            onClick={() => void onApprove(p.id, name)}
                          >
                            승인
                          </button>
                          <ConfirmButton label="반려" question={`${name}님의 출금 신청을 반려할까요?`} confirmLabel="반려" disabled={busy} onConfirm={() => void onReject(p.id, name)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}
