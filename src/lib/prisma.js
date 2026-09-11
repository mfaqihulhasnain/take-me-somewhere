import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis;

function createClient() {
  const pool = new pg.Pool({
    // Keep module evaluation build-safe; every production query still requires DATABASE_URL.
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/take_me_somewhere",
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__takeMeSomewherePrisma || createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__takeMeSomewherePrisma = prisma;
}
