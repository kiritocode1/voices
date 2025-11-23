import { synthesizeToWavBuffer, type VoiceStyleId } from "../../../lib/serverTts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TtsRequestBody {
	text: string;
	voiceStyle: VoiceStyleId;
	totalStep?: number;
	speed?: number;
}

function isVoiceStyleId(value: string): value is VoiceStyleId {
	return value === "F1" || value === "F2" || value === "M1" || value === "M2";
}

export async function POST(request: Request): Promise<Response> {
	try {
		const json = (await request.json()) as Partial<TtsRequestBody>;

		if (typeof json.text !== "string" || json.text.trim().length === 0) {
			return new Response(JSON.stringify({ error: "Field `text` must be a non-empty string." }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (typeof json.voiceStyle !== "string" || !isVoiceStyleId(json.voiceStyle)) {
			return new Response(
				JSON.stringify({
					error: "Field `voiceStyle` must be one of: F1, F2, M1, M2.",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const totalStep = typeof json.totalStep === "number" && Number.isFinite(json.totalStep) ? Math.max(1, Math.floor(json.totalStep)) : 5;

		const speed = typeof json.speed === "number" && Number.isFinite(json.speed) ? json.speed : 1.05;

		const { wavBuffer, durationSeconds, sampleRate } = await synthesizeToWavBuffer({
			text: json.text,
			voiceStyle: json.voiceStyle,
			totalStep,
			speed,
		});

		return new Response(wavBuffer as BodyInit, {
			status: 200,
			headers: {
				"Content-Type": "audio/wav",
				"Content-Length": String(wavBuffer.length),
				"X-Audio-Duration-Seconds": durationSeconds.toFixed(3),
				"X-Audio-Sample-Rate": String(sampleRate),
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error during synthesis.";
		console.error("TTS API error:", error);
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
