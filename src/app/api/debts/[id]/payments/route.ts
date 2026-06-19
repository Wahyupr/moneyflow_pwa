import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const PaymentSchema = z.object({
  amount_minor: z.number().int().positive(),
  paid_at: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional(),
  // Optional integration: also record this payment as an expense transaction
  // that reduces the chosen wallet balance. When record_transaction is false
  // (or wallet_id omitted) the payment is only tracked against the debt.
  record_transaction: z.boolean().optional(),
  wallet_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  merchant_name: z.string().max(120).nullable().optional()
});

async function requirePremium(userId: string) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active'",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium";
  return canAccessHutangPiutang(plan);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const { id } = await params;
  const parsed = PaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembayaran tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  const owning = await query<{ total: string; paid: string; name: string; creditor_name: string }>(
    `select d.total_amount_minor::text as total,
            coalesce((select sum(amount_minor) from debt_payments where debt_id = d.id), 0)::text as paid,
            d.name, d.creditor_name
       from debts d
      where d.id = $1 and d.user_id = $2 and d.status = 'active'`,
    [id, auth.user.id]
  );

  if (owning.rows.length === 0) {
    return NextResponse.json({ error: "Hutang tidak ditemukan." }, { status: 404 });
  }

  const occurredAt = input.paid_at ?? new Date().toISOString();

  // Optionally record the payment as an expense transaction that reduces the
  // chosen wallet balance. This is opt-in: some payments aren't tracked in a
  // wallet (e.g. auto-debit accounts the user doesn't manage here).
  let recordedTransactionId: string | null = null;
  if (input.record_transaction && input.wallet_id) {
    // Verify wallet access (owned or shared member) before inserting.
    const walletCheck = await query(
      `select id from wallets w
        where w.id = $1 and w.archived_at is null
          and (
            w.user_id = $2
            or exists (select 1 from wallet_members wm where wm.wallet_id = w.id and wm.user_id = $2)
          )`,
      [input.wallet_id, auth.user.id]
    );
    if (walletCheck.rows.length === 0) {
      return NextResponse.json({ error: "Dompet tidak ditemukan atau tidak punya akses." }, { status: 403 });
    }

    const merchantName = input.merchant_name?.trim() || owning.rows[0].creditor_name;
    const inserted = await query<{ id: string }>(
      `insert into transactions
         (user_id, wallet_id, category_id, transaction_type, amount_minor, currency,
          occurred_at, merchant_name, note, input_method)
       values ($1, $2, $3, 'expense', $4, 'IDR', $5, $6, $7, 'manual')
       returning id`,
      [
        auth.user.id,
        input.wallet_id,
        input.category_id ?? null,
        input.amount_minor,
        occurredAt,
        merchantName,
        input.notes?.trim() || `Bayar hutang: ${owning.rows[0].name}`
      ]
    );
    recordedTransactionId = inserted.rows[0]?.id ?? null;
  }

  await query(
    `insert into debt_payments (debt_id, amount_minor, paid_at, notes)
     values ($1, $2, $3, $4)`,
    [id, input.amount_minor, occurredAt, input.notes?.trim() ?? null]
  );

  const total = Number(owning.rows[0].total);
  const paid = Number(owning.rows[0].paid) + input.amount_minor;
  if (paid >= total) {
    await query("update debts set status = 'paid' where id = $1", [id]);
  }

  return NextResponse.json(
    {
      ok: true,
      paid_amount_minor: paid,
      remaining_amount_minor: Math.max(0, total - paid),
      transaction_id: recordedTransactionId
    },
    { status: 201 }
  );
}
