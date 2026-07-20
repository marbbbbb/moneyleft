import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // If already signed in, skip the login screen.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Finance App</h1>
        <p className="mb-6 text-sm text-gray-500">
          Sign in or create an account to continue.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
