import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api/auth";
import {
  buildMerchantLogoFileName,
  buildMerchantLogoPublicPath,
  validateMerchantLogo
} from "@/lib/merchant-logo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "merchant-logos");

/**
 * Accepts a multipart/form-data upload (field name `file`) from an admin and
 * stores the validated image on the local disk under
 * `public/uploads/merchant-logos`. Returns the public URL path to use as the
 * merchant's `logo_url`.
 *
 * Access is restricted to admins via {@link requireApiAdmin}; file type and
 * size are validated before anything touches the file system.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data upload." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }

  const validation = validateMerchantLogo({
    contentType: file.type,
    sizeBytes: file.size
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  const fileName = buildMerchantLogoFileName(randomUUID(), validation.extension);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan logo." }, { status: 500 });
  }

  return NextResponse.json({ url: buildMerchantLogoPublicPath(fileName) }, { status: 201 });
}
