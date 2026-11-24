import { authenticateApiRequest } from "@/server/api-auth";
import { db } from "@/server/db";
import { absoluteUrl } from "@/server/url";

/** GET /api/v1/products — every product with the identifiers the enrolment endpoint accepts. */
export async function GET(request: Request) {
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;

  const products = await db.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, slug: true, sku: true, title: true, type: true, status: true },
  });
  return Response.json({
    products: products.map((product) => ({ ...product, url: absoluteUrl(`/catalog/${product.slug}`) })),
  });
}
