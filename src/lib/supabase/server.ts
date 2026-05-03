import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
	const cookieStore = await cookies();

	if (
		!process.env.NEXT_PUBLIC_SUPABASE_URL ||
		!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
	)
		throw "Missing Environment Variables";

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet: CookieToSet[]) {
					try {
						cookiesToSet.forEach(({ name, value, options }) => {
							cookieStore.set(name, value, options);
						});
					} catch {
						// Called from a Server Component — safe to ignore if middleware refreshes the session.
					}
				},
			},
		},
	);
}

export function createServiceClient() {
	if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
		throw "Missing Environment Variables";
	// Service role client — bypasses RLS. Only use in server actions / route handlers
	// after verifying the caller is an admin via the cookie-based client.
	// We must use the plain @supabase/supabase-js client here: createServerClient
	// from @supabase/ssr would still pick up the caller's auth cookie and use that
	// JWT for the Authorization header, ignoring the service role key.
	return createPlainClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.SUPABASE_SECRET_KEY,
		{
			auth: { persistSession: false, autoRefreshToken: false },
		},
	);
}
