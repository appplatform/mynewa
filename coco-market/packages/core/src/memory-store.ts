import { DomainError } from './errors';
import {
  COLLECTION_NAMES, UNIQUE_KEYS, uniqueViolation,
  type Collection, type CollectionName, type Collections, type Entity, type Store,
} from './store';

type Tables = Record<CollectionName, Map<string, Entity>>;

const clone = <T>(v: T): T => structuredClone(v);

function matches(doc: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => doc[k] === v);
}

class MemoryCollection<T extends Entity> implements Collection<T> {
  constructor(private readonly name: CollectionName, private readonly tables: () => Tables) {}

  private get map(): Map<string, T> {
    return this.tables()[this.name] as Map<string, T>;
  }

  private checkUnique(doc: T, selfId: string | null) {
    for (const key of UNIQUE_KEYS[this.name]) {
      const value = (doc as Record<string, unknown>)[key];
      if (value === null || value === undefined) continue;
      for (const other of this.map.values()) {
        if (other.id !== selfId && (other as Record<string, unknown>)[key] === value) {
          throw uniqueViolation(this.name, key);
        }
      }
    }
  }

  async get(id: string) {
    const doc = this.map.get(id);
    return doc ? clone(doc) : undefined;
  }

  async find(where: Partial<T> = {}) {
    return [...this.map.values()]
      .filter((d) => matches(d as Record<string, unknown>, where as Record<string, unknown>))
      .map(clone);
  }

  async insert(doc: T) {
    if (this.map.has(doc.id)) throw new DomainError('CONFLICT', `${this.name}.id 중복`);
    this.checkUnique(doc, null);
    this.map.set(doc.id, clone(doc));
    return clone(doc);
  }

  async update(id: string, patch: Partial<T>) {
    const current = this.map.get(id);
    if (!current) throw new DomainError('NOT_FOUND', `${this.name}/${id} 없음`);
    const next = { ...current, ...clone(patch), id } as T;
    this.checkUnique(next, id);
    this.map.set(id, next);
    return clone(next);
  }

  async delete(id: string) {
    this.map.delete(id);
  }
}

export interface MemoryStoreOptions {
  /** 커밋 후 호출된다. 브라우저 데모에서 localStorage 저장에 쓴다. */
  onCommit?: (snapshot: Record<string, Entity[]>) => void;
  initial?: Record<string, Entity[]>;
}

/**
 * 메모리 저장소. 트랜잭션은 직렬화(한 번에 하나)되고, 예외가 나면 스냅샷으로 롤백한다.
 * 테스트와 브라우저 데모 모드에서 쓴다.
 */
export class MemoryStore implements Store {
  private tables: Tables;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly cols: Collections;

  constructor(private readonly opts: MemoryStoreOptions = {}) {
    this.tables = Object.fromEntries(COLLECTION_NAMES.map((n) => [n, new Map()])) as Tables;
    if (opts.initial) {
      for (const [name, docs] of Object.entries(opts.initial)) {
        const table = this.tables[name as CollectionName];
        if (table) for (const d of docs) table.set(d.id, clone(d));
      }
    }
    this.cols = Object.fromEntries(
      COLLECTION_NAMES.map((n) => [n, new MemoryCollection(n, () => this.tables)]),
    ) as unknown as Collections;
  }

  get users() { return this.cols.users; }
  get sessions() { return this.cols.sessions; }
  get ips() { return this.cols.ips; }
  get evidence() { return this.cols.evidence; }
  get products() { return this.cols.products; }
  get grants() { return this.cols.grants; }
  get quests() { return this.cols.quests; }
  get contributions() { return this.cols.contributions; }
  get rewards() { return this.cols.rewards; }
  get merchants() { return this.cols.merchants; }
  get journal() { return this.cols.journal; }
  get journalLines() { return this.cols.journalLines; }
  get payouts() { return this.cols.payouts; }
  get disputes() { return this.cols.disputes; }
  get flags() { return this.cols.flags; }
  get approvals() { return this.cols.approvals; }
  get audit() { return this.cols.audit; }
  get anchors() { return this.cols.anchors; }

  transaction<R>(fn: (tx: Collections) => Promise<R>): Promise<R> {
    const run = async () => {
      const snapshot = this.snapshotTables();
      try {
        const result = await fn(this.cols);
        this.opts.onCommit?.(this.dump());
        return result;
      } catch (err) {
        this.tables = snapshot;
        throw err;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  dump(): Record<string, Entity[]> {
    return Object.fromEntries(COLLECTION_NAMES.map((n) => [n, [...this.tables[n].values()].map(clone)]));
  }

  private snapshotTables(): Tables {
    return Object.fromEntries(
      COLLECTION_NAMES.map((n) => [n, new Map([...this.tables[n]].map(([k, v]) => [k, clone(v)]))]),
    ) as Tables;
  }
}
