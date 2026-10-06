import type { PasswordHasher } from '@coco/core';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));

// scrypt N=2^15, r=8, p=1 (OWASP 권장 하한 이상)
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

export const scryptHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEYLEN, PARAMS);
    return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
  },
  async verify(password, stored) {
    const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
    if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
    return key.length === expected.length && timingSafeEqual(key, expected);
  },
};
