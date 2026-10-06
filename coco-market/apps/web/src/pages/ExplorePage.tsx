import { IP_TYPES, type IPType } from '@coco/core';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useOp } from '../state/useOp';
import { IP_TYPE_LABEL } from '../ui/format';
import { Empty, PageHeader } from '../ui/kit';
import { Async } from './_parts/Async';
import { IpCard } from './_parts/IpCard';
import './pages.css';

const isIpType = (v: string | null): v is IPType => !!v && (IP_TYPES as readonly string[]).includes(v);

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const rawType = params.get('type');
  const type = isIpType(rawType) ? rawType : undefined;
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const result = useOp('catalog.listIps', { q: q || undefined, type });

  function update(next: { q?: string; type?: string }) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update({ q: text.trim() });
  }

  return (
    <div className="page">
      <PageHeader eyebrow="IP 둘러보기" title="쓰고 싶은 IP를 찾아보세요" desc="심사를 마친 IP만 보여요. 이용권마다 쓸 수 있는 용도·지역·기간이 정해져 있어요." />

      <section className="stack" aria-label="검색과 필터">
        <form className="row" role="search" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="ip-search">IP 검색</label>
          <input
            id="ip-search"
            className="input"
            style={{ flex: '1 1 220px', width: 'auto' }}
            type="search"
            placeholder="IP 이름이나 설명으로 검색"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">검색</button>
        </form>
        <fieldset className="chips" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">IP 유형</legend>
          <label className="chip-toggle">
            <input type="radio" name="ip-type" checked={!type} onChange={() => update({ type: '' })} />
            전체
          </label>
          {IP_TYPES.map((t) => (
            <label key={t} className="chip-toggle">
              <input type="radio" name="ip-type" checked={type === t} onChange={() => update({ type: t })} />
              {IP_TYPE_LABEL[t]}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-live="polite" className="stack">
        <Async {...result}>
          {(list) =>
            list.length === 0 ? (
              <Empty
                title="조건에 맞는 IP가 없어요"
                action={(q || type) && <button type="button" className="btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>조건 지우기</button>}
              >
                검색어를 바꾸거나 다른 유형을 골라 보세요.
              </Empty>
            ) : (
              <>
                <p className="faint num">{list.length}개 IP</p>
                <div className="grid-cards">{list.map((ip) => <IpCard key={ip.id} ip={ip} />)}</div>
              </>
            )
          }
        </Async>
      </section>
    </div>
  );
}
