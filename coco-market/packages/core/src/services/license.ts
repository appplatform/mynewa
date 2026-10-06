import { z } from 'zod';
import { sha256Hex, canonicalJson } from '../crypto';
import { DomainError, assert } from '../errors';
import { Accounts, post, splitByBps } from '../ledger';
import { audit, hasRole, op, requireAdult, requireUser, zId } from '../op';
import type { IPAsset, LicenseGrant, LicenseProduct, LicenseScope, Usage, User } from '../types';
import { formatKrw } from '../validation';
import { hasOpenDispute, ownerShareBps } from './studio';

export const USAGE_LABEL: Record<Usage, string> = {
  MERCHANDISE: '상품화(굿즈 제작·판매)',
  ADVERTISING: '광고·홍보물 사용',
  DERIVATIVE_WORK: '2차적 저작물 작성',
  IN_STORE_DISPLAY: '매장 내 전시·인테리어',
  DIGITAL_CONTENT: '디지털 콘텐츠(SNS·웹)',
};

function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

const overlaps = (a: Usage[], b: Usage[]) => a.some((u) => b.includes(u));

export function contractText(args: {
  ip: IPAsset; product: LicenseProduct; licensee: User; holderName: string; startsAt: string; endsAt: string; termsVersion: string;
}): string {
  const { ip, product, licensee, holderName, startsAt, endsAt, termsVersion } = args;
  const s = product.scope;
  return [
    `IP 이용허락 계약서 (표준약관 ${termsVersion})`,
    ``,
    `허락자(권리자): ${holderName}`,
    `이용자: ${licensee.name} (${licensee.email})`,
    `대상 IP: ${ip.title} [${ip.type}, 등록번호 ${ip.registrationNo}]`,
    `상품: ${product.name}`,
    ``,
    `제1조(허락 범위) 이용자는 아래 범위에서만 대상 IP를 이용할 수 있다.`,
    `  - 용도: ${s.usages.map((u) => USAGE_LABEL[u]).join(', ')}`,
    `  - 지역: ${s.territory}`,
    `  - 매체: ${s.media.length ? s.media.join(', ') : '용도에 필요한 범위'}`,
    `  - 기간: ${startsAt.slice(0, 10)} ~ ${endsAt.slice(0, 10)} (${s.termMonths}개월)`,
    `  - 독점 여부: ${s.exclusive ? '독점(같은 기간·용도로 제3자에게 허락하지 않음)' : '비독점'}`,
    `제2조(이용료) 이용자는 ${formatKrw(product.priceKrw)}을 지급한다.`,
    `제3조(양도 금지) 이 이용권은 제3자에게 양도·재판매·담보 제공할 수 없다.`,
    `제4조(성격) 이 계약은 IP 이용허락 계약이며, 권리자의 수익을 나눠 받는 권리나 투자 상품이 아니다.`,
    `제5조(범위 위반) 허락 범위를 벗어난 이용은 권리 침해이며, 권리자는 계약을 해지할 수 있다.`,
    `제6조(청약철회) 이용권 개시 전에는 청약을 철회할 수 있으며, 개시 후에는 관련 법령이 허용하는 범위에서 제한될 수 있다.`,
    `제7조(분쟁) 권리 분쟁이 접수되면 플랫폼은 판매와 정산을 보류할 수 있다.`,
  ].join('\n');
}

