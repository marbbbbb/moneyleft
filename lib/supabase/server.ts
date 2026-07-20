import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for use in Server Components, Route Handlers, and Server Actions.
// A fresh client is created per request because it reads/writes the request's cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored if
            // middleware is refreshing sessions (which it is — see middleware.ts).
          }
        },
      },
    },
  );
}
