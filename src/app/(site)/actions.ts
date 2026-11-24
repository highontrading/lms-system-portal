"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { grantAccess, seatsRemaining } from "@/server/access";
import { ActionError, userAction } from "@/server/action";
import { db } from "@/server/db";

/** Adds a free product to the signed-in student's library. Paid products are only granted by the owner or the API. */
export const joinFreeProduct = userAction(
  z.object({ productId: z.string().min(1) }),
  async ({ productId }, { user }) => {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true, price: true, status: true, visibility: true, seatLimit: true },
    });
    if (!product || product.status !== "PUBLISHED" || product.visibility === "PRIVATE") {
      throw new ActionError("This product isn't available right now.");
    }
    if (product.price > 0) throw new ActionError("This product isn't free. Access is granted after purchase.");
    const seats = await seatsRemaining(product);
    if (seats !== null && seats <= 0) throw new ActionError("Sorry, all seats are taken.");

    await grantAccess({ userId: user.id, productId: product.id, source: "FREE" });
    redirect(`/learn/${product.slug}`);
  },
  { refresh: false },
);
