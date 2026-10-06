import { DomainError, type Collection, type CollectionName, type Collections, type Entity, type Store } from '@coco/core';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { tables } from './schema';

type Db = NodePgDatabase<Record<string, never>>;
type AnyTable = PgTable & Record<string, unknown>;

const SERIALIZATION_FAILURE = '40001';
const DEADLOCK = '40P01';
const UNIQUE_VIOLATION = '23505';
const MAX_RETRIES = 5;

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

function columnsOf(table: AnyTable): Record<string, PgColumn> {
  const out: Record<string, PgColumn> = {};
  for (const [k, v] of Object.entries(table)) {
    if (v && typeof v === 'object' && 'columnType' in (v as object)) out[k] = v as PgColumn;
  }
  return out;
}

/** 읽기: Date → ISO 문자열 (core는 날짜를 ISO 문자열로 다룬다) */
function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out as T;
}

/** 쓰기: timestamp 컬럼의 ISO 문자열 → Date */
function toRow(cols: Record<string, PgColumn>, doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    const col = cols[k];
    if (!col) throw new Error(`unknown column ${k}`);
    out[k] = col.columnType === 'PgTimestamp' && typeof v === 'string' ? new Date(v) : v;
  }
  return out;
}

class PgCollection<T extends Entity> implements Collection<T> {
  private readonly cols: Record<string, PgColumn>;
  constructor(private readonly db: Db, private readonly name: CollectionName, private readonly table: AnyTable) {
    this.cols = columnsOf(table);
  }

  private where(where: Record<string, unknown>): SQL | undefined {
    const conds = Object.entries(where).map(([k, v]) => {
      const col = this.cols[k];
      if (!col) throw new Error(`unknown filter column ${this.name}.${k}`);
      return v === null ? isNull(col) : eq(col, col.columnType === 'PgTimestamp' && typeof v === 'string' ? new Date(v) : v);
    });
    return conds.length ? and(...conds) : undefined;
  }

  private async wrap<R>(fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION) throw new DomainError('CONFLICT', `${this.name}: 이미 존재하는 값입니다.`);
      throw err;
    }
  }

  async get(id: string) {
    const rows = await this.db.select().from(this.table).where(eq(this.cols.id!, id)).limit(1);
    return rows[0] ? fromRow<T>(rows[0] as Record<string, unknown>) : undefined;
  }

  async find(where: Partial<T> = {}) {
    const rows = await this.db.select().from(this.table).where(this.where(where as Record<string, unknown>));
    return rows.map((r) => fromRow<T>(r as Record<string, unknown>));
  }

  async insert(doc: T) {
    return this.wrap(async () => {
      const rows = await this.db.insert(this.table).values(toRow(this.cols, doc as unknown as Record<string, unknown>)).returning();
      return fromRow<T>(rows[0] as Record<string, unknown>);
    });
  }

  async update(id: string, patch: Partial<T>) {
    const { id: _ignored, ...rest } = patch as Record<string, unknown>;
    return this.wrap(async () => {
      const rows = await this.db.update(this.table).set(toRow(this.cols, rest)).where(eq(this.cols.id!, id)).returning();
      if (!rows[0]) throw new DomainError('NOT_FOUND', `${this.name}/${id} 없음`);
      return fromRow<T>(rows[0] as Record<string, unknown>);
    });
  }

  async delete(id: string) {
    await this.db.delete(this.table).where(eq(this.cols.id!, id));
  }
}

function collectionsFor(db: Db): Collections {
  const make = <K extends CollectionName>(name: K) =>
    new PgCollection(db, name, tables[name] as unknown as AnyTable) as unknown as Collections[K];
  return {
    users: make('users'), sessions: make('sessions'), ips: make('ips'), evidence: make('evidence'), products: make('products'),
    grants: make('grants'), quests: make('quests'), contributions: make('contributions'), rewards: make('rewards'),
    merchants: make('merchants'), journal: make('journal'), journalLines: make('journalLines'), payouts: make('payouts'),
    disputes: make('disputes'), flags: make('flags'), approvals: make('approvals'), audit: make('audit'), anchors: make('anchors'),
  };
}

/**
 * PostgreSQL 저장소. 모든 작업은 SERIALIZABLE 트랜잭션으로 실행하고,
 * 직렬화 충돌(40001)·교착(40P01)이면 처음부터 다시 실행한다.
 * 독점 이용권 중복 판매, 출금 이중 승인 같은 경쟁 상태를 DB가 막는다.
 */
export class PgStore implements Store {
  private readonly cols: Collections;
  constructor(private readonly db: Db) {
    this.cols = collectionsFor(db);
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

  async transaction<R>(fn: (tx: Collections) => Promise<R>): Promise<R> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.transaction((tx) => fn(collectionsFor(tx as unknown as Db)), { isolationLevel: 'serializable' });
      } catch (err) {
        const code = pgCode(err);
        if ((code === SERIALIZATION_FAILURE || code === DEADLOCK) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 10 * attempt + Math.random() * 20));
          continue;
        }
        if (code === UNIQUE_VIOLATION) throw new DomainError('CONFLICT', '이미 처리된 요청이거나 중복된 값입니다.');
        throw err;
      }
    }
  }
}
