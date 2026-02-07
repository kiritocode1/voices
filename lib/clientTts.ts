import * as ort from "onnxruntime-web";


// Set WASM paths to CDN to ensure they load correctly on Vercel without complex copying
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/";

export type VoiceStyleId = "F1" | "F2" | "M1" | "M2";

interface TtsConfig {
	ae: {
		sample_rate: number;
		base_chunk_size: number;
	};
	ttl: {
		chunk_compress_factor: number;
		latent_dim: number;
	};
}

type UnicodeIndexerJson = number[];

interface VoiceStyleTensorJson {
	dims: [number, number, number];
	data: number[][][];
}

interface VoiceStyleJson {
	style_ttl: VoiceStyleTensorJson;
	style_dp: VoiceStyleTensorJson;
}

export interface SynthesizeOptions {
	text: string;
	voiceStyle: VoiceStyleId;
	totalStep: number;
	speed: number;
	silenceDurationSeconds?: number;
}

export interface SynthesisResult {
	wavBuffer: ArrayBuffer;
	sampleRate: number;
	durationSeconds: number;
}

class UnicodeProcessor {
	private readonly indexer: UnicodeIndexerJson;

	constructor(indexer: UnicodeIndexerJson) {
		this.indexer = indexer;
	}

	call(textList: string[]): { textIds: number[][]; textMask: number[][][] } {
		const processedTexts = textList.map((text) => this.preprocessText(text));

		const textIdsLengths = processedTexts.map((text) => text.length);
		const maxLen = Math.max(...textIdsLengths);

		const textIds = processedTexts.map((text) => {
			const row: number[] = new Array<number>(maxLen).fill(0);
			for (let j = 0; j < text.length; j += 1) {
				const codePoint = text.codePointAt(j);
				if (codePoint === undefined) {
					continue;
				}
				const indexValue = codePoint < this.indexer.length ? this.indexer[codePoint] : -1;
				row[j] = indexValue;
			}
			return row;
		});

		const textMask = this.getTextMask(textIdsLengths);
		return { textIds, textMask };
	}

	private preprocessText(text: string): string {
		return text.normalize("NFKC");
	}

	private getTextMask(textIdsLengths: number[]): number[][][] {
		const maxLen = Math.max(...textIdsLengths);
		return this.lengthToMask(textIdsLengths, maxLen);
	}

	private lengthToMask(lengths: number[], maxLen: number | null = null): number[][][] {
		const actualMaxLen = maxLen ?? Math.max(...lengths);
		return lengths.map((len) => {
			const row: number[] = new Array<number>(actualMaxLen).fill(0.0);
			const limit = Math.min(len, actualMaxLen);
			for (let j = 0; j < limit; j += 1) {
				row[j] = 1.0;
			}
			return [row];
		});
	}
}

class Style {
	readonly ttl: ort.Tensor;
	readonly dp: ort.Tensor;

	constructor(ttlTensor: ort.Tensor, dpTensor: ort.Tensor) {
		this.ttl = ttlTensor;
		this.dp = dpTensor;
	}
}

class TextToSpeech {
	private readonly cfgs: TtsConfig;
	private readonly textProcessor: UnicodeProcessor;
	private readonly dpOrt: ort.InferenceSession;
	private readonly textEncOrt: ort.InferenceSession;
	private readonly vectorEstOrt: ort.InferenceSession;
	private readonly vocoderOrt: ort.InferenceSession;
	readonly sampleRate: number;

	constructor(cfgs: TtsConfig, textProcessor: UnicodeProcessor, dpOrt: ort.InferenceSession, textEncOrt: ort.InferenceSession, vectorEstOrt: ort.InferenceSession, vocoderOrt: ort.InferenceSession) {
		this.cfgs = cfgs;
		this.textProcessor = textProcessor;
		this.dpOrt = dpOrt;
		this.textEncOrt = textEncOrt;
		this.vectorEstOrt = vectorEstOrt;
		this.vocoderOrt = vocoderOrt;
		this.sampleRate = cfgs.ae.sample_rate;
	}

