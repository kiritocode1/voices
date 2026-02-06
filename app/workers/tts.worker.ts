import { synthesize, type SynthesizeOptions } from "../../lib/clientTts";

// Define message types
export type WorkerRequest = {
    type: "SYNTHESIZE";
    options: SynthesizeOptions;
};

export type WorkerResponse = 
    | { type: "SUCCESS"; payload: { wavBuffer: ArrayBuffer; sampleRate: number; durationSeconds: number } }
    | { type: "ERROR"; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { type, options } = event.data;

    if (type === "SYNTHESIZE") {
        try {
            const result = await synthesize(options);
            
            // Send back the result (buffers are transferable)
            self.postMessage(
                { type: "SUCCESS", payload: { 
                    wavBuffer: result.wavBuffer,
                    sampleRate: result.sampleRate,
                    durationSeconds: result.durationSeconds
                }}, 
                { transfer: [result.wavBuffer] }
            );
        } catch (error) {
            console.error("Worker synthesis error:", error);
            self.postMessage({ type: "ERROR", error: error instanceof Error ? error.message : "Unknown error in worker" });
        }
    }
};
