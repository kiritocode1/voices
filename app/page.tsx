"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type AgentState, Orb } from "../components/orb";
import { codeToHtml } from "shiki";


type VoiceStyleId = "F1" | "F2" | "M1" | "M2";

interface GenerationStats {
	audioUrl: string;
	durationSeconds: number | null;
	sampleRate: number | null;
	totalTimeSeconds: number;
}

// Monochromatic Orb Colors for Dark Theme
const ORB_COLORS: [string, string] = ["#E5E5E5", "#525252"];

const QUOTE_TEXT = "Pain and suffering are always inevitable for a large intelligence and a deep heart. The really great men must, I think, have great sadness on earth.";

const PARAGRAPH_TEXT =
	"A man who lies to himself, and believes his own lies becomes unable to recognize truth, either in himself or in anyone else, and he ends up losing respect for himself and for others. When he has no respect for anyone, he can no longer love, and, in order to divert himself, having no love in him, he yields to his impulses, indulges in the lowest forms of pleasure, and behaves in the end like an animal. And it all comes from lying - lying to others and to yourself.";

// API Documentation Snippets
const API_ENDPOINT = "https://voices.aryank.space/api/tts";

const CODE_SNIPPETS = {
	javascript: `import fs from 'node:fs';

const response = await fetch("${API_ENDPOINT}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hello world",
    voiceStyle: "M1",
    totalStep: 5,
    speed: 1.0
  })
});

const buffer = await response.arrayBuffer();
fs.writeFileSync("speech.wav", Buffer.from(buffer));
`,
	python: `import requests

response = requests.post(
    "${API_ENDPOINT}",
    json={
        "text": "Hello world",
        "voiceStyle": "M1",
        "totalStep": 5,
        "speed": 1.0
    }
)

with open("speech.wav", "wb") as f:
    f.write(response.content)`,
	php: `<?php
$ch = curl_init("${API_ENDPOINT}");
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "text" => "Hello world",
    "voiceStyle" => "M1",
    "totalStep" => 5,
    "speed" => 1.0
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$audio = curl_exec($ch);
file_put_contents("speech.wav", $audio);
curl_close($ch);
?>`,
	go: `package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
)

func main() {
	data := map[string]interface{}{
		"text":       "Hello world",
		"voiceStyle": "M1",
		"totalStep":  5,
		"speed":      1.0,
	}
	jsonData, _ := json.Marshal(data)

	resp, _ := http.Post("${API_ENDPOINT}", "application/json", bytes.NewBuffer(jsonData))
	defer resp.Body.Close()

	out, _ := os.Create("speech.wav")
	defer out.Close()
	io.Copy(out, resp.Body)
}`,
	rust: `use std::fs::File;
use std::io::copy;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let resp = client.post("${API_ENDPOINT}")
        .json(&serde_json::json!({
            "text": "Hello world",
            "voiceStyle": "M1",
            "totalStep": 5,
            "speed": 1.0
        }))
        .send()
        .await?;

    let mut content = std::io::Cursor::new(resp.bytes().await?);
    let mut file = File::create("speech.wav")?;
    copy(&mut content, &mut file)?;
    Ok(())
}`,
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
	const [html, setHtml] = useState(code);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		async function highlight() {
			try {
				const out = await codeToHtml(code, {
					lang,
					theme: "vitesse-black",
				});
				setHtml(out);
			} catch (e) {
				console.error("Syntax highlighting failed:", e);
				setHtml(code); // Fallback
			}
		}
		highlight();
	}, [code, lang]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	return (
		<div className="relative group rounded-lg overflow-hidden bg-black border border-neutral-800">
			<div
				className="font-mono text-sm leading-relaxed overflow-x-auto p-6"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<button
				onClick={handleCopy}
				className={`absolute top-4 right-4 px-3 py-1.5 text-xs uppercase tracking-widest border rounded transition-all duration-200 ${
					copied ? "bg-white text-black border-white opacity-100" : "bg-black text-neutral-400 border-neutral-800 opacity-0 group-hover:opacity-100 hover:text-white hover:border-white"
				}`}
			>
				{copied ? "Copied" : "Copy"}
			</button>
		</div>
	);
}

