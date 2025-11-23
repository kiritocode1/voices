"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type AgentState, Orb } from "../components/orb";

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

export default function Home() {
	const [text, setText] = useState<string>(QUOTE_TEXT);
	const [voiceStyle, setVoiceStyle] = useState<VoiceStyleId>("F1");
	const [totalStep, setTotalStep] = useState<number>(5);
	const [speed, setSpeed] = useState<number>(1.0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<GenerationStats | null>(null);
	const [agentState, setAgentState] = useState<AgentState>("listening");

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
		</div>
	);
}
