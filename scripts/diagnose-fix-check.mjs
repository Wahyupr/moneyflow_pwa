// Confirms the fix hypothesis: casting $1 to the enum type resolves the
// "inconsistent types deduced" error. Always rolls back.
import pg from "pg";
import { readFileSync } from "node:fs";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(".env.local", "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL not found");
  return m[1].trim();
}

const pool = new pg.Pool({
  connectionString: loadDatabaseUrl(),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query("begin");
  const u = await client.query(`select id from users limit 1`);
  const userId = u.rows[0].id;
  const orderId = `DIAG2-${Date.now()}`;
  await client.query(
    `insert into payment_orders (user_id, order_id, plan, billing_cycle, amount, status)
     values ($1,$2,'pro','monthly',99000,'pending')`, [userId, orderId]);
  const ord = await client.query(`select id from payment_orders where order_id=$1`, [orderId]);
  const id = ord.rows[0].id;

  // FIXED query: cast $1 to the enum type once; the CASE comparisons then work.
  try {
    await client.query(
      `update payment_orders
       set status = $1::payment_order_status, midtrans_transaction_id = $2, payment_method = $3, midtrans_raw = $4,
           paid_at = case when $1::payment_order_status = 'paid' then now() else paid_at end,
           expired_at = case when $1::payment_order_status = 'expired' then now() else expired_at end
       where id = $5`,
      ["paid", "TXN", "gopay", JSON.stringify({ ok: true }), id]);
    console.log("FIXED UPDATE OK");
  } catch (e) {
    console.log("FIXED UPDATE FAILED:", e.message);
  }
  await client.query("rollback");
  console.log("Rolled back.");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ERR:", e.message);
} finally {
  client.release();
  await pool.end();
}
