/* Private image engine. Public contracts and lazy loading live in tools-api.js. */
(function () {
  const Tools = window.Tools || {};
  const imageFormats = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp", "image/x-icon"]);
  const assetBase = document.currentScript?.src ? new URL("../", document.currentScript.src).href : "";
  const loads = {};

  function loadEncoder(key, filename, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!loads[key]) loads[key] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = assetBase + "vendor/" + filename;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error("Image encoder did not start."));
      script.onerror = () => reject(new Error("Image encoder could not be loaded."));
      document.head.appendChild(script);
    }).catch(error => { delete loads[key]; throw error; });
    return loads[key];
  }

  const loadGifDecoder = () => loadEncoder("gif-decoder", "modern-gif.js", "modernGif");
  const loadGifEncoder = () => loadEncoder("gif-encoder", "gifenc.js", "GifEnc");
  const loadWebPAnimationEncoder = () => loadEncoder(
    "webp-animation", "webp-animation-encoder.js", "WebPAnimationEncoder"
  );

  function sourceWidthOf(source) {
    return source.naturalWidth || source.videoWidth || source.displayWidth || source.width;
  }

  function sourceHeightOf(source) {
    return source.naturalHeight || source.videoHeight || source.displayHeight || source.height;
  }

  function isGif(file) {
    return file.type === "image/gif" || /\.gif$/i.test(file.name || "");
  }

  function checkAbort(signal) {
    if (signal?.aborted) throw signal.reason || new DOMException("The operation was cancelled.", "AbortError");
  }

  function rgbaCanvas(frame) {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    return canvas;
  }

  async function decodeGif(file, allFrames = true, signal) {
    checkAbort(signal);
    const decoder = await loadGifDecoder();
    const bytes = await file.arrayBuffer();
    checkAbort(signal);
    const gif = decoder.decode(bytes);
    const frames = allFrames
      ? decoder.decodeFrames(bytes, { gif })
      : [decoder.decodeFrame(bytes, 0, gif)];
    return {
      format: "image/gif",
      width: gif.width,
      height: gif.height,
      loopCount: gif.looped ? (gif.loopCount ?? 0) : -1,
      frameCount: gif.frames.length,
      frames: frames.map(frame => ({
        width: frame.width,
        height: frame.height,
        duration: frame.delay || 100,
        data: frame.data
      }))
    };
  }

  async function withImage(file, work) {
    if (!(file instanceof Blob)) throw new TypeError("An image Blob is required.");
    if (isGif(file)) {
      const sequence = await decodeGif(file, false);
      return work(rgbaCanvas(sequence.frames[0]));
    }
    if (["image/webp", "image/avif"].includes(file.type) && window.ImageDecoder) {
      try {
        if (await ImageDecoder.isTypeSupported(file.type)) {
          const sequence = await decodeWithImageDecoder(file, false);
          if (sequence) return work(rgbaCanvas(sequence.frames[0]));
        }
      } catch (_) {
        // Some browsers expose ImageDecoder but cannot retrieve track metadata
        // for a particular file. The ordinary image decoder is the safe fallback.
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("This image could not be opened."));
        image.src = url;
      });
      if (!sourceWidthOf(image) || !sourceHeightOf(image)) throw new Error("This image has no usable dimensions.");
      return await work(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function validateImageDimensions(width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
        width > 16384 || height > 16384 || width * height > 100000000) {
      throw new RangeError("Image dimensions must be between 1 and 16,384 pixels, up to 100 megapixels.");
    }
  }

  function imageCanvas(image, width, height, format) {
    validateImageDimensions(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (format === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  }

  function resizedImageCanvas(image, width, height, format) {
    validateImageDimensions(width, height);
    let source = image;
    let sourceWidth = sourceWidthOf(image);
    let sourceHeight = sourceHeightOf(image);
    // Reduce large images in stages so the browser does not discard most pixels
    // in one draw. Keep alpha until the final JPEG background is applied.
    if (width <= sourceWidth && height <= sourceHeight) {
      while (sourceWidth > width * 2 || sourceHeight > height * 2) {
        const nextWidth = Math.max(width, Math.ceil(sourceWidth / 2));
        const nextHeight = Math.max(height, Math.ceil(sourceHeight / 2));
        source = imageCanvas(source, nextWidth, nextHeight, "image/png");
        sourceWidth = nextWidth;
        sourceHeight = nextHeight;
      }
    }
    return imageCanvas(source, width, height, format);
  }

  async function canvasBlob(canvas, format, quality) {
    const result = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export failed.")),
        format, format === "image/png" ? undefined : quality);
    });
    if (result.type !== format) throw new Error("This browser does not support the selected output format.");
    return result;
  }

  function pngChunk(type, data) {
    const bytes = new Uint8Array(data.length + 12);
    new DataView(bytes.buffer).setUint32(0, data.length);
    for (let i = 0; i < 4; i++) bytes[i + 4] = type.charCodeAt(i);
    bytes.set(data, 8);
    let crc = 0xffffffff;
    for (let i = 4; i < bytes.length - 4; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    new DataView(bytes.buffer).setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
    return bytes;
  }

  async function pngFromScanlines(width, height, depth, colorType, scanlines, palette, alpha) {
    const stream = new Blob([scanlines]).stream().pipeThrough(new CompressionStream("deflate"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    header[8] = depth;
    header[9] = colorType;
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    return new Blob([signature, pngChunk("IHDR", header),
      ...(palette ? [pngChunk("PLTE", palette)] : []),
      ...(alpha ? [pngChunk("tRNS", alpha)] : []),
      pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array())], { type: "image/png" });
  }

  // Use a truecolor PNG when resizing introduces more colors than a palette
  // can hold. Choose the cheapest standard PNG filter for each scanline.
  async function truecolorPngCandidate(width, height, rgba) {
    const stride = width * 4;
    const scanlines = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      const start = y * stride;
      let bestScore = Infinity, bestType = 0, bestRow = null;
      for (let type = 0; type <= 4; type++) {
        const row = new Uint8Array(stride);
        let score = 0;
        for (let i = 0; i < stride; i++) {
          const value = rgba[start + i];
          const left = i >= 4 ? rgba[start + i - 4] : 0;
          const above = y ? rgba[start - stride + i] : 0;
          const upperLeft = y && i >= 4 ? rgba[start - stride + i - 4] : 0;
          let predictor = 0;
          if (type === 1) predictor = left;
          else if (type === 2) predictor = above;
          else if (type === 3) predictor = (left + above) >> 1;
          else if (type === 4) {
            const p = left + above - upperLeft;
            const a = Math.abs(p - left), b = Math.abs(p - above), c = Math.abs(p - upperLeft);
            predictor = a <= b && a <= c ? left : b <= c ? above : upperLeft;
          }
          const filtered = (value - predictor + 256) & 255;
          row[i] = filtered;
          score += Math.min(filtered, 256 - filtered);
        }
        if (score < bestScore) { bestScore = score; bestType = type; bestRow = row; }
      }
      scanlines[y * (stride + 1)] = bestType;
      scanlines.set(bestRow, y * (stride + 1) + 1);
    }
    return pngFromScanlines(width, height, 8, 6, scanlines);
  }

  // Lossless palette encoding can be much smaller for flat artwork. Never
  // quantize: more than 256 colors use the truecolor candidate instead.
  async function indexedPngCandidate(canvas) {
    if (!window.CompressionStream || canvas.width * canvas.height > 2000000) return null;
    const { width, height } = canvas;
    const rgba = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const palette = [];
    const colorIndex = new Map();
    const indices = new Uint8Array(width * height);
    for (let pixel = 0; pixel < indices.length; pixel++) {
      const offset = pixel * 4;
      const key = `${rgba[offset]},${rgba[offset + 1]},${rgba[offset + 2]},${rgba[offset + 3]}`;
      let index = colorIndex.get(key);
      if (index === undefined) {
        if (palette.length === 256) return truecolorPngCandidate(width, height, rgba);
        index = palette.length;
        colorIndex.set(key, index);
        palette.push(rgba.slice(offset, offset + 4));
      }
      indices[pixel] = index;
    }
    const depth = palette.length <= 2 ? 1 : palette.length <= 4 ? 2 : palette.length <= 16 ? 4 : 8;
    const stride = Math.ceil(width * depth / 8);
    const scanlines = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      const row = y * (stride + 1) + 1;
      for (let x = 0; x < width; x++) {
        const bit = x * depth;
        scanlines[row + (bit >> 3)] |= indices[y * width + x] << (8 - depth - (bit & 7));
      }
    }
    const colors = new Uint8Array(palette.length * 3);
    const alpha = new Uint8Array(palette.length);
    palette.forEach((color, i) => {
      colors.set(color.slice(0, 3), i * 3);
      alpha[i] = color[3];
      hasAlpha ||= color[3] !== 255;
    });
    return pngFromScanlines(width, height, depth, 3, scanlines, colors, hasAlpha ? alpha : null);
  }

  async function optimizedImageBlob(canvas, format, quality, inputBytes) {
    const initial = await canvasBlob(canvas, format, quality);
    if (format === "image/png") {
      try {
        const indexed = await indexedPngCandidate(canvas);
        return indexed && indexed.size < initial.size ? indexed : initial;
      } catch (_) { return initial; } // Canvas PNG remains valid if optional optimization fails.
    }
    if (initial.size <= inputBytes) return initial;
    const floor = Math.min(quality, 0.88);
    if (floor === quality) return initial;
    let low = floor, high = quality, best = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const q = attempt === 0 ? floor : (low + high) / 2;
      const candidate = await canvasBlob(canvas, format, q);
      if (attempt === 0 && candidate.size > inputBytes) return initial;
      if (candidate.size <= inputBytes) { best = candidate; low = q; }
      else high = q;
      if (high - low < 0.01) break;
    }
    return best || initial;
  }

  Tools.imageDimensions = file => withImage(file, image => ({ width: sourceWidthOf(image), height: sourceHeightOf(image) }));

  Tools.imageFormatForFile = function (file) {
    const ext = file.name?.split(".").pop().toLowerCase();
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type
      : file.type ? "image/png"
      : ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext] || "image/png");
    return { mime, extension: mime === "image/jpeg" ? (ext === "jpeg" ? "jpeg" : "jpg") : mime.slice(6) };
  };

  Tools.resizeImage = function (file, options = {}) {
    const { width, height, percent, format, quality = 0.96 } = options;
    if (!(file instanceof Blob)) throw new TypeError("An image Blob is required.");
    const output = format || Tools.imageFormatForFile(file).mime;
    if (!["image/jpeg", "image/png", "image/webp"].includes(output)) throw new TypeError("Unsupported resize output format.");
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new RangeError("Quality must be between 0 and 1.");
    return withImage(file, async image => {
      const imageWidth = sourceWidthOf(image), imageHeight = sourceHeightOf(image);
      const w = percent == null ? Number(width) : Math.round(imageWidth * Number(percent) / 100);
      const h = percent == null ? Number(height) : Math.round(imageHeight * Number(percent) / 100);
      // No pixel or format change: preserve the original encoder output and metadata.
      if (w === imageWidth && h === imageHeight && output === file.type &&
          !Object.hasOwn(options, "quality")) return file;
      const canvas = resizedImageCanvas(image, w, h, output);
      return Object.hasOwn(options, "quality")
        ? canvasBlob(canvas, output, quality)
        : optimizedImageBlob(canvas, output, quality, file.size);
    });
  };

  Tools.compressImage = function (file, { format, quality = 0.82, targetBytes } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("An image Blob is required.");
    const output = format || (["image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(output)) throw new TypeError("Unsupported compression output format.");
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new RangeError("Quality must be between 0 and 1.");
    if (targetBytes != null && (!Number.isSafeInteger(targetBytes) || targetBytes < 1)) {
      throw new RangeError("Target size must be a positive number of bytes.");
    }
    if (output === "image/png" && file.type === "image/png") return Promise.resolve(file);
    return withImage(file, async image => {
      const canvas = imageCanvas(image, sourceWidthOf(image), sourceHeightOf(image), output);
      if (targetBytes == null || output === "image/png") return canvasBlob(canvas, output, quality);
      let low = 0.1, high = 0.95, smallest = null, bestFit = null;
      for (let i = 0; i < 8; i++) {
        const q = (low + high) / 2;
        const blob = await canvasBlob(canvas, output, q);
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= targetBytes) { bestFit = blob; low = q; }
        else high = q;
        if (high - low <= 0.02) break;
      }
      return bestFit || smallest;
    });
  };

  Tools.convertImage = async function (file, { format = "image/jpeg", quality = 0.92, icoSizes = [16, 32, 48] } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("An image Blob is required.");
    if (!imageFormats.has(format)) throw new TypeError("Unsupported image output format.");
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      throw new RangeError("Quality must be between 0 and 1.");
    }
    // A PNG already in PNG format needs no transform. Keeping its original bytes
    // also avoids making an efficiently compressed PNG larger on re-encode.
    if (format === "image/png" && file.type === "image/png") return file;

    return withImage(file, async image => {
      const canvas = imageCanvas(image, sourceWidthOf(image), sourceHeightOf(image), format);
      const context = canvas.getContext("2d");
      if (format === "image/bmp") {
        const encoder = await loadEncoder("basic", "image-encoders.js", "ImageEncoders");
        const bytes = encoder.bmp(context.getImageData(0, 0, canvas.width, canvas.height));
        return new Blob([bytes], { type: "image/bmp" });
      }
      if (format === "image/x-icon") {
        if (!Array.isArray(icoSizes) || !icoSizes.length || icoSizes.length > 8 ||
            icoSizes.some(size => !Number.isInteger(size) || size < 1 || size > 256)) {
          throw new RangeError("Choose valid icon sizes up to 256 pixels.");
        }
        const iconCanvas = document.createElement("canvas");
        iconCanvas.width = iconCanvas.height = 256;
        const iconContext = iconCanvas.getContext("2d");
        if (!iconContext) throw new Error("Icon conversion is unavailable in this browser.");
        const scale = Math.min(256 / canvas.width, 256 / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        iconContext.drawImage(canvas, (256 - width) / 2, (256 - height) / 2, width, height);
        const encoder = await loadEncoder("basic", "image-encoders.js", "ImageEncoders");
        const dataUrl = encoder.ico(iconCanvas, icoSizes);
        const raw = atob(dataUrl.split(",")[1]);
        const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
        return new Blob([bytes], { type: "image/x-icon" });
      }
      if (format === "image/avif") {
        const encoder = await loadEncoder("avif", "avif-encoder.js", "ImageAvifEncoder");
        return encoder.encode(context.getImageData(0, 0, canvas.width, canvas.height), quality);
      }
      // Lossless PNG optimization is useful regardless of the input format.
      // For JPG/WebP, only constrain growth when the format is unchanged;
      // cross-format conversion continues to honor the selected quality.
      if (format === "image/png" ||
          (format === file.type && ["image/jpeg", "image/webp"].includes(format))) {
        return optimizedImageBlob(canvas, format, quality, file.size);
      }
      return canvasBlob(canvas, format, quality);
    });
  };

  async function decodeWithImageDecoder(file, allFrames, signal) {
    if (!window.ImageDecoder || !file.type || !await ImageDecoder.isTypeSupported(file.type)) return null;
    checkAbort(signal);
    const decoder = new ImageDecoder({ data: new Uint8Array(await file.arrayBuffer()), type: file.type, preferAnimation: true });
    try {
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const count = allFrames ? track.frameCount : 1;
      const frames = [];
      for (let index = 0; index < count; index++) {
        checkAbort(signal);
        const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
        const duration = Math.max(20, Math.round((image.duration || 100000) / 1000));
        const canvas = imageCanvas(image, image.displayWidth, image.displayHeight, "image/png");
        image.close();
        const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        frames.push({ width: canvas.width, height: canvas.height,
          duration, data: pixels.data });
      }
      return { format: file.type, width: frames[0].width, height: frames[0].height,
        loopCount: track.repetitionCount ?? 0, frameCount: track.frameCount, frames };
    } finally {
      decoder.close();
    }
  }

  Tools.decodeAnimation = async function (file, { frames = "all", signal } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("An image Blob is required.");
    if (!['all', 'first'].includes(frames)) throw new TypeError("frames must be 'all' or 'first'.");
    if (isGif(file)) return decodeGif(file, frames === "all", signal);
    if (["image/webp", "image/avif"].includes(file.type)) {
      try {
        const native = await decodeWithImageDecoder(file, frames === "all", signal);
        if (native) return native;
      } catch (error) {
        checkAbort(signal);
        // Fall through for still images when animation metadata is unavailable.
      }
    }
    return withImage(file, image => {
      checkAbort(signal);
      const canvas = imageCanvas(image, sourceWidthOf(image), sourceHeightOf(image), "image/png");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      return { format: file.type || "image/unknown", width: canvas.width, height: canvas.height,
        loopCount: -1, frameCount: 1,
        frames: [{ width: canvas.width, height: canvas.height, duration: 100, data: pixels.data }] };
    });
  };

  Tools.splitAnimation = async function (file, {
    format = "image/png", quality = 0.92, onProgress, signal
  } = {}) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(format)) {
      throw new TypeError("Animation frames can be exported as PNG, JPG, or WebP.");
    }
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      throw new RangeError("Quality must be between 0 and 1.");
    }
    const sequence = await Tools.decodeAnimation(file, { frames: "all", signal });
    const frames = [];
    for (let index = 0; index < sequence.frames.length; index++) {
      checkAbort(signal);
      const frame = sequence.frames[index];
      const blob = await canvasBlob(rgbaCanvas(frame), format, quality);
      frames.push({ blob, duration: frame.duration, index });
      onProgress?.((index + 1) / sequence.frames.length);
      if (index + 1 < sequence.frames.length) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { format: sequence.format, width: sequence.width, height: sequence.height,
      loopCount: sequence.loopCount, frameCount: sequence.frameCount, frames };
  };

  Tools.inspectImage = async function (file) {
    if (isGif(file)) {
      const decoder = await loadGifDecoder();
      const gif = decoder.decode(await file.arrayBuffer());
      return { format: "image/gif", width: gif.width, height: gif.height,
        animated: gif.frames.length > 1, frameCount: gif.frames.length,
        loopCount: gif.looped ? (gif.loopCount ?? 0) : -1 };
    }
    if (["image/webp", "image/avif"].includes(file.type) && window.ImageDecoder) {
      try {
        if (await ImageDecoder.isTypeSupported(file.type)) {
          const decoder = new ImageDecoder({ data: new Uint8Array(await file.arrayBuffer()), type: file.type, preferAnimation: true });
          try {
            await decoder.tracks.ready;
            const track = decoder.tracks.selectedTrack;
            const { image } = await decoder.decode({ frameIndex: 0, completeFramesOnly: true });
            const width = image.displayWidth, height = image.displayHeight;
            image.close();
            return { format: file.type, width, height,
              animated: track.frameCount > 1, frameCount: track.frameCount, loopCount: track.repetitionCount ?? 0 };
          } finally { decoder.close(); }
        }
      } catch (_) {
        // Report the file as a still image through the regular decoder below.
      }
    }
    const dimensions = await Tools.imageDimensions(file);
    return { format: file.type || "image/unknown", ...dimensions, animated: false, frameCount: 1, loopCount: -1 };
  };

  Tools.encodeAnimation = async function (sequence, {
    format = "image/gif", quality, repeat, lossless = false, onProgress, signal
  } = {}) {
    if (!["image/gif", "image/webp"].includes(format)) {
      throw new TypeError("Animated AVIF encoding is not safely available in this browser build.");
    }
    const frames = sequence?.frames;
    if (!frames || (!frames[Symbol.iterator] && !frames[Symbol.asyncIterator])) {
      throw new TypeError("Animation frames must be an iterable or async iterable.");
    }
    const expectedFrames = Number.isSafeInteger(sequence.frameCount) ? sequence.frameCount
      : Number.isSafeInteger(frames.length) ? frames.length : null;
    if (expectedFrames != null && expectedFrames < 2) throw new TypeError("Choose at least two animation frames.");
    if (format === "image/gif") {
      quality ??= 10;
      if (!Number.isInteger(quality) || quality < 1 || quality > 30) {
        throw new RangeError("GIF quality must be between 1 and 30.");
      }
    } else {
      quality ??= 0.9;
      if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new RangeError("WebP quality must be between 0 and 1.");
      }
      if (repeat != null && repeat !== 0) {
        throw new RangeError("Animated WebP currently supports continuous looping only.");
      }
    }
    const width = Number(sequence.width), height = Number(sequence.height);
    validateImageDimensions(width, height);
    const encodedFrames = [];
    const encoder = format === "image/gif" ? await loadGifEncoder() : await loadWebPAnimationEncoder();
    const gif = format === "image/gif" ? encoder.GIFEncoder() : null;
    const maxColors = format === "image/gif" ? Math.round(256 - ((quality - 1) / 29) * 192) : null;
    let index = 0;
    for await (const frame of frames) {
      checkAbort(signal);
      if (frame.width !== width || frame.height !== height || frame.data?.length !== width * height * 4) {
        throw new TypeError("Every animation frame must be full-size RGBA pixel data.");
      }
      const duration = Math.max(20, Math.min(10000, Math.round(frame.duration || 100)));
      if (format === "image/gif") {
        const palette = encoder.quantize(frame.data, maxColors, { format: "rgb565" });
        const indexed = encoder.applyPalette(frame.data, palette, "rgb565");
        gif.writeFrame(indexed, width, height, { palette, duration,
          delay: duration, repeat: repeat ?? sequence.loopCount ?? 0 });
      } else {
        const data = frame.data instanceof Uint8Array ? frame.data
          : new Uint8Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
        encodedFrames.push({ data, duration, quality: quality * 100, lossless });
      }
      index++;
      const progress = expectedFrames ? index / expectedFrames : 1 - 1 / (index + 1);
      onProgress?.(format === "image/webp" ? progress * 0.8 : progress);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (index < 2) throw new TypeError("Choose one animated image or at least two still images.");
    if (format === "image/gif") {
      gif.finish();
      return new Blob([gif.bytes()], { type: "image/gif" });
    }
    checkAbort(signal);
    // Frames are always RGBA. wasm-webp's hasAlpha argument selects the input
    // byte layout (RGBA vs RGB); it is not merely an alpha-presence hint.
    const bytes = await encoder.encode(width, height, true, encodedFrames);
    if (!bytes?.length) throw new Error("Animated WebP encoding failed.");
    checkAbort(signal);
    onProgress?.(1);
    return new Blob([bytes], { type: "image/webp" });
  };

  Tools.imagesToAnimation = async function (files, {
    format = "image/gif", width, delay = 200, quality, repeat = 0,
    lossless = false, background = "#ffffff", preserveTiming = false, onProgress, signal
  } = {}) {
    const frames = Array.from(files || []);
    if (!frames.length || frames.some(file => !(file instanceof Blob))) {
      throw new TypeError("Choose one animated image or at least two still images.");
    }
    if (!Number.isSafeInteger(delay) || delay < 20 || delay > 10000) {
      throw new RangeError("Frame delay must be between 20 and 10,000 milliseconds.");
    }
    checkAbort(signal);
    const first = await Tools.imageDimensions(frames[0]);
    const outputWidth = width == null ? first.width : Number(width);
    const outputHeight = Math.round(first.height * outputWidth / first.width);
    validateImageDimensions(outputWidth, outputHeight);
    async function* normalizedFrames() {
      for (const file of frames) {
        const decoded = await Tools.decodeAnimation(file, { frames: "all", signal });
        for (const sourceFrame of decoded.frames) {
          checkAbort(signal);
          const canvas = document.createElement("canvas");
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Image processing is unavailable in this browser.");
          context.fillStyle = background;
          context.fillRect(0, 0, outputWidth, outputHeight);
          const image = rgbaCanvas(sourceFrame);
          const scale = Math.min(outputWidth / image.width, outputHeight / image.height);
          const frameWidth = Math.round(image.width * scale);
          const frameHeight = Math.round(image.height * scale);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, Math.round((outputWidth - frameWidth) / 2),
            Math.round((outputHeight - frameHeight) / 2), frameWidth, frameHeight);
          yield { width: outputWidth, height: outputHeight,
            duration: preserveTiming ? sourceFrame.duration : delay,
            data: context.getImageData(0, 0, outputWidth, outputHeight).data };
        }
      }
    }
    return Tools.encodeAnimation({ width: outputWidth, height: outputHeight, loopCount: repeat,
      frames: normalizedFrames() }, { format, quality, repeat, lossless, onProgress, signal });
  };

  // Backward-compatible name used by the current Photos to GIF page.
  Tools.photosToGif = (files, options) => Tools.imagesToAnimation(files, { ...options, format: "image/gif" });

  window.Tools = Tools;
})();
