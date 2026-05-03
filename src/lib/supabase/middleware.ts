import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
	let response = NextResponse.next({ request });

	if (
		!process.env.NEXT_PUBLIC_SUPABASE_URL ||
		!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
	)
		throw "Missing Environment Variables";

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet: CookieToSet[]) {
					cookiesToSet.forEach(({ name, value }) => {
						request.cookies.set(name, value);
					});
					response = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) => {
						response.cookies.set(name, value, options);
					});
				},
			},
		},
	);

	// Refresh the session.
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const path = request.nextUrl.pathname;
	const isAuthRoute = path.startsWith("/auth");
	const isPublic =
		path === "/" ||
		path === "/join" ||
		path.startsWith("/auth") ||
		path.startsWith("/api/") ||
		path === "/leaderboard" ||
		path.startsWith("/teams");

	if (!user && !isPublic && !isAuthRoute) {
		const url = request.nextUrl.clone();
		url.pathname = "/auth/sign-in";
		url.searchParams.set("next", path);
		return NextResponse.redirect(url);
	}

	return response;
}
