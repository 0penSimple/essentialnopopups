import createModule from './wasm-webp/webp-wasm.js';
import wasmBinary from './wasm-webp/webp-wasm.wasm';

let modulePromise;
const getModule = () => modulePromise ||= createModule({ wasmBinary, locateFile: () => "webp-wasm.wasm" });

async function encode(width, height, hasAlpha, frames) {
  const module = await getModule();
  const frameVector = new module.VectorWebPAnimationFrame();
  try {
    for (const frame of frames) {
      const config = {
        lossless: frame.lossless ? 1 : 0,
        quality: Math.max(0, Math.min(100, Number(frame.quality ?? 90)))
      };
      frameVector.push_back({
        duration: Math.max(1, Math.round(frame.duration || 100)),
        data: frame.data,
        config,
        has_config: true
      });
    }
    const bytes = module.encodeAnimation(width, height, hasAlpha, frameVector);
    if (!bytes?.length) return bytes;
    // wasm-webp 0.1.0 omits libwebp's terminating null-frame call, so the
    // last ANMF duration falls back to an encoder default. Patch only that
    // container field to the caller's requested final-frame duration.
    let offset = 12, lastFrameOffset = -1;
    while (offset + 8 <= bytes.length) {
      const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const size = bytes[offset + 4] | bytes[offset + 5] << 8 | bytes[offset + 6] << 16 | bytes[offset + 7] << 24;
      if (type === "ANMF") lastFrameOffset = offset + 8;
      offset += 8 + size + (size & 1);
    }
    if (lastFrameOffset >= 0) {
      const duration = Math.max(1, Math.min(0xffffff, Math.round(frames.at(-1)?.duration || 100)));
      bytes[lastFrameOffset + 12] = duration & 255;
      bytes[lastFrameOffset + 13] = duration >> 8 & 255;
      bytes[lastFrameOffset + 14] = duration >> 16 & 255;
    }
    return bytes;
  } finally {
    frameVector.delete?.();
  }
}

globalThis.WebPAnimationEncoder = { encode };
