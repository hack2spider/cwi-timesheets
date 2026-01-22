import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use the lightweight auth config for edge middleware
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/operatives/dashboard/:path*",
    "/operatives/timesheets/:path*",
    "/operatives/settings/:path*",
    "/admin/:path*",
  ],
};
