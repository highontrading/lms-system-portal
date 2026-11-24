import Link from "next/link";
import { Bot, CalendarClock, CircleCheck, GraduationCap, Play, Workflow } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme";
import { getSettings } from "@/server/settings";

// This layout reads live settings, so entering it waits on the server; pages inside stream behind loading.tsx.
export const instant = false;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { general, branding } = await getSettings();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-w-0 flex-col px-5 py-5 sm:px-10 sm:py-7">
        <header className="flex items-center justify-between">
          <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} />
          <ThemeToggle defaultTheme={branding.defaultTheme} />
        </header>
        <main className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10">{children}</main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {general.siteName}
          </span>
          <Link href="/catalog" className="hover:text-foreground">
            Browse the catalog
          </Link>
        </footer>
      </div>

      {/* Brand panel — decorative, desktop only */}
      <aside className="relative hidden overflow-hidden bg-[#0d0b1c] text-white lg:block" aria-hidden>
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(60% 50% at 78% 12%, color-mix(in oklab, var(--brand) 78%, transparent), transparent 70%), radial-gradient(45% 40% at 10% 92%, color-mix(in oklab, var(--brand) 50%, #ff5fa2 30%), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 bg-grid text-white/60 [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="max-w-md">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <span className="size-1.5 rounded-full bg-spark" />
              Your learning, in one place
            </p>
            <h2 className="font-display text-4xl leading-[1.08] font-semibold tracking-tight xl:text-[2.75rem]">
              Everything you buy,
              <br />
              ready the moment
              <br />
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-spark">you sign in.</span>
              </span>
            </h2>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-white/65">{general.tagline}</p>
          </div>

          {/* A stylised glimpse of the library */}
          <div className="relative ml-auto w-full max-w-md">
            <div className="absolute -top-20 -left-2 w-64 rotate-[-4deg] rounded-2xl border border-white/12 bg-white/7 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#ff8a4c] to-[#e8457a]">
                  <CalendarClock className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Live workshop</p>
                  <p className="text-xs text-white/60">Starts in 2 days · 7:30 pm</p>
                </div>
              </div>
            </div>

            <div className="relative ml-10 rounded-2xl border border-white/12 bg-white/9 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-white/55 uppercase">Continue learning</p>
                <span className="rounded-full bg-spark px-2 py-0.5 text-[0.6875rem] font-semibold text-spark-fg">68%</span>
              </div>
              <div className="mt-4 flex items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#4a35d6]">
                  <GraduationCap className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold">Build your first AI agent</p>
                  <p className="text-xs text-white/60">Lesson 9 of 14 · 12 min left</p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#0d0b1c]">
                  <Play className="size-4 translate-x-px fill-current" />
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div className="h-full w-[68%] rounded-full bg-spark" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2.5">
                  <Bot className="size-4 text-[#6ee7c5]" />
                  <span className="truncate">Support agent · v1.4</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2.5">
                  <Workflow className="size-4 text-[#7fc4ff]" />
                  <span className="truncate">Lead-to-CRM flow</span>
                </div>
              </div>
            </div>

            <div className="mt-6 ml-10 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/65">
              {["Resume where you left off", "Works on any device", "Certificates included"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CircleCheck className="size-3.5 text-spark" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
