import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Vercel などサーバーレスでも同一インスタンス内で接続を再利用しやすくする */
export const prisma = globalForPrisma.prisma ?? createPrisma();

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
