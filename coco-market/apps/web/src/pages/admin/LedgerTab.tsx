import { useOp } from '../../state/useOp';
import { Pill } from '../../ui/kit';
import { krw } from '../../ui/format';
import { QueryView, ReloadButton, TabIntro } from './shared';

const LEGEND: { prefix: string; desc: string }[] = [
  { prefix: 'clearing:', desc: '결제·이체 정산 자산 계정이에요. clearing:pg는 PG로 들어온 결제 대금, clearing:bank는 은행으로 나간 지급이에요.' },
  { prefix: 'payable:user:', desc: '회원에게 지급할 금액(부채)이에요. 뒤에 회원 ID가 붙어요.' },
  { prefix: 'tax:', desc: '원천징수해 보관 중인 세금(부채)이에요.' },
  { prefix: 'revenue:', desc: '플랫폼 수수료, 가맹점 가입비 같은 플랫폼 수입이에요.' },
  { prefix: 'expense:', desc: '퀘스트 용역비, 영업대행 수수료 같은 비용이에요.' },
];

function AccountName({ account }: { account: string }) {
  const m = /^payable:user:(.+)$/.exec(account);
  if (m?.[1]) {
    return <span className="mono" title={account}>payable:user:{m[1].slice(0, 8)}…</span>;
  }
  return <span className="mono">{account}</span>;
}

export function LedgerTab() {
  const q = useOp('finance.trialBalance', {});

  return (
    <>
      <TabIntro title="원장 시산표" actions={<ReloadButton q={q} />}>
        모든 금액은 복식부기 분개에서 계산해요. 잔액 컬럼을 따로 두지 않아요.
      </TabIntro>
      <QueryView q={q} isEmpty={(d) => d.rows.length === 0} emptyTitle="아직 기록된 분개가 없어요" lines={5}>
        {(tb) => (
          <div className="stack">
            <div className="row">
              {tb.balanced ? <Pill tone="ok">차변 = 대변 · 일치</Pill> : <Pill tone="bad">차변 ≠ 대변 · 불일치</Pill>}
              <span className="faint">계정 {tb.rows.length}개</span>
            </div>
            {!tb.balanced && (
              <div className="notice notice-bad" role="alert">
                차변 합계와 대변 합계가 달라요. 지급 처리를 멈추고 최근 분개를 확인해 주세요.
              </div>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>계정</th>
                    <th className="r">차변</th>
                    <th className="r">대변</th>
                    <th className="r">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.account}>
                      <td><AccountName account={r.account} /></td>
                      <td className="r num nowrap">{krw(r.debit)}</td>
                      <td className="r num nowrap">{krw(r.credit)}</td>
                      <td className="r num nowrap">{krw(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>합계</td>
                    <td className="r num nowrap">{krw(tb.totals.debit)}</td>
                    <td className="r num nowrap">{krw(tb.totals.credit)}</td>
                    <td className="r">{tb.balanced ? <Pill tone="ok">일치</Pill> : <Pill tone="bad">불일치</Pill>}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </QueryView>
      <section className="panel stack-sm" aria-labelledby="ledger-legend">
        <h3 id="ledger-legend" className="label">계정 이름 읽는 법</h3>
        <dl className="admin-dl">
          {LEGEND.map((l) => (
            <div key={l.prefix} style={{ display: 'contents' }}>
              <dt className="mono">{l.prefix}</dt>
              <dd>{l.desc}</dd>
            </div>
          ))}
        </dl>
        <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
          잔액은 부채·수입 계정(payable, tax, revenue)은 대변 − 차변, 자산·비용 계정(clearing, expense)은 차변 − 대변으로 계산해요.
        </p>
      </section>
    </>
  );
}
