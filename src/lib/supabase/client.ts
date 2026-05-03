"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
	if (
		!process.env.NEXT_PUBLIC_SUPABASE_URL ||
		!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
	)
		throw "Missing Environment Variables";
	return createBrowserClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	);
}
