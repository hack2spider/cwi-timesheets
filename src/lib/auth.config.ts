import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This is the edge-compatible auth config (no bcrypt, no prisma)
// Used by middleware for JWT verification only
export const authConfig: NextAuthConfig = {
  providers: [
    // Credentials provider stub - actual auth happens in auth.ts
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // This won't be called in middleware - just needed for types
      authorize: () => null,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const userRole = auth?.user?.role;
      const isAdminOrSupervisor = userRole === "ADMIN" || userRole === "SUPERVISOR";
      const pathname = nextUrl.pathname;

      // Protect operative routes
      if (
        pathname.startsWith("/operatives/dashboard") ||
        pathname.startsWith("/operatives/timesheets") ||
        pathname.startsWith("/operatives/settings")
      ) {
        return isLoggedIn;
      }

      // Protect admin routes - require ADMIN or SUPERVISOR role
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        if (!isAdminOrSupervisor) {
          return Response.redirect(new URL("/operatives/dashboard", nextUrl));
        }
        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "SUPERVISOR" | "OPERATIVE";
      }
      return session;
    },
  },
  pages: {
    signIn: "/operatives/login",
  },
  session: {
    strategy: "jwt",
  },
};
