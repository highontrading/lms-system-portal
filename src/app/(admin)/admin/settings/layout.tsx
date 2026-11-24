import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { SECTION_SPECS } from "@/components/admin/settings/sections";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/guards";

// Reads the session, so entering this area waits on the server; sections stream behind loading.tsx.
export const instant = false;

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("settings.manage");
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Control how your academy looks and works. Changes show up for students as soon as you save."
      />
      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav sections={SECTION_SPECS.map(({ id, label, icon }) => ({ id, label, icon }))} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