	private async infer(textList: string[], style: Style, totalStep: number, speed: number): Promise<{ wav: number[]; duration: number[] }> {
		const bsz = textList.length;

		const { textIds, textMask } = this.textProcessor.call(textList);

		const textIdsFlat = new BigInt64Array(textIds.flat().map((value) => BigInt(value)));
		const textIdsShape: [number, number] = [bsz, textIds[0]?.length ?? 0];
		const textIdsTensor = new ort.Tensor("int64", textIdsFlat, textIdsShape);

		const textMaskFlat = new Float32Array(textMask.flat(2));
		const textMaskShape: [number, number, number] = [bsz, 1, textMask[0]?.[0]?.length ?? 0];
		const textMaskTensor = new ort.Tensor("float32", textMaskFlat, textMaskShape);

		const dpOutputs = await this.dpOrt.run({
			text_ids: textIdsTensor,
			style_dp: style.dp,
			text_mask: textMaskTensor,
		});
		const duration = Array.from(dpOutputs.duration.data as Float32Array);

		for (let i = 0; i < duration.length; i += 1) {
			duration[i] /= speed;
		}

		const textEncOutputs = await this.textEncOrt.run({
			text_ids: textIdsTensor,
			style_ttl: style.ttl,
			text_mask: textMaskTensor,
		});
		const textEmb = textEncOutputs.text_emb as ort.Tensor;

		const maskCong = this.sampleNoisyLatent(duration, this.sampleRate, this.cfgs.ae.base_chunk_size, this.cfgs.ttl.chunk_compress_factor, this.cfgs.ttl.latent_dim);
        let xt = maskCong.xt;
        const latentMask = maskCong.latentMask;

		const latentMaskFlat = new Float32Array(latentMask.flat(2));
		const latentMaskShape: [number, number, number] = [bsz, 1, latentMask[0]?.[0]?.length ?? 0];
		const latentMaskTensor = new ort.Tensor("float32", latentMaskFlat, latentMaskShape);

		const totalStepArray = new Float32Array(bsz).fill(totalStep);
		const totalStepTensor = new ort.Tensor("float32", totalStepArray, [bsz]);

		for (let step = 0; step < totalStep; step += 1) {
			const currentStepArray = new Float32Array(bsz).fill(step);
			const currentStepTensor = new ort.Tensor("float32", currentStepArray, [bsz]);

			const xtFlat = new Float32Array(xt.flat(2));
			const xtShape: [number, number, number] = [bsz, xt[0]?.length ?? 0, xt[0]?.[0]?.length ?? 0];
			const xtTensor = new ort.Tensor("float32", xtFlat, xtShape);

			const vectorEstOutputs = await this.vectorEstOrt.run({
				noisy_latent: xtTensor,
				text_emb: textEmb,
				style_ttl: style.ttl,
				latent_mask: latentMaskTensor,
				text_mask: textMaskTensor,
				current_step: currentStepTensor,
				total_step: totalStepTensor,
			});

			const denoisedData = Array.from(vectorEstOutputs.denoised_latent.data as Float32Array);

			const latentDim = xt[0]?.length ?? 0;
			const latentLen = xt[0]?.[0]?.length ?? 0;
			const nextXt: number[][][] = [];
			let idx = 0;
			for (let b = 0; b < bsz; b += 1) {
				const batch: number[][] = [];
				for (let d = 0; d < latentDim; d += 1) {
					const row: number[] = [];
					for (let t = 0; t < latentLen; t += 1) {
						row.push(denoisedData[idx] ?? 0);
						idx += 1;
					}
					batch.push(row);
				}
				nextXt.push(batch);
			}
			xt = nextXt;
		}

		const finalXtFlat = new Float32Array(xt.flat(2));
		const finalXtShape: [number, number, number] = [bsz, xt[0]?.length ?? 0, xt[0]?.[0]?.length ?? 0];
		const finalXtTensor = new ort.Tensor("float32", finalXtFlat, finalXtShape);

		const vocoderOutputs = await this.vocoderOrt.run({
			latent: finalXtTensor,
		});

		const wav = Array.from(vocoderOutputs.wav_tts.data as Float32Array);

		return { wav, duration };
	}

