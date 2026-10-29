import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Admin route protection.
 *
 * This is a convenience, not the authorisation boundary. It redirects
 * unauthenticated visitors away from admin pages so they see a login form
 * instead of a flash of dashboard chrome. Every server action and route
 * handler re-checks authorisation itself, because a mutation can be invoked
 * directly without ever passing through a page render.
 *
 * It also refreshes the Supabase session cookie, which Server Components
 * cannot do themselves.
 */

const LOGIN_PATH = '/admin/login';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, origin } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  let response = NextResponse.next({ request });
  let authenticated = false;

  if (supabaseConfigured) {
    const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser() revalidates against Supabase rather than trusting the cookie.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  } else {
    const secret = process.env.ADMIN_SESSION_SECRET;
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (secret && secret.length >= 32 && token) {
      authenticated = Boolean(await verifySessionToken(token, secret));
    }
  }

  const isLoginPage = pathname === LOGIN_PATH;

  if (!authenticated && !isLoginPage) {
    const url = new URL(LOGIN_PATH, origin);
    // Remember where they were headed, but only as a same-site path — an
    // absolute URL here would make the login form an open redirect.
    if (pathname.startsWith('/admin')) {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (authenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', origin));
  }

  return response;
}

export const config = {
  // Admin pages only. Static assets, the public site and the analytics
  // endpoint never pay for this.
  matcher: ['/admin/:path*'],
};
