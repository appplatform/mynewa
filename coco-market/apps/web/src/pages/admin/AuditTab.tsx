import { useOp } from '../../state/useOp';
import { dateTime } from '../../ui/format';
import { QueryView, ReloadButton, shortId, shortTarget, TabIntro } from './shared';

const LIMIT = 200;

function shortDetail(detail: string): string {
  if (!detail || detail === '{}') return '—';
  return detail.length > 80 ? `${detail.slice(0, 80)}…` : detail;
}

export function AuditTab() {
  const q = useOp('audit.list', { limit: LIMIT });

  return (
    <>
      <TabIntro title="감사 로그" actions={<ReloadButton q={q} />}>
        모든 운영 행위가 순서대로 기록돼요. 각 항목은 앞 항목의 해시를 이어 받아서, 중간에 지우거나 고치면 체인이 끊겨요.
      </TabIntro>
      <QueryView q={q} isEmpty={(d) => d.rows.length === 0} emptyTitle="아직 기록이 없어요" lines={6}>
        {({ rows, chain }) => (
          <div className="stack">
            {chain.ok ? (
              <div className="notice notice-ok" role="status">
                <b>해시 체인 온전 · {chain.count.toLocaleString('ko-KR')}건</b>
                <span>처음부터 끝까지 모든 항목의 해시가 이어져 있어요.</span>
              </div>
            ) : (
              <div className="notice notice-bad" role="alert">
                <b>해시 체인이 끊겼어요 · {chain.brokenAt}번 항목</b>
                <span>{chain.brokenAt}번 기록부터 내용이 바뀌었거나 빠졌을 수 있어요. 데이터 변경 이력을 바로 확인해 주세요.</span>
              </div>
            )}
            <p className="faint">최근 {Math.min(rows.length, LIMIT)}건을 최신순으로 보여요.</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="r">#</th>
                    <th>시각</th>
                    <th>행위자</th>
                    <th>작업</th>
                    <th>대상</th>
                    <th>내용</th>
                    <th>해시</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="r num">{r.seq}</td>
                      <td className="nowrap">{dateTime(r.createdAt)}</td>
                      <td className="mono nowrap" title={r.actorId ?? undefined}>{r.actorId ? shortId(r.actorId) : '시스템'}</td>
                      <td className="mono nowrap">{r.action}</td>
                      <td className="mono nowrap" title={r.target}>{shortTarget(r.target)}</td>
                      <td className="mono" title={r.detail}><span className="admin-trunc">{shortDetail(r.detail)}</span></td>
                      <td className="mono nowrap" title={r.hash}>{r.hash.slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}
