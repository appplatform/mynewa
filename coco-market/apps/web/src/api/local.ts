import {
  DomainError, execute, insecureDemoHasher, MemoryStore, mockAnchor, mockIdentity, mockPayments, seedDemo,
  type Deps, type Entity, type OpInput, type OpName, type OpOutput,
} from '@coco/core';
import { ClientError, type ApiClient } from './types';

const DATA_KEY = 'coco-demo-data-v1';
const TOKEN_KEY = 'coco-demo-token-v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장이 막힌 환경에서도 메모리로 동작 */
  }
}

function makeDeps(): Deps {
  return {
    clock: () => new Date(),
    ids: () => crypto.randomUUID(),
    hasher: insecureDemoHasher,
    payments: mockPayments,
    identity: mockIdentity,
    anchor: mockAnchor,
    termsVersion: 'v1.0-demo',
    membershipFeeKrw: 200_000,
  };
}

/**
 * 데모 모드: 서버와 같은 core 로직을 브라우저 안에서 실행한다.
 * 데이터는 이 브라우저의 localStorage에만 저장된다(결제·본인확인·체인은 모의).
 */
export class LocalClient implements ApiClient {
  readonly mode = 'demo' as const;
  private store!: MemoryStore;
  private ready: Promise<void>;
  private token: string | null = read<string>(TOKEN_KEY);
  private readonly deps = makeDeps();

  constructor() {
    this.ready = this.boot(read<Record<string, Entity[]>>(DATA_KEY));
  }

  private async boot(initial: Record<string, Entity[]> | null) {
    this.store = new MemoryStore({ initial: initial ?? undefined, onCommit: (snap) => write(DATA_KEY, snap) });
    if (!initial) {
      await seedDemo(this.store, this.deps);
      write(DATA_KEY, this.store.dump());
    }
  }

  async call<N extends OpName>(name: N, input?: OpInput<N>): Promise<OpOutput<N>> {
    await this.ready;
    try {
      const out = await execute(this.store, this.deps, name, input, { sessionToken: this.token });
      if (name === 'auth.login' || name === 'auth.register') {
        const t = (out as { token: string }).token;
        this.token = t;
        write(TOKEN_KEY, t);
        const { token: _t, ...rest } = out as Record<string, unknown>;
        return rest as OpOutput<N>;
      }
      if (name === 'auth.logout') {
        this.token = null;
        write(TOKEN_KEY, null);
      }
      return out;
    } catch (e) {
      if (e instanceof DomainError) throw new ClientError(e.code, e.message);
      throw e;
    }
  }

  async reset() {
    write(DATA_KEY, null);
    write(TOKEN_KEY, null);
    this.token = null;
    this.ready = this.boot(null);
    await this.ready;
  }
}
