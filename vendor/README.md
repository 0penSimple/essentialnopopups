# Browser image encoders

`image-encoders.js` bundles Favium 0.2.0 (ICO) and @stacksjs/ts-bmp 0.1.1 (BMP). `avif-encoder.js` bundles the single-thread encoder and embedded WASM from @jsquash/avif 2.1.1. They are static assets loaded only when their output format is selected. The site's deployment still requires no build step.

The unminified entry points are in `src/`. To rebuild after reviewing dependency updates, install those exact packages and esbuild 0.25.9 in a temporary development directory, then bundle each entry point for the browser with `--bundle --minify --format=iife --platform=browser`. The AVIF bundle also requires `--loader:.wasm=base64` so it works from the static site and local file previews without an extra WASM request. Keep the single-thread codec to avoid requiring cross-origin isolation on image tool pages.

Favium and @jsquash/avif license files are included here. @stacksjs/ts-bmp declares MIT in its package metadata and README, but does not publish a license file in its package; its attribution and MIT text are in `LICENSE-ts-bmp.txt`. Validate BMP, multi-size ICO, and AVIF output after any dependency or bundle change.

# GIF codecs

`modern-gif.js` is the browser bundle from modern-gif 2.1.0 and is used for
deterministic GIF metadata and composed-frame decoding. `gifenc.js` is gifenc
1.0.3 with a two-line global wrapper (`globalThis.GifEnc`) around its published
CommonJS browser bundle. It is used for fast local GIF encoding. Both assets
load only when an animation operation needs them; neither requires a CDN.

The roles are intentionally separate. On a synthetic 10-frame 480×270 photo
benchmark, modern-gif's encoder took about 6.4 seconds without dithering and
11.6 seconds with dithering, while gifenc took about 1.1 seconds. Both produced
valid ten-frame GIFs with the requested 200 ms timing. The included MIT license
files are `LICENSE-modern-gif.txt` and `LICENSE-gifenc.txt`.

`webp-animation-encoder.js` bundles wasm-webp 0.1.0 and its embedded libwebp
WebAssembly binary. It exposes the real libwebp animation encoder, loads only
when animated WebP output is selected, and makes no runtime network request.
The reviewed build entry is `src/webp-animation-entry.mjs`; its browser-only
Emscripten source and WASM input are kept under `src/wasm-webp/`. Rebuild with
esbuild's `.wasm=binary` loader and include `LICENSE-wasm-webp.txt`.
The adapter also corrects wasm-webp 0.1.0's missing terminating null-frame call
by writing the requested final-frame duration into the final standard `ANMF`
chunk. Container tests verify unequal durations such as 50/120/310 ms exactly.
