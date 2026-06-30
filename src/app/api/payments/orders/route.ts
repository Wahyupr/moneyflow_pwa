import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export type PaymentOrder = {
  id: string;
  order_id: string;
  plan: string;
  billing_cycle: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired";
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  try {
    const result = await query<PaymentOrder>(
      `select
         id,
         order_id,
         plan,
         billing_cycle,
         amount,
         status,
         payment_method,
         paid_at,
         created_at
       from payment_orders
       where user_id = $1
       order by created_at desc
       limit 50`,
      [auth.user.id]
    );

    return NextResponse.json({ orders: result.rows });
  } catch (err) {
    console.error("[payments/orders] DB query failed:", err);
    return NextResponse.json({ error: "Gagal memuat riwayat pembayaran." }, { status: 500 });
  }
}
