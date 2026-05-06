import type { Metadata, Viewport } from "next";
import { AuthHashError } from "@/components/auth-hash-error";
import "./globals.css";

export const metadata: Metadata = {
	title: "The Grandest Slam",
	description:
		"En sommerturnering i fire idretter — Padel, Tennis, Frisbeegolf og Golf. Lag på to, ett vinnerlag.",
};

export const viewport: Viewport = {
	themeColor: "#f7ecd2",
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="no">
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Inter:wght@400;500;600;700;800&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body>
				<AuthHashError />
				{children}
			</body>
		</html>
	);
}
