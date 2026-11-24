import type { Metadata } from "next";
import { Laptop, Smartphone } from "lucide-react";
import {
  AvatarForm,
  EmailPreferencesForm,
  EmailStatus,
  PasswordForm,
  ProfileForm,
  SignOutOthersButton,
} from "@/components/portal/account/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { timeAgo } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Account" };

function describeDevice(userAgent: string | null) {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /iPhone|iPad|iPod|Android|Mobile/.test(userAgent) };
}

export default async function AccountPage() {
  const ctx = await requireUser();
  const now = new Date();
  const [account, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      select: {
        name: true,
        email: true,
        headline: true,
        phone: true,
        timezone: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        passwordHash: true,
        emailAnnouncements: true,
        emailReplies: true,
        emailReminders: true,
      },
    }),
    db.session.findMany({
      where: { userId: ctx.user.id, impersonatorId: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
      take: 10,
      select: { id: true, userAgent: true, lastUsedAt: true, createdAt: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" description="Your profile, sign-in details and email preferences." />

      {ctx.impersonatorId ? (
        <Callout tone="warning" className="mb-5" title="Viewing as a student">
          You can look around, but account changes are turned off while you are viewing someone else&apos;s portal.
        </Callout>
      ) : null}

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear across the academy.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <AvatarForm name={account.name} avatarUrl={account.avatarUrl} />
            <ProfileForm
              initial={{
                name: account.name,
                headline: account.headline ?? "",
                phone: account.phone ?? "",
                timezone: account.timezone ?? "",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email address</CardTitle>
            <CardDescription>
              Access is tied to this address. If you bought something with a different email, contact support to move it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailStatus email={account.email} verified={!!account.emailVerifiedAt} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm hasPassword={!!account.passwordHash} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email preferences</CardTitle>
            <CardDescription>Sign-in and security emails are always sent.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailPreferencesForm
              initial={{
                emailAnnouncements: account.emailAnnouncements,
                emailReplies: account.emailReplies,
                emailReminders: account.emailReminders,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle>Signed-in devices</CardTitle>
              <CardDescription>Where your account is currently signed in.</CardDescription>
            </div>
            <SignOutOthersButton disabled={sessions.length <= 1} />
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {sessions.map((session) => {
                const device = describeDevice(session.userAgent);
                const current = session.id === ctx.sessionId;
                return (
                  <li key={session.id} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      {device.mobile ? <Smartphone className="size-5" aria-hidden /> : <Laptop className="size-5" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{device.label}</span>
                        {current ? (
                          <Badge variant="success" size="sm">
                            This device
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {current ? "Active now" : `Last active ${timeAgo(session.lastUsedAt, now)}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
