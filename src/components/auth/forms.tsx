"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, MailCheck } from "lucide-react";
import {
  acceptInvite,
  confirmMagicLink,
  login,
  register,
  requestLoginCode,
  requestPasswordReset,
  resetPassword,
  verifyLoginCode,
} from "@/app/(auth)/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Callout tone="danger" className="text-[0.8125rem]">
      {message}
    </Callout>
  );
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

// ───────────────────────────── Sign in ─────────────────────────────

export function LoginForm({
  next,
  allowCodeLogin,
  allowRegistration,
  initialEmail = "",
}: {
  next?: string;
  allowCodeLogin: boolean;
  allowRegistration: boolean;
  initialEmail?: string;
}) {
  const [mode, setMode] = useState<"password" | "code">("password");
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const signIn = useAction(login, { toastError: false });
  const sendCode = useAction(requestLoginCode, { toastError: false, onSuccess: () => setCodeSent(true) });
  const checkCode = useAction(verifyLoginCode, { toastError: false });

  function switchMode(nextMode: "password" | "code") {
    setMode(nextMode);
    setCodeSent(false);
    setCode("");
    signIn.clearErrors();
    sendCode.clearErrors();
    checkCode.clearErrors();
  }

  if (mode === "code" && codeSent) {
    return (
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          checkCode.run({ email, code, next });
        }}
      >
        <div className="grid gap-2">
          <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-text">
            <MailCheck className="size-5" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{email}</span> has an account, we sent it a 6-digit code.
            Enter it below, or tap the button in the email.
          </p>
        </div>
        <FormError message={checkCode.error} />
        <Field label="Sign-in code" htmlFor="code" error={checkCode.fieldErrors.code}>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            autoFocus
            className="h-12 text-center font-mono text-xl tracking-[0.4em]"
            aria-invalid={!!checkCode.fieldErrors.code}
          />
        </Field>
        <Button type="submit" size="lg" loading={checkCode.pending} disabled={code.length !== 6}>
          Sign in
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => switchMode("code")}>
            <ArrowLeft className="size-3.5" /> Use a different email
          </button>
          <button
            type="button"
            className="font-medium text-primary-text hover:underline disabled:opacity-50"
            disabled={sendCode.pending}
            onClick={() => sendCode.run({ email, next })}
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  const pending = signIn.pending || sendCode.pending;
  const error = mode === "password" ? signIn.error : sendCode.error;
  const fieldErrors = mode === "password" ? signIn.fieldErrors : sendCode.fieldErrors;

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (mode === "password") signIn.run({ email, password, next });
        else sendCode.run({ email, next });
      }}
    >
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "password"
            ? "Sign in with the email you used to purchase."
            : "We'll email you a one-time code — no password needed."}
        </p>
      </div>

      <FormError message={error} />

      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={!!fieldErrors.email}
        />
      </Field>

      {mode === "password" ? (
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-[0.8125rem] font-medium">
              Password
            </label>
            <Link href="/forgot-password" className="text-[0.8125rem] font-medium text-primary-text hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={!!fieldErrors.password}
          />
          {fieldErrors.password ? <p className="text-[0.8125rem] font-medium text-danger-text">{fieldErrors.password}</p> : null}
        </div>
      ) : null}

      <Button type="submit" size="lg" loading={pending}>
        {mode === "password" ? "Sign in" : "Email me a code"}
      </Button>

      {allowCodeLogin ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => switchMode(mode === "password" ? "code" : "password")}
          >
            {mode === "password" ? (
              <>
                <Mail /> Email me a sign-in code
              </>
            ) : (
              <>
                <KeyRound /> Sign in with a password
              </>
            )}
          </Button>
        </>
      ) : null}

      {allowRegistration ? (
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href={withNext("/register", next)} className="font-medium text-primary-text hover:underline">
            Create an account
          </Link>
        </p>
      ) : null}
    </form>
  );
}

// ───────────────────────────── Sign up ─────────────────────────────

