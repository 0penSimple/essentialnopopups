import createEncoder from '@jsquash/avif/codec/enc/avif_enc.js';
import wasmBase64 from '@jsquash/avif/codec/enc/avif_enc.wasm';
let encoderPromise;
window.ImageAvifEncoder = {
  async encode(imageData, quality) {
    if (!encoderPromise) {
      const decoded = atob(wasmBase64);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      encoderPromise = createEncoder({ noInitialRun: true, wasmBinary: bytes, locateFile: () => '' });
    }
    const encoder = await encoderPromise;
    const options = {
      quality: Math.round(quality * 100), qualityAlpha: -1, denoiseLevel: 0,
      tileColsLog2: 0, tileRowsLog2: 0, speed: 6, subsample: 1,
      chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false,
      bitDepth: 8, lossless: false
    };
    const bytes = encoder.encode(new Uint8Array(imageData.data.buffer), imageData.width, imageData.height, options);
    if (!bytes || !bytes.length) throw new Error('AVIF encoding failed.');
    return new Blob([bytes], { type: 'image/avif' });
  }
};