	private sampleNoisyLatent(duration: number[], sampleRate: number, baseChunkSize: number, chunkCompress: number, latentDim: number): { xt: number[][][]; latentMask: number[][][] } {
		const bsz = duration.length;
		const maxDur = Math.max(...duration);

		const wavLenMax = Math.floor(maxDur * sampleRate);
		const wavLengths = duration.map((d) => Math.floor(d * sampleRate));

		const chunkSize = baseChunkSize * chunkCompress;
		const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
		const latentDimVal = latentDim * chunkCompress;

		const xt: number[][][] = [];
		for (let b = 0; b < bsz; b += 1) {
			const batch: number[][] = [];
			for (let d = 0; d < latentDimVal; d += 1) {
				const row: number[] = [];
				for (let t = 0; t < latentLen; t += 1) {
					const u1 = Math.max(0.0001, Math.random());
					const u2 = Math.random();
					const val = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
					row.push(val);
				}
				batch.push(row);
			}
			xt.push(batch);
		}

		const latentLengths = wavLengths.map((len) => Math.floor((len + chunkSize - 1) / chunkSize));
		const latentMask = this.lengthToMask(latentLengths, latentLen);

		for (let b = 0; b < bsz; b += 1) {
			for (let d = 0; d < latentDimVal; d += 1) {
				for (let t = 0; t < latentLen; t += 1) {
					xt[b][d][t] *= latentMask[b][0]?.[t] ?? 0;
				}
			}
		}

		return { xt, latentMask };
	}

	private lengthToMask(lengths: number[], maxLen: number | null = null): number[][][] {
		const actualMaxLen = maxLen ?? Math.max(...lengths);
		return lengths.map((len) => {
			const row: number[] = new Array<number>(actualMaxLen).fill(0.0);
			const limit = Math.min(len, actualMaxLen);
			for (let j = 0; j < limit; j += 1) {
				row[j] = 1.0;
			}
			return [row];
		});
	}

	async call(text: string, style: Style, totalStep: number, speed: number, silenceDuration: number): Promise<{ wav: number[]; duration: number[] }> {
		if (style.ttl.dims[0] !== 1) {
			throw new Error("Single speaker text to speech only supports single style");
		}

		const textList = chunkText(text);
		let wavCat: number[] = [];
		let durCat = 0;

		for (const chunk of textList) {
			const { wav, duration } = await this.infer([chunk], style, totalStep, speed);

			if (wavCat.length === 0) {
				wavCat = wav;
				durCat = duration[0] ?? 0;
			} else {
				const silenceLen = Math.floor(silenceDuration * this.sampleRate);
				const silence: number[] = new Array<number>(silenceLen).fill(0);
				wavCat = [...wavCat, ...silence, ...wav];
				durCat += (duration[0] ?? 0) + silenceDuration;
			}
		}

		return { wav: wavCat, duration: [durCat] };
	}
}

function getAbsoluteUrl(path: string): string {
    if (typeof globalThis !== "undefined" && globalThis.location) {
        return new URL(path, globalThis.location.origin).href;
    }
    return path;
}

async function fetchJson<T>(path: string): Promise<T> {
    const url = getAbsoluteUrl(path);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

async function loadCfgs(): Promise<TtsConfig> {
	return fetchJson<TtsConfig>("/models/onnx/tts.json");
}

async function loadTextProcessor(): Promise<UnicodeProcessor> {
	const indexer = await fetchJson<UnicodeIndexerJson>("/models/onnx/unicode_indexer.json");
	return new UnicodeProcessor(indexer);
}

async function loadOnnx(path: string, options: ort.InferenceSession.SessionOptions): Promise<ort.InferenceSession> {
    // onnxruntime-web loads models from URL if passed as string
    const url = getAbsoluteUrl(path);
	return ort.InferenceSession.create(url, options);
}

// Global cache for models to avoid reloading
let globalTextToSpeech: TextToSpeech | null = null;
let globalConfig: TtsConfig | null = null;
const globalStyleCache: Map<VoiceStyleId, Style> = new Map();

async function loadTextToSpeechInternal(): Promise<{ textToSpeech: TextToSpeech; cfgs: TtsConfig }> {
	const cfgs = await loadCfgs();

    const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ["wasm"], // Force WASM for consistency
    };

	const [dpOrt, textEncOrt, vectorEstOrt, vocoderOrt] = await Promise.all([
		loadOnnx("/models/onnx/duration_predictor_quant.onnx", sessionOptions),
		loadOnnx("/models/onnx/text_encoder_quant.onnx", sessionOptions),
		loadOnnx("/models/onnx/vector_estimator_quant.onnx", sessionOptions),
		loadOnnx("/models/onnx/vocoder_quant.onnx", sessionOptions),
	]);

	const textProcessor = await loadTextProcessor();
	const textToSpeech = new TextToSpeech(cfgs, textProcessor, dpOrt, textEncOrt, vectorEstOrt, vocoderOrt);

	return { textToSpeech, cfgs };
}

