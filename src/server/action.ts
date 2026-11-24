import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { can, isStaff, type Permission } from "@/lib/permissions";
import { getSession, type AuthContext } from "@/server/auth/session";

/** What every server action returns to the browser. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Throw from inside an action to show the user a specific message. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isNotFoundError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function fieldErrorsFrom(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

type Options = {
  /** Re-render the current page with fresh data after a successful call (default true). */
  refresh?: boolean;
};

async function run<S extends z.ZodType, R>(
  schema: S,
  raw: unknown,
  options: Options | undefined,
  execute: (input: z.output<S>) => Promise<R>,
): Promise<ActionResult<R>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: Object.keys(fieldErrors).length > 0 ? "Please check the highlighted fields." : (first?.message ?? "Invalid input."),
      fieldErrors,
    };
  }
  try {
    const data = await execute(parsed.data);
    if (options?.refresh !== false) refresh();
    return { ok: true, data };
  } catch (error) {
    // Let redirects and not-found signals through untouched.
    unstable_rethrow(error);
    if (error instanceof ActionError) return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    if (isNotFoundError(error)) return { ok: false, error: "That item no longer exists. Refresh the page and try again." };
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/** An action anyone may call (sign in, sign up, password reset). */
export function publicAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>) => Promise<R>,
  options?: Options,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => run(schema, raw, options, handler);
}

/** An action for any signed-in user. The session is re-checked on every call. */
export function userAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>, ctx: AuthContext) => Promise<R>,
  options?: Options,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const ctx = await getSession();
    if (!ctx) return { ok: false, error: "Your session has expired. Please sign in again." };
    return run(schema, raw, options, (input) => handler(input, ctx));
  };
}

/** An admin-panel action guarded by a permission. */
export function staffAction<S extends z.ZodType, R>(
  permission: Permission,
  schema: S,
  handler: (input: z.output<S>, ctx: AuthContext) => Promise<R>,
  options?: Options,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const ctx = await getSession();
    if (!ctx) return { ok: false, error: "Your session has expired. Please sign in again." };
    if (ctx.impersonatorId) return { ok: false, error: "Stop viewing as a student before making admin changes." };
    if (!isStaff(ctx.user.role) || !can(ctx.user.role, permission)) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    return run(schema, raw, options, (input) => handler(input, ctx));
  };
}