export default function Home() {
	const [text, setText] = useState<string>(QUOTE_TEXT);
	const [voiceStyle, setVoiceStyle] = useState<VoiceStyleId>("F1");
	const [totalStep, setTotalStep] = useState<number>(5);
	const [speed, setSpeed] = useState<number>(1.0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<GenerationStats | null>(null);
	const [agentState, setAgentState] = useState<AgentState>("listening");
	const [activeTab, setActiveTab] = useState<keyof typeof CODE_SNIPPETS>("javascript");

	const audioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		return () => {
			if (stats?.audioUrl) {
				URL.revokeObjectURL(stats.audioUrl);
			}
		};
	}, [stats]);

	// Auto-play when audioUrl changes
	useEffect(() => {
		if (stats?.audioUrl && audioRef.current) {
			setAgentState("talking");
			audioRef.current.play().catch((err) => {
				console.error("Auto-play failed:", err);
				setAgentState("listening");
			});
		}
	}, [stats?.audioUrl]);

	const canSubmit = useMemo<boolean>(() => !isLoading && text.trim().length > 0, [isLoading, text]);

	async function handleGenerate(event: React.FormEvent | React.MouseEvent): Promise<void> {
		event.preventDefault();
		if (!canSubmit) return;

		setIsLoading(true);
		setError(null);
		setAgentState("thinking");

		const startedAt = Date.now();

		try {
			const response = await fetch("/api/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, voiceStyle, totalStep, speed }),
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { error?: string } | null;
				const message = payload?.error ?? `TTS request failed with status ${response.status}.`;
				throw new Error(message);
			}

			const durationHeader = response.headers.get("X-Audio-Duration-Seconds");
			const sampleRateHeader = response.headers.get("X-Audio-Sample-Rate");
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			if (stats?.audioUrl) {
				URL.revokeObjectURL(stats.audioUrl);
			}

			const finishedAt = Date.now();
			const totalTimeSeconds = (finishedAt - startedAt) / 1000;

			setStats({
				audioUrl: url,
				durationSeconds: durationHeader ? Number.parseFloat(durationHeader) : null,
				sampleRate: sampleRateHeader ? Number.parseInt(sampleRateHeader, 10) : null,
				totalTimeSeconds,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unexpected error while generating speech.";
			setError(message);
			setAgentState("listening");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-black text-white font-sans selection:bg-neutral-800">
			{/* Top Navigation Bar */}
			<div className="border-b border-neutral-800 p-6 flex justify-between items-start">
				<div>
					<h1 className="text-2xl font-bold tracking-tighter">VOICES</h1>
					<p className="text-xs text-neutral-500 mt-1 tracking-widest uppercase">
						by{" "}
						<a
							href="https://aryank.space/"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-neutral-300 transition-colors"
						>
							blank
						</a>
					</p>
				</div>
				<div className="text-right text-xs text-neutral-500 max-w-xs hidden sm:block">
					<p className="tracking-widest uppercase">We can generate everything.</p>
					<p className="tracking-widest uppercase">Yes, everything.</p>
				</div>
			</div>

			<form className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-180px)]">
				{/* Left Column: Text Input */}
				<div className="border-r border-neutral-800 p-8 md:p-12 flex flex-col relative">
					<h2 className="text-4xl md:text-5xl font-light mb-12 text-neutral-100 tracking-tight">Text Input</h2>

					<div className="grow flex flex-col">
						<textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							className="bg-transparent w-full h-full grow resize-none outline-none text-xl md:text-3xl text-neutral-300 placeholder-neutral-700 font-light leading-relaxed"
							placeholder="Type something to speak..."
						/>
					</div>

					<div className="mt-12 flex flex-wrap gap-8 text-xs text-neutral-500 uppercase tracking-widest">
						<button
							type="button"
							onClick={() => setText(QUOTE_TEXT)}
							className="hover:text-white transition-colors"
						>
							Quote
						</button>
						<button
							type="button"
							onClick={() => setText(PARAGRAPH_TEXT)}
							className="hover:text-white transition-colors"
						>
							Paragraph
						</button>
					</div>

					<div className="absolute bottom-4 right-4 text-xs text-neutral-700 font-mono">{text.length} CHARS</div>
				</div>

				{/* Right Column: Controls & Output */}
				<div className="flex flex-col">
					{/* Controls Section */}
					<div className="p-8 md:p-12 border-b border-neutral-800 grow">
						<h2 className="text-4xl md:text-5xl font-light mb-12 text-neutral-100 tracking-tight">Controls</h2>

						<div className="space-y-16 max-w-lg">
							{/* Voice Selection */}
							<div className="space-y-4">
								<label className="block text-xs text-neutral-500 uppercase tracking-widest">Voice Model</label>
								<div className="relative">
									<select
										value={voiceStyle}
										onChange={(e) => setVoiceStyle(e.target.value as VoiceStyleId)}
										className="bg-black border-b border-neutral-800 w-full py-4 text-2xl text-white outline-none focus:border-white transition-colors appearance-none rounded-none cursor-pointer font-light"
									>
										<option value="F1">Female 1</option>
										<option value="F2">Female 2</option>
										<option value="M1">Male 1</option>
										<option value="M2">Male 2</option>
									</select>
									<div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
										<svg
											width="12"
											height="12"
											viewBox="0 0 12 12"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 4L6 8L10 4"
												stroke="currentColor"
												strokeWidth="1.5"
											/>
										</svg>
									</div>
								</div>
							</div>

							{/* Quality Slider */}
							<div className="space-y-4">
								<div className="flex justify-between text-xs text-neutral-500 uppercase tracking-widest">
									<span>Quality</span>
									<span>{totalStep} Steps</span>
								</div>
								<input
									type="range"
									min={1}
									max={20}
									step={1}
									value={totalStep}
									onChange={(e) => setTotalStep(Number(e.target.value))}
									className="w-full h-px bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-150 [&::-webkit-slider-thumb]:transition-transform"
								/>
							</div>

							{/* Speed Slider */}
							<div className="space-y-4">
								<div className="flex justify-between text-xs text-neutral-500 uppercase tracking-widest">
									<span>Speed</span>
									<span>{speed}x</span>
								</div>
								<input
									type="range"
									min={0.5}
									max={2.0}
									step={0.1}
									value={speed}
									onChange={(e) => setSpeed(Number(e.target.value))}
									className="w-full h-px bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-150 [&::-webkit-slider-thumb]:transition-transform"
								/>
							</div>
						</div>
					</div>

					{/* Bottom Action Area */}
					<div className="h-64 border-b lg:border-b-0 border-neutral-800 flex relative">
						{/* Orb Container */}
						<div className="w-1/2 border-r border-neutral-800 flex items-center justify-center bg-neutral-900/30 relative overflow-hidden">
							<div className="w-40 h-40 opacity-80 mix-blend-screen">
								<Orb
									colors={ORB_COLORS}
									agentState={agentState}
								/>
							</div>
							{/* Audio Element */}
							<audio
								ref={audioRef}
								src={stats?.audioUrl}
								className="hidden"
								onPlay={() => setAgentState("talking")}
								onPause={() => setAgentState("listening")}
								onEnded={() => setAgentState("listening")}
							/>
						</div>

						{/* Generate Button */}
						<div
							onClick={handleGenerate}
							className={`w-1/2 flex flex-col justify-between p-8 transition-all cursor-pointer group select-none ${
								isLoading ? "bg-neutral-900 cursor-wait" : "hover:bg-white hover:text-black"
							}`}
						>
							<div className="text-xs uppercase tracking-widest opacity-50">Action</div>
							<div className="flex items-center justify-between">
								<span className="text-2xl md:text-3xl font-light tracking-tight">{isLoading ? "Generating..." : "Generate"}</span>
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									className={`transform transition-transform duration-300 ${isLoading ? "animate-spin" : "group-hover:translate-x-2"}`}
								>
									{isLoading ? (
										<circle
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="2"
											strokeDasharray="32"
											strokeDashoffset="32"
										/>
									) : (
										<path
											d="M5 12H19M19 12L12 5M19 12L12 19"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									)}
								</svg>
							</div>
						</div>
					</div>
				</div>
			</form>

			{/* Footer Stats Grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 border-t border-neutral-800 text-xs text-neutral-500 uppercase tracking-widest">
				<div className="p-6 border-r border-neutral-800 border-b md:border-b-0">
					<h3 className="text-white mb-2 opacity-50">Status</h3>
					<p className={error ? "text-red-500" : "text-white"}>{error ? "Error" : isLoading ? "Processing..." : "Ready"}</p>
				</div>
				<div className="p-6 border-r border-neutral-800 border-b md:border-b-0">
					<h3 className="text-white mb-2 opacity-50">Duration</h3>
					<p className="text-white">{stats?.durationSeconds ? `${stats.durationSeconds.toFixed(2)}s` : "--"}</p>
				</div>
				<div className="p-6 border-r border-neutral-800">
					<h3 className="text-white mb-2 opacity-50">Sample Rate</h3>
					<p className="text-white">{stats?.sampleRate ? `${stats.sampleRate} Hz` : "--"}</p>
				</div>
				<div className="p-6">
					<h3 className="text-white mb-2 opacity-50">Time</h3>
					<p className="text-white">{stats?.totalTimeSeconds ? `${stats.totalTimeSeconds.toFixed(2)}s` : "--"}</p>
				</div>
			</div>

			{/* Documentation & Methodology Section */}
			<div className="border-t border-neutral-800 grid grid-cols-1 lg:grid-cols-2">
				{/* Performance Chart */}
				<div className="p-8 md:p-12 border-r border-neutral-800">
					<h2 className="text-3xl md:text-4xl font-light mb-8 text-neutral-100 tracking-tight">Performance</h2>
					<div className="space-y-6 text-xs uppercase tracking-widest font-mono">
						{/* Benchmark Items */}
						{[
							{ name: "Ours (RTX 4090)", score: 12164, color: "bg-blue-600", width: "100%" },
							{ name: "Ours (M4 Pro - WebGPU)", score: 2509, color: "bg-blue-500", width: "25%" },
							{ name: "Ours (M4 Pro - CPU)", score: 1263, color: "bg-blue-400", width: "15%" },
							{ name: "Flash v2.5", score: 287, color: "bg-neutral-700", width: "5%" },
							{ name: "TTS-1", score: 82, color: "bg-neutral-800", width: "2%" },
							{ name: "Gemini 2.5 Flash TTS", score: 24, color: "bg-neutral-900", width: "1%" },
						].map((item) => (
							<div
								key={item.name}
								className="space-y-2"
							>
								<div className="flex justify-between text-neutral-400">
									<span>{item.name}</span>
									<span>{item.score}</span>
								</div>
								<div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden">
									<div
										className={`h-full ${item.color}`}
										style={{ width: item.width }}
									></div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Methodology Text */}
				<div className="p-8 md:p-12 flex flex-col justify-center bg-neutral-900/10">
					<h2 className="text-3xl md:text-4xl font-light mb-8 text-neutral-100 tracking-tight">Methodology</h2>
					<div className="space-y-6 text-neutral-400 font-light text-lg leading-relaxed">
						<p>
							Our model utilizes a custom-trained architecture optimized for on-device inference. By leveraging advanced quantization techniques and the ONNX runtime, we achieve
							state-of-the-art performance across a wide range of hardware configurations.
						</p>
						<p>
							Training involved a diverse dataset of high-fidelity speech, processed to ensure robustness and natural prosody. The result is a lightweight, low-latency synthesis engine
							that operates entirely locally, preserving user privacy without sacrificing quality.
						</p>
						<p>
							This hybrid approach combines the flexibility of deep learning with the efficiency of edge computing, enabling real-time voice generation even on consumer-grade CPUs and
							mobile accelerators.
						</p>
					</div>
				</div>
			</div>

			{/* API Documentation Section */}
			<div className="border-t border-neutral-800">
				<div className="p-8 md:p-12">
					<div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
						<div>
							<h2 className="text-3xl md:text-4xl font-light text-neutral-100 tracking-tight">API Integration</h2>
							<p className="mt-2 text-neutral-500">Integrate our TTS engine directly into your applications.</p>
						</div>
						<div className="flex items-center gap-2 bg-neutral-900/50 px-4 py-2 rounded border border-neutral-800 font-mono text-sm text-blue-400 break-all">
							<span className="text-neutral-500">POST</span>
							{API_ENDPOINT}
						</div>
					</div>

					{/* Language Tabs */}
					<div className="mb-6 flex flex-wrap gap-2 border-b border-neutral-800 pb-1">
						{(Object.keys(CODE_SNIPPETS) as Array<keyof typeof CODE_SNIPPETS>).map((lang) => (
							<button
								key={lang}
								onClick={() => setActiveTab(lang)}
								className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
									activeTab === lang ? "text-white border-b-2 border-white -mb-1.5" : "text-neutral-500 hover:text-neutral-300"
								}`}
							>
								{lang === "javascript" ? "JavaScript" : lang}
							</button>
						))}
					</div>

					{/* Code Display */}
					<CodeBlock
						code={CODE_SNIPPETS[activeTab]}
						lang={activeTab}
					/>
				</div>
			</div>

			{/* Footer Credits */}
			<div className="border-t border-neutral-800 p-8 md:p-12 text-center text-neutral-500 text-sm">
				<p>
					Made with Love by{" "}
					<a
						href="https://aryank.space"
						target="_blank"
						rel="noopener noreferrer"
						className="text-neutral-300 hover:text-white transition-colors"
					>
						BLANK
					</a>{" "}
					and{" "}
					<a
						href="https://janviw.space"
						target="_blank"
						rel="noopener noreferrer"
						className="text-neutral-300 hover:text-white transition-colors"
					>
						COSMéra
					</a>
				</p>
			</div>
		</div>
	);
}
