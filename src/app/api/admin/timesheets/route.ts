import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Status } from "@prisma/client";
import { sendTimesheetNotification } from "@/lib/email";

export async function GET(request: NextRequest) {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as Status | null;

    const where: { status?: Status } = {};
    if (status) {
      where.status = status;
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            hourlyRate: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "desc" },
      take: 500, // Increased limit to get more timesheets for the summary
    });

    return NextResponse.json(timesheets);
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    return NextResponse.json({ error: "Failed to fetch timesheets" }, { status: 500 });
  }
}

// POST - Create timesheet on behalf of a user (admin/supervisor only)
export async function POST(request: NextRequest) {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, projectId, date, hoursWorked, notes } = body;

    if (!userId || !projectId || !date || !hoursWorked) {
      return NextResponse.json(
        { error: "User ID, project ID, date, and hours are required" },
        { status: 400 }
      );
    }

    // Validate the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate the project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        userId,
        projectId,
        date: new Date(date),
        hoursWorked: parseFloat(hoursWorked),
        notes: notes || null,
        status: "APPROVED", // Auto-approve when admin/supervisor creates directly
        lastEditedBy: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send email notification
    try {
      await sendTimesheetNotification({
        action: "created",
        timesheet: {
          id: timesheet.id,
          date: timesheet.date,
          hoursWorked: timesheet.hoursWorked,
          userName: timesheet.user.name,
          userEmail: timesheet.user.email,
          projectName: timesheet.project.name,
          status: timesheet.status,
        },
        editorName: session.user.name || "Admin/Supervisor",
      });
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
    }

    return NextResponse.json(timesheet, { status: 201 });
  } catch (error) {
    console.error("Error creating timesheet:", error);
    return NextResponse.json({ error: "Failed to create timesheet" }, { status: 500 });
  }
}
