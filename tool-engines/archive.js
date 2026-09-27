/* Private archive engine. Public contracts and lazy loading live in tools-api.js. */
(function () {
  "use strict";
  const Tools = window.Tools || {};
  let libraryLoad;

  function loadZipLibrary() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!libraryLoad) libraryLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
      script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error("The ZIP library did not start."));
      script.onerror = () => reject(new Error("The ZIP library could not be loaded."));
      document.head.appendChild(script);
    }).catch(error => { libraryLoad = null; throw error; });
    return libraryLoad;
  }

  Tools.createArchive = async function (entries, { onProgress } = {}) {
    const files = Array.from(entries || []);
    if (!files.length) throw new TypeError("Choose at least one file for the archive.");
    const names = new Set();
    for (const entry of files) {
      if (!entry || typeof entry.filename !== "string" || !entry.filename.trim()) {
        throw new TypeError("Every archive entry needs a filename.");
      }
      if (names.has(entry.filename)) throw new Error(`Duplicate archive filename: ${entry.filename}`);
      names.add(entry.filename);
      if (!(entry.data instanceof Blob) && !(entry.data instanceof ArrayBuffer) && !ArrayBuffer.isView(entry.data)) {
        throw new TypeError(`Unsupported archive data for ${entry.filename}.`);
      }
    }
    const JSZip = await loadZipLibrary();
    const zip = new JSZip();
    files.forEach(entry => zip.file(entry.filename, entry.data));
    return zip.generateAsync({ type: "blob" }, metadata => onProgress?.(metadata.percent / 100));
  };

  window.Tools = Tools;
})();
