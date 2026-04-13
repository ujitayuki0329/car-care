import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "admin1234", 10);

  await prisma.adminAccount.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      passwordHash,
      displayName: "管理者",
    },
    update: {},
  });

  const bsExisting = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  if (!bsExisting) {
    await prisma.businessSettings.create({
      data: {
        id: "default",
        openTime: process.env.BUSINESS_OPEN_TIME ?? "09:00",
        closeTime: process.env.BUSINESS_CLOSE_TIME ?? "18:00",
        slotMinutes: parseInt(process.env.SLOT_MINUTES ?? "30", 10) || 30,
        reservationMinutes: parseInt(process.env.RESERVATION_DURATION_MINUTES ?? "60", 10) || 60,
      },
    });
  }

  for (let wd = 0; wd <= 6; wd++) {
    await prisma.weekdayRule.upsert({
      where: { weekday: wd },
      create: { weekday: wd, isClosed: false },
      update: {},
    });
  }

  const e1 = await prisma.employee.upsert({
    where: { id: "seed-emp-1" },
    create: { id: "seed-emp-1", name: "サンプル太郎", role: "整備士", active: true },
    update: {},
  });
  await prisma.employee.upsert({
    where: { id: "seed-emp-2" },
    create: { id: "seed-emp-2", name: "サンプル花子", role: "整備士", active: true },
    update: {},
  });

  console.log("Seed OK:", { admin: "admin@example.com", employees: [e1.name] });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
