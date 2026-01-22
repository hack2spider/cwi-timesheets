import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, totalProjects, pendingTimesheets, timesheetsThisMonth] = await Promise.all([
      prisma.user.count({ where: { role: "OPERATIVE" } }),
      prisma.project.count({ where: { isActive: true } }),
      prisma.timesheet.count({ where: { status: "PENDING" } }),
      prisma.timesheet.findMany({
        where: {
          date: { gte: startOfMonth },
          status: "APPROVED",
        },
        select: { hoursWorked: true },
      }),
    ]);

    const totalHoursThisMonth = timesheetsThisMonth.reduce(
      (sum, ts) => sum + ts.hoursWorked,
      0
    );

    return NextResponse.json({
      totalUsers,
      totalProjects,
      pendingTimesheets,
      totalHoursThisMonth,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
