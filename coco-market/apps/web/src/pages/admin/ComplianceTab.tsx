import { AMBER_FLAG_KEYS, GATES, gateForFlag, type GateLevel, type OpOutput } from '@coco/core';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useOp, useAction } from '../../state/useOp';
import { ErrorNotice, Field, Pill } from '../../ui/kit';
import { date } from '../../ui/format';
import { Flash, QueryView, ReloadButton, TabIntro } from './shared';

const LEVEL: Record<GateLevel, { tone: 'ok' | 'warn' | 'bad'; label: string }> = {
  GREEN: { tone: 'ok', label: '구현' },
  AMBER: { tone: 'warn', label: '법률 의견서 후' },
  RED: { tone: 'bad', label: '구현 금지' },
};

const PARAM_LABEL: Record<string, string> = {
  commissionBps: '영업대행 수수료율',
};

type FlagView = OpOutput<'compliance.flags'>[number];

export function ComplianceTab() {
  const flagsQ = useOp('compliance.flags', {});
  const [flash, setFlash] = useState<string | null>(null);

  const done = (msg: string) => {
    setFlash(msg);
    void flagsQ.reload();
  };

  return (
    <>
      <TabIntro title="컴플라이언스" actions={<ReloadButton q={flagsQ} />}>
        기능마다 법적 위험 등급이 정해져 있어요. AMBER 기능은 유효한 법률 의견서가 등록되어 있고 스위치가 켜져 있을 때만 동작해요.
      </TabIntro>
      {flash && <Flash onClose={() => setFlash(null)}>{flash}</Flash>}

      <GateMatrix />

      <section className="stack" aria-labelledby="flags-h">
        <h3 id="flags-h">AMBER 기능 스위치</h3>
        <QueryView q={flagsQ} isEmpty={(d) => d.length === 0} emptyTitle="관리할 AMBER 기능이 없어요">
          {(flags) => (
            <div className="admin-list">
              {flags.map((f) => (
                <FlagCard key={`${f.key}:${String(f.enabled)}:${JSON.stringify(f.params)}`} flag={f} onDone={done} />
              ))}
            </div>
          )}
        </QueryView>
      </section>

      <ApprovalForm onDone={done} />
    </>
  );
}