function chunkText(text: string, maxLen: number = 300): string[] {
    // Simple chunking implementation (copied from serverTts.ts)
	if (typeof text !== "string") {
		throw new Error(`chunkText expects a string, got ${typeof text}`);
	}

	const paragraphs = text
		.trim()
		.split(/\n\s*\n+/)
		.filter((p) => p.trim().length > 0);

	const chunks: string[] = [];

	for (const paragraph of paragraphs) {
		const trimmed = paragraph.trim();
		if (!trimmed) {
			continue;
		}
		// Split by sentence, roughly
		const sentences = trimmed.split(/(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/);

		let currentChunk = "";

		for (const sentence of sentences) {
			if (currentChunk.length + sentence.length + 1 <= maxLen) {
				currentChunk += (currentChunk ? " " : "") + sentence;
			} else {
				if (currentChunk) {
					chunks.push(currentChunk.trim());
				}
				currentChunk = sentence;
			}
		}

		if (currentChunk) {
			chunks.push(currentChunk.trim());
		}
	}

	return chunks;
}

async function loadVoiceStyle(id: VoiceStyleId): Promise<Style> {
    if (globalStyleCache.has(id)) return globalStyleCache.get(id)!;
    
	const voiceStyle = await fetchJson<VoiceStyleJson>(`/models/voice_styles/${id}.json`);

	const ttlDims = voiceStyle.style_ttl.dims;
	const dpDims = voiceStyle.style_dp.dims;

	const ttlDim1 = ttlDims[1];
	const ttlDim2 = ttlDims[2];
	const dpDim1 = dpDims[1];
	const dpDim2 = dpDims[2];

	const ttlFlat = new Float32Array(ttlDim1 * ttlDim2);
	const dpFlat = new Float32Array(dpDim1 * dpDim2);

	const ttlData = voiceStyle.style_ttl.data.flat(2);
	ttlFlat.set(ttlData);

	const dpData = voiceStyle.style_dp.data.flat(2);
	dpFlat.set(dpData);

	const ttlTensor = new ort.Tensor("float32", ttlFlat, [1, ttlDim1, ttlDim2]);
	const dpTensor = new ort.Tensor("float32", dpFlat, [1, dpDim1, dpDim2]);

	const style = new Style(ttlTensor, dpTensor);
    globalStyleCache.set(id, style);
    return style;
}

function writeWavToBuffer(audioData: number[], sampleRate: number): ArrayBuffer {
	const numChannels = 1;
	const bitsPerSample = 16;
	const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
	const blockAlign = (numChannels * bitsPerSample) / 8;
	const dataSize = (audioData.length * bitsPerSample) / 8;

	const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");

	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitsPerSample, true);

	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	for (let i = 0; i < audioData.length; i += 1) {
		const sample = Math.max(-1, Math.min(1, audioData[i]));
		const intSample = Math.floor(sample * 32767);
		view.setInt16(44 + i * 2, intSample, true);
	}

	return buffer;
}


export async function synthesize(options: SynthesizeOptions): Promise<SynthesisResult> {
	const { text, voiceStyle, totalStep, speed, silenceDurationSeconds } = options;
	const silenceDuration = silenceDurationSeconds ?? 0.3;

    if (!globalTextToSpeech) {
        const { textToSpeech, cfgs } = await loadTextToSpeechInternal();
        globalTextToSpeech = textToSpeech;
        globalConfig = cfgs;
    }

    const textToSpeech = globalTextToSpeech!;
	const style = await loadVoiceStyle(voiceStyle);

	const { wav, duration } = await textToSpeech.call(text, style, totalStep, speed, silenceDuration);

	const effectiveDuration = duration[0] ?? 0;
	const wavLen = Math.floor(textToSpeech.sampleRate * effectiveDuration);
	const wavOut = wav.slice(0, wavLen);

	const wavBuffer = writeWavToBuffer(wavOut, textToSpeech.sampleRate);

	return {
		wavBuffer,
		sampleRate: textToSpeech.sampleRate,
		durationSeconds: effectiveDuration,
	};
}
