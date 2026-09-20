/* EssentialBits processing API
   ============================
   Public catalog used by tool pages and future workflows. Implementations load
   by domain on first use from tool-engines/. Keep public contracts here.
*/
(function () {
  "use strict";

  const Tools = window.Tools || {};
  const baseUrl = document.currentScript?.src
    ? new URL(".", document.currentScript.src).href
    : new URL("./", document.baseURI).href;
  // Increment when an engine contract changes. The query keeps browsers and
  // CDNs from pairing a newer API facade with a stale private engine file.
  const engineVersion = "2026-09-20.4";
  const engineLoads = new Map();

  const catalog = Object.freeze({
    imageDimensions: Object.freeze({
      description: "Read the natural pixel dimensions of a browser-decodable image.",
      input: "Blob",
      options: null,
      output: "Promise<{ width: number, height: number }>",
      engine: "images"
    }),
    imageFormatForFile: Object.freeze({
      description: "Resolve the preserved JPG, PNG, or WebP output format for an image file.",
      input: "Blob or File",
      options: null,
      output: "{ mime: string, extension: string }",
      engine: null
    }),
    resizeImage: Object.freeze({
      description: "Resize an image by dimensions or percentage while preserving its format when possible.",
      input: "Blob",
      options: "{ width?, height?, percent?, format?, quality? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    compressImage: Object.freeze({
      description: "Compress an image by quality or target byte size.",
      input: "Blob",
      options: "{ format?, quality?, targetBytes? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    convertImage: Object.freeze({
      description: "Convert an image to JPG, PNG, WebP, AVIF, BMP, or ICO. Animated inputs use their first composed frame.",
      input: "Blob",
      options: "{ format?, quality?, icoSizes? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    photosToGif: Object.freeze({
      description: "Compatibility alias that combines ordered images into an animated GIF.",
      input: "Blob[]",
      options: "{ width?, delay?, quality?, repeat?, background?, onProgress? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    inspectImage: Object.freeze({
      description: "Read dimensions and animation metadata without decoding every frame.",
      input: "Blob",
      options: null,
      output: "Promise<{ format, width, height, animated, frameCount, loopCount }>",
      engine: "images"
    }),
    decodeAnimation: Object.freeze({
      description: "Decode a static or animated image into normalized RGBA frames.",
      input: "Blob",
      options: "{ frames?: 'all'|'first', signal? }",
      output: "Promise<{ format, width, height, loopCount, frameCount, frames }>",
      engine: "images"
    }),
    splitAnimation: Object.freeze({
      description: "Decode an animation into individually reusable still-image frame Blobs.",
      input: "Blob",
      options: "{ format?, quality?, onProgress?, signal? }",
      output: "Promise<{ format, width, height, loopCount, frameCount, frames: [{ blob, duration, index }] }>",
      engine: "images"
    }),
    encodeAnimation: Object.freeze({
      description: "Encode normalized RGBA frames as GIF or animated WebP.",
      input: "{ width, height, loopCount?, frames: [{ width, height, duration, data }] }",
      options: "{ format?, quality?, repeat?, lossless?, onProgress?, signal? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    imagesToAnimation: Object.freeze({
      description: "Combine static or animated images into one normalized animation.",
      input: "Blob[]",
      options: "{ format?, width?, delay?, quality?, repeat?, lossless?, background?, preserveTiming?, onProgress?, signal? }",
      output: "Promise<Blob>",
      engine: "images"
    }),
    inspectImageMetadata: Object.freeze({
      description: "Inspect JPEG, PNG, or WebP metadata, optional container data, and Content Credentials.",
      input: "Blob",
      options: "{ verifyC2pa? }",
      output: "Promise<{ format, mime, findings, warnings, c2pa }>",
      engine: "metadata"
    }),
    explainImageMetadata: Object.freeze({
      description: "Combine related metadata fields into a cautious plain-language account of what the file reveals.",
      input: "Image metadata inspection result",
      options: null,
      output: "Promise<{ narrative, privacyImpact, removalSummary, certaintyNote, evidence, removableCount }>",
      engine: "metadata"
    }),
    stripImageMetadata: Object.freeze({
      description: "Rebuild an image from visible pixels, remove metadata containers, and verify the cleaned result.",
      input: "Blob",
      options: "{ inspection?, verify? }",
      output: "Promise<{ blob, before, after, report }>",
      engine: "metadata"
    }),
    inspectPdf: Object.freeze({
      description: "Read a PDF page count without rendering its pages.",
      input: "Blob",
      options: null,
      output: "Promise<{ pageCount, byteLength }>",
      engine: "pdf"
    }),
    pdfToImages: Object.freeze({
      description: "Render selected PDF pages as ordered JPG, PNG, or WebP images.",
      input: "Blob",
      options: "{ pages?, format?, dpi?, quality?, onProgress?, signal? }",
      output: "Promise<{ pageCount, pages: [{ pageNumber, blob, width, height }] }>",
      engine: "pdf"
    }),
    imagesToPdf: Object.freeze({
      description: "Build a PDF from ordered images using shared image normalization.",
      input: "Blob[]",
      options: "{ pageSize?, fit?, marginMm?, quality?, maxImageDimension?, onProgress?, signal? }",
      output: "Promise<Blob>",
      engine: "pdf"
    }),
    mergePdfs: Object.freeze({
      description: "Merge ordered PDF files into one document without rasterizing their pages.",
      input: "Blob[]",
      options: "{ onProgress?, signal? }",
      output: "Promise<Blob>",
      engine: "pdf"
    }),
    splitPdf: Object.freeze({
      description: "Split a PDF into individual pages or custom page groups.",
      input: "Blob",
      options: "{ ranges?: number[][], onProgress?, signal? }",
      output: "Promise<{ pageCount, outputs: [{ pages, blob }] }>",
      engine: "pdf"
    }),
    createArchive: Object.freeze({
      description: "Bundle named Blob, ArrayBuffer, or Uint8Array entries into a ZIP archive.",
      input: "Array<{ filename: string, data: Blob|ArrayBuffer|Uint8Array }>",
      options: "{ onProgress? }",
      output: "Promise<Blob>",
      engine: "archive"
    }),
    loadFFmpeg: Object.freeze({
      description: "Load the shared browser media engine and compatibility router.",
      input: null,
      options: null,
      output: "Promise<void>",
      engine: "media"
    }),
    processFile: Object.freeze({
      description: "Run a high-level single-file media operation such as audio extraction or video-to-GIF.",
      input: "Blob",
      options: "{ op: string, ...operationOptions }",
      output: "Promise<Blob>",
      engine: "media"
    }),
    concatFiles: Object.freeze({
      description: "Join compatible audio or video files, using stream copy when safe and re-encoding otherwise.",
      input: "{ files: Blob[], kind: 'audio'|'video', onProgress?, onPhase? }",
      options: null,
      output: "Promise<{ blob: Blob, method: string }>",
      engine: "media"
    })
  });

  function loadEngine(name) {
    if (!engineLoads.has(name)) {
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const engineUrl = new URL(`tool-engines/${name}.js`, baseUrl);
        engineUrl.searchParams.set("v", engineVersion);
        script.src = engineUrl.href;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`The ${name} processing engine could not be loaded.`));
        document.head.appendChild(script);
      }).catch(error => {
        engineLoads.delete(name);
        throw error;
      });
      engineLoads.set(name, promise);
    }
    return engineLoads.get(name);
  }

  function lazyTool(name, engine) {
    const placeholder = async function (...args) {
      await loadEngine(engine);
      const implementation = Tools[name];
      if (implementation === placeholder) throw new Error(`${name} is unavailable in the ${engine} engine.`);
      return implementation(...args);
    };
    Tools[name] = placeholder;
  }

  // Page controllers need this synchronously when naming downloads. It requires
  // no decoding, so keeping it here does not load the image engine.
  Tools.imageFormatForFile = function (file) {
    const extension = file?.name?.split(".").pop()?.toLowerCase();
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(file?.type) ? file.type
      : file?.type ? "image/png"
      : ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[extension] || "image/png");
    return { mime, extension: mime === "image/jpeg" ? (extension === "jpeg" ? "jpeg" : "jpg") : mime.slice(6) };
  };

  lazyTool("imageDimensions", "images");
  lazyTool("resizeImage", "images");
  lazyTool("compressImage", "images");
  lazyTool("convertImage", "images");
  lazyTool("inspectImage", "images");
  lazyTool("decodeAnimation", "images");
  lazyTool("splitAnimation", "images");
  lazyTool("encodeAnimation", "images");
  lazyTool("imagesToAnimation", "images");
  lazyTool("photosToGif", "images");
  lazyTool("inspectImageMetadata", "metadata");
  lazyTool("explainImageMetadata", "metadata");
  lazyTool("stripImageMetadata", "metadata");
  lazyTool("inspectPdf", "pdf");
  lazyTool("pdfToImages", "pdf");
  lazyTool("imagesToPdf", "pdf");
  lazyTool("mergePdfs", "pdf");
  lazyTool("splitPdf", "pdf");
  lazyTool("createArchive", "archive");

  // Existing media pages use globals. Preserve that contract while preventing
  // the media engine from loading on image and utility pages.
  function lazyGlobal(name) {
    const placeholder = async function (...args) {
      await loadEngine("media");
      const implementation = window[name];
      if (implementation === placeholder) throw new Error(`${name} is unavailable in the media engine.`);
      return implementation(...args);
    };
    Tools[name] = placeholder;
    window[name] = placeholder;
  }
  lazyGlobal("loadFFmpeg");
  lazyGlobal("processFile");
  lazyGlobal("concatFiles");

  Tools.catalog = catalog;
  Tools.describe = name => catalog[name] || null;
  Tools.list = () => Object.keys(catalog);
  window.Tools = Tools;
})();
