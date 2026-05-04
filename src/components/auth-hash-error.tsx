"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Supabase's /auth/v1/verify endpoint forwards results to the redirect_to URL
// as hash fragments. We see two shapes:
//
//   * #error=access_denied&error_code=otp_expired&...
//     — verification failed; forward to /auth/error with the same params.
//
//   * #access_token=...&refresh_token=...&type=invite|magiclink|recovery
//     — verification succeeded under the implicit auth flow; the cookies were
//       only set on supabase.co, so we have to call setSession on the client
//       to attach the JWT to our own cookies before continuing.
//
// Neither shape reaches the server (the URL fragment is never sent), so this
// component is the only place that can act on it.
export function AuthHashError() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		const hash = window.location.hash;
		if (!hash || hash.length < 2) return;

		const params = new URLSearchParams(hash.replace(/^#/, ""));

		if (params.get("error") || params.get("error_code")) {
			if (window.location.pathname.startsWith("/auth/error")) {
				window.history.replaceState(
					null,
					"",
					window.location.pathname + window.location.search,
				);
				return;
			}
			const search = params.toString();
			window.location.replace(`/auth/error?${search}`);
			return;
		}

		const accessToken = params.get("access_token");
		const refreshToken = params.get("refresh_token");
		if (accessToken && refreshToken) {
			const url = new URL(window.location.href);
			const next = url.searchParams.get("next") ?? "/dashboard";
			establishSession(accessToken, refreshToken, next);
		}
	}, []);

	return null;
}

async function establishSession(
	accessToken: string,
	refreshToken: string,
	next: string,
) {
	try {
		const supabase = createClient();
		const { error } = await supabase.auth.setSession({
			access_token: accessToken,
			refresh_token: refreshToken,
		});
		if (error) {
			const params = new URLSearchParams({
				error: "set_session_failed",
				error_description: error.message,
			});
			window.location.replace(`/auth/error?${params.toString()}`);
			return;
		}
		// next can be supplied via the hash too (some templates include it).
		const safe =
			next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
		window.location.replace(safe);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Ukjent feil";
		const params = new URLSearchParams({
			error: "set_session_failed",
			error_description: message,
		});
		window.location.replace(`/auth/error?${params.toString()}`);
	}
}
