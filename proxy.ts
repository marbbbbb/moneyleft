import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "Proxy" (formerly Middleware). Runs before every matched request to
// refresh the Supabase auth session and redirect unauthenticated users to /login.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt / sitemap.xml (well-known crawler files)
     * - google*.html (Search Console site-verification files)
     * - any path ending in a static-asset extension (images, .ico, .txt,
     *   .xml, .html, .webmanifest) — these are files under /public and must
     *   be served directly, never redirected to /login.
     *
     * App routes (/dashboard, /transactions, /settings, ...) have no file
     * extension, so auth protection for them is unchanged.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|google.*\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|html|webmanifest)$).*)",
  ],
};
