import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetManager } from "@/components/admin/content/asset-manager";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Files & links" };

export default async function ProductFilesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, assets: { where: { lessonId: null }, orderBy: { position: "asc" } } },
  });
  if (!product) notFound();

  return (
    <AssetManager
      productId={product.id}
      lessonId={null}
      showVersion
      title="Files & links"
      description="What buyers get: downloadable files, links to tools or docs, and snippets to copy. Shown on the product's page in their library."
      emptyTitle="No deliverables yet"
      emptyDescription="Add the workflow file, agent export, template, prompt or access link people receive with this product."
      assets={product.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        title: asset.title,
        description: asset.description,
        version: asset.version,
        url: asset.url,
        fileKey: asset.fileKey,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        content: asset.content,
        language: asset.language,
        downloadCount: asset.downloadCount,
      }))}
    />
  );
}
