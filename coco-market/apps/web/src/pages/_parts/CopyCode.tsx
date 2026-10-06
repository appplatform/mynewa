import { useState } from 'react';

/** 온보딩 코드처럼 짧은 값을 크게 보여 주고 복사 버튼을 단다. */
export function CopyCode({ label, value }: { label: string; value: string }) {
  const [msg, setMsg] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMsg('복사했어요.');
    } catch {
      setMsg('복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.');
    }
  }
  return (
    <div className="code-box">
      <span className="label">{label}</span>
      <div className="row">
        <code className="code-value mono">{value}</code>
        <button type="button" className="btn btn-sm" onClick={copy}>코드 복사</button>
      </div>
      <span className="faint" role="status" aria-live="polite" style={{ fontSize: 'var(--fs-xs)' }}>{msg}</span>
    </div>
  );
}
