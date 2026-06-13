import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const PinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/)
});

export async function PUT(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = PinSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "PIN harus berisi 4 sampai 8 digit." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("profiles")
    .upsert({ id: auth.user.id, pin_hash: hashPin(parsed.data.pin) }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { error } = await auth.supabase.from("profiles").update({ pin_hash: null }).eq("id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  return `sha256$${salt}$${hash}`;
}
