import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/operatives/login?callbackUrl=/admin");
  }

  const isAdminOrSupervisor =
    session.user.role === "ADMIN" || session.user.role === "SUPERVISOR";

  if (!isAdminOrSupervisor) {
    redirect("/operatives/dashboard");
  }

  return <>{children}</>;
}
