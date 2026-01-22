import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const isAdminOrSupervisor = userRole === "ADMIN" || userRole === "SUPERVISOR";

  // Protect operative routes (dashboard, timesheets, settings)
  if (pathname.startsWith("/operatives/dashboard") ||
      pathname.startsWith("/operatives/timesheets") ||
      pathname.startsWith("/operatives/settings")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/operatives/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin routes - allow both ADMIN and SUPERVISOR
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/operatives/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdminOrSupervisor) {
      return NextResponse.redirect(new URL("/operatives/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/operatives/dashboard/:path*", "/operatives/timesheets/:path*", "/operatives/settings/:path*", "/admin/:path*"],
};