export function RegisterForm({ next, hasTerms }: { next?: string; hasTerms: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const signUp = useAction(register, {
    toastError: false,
    onSuccess: (data) => {
      if (data?.needsVerification) setDone(true);
    },
  });

  if (done) {
    return (
      <div className="grid gap-4">
        <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success-text">
          <MailCheck className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Confirm your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to finish
          creating your account.
        </p>
        <Button asChild variant="secondary">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        signUp.run({ name, email, password, next });
      }}
    >
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">One account for every course, workshop, agent and workflow.</p>
      </div>

      <FormError message={signUp.error} />

      <Field label="Full name" htmlFor="name" error={signUp.fieldErrors.name}>
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder="Your name"
          required
          aria-invalid={!!signUp.fieldErrors.name}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={signUp.fieldErrors.email}>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
          aria-invalid={!!signUp.fieldErrors.email}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={signUp.fieldErrors.password} hint="At least 8 characters.">
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={!!signUp.fieldErrors.password}
        />
      </Field>

      <Button type="submit" size="lg" loading={signUp.pending}>
        Create account
      </Button>

      {hasTerms ? (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={withNext("/login", next)} className="font-medium text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

// ───────────────────────────── Forgot / reset password ─────────────────────────────

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const request = useAction(requestPasswordReset, { toastError: false, onSuccess: () => setSent(true) });

  if (sent) {
    return (
      <div className="grid gap-4">
        <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-text">
          <MailCheck className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> has an account, a link to choose a new
          password is on its way. It expires in one hour.
        </p>
        <Button asChild variant="secondary">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        request.run({ email });
      }}
    >
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a link to choose a new one. This also works if you bought something and
          never set a password.
        </p>
      </div>
      <FormError message={request.error} />
      <Field label="Email" htmlFor="email" error={request.fieldErrors.email}>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
          autoFocus
        />
      </Field>
      <Button type="submit" size="lg" loading={request.pending}>
        Send reset link
      </Button>
      <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const reset = useAction(resetPassword, { toastError: false });

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        reset.run({ token, password });
      }}
    >
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll be signed in straight away, and signed out everywhere else.</p>
      </div>
      <FormError message={reset.error} />
      <Field label="New password" htmlFor="password" error={reset.fieldErrors.password} hint="At least 8 characters.">
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          autoFocus
        />
      </Field>
      <Button type="submit" size="lg" loading={reset.pending}>
        Save and sign in
      </Button>
    </form>
  );
}

// ───────────────────────────── Magic link & invite ─────────────────────────────

export function MagicLinkForm({ token, next }: { token: string; next?: string }) {
  const confirm = useAction(confirmMagicLink, { toastError: false });
  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Finish signing in</h1>
        <p className="text-sm text-muted-foreground">One more tap and you&apos;re in.</p>
      </div>
      <FormError message={confirm.error} />
      <Button size="lg" loading={confirm.pending} onClick={() => confirm.run({ token, next })}>
        Continue
      </Button>
    </div>
  );
}

export function WelcomeForm({
  token,
  next,
  email,
  initialName,
  role,
}: {
  token: string;
  next?: string;
  email: string;
  initialName: string;
  role: "student" | "staff";
}) {
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState("");
  const accept = useAction(acceptInvite, { toastError: false });

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        accept.run({ token, name, password: password || undefined, next });
      }}
    >
      <div className="grid gap-1.5">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">
          {role === "staff" ? "Join the team" : "Your access is ready"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Signing in as <span className="font-medium text-foreground">{email}</span>. Confirm your name and choose a
          password to get started.
        </p>
      </div>
      <FormError message={accept.error} />
      <Field label="Full name" htmlFor="name" error={accept.fieldErrors.name}>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={accept.fieldErrors.password}
        hint={role === "staff" ? "At least 8 characters." : "At least 8 characters. Leave empty to sign in with email codes instead."}
        optional={role !== "staff"}
      >
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required={role === "staff"}
        />
      </Field>
      <Button type="submit" size="lg" loading={accept.pending}>
        Continue
      </Button>
    </form>
  );
}
