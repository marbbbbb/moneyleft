import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
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

  // Only a presence check - the actual values never leave this server
  // component (or the demoLogin server action, which reads them directly
  // from process.env itself). Rendered here as a boolean prop, never as the
  // credentials themselves, so nothing secret crosses into the client bundle.
  const demoAvailable = Boolean(process.env.DEMO_EMAIL) && Boolean(process.env.DEMO_PASSWORD);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div
          className="mb-1 inline-flex items-center gap-[0.32em]"
          style={{ fontSize: "clamp(16px, 15.61vw - 7.65px, 59.8px)" }}
        >
          <Logo className="h-[0.7em] w-[1.13em] shrink-0" size={40} />
          <h1
            className="font-wordmark font-bold"
            style={{ fontSize: "1em", letterSpacing: "-0.035em" }}
          >
            MoneyLeft
          </h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Sign in or create an account to continue.
        </p>
        <LoginForm demoAvailable={demoAvailable} />
      </div>
    </main>
  );
}
