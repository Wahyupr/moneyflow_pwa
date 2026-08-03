// Reproduces the exact DB writes that /api/payments/sync performs, inside a
// transaction that is always ROLLED BACK. Reveals the real error that the
// route masks as "Database error." Never commits, never prints secrets.
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

const client = await pool.connect();
try {
  await client.query("begin");

  // Grab any real user id to satisfy the FK.
  const u = await client.query(`select id from users limit 1`);
  if (!u.rows[0]) { console.log("NO_USERS_IN_DB — cannot simulate"); await client.query("rollback"); process.exit(0); }
  const userId = u.rows[0].id;

  const orderId = `DIAG-${Date.now()}`;

  // Step A: insert a pending order (mimics snap route), plan = 'pro' to test enum.
  await client.query(
    `insert into payment_orders (user_id, order_id, plan, billing_cycle, amount, status)
     values ($1, $2, 'pro', 'monthly', 99000, 'pending')`,
    [userId, orderId]
  );
  const ord = await client.query(`select id, plan, billing_cycle from payment_orders where order_id = $1`, [orderId]);
  const order = ord.rows[0];
  console.log("Inserted dummy order OK:", { id: order.id, plan: order.plan });

  const fakeNotif = { order_id: orderId, transaction_status: "settlement", payment_type: "gopay", transaction_id: "TXN-DIAG" };

  // Step B: the UPDATE query from sync (FIXED: cast $1 to enum)
  try {
    await client.query(
      `update payment_orders
       set status = $1::payment_order_status, midtrans_transaction_id = $2, payment_method = $3, midtrans_raw = $4,
           paid_at = case when $1::payment_order_status = 'paid' then now() else paid_at end,
           expired_at = case when $1::payment_order_status = 'expired' then now() else expired_at end
       where id = $5`,
      ["paid", fakeNotif.transaction_id, fakeNotif.payment_type, JSON.stringify(fakeNotif), order.id]
    );
    console.log("UPDATE payment_orders OK");
  } catch (e) {
    console.log("UPDATE payment_orders FAILED:", e.message);
  }

  // Step C: the UPSERT into subscription_entitlements from sync line 175-186
  try {
    const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 1);
    await client.query(
      `insert into subscription_entitlements
         (user_id, plan, status, current_period_end, last_payment_order_id, payment_method)
       values ($1, $2, 'active', $3, $4, $5)
       on conflict (user_id) do update
         set plan = excluded.plan, status = 'active',
             current_period_end = excluded.current_period_end,
             last_payment_order_id = excluded.last_payment_order_id,
             payment_method = excluded.payment_method`,
      [userId, order.plan, endDate.toISOString(), order.id, fakeNotif.payment_type]
    );
    console.log("UPSERT subscription_entitlements OK");
  } catch (e) {
    console.log("UPSERT subscription_entitlements FAILED:", e.message);
  }

  await client.query("rollback");
  console.log("Rolled back — DB unchanged.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("SIM_ERROR:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
