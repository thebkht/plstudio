import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
export function middleware(request: NextRequest) { if (!getSessionCookie(request) && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/signup") && !request.nextUrl.pathname.startsWith("/invite") && !request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.redirect(new URL("/login", request.url)); return NextResponse.next(); }
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"] };
