import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  // The student area needs a session, except the public question bank
  // (visitors browse questions and answer 1 per day; SEO).
  const path = request.nextUrl.pathname;
  const isStudentArea = path === "/app" || path.startsWith("/app/");
  const isPublicQuestions = path === "/app/questoes" || path.startsWith("/app/questoes/");

  if (isStudentArea && !isPublicQuestions && !data?.claims) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";

    const redirect = NextResponse.redirect(login);
    // Keep any refreshed auth cookies.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));

    return redirect;
  }

  return response;
}