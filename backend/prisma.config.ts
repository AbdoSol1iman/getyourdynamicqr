// Prisma CLI configuration (Prisma 7).
// This file configures how the Prisma CLI finds the schema and the database URL.
// In Prisma 7 the database URL is configured here instead of inside schema.prisma.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
