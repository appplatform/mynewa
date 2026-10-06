import { sha256Hex } from '../crypto';
import type { AnchorClient, IdentityProvider, PasswordHasher, PaymentGateway } from '../deps';

/**
 * 결제 Mock. 금액이 0보다 크면 승인한다.
 * 테스트용 실패 규칙: 금액 끝자리가 7원이면 거절(카드 한도 초과 시뮬레이션).
 */
export const mockPayments: PaymentGateway = {
  async charge(req) {
    if (req.amountKrw <= 0) return { approved: false, paymentRef: '', failureReason: '결제 금액 오류' };
    if (req.amountKrw % 10 === 7) return { approved: false, paymentRef: '', failureReason: '카드 한도 초과(모의)' };
    return { approved: true, paymentRef: `MOCKPG-${sha256Hex(req.orderId).slice(0, 16)}` };
  },
};

/** 본인확인 Mock. 이름+생년월일+전화번호로 결정적 CI를 만든다. 전화번호가 000으로 시작하면 실패. */
export const mockIdentity: IdentityProvider = {
  async verify(req) {
    if (req.phone.replace(/\D/g, '').startsWith('000')) {
      return { verified: false, ci: '', name: req.name, birthDate: req.birthDate };
    }
    const ci = sha256Hex(`CI|${req.name}|${req.birthDate}|${req.phone.replace(/\D/g, '')}`);
    return { verified: true, ci, name: req.name, birthDate: req.birthDate };
  },
};

export const mockAnchor: AnchorClient = {
  async anchor(root) {
    return { txRef: `mock-l2:0x${sha256Hex(`tx|${root}`).slice(0, 40)}` };
  },
};

/** 데모·테스트 전용. 서버는 scrypt 기반 해셔를 주입한다. */
export const insecureDemoHasher: PasswordHasher = {
  async hash(pw) {
    return `demo$${sha256Hex(`demo-salt|${pw}`)}`;
  },
  async verify(pw, hash) {
    return hash === `demo$${sha256Hex(`demo-salt|${pw}`)}`;
  },
};
