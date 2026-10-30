// Runs Piper voice models off the main thread: ids in, PCM samples out. One thread on purpose,
// because multi-threaded WASM needs cross-origin isolation headers that the app does not send.
import * as ort from 'onnxruntime-web/wasm';

type Config = { audio: { sample_rate: number }; inference: { noise_scale: number; length_scale: number; noise_w: number }; num_speakers?: number };
type Request =
  | { id: number; type: 'init'; wasmPaths: string }
  | { id: number; type: 'load'; key: string; model: ArrayBuffer }
  | { id: number; type: 'run'; key: string; ids: number[]; config: Config; rate: number; speaker: number };

const sessions = new Map<string, ort.InferenceSession>();

async function handle(message: Request): Promise<{ pcm?: Float32Array; ok?: boolean }> {
  if (message.type === 'init') {
    ort.env.wasm.wasmPaths = message.wasmPaths;
    ort.env.wasm.numThreads = 1;
    return { ok: true };
  }
  if (message.type === 'load') {
    if (!sessions.has(message.key)) sessions.set(message.key, await ort.InferenceSession.create(new Uint8Array(message.model)));
    return { ok: true };
  }
  const session = sessions.get(message.key);
  if (!session) throw new Error('VOICE_NOT_LOADED');
  const { noise_scale: noise, length_scale: length, noise_w: width } = message.config.inference;
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor('int64', BigInt64Array.from(message.ids, BigInt), [1, message.ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(message.ids.length)]), [1]),
    // A longer length_scale is slower speech, so the rate divides it.
    scales: new ort.Tensor('float32', Float32Array.from([noise, length / message.rate, width]), [3])
  };
  if ((message.config.num_speakers ?? 1) > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(message.speaker)]), [1]);
  const { output } = await session.run(feeds);
  return { pcm: Float32Array.from(output.data as Float32Array) };
}

self.onmessage = ({ data }: MessageEvent<Request>) => {
  handle(data).then(
    (result) => (self as unknown as Worker).postMessage({ id: data.id, ...result }, result.pcm ? [result.pcm.buffer] : []),
    (error) => (self as unknown as Worker).postMessage({ id: data.id, error: String(error?.message || error) })
  );
};
