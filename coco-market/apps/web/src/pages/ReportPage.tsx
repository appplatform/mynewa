import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSession } from '../state/session';
import { useAction, useOp } from '../state/useOp';
import { IP_TYPE_LABEL } from '../ui/format';
import { Empty, ErrorNotice, Field, Gate, Loading, PageHeader } from '../ui/kit';
import { Async } from './_parts/Async';
import './pages.css';

function IpPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = useOp('catalog.listIps', {});
  return (
    <Async {...list} lines={1}>
      {(ips) =>
        ips.length === 0 ? (
          <Empty title="신고할 수 있는 공개 IP가 없어요" />
        ) : (
          <Field label="신고할 IP">
            <select className="select" value={value} onChange={(e) => onChange(e.target.value)} required>
              <option value="">IP를 골라 주세요</option>
              {ips.map((ip) => <option key={ip.id} value={ip.id}>{ip.title} ({IP_TYPE_LABEL[ip.type]})</option>)}
            </select>
          </Field>
        )
      }
    </Async>
  );
}

function FixedIp({ ipId }: { ipId: string }) {
  const res = useOp('catalog.getIp', { ipId });
  return (
    <Async {...res} lines={1}>
      {(d) => (
        <div className="panel stack-sm">
          <span className="label">신고할 IP</span>
          <b>{d.ip.title}</b>
          <span className="faint">권리자 {d.holderName} · 등록번호 <span className="mono">{d.ip.registrationNo}</span></span>
        </div>
      )}
    </Async>
  );
}

function ReportForm({ fixedIp }: { fixedIp: string | null }) {
  const report = useAction('disputes.report');
  const [ipId, setIpId] = useState(fixedIp ?? '');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await report.run({ ipId, reason: reason.trim() })) setDone(true);
  }

  if (done) {
    return (
      <div className="stack">
        <div className="notice notice-ok" role="status">
          <b>신고가 접수됐어요.</b>
          <span>검토가 끝날 때까지 해당 IP의 새 이용권 판매와 권리자 정산이 멈춰요. 결과는 투명성 화면의 분쟁 처리 통계에 반영돼요.</span>
        </div>
        <Link className="btn" style={{ justifySelf: 'start' }} to={`/ips/${ipId}`}>IP 화면으로</Link>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      {fixedIp ? <FixedIp ipId={fixedIp} /> : <IpPicker value={ipId} onChange={setIpId} />}
      <Field label="신고 사유" hint="어떤 권리가 어떻게 침해되었는지, 근거 자료가 있다면 함께 10자 이상 적어 주세요.">
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={2000} required />
      </Field>
      <button type="submit" className="btn btn-danger" disabled={report.pending || !ipId || reason.trim().length < 10}>
        {report.pending ? '접수하는 중…' : '신고 접수하기'}
      </button>
      <ErrorNotice error={report.error} />
    </form>
  );
}

export default function ReportPage() {
  const [params] = useSearchParams();
  const ip = params.get('ip');
  const { user, loading } = useSession();
  return (
    <div className="page">
      <PageHeader eyebrow="신고하기" title="권리 침해·분쟁 신고" desc="내 권리가 무단으로 등록되었거나, IP의 권리관계에 문제가 있다면 알려 주세요." />
      <div className="notice notice-warn" role="note">
        <b>신고가 접수되면 바로 조치해요.</b>
        <span>검토가 끝날 때까지 해당 IP의 새 판매와 권리자 정산이 보류돼요. 권리자에게 소명 기회를 드린 뒤 결정해요. 허위 신고는 법적 책임이 따를 수 있어요.</span>
      </div>
      {loading ? <Loading /> : <Gate ok={!!user} need="login"><ReportForm fixedIp={ip} /></Gate>}
    </div>
  );
}
