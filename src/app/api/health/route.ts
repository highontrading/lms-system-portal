import { connection } from "next/server";
import { db } from "@/server/db";

/** Liveness check for uptime monitors and container health checks. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
