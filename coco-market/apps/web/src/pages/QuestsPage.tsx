import { Link } from 'react-router';
import { useSession } from '../state/session';
import { useOp } from '../state/useOp';
import { date, krw } from '../ui/format';
import { Empty, PageHeader, Pill } from '../ui/kit';
import { Async } from './_parts/Async';
import { CONTRIB_STATUS } from './_parts/labels';
import { QuestCard } from './_parts/QuestCard';
import { TierBoard } from './_parts/TierBoard';
import './pages.css';

function MyContributions() {
  const mine = useOp('quests.mine', {});
  return (
    <>
      <Async {...mine} lines={4}>{(d) => <TierBoard progress={d.progress} />}</Async>
      <section className="stack" aria-labelledby="mine-title">
        <h2 id="mine-title">내 기여 내역</h2>
        <Async {...mine}>
          {(d) =>
            d.contributions.length === 0 ? (
              <Empty title="아직 제출한 기여가 없어요">아래 퀘스트 중 하나를 골라 직접 수행하고 결과를 제출해 보세요.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>제출일</th><th>퀘스트</th><th>상태</th><th className="r">지급액(세후)</th></tr>
                  </thead>
                  <tbody>
                    {d.contributions.map(({ contribution: c, questTitle, reward }) => {
                      const st = CONTRIB_STATUS[c.status];
                      return (
                        <tr key={c.id}>
                          <td className="num">{date(c.createdAt)}</td>
                          <td>
                            {questTitle}
                            {c.reviewNote && <div className="faint">{c.reviewNote}</div>}
                          </td>
                          <td><Pill tone={st.tone}>{st.label}</Pill></td>
                          <td className="r num">{reward ? krw(reward.netKrw) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Async>
        <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>지급액은 원천징수 후 금액이에요. 정산 계정에 쌓이고 <Link to="/me/wallet">정산·출금</Link>에서 출금할 수 있어요.</p>
      </section>
    </>
  );
}

export default function QuestsPage() {
  const { user } = useSession();
  const list = useOp('quests.list', {});
  return (
    <div className="page">
      <PageHeader
        eyebrow="기여 퀘스트"
        title="직접 한 일만큼 용역비를 받아요"
        desc="가게 입점 안내, 광고 확인, 현장 지원처럼 본인이 직접 수행한 일을 제출하면 검증 후 용역비가 지급돼요. 용역비는 원천징수 후 정산 계정에 쌓여요."
      />
      {!user && (
        <div className="panel row-between">
          <span className="muted">로그인하면 내 기여 배지와 제출 내역을 볼 수 있어요.</span>
          <Link className="btn btn-sm" to="/login">로그인</Link>
        </div>
      )}
      <section className="stack" aria-labelledby="board-title">
        <h2 id="board-title">모집 중인 퀘스트</h2>
        <Async {...list}>
          {(d) =>
            d.quests.length === 0 ? (
              <Empty title="지금 모집 중인 퀘스트가 없어요">새 퀘스트가 열리면 여기에 보여요.</Empty>
            ) : (
              <div className="grid-cards">{d.quests.map((q) => <QuestCard key={q.quest.id} item={q} showEligibility={!!user} />)}</div>
            )
          }
        </Async>
      </section>
      {user && <MyContributions />}
    </div>
  );
}
