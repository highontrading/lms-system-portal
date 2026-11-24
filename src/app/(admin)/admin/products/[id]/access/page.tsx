import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessForm } from "@/components/admin/product/access-form";
import { fromMinorUnits } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Access" };

export default async function ProductAccessPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;

  const [product, { general }] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        visibility: true,
        price: true,
        checkoutUrl: true,
        sku: true,
        accessDays: true,
        seatLimit: true,
        sequential: true,
        certificateEnabled: true,
        completionPercent: true,
        licenseKeysEnabled: true,
        bundleItems: { orderBy: { position: "asc" }, select: { productId: true } },
      },
    }),
    getSettings(),
  ]);
  if (!product) notFound();

  const [activeSeats, bundleChoices] = await Promise.all([
    db.enrollment.count({
      where: { productId: id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),
    product.type === "BUNDLE"
      ? db.product.findMany({
          where: { type: { not: "BUNDLE" }, id: { not: id }, status: { not: "ARCHIVED" } },
          orderBy: { title: "asc" },
          select: { id: true, title: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AccessForm
      key={product.id}
      productId={product.id}
      type={product.type}
      visibility={product.visibility}
      currency={general.currency}
      locale={general.locale}
      activeSeats={activeSeats}
      bundleChoices={bundleChoices}
      initial={{
        checkoutUrl: product.checkoutUrl ?? "",
        priceText: product.price ? String(fromMinorUnits(product.price, general.currency)) : "",
        sku: product.sku ?? "",
        limited: product.accessDays !== null,
        accessDays: product.accessDays ? String(product.accessDays) : "",
        seatsLimited: product.seatLimit !== null,
        seatLimit: product.seatLimit ? String(product.seatLimit) : "",
        sequential: product.sequential,
        certificateEnabled: product.certificateEnabled,
        completionPercent: String(product.completionPercent),
        licenseKeysEnabled: product.licenseKeysEnabled,
        bundleProductIds: product.bundleItems.map((item) => item.productId),
      }}
    />
  );
}
