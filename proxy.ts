import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Reachable signed out. `/share` is the read-only preview a share link opens —
// the page itself decides what a session-less viewer may do, so gating it here
// would make every share link a login wall.
// `/forgot-password` and its route are for people who cannot sign in, so
// gating them behind a session would make them unreachable by design.
const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/invite", "/share", "/api/auth", "/api/account/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (getSessionCookie(request) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  const login = new URL("/login", request.url);
  // Same param the login page reads on success; relative-only so the redirect cannot be pointed off-site.
  login.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
