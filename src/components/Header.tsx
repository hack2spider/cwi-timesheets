"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "./ui/Button";

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <header className="bg-primary text-white shadow-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">
              CWI Facades
            </Link>

            {status === "authenticated" && (
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/operatives/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/operatives/dashboard")
                      ? "bg-primary-hover"
                      : "hover:bg-primary-hover"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/operatives/timesheets"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/operatives/timesheets")
                      ? "bg-primary-hover"
                      : "hover:bg-primary-hover"
                  }`}
                >
                  My Timesheets
                </Link>
                {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR") && (
                  <>
                    <Link
                      href="/admin"
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        pathname === "/admin" ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      {session?.user?.role === "SUPERVISOR" ? "Supervisor" : "Admin"}
                    </Link>
                    <Link
                      href="/admin/timesheets"
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        isActive("/admin/timesheets") ? "bg-green-600" : "hover:bg-green-600"
                      }`}
                    >
                      Timesheets Summary
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {status === "authenticated" ? (
              <>
                <Link
                  href="/operatives/settings"
                  className={`text-sm hover:underline ${
                    isActive("/operatives/settings") ? "underline font-medium" : ""
                  }`}
                >
                  {session?.user?.name}
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => signOut({ callbackUrl: "/operatives/login" })}
                  className="text-sm"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link
                href="/operatives/login"
                className="px-3 py-2 rounded-md text-sm font-medium bg-accent hover:bg-accent-hover"
              >
                Operatives Login
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
