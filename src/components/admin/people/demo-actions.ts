"use server";

import { z } from "zod";
import { staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { removeDemoContent } from "@/server/demo";

/** Deletes the sample products and sample students that ship with a fresh install. */
export const removeSampleContent = staffAction("settings.manage", z.object({}), async (_input, ctx) => {
  const removed = await removeDemoContent();
  await audit(
    ctx.user,
    "demo.remove",
    `Removed sample content (${removed.products} products, ${removed.students} sample students)`,
  );
  return removed;
});
