import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL("https://voices.aryank.space"),
	title: {
		default: "VOICES - On-Device TTS",
		template: "%s | VOICES",
	},
	description:
		"Lightning-fast, on-device text-to-speech system designed for extreme performance. Powered by ONNX Runtime, it runs entirely on your device—no cloud, no API calls, no privacy concerns.",
	keywords: ["TTS", "Text to Speech", "On-Device", "WebGPU", "WASM", "ONNX", "AI", "Speech Synthesis", "Privacy", "Offline"],
	authors: [
		{ name: "Aryan K", url: "https://aryank.space" },
		{ name: "Janvi W", url: "https://janviw.space" },
	],
	creator: "Blank Technologies Inc.",
	publisher: "Blank Technologies Inc.",
	openGraph: {
		title: "VOICES - On-Device TTS",
		description: "Lightning-fast, on-device text-to-speech system designed for extreme performance. Runs entirely locally in your browser.",
		url: "https://voices.aryank.space",
		siteName: "VOICES",
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "VOICES - On-Device TTS",
		description: "Lightning-fast, on-device text-to-speech. No cloud, no API calls, privacy-first.",
		creator: "@aryank_space",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
		</html>
	);
}
