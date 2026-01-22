import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const timesheets = await prisma.timesheet.findMany({
      where: { userId: session.user.id },
      include: { project: true },
      orderBy: { date: "desc" },
      take: 50,
    });

    return NextResponse.json(timesheets);
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    return NextResponse.json({ error: "Failed to fetch timesheets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, date, hoursWorked, notes } = body;

    if (!projectId || !date || !hoursWorked) {
      return NextResponse.json(
        { error: "Project, date, and hours are required" },
        { status: 400 }
      );
    }

    if (hoursWorked <= 0 || hoursWorked > 24) {
      return NextResponse.json(
        { error: "Hours must be between 0 and 24" },
        { status: 400 }
      );
    }

    // Check if an entry already exists for this user, project, and date
    const existingEntry = await prisma.timesheet.findFirst({
      where: {
        userId: session.user.id,
        projectId,
        date: new Date(date),
      },
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: "You already have an entry for this project on this date" },
        { status: 400 }
      );
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        userId: session.user.id,
        projectId,
        date: new Date(date),
        hoursWorked: parseFloat(hoursWorked),
        notes: notes || null,
        status: "PENDING",
      },
      include: { project: true },
    });

    return NextResponse.json(timesheet, { status: 201 });
  } catch (error) {
    console.error("Error creating timesheet:", error);
    return NextResponse.json({ error: "Failed to create timesheet" }, { status: 500 });
  }
}
