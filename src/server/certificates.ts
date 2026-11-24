import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { randomReadable } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { absoluteUrl } from "@/server/url";
import { emitEvent } from "@/server/webhooks";

function newSerial() {
  return `${randomReadable(4)}-${randomReadable(4)}-${randomReadable(4)}`;
}

/**
 * Issues a certificate for a completed product (once per student and product).
 * The student's name and the product title are snapshotted so the certificate stays
 * accurate even if either is renamed later.
 */
export async function issueCertificate(userId: string, productId: string, options: { silent?: boolean } = {}) {
  const existing = await db.certificate.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) return existing;

  const [user, product] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, emailAnnouncements: true } }),
    db.product.findUnique({ where: { id: productId }, select: { title: true, slug: true } }),
  ]);
  if (!user || !product) return null;

  let certificate;
  try {
    certificate = await db.certificate.create({
      data: { serial: newSerial(), userId, productId, studentName: user.name, productTitle: product.title },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.certificate.findUnique({ where: { userId_productId: { userId, productId } } });
    }
    throw error;
  }

  if (!options.silent) {
    await notify(userId, {
      type: "certificate",
      title: "Your certificate is ready",
      body: `You completed ${product.title}.`,
      href: `/certificates/${certificate.serial}`,
    });
    await sendEmail(
      user.email,
      "certificate",
      emails.certificateIssued({
        name: user.name,
        productTitle: product.title,
        url: absoluteUrl(`/certificates/${certificate.serial}`),
      }),
    );
  }

  await emitEvent("certificate.issued", {
    certificateId: certificate.id,
    serial: certificate.serial,
    userId,
    productId,
    productTitle: product.title,
    verifyUrl: absoluteUrl(`/verify/${certificate.serial}`),
  });

  return certificate;
}
