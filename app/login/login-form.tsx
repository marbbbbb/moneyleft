"use client";

import { useActionState } from "react";
import { login, signup, demoLogin } from "./actions";
import { Button, Field, Input } from "@/components/ui";

const initialState: { error?: string; message?: string } = {};

export function LoginForm({ demoAvailable }: { demoAvailable: boolean }) {
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );
  const [demoState, demoAction, demoPending] = useActionState(
    demoLogin,
    initialState,
  );

  const error = loginState.error ?? signupState.error ?? demoState.error;
  const message = signupState.message;
  const pending = loginPending || signupPending || demoPending;

  return (
    <form className="flex flex-col gap-[var(--sp-4)]">
      <Field label="Email" htmlFor="login-email">
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </Field>

      <Field label="Password" htmlFor="login-password">
        <Input
          id="login-password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
        />
      </Field>

      {error && (
        <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{error}</p>
      )}
      {message && (
        <p className="text-[length:var(--t-sm)] text-[var(--pos)]">{message}</p>
      )}

      <div className="flex gap-[var(--sp-3)]">
        <Button
          formAction={loginAction}
          disabled={pending}
          variant="primary"
          className="flex-1 disabled:opacity-50"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </Button>
        <Button
          formAction={signupAction}
          disabled={pending}
          variant="secondary"
          className="flex-1 disabled:opacity-50"
        >
          {signupPending ? "Creating…" : "Sign up"}
        </Button>
      </div>

      {demoAvailable && (
        <div className="flex flex-col items-center gap-[var(--sp-1)] text-center">
          <button
            formAction={demoAction}
            formNoValidate
            disabled={pending}
            className="min-h-11 px-2 text-[length:var(--t-sm)] text-[var(--text-muted)] underline underline-offset-2 disabled:opacity-50"
          >
            {demoPending ? "Signing in…" : "View demo"}
          </button>
          <p className="text-[length:var(--t-xs)] text-[var(--text-subtle)]">
            Sample data. Sign up to track your own.
          </p>
        </div>
      )}
    </form>
  );
}
