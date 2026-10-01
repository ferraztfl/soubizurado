import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const DEFAULT_POOL_MAX = 4;

function readPoolMax(): number {
  const value = Number(process.env.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX);

  return Number.isSafeInteger(value) && value >= 1 && value <= 20 ? value : DEFAULT_POOL_MAX;
}

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be configured before creating PrismaClient.",
    );
  }

  // The Supabase session pooler caps clients per database (EMAXCONNSESSION):
  // keep each process small (dev server + scripts share the limit) and
  // release idle connections.
  const adapter = new PrismaPg({
    connectionString,
    max: readPoolMax(),
    idleTimeoutMillis: 10_000,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  // One client (one small pool) per process, in production too: a new client
  // per call opens a new pool each time and exhausts the pooler in seconds.
  globalForPrisma.prisma = prisma;

  return prisma;
}