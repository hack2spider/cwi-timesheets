import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Lightweight edge middleware - no next-auth import
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session token from cookies
  const token = request.cookies.get("authjs.session-token")?.value
    || request.cookies.get("__Secure-authjs.session-token")?.value;

  let isLoggedIn = false;
  let userRole: string | null = null;

  if (token && process.env.NEXTAUTH_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
      const { payload } = await jwtVerify(token, secret);
      isLoggedIn = true;
      userRole = payload.role as string;
    } catch {
      // Invalid token - treat as not logged in
    }
  }

  const isAdminOrSupervisor = userRole === "ADMIN" || userRole === "SUPERVISOR";

  // Protect operative routes
  if (
    pathname.startsWith("/operatives/dashboard") ||
    pathname.startsWith("/operatives/timesheets") ||
    pathname.startsWith("/operatives/settings")
  ) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/operatives/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/operatives/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminOrSupervisor) {
      return NextResponse.redirect(new URL("/operatives/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/operatives/dashboard/:path*",
    "/operatives/timesheets/:path*",
    "/operatives/settings/:path*",
    "/admin/:path*",
  ],
};
