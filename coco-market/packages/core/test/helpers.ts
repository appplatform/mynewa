import {
  execute, insecureDemoHasher, MemoryStore, mockAnchor, mockIdentity, mockPayments,
  type Deps, type OpInput, type OpName, type OpOutput, type Store,
} from '../src';

export function makeDeps(start = '2026-10-06T01:00:00.000Z') {
  let t = new Date(start).getTime();
  let n = 0;
  const deps: Deps = {
    clock: () => new Date(t),
    ids: () => `id${(++n).toString().padStart(6, '0')}`,
    hasher: insecureDemoHasher,
    payments: mockPayments,
    identity: mockIdentity,
    anchor: mockAnchor,
    termsVersion: 'v1.0-test',
    membershipFeeKrw: 200_000,
  };
  return { deps, advance: (ms: number) => { t += ms; } };
}

export function makeApp(store: Store = new MemoryStore()) {
  const { deps, advance } = makeDeps();
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  const call = <N extends OpName>(who: string | null, name: N, input?: OpInput<N>): Promise<OpOutput<N>> =>
    execute(store, deps, name, input, { sessionToken: who ? tokens[who] : null });

  async function user(key: string, opts: { birth?: string; verify?: boolean } = {}) {
    const r = await call(null, 'auth.register', { email: `${key}@t.test`, password: 'password-1234', name: key });
    tokens[key] = r.token;
    userIds[key] = r.user.id;
    if (opts.verify !== false) {
      await call(key, 'identity.verify', { name: key, birthDate: opts.birth ?? '1990-01-01', phone: `010-${(Object.keys(tokens).length + 1000).toString()}-0000` });
    }
    return r.user.id;
  }

  async function grantRoles(key: string, roles: ('REVIEWER' | 'COMPLIANCE_OFFICER' | 'FINANCE' | 'SUPER_ADMIN')[]) {
    await store.transaction(async (tx) => {
      await tx.users.update(userIds[key]!, { roles: ['USER', ...roles] });
    });
  }

  return { store, deps, advance, call, user, grantRoles, tokens, userIds };
}

export async function activeIp(app: ReturnType<typeof makeApp>, owner: string, reviewer: string, opts: { coHolders?: { email: string; shareBps: number }[]; exclusive?: boolean; price?: number } = {}) {
  const ip = await app.call(owner, 'studio.createIp', {
    title: '테스트 캐릭터',
    type: 'CHARACTER',
    summary: '테스트용 캐릭터 IP 설명입니다.',
    registrationNo: 'DEMO-T-1',
    evidence: [{ kind: 'REGISTRATION_CERT', reference: '등록증' }],
    coHolders: opts.coHolders ?? [],
  });
  const product = await app.call(owner, 'studio.addProduct', {
    ipId: ip.id, name: '굿즈 이용권', usages: ['MERCHANDISE'], territory: '대한민국', termMonths: 12, exclusive: opts.exclusive ?? false, media: [], priceKrw: opts.price ?? 100_000,
  });
  return { ip, product, activate: async () => {
    await app.call(owner, 'studio.submitIp', { ipId: ip.id });
    await app.call(reviewer, 'review.decideIp', { ipId: ip.id, approve: true, note: 'ok' });
  } };
}
