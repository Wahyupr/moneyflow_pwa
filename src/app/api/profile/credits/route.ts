import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { getCreditBalance } from "@/lib/ai-credits";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const balance = await getCreditBalance(auth.user.id);
  return NextResponse.json(balance);
}
