import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { timesheets: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  const isAdminOrSupervisor = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR";
  if (!session?.user || !isAdminOrSupervisor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, location } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Check if project with this name already exists
    const existingProject = await prisma.project.findUnique({
      where: { name },
    });

    if (existingProject) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        location: location || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
