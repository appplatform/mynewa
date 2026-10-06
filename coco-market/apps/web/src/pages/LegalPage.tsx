import { GATES, type GateLevel } from '@coco/core';
import { Link, NavLink, useParams } from 'react-router';
import { PageHeader, Pill } from '../ui/kit';
import NotFoundPage from './NotFoundPage';
import './pages.css';

interface Section { title: string; items: string[] }

const TERMS: Section[] = [
  { title: '1. 서비스의 성격', items: [
    'CO-CO Market은 권리자와 이용자 사이의 IP 이용허락 거래를 중개하는 통신판매중개자예요. 거래 당사자는 권리자와 이용자예요.',
    '권리 증빙은 운영사가 심사하지만, 권리의 최종 책임은 각 권리자에게 있어요.',
  ] },
  { title: '2. 이용권의 성격', items: [
    '이용권은 IP를 정해진 용도·지역·기간·매체 안에서 쓸 수 있는 권리예요.',
    '이용권은 투자 상품이 아니에요. IP 지분이나 권리자의 수익을 나눠 받는 권리가 들어 있지 않아요.',
    '이용권은 다른 사람에게 양도·재판매하거나 담보로 제공할 수 없어요.',
  ] },
  { title: '3. 범위 위반과 해지', items: [
    '허락 범위를 벗어난 이용은 권리 침해이며, 권리자는 계약을 해지할 수 있어요.',
    '권리 분쟁이 접수되면 운영사는 해당 IP의 판매와 권리자 정산을 보류할 수 있어요.',
  ] },
  { title: '4. 청약철회와 환불', items: [
    '이용 개시 전에는 청약을 철회할 수 있어요.',
    '이용 개시 후에는 관련 법령이 허용하는 범위에서 철회가 제한될 수 있어요.',
  ] },
  { title: '5. 기여 퀘스트와 용역비', items: [
    '용역비는 본인이 직접 수행해 검증된 일에만 지급돼요. 대리 수행과 제출 거래는 금지돼요.',
    '용역비는 소득 구분에 따라 원천징수한 뒤 지급돼요(사업소득 3.3%, 기타소득 8.8%). 최종 소득 구분은 세무 자문으로 정해요.',
    '기여 배지는 본인 기여 이력만으로 정해지며, 다른 회원 모집이나 구매로 오르지 않아요.',
  ] },
  { title: '6. 회원과 본인확인', items: [
    '1인 1계정만 허용돼요. 만 14세 미만은 가입할 수 없고, 이용권 구매는 만 19세 이상만 할 수 있어요.',
  ] },
];

const PRIVACY: Section[] = [
  { title: '수집하는 항목', items: [
    '회원가입: 이메일, 이름, 비밀번호(복원할 수 없는 해시로 저장)',
    '본인확인: 이름, 생년월일, 본인확인기관의 연계정보(CI)를 해시한 값',
    '주민등록번호는 수집하지 않아요. 휴대폰 번호는 본인확인 요청에만 쓰고 저장하지 않아요.',
    '가맹점: 가게 이름, 사업자등록번호, 지역',
  ] },
  { title: '이용 목적', items: [
    '1인 1계정 확인, 연령 확인, 이용권 계약 체결, 용역비 정산과 원천징수, 분쟁 처리',
    '유입 경로는 마케팅 분석에만 쓰고 어떤 보상 계산에도 쓰지 않아요.',
  ] },
  { title: '보관 기간', items: [
    '회원 탈퇴 시 지체 없이 파기해요.',
    '단, 계약·결제·정산 기록은 전자상거래법 등 관련 법령이 정한 기간 동안 보관해요(구체적인 기간은 법률 검토 후 안내).',
  ] },
  { title: '보관 위치와 보호', items: [
    '개인정보는 국내 리전에만 보관해요.',
    '블록체인에는 계약·기여 기록의 해시만 기록하고 개인정보와 금액은 올리지 않아요.',
    '증빙 문서와 계좌 정보는 필드 단위로 암호화해요.',
  ] },
];

const LEVEL: Record<GateLevel, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  GREEN: { label: '구현', tone: 'ok' },
  AMBER: { label: '법률 검토 후', tone: 'warn' },
  RED: { label: '구현 안 함', tone: 'bad' },
};

function DraftNotice() {
  return (
    <div className="notice notice-warn" role="note">
      <b>데모 초안이에요 · 법률 검토 전</b>
      <span>실제 서비스 전에 법무법인 검토를 거쳐 바뀔 수 있어요.</span>
    </div>
  );
}

function Sections({ list }: { list: Section[] }) {
  return (
    <div className="card stack-lg legal">
      {list.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <ul className="bullets">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}

function Gates() {
  return (
    <>
      <p className="muted">기획 단계의 기능마다 법적 위험을 세 단계로 나눠 관리해요. &lsquo;법률 검토 후&rsquo; 기능은 법무법인 서면 의견서가 등록되어야만 켤 수 있고, &lsquo;구현 안 함&rsquo; 기능은 코드로도 만들지 않아요.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>#</th><th>기능</th><th>상태</th><th>이유</th><th>대안</th></tr></thead>
          <tbody>
            {GATES.map((g) => {
              const lv = LEVEL[g.level];
              return (
                <tr key={g.no}>
                  <td className="num">{g.no}</td>
                  <td>{g.feature}</td>
                  <td><Pill tone={lv.tone}>{lv.label}</Pill></td>
                  <td>{g.reason}</td>
                  <td>{g.alternative}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>이 분류는 설계용 1차 판단이며 법률 의견이 아니에요.</p>
    </>
  );
}

const DOCS = {
  terms: { title: '이용약관 요약', body: <><DraftNotice /><Sections list={TERMS} /></> },
  privacy: { title: '개인정보 처리 요약', body: <><DraftNotice /><Sections list={PRIVACY} /></> },
  gates: { title: '기능별 법적 검토 현황', body: <Gates /> },
} as const;

type DocKey = keyof typeof DOCS;
const isDoc = (v: string | undefined): v is DocKey => !!v && v in DOCS;

export default function LegalPage() {
  const { doc } = useParams();
  if (!isDoc(doc)) return <NotFoundPage />;
  const d = DOCS[doc];
  return (
    <div className="page">
      <nav className="chips" aria-label="정책 문서">
        <NavLink className="chip-toggle" to="/legal/terms">이용약관</NavLink>
        <NavLink className="chip-toggle" to="/legal/privacy">개인정보</NavLink>
        <NavLink className="chip-toggle" to="/legal/gates">법적 검토 현황</NavLink>
      </nav>
      <PageHeader eyebrow="정책" title={d.title} />
      {d.body}
      <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>권리 침해가 의심되면 <Link to="/report">신고하기</Link>로 알려 주세요.</p>
    </div>
  );
}
