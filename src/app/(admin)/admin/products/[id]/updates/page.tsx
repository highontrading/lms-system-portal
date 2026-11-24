import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpdatesManager } from "@/components/admin/content/updates-manager";
import { formatDate } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { sanitizeRichText } from "@/server/sanitize";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Updates" };

export default async function ProductUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;
  const now = new Date();

  const [product, audience, { general }] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: { id: true, version: true, updates: { orderBy: { publishedAt: "desc" } } },
    }),
    db.enrollment.count({
      where: { productId: id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }),
    getSettings(),
  ]);
  if (!product) notFound();

  return (
    <UpdatesManager
      productId={product.id}
      currentVersion={product.version ?? ""}
      audience={audience}
      updates={product.updates.map((update) => ({
        id: update.id,
        version: update.version ?? "",
        title: update.title,
        // Sanitised here because the list renders it as HTML in the browser.
        body: sanitizeRichText(update.body),
        publishedLabel: formatDate(update.publishedAt, { style: "long", locale: general.locale, timeZone: general.timezone }),
      }))}
    />
  );
}
