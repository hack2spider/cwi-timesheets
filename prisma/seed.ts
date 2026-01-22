import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@cwi-facades.co.uk" },
    update: {},
    create: {
      email: "admin@cwi-facades.co.uk",
      password: adminPassword,
      name: "Admin User",
      role: "ADMIN",
      hourlyRate: 0,
    },
  });
  console.log("Created admin user:", admin.email);

  // Create sample supervisor
  const supervisorPassword = await bcrypt.hash("supervisor123", 10);
  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@cwi-facades.co.uk" },
    update: {},
    create: {
      email: "supervisor@cwi-facades.co.uk",
      password: supervisorPassword,
      name: "Site Supervisor",
      role: "SUPERVISOR",
      hourlyRate: 0,
    },
  });
  console.log("Created supervisor user:", supervisor.email);

  // Create sample operative
  const operativePassword = await bcrypt.hash("operative123", 10);
  const operative = await prisma.user.upsert({
    where: { email: "john.smith@cwi-facades.co.uk" },
    update: {},
    create: {
      email: "john.smith@cwi-facades.co.uk",
      password: operativePassword,
      name: "John Smith",
      role: "OPERATIVE",
      hourlyRate: 22.5,
    },
  });
  console.log("Created operative user:", operative.email);

  // Create sample projects
  const project1 = await prisma.project.upsert({
    where: { name: "Trundleys Road" },
    update: {},
    create: {
      name: "Trundleys Road",
      location: "Deptford, London",
      isActive: true,
    },
  });
  console.log("Created project:", project1.name);

  const project2 = await prisma.project.upsert({
    where: { name: "General Maintenance" },
    update: {},
    create: {
      name: "General Maintenance",
      location: "Various",
      isActive: true,
    },
  });
  console.log("Created project:", project2.name);

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
