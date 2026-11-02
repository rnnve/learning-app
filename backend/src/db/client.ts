import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import { env } from "../config/env.ts";
import * as schema from "./schema.ts";

type Row = any;
type DatabaseData = Record<string, Row[]>;

interface JsonQuery extends PromiseLike<Row[]> {
  where(condition: any): this;
  orderBy(...ordering: any[]): this;
  limit(max: number): this;
  for(...args: any[]): this;
  values(input: Row | Row[]): this;
  set(updates: Row): this;
  returning(fields?: Record<string, any>): this;
  onConflictDoUpdate(value: { target: any[]; set: Row }): this;
}

interface JsonDb {
  select(fields?: Record<string, any>): { from(table: any): JsonQuery };
  insert(table: any): JsonQuery;
  update(table: any): JsonQuery;
  delete(table: any): JsonQuery;
  transaction<T>(callback: (tx: JsonDb) => Promise<T>): Promise<T>;
}

const tableNames = Object.keys(schema).filter((key) => {
  const value = (schema as Record<string, any>)[key];
  return value && typeof value === "object" && Object.values(value).some((item: any) => item?.name);
});
const jsonPath = resolve(env.JSON_DB_PATH);
const dialect = new PgDialect();
let data: DatabaseData | null = null;
let writeQueue = Promise.resolve();

function tableName(table: any): string {
  for (const key of tableNames) {
    if ((schema as Record<string, any>)[key] === table) return key;
  }
  throw new Error("Unknown JSON database table");
}

function columns(table: any): Record<string, any> {
  return Object.fromEntries(Object.entries(table).filter(([, value]: any) => value?.name));
}

function columnKey(table: any, columnName: string): string {
  return Object.entries(columns(table)).find(([, value]: any) => value.name === columnName)?.[0] ?? columnName;
}

function revive(table: any, row: Row): Row {
  const dateKeys = new Set(
    Object.entries(columns(table))
      .filter(([, value]: any) => value.dataType === "date")
      .map(([key]) => key),
  );
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, dateKeys.has(key) && value ? new Date(value as string) : value]),
  );
}

function serialise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Row).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

async function load(): Promise<DatabaseData> {
  if (data) return data;
  try {
    const raw = JSON.parse(await readFile(jsonPath, "utf8")) as DatabaseData;
    data = Object.fromEntries(tableNames.map((key) => [key, raw[key] || []]));
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
    data = Object.fromEntries(tableNames.map((key) => [key, []]));
  }
  return data;
}

async function persist(): Promise<void> {
  const snapshot = JSON.stringify(serialise(await load()), null, 2);
  writeQueue = writeQueue.then(async () => {
    await mkdir(dirname(jsonPath), { recursive: true });
    const temporaryPath = `${jsonPath}.tmp`;
    await writeFile(temporaryPath, snapshot, "utf8");
    await rename(temporaryPath, jsonPath);
  });
  await writeQueue;
}

function asQuery(condition: any): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(condition);
}

function compare(left: unknown, right: unknown): number {
  const a = left instanceof Date ? left.getTime() : left;
  const b = right instanceof Date ? right.getTime() : right;
  return a === b ? 0 : a! < b! ? -1 : 1;
}

function matches(table: any, row: Row, condition?: any): boolean {
  if (!condition) return true;
  const { sql, params } = asQuery(condition);
  const expressions = sql.replace(/^\(|\)$/g, "").split(/\s+(?:and|or)\s+/i);
  const joins = sql.match(/\s+(and|or)\s+/gi)?.map((item) => item.trim().toLowerCase()) || [];
  let paramIndex = 0;
  const results = expressions.map((expression) => {
    const column = expression.match(/"[^".]+"\."([^"]+)"/);
    const key = column ? columnKey(table, column[1]) : "";
    const value = row[key];
    const parameter = params[paramIndex++];
    if (/ ilike /i.test(expression)) {
      const needle = String(parameter).replaceAll("%", "").toLowerCase();
      return String(value ?? "").toLowerCase().includes(needle);
    }
    if (/ >= /.test(expression)) return compare(value, parameter) >= 0;
    if (/ <= /.test(expression)) return compare(value, parameter) <= 0;
    if (/ > /.test(expression)) return compare(value, parameter) > 0;
    if (/ < /.test(expression)) return compare(value, parameter) < 0;
    return compare(value, parameter) === 0;
  });
  return results.reduce((current, result, index) => (joins[index - 1] === "or" ? current || result : current && result), true);
}

function applyDefaults(table: any, input: Row): Row {
  const result = { ...input };
  for (const [key, column] of Object.entries(columns(table)) as [string, any][]) {
    if (result[key] !== undefined) continue;
    if (key === "id") result[key] = crypto.randomUUID();
    else if (["createdAt", "updatedAt", "startedAt", "answeredAt", "runAfter", "dueAt"].includes(key)) result[key] = new Date();
    else if (column.default !== undefined && typeof column.default !== "object") result[key] = column.default;
    else if (column.default && column.dataType === "json") result[key] = structuredClone(column.default);
    else if (column.notNull) result[key] = null;
  }
  return result;
}

function project(row: Row, fields?: Record<string, any>): Row {
  if (!fields) return row;
  return Object.fromEntries(
    Object.entries(fields).map(([key, column]: [string, any]) => [key, row[columnKey(column.table, column.name)]]),
  );
}

class Query<T> implements PromiseLike<T> {
  constructor(private readonly execute: () => Promise<T>) {}
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) { return this.execute().then(onfulfilled, onrejected); }
}

