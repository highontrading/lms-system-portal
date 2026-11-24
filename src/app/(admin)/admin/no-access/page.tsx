import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireStaff } from "@/server/auth/guards";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  await requireStaff();
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title="You don't have access to this section"
      description="Your role doesn't include this part of the admin panel. Ask an owner or admin if you need it."
      action={
        <Button asChild>
          <Link href="/admin">Back to the dashboard</Link>
        </Button>
      }
    />
  );
}
