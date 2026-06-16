import { query } from "@/lib/db/pool";

/**
 * Minimal PostgREST-compatible query builder backed by self-hosted Postgres.
 *
 * It mirrors only the subset of the supabase-js API the app actually uses
 * (select/insert/update/upsert + eq/is/gte/lt/order/limit + single/maybeSingle/
 * head-count). Every `.eq("user_id", ...)` filter the route handlers already
 * apply is preserved verbatim, so per-user isolation that previously relied on
 * RLS now runs as explicit WHERE clauses.
 *
 * SECURITY: identifiers (table/column names) come only from trusted in-repo
 * call sites, never from request input. All *values* are bound as parameters.
 */

export type DbResult<T> = { data: T; error: { message: string } | null; count?: number };


type Filter = { op: "eq" | "is" | "gte" | "lt"; column: string; value: unknown };
type OrderSpec = { column: string; ascending: boolean };

const ALLOWED_TABLES = new Set([
  "profiles",
  "wallets",
  "wallet_members",
  "categories",
  "merchants",
  "merchant_rules",
  "transactions",
  "transfer_pairs",
  "transaction_attachments",
  "file_ingestions",
  "ai_extraction_jobs",
  "transaction_drafts",
  "budgets",
  "savings_goals",
  "recurring_rules",
  "audit_logs",
  "subscription_entitlements",
  "users",
  "wallet_invites",
  "daily_insights"
]);

function assertTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unknown table: ${table}`);
  }
}

function assertIdentifier(name: string) {
  // Defensive: column lists/selects come from in-repo literals only.
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
}

export class DatabaseClient {
  from(table: string) {
    assertTable(table);
    return new TableQuery(table);
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<DbResult<unknown>> {
    return callRpc(fn, args);
  }
}

export function createDatabaseClient() {
  return new DatabaseClient();
}

class TableQuery {
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private selectColumns = "*";
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";

  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private onConflict: string | null = null;
  private returning = false;
  private headCount = false;

  constructor(private readonly table: string) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selectColumns = columns;
    if (options?.head) {
      this.headCount = true;
    }
    // Enable the RETURNING clause for insert/update/delete (and is a no-op for
    // plain selects, which always project columns). Without this, chaining
    // `.insert(...).select(...).single()` would run with mode already set to
    // "insert" and never append RETURNING, so `.single()` would see no rows.
    this.returning = true;
    return this;
  }


  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ op: "is", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ op: "lt", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.payload = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.mode = "update";
    this.payload = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = values;
    this.onConflict = options?.onConflict ?? null;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }


  /** Resolves to exactly one row; errors (404-style) if not found. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): Promise<DbResult<any>> {
    return this.run("single");
  }

  /** Resolves to one row or null. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): Promise<DbResult<any>> {
    return this.run("maybe");
  }



  /** Allows the builder to be awaited directly (PostgREST style). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then<TResult1 = DbResult<any>, TResult2 = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onfulfilled?: ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run("many").then(onfulfilled, onrejected);
  }


  private async run(shape: "single" | "maybe" | "many"): Promise<DbResult<unknown>> {
    try {
      const built = this.build();

      if (this.headCount) {
        const result = await query<{ count: number }>(built.text, built.params);
        return { data: null, error: null, count: result.rows[0]?.count ?? 0 } as DbResult<unknown> & { count: number };
      }

      const result = await query(built.text, built.params);
      const rows = result.rows as Record<string, unknown>[];

      if (shape === "many") {
        return { data: rows, error: null };
      }

      if (rows.length === 0) {
        if (shape === "maybe") {
          return { data: null, error: null };
        }
        return { data: null, error: { message: "Row not found." } };
      }

      return { data: rows[0], error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "Database error." } };
    }
  }

  private build(): { text: string; params: unknown[] } {
    const params: unknown[] = [];

    if (this.mode === "select") {
      const where = this.buildWhere(params);
      const cols = this.headCount ? "count(*)::int as count" : this.buildSelectColumns();
      let text = `select ${cols} from ${this.table}${where}`;

      if (!this.headCount && this.orders.length > 0) {
        const orderSql = this.orders
          .map((o) => {
            assertIdentifier(o.column);
            return `${o.column} ${o.ascending ? "asc" : "desc"}`;
          })
          .join(", ");
        text += ` order by ${orderSql}`;
      }
      if (!this.headCount && this.limitCount !== null) {
        params.push(this.limitCount);
        text += ` limit $${params.length}`;
      }
      return { text, params };
    }

    if (this.mode === "insert") {
      return this.buildInsert(params, false);
    }

    if (this.mode === "upsert") {
      return this.buildInsert(params, true);
    }

    if (this.mode === "delete") {
      const where = this.buildWhere(params);
      let text = `delete from ${this.table}${where}`;
      if (this.returning) {
        text += ` returning ${this.buildSelectColumns()}`;
      }
      return { text, params };
    }


    // update

    const payload = this.payload as Record<string, unknown>;
    const setClauses = Object.keys(payload).map((key) => {
      assertIdentifier(key);
      params.push(payload[key]);
      return `${key} = $${params.length}`;
    });
    // Re-build WHERE after SET params so placeholder numbers stay correct.
    const whereForUpdate = this.buildWhere(params);
    let text = `update ${this.table} set ${setClauses.join(", ")}${whereForUpdate}`;
    if (this.returning) {
      text += ` returning ${this.buildSelectColumns()}`;
    }
    return { text, params };
  }

  private buildInsert(params: unknown[], upsert: boolean): { text: string; params: unknown[] } {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Record<string, unknown>];
    const columns = Object.keys(rows[0]);
    columns.forEach(assertIdentifier);

    const valueGroups = rows.map((row) => {
      const placeholders = columns.map((col) => {
        params.push(row[col]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    let text = `insert into ${this.table} (${columns.join(", ")}) values ${valueGroups.join(", ")}`;

    if (upsert) {
      const conflict = this.onConflict ?? "id";
      conflict.split(",").map((c) => c.trim()).forEach(assertIdentifier);
      const updates = columns
        .filter((col) => !conflict.split(",").map((c) => c.trim()).includes(col))
        .map((col) => `${col} = excluded.${col}`);
      text += ` on conflict (${conflict}) do update set ${updates.length > 0 ? updates.join(", ") : `${columns[0]} = excluded.${columns[0]}`}`;
    }

    if (this.returning) {
      text += ` returning ${this.buildSelectColumns()}`;
    }

    return { text, params };
  }

  private buildWhere(params: unknown[]): string {
    if (this.filters.length === 0) {
      return "";
    }
    const clauses = this.filters.map((filter) => {
      assertIdentifier(filter.column);
      if (filter.op === "is" && filter.value === null) {
        return `${filter.column} is null`;
      }
      const opSql = filter.op === "eq" || filter.op === "is" ? "=" : filter.op === "gte" ? ">=" : "<";
      params.push(filter.value);
      return `${filter.column} ${opSql} $${params.length}`;
    });
    return ` where ${clauses.join(" and ")}`;
  }

  private buildSelectColumns(): string {
    const cols = this.selectColumns.trim();
    if (cols === "" || cols === "*") {
      return "*";
    }
    // Plain comma-separated column list (no PostgREST embeds at this layer).
    return cols
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        assertIdentifier(c);
        return c;
      })
      .join(", ");
  }
}





const ALLOWED_RPCS: Record<string, string[]> = {
  create_internal_transfer: [
    "p_user_id",
    "p_from_wallet_id",
    "p_to_wallet_id",
    "p_amount_minor",
    "p_currency",
    "p_note",
    "p_occurred_at"
  ]
};

async function callRpc(fn: string, args: Record<string, unknown>): Promise<DbResult<unknown>> {
  const paramOrder = ALLOWED_RPCS[fn];

  if (!paramOrder) {
    return { data: null, error: { message: `Unknown function: ${fn}` } };
  }

  const params = paramOrder.map((name) => args[name] ?? null);
  const placeholders = paramOrder.map((_, index) => `$${index + 1}`).join(", ");

  try {
    const result = await query<Record<string, unknown>>(`select ${fn}(${placeholders}) as result`, params);
    return { data: result.rows[0]?.result ?? null, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Database error." } };
  }
}

