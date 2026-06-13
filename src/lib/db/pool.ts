import { Pool, type QueryResultRow } from "pg";


export const missingDatabaseConfigMessage = "DATABASE_URL is not configured.";

let pool: Pool | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "";
}

export function hasDatabaseConfig() {
  return Boolean(getDatabaseUrl());
}

/**
 * Returns a lazily-initialised singleton connection pool to the self-hosted
 * Postgres instance. The connection string is read from `DATABASE_URL` and is
 * never logged. SSL is enabled when `DATABASE_SSL=true` so it works both for
 * local (no SSL) and managed (SSL) Postgres.
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error(missingDatabaseConfigMessage);
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });

  return pool;
}

/**
 * Runs a parameterized query. All callers must pass values via `params` so the
 * driver handles escaping (prevents SQL injection). Never interpolate
 * user-supplied values directly into `text`.
 */
export async function query<Row extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {

  const client = getPool();
  return client.query<Row>(text, params);
}
