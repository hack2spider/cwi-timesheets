import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (no providers, no bcrypt, no prisma)
// Only used by middleware for JWT verification
export const authConfig: NextAuthConfig = {
  providers: [], // Empty - actual providers are in auth.ts
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
