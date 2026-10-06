import { Link } from 'react-router';
import { Empty } from '../ui/kit';

export default function NotFoundPage() {
  return (
    <div className="page">
      <Empty title="페이지를 찾을 수 없어요" action={<Link className="btn btn-primary" to="/">홈으로</Link>}>
        주소가 바뀌었거나 없는 페이지예요.
      </Empty>
    </div>
  );
}
