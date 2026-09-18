import { PrismaClient } from "@prisma/client";

// Vercel's Postgres integration doesn't always name the connection string
// DATABASE_URL (it can be POSTGRES_PRISMA_URL/POSTGRES_URL depending on the
// provider) — accept those too so wiring up the integration doesn't also
// require renaming its env var.
if (!process.env.DATABASE_URL) {
  const fallback = process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
  if (fallback) process.env.DATABASE_URL = fallback;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
