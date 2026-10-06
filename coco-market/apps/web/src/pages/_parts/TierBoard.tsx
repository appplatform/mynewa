import { TIER_RULES, type TierProgress } from '@coco/core';
import { tierName } from '../../ui/format';
import { Pill } from '../../ui/kit';

const MAX_STAMPS = 30;

/** 본인 기여 배지와 다음 배지까지의 스탬프판. 다른 회원 정보는 들어오지 않는다. */
export function TierBoard({ progress }: { progress: TierProgress }) {
  const next = progress.next;
  const need = next ? TIER_RULES.find((r) => r.tier === next.tier)?.minVerified ?? 0 : 0;
  const have = Math.min(progress.verified, need);
  return (
    <section className="card stack" aria-labelledby="tier-title">
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="label">내 기여 배지</span>
          <h2 id="tier-title" style={{ fontSize: 'var(--fs-xl)' }}>{tierName(progress.tier)}</h2>
        </div>
        <Pill tone="brand">검증된 기여 <span className="num">{progress.verified}</span>건</Pill>
      </div>
      {next ? (
        <>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            다음 배지 <b>{tierName(next.tier)}</b>까지 검증된 기여 <span className="num">{have}/{need}</span>
          </p>
          {need <= MAX_STAMPS ? (
            <div className="stamps" role="img" aria-label={`스탬프 ${need}칸 중 ${have}칸 채움`}>
              {Array.from({ length: need }, (_, i) => (
                <span key={i} className={`stamp${i < have ? ' on' : ''}`} aria-hidden="true">{i + 1}</span>
              ))}
            </div>
          ) : (
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={have} aria-label="다음 배지까지 진행도">
              <i style={{ width: `${need ? (have / need) * 100 : 0}%` }} />
            </div>
          )}
          {next.missing.length > 0 && (
            <div className="stack-sm">
              <span className="label">남은 조건</span>
              <ul className="bullets">
                {next.missing.map((m) => (
                  <li key={m.label}>{m.label} <span className="num">{m.have}/{m.need}</span>건</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="muted">가장 높은 배지까지 모았어요.</p>
      )}
      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
        배지는 본인이 직접 수행해 검증된 기여만으로 정해져요. 다른 사람을 모집하거나 무언가를 구매해서 오르지 않아요.
      </p>
    </section>
  );
}
