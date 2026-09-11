import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses .env.local, while Prisma's default dotenv loader only reads .env.
// Load the local file first; process-level environment variables still win.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
