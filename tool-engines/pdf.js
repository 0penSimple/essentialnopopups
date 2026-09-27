/* Private PDF engine. Public contracts are declared in tools-api.js. */
(function () {
  "use strict";
  const Tools = window.Tools = window.Tools || {};
  const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const PDFLIB_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  const libraryLoads = new Map();

  function loadScript(url, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!libraryLoads.has(url)) {
      libraryLoads.set(url, new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => window[globalName] ? resolve(window[globalName])
          : reject(new Error(`${globalName} did not initialize.`));
        script.onerror = () => reject(new Error(`Could not load the PDF processing library.`));
        document.head.appendChild(script);
      }).catch(error => { libraryLoads.delete(url); throw error; }));
    }
    return libraryLoads.get(url);
  }

  async function loadPdfJs() {
    const pdfjs = await loadScript(PDFJS_URL, "pdfjsLib");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return pdfjs;
  }

  function canvasBlob(canvas, type, quality) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
    return new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error(`The browser could not export ${type}.`)), type, quality));
  }

  function checkAbort(signal) {
    if (signal?.aborted) throw new DOMException("The operation was cancelled.", "AbortError");
  }

  async function openPdf(file) {
    if (!(file instanceof Blob)) throw new TypeError("Expected a PDF Blob or File.");
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    try { return await pdfjs.getDocument({ data }).promise; }
    catch (error) { throw new Error(`Could not read this PDF: ${error.message || error}`); }
  }

  Tools.inspectPdf = async function (file) {
    const document = await openPdf(file);
    try { return { pageCount: document.numPages, byteLength: file.size }; }
    finally { await document.destroy?.(); }
  };

  Tools.pdfToImages = async function (file, {
    pages, format = "image/jpeg", dpi = 150, quality = 0.92, onProgress, signal
  } = {}) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(format)) {
      throw new TypeError("PDF pages can be exported as JPG, PNG, or WebP.");
    }
    if (!Number.isFinite(dpi) || dpi < 24 || dpi > 600) throw new RangeError("DPI must be between 24 and 600.");
    const document = await openPdf(file);
    try {
      const selected = pages == null ? Array.from({ length: document.numPages }, (_, index) => index + 1)
        : [...new Set(Array.from(pages, Number))].sort((a, b) => a - b);
      if (!selected.length || selected.some(page => !Number.isInteger(page) || page < 1 || page > document.numPages)) {
        throw new RangeError("Choose valid PDF page numbers.");
      }
      const output = [];
      for (let index = 0; index < selected.length; index++) {
        checkAbort(signal);
        const pageNumber = selected[index];
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: dpi / 72 });
        const canvas = documentRoot().createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d", { alpha: format === "image/png" });
        if (!context) throw new Error("The browser could not create an image canvas.");
        if (format !== "image/png") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); }
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await canvasBlob(canvas, format, format === "image/png" ? undefined : quality);
        output.push({ pageNumber, blob, width: canvas.width, height: canvas.height });
        page.cleanup?.();
        onProgress?.((index + 1) / selected.length, { pageNumber, completed: index + 1, total: selected.length });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return { pageCount: document.numPages, pages: output };
    } finally { await document.destroy?.(); }
  };

  function documentRoot() { return window.document; }
  const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

  Tools.imagesToPdf = async function (files, {
    pageSize = "a4", fit = "fill", marginMm = 20, quality = 0.92,
    maxImageDimension = 2400, onProgress, signal
  } = {}) {
    const images = Array.from(files || []);
    if (!images.length || images.some(file => !(file instanceof Blob))) throw new TypeError("Choose at least one image.");
    if (!["a4", "letter", "auto"].includes(pageSize)) throw new TypeError("Unknown PDF page size.");
    if (!["fill", "fit"].includes(fit)) throw new TypeError("Image fit must be fill or fit.");
    if (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 100) throw new RangeError("Margin must be between 0 and 100 mm.");
    const PDFLib = await loadScript(PDFLIB_URL, "PDFLib");
    const pdf = await PDFLib.PDFDocument.create();
    const margin = marginMm * 2.834645669;
    for (let index = 0; index < images.length; index++) {
      checkAbort(signal);
      const file = images[index];
      const dimensions = await Tools.imageDimensions(file);
      let width = dimensions.width, height = dimensions.height;
      let normalized;
      if (Math.max(width, height) > maxImageDimension) {
        const scale = maxImageDimension / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
        normalized = await Tools.resizeImage(file, { width, height, format: "image/jpeg", quality });
      } else normalized = await Tools.convertImage(file, { format: "image/jpeg", quality });
      const embedded = await pdf.embedJpg(await normalized.arrayBuffer());
      const [pageWidth, pageHeight] = pageSize === "auto" ? [embedded.width, embedded.height] : PAGE_SIZES[pageSize];
      const page = pdf.addPage([pageWidth, pageHeight]);
      const availableWidth = Math.max(1, pageWidth - (fit === "fit" ? margin * 2 : 0));
      const availableHeight = Math.max(1, pageHeight - (fit === "fit" ? margin * 2 : 0));
      const scale = fit === "fill" ? Math.max(availableWidth / embedded.width, availableHeight / embedded.height)
        : Math.min(availableWidth / embedded.width, availableHeight / embedded.height);
      const drawWidth = embedded.width * scale, drawHeight = embedded.height * scale;
      page.drawImage(embedded, { x: (pageWidth - drawWidth) / 2, y: (pageHeight - drawHeight) / 2,
        width: drawWidth, height: drawHeight });
      onProgress?.((index + 1) / images.length, { completed: index + 1, total: images.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    checkAbort(signal);
    return new Blob([await pdf.save()], { type: "application/pdf" });
  };

  Tools.mergePdfs = async function (files, { onProgress, signal } = {}) {
    const inputs = Array.from(files || []);
    if (inputs.length < 2 || inputs.some(file => !(file instanceof Blob))) {
      throw new TypeError("Choose at least two PDF files.");
    }
    const PDFLib = await loadScript(PDFLIB_URL, "PDFLib");
    const output = await PDFLib.PDFDocument.create();
    for (let index = 0; index < inputs.length; index++) {
      checkAbort(signal);
      let source;
      try { source = await PDFLib.PDFDocument.load(await inputs[index].arrayBuffer()); }
      catch (error) { throw new Error(`Could not read PDF ${index + 1}: ${error.message || error}`); }
      const pages = await output.copyPages(source, source.getPageIndices());
      pages.forEach(page => output.addPage(page));
      onProgress?.((index + 1) / inputs.length, { completed: index + 1, total: inputs.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    checkAbort(signal);
    return new Blob([await output.save()], { type: "application/pdf" });
  };

  Tools.splitPdf = async function (file, { ranges, onProgress, signal } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("Choose a PDF file.");
    const PDFLib = await loadScript(PDFLIB_URL, "PDFLib");
    let source;
    try { source = await PDFLib.PDFDocument.load(await file.arrayBuffer()); }
    catch (error) { throw new Error(`Could not read this PDF: ${error.message || error}`); }
    const pageCount = source.getPageCount();
    const groups = ranges == null ? Array.from({ length: pageCount }, (_, index) => [index + 1])
      : Array.from(ranges, range => Array.from(range, Number));
    if (!groups.length || groups.some(group => !group.length || group.some(page =>
      !Number.isInteger(page) || page < 1 || page > pageCount))) {
      throw new RangeError(`Choose valid page groups between 1 and ${pageCount}.`);
    }
    const outputs = [];
    for (let index = 0; index < groups.length; index++) {
      checkAbort(signal);
      const pdf = await PDFLib.PDFDocument.create();
      const pages = await pdf.copyPages(source, groups[index].map(page => page - 1));
      pages.forEach(page => pdf.addPage(page));
      outputs.push({ pages: groups[index], blob: new Blob([await pdf.save()], { type: "application/pdf" }) });
      onProgress?.((index + 1) / groups.length, { completed: index + 1, total: groups.length, pages: groups[index] });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { pageCount, outputs };
  };
})();