export const licenseOps = {
  'license.checkout': op({
    auth: 'verified',
    doc: '라이선스 구매: 결제 → 이용권 발급 → 원장 분배',
    input: z.object({ productId: zId, agreeTerms: z.literal(true, { errorMap: () => ({ message: '약관 동의가 필요합니다.' }) }) }),
    async run(ctx, input) {
      const user = requireAdult(ctx);
      const product = await ctx.tx.products.get(input.productId);
      if (!product || !product.active) throw new DomainError('NOT_FOUND', '판매 중인 상품이 아닙니다.');
      const ip = await ctx.tx.ips.get(product.ipId);
      if (!ip || ip.status !== 'ACTIVE') throw new DomainError('CONFLICT', '현재 판매할 수 없는 IP입니다.');
      if (await hasOpenDispute(ctx, ip.id)) throw new DomainError('ON_HOLD', '권리 분쟁 처리 중이라 판매가 일시 중지되었습니다.');
      assert(ip.ownerId !== user.id && !ip.coHolders.some((c) => c.userId === user.id), 'BAD_REQUEST', '본인이 권리자인 IP는 구매할 수 없습니다.');

      const now = ctx.now.toISOString();
      const live = (await ctx.tx.grants.find({ ipId: ip.id })).filter((g) => g.status === 'ACTIVE' && g.endsAt > now);
      for (const g of live) {
        const conflict = overlaps(g.scope.usages, product.scope.usages) && (g.scope.exclusive || product.scope.exclusive);
        if (conflict) throw new DomainError('CONFLICT', '같은 용도의 독점 이용권이 이미 유효합니다.');
      }

      const grantId = ctx.deps.ids();
      const pay = await ctx.deps.payments.charge({ orderId: grantId, amountKrw: product.priceKrw, description: product.name, payerId: user.id });
      if (!pay.approved) throw new DomainError('BAD_REQUEST', `결제가 승인되지 않았습니다: ${pay.failureReason ?? '사유 미상'}`);

      const owner = await ctx.tx.users.get(ip.ownerId);
      const startsAt = now;
      const endsAt = addMonths(ctx.now, product.scope.termMonths).toISOString();
      const text = contractText({ ip, product, licensee: user, holderName: owner?.name ?? '권리자', startsAt, endsAt, termsVersion: ctx.deps.termsVersion });
      const scope: LicenseScope = product.scope;
      const grant: LicenseGrant = {
        id: grantId,
        productId: product.id,
        ipId: ip.id,
        licenseeId: user.id,
        priceKrw: product.priceKrw,
        scope,
        termsVersion: ctx.deps.termsVersion,
        contractText: text,
        signatureHash: sha256Hex(canonicalJson({ text, licenseeId: user.id, signedAt: now })),
        paymentRef: pay.paymentRef,
        status: 'ACTIVE',
        startsAt,
        endsAt,
        anchorBatchId: null,
        createdAt: now,
      };
      await ctx.tx.grants.insert(grant);

      // 정산: 결제 대금 = 플랫폼 수수료 + 권리자 몫(지분대로). 이용자 사이에서 돈이 오가는 경로는 없다.
      const fee = Math.floor((product.priceKrw * product.platformFeeBps) / 10_000);
      const holderPool = product.priceKrw - fee;
      const shares = [
        { key: ip.ownerId, bps: ownerShareBps(ip) },
        ...ip.coHolders.map((c) => {
          if (!c.userId) throw new DomainError('CONFLICT', '공동권리자 계정 연결이 끝나지 않았습니다.');
          return { key: c.userId, bps: c.shareBps };
        }),
      ];
      const parts = splitByBps(holderPool, shares);
      await post(ctx.tx, ctx.deps, {
        memo: `라이선스 판매: ${product.name}`,
        refType: 'license_grant',
        refId: grant.id,
        idempotencyKey: `grant:${grant.id}`,
        lines: [
          { account: Accounts.pgClearing, debit: product.priceKrw },
          ...(fee > 0 ? [{ account: Accounts.platformRevenue, credit: fee }] : []),
          ...parts.filter((p) => p.amount > 0).map((p) => ({ account: Accounts.userPayable(p.key), credit: p.amount })),
        ],
      });
      await audit(ctx, 'license.checkout', `grant:${grant.id}`, { productId: product.id, priceKrw: product.priceKrw, paymentRef: pay.paymentRef });
      return grant;
    },
  }),

  'license.mine': op({
    auth: 'user',
    doc: '내가 보유한 이용권',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      const grants = await ctx.tx.grants.find({ licenseeId: user.id });
      const now = ctx.now.toISOString();
      const out = [];
      for (const g of grants.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        const ip = await ctx.tx.ips.get(g.ipId);
        const product = await ctx.tx.products.get(g.productId);
        out.push({ grant: { ...g, status: g.status === 'ACTIVE' && g.endsAt <= now ? 'EXPIRED' : g.status }, ipTitle: ip?.title ?? '', productName: product?.name ?? '' });
      }
      return out;
    },
  }),

  'license.get': op({
    auth: 'user',
    doc: '이용권 계약서 조회(이용자·권리자·관리자)',
    input: z.object({ grantId: zId }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      const g = await ctx.tx.grants.get(input.grantId);
      if (!g) throw new DomainError('NOT_FOUND', '이용권을 찾을 수 없습니다.');
      const ip = await ctx.tx.ips.get(g.ipId);
      const isHolder = !!ip && (ip.ownerId === user.id || ip.coHolders.some((c) => c.userId === user.id));
      if (g.licenseeId !== user.id && !isHolder && !hasRole(user, 'COMPLIANCE_OFFICER', 'FINANCE')) {
        throw new DomainError('FORBIDDEN', '열람 권한이 없습니다.');
      }
      const batch = g.anchorBatchId ? await ctx.tx.anchors.get(g.anchorBatchId) : undefined;
      return { grant: g, ipTitle: ip?.title ?? '', anchor: batch ?? null };
    },
  }),
};
