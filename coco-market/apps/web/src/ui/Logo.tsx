export function Logo({ size = 28 }: { size?: number }) {
  // 두 원이 겹치는 자리 = 권리자와 동네가 만나는 곳
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="20" cy="16" r="9" fill="none" stroke="var(--brand)" strokeWidth="2.6" />
    </svg>
  );
}
