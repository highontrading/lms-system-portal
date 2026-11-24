import type { Metadata } from "next";
import { KeyRound, PlugZap } from "lucide-react";
import { CodeSample, CreateApiKeyButton, RevokeApiKeyButton } from "@/components/admin/settings/api-keys";
import { ProductTypeBadge } from "@/components/product/visuals";
import { StatusDot } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/controls";
import { Callout, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate, timeAgo } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/server/url";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireStaff("integrations.manage");
  const [keys, products, { general }] = await Promise.all([
    db.apiKey.findMany({ orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }] }),
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ type: "asc" }, { title: "asc" }],
      select: { id: true, title: true, slug: true, sku: true, type: true, status: true },
    }),
    getSettings(),
  ]);

  const base = appUrl();
  const now = new Date();
  const sampleProduct = products.find((product) => product.status === "PUBLISHED")?.slug ?? products[0]?.slug ?? "your-product-slug";
  const dates = { locale: general.locale, timeZone: general.timezone };

  const grant = `curl -X POST ${base}/api/v1/enrollments \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "buyer@example.com",
    "name": "Buyer Name",
    "product": "${sampleProduct}",
    "reference": "order-123",
    "send_email": true
  }'`;

  const revoke = `curl -X DELETE ${base}/api/v1/enrollments \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "buyer@example.com", "product": "${sampleProduct}" }'`;

  const list = `curl ${base}/api/v1/products \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const noHeaders = `${base}/api/v1/enrollments?api_key=YOUR_API_KEY`;

  return (
    <div className="grid gap-8">
      <PageHeader
        className="mb-0"
        title="Integrations"
        description="Connect the places where people buy from you, so access is granted here automatically."
        actions={<CreateApiKeyButton />}
      />

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">API keys</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A key lets another platform grant or remove access on your behalf. Keys are shown once when created.
          </p>
        </div>
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No API keys yet"
            description="Create a key, then paste it into your checkout, website or automation tool."
            action={<CreateApiKeyButton />}
          />
        ) : (
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Created</Th>
                  <Th>Last used</Th>
                  <Th>Status</Th>
                  <Th aria-label="Actions" />
                </tr>
              </THead>
              <TBody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td className="font-medium">{key.name}</Td>
                    <Td>
                      <code className="font-mono text-[0.8125rem] text-muted-foreground">{key.prefix}…</code>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(key.createdAt, dates)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{key.lastUsedAt ? timeAgo(key.lastUsedAt, now) : "Never"}</Td>
                    <Td>{key.revokedAt ? <StatusDot tone="neutral">Revoked</StatusDot> : <StatusDot tone="success">Active</StatusDot>}</Td>
                    <Td className="text-right">{key.revokedAt ? null : <RevokeApiKeyButton id={key.id} name={key.name} />}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
        )}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Grant access from another platform</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            When someone pays on your website or checkout, have that platform send one request here. The buyer gets an
            account (if they don&apos;t have one), the product appears in their library, and they receive an email with a
            one-click sign-in link.
          </p>
        </div>

        <Callout tone="info" icon={<PlugZap />} title="No code needed">
          This works from the “HTTP request” / “Webhook” step in Zapier, Make, n8n and Pabbly Connect, as well as from your
          own code. Trigger it on “new payment” or “new order”.
        </Callout>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>1. Grant access</CardTitle>
              <CardDescription>
                Send this when a purchase succeeds. <code className="font-mono text-[0.8125rem]">product</code> is the
                product&apos;s slug or SKU from the table below.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3">
              <CodeSample title="POST /api/v1/enrollments" code={grant} />
              <ul className="grid gap-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">reference</span> — your order or payment ID. Sending the
                  same reference twice never grants twice, so retries are safe.
                </li>
                <li>
                  <span className="font-medium text-foreground">send_email</span> — set to <code className="font-mono">false</code>{" "}
                  if you prefer to email the buyer yourself.
                </li>
                <li>
                  <span className="font-medium text-foreground">name</span> is optional; <span className="font-medium text-foreground">email</span>{" "}
                  and <span className="font-medium text-foreground">product</span> are required.
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="grid min-w-0 content-start gap-4">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>2. Remove access (refunds)</CardTitle>
                <CardDescription>Send this when an order is refunded or cancelled.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                <CodeSample title="DELETE /api/v1/enrollments" code={revoke} />
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>List your products</CardTitle>
                <CardDescription>Returns every product with its slug and SKU.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                <CodeSample title="GET /api/v1/products" code={list} />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Tool can&apos;t set headers?</CardTitle>
            <CardDescription>
              Some checkout tools only let you enter a URL. In that case put the key in the address instead of the
              Authorization header. Prefer the header when you can — addresses are more likely to end up in logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <CodeSample title="Key in the URL" code={noHeaders} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Product identifiers</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Use either value as <code className="font-mono text-[0.8125rem]">product</code>. Set a SKU on a product&apos;s
            “Pricing &amp; access” tab to match the ID your other platform uses.
          </p>
        </div>
        {products.length === 0 ? (
          <EmptyState compact title="No products yet" description="Create a product first, then come back for its identifier." />
        ) : (
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th>Slug</Th>
                  <Th>SKU</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {products.map((product) => (
                  <Tr key={product.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium">{product.title}</span>
                        <ProductTypeBadge type={product.type} size="sm" />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-[0.8125rem]">{product.slug}</code>
                        <CopyButton value={product.slug} iconOnly label={`Copy slug ${product.slug}`} size="icon-sm" variant="ghost" />
                      </div>
                    </Td>
                    <Td>
                      {product.sku ? (
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-[0.8125rem]">{product.sku}</code>
                          <CopyButton value={product.sku} iconOnly label={`Copy SKU ${product.sku}`} size="icon-sm" variant="ghost" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      {product.status === "PUBLISHED" ? (
                        <StatusDot tone="success">Published</StatusDot>
                      ) : (
                        <StatusDot tone="neutral">Draft</StatusDot>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
        )}
      </section>
    </div>
  );
}
