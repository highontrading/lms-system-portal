"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

type Options<T> = {
  /** Toast shown when the action succeeds. */
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  /** Show failures as a toast (default true). Turn off when the form renders the error itself. */
  toastError?: boolean;
};

/**
 * Runs a server action with pending state, field errors and toasts handled in one place.
 *
 *   const save = useAction(updateProfile, { success: "Profile saved" });
 *   <Button loading={save.pending} onClick={() => save.run(values)} />
 */
export function useAction<Input, T>(action: (input: Input) => Promise<ActionResult<T>>, options: Options<T> = {}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (input: Input) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action(input);
          } catch (thrown) {
            // Redirects thrown by the action surface here and must continue to the router.
            if (thrown && typeof thrown === "object" && "digest" in thrown) throw thrown;
            result = { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
          }
          // An action that redirected resolves with no value.
          if (!result) return;
          if (result.ok) {
            setFieldErrors({});
            setError(null);
            if (options.success) {
              toast.success(typeof options.success === "function" ? options.success(result.data) : options.success);
            }
            options.onSuccess?.(result.data);
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            setError(result.error);
            if (options.toastError !== false) toast.error(result.error);
            options.onError?.(result.error);
          }
          resolve(result);
        });
      }),
    // The action and callbacks are stable in practice; re-creating `run` each render would defeat memoised children.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action],
  );

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setError(null);
  }, []);

  return { run, pending, fieldErrors, error, clearErrors };
}
