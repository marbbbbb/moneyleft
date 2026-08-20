"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shared shape for returning a readable error back to the login form.
type AuthState = { error?: string; message?: string };

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Demo sign-in: credentials come from server-only env vars, never from the
// submitted form (the form has no fields for them, but even if it did, this
// action ignores formData entirely) - so they never travel through the
// client at all, not even as a value the user typed. Both DEMO_EMAIL and
// DEMO_PASSWORD live only in server env config (not NEXT_PUBLIC_-prefixed),
// so Next.js never inlines them into the client bundle. The page itself
// checks for their presence before rendering the button at all (see
// app/login/page.tsx) - this check is a defensive second layer, in case the
// action is ever reached some other way.
// Signature matches useActionState's (prevState, formData) shape even
// though neither is read - see the comment above on why formData is
// deliberately ignored.
export async function demoLogin(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: AuthState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<AuthState> {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) {
    return { error: "Demo sign-in isn't configured." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // When email confirmation is enabled, Supabase returns a user with no active
  // session until the emailed link is clicked.
  if (data.user && !data.session) {
    return {
      message:
        "Check your email for a confirmation link to finish creating your account.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
