"use client";

import { useEffect, useState } from "react";
import { Clock, MonitorPlay, Radio } from "lucide-react";
import { toast } from "sonner";
import type { VideoProvider } from "@/generated/prisma/enums";
import { joinLiveSession } from "@/server/portal/learning-actions";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const OPENS_MINUTES = 15;
const GRACE_MINUTES = 30;

/** Join button that wakes up 15 minutes before the session and hands out the link on click. */
export function JoinSessionButton({
  sessionId,
  startsAt,
  durationMinutes,
}: {
  sessionId: string;
  startsAt: string;
  durationMinutes: number;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, []);

  const start = new Date(startsAt).getTime();
  const open = now !== null && now >= start - OPENS_MINUTES * 60_000 && now <= start + (durationMinutes + GRACE_MINUTES) * 60_000;

  async function join() {
    // Open the tab during the click so pop-up blockers allow it, then point it at the meeting.
    const tab = window.open("", "_blank");
    setPending(true);
    const result = await joinLiveSession({ sessionId });
    setPending(false);
    if (result?.ok) {
      if (tab) {
        tab.opener = null;
        tab.location.href = result.data.url;
      } else {
        window.location.href = result.data.url;
      }
    } else {
      tab?.close();
      toast.error(result?.error ?? "We couldn't open the session. Please try again.");
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" disabled>
        <Clock /> Opens {OPENS_MINUTES} min before
      </Button>
    );
  }
  return (
    <Button onClick={join} loading={pending}>
      <Radio /> Join session
    </Button>
  );
}

export function ReplayButton({ provider, url, title }: { provider: VideoProvider; url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <MonitorPlay /> Watch replay
        </Button>
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="pb-5 sm:pb-6">{open ? <VideoPlayer provider={provider} url={url} title={title} /> : null}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}
