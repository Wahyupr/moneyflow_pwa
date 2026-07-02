// Read-only diagnostic for the Midtrans payment flow.
// Verifies DB schema drift that would make webhook/sync fail silently.
// Does NOT mutate anything and never prints the connection string.
import pg from "pg";
import { readFileSync } from "node:fs";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(".env.local", "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL not found");
  return match[1].trim();
}

const pool = new pg.Pool({
  connectionString: loadDatabaseUrl(),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const checks = {};

try {
  // 1. Does the 'pro' enum value exist on subscription_plan?
  const planEnum = await pool.query(
    `select e.enumlabel from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     where t.typname = 'subscription_plan' order by e.enumsortorder`
  );
  checks.subscription_plan_values = planEnum.rows.map((r) => r.enumlabel);

  // 2. Do the audit columns exist on subscription_entitlements?
  const entCols = await pool.query(
    `select column_name from information_schema.columns
     where table_name = 'subscription_entitlements' order by ordinal_position`
  );
  checks.subscription_entitlements_columns = entCols.rows.map((r) => r.column_name);

  // 3. Does payment_orders table exist and what columns?
  const poCols = await pool.query(
    `select column_name from information_schema.columns
     where table_name = 'payment_orders' order by ordinal_position`
  );
  checks.payment_orders_columns = poCols.rows.map((r) => r.column_name);

  // 4. Is there a unique index on subscription_entitlements(user_id)?
  const uniq = await pool.query(
    `select indexname from pg_indexes
     where tablename = 'subscription_entitlements'`
  );
  checks.subscription_entitlements_indexes = uniq.rows.map((r) => r.indexname);

  // 5. Count orders by status (are there stuck pending orders?)
  const statusCount = await pool.query(
    `select status, count(*)::int as n from payment_orders group by status`
  ).catch((e) => ({ rows: [{ error: e.message }] }));
  checks.payment_orders_status_counts = statusCount.rows;

  // 6. Is RLS enabled on the tables the API writes to? (pg driver bypasses RLS as table owner, but check anyway)
  const rls = await pool.query(
    `select relname, relrowsecurity from pg_class
     where relname in ('payment_orders','subscription_entitlements')`
  );
  checks.rls = rls.rows;

  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  console.error("DIAGNOSTIC_ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
