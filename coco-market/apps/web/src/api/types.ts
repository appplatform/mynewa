import type { OpInput, OpName, OpOutput } from '@coco/core';

export interface ApiError { code: string; message: string }

export interface ApiClient {
  readonly mode: 'demo' | 'server';
  call<N extends OpName>(name: N, input?: OpInput<N>): Promise<OpOutput<N>>;
  /** 데모 모드 전용: 데이터 초기화 */
  reset?(): Promise<void>;
}

export class ClientError extends Error implements ApiError {
  constructor(public code: string, message: string) {
    super(message);
  }
}