function GateMatrix() {
  return (
    <section className="stack" aria-labelledby="gates-h">
      <div className="stack-sm">
        <h3 id="gates-h">Legal Gate Matrix</h3>
        <p className="muted">RED 기능은 코드에 스위치 키가 없어요. 켤 방법 자체가 없어요.</p>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="r">#</th>
              <th>기능</th>
              <th>등급</th>
              <th>이유</th>
              <th>허용 대안</th>
              <th>스위치</th>
            </tr>
          </thead>
          <tbody>
            {GATES.map((g) => {
              const lv = LEVEL[g.level];
              return (
                <tr key={g.no} className={g.level === 'RED' ? 'admin-gate-red' : undefined}>
                  <td className="r num">{g.no}</td>
                  <td>{g.feature}</td>
                  <td className="nowrap"><Pill tone={lv.tone}>{g.level} · {lv.label}</Pill></td>
                  <td>{g.reason}</td>
                  <td>{g.alternative}</td>
                  <td className="nowrap">
                    {g.level === 'GREEN' && <span className="faint">항상 켜짐</span>}
                    {g.level === 'AMBER' && g.flagKey && <span className="mono">{g.flagKey}</span>}
                    {g.level === 'RED' && <span className="admin-noswitch" aria-label="스위치 없음">✕ 스위치 없음</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const isBps = (k: string) => /bps$/i.test(k);

function FlagCard({ flag, onDone }: { flag: FlagView; onDone: (msg: string) => void }) {
  const setFlag = useAction('compliance.setFlag');
  const keys = Object.keys(flag.params);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, String(isBps(k) ? (flag.params[k] ?? 0) / 100 : (flag.params[k] ?? 0))])),
  );

  const parsed: Record<string, number> = {};
  let paramsValid = true;
  for (const k of keys) {
    const n = Number(draft[k]);
    const v = isBps(k) ? Math.round(n * 100) : Math.round(n);
    if (draft[k] === '' || !Number.isFinite(n) || v < 0 || v > 10_000) paramsValid = false;
    else parsed[k] = v;
  }
  const dirty = keys.some((k) => parsed[k] !== flag.params[k]);

  const toggle = async () => {
    const r = await setFlag.run({ key: flag.key, enabled: !flag.enabled, params: flag.params });
    if (r) onDone(`${flag.gate.feature}: 스위치를 ${r.enabled ? '켰어요' : '껐어요'}.`);
  };

  const saveParams = async () => {
    if (!paramsValid) return;
    const r = await setFlag.run({ key: flag.key, enabled: flag.enabled, params: parsed });
    if (r) onDone(`${flag.gate.feature}: 파라미터를 저장했어요.`);
  };

  const state = flag.effective
    ? <Pill tone="ok">동작 중</Pill>
    : flag.enabled
      ? <Pill tone="warn">켜짐 · 의견서 없음(멈춤)</Pill>
      : <Pill>꺼짐</Pill>;

  return (
    <article className="card admin-card" aria-labelledby={`f-${flag.key}`}>
      <div className="row-between">
        <div className="stack-sm">
          <div className="row">
            <Pill tone="warn">AMBER #{flag.gate.no}</Pill>
            <span className="mono faint">{flag.key}</span>
          </div>
          <h3 id={`f-${flag.key}`}>{flag.gate.feature}</h3>
        </div>
        <div className="row">
          {state}
          <label className="admin-switch">
            <input
              type="checkbox"
              role="switch"
              checked={flag.enabled}
              aria-checked={flag.enabled}
              disabled={setFlag.pending}
              onChange={() => void toggle()}
            />
            <span>{flag.enabled ? '켜짐' : '꺼짐'}</span>
          </label>
        </div>
      </div>
      <dl className="admin-dl">
        <dt>위험 요지</dt><dd>{flag.gate.reason}</dd>
        <dt>허용 범위</dt><dd>{flag.gate.alternative}</dd>
        <dt>의견서</dt>
        <dd>
          {flag.validApproval
            ? <>유효 · {flag.validApproval.lawFirm} · {date(flag.validApproval.expiresAt)}까지</>
            : <span className="faint">유효한 의견서가 없어요. 켜려면 아래에서 먼저 등록해 주세요.</span>}
        </dd>
      </dl>
      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>스위치가 켜져 있고 의견서가 유효해야 동작 중이 돼요.</p>

      {setFlag.error && (
        <div className="stack-sm">
          <ErrorNotice error={setFlag.error} />
          {setFlag.error.code === 'COMPLIANCE_BLOCKED' && (
            <p className="faint">법무법인 서면 의견서를 아래 양식으로 등록한 뒤 다시 켜 주세요.</p>
          )}
        </div>
      )}

      {keys.length > 0 && (
        <div className="admin-sub">
          <h4>파라미터</h4>
          <div className="admin-form-grid">
            {keys.map((k) => (
              <Field key={k} label={PARAM_LABEL[k] ?? k} hint={isBps(k) ? `% 단위 · 저장 값 ${parsed[k] ?? '—'}bps` : undefined}>
                <input
                  className="input num"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={isBps(k) ? 100 : 10_000}
                  step={isBps(k) ? 0.01 : 1}
                  value={draft[k] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          {!paramsValid && <p className="faint">0 이상, 허용 범위 안의 숫자를 넣어 주세요.</p>}
          <div className="admin-actions">
            <button type="button" className="btn btn-sm" disabled={!dirty || !paramsValid || setFlag.pending} onClick={() => void saveParams()}>
              파라미터 저장
            </button>
          </div>
        </div>
      )}

      <div className="admin-sub">
        <h4>등록된 의견서 {flag.approvals.length}건</h4>
        {flag.approvals.length === 0 ? (
          <p className="faint">아직 없어요.</p>
        ) : (
          <ul className="admin-ul">
            {flag.approvals.map((a) => {
              const valid = a.expiresAt > new Date().toISOString();
              return (
                <li key={a.id}>
                  <div className="row-between">
                    <b>{a.lawFirm}</b>
                    {valid ? <Pill tone="ok">{date(a.expiresAt)}까지</Pill> : <Pill tone="bad">만료 {date(a.expiresAt)}</Pill>}
                  </div>
                  <span>{a.scope}</span>
                  <span className="hash faint">SHA-256 {a.opinionDocHash}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}

async function sha256File(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('이 브라우저에서는 해시를 계산할 수 없어요. HTTPS로 접속해 주세요.');
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const HASH_RE = /^[0-9a-f]{64}$/;

function ApprovalForm({ onDone }: { onDone: (msg: string) => void }) {
  const register = useAction('compliance.registerApproval');
  const [flagKey, setFlagKey] = useState<string>(AMBER_FLAG_KEYS[0]);
  const [lawFirm, setLawFirm] = useState('');
  const [hash, setHash] = useState('');
  const [scope, setScope] = useState('');
  const [expires, setExpires] = useState('');
  const [hashing, setHashing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const hashOk = HASH_RE.test(hash);
  const valid = lawFirm.trim().length >= 2 && hashOk && scope.trim().length >= 5 && !!expires && expires >= minDate;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileErr(null);
    if (!file) return;
    setHashing(true);
    try {
      setHash(await sha256File(file));
      setFileName(file.name);
    } catch (err) {
      setFileErr(err instanceof Error ? err.message : String(err));
    } finally {
      setHashing(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    // 선택한 날짜의 하루 끝(사용자 현지 시각)까지 유효
    const expiresAt = new Date(`${expires}T23:59:59.999`).toISOString();
    const r = await register.run({ flagKey, lawFirm: lawFirm.trim(), opinionDocHash: hash, scope: scope.trim(), expiresAt });
    if (!r) return;
    setLawFirm(''); setHash(''); setScope(''); setExpires(''); setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
    onDone(`${gateForFlag(flagKey)?.feature ?? flagKey}: 법률 의견서를 등록했어요. 이제 스위치를 켤 수 있어요.`);
  };

  return (
    <section className="card stack" aria-labelledby="approval-h">
      <div className="stack-sm">
        <h3 id="approval-h">법률 의견서 등록</h3>
        <p className="muted">
          의견서 원문은 올리지 않고 파일의 SHA-256 해시만 기록해요. 등록 기록은 감사 로그에 남아요. AMBER 기능에만 등록할 수 있어요.
        </p>
      </div>
      <form className="stack" onSubmit={(e) => void submit(e)}>
        <div className="admin-form-grid">
          <Field label="대상 기능">
            <select className="select" value={flagKey} onChange={(e) => setFlagKey(e.target.value)}>
              {AMBER_FLAG_KEYS.map((k) => (
                <option key={k} value={k}>#{gateForFlag(k)?.no} {gateForFlag(k)?.feature ?? k}</option>
              ))}
            </select>
          </Field>
          <Field label="법무법인" hint="2자 이상">
            <input className="input" value={lawFirm} maxLength={100} onChange={(e) => setLawFirm(e.target.value)} placeholder="예: 법무법인 한빛" />
          </Field>
          <Field label="유효 기한" hint="선택한 날의 하루 끝까지 유효해요.">
            <input className="input" type="date" min={minDate} value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
          <div className="span-all stack-sm">
            <Field label="의견서 파일로 해시 계산" hint={hashing ? '계산 중…' : fileName ? `${fileName} 해시를 넣었어요. 파일은 이 브라우저 밖으로 나가지 않아요.` : '파일은 업로드하지 않고 브라우저에서 해시만 계산해요.'}>
              <input ref={fileRef} className="input" type="file" onChange={(e) => void onFile(e)} />
            </Field>
            {fileErr && <div className="notice notice-bad" role="alert">{fileErr}</div>}
          </div>
          <div className="span-all">
            <Field label="문서 해시 (SHA-256)" hint={hash && !hashOk ? '소문자 16진수 64자여야 해요.' : '파일을 고르면 자동으로 채워져요. 직접 붙여 넣어도 돼요.'}>
              <input
                className="input mono"
                value={hash}
                spellCheck={false}
                autoComplete="off"
                maxLength={64}
                onChange={(e) => { setHash(e.target.value.trim().toLowerCase()); setFileName(null); }}
                placeholder="64자 16진수"
              />
            </Field>
          </div>
          <div className="span-all">
            <Field label="의견 범위" hint="5자 이상. 의견서가 허용한 조건을 요약해 주세요.">
              <textarea className="textarea" value={scope} maxLength={1000} onChange={(e) => setScope(e.target.value)} placeholder="예: 직접 온보딩한 기여자 1인과 본사 2자 분배에 한해 적법하다는 의견" />
            </Field>
          </div>
        </div>
        <ErrorNotice error={register.error} />
        <div className="admin-actions">
          <button type="submit" className="btn btn-primary" disabled={!valid || register.pending || hashing}>
            {register.pending ? '등록 중…' : '의견서 등록'}
          </button>
        </div>
      </form>
    </section>
  );
}
