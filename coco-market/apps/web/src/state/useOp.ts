import type { OpInput, OpName, OpOutput } from '@coco/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ClientError } from '../api';

/** 조회용 훅. deps가 바뀌면 다시 불러온다. reload()로 수동 갱신. */
export function useOp<N extends OpName>(name: N, input?: OpInput<N>, opts: { skip?: boolean } = {}) {
  const [data, setData] = useState<OpOutput<N> | null>(null);
  const [error, setError] = useState<ClientError | null>(null);
  const [loading, setLoading] = useState(!opts.skip);
  const key = JSON.stringify(input ?? {});
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (opts.skip) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api.call(name, JSON.parse(key) as OpInput<N>);
      if (my === seq.current) { setData(r); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e instanceof ClientError ? e : new ClientError('UNKNOWN', String(e)));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [name, key, opts.skip]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

/** 변경용 훅. 실행 중 상태와 마지막 오류를 관리한다. */
export function useAction<N extends OpName>(name: N) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const run = useCallback(async (input?: OpInput<N>): Promise<OpOutput<N> | null> => {
    setPending(true);
    setError(null);
    try {
      return await api.call(name, input);
    } catch (e) {
      setError(e instanceof ClientError ? e : new ClientError('UNKNOWN', String(e)));
      return null;
    } finally {
      setPending(false);
    }
  }, [name]);
  return { run, pending, error, clearError: () => setError(null) };
}
