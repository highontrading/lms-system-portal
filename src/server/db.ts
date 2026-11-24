import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at your PostgreSQL database.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** One shared client per process (and per hot-reload in development). */
export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = PrismaClient;
/** The client or an interactive transaction — lets helpers take part in a caller's transaction. */
export type DbClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0] | PrismaClient;
