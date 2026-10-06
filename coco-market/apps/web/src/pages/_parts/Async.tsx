import type { ReactNode } from 'react';
import type { ClientError } from '../../api';
import { ErrorNotice, Loading } from '../../ui/kit';

/** useOp 결과를 로딩·오류·데이터 상태로 나눠 그린다. 다시 불러오는 동안에는 기존 데이터를 유지한다. */
export function Async<T>({
  data, error, loading, lines, children,
}: {
  data: T | null;
  error: ClientError | null;
  loading: boolean;
  lines?: number;
  children: (data: T) => ReactNode;
}) {
  if (error && data == null) return <ErrorNotice error={error} />;
  if (data == null) return loading ? <Loading lines={lines} /> : null;
  return (
    <>
      {error && <ErrorNotice error={error} />}
      {children(data)}
    </>
  );
}
