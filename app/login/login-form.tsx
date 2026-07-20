"use client";

import { useActionState } from "react";
import { login, signup } from "./actions";

const initialState: { error?: string; message?: string } = {};

export function LoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );

  const error = loginState.error ?? signupState.error;
  const message = signupState.message;
  const pending = loginPending || signupPending;

  return (
    <form className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          className="rounded-md border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <div className="flex gap-3">
        <button
          formAction={loginAction}
          disabled={pending}
          className="flex-1 rounded-md bg-black min-h-11 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </button>
        <button
          formAction={signupAction}
          disabled={pending}
          className="flex-1 rounded-md border border-gray-300 min-h-11 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
        >
          {signupPending ? "Creating…" : "Sign up"}
        </button>
      </div>
    </form>
  );
}
