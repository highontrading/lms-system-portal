"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus, CircleCheck, Pencil, Plus, Trash2, Upload, Users, Video } from "lucide-react";
import type { LiveStatus, VideoProvider } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { LIVE_STATUS_LABELS } from "@/lib/labels";
import { detectVideoProvider, VIDEO_PROVIDER_LABELS } from "@/lib/video";
import { deleteLiveSession, saveLiveSession } from "@/server/admin/content";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/ui/controls";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";

export type SessionRow = {
  id: string;
  title: string;
  description: string;
  /** `datetime-local` value in the site's time zone. */
  startsAtLocal: string;
  /** Human-readable start, already formatted in the site's time zone. */
  startsAtLabel: string;
  isPast: boolean;
  durationMinutes: number;
  platform: string;
  meetingUrl: string;
  meetingPasscode: string;
  status: LiveStatus;
  recordingProvider: VideoProvider | null;
  recordingUrl: string;
  attendees: number;
};

const STATUS_VARIANTS: Record<LiveStatus, BadgeProps["variant"]> = {
  SCHEDULED: "info",
  LIVE: "danger",
  ENDED: "neutral",
  CANCELLED: "warning",
};

function SessionDialog({
  productId,
  session,
  timeZone,
  defaultStart,
  open,
  onOpenChange,
}: {
  productId: string;
  session: SessionRow | null;
  timeZone: string;
  defaultStart: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(session?.title ?? "");
  const [description, setDescription] = useState(session?.description ?? "");
  const [startsAtLocal, setStartsAtLocal] = useState(session?.startsAtLocal ?? defaultStart);
  const [duration, setDuration] = useState(String(session?.durationMinutes ?? 60));
  const [platform, setPlatform] = useState(session?.platform ?? "");
  const [meetingUrl, setMeetingUrl] = useState(session?.meetingUrl ?? "");
  const [meetingPasscode, setMeetingPasscode] = useState(session?.meetingPasscode ?? "");
  const [status, setStatus] = useState<LiveStatus>(session?.status ?? "SCHEDULED");
  const [recordingProvider, setRecordingProvider] = useState<VideoProvider | null>(session?.recordingProvider ?? null);
  const [recordingUrl, setRecordingUrl] = useState(session?.recordingUrl ?? "");

  const save = useAction(saveLiveSession, {
    success: session ? "Session saved" : "Session scheduled",
    onSuccess: () => onOpenChange(false),
  });
  const errors = save.fieldErrors;
  const uploaded = recordingProvider === "UPLOAD" && !!recordingUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            save.run({
              productId,
              sessionId: session?.id,
              title,
              description,
              startsAtLocal,
              durationMinutes: Math.round(Number(duration) || 0),
              platform,
              meetingUrl: meetingUrl.trim(),
              meetingPasscode,
              status,
              recordingProvider,
              recordingUrl: recordingUrl.trim(),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{session ? "Edit live session" : "Schedule a live session"}</DialogTitle>
            <DialogDescription>Students see the time in their own time zone and get a join button shortly before it starts.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <Field label="Session title" htmlFor="session-title" error={errors.title}>
              <Input
                id="session-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Session 1 — Design the agent"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <Field label="Starts" htmlFor="session-start" error={errors.startsAtLocal} hint={`Time zone: ${timeZone.replace(/_/g, " ")}`}>
                <Input
                  id="session-start"
                  type="datetime-local"
                  value={startsAtLocal}
                  onChange={(event) => setStartsAtLocal(event.target.value)}
                  required
                />
              </Field>
              <Field label="Length (min)" htmlFor="session-duration" error={errors.durationMinutes}>
                <Input
                  id="session-duration"
                  type="number"
                  min={5}
                  max={1440}
                  inputMode="numeric"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Platform" htmlFor="session-platform" optional>
                <Input
                  id="session-platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  placeholder="Zoom, Google Meet, YouTube Live…"
                />
              </Field>
              <Field label="Status" htmlFor="session-status">
                <Select id="session-status" value={status} onChange={(event) => setStatus(event.target.value as LiveStatus)}>
                  {(Object.keys(LIVE_STATUS_LABELS) as LiveStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {LIVE_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <Field label="Join link" htmlFor="session-url" error={errors.meetingUrl} optional hint="Only shown to people with access.">
                <Input
                  id="session-url"
                  type="url"
                  inputMode="url"
                  value={meetingUrl}
                  onChange={(event) => setMeetingUrl(event.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Passcode" htmlFor="session-passcode" optional>
                <Input id="session-passcode" value={meetingPasscode} onChange={(event) => setMeetingPasscode(event.target.value)} />
              </Field>
            </div>
            <Field label="Description" htmlFor="session-description" optional>
              <Textarea
                id="session-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What you'll cover and how to prepare"
              />
            </Field>

            <div className="grid gap-3 rounded-lg border border-border bg-subtle/60 p-3 sm:p-4">
              <div>
                <p className="text-sm font-medium">Replay</p>
                <p className="text-[0.8125rem] text-muted-foreground">Add the recording afterwards so students can rewatch it.</p>
              </div>
              {uploaded ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm">
                    <CircleCheck className="size-4 text-success" /> Recording uploaded
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRecordingUrl("");
                      setRecordingProvider(null);
                    }}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              ) : (
                <Field
                  label="Recording link"
                  htmlFor="session-recording"
                  error={errors.recordingUrl}
                  optional
                  hint={recordingProvider && recordingUrl ? `Detected: ${VIDEO_PROVIDER_LABELS[recordingProvider]}` : undefined}
                >
                  <Input
                    id="session-recording"
                    type="url"
                    inputMode="url"
                    value={recordingUrl}
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      setRecordingUrl(value);
                      setRecordingProvider(value ? (detectVideoProvider(value) ?? "URL") : null);
                    }}
                    placeholder="YouTube, Vimeo or a direct video link"
                  />
                </Field>
              )}
              <UploadButton
                purpose="private"
                accept="video/*"
                size="sm"
                className="w-fit"
                onUploaded={(file) => {
                  setRecordingProvider("UPLOAD");
                  setRecordingUrl(file.url);
                  if (status === "SCHEDULED" || status === "LIVE") setStatus("ENDED");
                }}
              >
                <Upload /> {uploaded ? "Replace recording" : "Upload recording"}
              </UploadButton>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={save.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              {session ? "Save session" : "Schedule session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SessionsManager({
  productId,
  sessions,
  timeZone,
  defaultStart,
}: {
  productId: string;
  sessions: SessionRow[];
  timeZone: string;
  defaultStart: string;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; session: SessionRow | null }>({ open: false, session: null });
  const [deleting, setDeleting] = useState<SessionRow | null>(null);
  const remove = useAction(deleteLiveSession, { success: "Session deleted", onSuccess: () => setDeleting(null) });

  const upcoming = sessions.filter((session) => !session.isPast && session.status !== "ENDED" && session.status !== "CANCELLED");
  const earlier = sessions.filter((session) => !upcoming.includes(session));

  const renderRow = (session: SessionRow) => (
    <li key={session.id} className="flex items-start gap-3 border-t border-border px-3 py-3 first:border-t-0 sm:items-center sm:px-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
        <CalendarClock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{session.title}</span>
          <Badge variant={STATUS_VARIANTS[session.status]} size="sm">
            {LIVE_STATUS_LABELS[session.status]}
          </Badge>
          {session.recordingUrl ? (
            <Badge variant="success" size="sm">
              <Video /> Replay
            </Badge>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{session.startsAtLabel}</span>
          <span>· {session.durationMinutes} min</span>
          {session.platform ? <span>· {session.platform}</span> : null}
          {!session.meetingUrl && !session.isPast ? <span className="font-medium text-warning-text">· No join link yet</span> : null}
          {session.attendees > 0 ? (
            <span className="inline-flex items-center gap-1">
              · <Users className="size-3" /> {session.attendees} joined
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setDialog({ open: true, session })}
          aria-label={`Edit ${session.title}`}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setDeleting(session)}
          aria-label={`Delete ${session.title}`}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">Live sessions</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Schedule workshops and calls. Times are entered in {timeZone.replace(/_/g, " ")} and shown to each student in their own zone.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, session: null })}>
          <Plus /> Schedule session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="No live sessions yet"
          description="Add a date, a join link and — afterwards — the replay. Students can add each session to their calendar."
          action={
            <Button onClick={() => setDialog({ open: true, session: null })}>
              <Plus /> Schedule the first session
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {upcoming.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Upcoming</h3>
              <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">{upcoming.map(renderRow)}</ul>
            </section>
          ) : null}
          {earlier.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Past and cancelled</h3>
              <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">{earlier.map(renderRow)}</ul>
            </section>
          ) : null}
        </div>
      )}

      <SessionDialog
        key={`${dialog.session?.id ?? "new"}-${dialog.open}`}
        productId={productId}
        session={dialog.session}
        timeZone={timeZone}
        defaultStart={defaultStart}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The session, its join link and its replay are removed from every student's schedule."
        confirmLabel="Delete session"
        loading={remove.pending}
        onConfirm={async () => {
          if (deleting) await remove.run({ productId, sessionId: deleting.id });
        }}
      />
    </div>
  );
}
