/** 사업자등록번호(10자리) 검증번호 확인. 하이픈은 무시한다. 진위(휴·폐업)는 국세청 조회로 별도 확인한다. */
export function isValidBusinessNumber(input: string): boolean {
  const digits = input.replace(/-/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  const d = digits.split('').map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i]! * w[i]!;
  sum += Math.floor((d[8]! * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === d[9];
}

export function normalizeBusinessNumber(input: string): string {
  const d = input.replace(/-/g, '');
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 만 나이 */
export function ageOn(birthDate: string, on: Date): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

export function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}
