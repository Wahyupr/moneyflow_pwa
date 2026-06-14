import { Pool, type QueryResultRow } from "pg";


export const missingDatabaseConfigMessage = "DATABASE_URL is not configured.";

/**
 * The pool is stored on `globalThis` rather than a module-level `let`. In
 * Next.js dev, hot-module reloading re-evaluates modules on nearly every
 * request, which would otherwise discard the singleton and force a brand-new
 * Pool — paying a full TCP + TLS + auth handshake to Postgres before each
 * first query (the main cause of multi-second API latency, especially with
 * remote/SSL databases). Pinning it to `globalThis` keeps connections warm and
 * reused across reloads.
 */
const globalForPool = globalThis as typeof globalThis & { __financeAppPgPool?: Pool };

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
  if (globalForPool.__financeAppPgPool) {
    return globalForPool.__financeAppPgPool;
  }

  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error(missingDatabaseConfigMessage);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Keep idle connections alive long enough to be reused across requests so
    // we don't repeatedly pay the connection handshake.
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
    // Detect dead connections without blocking new queries.
    keepAlive: true
  });

  // Avoid crashing the process if an idle backend connection drops.
  pool.on("error", () => {
    /* swallow idle-client errors; pg will reconnect on next acquire */
  });

  globalForPool.__financeAppPgPool = pool;
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
