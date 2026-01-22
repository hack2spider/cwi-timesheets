import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Status } from "@prisma/client";
import { sendTimesheetNotification } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, hoursWorked } = body;

    // Get the original timesheet to track changes
    const originalTimesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!originalTimesheet) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      lastEditedBy: session.user.id,
    };

    // Update status if provided
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      updateData.status = status as Status;
    }

    // Update hours if provided
    if (typeof hoursWorked === "number" && hoursWorked >= 0) {
      updateData.hoursWorked = hoursWorked;
    }

    const timesheet = await prisma.timesheet.update({
      where: { id },
      data: updateData,
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

    // Send email notification for the update
    try {
      await sendTimesheetNotification({
        action: "updated",
        timesheet: {
          id: timesheet.id,
          date: timesheet.date,
          hoursWorked: timesheet.hoursWorked,
          oldHoursWorked: originalTimesheet.hoursWorked,
          userName: timesheet.user.name,
          userEmail: timesheet.user.email,
          projectName: timesheet.project.name,
          status: timesheet.status,
        },
        editorName: session.user.name || "Admin",
      });
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(timesheet);
  } catch (error) {
    console.error("Error updating timesheet:", error);
    return NextResponse.json({ error: "Failed to update timesheet" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get the timesheet before deleting for notification
    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
    }

    await prisma.timesheet.delete({
      where: { id },
    });

    // Send email notification for the deletion
    try {
      await sendTimesheetNotification({
        action: "deleted",
        timesheet: {
          id: timesheet.id,
          date: timesheet.date,
          hoursWorked: timesheet.hoursWorked,
          userName: timesheet.user.name,
          userEmail: timesheet.user.email,
          projectName: timesheet.project.name,
          status: timesheet.status,
        },
        editorName: session.user.name || "Admin",
      });
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
    }

    return NextResponse.json({ message: "Timesheet deleted" });
  } catch (error) {
    console.error("Error deleting timesheet:", error);
    return NextResponse.json({ error: "Failed to delete timesheet" }, { status: 500 });
  }
}
