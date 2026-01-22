import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Get all supervisor-project assignments
export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
  }

  try {
    const assignments = await prisma.supervisorProject.findMany({
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
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching supervisor assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST - Assign supervisor to project
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, projectId } = body;

    if (!userId || !projectId) {
      return NextResponse.json({ error: "User ID and Project ID are required" }, { status: 400 });
    }

    // Verify user is a supervisor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "User must be a supervisor" }, { status: 400 });
    }

    // Check if assignment already exists
    const existing = await prisma.supervisorProject.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Supervisor is already assigned to this project" }, { status: 400 });
    }

    const assignment = await prisma.supervisorProject.create({
      data: {
        userId,
        projectId,
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("Error creating supervisor assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}

// DELETE - Remove supervisor from project
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, projectId } = body;

    if (!userId || !projectId) {
      return NextResponse.json({ error: "User ID and Project ID are required" }, { status: 400 });
    }

    await prisma.supervisorProject.delete({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    return NextResponse.json({ message: "Assignment removed successfully" });
  } catch (error) {
    console.error("Error removing supervisor assignment:", error);
    return NextResponse.json({ error: "Failed to remove assignment" }, { status: 500 });
  }
}
