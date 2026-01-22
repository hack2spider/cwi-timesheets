import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TimesheetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/operatives/login?callbackUrl=/operatives/timesheets");
  }

  return <>{children}</>;
}