class SelectQuery extends Query<Row[]> implements JsonQuery {
  private condition: any;
  private ordering: any[] = [];
  private max?: number;
  constructor(private readonly selected: Record<string, any> | undefined, private readonly table: any) {
    super(async () => {
      const rows = (await load())[tableName(this.table)].map((row) => revive(this.table, row)).filter((row) => matches(this.table, row, this.condition));
      for (const order of this.ordering.reverse()) {
        const query = asQuery(order).sql;
        const column = query.match(/"[^".]+"\."([^"]+)"/)?.[1];
        if (column) rows.sort((a, b) => compare(a[columnKey(this.table, column)], b[columnKey(this.table, column)]) * (/ desc$/i.test(query) ? -1 : 1));
      }
      return (this.max === undefined ? rows : rows.slice(0, this.max)).map((row) => project(row, this.selected));
    });
  }
  where(condition: any) { this.condition = condition; return this; }
  orderBy(...ordering: any[]) { this.ordering = ordering; return this; }
  limit(max: number) { this.max = max; return this; }
  for(..._args: any[]) { return this; }
  values() { return this; }
  set() { return this; }
  returning() { return this; }
  onConflictDoUpdate() { return this; }
}

class InsertQuery extends Query<Row[]> implements JsonQuery {
  private inputs: Row[] = [];
  private returned?: Record<string, any>;
  private conflict?: { target: any[]; set: Row };
  constructor(private readonly table: any) {
    super(async () => {
      const rows = (await load())[tableName(this.table)];
      const inserted: Row[] = [];
      for (const input of this.inputs) {
        const item = applyDefaults(this.table, input);
        const existing = this.conflict?.target ? rows.find((row) => this.conflict!.target.every((column) => row[columnKey(this.table, column.name)] === item[columnKey(this.table, column.name)])) : undefined;
        if (existing) {
          Object.assign(existing, this.resolveUpdates(existing, this.conflict!.set));
          inserted.push(revive(this.table, existing));
        } else {
          rows.push(serialise(item) as Row);
          inserted.push(item);
        }
      }
      await persist();
      return inserted.map((row) => project(row, this.returned));
    });
  }
  private resolveUpdates(row: Row, updates: Row): Row {
    return Object.fromEntries(Object.entries(updates).map(([key, value]) => {
      if (value?.constructor?.name === "SQL" && /\+/.test(asQuery(value).sql)) return [key, Number(row[key] || 0) + 1];
      return [key, value];
    }));
  }
  values(input: Row | Row[]) { this.inputs = Array.isArray(input) ? input : [input]; return this; }
  returning(fields?: Record<string, any>) { this.returned = fields; return this; }
  onConflictDoUpdate(value: { target: any[]; set: Row }) { this.conflict = value; return this; }
  where() { return this; }
  orderBy() { return this; }
  limit() { return this; }
  for() { return this; }
  set() { return this; }
}

class UpdateQuery extends Query<Row[]> implements JsonQuery {
  private updates: Row = {};
  private condition: any;
  private returned?: Record<string, any>;
  constructor(private readonly table: any) {
    super(async () => {
      const rows = (await load())[tableName(this.table)];
      const updated: Row[] = [];
      for (const stored of rows) {
        const row = revive(this.table, stored);
        if (!matches(this.table, row, this.condition)) continue;
        for (const [key, value] of Object.entries(this.updates)) if (value?.constructor?.name !== "SQL") row[key] = value;
        Object.assign(stored, serialise(row));
        updated.push(row);
      }
      await persist();
      return updated.map((row) => project(row, this.returned));
    });
  }
  set(updates: Row) { this.updates = updates; return this; }
  where(condition: any) { this.condition = condition; return this; }
  returning(fields?: Record<string, any>) { this.returned = fields; return this; }
  orderBy() { return this; }
  limit() { return this; }
  for() { return this; }
  values() { return this; }
  onConflictDoUpdate() { return this; }
}

class DeleteQuery extends Query<Row[]> implements JsonQuery {
  private condition: any;
  private returned?: Record<string, any>;
  constructor(private readonly table: any) {
    super(async () => {
      const store = await load();
      const rows = store[tableName(this.table)];
      const deleted = rows.filter((row) => matches(this.table, revive(this.table, row), this.condition));
      store[tableName(this.table)] = rows.filter((row) => !matches(this.table, revive(this.table, row), this.condition));
      await persist();
      return deleted.map((row) => project(revive(this.table, row), this.returned));
    });
  }
  where(condition: any) { this.condition = condition; return this; }
  returning(fields?: Record<string, any>) { this.returned = fields; return this; }
  orderBy() { return this; }
  limit() { return this; }
  for() { return this; }
  values() { return this; }
  set() { return this; }
  onConflictDoUpdate() { return this; }
}

const db: JsonDb = {
  select: (fields?: Record<string, any>) => ({ from: (table: any) => new SelectQuery(fields, table) }),
  insert: (table: any) => new InsertQuery(table),
  update: (table: any) => new UpdateQuery(table),
  delete: (table: any) => new DeleteQuery(table),
  transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
};

export function getDb(): JsonDb { return db; }
export async function checkDbHealth(): Promise<boolean> { await load(); return true; }
export { schema };
