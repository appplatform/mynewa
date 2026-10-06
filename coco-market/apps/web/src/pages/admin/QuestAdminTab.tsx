import { QUEST_KINDS, TIER_ORDER, withholding, type IncomeType, type QuestKind, type Tier } from '@coco/core';
import { useState, type FormEvent } from 'react';
import { useAction, useOp } from '../../state/useOp';
import { ErrorNotice, Field, Pill } from '../../ui/kit';
import { kindName, krw, tierName } from '../../ui/format';
import { ConfirmButton, Flash, INCOME_LABEL, QueryView, ReloadButton, TabIntro } from './shared';

interface Draft {
  title: string;
  description: string;
  kind: QuestKind;
  rewardKrw: string;
  incomeType: IncomeType;
  minTier: Tier;
  capacity: string;
  dailyLimitPerUser: string;
}

const EMPTY: Draft = {
  title: '',
  description: '',
  kind: 'REVIEW',
  rewardKrw: '10000',
  incomeType: 'BUSINESS',
  minTier: 'CONSUMER',
  capacity: '100',
  dailyLimitPerUser: '1',
};

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

export function QuestAdminTab() {
  const q = useOp('quests.list', {});
  const create = useAction('quests.create');
  const close = useAction('quests.close');
  const [d, setD] = useState<Draft>(EMPTY);
  const [flash, setFlash] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const reward = int(d.rewardKrw);
  const capacity = int(d.capacity);
  const daily = int(d.dailyLimitPerUser);
  const rewardOk = reward >= 100 && reward <= 5_000_000;
  const valid =
    d.title.trim().length >= 2 && d.description.trim().length >= 10 && rewardOk &&
    capacity >= 1 && capacity <= 100_000 && daily >= 1 && daily <= 100;
  const wh = rewardOk ? withholding(reward, d.incomeType) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const r = await create.run({
      title: d.title.trim(),
      description: d.description.trim(),
      kind: d.kind,
      rewardKrw: reward,
      incomeType: d.incomeType,
      minTier: d.minTier,
      capacity,
      dailyLimitPerUser: daily,
    });
    if (!r) return;
    setD(EMPTY);
    setFlash(`‘${r.title}’ 퀘스트를 열었어요.`);
    void q.reload();
  };

  const onClose = async (id: string, title: string) => {
    setClosingId(id);
    const r = await close.run({ questId: id });
    setClosingId(null);
    if (!r) return;
    setFlash(`‘${title}’ 퀘스트를 마감했어요.`);
    void q.reload();
  };

  return (
    <>
      <TabIntro title="퀘스트 관리" actions={<ReloadButton q={q} />}>
        퀘스트는 본인이 직접 수행한 용역에 대가를 지급해요. 다른 회원 모집이나 하위 실적과 연결된 조건은 만들 수 없어요.
      </TabIntro>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}

      <section className="stack" aria-labelledby="quests-open-h">
        <h3 id="quests-open-h">열린 퀘스트</h3>
        <ErrorNotice error={close.error} />
        <QueryView q={q} isEmpty={(x) => x.quests.length === 0} emptyTitle="열린 퀘스트가 없어요" emptyDesc="아래 양식으로 새 퀘스트를 열어 주세요.">
          {({ quests }) => (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>퀘스트</th>
                    <th>종류</th>
                    <th className="r">용역비</th>
                    <th>소득 구분</th>
                    <th>최소 등급</th>
                    <th className="r">남은 정원</th>
                    <th className="r">1일 한도</th>
                    <th><span className="sr-only">마감</span></th>
                  </tr>
                </thead>
                <tbody>
                  {quests.map(({ quest: qq, remaining }) => (
                    <tr key={qq.id}>
                      <td>{qq.title}</td>
                      <td className="nowrap"><Pill tone="info">{kindName(qq.kind)}</Pill></td>
                      <td className="r num nowrap">{krw(qq.rewardKrw)}</td>
                      <td className="nowrap">{INCOME_LABEL[qq.incomeType]}</td>
                      <td className="nowrap">{tierName(qq.minTier)}</td>
                      <td className="r num nowrap">{remaining.toLocaleString('ko-KR')} / {qq.capacity.toLocaleString('ko-KR')}</td>
                      <td className="r num nowrap">{qq.dailyLimitPerUser}회</td>
                      <td>
                        <ConfirmButton label="마감" question="마감하면 새 제출을 받지 않아요. 마감할까요?" confirmLabel="마감" disabled={closingId === qq.id} onConfirm={() => void onClose(qq.id, qq.title)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryView>
      </section>

      <section className="card stack" aria-labelledby="quest-new-h">
        <div className="stack-sm">
          <h3 id="quest-new-h">새 퀘스트</h3>
          <p className="muted">금지 표현(투자 권유, 수익 약속 등)이 들어가면 서버에서 등록을 거절해요.</p>
        </div>
        <form className="stack" onSubmit={(e) => void submit(e)}>
          <div className="admin-form-grid">
            <div className="span-all">
              <Field label="제목" hint="2~120자">
                <input className="input" value={d.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="예: 동네 가게 리뷰 작성" />
              </Field>
            </div>
            <div className="span-all">
              <Field label="설명" hint="10자 이상. 수행 방법과 제출할 증빙을 적어 주세요.">
                <textarea className="textarea" value={d.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>
            <Field label="종류">
              <select className="select" value={d.kind} onChange={(e) => set('kind', e.target.value as QuestKind)}>
                {QUEST_KINDS.map((k) => <option key={k} value={k}>{kindName(k)}</option>)}
              </select>
            </Field>
            <Field label="용역비(원)" hint="100원 ~ 5,000,000원">
              <input className="input num" type="number" inputMode="numeric" min={100} max={5_000_000} step={100} value={d.rewardKrw} onChange={(e) => set('rewardKrw', e.target.value)} />
            </Field>
            <Field label="소득 구분">
              <select className="select" value={d.incomeType} onChange={(e) => set('incomeType', e.target.value as IncomeType)}>
                {(['BUSINESS', 'OTHER'] as const).map((t) => <option key={t} value={t}>{INCOME_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="최소 등급">
              <select className="select" value={d.minTier} onChange={(e) => set('minTier', e.target.value as Tier)}>
                {TIER_ORDER.map((t) => <option key={t} value={t}>{tierName(t)}</option>)}
              </select>
            </Field>
            <Field label="총 정원" hint="승인 가능한 총 건수">
              <input className="input num" type="number" inputMode="numeric" min={1} max={100_000} value={d.capacity} onChange={(e) => set('capacity', e.target.value)} />
            </Field>
            <Field label="1인 1일 한도" hint="1~100회">
              <input className="input num" type="number" inputMode="numeric" min={1} max={100} value={d.dailyLimitPerUser} onChange={(e) => set('dailyLimitPerUser', e.target.value)} />
            </Field>
          </div>
          {wh !== null && (
            <div className="panel">
              <dl className="admin-dl">
                <dt>건당 용역비</dt><dd className="num">{krw(reward)}</dd>
                <dt>원천징수</dt><dd className="num">− {krw(wh)} ({INCOME_LABEL[d.incomeType]})</dd>
                <dt>기여자 실수령</dt><dd className="num"><b>{krw(reward - wh)}</b></dd>
              </dl>
            </div>
          )}
          <ErrorNotice error={create.error} />
          <div className="admin-actions">
            <button type="submit" className="btn btn-primary" disabled={!valid || create.pending}>
              {create.pending ? '등록 중…' : '퀘스트 열기'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
