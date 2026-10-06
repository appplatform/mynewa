import type { PublicUser, Role } from '@coco/core';
import { useState } from 'react';
import { useSession } from '../../state/session';
import { useAction, useOp } from '../../state/useOp';
import { ErrorNotice, Pill } from '../../ui/kit';
import { date } from '../../ui/format';
import { ConfirmButton, Flash, QueryView, ReloadButton, ROLE_LABEL, TabIntro } from './shared';

const EDITABLE: Role[] = ['REVIEWER', 'COMPLIANCE_OFFICER', 'FINANCE', 'SUPER_ADMIN'];

export function UsersTab() {
  const q = useOp('admin.users', {});
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <>
      <TabIntro title="회원·역할" actions={<ReloadButton q={q} />}>
        운영 역할을 부여하거나 거둬요. 모든 회원은 기본으로 일반 회원 역할을 가져요. 변경 내역은 감사 로그에 남아요.
      </TabIntro>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}
      <QueryView q={q} isEmpty={(d) => d.length === 0} emptyTitle="회원이 없어요" lines={5}>
        {(users) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>본인확인</th>
                  <th>역할</th>
                  <th><span className="sr-only">저장</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={`${u.id}:${u.roles.join(',')}`}
                    u={u}
                    onSaved={(msg) => { setFlash(msg); void q.reload(); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}

function UserRow({ u, onSaved }: { u: PublicUser; onSaved: (msg: string) => void }) {
  const { user: me, refresh } = useSession();
  const save = useAction('admin.setRoles');
  const [roles, setRoles] = useState<Role[]>(u.roles);
  const isMe = me?.id === u.id;

  const dirty = EDITABLE.some((r) => roles.includes(r) !== u.roles.includes(r));
  const toggle = (r: Role, on: boolean) => setRoles((cur) => (on ? [...cur, r] : cur.filter((x) => x !== r)));

  const submit = async () => {
    const next: Role[] = ['USER', ...roles.filter((r) => r !== 'USER')];
    const r = await save.run({ userId: u.id, roles: next });
    if (!r) return;
    onSaved(`${u.name}님의 역할을 저장했어요.`);
    if (isMe) void refresh();
  };

  return (
    <tr>
      <td className="nowrap">{u.name}{isMe && <span className="faint"> (나)</span>}</td>
      <td>
        <div>{u.email}</div>
        <div className="faint">가입 {date(u.createdAt)}</div>
      </td>
      <td className="nowrap">{u.identityVerified ? <Pill tone="ok">완료</Pill> : <Pill>미완료</Pill>}</td>
      <td>
        <div className="admin-roles" role="group" aria-label={`${u.name} 역할`}>
          {EDITABLE.map((r) => (
            <label key={r} className="check">
              <input type="checkbox" checked={roles.includes(r)} disabled={save.pending} onChange={(e) => toggle(r, e.target.checked)} />
              {ROLE_LABEL[r]}
            </label>
          ))}
        </div>
        {save.error && <ErrorNotice error={save.error} />}
      </td>
      <td>
        <ConfirmButton className="btn btn-primary btn-sm" label={save.pending ? '저장 중…' : '저장'} question="내 최고 관리자 역할을 거두면 이 화면에 다시 들어올 수 없어요. 저장할까요?" confirmLabel="저장" skip={!(isMe && u.roles.includes('SUPER_ADMIN') && !roles.includes('SUPER_ADMIN'))} disabled={!dirty || save.pending} onConfirm={() => void submit()} />
      </td>
    </tr>
  );
}
