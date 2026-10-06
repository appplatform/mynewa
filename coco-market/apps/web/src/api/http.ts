import type { OpInput, OpName, OpOutput } from '@coco/core';
import { ClientError, type ApiClient } from './types';

/** 서버 모드: 세션은 HttpOnly 쿠키로만 오간다. 프론트는 토큰을 보지 않는다. */
export class HttpClient implements ApiClient {
  readonly mode = 'server' as const;
  constructor(private readonly base = '/api') {}

  async call<N extends OpName>(name: N, input?: OpInput<N>): Promise<OpOutput<N>> {
    const res = await fetch(`${this.base}/rpc/${name}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-coco-csrf': '1' },
      body: JSON.stringify(input ?? {}),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ClientError(body?.code ?? 'NETWORK', body?.message ?? `요청 실패 (${res.status})`);
    return body.data as OpOutput<N>;
  }
}
