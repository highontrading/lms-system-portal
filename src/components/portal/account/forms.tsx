"use client";

import { useState } from "react";
import { BadgeCheck, Camera, MailWarning, Trash2 } from "lucide-react";
import { resendVerification } from "@/app/(auth)/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { Avatar } from "@/components/ui/misc";
import {
  changePassword,
  setAvatar,
  signOutOtherSessions,
  updateEmailPreferences,
  updateProfile,
} from "@/server/portal/account-actions";

const COMMON_ZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
];

export function AvatarForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const save = useAction(setAvatar, { success: "Profile photo updated" });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={avatarUrl} size="xl" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <UploadButton purpose="avatar" accept="image/png,image/jpeg,image/webp,image/gif" size="sm" onUploaded={(file) => save.run({ url: file.url })}>
            <Camera />
            {avatarUrl ? "Change photo" : "Upload photo"}
          </UploadButton>
          {avatarUrl ? (
            <Button variant="ghost" size="sm" loading={save.pending} onClick={() => save.run({ url: null })}>
              <Trash2 />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF, up to 5 MB.</p>
      </div>
    </div>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: { name: string; headline: string; phone: string; timezone: string };
}) {
  const [values, setValues] = useState(initial);
  const save = useAction(updateProfile, { success: "Profile saved" });
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  function detectZone() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) setValues((current) => ({ ...current, timezone: zone }));
    } catch {
      // Leave the field as it is.
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.run(values);
      }}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={save.fieldErrors.name}>
          <Input id="name" value={values.name} onChange={set("name")} autoComplete="name" required aria-invalid={!!save.fieldErrors.name} />
        </Field>
        <Field label="Phone" htmlFor="phone" optional error={save.fieldErrors.phone}>
          <Input id="phone" type="tel" value={values.phone} onChange={set("phone")} autoComplete="tel" placeholder="+91 …" />
        </Field>
      </div>
      <Field label="Headline" htmlFor="headline" optional hint="A short line about you, shown next to your name." error={save.fieldErrors.headline}>
        <Input id="headline" value={values.headline} onChange={set("headline")} placeholder="e.g. Founder at Acme" maxLength={120} />
      </Field>
      <Field
        label="Time zone"
        htmlFor="timezone"
        optional
        hint="Live session times in emails use this zone. On the site they always follow your device."
        error={save.fieldErrors.timezone}
      >
        <div className="flex gap-2">
          <Input
            id="timezone"
            list="timezone-options"
            value={values.timezone}
            onChange={set("timezone")}
            placeholder="Asia/Kolkata"
            aria-invalid={!!save.fieldErrors.timezone}
          />
          <Button variant="secondary" onClick={detectZone} className="shrink-0">
            Detect
          </Button>
        </div>
        <datalist id="timezone-options">
          {COMMON_ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </Field>
      <div>
        <Button type="submit" loading={save.pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function EmailStatus({ email, verified }: { email: string; verified: boolean }) {
  const [sent, setSent] = useState(false);
  const resend = useAction(resendVerification, {
    onSuccess: () => setSent(true),
    success: "Confirmation email sent",
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{email}</p>
        {verified ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-success-text">
            <BadgeCheck className="size-4" aria-hidden /> Verified
          </p>
        ) : (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-warning-text">
            <MailWarning className="size-4" aria-hidden /> Not confirmed yet
          </p>
        )}
      </div>
      {!verified ? (
        <Button variant="secondary" size="sm" loading={resend.pending} disabled={sent} onClick={() => resend.run({})}>
          {sent ? "Email sent" : "Send confirmation email"}
        </Button>
      ) : null}
    </div>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const save = useAction(changePassword, {
    success: hasPassword ? "Password changed" : "Password set",
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.run({ currentPassword: hasPassword ? currentPassword : undefined, newPassword });
      }}
    >
      {!hasPassword ? (
        <p className="text-sm text-muted-foreground">
          You sign in with email codes at the moment. Set a password if you&apos;d like to use one as well.
        </p>
      ) : null}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {hasPassword ? (
          <Field label="Current password" htmlFor="current-password" error={save.fieldErrors.currentPassword}>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={!!save.fieldErrors.currentPassword}
            />
          </Field>
        ) : null}
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters." error={save.fieldErrors.newPassword}>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={!!save.fieldErrors.newPassword}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={save.pending}>
          {hasPassword ? "Change password" : "Set password"}
        </Button>
        {hasPassword ? <p className="text-xs text-muted-foreground">Changing it signs you out on your other devices.</p> : null}
      </div>
    </form>
  );
}

const PREFERENCES = [
  {
    key: "emailAnnouncements",
    label: "Announcements and product updates",
    hint: "News from the team and new versions of things you own.",
  },
  { key: "emailReminders", label: "Live session reminders", hint: "A heads-up before sessions you have access to." },
  { key: "emailReplies", label: "Replies", hint: "When someone answers your question or reviews your work." },
] as const;

type Preferences = { emailAnnouncements: boolean; emailReplies: boolean; emailReminders: boolean };

export function EmailPreferencesForm({ initial }: { initial: Preferences }) {
  const [values, setValues] = useState(initial);
  const save = useAction(updateEmailPreferences, { success: "Email preferences saved" });

  function toggle(key: keyof Preferences, checked: boolean) {
    const next = { ...values, [key]: checked };
    setValues(next);
    save.run(next);
  }

  return (
    <ul className="divide-y divide-border">
      {PREFERENCES.map((preference) => (
        <li key={preference.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
          <label htmlFor={`pref-${preference.key}`} className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">{preference.label}</span>
            <span className="block text-[0.8125rem] text-muted-foreground">{preference.hint}</span>
          </label>
          <Switch
            id={`pref-${preference.key}`}
            checked={values[preference.key]}
            onCheckedChange={(checked) => toggle(preference.key, checked)}
          />
        </li>
      ))}
    </ul>
  );
}

export function SignOutOthersButton({ disabled }: { disabled: boolean }) {
  const signOut = useAction(signOutOtherSessions, { success: "Signed out everywhere else" });
  return (
    <Button variant="secondary" size="sm" disabled={disabled} loading={signOut.pending} onClick={() => signOut.run({})}>
      Sign out everywhere else
    </Button>
  );
}
