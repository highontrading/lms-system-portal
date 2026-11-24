"use client";

import { joinFreeProduct } from "@/app/(site)/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";

export function JoinFreeButton({ productId, label }: { productId: string; label: string }) {
  const join = useAction(joinFreeProduct);
  return (
    <Button size="lg" className="w-full" loading={join.pending} onClick={() => join.run({ productId })}>
      {label}
    </Button>
  );
}
