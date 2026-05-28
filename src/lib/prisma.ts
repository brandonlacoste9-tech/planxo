import { PrismaClient } from "@prisma/client";
import { validateDataLayerEnv } from "@/lib/env";

validateDataLayerEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
