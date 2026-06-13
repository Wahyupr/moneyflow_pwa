import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/token";


const defaultMaxAge = 60 * 60 * 24 * 7;


export function setSessionCookie(response: NextResponse, token?: string | null, expiresIn?: number | null) {
  if (!token) {
    return;
  }

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresIn ?? defaultMaxAge,
    path: "/"
  });
}
