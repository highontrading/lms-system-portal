import type { Metadata } from "next";
import { NewProductForm } from "@/components/admin/product/new-product-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/guards";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaff("products.manage");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title="New product"
        description="Pick what you're adding. It starts as a draft — nothing is visible to students until you publish."
      />
      <NewProductForm />
    </div>
  );
}
