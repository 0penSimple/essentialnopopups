/* Tool page UI: shared shell, uploads, batch progress, previews, and downloads.
   Each tool keeps an indexable URL and passes page details to a renderer. */
(function () {
  function renderToolPage(config) {
    const mount = document.getElementById(config.mountId || "tool-page");
    if (!mount) throw new Error("Tool page mount was not found");
    const category = config.category || "Tools";
    const title = config.title || "Tool";
    const description = config.description || "";
    const input = config.input || {};
    const inputHtml = input.html || (input.type === "file" ? `
      <label for="${input.id || "fileInput"}">${input.label || "Choose a file"}</label>
      <div class="drop-zone" id="${input.zoneId || "dropZone"}">
        <input type="file" id="${input.id || "fileInput"}" accept="${input.accept || ""}">
        <div class="drop-icon" aria-hidden="true">${input.icon || "↥"}</div>
        <div class="drop-text"><strong>Choose a file</strong> or drag it here</div>
        <div class="drop-sub" id="dropSub">${input.hint || ""}</div>
      </div>` : "");
    const tips = (config.goodToKnow || []).map(tip => `<li>${tip}</li>`).join("");
    mount.innerHTML = `
      <div class="page-header">
        <div class="breadcrumb"><a href="../index.html">Home</a><span>›</span><span>${category}</span><span>›</span><span>${title}</span></div>
        <div class="tool-page-kicker">${category} / EssentialBits</div>
        <h1>${title}</h1>
        <p class="tool-page-description">${description}</p>
      </div>
      <div id="notification" class="notification" role="status" aria-live="polite"></div>
      <div class="card tool-workspace">
        ${inputHtml ? `<div class="tool-input" data-tool-section="input">${inputHtml}</div>` : ""}
        ${config.workspaceHtml || ""}
        ${config.advancedHtml ? `<section class="tool-advanced" data-tool-section="advanced" aria-label="Advanced options"><div class="tool-section-heading">Advanced options</div>${config.advancedHtml}</section>` : ""}
        ${config.resultHtml || ""}
      </div>
      ${config.privacyNote ? `<aside class="tool-privacy" data-tool-section="privacy">
        <div class="tool-privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 20 6v5.7c0 5.2-3.2 8.5-8 10-4.8-1.5-8-4.8-8-10V6l8-3.5Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg></div>
        <div class="tool-privacy-content">
          <div class="tool-privacy-kicker">Privacy by design</div>
          <h2>${config.privacyTitle || "Your files stay yours."}</h2>
          <p>${config.privacyNote}</p>
          ${config.privacyPoints?.length ? `<div class="tool-privacy-points">${config.privacyPoints.map(point => `<span>${point}</span>`).join("")}</div>` : ""}
        </div>
      </aside>` : ""}
      ${tips ? `<section class="info-card" data-tool-section="good-to-know"><h2>Good to know</h2><ul class="info-list">${tips}</ul></section>` : ""}`;
  }

  function scrollToToolSection(name, { offset = 16, behavior } = {}) {
    const section = Array.from(document.querySelectorAll("[data-tool-section]"))
      .find(element => element.dataset.toolSection === name);
    if (!section || section.hidden || !section.getClientRects().length) return false;
    const navHeight = document.getElementById("shared-nav")?.getBoundingClientRect().height || 0;
    const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - navHeight - offset);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: behavior || (reducedMotion ? "auto" : "smooth") });
    return true;
  }

  window.renderToolPage = renderToolPage;
  window.scrollToToolSection = scrollToToolSection;
})();

/* ── INFO BUTTON TOGGLE ── */

function toggleInfo() {
  const panel = document.getElementById("infoPanel");
  const btn   = document.getElementById("infoBtn");
  if (!panel || !btn) return;
  const open = panel.style.display === "none";
  panel.style.display   = open ? "block" : "none";
  btn.style.background  = open ? "var(--teal-light)" : "var(--teal)";
  btn.style.borderColor = open ? "var(--teal-border)" : "var(--teal)";
  btn.style.color       = open ? "var(--teal)" : "#fff";
}


/* ── SHARED INFO PANEL HTML ──
   Call buildInfoPanel() to get the standard ? panel HTML.
   Pass a custom second row text if needed, otherwise uses the default ad-blocker message.
*/

function buildInfoPanel() {
  return `
    <div id="infoPanel" class="info-panel">
      <div class="info-panel-row">
        <div class="info-panel-icon">💡</div>
        <div>
          <div class="info-panel-title">Not sure what to do?</div>
          <div class="info-panel-text">Check the <strong>Good to know</strong> section at the bottom of this page — it has tips that might help.</div>
        </div>
      </div>
      <div class="info-panel-row">
        <div class="info-panel-icon">🙏</div>
        <div>
          <div class="info-panel-title">This site survives thanks to you</div>
          <div class="info-panel-text">If a tool here saved you time or a headache, a small tip helps keep everything free and pop-up-free for everyone.</div>
          <a href="https://ko-fi.com/F2A425T678" target="_blank" rel="noopener" class="kofi-btn kofi-btn-sm kofi-btn-outline"><span class="kofi-cup">☕</span> Support on Ko-fi</a>
        </div>
      </div>
    </div>
  `;
}


/* ── NOTIFICATION HELPER ── */

function showNotification(msg, type = "info") {
  const el = document.getElementById("notification");
  if (!el) return;
  el.textContent = msg;
  el.className = `notification show ${type}`;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearNotification() {
  const el = document.getElementById("notification");
  if (el) el.className = "notification";
}


/* ── BUTTON STATE HELPERS ── */

// Set a button to loading state
function btnLoading(id, label = "Loading...") {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
  btn.className = btn.className.replace(" btn-done", "");
}

// Set a button to done state, then reset after delay
function btnDone(id, doneLabel = "✓ Done! 1/1", resetLabel = null, resetMs = 3000) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = doneLabel;
  btn.classList.add("btn-done");
  // Scroll button into view so user sees the result
  btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
  // After download dialog clears, scroll to Good to Know
  setTimeout(() => {
    const infoCard = document.querySelector(".info-card");
    if (infoCard) infoCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 2000);
  // Refresh ads on every completed action
  refreshAds();
  if (resetLabel) {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = resetLabel;
      btn.classList.remove("btn-done");
    }, resetMs);
  }
}

// Reset a button to its idle state
function btnReset(id, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label;
  btn.classList.remove("btn-done");
  // Remove any re-download handler so old clicks don't fire
  if (btn._redownloadHandler) {
    btn.removeEventListener("click", btn._redownloadHandler);
    btn._redownloadHandler = null;
  }
}

// Trigger a file download — uses Web Share API on iOS, anchor click everywhere else
async function triggerDownload(url, filename) {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS && navigator.share) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({ files: [file], title: filename });
    } catch(e) {
      // User cancelled share or share failed — open in new tab as fallback
      window.open(url, "_blank");
    }
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }
}


/* ── FORMAT BYTES UTILITY ── */

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}


/* ── BATCH PROCESSOR ──
   Reusable batch processing engine for all tools.

   Usage:
     const batch = new BatchProcessor({
       items:       array of anything (files, {file, options}, etc.)
       processOne:  async (item, index) => { return { filename, data } }
                    — return null to skip an item
                    — data can be Uint8Array, Blob, or ArrayBuffer
       btnId:       id of the action button
       btnLabel:    base label e.g. "Convert"  → shows "Convert — 0/3"
       zipName:     filename for the output ZIP (e.g. "converted.zip")
                    if only one item, downloads directly without ZIP
       onComplete:  optional callback after all done
     });
     await batch.run();

   The processor handles:
   - Disabling/re-enabling the button
   - Live 0/N counter on the button
   - Progress bar (looks for #progressSection, #progressFill, #progressPct, #progressLabel)
   - ZIP bundling through Tools.createArchive()
   - Error collection and notification
   - Direct download for single-file results
*/

class BatchProcessor {
  constructor({ items, processOne, btnId, btnLabel, zipName, onComplete }) {
    this.items      = items;
    this.processOne = processOne;
    this.btnId      = btnId;
    this.btnLabel   = btnLabel;
    this.zipName    = zipName || "results.zip";
    this.onComplete = onComplete || null;
  }

  _setBtn(label, disabled = true) {
    const btn = document.getElementById(this.btnId);
    if (!btn) return;
    btn.disabled  = disabled;
    btn.textContent = label;
    btn.classList.remove("btn-done");
  }

  _setProgress(current, total, label, done = false) {
    const fill  = document.getElementById("progressFill");
    const pct   = document.getElementById("progressPct");
    const lbl   = document.getElementById("progressLabel");
    const sec   = document.getElementById("progressSection");
    if (sec) sec.classList.add("show");
    if (lbl) lbl.textContent = label;
    if (done) {
      // Real percentage — remove indeterminate, show actual value
      const p = Math.round((current / total) * 100);
      if (fill) { fill.classList.remove("indeterminate"); fill.style.width = p + "%"; }
      if (pct)  pct.textContent = p + "%";
    } else {
      // Working — show sliding animation, hide percentage
      if (fill) { fill.classList.add("indeterminate"); fill.style.width = "35%"; }
      if (pct)  pct.textContent = "";
    }
  }

  _startMessages() {
    const lbl = document.getElementById("progressLabel");
    if (!lbl) return;
    const msgs = [
      "Loading your file…",
      "Your browser is on it…",
      "Processing…",
      "Working hard…",
      "Crunching the data…",
      "Bear with us…",
      "Almost there…",
    ];
    let i = 0;
    lbl.textContent = msgs[0];
    this._msgInterval = setInterval(() => {
      i++;
      if (i < msgs.length) {
        lbl.textContent = msgs[i];
      } else {
        // Reached last message — stop cycling, just leave it
        clearInterval(this._msgInterval);
        this._msgInterval = null;
      }
    }, 5000);
  }

  _stopMessages(finalLabel) {
    if (this._msgInterval) {
      clearInterval(this._msgInterval);
      this._msgInterval = null;
    }
    const lbl = document.getElementById("progressLabel");
    if (lbl) lbl.textContent = finalLabel;
  }

  async run() {
    const total   = this.items.length;
    const errors  = [];
    const results = []; // { filename, data }

    this._setBtn(`${this.btnLabel} — 0/${total}`);

    // Show progress section and start cycling messages
    const sec = document.getElementById("progressSection");
    if (sec) sec.classList.add("show");
    const fill = document.getElementById("progressFill");
    const pct  = document.getElementById("progressPct");
    if (fill) { fill.classList.add("indeterminate"); fill.style.width = "35%"; }
    if (pct)  pct.textContent = "";
    this._startMessages();

    for (let i = 0; i < total; i++) {
      this._setBtn(`${this.btnLabel} — ${i}/${total}`);

      try {
        const result = await this.processOne(this.items[i], i);
        if (result) results.push(result);
      } catch(e) {
        errors.push(`${e.message}`);
      }

      // Yield to browser so UI updates
      await new Promise(r => setTimeout(r, 0));
    }

    this._stopMessages(results.length > 0 ? "Done!" : "Failed");
    // Snap bar to 100% (or 0% on full failure)
    if (fill) { fill.classList.remove("indeterminate"); fill.style.width = results.length > 0 ? "100%" : "0%"; }
    if (pct)  pct.textContent = results.length > 0 ? "100%" : "";

    if (results.length === 0) {
      // All items failed — show clear error, never say "Done"
      const msg = errors.length > 0
        ? errors.join(" | ")
        : "Nothing was processed successfully.";
      showNotification(msg, "error");
      btnReset(this.btnId, `${this.btnLabel} — 0/${total}`);
      // Scroll to notification so user sees the error
      const notif = document.getElementById("notification");
      if (notif) notif.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Download results
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (results.length === 1) {
      const { filename, data } = results[0];
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url  = URL.createObjectURL(blob);
      if (window._lastDownload) URL.revokeObjectURL(window._lastDownload.url);
      window._lastDownload = { url, filename };
      // On iOS, skip auto-trigger — Web Share API requires a direct user tap.
      // The done button below will handle it when tapped.
      if (!isIOS) await triggerDownload(url, filename);
    } else {
      const zipBlob = await Tools.createArchive(results);
      const url = URL.createObjectURL(zipBlob);
      if (window._lastDownload) URL.revokeObjectURL(window._lastDownload.url);
      window._lastDownload = { url, filename: this.zipName };
      if (!isIOS) await triggerDownload(url, this.zipName);
    }

    // Show partial errors if some succeeded
    if (errors.length > 0) {
      showNotification(`Completed with ${errors.length} error(s): ${errors.join(" | ")}`, "error");
    }

    // Update button to done state — stays until new files are loaded
    const btn = document.getElementById(this.btnId);
    if (btn) {
      btn.disabled    = false;
      btn.textContent = isIOS
        ? `✓ Done! — tap to save`
        : `✓ Done! ${results.length}/${total} — click to re-download`;
      btn.classList.add("btn-done");
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      refreshAds();
      // Clicking the done button re-triggers the download
      btn._redownloadHandler = async () => {
        if (window._lastDownload) {
          await triggerDownload(window._lastDownload.url, window._lastDownload.filename);
        }
      };
      btn.addEventListener("click", btn._redownloadHandler);
    }

    if (this.onComplete) this.onComplete(results);
  }
}


/* ── MAKE DRAGGABLE ──
   Adds drag-to-reorder behaviour to a container of child elements.
   Each child must have a data-index attribute set to its position.

   Usage:
     makeDraggable(containerEl, items, (reorderedItems) => {
       state.files = reorderedItems;
       render();
     });

   Call again after every render() to re-attach events to new DOM nodes.
   Pass the same items array each time — it is not mutated.
*/
function makeDraggable(containerEl, items, onReorder) {
  if (!containerEl) return;

  let dragSrcIndex = null;

  Array.from(containerEl.children).forEach((child, i) => {
    child.draggable = true;

    child.addEventListener("dragstart", () => {
      dragSrcIndex = i;
      setTimeout(() => child.classList.add("dragging"), 0);
    });

    child.addEventListener("dragend", () => {
      child.classList.remove("dragging");
    });

    child.addEventListener("dragover", e => {
      e.preventDefault();
      child.classList.add("drag-over");
    });

    child.addEventListener("dragleave", () => {
      child.classList.remove("drag-over");
    });

    child.addEventListener("drop", e => {
      e.preventDefault();
      child.classList.remove("drag-over");
      if (dragSrcIndex === null || dragSrcIndex === i) return;

      // Reorder a shallow copy of items
      const reordered = [...items];
      const [moved] = reordered.splice(dragSrcIndex, 1);
      reordered.splice(i, 0, moved);
      dragSrcIndex = null;

      onReorder(reordered);
    });
  });
}


/* ── AD REFRESH ──
   Refreshes all ad slots on the page after a user action completes.
   Called automatically from btnDone and BatchProcessor.
   Works with Google AdSense — replace with your network's refresh API if different.
*/
function refreshAds() {
  try {
    const adSlots = document.querySelectorAll(".adsbygoogle");
    adSlots.forEach(slot => {
      // Only refresh slots that have already been filled
      if (slot.dataset.adsbygoogleStatus === "done") {
        const parent = slot.parentNode;
        const clone  = slot.cloneNode(false);
        parent.replaceChild(clone, slot);
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    });
  } catch(e) {
    // Silently fail — ads are non-critical
  }
}


/* ── MAKE DROP ZONE ──
   Wires up a drop zone element for drag-and-drop and file input.

   Options:
     accept      {string}   MIME type prefix to filter, e.g. "image/" or "application/pdf"
     multiple    {boolean}  Allow multiple files (default: false)
     maxFree     {number}   Max files for free tier. If IS_PREMIUM is false and more
                            files are dropped, extras are silently trimmed and a
                            notification is shown. Pass Infinity to disable limit.
     onFiles     {function} Called with filtered File array when files are chosen.
                            Always called — even for single files.

   Usage:
     makeDropZone(document.getElementById("dropZone"), {
       accept:  "image/",
       multiple: true,
       maxFree:  1,
       onFiles: (files) => handleFiles(files)
     });
*/
function makeDropZone(zoneEl, { accept = "", multiple = false, maxFree = Infinity, onFiles }) {
  if (!zoneEl || !onFiles) return;

  function filterFiles(fileList) {
    let files = Array.from(fileList);

    // Filter by type. `accept` can be a MIME prefix like "video/" or "image/png".
    // We keep a file if its MIME type matches OR (as a fallback for files that
    // report a blank/odd type) its extension looks right. Some video files —
    // especially .mkv and certain .mov — report an empty type in some browsers,
    // so the extension fallback is important.
    if (accept) {
      const category = accept.split("/")[0]; // e.g. "video" from "video/"
      files = files.filter(f =>
        (f.type && f.type.startsWith(accept)) ||
        (category && f.type && f.type.startsWith(category + "/")) ||
        (f.type === "" ) // let blank-type files through; the tool re-checks by extension
      );
    }

    // Apply free tier limit
    if (!IS_PREMIUM && maxFree !== Infinity && files.length > maxFree) {
      const trimmed = files.length - maxFree;
      files = files.slice(0, maxFree);
      if (trimmed > 0) {
        showNotification(
          `This tool processes ${maxFree} file${maxFree !== 1 ? "s" : ""} at a time. ${trimmed} extra file${trimmed !== 1 ? "s were" : " was"} skipped.`,
          "info"
        );
      }
    }

    return files;
  }

  // Drag and drop
  zoneEl.addEventListener("dragover", e => {
    e.preventDefault();
    zoneEl.classList.add("dragover");
  });

  zoneEl.addEventListener("dragleave", () => {
    zoneEl.classList.remove("dragover");
  });

  zoneEl.addEventListener("drop", e => {
    e.preventDefault();
    zoneEl.classList.remove("dragover");
    const files = filterFiles(e.dataTransfer.files);
    if (files.length) {
      clearLastDownload();
      onFiles(files);
    }
  });

  // File input inside the drop zone
  const input = zoneEl.querySelector("input[type='file']");
  if (input) {
    input.multiple = multiple;
    input.addEventListener("change", () => {
      const files = filterFiles(input.files);
      if (files.length) {
        clearLastDownload();
        onFiles(files);
      }
      input.value = ""; // reset so same file can be re-selected
    });
  }
}

// Clear stored download URL and reset any done button back to idle
function clearLastDownload() {
  if (window._lastDownload) {
    URL.revokeObjectURL(window._lastDownload.url);
    window._lastDownload = null;
  }
  // Reset all btn-done buttons on the page
  document.querySelectorAll(".btn-done").forEach(btn => {
    if (btn._redownloadHandler) {
      btn.removeEventListener("click", btn._redownloadHandler);
      btn._redownloadHandler = null;
    }
    btn.classList.remove("btn-done");
    btn.disabled = false;
  });
}


/* ── FLOATING "GOOD TO KNOW" HINT ──
   Appears after 4 seconds on tool pages, fades out when user
   scrolls near the Good to Know section. Auto-injected — no
   tool page changes needed.
*/
(function () {
  if (!window.location.pathname.toLowerCase().includes("/tools/")) return;

  function initPill() {
    const infoCard = document.querySelector(".info-card");
    if (!infoCard) return;

    const pill = document.createElement("div");
    pill.id = "gtkPill";
    pill.textContent = "Good to know ↓";
    pill.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 20px;
      background: var(--teal);
      color: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 7px 14px;
      border-radius: 99px;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transition: opacity 0.4s ease;
      z-index: 200;
      user-select: none;
      pointer-events: none;
    `;

    pill.addEventListener("click", () => {
      infoCard.scrollIntoView({ behavior: "smooth", block: "start" });
      fadePill(false);
    });

    document.body.appendChild(pill);

    function fadePill(show) {
      pill.style.opacity = show ? "1" : "0";
      pill.style.pointerEvents = show ? "auto" : "none";
    }

    const showTimer = setTimeout(() => fadePill(true), 4000);

    window.addEventListener("scroll", () => {
      const rect = infoCard.getBoundingClientRect();
      if (rect.top < window.innerHeight + 300) {
        clearTimeout(showTimer);
        fadePill(false);
      }
    }, { passive: true });
  }

  // Run immediately if DOM is ready, otherwise wait
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPill);
  } else {
    initPill();
  }
})();

/* Shared media preview for single-input comparisons and multi-input results. */
(function () {
  function createMediaPreview({ mountId = "mediaPreviewMount", mode = "comparison", outputLabel = "Result",
    downloadFilename = "result", downloadLabel } = {}) {
    const mount = document.getElementById(mountId);
    if (!mount) throw new Error("Media preview mount was not found.");
    mount.innerHTML = mode === "comparison" ? `<section class="preview-section" id="previewSection" data-tool-section="preview">
      <label style="margin-bottom:10px">Preview</label><div class="preview-grid">
        <div class="preview-box"><div class="preview-label">Original <span data-preview="input-size">—</span></div>
          <div class="preview-img-wrap"><img data-preview="input" alt="Original"></div></div>
        <div class="preview-box"><div class="preview-label">${outputLabel}
          <span class="preview-size-wrap"><span data-preview="output-size">—</span><span data-preview="delta" class="size-delta"></span></span></div>
          <div class="preview-img-wrap"><img data-preview="output" alt="${outputLabel}"></div></div>
      </div></section>` : `<section class="preview-section media-result-preview" id="previewSection" data-tool-section="preview">
        <div class="tool-section-heading">Preview</div>
        <div class="preview-box media-result-box"><div class="preview-label">${outputLabel}<span data-preview="output-size">—</span></div>
          <div class="preview-img-wrap"><img data-preview="output" alt="${outputLabel}"></div></div>
        <div class="media-preview-meta" data-preview="meta"></div>
        ${downloadLabel ? `<button class="btn-primary media-preview-download" data-preview="download" type="button">${downloadLabel}</button>` : ""}
      </section>`;
    const section = mount.querySelector(".preview-section");
    const part = name => mount.querySelector(`[data-preview="${name}"]`);
    let inputUrl, outputUrl, outputBlob, filename = downloadFilename;

    function clear() {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      inputUrl = outputUrl = null;
      outputBlob = null;
      section.classList.remove("show");
      part("input")?.removeAttribute("src");
      part("output").removeAttribute("src");
    }
    function show({ input, output, meta = "", filename: nextFilename }) {
      clear();
      outputUrl = URL.createObjectURL(output);
      outputBlob = output;
      filename = nextFilename || filename;
      part("output").src = outputUrl;
      part("output-size").textContent = formatBytes(output.size);
      if (input) {
        inputUrl = URL.createObjectURL(input);
        part("input").src = inputUrl;
        part("input-size").textContent = formatBytes(input.size);
        const change = output.size - input.size;
        const tone = change > 0 ? "size-larger" : change < 0 ? "size-smaller" : "size-same";
        part("output-size").className = tone;
        part("delta").className = `size-delta ${tone}`;
        const percent = input.size ? Math.abs(change) / input.size * 100 : 0;
        const rounded = percent < 1 && change ? "<1" : String(Math.round(percent));
        part("delta").textContent = change === 0 ? "same size" : `${rounded}% ${change > 0 ? "larger" : "smaller"}`;
      } else if (part("meta")) part("meta").textContent = meta;
      section.classList.add("show");
    }
    async function download() {
      if (!outputBlob || !outputUrl) return false;
      await triggerDownload(outputUrl, filename);
      return true;
    }
    part("download")?.addEventListener("click", download);
    window.addEventListener("pagehide", clear);
    return { clear, show, download, getOutput: () => outputBlob };
  }

  window.createMediaPreview = createMediaPreview;
})();

/* Reusable UI controller for file-to-file tools. Processing stays in Tools APIs. */
(function () {
  function createFileConverterPage(config) {
    const formats = (config.formats || []).flatMap(group => group.options);
    const formatByMime = new Map(formats.map(format => [format.mime, format]));
    const controls = config.controls || [];
    const firstFormat = formats[0];
    if ((!firstFormat && !config.resolveFormat) || typeof config.convert !== "function") {
      throw new Error("A converter needs an output format and a conversion function.");
    }

    const workspaceHtml = `
      <div class="files-section" id="filesSection">
        <div class="files-header"><div class="files-count" id="filesCount">0 files</div>
          <div class="btn-add-more" id="addMoreBtn" hidden>
            <input type="file" id="addMoreInput" accept="${config.accept || ""}" multiple>+ Add more
          </div>
        </div>
        <div class="file-list" id="fileList"></div>
      </div>
      ${config.settingsPosition === "workspace" ? `<section class="converter-settings" data-tool-section="settings">${config.settingsHtml || ""}</section>` : ""}
      ${firstFormat ? `<div class="format-row" data-tool-section="format">
        <label for="formatSelect">${config.formatLabel || "Convert to"}</label>
        <div class="format-select-wrap"><select id="formatSelect">${config.formats.map(group => `
          <optgroup label="${group.label}">${group.options.map(format => `
            <option value="${format.mime}">${format.label}</option>`).join("")}</optgroup>`).join("")}</select></div>
        <div class="format-hint" id="formatHint"></div>
      </div>` : ""}`;

    const advancedHtml = `
      <div class="quality-row" id="qualityRow">
        <div class="quality-header"><label for="qualitySlider" style="margin:0">Quality</label>
          <div class="quality-value" id="qualityVal">92%</div></div>
        <input type="range" id="qualitySlider" min="10" max="100" step="1" value="92">
        <div class="slider-hints"><span>Smaller file</span><span>Better quality</span></div>
      </div>
      ${controls.map(control => `<div class="converter-option" id="option-${control.name}" hidden>
        <label for="control-${control.name}">${control.label}</label>
        <select id="control-${control.name}">${control.choices.map(choice =>
          `<option value="${choice.value}"${choice.selected ? " selected" : ""}>${choice.label}</option>`).join("")}</select>
        ${control.hint ? `<p>${control.hint}</p>` : ""}</div>`).join("")}
      ${config.settingsPosition === "workspace" ? "" : config.settingsHtml || ""}`;

    const resultHtml = `
      ${config.preview === "image" ? `<div id="mediaPreviewMount"></div>` : ""}
      <div class="progress-section" id="progressSection">
        <div class="progress-label"><span id="progressLabel">Converting...</span><span id="progressPct">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      </div>
      <button class="btn-primary" id="convBtn" disabled>${config.buttonVerb || "Convert"} &amp; download — 0/1</button>`;

    renderToolPage({
      ...config.page,
      input: { type: "file", ...config.input, accept: config.accept },
      workspaceHtml, advancedHtml, resultHtml
    });

    const $ = id => document.getElementById(id);
    const files = [];
    let previewVersion = 0;
    let fileVersion = 0;
    const preview = config.preview === "image"
      ? createMediaPreview({ mode: "comparison", outputLabel: config.previewLabel || "Converted" }) : null;

    function currentFormat() { return firstFormat ? formatByMime.get($("formatSelect").value) : null; }
    function outputOptions() {
      const format = currentFormat();
      const options = format ? { format: format.mime } : {};
      if (format?.quality) options.quality = Number($("qualitySlider").value) / 100;
      for (const control of controls) {
        const choice = control.choices.find(item => item.value === $(`control-${control.name}`).value);
        if (choice) options[control.name] = choice.output;
      }
      return { ...options, ...config.readOptions?.() };
    }
    function resetConversion() {
      clearLastDownload();
      $("convBtn").disabled = files.length === 0;
      $("convBtn").textContent = `${config.buttonVerb || "Convert"} & download — 0/${files.length || 1}`;
      $("progressSection").classList.remove("show");
    }
    function renderFiles() {
      const list = $("fileList");
      list.replaceChildren();
      files.forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.innerHTML = `<div class="file-icon">${config.input?.icon || "↥"}</div>
          <div class="file-info"><div class="file-name"></div><div class="file-meta"></div></div>
          <button class="file-remove" type="button" aria-label="Remove file">×</button>`;
        row.querySelector(".file-name").textContent = file.name;
        row.querySelector(".file-meta").textContent = formatBytes(file.size);
        row.querySelector(".file-remove").addEventListener("click", () => {
          files.splice(index, 1);
          renderFiles();
          notifyFilesChanged();
        });
        list.appendChild(row);
      });
      $("filesSection").classList.toggle("show", files.length > 0);
      $("filesCount").textContent = `${files.length} ${config.fileLabel || "file"}${files.length === 1 ? "" : "s"}`;
      const dropText = document.querySelector("#dropZone .drop-text");
      if (!files.length) dropText.innerHTML = `<strong>Click to choose</strong> or drag a file here`;
      else if (files.length === 1) dropText.textContent = files[0].name;
      else dropText.textContent = `${files.length} files loaded`;
      resetConversion();
    }
    function setFiles(newFiles, append = false) {
      const candidates = Array.from(newFiles);
      const accepted = candidates.filter(file => {
        const prefixAccepted = !config.acceptPrefix || file.type.startsWith(config.acceptPrefix) || !file.type;
        return prefixAccepted && (!config.acceptFile || config.acceptFile(file));
      });
      const rejected = candidates.filter(file => !accepted.includes(file));
      if (rejected.length) {
        showNotification(config.invalidFileMessage ||
          `${rejected.map(file => file.name).join(", ")} could not be added to this tool.`, "error");
      }
      if (!accepted.length) return;
      files.splice(append ? files.length : 0, append ? 0 : files.length, ...accepted);
      renderFiles();
      notifyFilesChanged();
      if (!append && files.length === 1 && config.scrollAfterUpload) {
        requestAnimationFrame(() => scrollToToolSection(config.scrollAfterUpload));
      }
    }
    async function notifyFilesChanged() {
      const version = ++fileVersion;
      ++previewVersion;
      if (config.preview === "image") {
        preview.clear();
      }
      try {
        await config.onFilesChanged?.(files.length === 1 ? files[0] : null, files.slice());
        if (version === fileVersion) updatePreview();
      } catch (error) {
        if (version === fileVersion) showNotification(error.message, "error");
      }
    }
    function updateOptions() {
      const format = currentFormat();
      if (format) $("formatHint").textContent = format.hint || "";
      $("qualityRow").classList.toggle("show", Boolean(format?.quality));
      for (const control of controls) {
        $(`option-${control.name}`).hidden = !control.formats.includes(format?.mime);
      }
      document.querySelector(".tool-advanced").hidden = !format?.quality &&
        !(config.settingsHtml && config.settingsPosition !== "workspace") &&
        !controls.some(control => control.formats.includes(format?.mime));
      config.onFormatChanged?.(format);
      resetConversion();
      updatePreview();
    }
    async function updatePreview() {
      const version = ++previewVersion;
      if (config.preview !== "image") return;
      preview.clear();
      if (files.length !== 1) return;
      const file = files[0];
      try {
        const options = outputOptions();
        if (config.previewReady && !config.previewReady(options, file)) return;
        const blob = await config.convert(file, options);
        if (version !== previewVersion) return;
        preview.show({ input: file, output: blob });
        config.onPreview?.({ file, blob, options });
      } catch (error) {
        if (version === previewVersion) showNotification(error.message, "error");
      }
    }
    async function convertFiles() {
      if (!files.length) return;
      const items = files.map(file => ({ file, name: file.name }));
      const options = outputOptions();
      const batch = new BatchProcessor({
        items, btnId: "convBtn", btnLabel: config.buttonVerb || "Convert", zipName: config.zipName || "converted_files.zip",
        processOne: async (item, index) => {
          $("progressLabel").textContent = `${config.progressVerb || "Converting"} ${index + 1}/${items.length}: ${item.name}`;
          const data = await config.convert(item.file, options);
          const format = config.resolveFormat?.(item.file, options) || currentFormat();
          const filename = config.filename
            ? await config.filename(item.file, options, format, data)
            : `${item.name.replace(/\.[^.]+$/, "")}.${format.extension}`;
          return { filename, data };
        },
        onComplete: () => { $("progressLabel").textContent = "Done!"; }
      });
      await batch.run();
    }

    if (firstFormat) $("formatSelect").addEventListener("change", updateOptions);
    $("qualitySlider").addEventListener("input", event => {
      $("qualityVal").textContent = `${event.target.value}%`;
      resetConversion();
      updatePreview();
    });
    for (const control of controls) {
      $(`control-${control.name}`).addEventListener("change", () => {
        resetConversion();
        updatePreview();
      });
    }
    config.setupSettings?.({
      getFile: () => files.length === 1 ? files[0] : null,
      refreshPreview: updatePreview,
      resetConversion,
      setFiles,
      outputOptions
    });
    $("convBtn").addEventListener("click", event => {
      if (!event.currentTarget.classList.contains("btn-done")) convertFiles();
    });
    makeDropZone($("dropZone"), {
      accept: config.acceptPrefix || "", multiple: Boolean(config.batchAllowed),
      maxFree: config.batchAllowed ? Infinity : 1,
      onFiles: selected => setFiles(selected)
    });
    if (config.batchAllowed) {
      $("addMoreBtn").hidden = false;
      $("dropSub").textContent = config.batchHint || "Drop multiple files at once";
      $("addMoreInput").addEventListener("change", event => {
        setFiles(event.target.files, true);
        event.target.value = "";
      });
    }
    updateOptions();
    return { setFiles, outputOptions };
  }

  window.createFileConverterPage = createFileConverterPage;
})();

/* Shared media pages. Format specific pages configure this layer; all processing
   is performed by the lazily loaded media engine behind Tools.*. */
(function () {
  const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpeg|mpg|3gp)$/i;
  const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|aac|ogg|oga|m4a|wma|opus|webm)$/i;
  const videoAccept = "video/*,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.m4v,.mpeg,.mpg,.3gp";
  const audioAccept = "audio/*,.mp3,.wav,.flac,.aac,.ogg,.oga,.m4a,.wma,.opus,.webm";
  const isVideoFile = file => file.type.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name);
  const isAudioFile = file => file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name);

  function mediaPrivacy(subject) {
    const verb = /\b(?:files|videos)$/.test(subject) ? "stay" : "stays";
    return {
      privacyTitle: `${subject} ${verb} on your device.`,
      privacyNote: "The file is processed inside your browser. It is never uploaded to EssentialBits or stored on a server.",
      privacyPoints: ["Local processing", "No server copy", "No account required"]
    };
  }

  function startExtractAudioPage() {
    createFileConverterPage({
      page: {
        title: "Extract audio from video",
        category: "Audio",
        description: "Pull the audio track from a video and save it as MP3 or WAV.",
        ...mediaPrivacy("Your video"),
        goodToKnow: [
          "MP3 creates a smaller file that works almost everywhere. WAV preserves uncompressed audio for editing.",
          "The selected bitrate applies to MP3 output. Higher bitrates retain more detail and create larger files.",
          "A video without an audio track cannot produce an audio file.",
          "The media engine loads when you start extraction and is cached by your browser."
        ]
      },
      input: { label: "Your video file", icon: "🎬", hint: "MP4, MOV, AVI, MKV, WebM and more" },
      accept: videoAccept,
      acceptPrefix: "video/",
      acceptFile: isVideoFile,
      invalidFileMessage: "Choose a video file to extract audio from.",
      batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple video files at once",
      formats: [{ label: "Audio formats", options: [
        { mime: "audio/mpeg", extension: "mp3", label: "MP3", hint: "Smaller and widely compatible." },
        { mime: "audio/wav", extension: "wav", label: "WAV", hint: "Uncompressed audio for editing." }
      ] }],
      controls: [{
        name: "bitrate", label: "MP3 bitrate", formats: ["audio/mpeg"],
        choices: [
          { value: "128", label: "128 kbps · smaller", output: 128 },
          { value: "192", label: "192 kbps · balanced", output: 192, selected: true },
          { value: "320", label: "320 kbps · highest quality", output: 320 }
        ],
        hint: "Higher bitrates preserve more audio detail and produce larger files."
      }],
      buttonVerb: "Extract",
      progressVerb: "Extracting",
      zipName: "extracted_audio.zip",
      scrollAfterUpload: "format",
      convert: (file, options) => Tools.extractAudio(file, {
        format: options.format,
        bitrate: options.bitrate || 192
      })
    });
  }

  function startRemoveAudioPage() {
    createFileConverterPage({
      page: {
        title: "Remove audio from video",
        category: "Video",
        description: "Remove every audio track while preserving the original video stream.",
        ...mediaPrivacy("Your video"),
        goodToKnow: [
          "The video stream is copied without re-encoding, so its visual quality does not change.",
          "All audio tracks are removed, including alternate languages and commentary tracks.",
          "Subtitles, chapters, and other compatible streams remain in the output container.",
          "A video that already has no audio can still be processed."
        ]
      },
      input: { label: "Your video file", icon: "🔇", hint: "MP4, MOV, AVI, MKV, WebM and more" },
      accept: videoAccept,
      acceptPrefix: "video/",
      acceptFile: isVideoFile,
      invalidFileMessage: "Choose a video file to remove audio from.",
      batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple video files at once",
      buttonVerb: "Remove audio",
      progressVerb: "Processing",
      zipName: "muted_videos.zip",
      scrollAfterUpload: "input",
      resolveFormat(file) {
        const extension = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || "mp4";
        return { extension };
      },
      filename(file, options, format) {
        return `${file.name.replace(/\.[^.]+$/, "")}_muted.${format.extension}`;
      },
      convert: file => Tools.removeAudio(file)
    });
  }

  function startAudioConverterPage() {
    createFileConverterPage({
      page: {
        title: "Audio converter",
        category: "Audio",
        description: "Convert audio to MP3 or WAV with the quality you need.",
        ...mediaPrivacy("Your audio"),
        goodToKnow: [
          "MP3 is compact and widely compatible. WAV is uncompressed and better suited to editing.",
          "Converting a lossy file to a higher bitrate cannot restore detail that was already removed.",
          "WebM files are accepted when they contain audio. Any video track is discarded.",
          "The selected MP3 bitrate controls the quality and output size."
        ]
      },
      input: { label: "Your audio file", icon: "🎵", hint: "MP3, WAV, FLAC, AAC, OGG, M4A, WebM and more" },
      accept: audioAccept,
      acceptFile: isAudioFile,
      invalidFileMessage: "Choose an audio file. Use Extract Audio when the source is a video.",
      batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple audio files at once",
      formats: [{ label: "Audio formats", options: [
        { mime: "audio/mpeg", extension: "mp3", label: "MP3", hint: "Smaller and compatible with nearly every player." },
        { mime: "audio/wav", extension: "wav", label: "WAV", hint: "Uncompressed PCM audio for editing and archiving." }
      ] }],
      controls: [{
        name: "bitrate", label: "MP3 bitrate", formats: ["audio/mpeg"],
        choices: [
          { value: "128", label: "128 kbps · smaller", output: 128 },
          { value: "192", label: "192 kbps · balanced", output: 192, selected: true },
          { value: "320", label: "320 kbps · highest quality", output: 320 }
        ],
        hint: "Higher bitrates retain more detail and create larger MP3 files."
      }],
      buttonVerb: "Convert",
      progressVerb: "Converting",
      zipName: "converted_audio.zip",
      scrollAfterUpload: "format",
      convert: (file, options) => Tools.convertMedia(file, {
        kind: "audio", format: options.format, bitrate: options.bitrate || 192
      })
    });
  }

  function startVideoConverterPage() {
    const videoFormats = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    createFileConverterPage({
      page: {
        title: "Video converter",
        category: "Video",
        description: "Convert videos to MP4, WebM, MOV, or AVI directly in your browser.",
        ...mediaPrivacy("Your video"),
        goodToKnow: [
          "MP4 offers the broadest compatibility. WebM is well suited to websites and modern browsers.",
          "MOV works well with Apple editing software. AVI is mainly useful for older applications.",
          "Video conversion re-encodes the picture, so larger or longer files can take several minutes.",
          "High quality keeps more visual detail and produces a larger file."
        ]
      },
      input: { label: "Your video file", icon: "🎬", hint: "MP4, MOV, AVI, MKV, WebM and more" },
      accept: videoAccept,
      acceptPrefix: "video/",
      acceptFile: isVideoFile,
      invalidFileMessage: "Choose a video file to convert.",
      batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple video files at once",
      formats: [{ label: "Video formats", options: [
        { mime: "video/mp4", extension: "mp4", label: "MP4", hint: "H.264 video for the widest device and platform support." },
        { mime: "video/webm", extension: "webm", label: "WebM", hint: "VP9 video designed for modern browsers and the web." },
        { mime: "video/quicktime", extension: "mov", label: "MOV", hint: "H.264 video in an Apple friendly container." },
        { mime: "video/x-msvideo", extension: "avi", label: "AVI", hint: "A legacy container for older Windows software." }
      ] }],
      controls: [{
        name: "quality", label: "Video quality", formats: videoFormats,
        choices: [
          { value: "high", label: "High quality · larger file", output: "high" },
          { value: "medium", label: "Balanced", output: "medium", selected: true },
          { value: "low", label: "Smaller file", output: "low" }
        ],
        hint: "Quality controls video compression. Audio is encoded at a compatible standard bitrate."
      }],
      buttonVerb: "Convert",
      progressVerb: "Converting",
      zipName: "converted_videos.zip",
      scrollAfterUpload: "format",
      convert: (file, options) => Tools.convertMedia(file, {
        kind: "video", format: options.format, quality: options.quality || "medium"
      })
    });
  }

  function formatTrimTime(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = (safe % 60).toFixed(2).padStart(5, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
  }

  function parseTrimTime(value) {
    const parts = String(value).trim().split(":");
    if (!parts.length || parts.length > 3 || parts.some(part => !/^\d+(?:\.\d+)?$/.test(part))) return null;
    const numbers = parts.map(Number);
    if (numbers.some(number => !Number.isFinite(number))) return null;
    if (numbers.length === 3) return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
    if (numbers.length === 2) return numbers[0] * 60 + numbers[1];
    return numbers[0];
  }

  function readMediaDuration(file, kind, url) {
    return new Promise((resolve, reject) => {
      const media = document.createElement(kind);
      const timer = setTimeout(() => finish(new Error("The file took too long to read.")), 15000);
      function finish(error, duration) {
        clearTimeout(timer);
        media.removeAttribute("src");
        media.load();
        error ? reject(error) : resolve(duration);
      }
      media.preload = "metadata";
      media.onloadedmetadata = () => {
        const duration = media.duration;
        if (!Number.isFinite(duration) || duration <= 0) finish(new Error("The browser could not read this file's duration."));
        else finish(null, duration);
      };
      media.onerror = () => finish(new Error(`The browser could not preview ${file.name}.`));
      media.src = url;
    });
  }

  function startTrimMediaPage(kind) {
    const isVideo = kind === "video";
    const title = isVideo ? "Trim video" : "Trim audio";
    const accept = isVideo ? videoAccept : audioAccept;
    const acceptFile = isVideo ? isVideoFile : isAudioFile;
    const icon = isVideo ? "🎬" : "🎵";
    const files = [];
    const $ = id => document.getElementById(id);

    renderToolPage({
      title,
      category: isVideo ? "Video" : "Audio",
      description: `Choose the exact part of ${isVideo ? "a video" : "an audio"} file you want to keep, preview it, and download the result.`,
      input: { type: "file", label: `Your ${kind} file`, icon: "✂", accept,
        hint: isVideo ? "MP4, MOV, AVI, MKV, WebM and more" : "MP3, WAV, FLAC, AAC, OGG, M4A and more" },
      workspaceHtml: `
        <section class="trim-files" id="trimFiles" data-tool-section="timeline" hidden></section>
        <div class="trim-add-more" id="trimAddMore" hidden><label class="btn-add-more">+ Add more files
          <input id="trimAddInput" type="file" accept="${accept}" multiple></label></div>`,
      resultHtml: `
        <section class="progress-section" id="progressSection" aria-live="polite"><div class="progress-label">
          <span id="progressLabel">Trimming…</span><span id="progressPct">0%</span></div>
          <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <button class="btn-primary" id="trimBtn" disabled>Trim &amp; download — 0/1</button>`,
      ...mediaPrivacy(isVideo ? "Your video" : "Your audio"),
      goodToKnow: [
        "Trimming copies the original media streams without re-encoding, preserving their existing quality.",
        isVideo ? "Video cuts occur near encoded keyframes, so the saved start can differ slightly from the selected time." : "Audio cuts follow encoded packet boundaries, so the saved edge can differ by a tiny fraction of a second.",
        "Use the sliders, enter a time such as 1:23.50, or set an edge from the preview's current position.",
        "Preview selection plays only the range currently selected on the timeline."
      ]
    });

    function minimumGap(item) { return Math.min(0.05, item.duration); }
    function resetOutput() {
      clearLastDownload();
      $("progressSection").classList.remove("show");
      $("trimBtn").classList.remove("btn-done");
      $("trimBtn").disabled = !files.length;
      $("trimBtn").textContent = `Trim & download — 0/${files.length || 1}`;
    }
    function updateItem(item, card) {
      const gap = minimumGap(item);
      item.start = Math.max(0, Math.min(item.start, item.end - gap));
      item.end = Math.min(item.duration, Math.max(item.end, item.start + gap));
      const startRange = card.querySelector('[data-trim="start-range"]');
      const endRange = card.querySelector('[data-trim="end-range"]');
      startRange.max = endRange.max = String(item.duration);
      startRange.value = String(item.start);
      endRange.value = String(item.end);
      card.querySelector('[data-trim="start-time"]').value = formatTrimTime(item.start);
      card.querySelector('[data-trim="end-time"]').value = formatTrimTime(item.end);
      card.querySelector('[data-trim="selection"]').textContent = formatTrimTime(item.end - item.start);
      resetOutput();
    }
    function render() {
      const list = $("trimFiles");
      list.replaceChildren();
      files.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "trim-file";
        card.innerHTML = `<div class="trim-file-header"><span class="trim-file-icon" aria-hidden="true">${icon}</span>
          <div class="trim-file-info"><div class="trim-file-name"></div><div class="trim-file-meta"></div></div>
          <button class="trim-file-remove" type="button" aria-label="Remove file">×</button></div>
          <div data-trim="preview"></div>
          <div class="trim-range-row"><label>Start</label><input data-trim="start-range" type="range" min="0" step="0.01">
            <input data-trim="start-time" class="trim-time-input" aria-label="Start time"></div>
          <div class="trim-range-row"><label>End</label><input data-trim="end-range" type="range" min="0" step="0.01">
            <input data-trim="end-time" class="trim-time-input" aria-label="End time"></div>
          <div class="trim-summary"><span><strong data-trim="selection"></strong> selected</span><div class="trim-actions">
            <button data-trim="set-start" type="button">Set start here</button><button data-trim="set-end" type="button">Set end here</button>
            <button data-trim="play" type="button">Preview selection</button></div></div>`;
        card.querySelector(".trim-file-name").textContent = item.file.name;
        card.querySelector(".trim-file-meta").textContent = `${formatBytes(item.file.size)} · ${formatTrimTime(item.duration)}`;
        const media = document.createElement(kind);
        media.className = "trim-preview";
        media.controls = true;
        media.preload = "metadata";
        media.src = item.url;
        if (isVideo) media.playsInline = true;
        card.querySelector('[data-trim="preview"]').appendChild(media);
        card.querySelector(".trim-file-remove").addEventListener("click", () => {
          media.pause(); URL.revokeObjectURL(item.url); files.splice(index, 1); render();
        });
        const changeRange = edge => event => {
          item[edge] = Number(event.target.value); updateItem(item, card);
        };
        card.querySelector('[data-trim="start-range"]').addEventListener("input", changeRange("start"));
        card.querySelector('[data-trim="end-range"]').addEventListener("input", changeRange("end"));
        for (const edge of ["start", "end"]) {
          const input = card.querySelector(`[data-trim="${edge}-time"]`);
          const commitTime = () => {
            const value = parseTrimTime(input.value);
            if (value === null) showNotification("Enter time as seconds, M:SS, or H:MM:SS.", "error");
            else item[edge] = value;
            updateItem(item, card);
          };
          input.addEventListener("change", commitTime);
          input.addEventListener("blur", commitTime);
          input.addEventListener("keydown", event => { if (event.key === "Enter") { commitTime(); input.blur(); } });
        }
        card.querySelector('[data-trim="set-start"]').addEventListener("click", () => {
          item.start = Math.min(media.currentTime, item.end - minimumGap(item)); updateItem(item, card);
        });
        card.querySelector('[data-trim="set-end"]').addEventListener("click", () => {
          item.end = Math.max(media.currentTime, item.start + minimumGap(item)); updateItem(item, card);
        });
        card.querySelector('[data-trim="play"]').addEventListener("click", async () => {
          media.currentTime = item.start;
          const stopAtEnd = () => { if (media.currentTime >= item.end) { media.pause(); media.removeEventListener("timeupdate", stopAtEnd); } };
          media.addEventListener("timeupdate", stopAtEnd);
          try { await media.play(); } catch (_) {}
        });
        updateItem(item, card);
        list.appendChild(card);
      });
      list.hidden = !files.length;
      resetOutput();
    }
    async function addFiles(selected, append = false) {
      const accepted = Array.from(selected).filter(acceptFile);
      if (accepted.length !== selected.length) showNotification(`Choose ${kind} files only.`, "error");
      if (!accepted.length) return;
      if (!append) {
        files.forEach(item => URL.revokeObjectURL(item.url));
        files.length = 0;
      }
      for (const file of accepted) {
        const url = URL.createObjectURL(file);
        try {
          const duration = await readMediaDuration(file, kind, url);
          files.push({ file, url, duration, start: 0, end: duration });
        } catch (error) {
          URL.revokeObjectURL(url);
          showNotification(`${file.name}: ${error.message}`, "error");
        }
      }
      render();
      if (files.length) requestAnimationFrame(() => scrollToToolSection("timeline"));
    }
    async function trimAll() {
      if (!files.length) return;
      const items = files.slice();
      const batch = new BatchProcessor({
        items, btnId: "trimBtn", btnLabel: "Trim", zipName: `trimmed_${kind}.zip`,
        processOne: async (item, index) => {
          $("progressLabel").textContent = `Trimming ${index + 1}/${items.length}: ${item.file.name}`;
          const data = await Tools.trimMedia(item.file, { start: item.start, end: item.end });
          const extension = item.file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || (isVideo ? "mp4" : "mp3");
          return { filename: `${item.file.name.replace(/\.[^.]+$/, "")}_trimmed.${extension}`, data };
        }
      });
      await batch.run();
    }

    makeDropZone($("dropZone"), { accept: "", multiple: IS_PREMIUM, maxFree: 1, onFiles: selected => addFiles(selected) });
    if (IS_PREMIUM) {
      $("trimAddMore").hidden = false;
      $("trimAddInput").addEventListener("change", event => { addFiles(event.target.files, true); event.target.value = ""; });
    }
    $("trimBtn").addEventListener("click", event => { if (!event.currentTarget.classList.contains("btn-done")) trimAll(); });
    window.addEventListener("pagehide", () => files.forEach(item => URL.revokeObjectURL(item.url)));
  }

  function startTrimAudioPage() { startTrimMediaPage("audio"); }
  function startTrimVideoPage() { startTrimMediaPage("video"); }

  async function finishMediaDownload(blob, filename, buttonId) {
    const url = URL.createObjectURL(blob);
    if (window._lastDownload) URL.revokeObjectURL(window._lastDownload.url);
    window._lastDownload = { url, filename };
    await triggerDownload(url, filename);
    const button = document.getElementById(buttonId);
    button.disabled = false;
    button.textContent = "✓ Done! — click to re-download";
    button.classList.add("btn-done");
    button._redownloadHandler = async () => {
      if (window._lastDownload) await triggerDownload(window._lastDownload.url, window._lastDownload.filename);
    };
    button.addEventListener("click", button._redownloadHandler);
    button.scrollIntoView({ behavior: "smooth", block: "center" });
    refreshAds();
  }

  function startMergeMediaPage(kind) {
    const isVideo = kind === "video";
    const title = isVideo ? "Merge videos" : "Merge audio";
    const accept = isVideo ? videoAccept : audioAccept;
    const acceptFile = isVideo ? isVideoFile : isAudioFile;
    const icon = isVideo ? "🎬" : "🎵";
    const files = [];
    const $ = id => document.getElementById(id);
    renderToolPage({
      title, category: isVideo ? "Video" : "Audio",
      description: `Arrange and join multiple ${kind} files into one continuous ${kind} file.`,
      input: { type: "file", label: `Your ${kind} files`, icon, accept,
        hint: `Choose two or more ${kind} files. They will be joined in the order shown.` },
      workspaceHtml: `<section class="files-section" id="filesSection" data-tool-section="files">
        <div class="files-header"><div class="files-count" id="filesCount">0 files</div><label class="btn-add-more">+ Add more
          <input id="mergeAddInput" type="file" accept="${accept}" multiple></label></div>
        <div class="file-list" id="fileList"></div><p class="merge-hint">Drag files to change their order.</p></section>`,
      resultHtml: `<section class="progress-section" id="progressSection" aria-live="polite"><div class="progress-label">
        <span id="progressLabel">Checking files…</span><span id="progressPct">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <button class="btn-primary" id="mergeBtn" disabled>Add at least 2 ${kind} files</button>`,
      ...mediaPrivacy(isVideo ? "Your videos" : "Your audio"),
      goodToKnow: [
        `Drag the ${isVideo ? "clips" : "files"} to choose their order in the finished ${kind}.`,
        `Matching files are joined by copying their existing streams, which is fast and preserves quality.`,
        `Files with different technical settings are re-encoded to a compatible shared format when necessary.`,
        `This tool creates straight joins without fades or crossfades.`
      ]
    });
    function reset() {
      clearLastDownload();
      $("progressSection").classList.remove("show");
      $("mergeBtn").disabled = files.length < 2;
      $("mergeBtn").textContent = files.length < 2 ? `Add at least 2 ${kind} files` : "Merge & download";
    }
    function render() {
      const list = $("fileList"); list.replaceChildren();
      files.forEach((file, index) => {
        const row = document.createElement("div"); row.className = "file-item";
        row.innerHTML = `<span class="file-drag-handle" aria-hidden="true">⠿</span><span class="file-icon">${icon}</span>
          <div class="file-info"><div class="file-name"></div><div class="file-meta"></div></div>
          <button class="file-remove" type="button" aria-label="Remove file">×</button>`;
        row.querySelector(".file-name").textContent = file.name;
        row.querySelector(".file-meta").textContent = formatBytes(file.size);
        row.querySelector(".file-remove").addEventListener("click", () => { files.splice(index, 1); render(); });
        list.appendChild(row);
      });
      makeDraggable(list, files, reordered => { files.splice(0, files.length, ...reordered); render(); });
      $("filesSection").classList.toggle("show", files.length > 0);
      $("filesCount").textContent = `${files.length} file${files.length === 1 ? "" : "s"}`;
      reset();
    }
    function addFiles(selected, append) {
      const accepted = Array.from(selected).filter(acceptFile);
      if (accepted.length !== selected.length) showNotification(`Choose ${kind} files only.`, "error");
      if (!accepted.length) return;
      if (!append) files.length = 0;
      files.push(...accepted); render();
      requestAnimationFrame(() => scrollToToolSection("files"));
    }
    async function merge() {
      if (files.length < 2) return;
      btnLoading("mergeBtn", "Merging…");
      $("progressSection").classList.add("show");
      $("progressFill").classList.add("indeterminate");
      try {
        const result = await Tools.mergeMedia({ files: files.slice(), kind,
          onPhase(phase) {
            $("progressLabel").textContent = phase === "fast" ? "Joining without quality loss…"
              : phase === "slow" ? "Matching different file settings…" : "Checking compatibility…";
          },
          onProgress(progress) {
            $("progressFill").classList.remove("indeterminate");
            $("progressFill").style.width = `${Math.round(progress * 100)}%`;
            $("progressPct").textContent = `${Math.round(progress * 100)}%`;
          }
        });
        $("progressFill").classList.remove("indeterminate"); $("progressFill").style.width = "100%";
        $("progressPct").textContent = "100%";
        $("progressLabel").textContent = result.method === "copy" ? "Done — joined without re-encoding." : "Done — files matched and joined.";
        await finishMediaDownload(result.blob, `merged_${kind}.${result.extension}`, "mergeBtn");
      } catch (error) {
        $("progressSection").classList.remove("show"); showNotification(error.message || "The files could not be merged.", "error"); reset();
      }
    }
    makeDropZone($("dropZone"), { accept: "", multiple: true, maxFree: Infinity, onFiles: selected => addFiles(selected, false) });
    $("mergeAddInput").addEventListener("change", event => { addFiles(event.target.files, true); event.target.value = ""; });
    $("mergeBtn").addEventListener("click", event => { if (!event.currentTarget.classList.contains("btn-done")) merge(); });
  }

  function startCombineMediaPage() {
    const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
    const isImageFile = file => file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);
    const state = { visual: null, audio: null, visualIsImage: false, videoDuration: 0, audioDuration: 0,
      visualUrl: "", audioUrl: "", playing: false, raf: 0, previewTimer: 0, previousVideoVolume: 100 };
    const $ = id => document.getElementById(id);
    renderToolPage({
      title: "Combine video & audio", category: "Video",
      description: "Mix an audio track with a video, or pair audio with a still image to create an MP4.",
      input: { html: `<label>Your files</label><div class="media-pair">
        <div class="media-slot" id="visualSlot"><input id="visualInput" type="file" accept="video/*,image/*,.mp4,.mov,.avi,.mkv,.webm,.jpg,.jpeg,.png,.gif,.webp,.avif">
          <button class="media-slot-clear" id="visualClear" type="button" hidden aria-label="Remove video or image">×</button>
          <div class="media-slot-icon" id="visualIcon">🎬</div><div class="media-slot-label">Video or image</div>
          <div class="media-slot-name" id="visualName">Choose or drop a file</div><div class="media-slot-meta" id="visualMeta"></div></div>
        <div class="media-slot" id="audioSlot"><input id="audioInput" type="file" accept="${audioAccept}">
          <button class="media-slot-clear" id="audioClear" type="button" hidden aria-label="Remove audio">×</button>
          <div class="media-slot-icon">🎵</div><div class="media-slot-label">Audio</div>
          <div class="media-slot-name" id="audioName">Choose or drop a file</div><div class="media-slot-meta" id="audioMeta"></div></div>
        </div>` },
      advancedHtml: `<div class="combine-editor" id="combineEditor" hidden>
        <div class="combine-preview" id="combinePreview"><div class="combine-preview-empty">Add a video or image to start</div></div>
        <div class="combine-transport"><button class="combine-play" id="combinePlay" type="button" aria-label="Play preview">▶</button>
          <input class="combine-seek" id="combineSeek" type="range" min="0" max="0" step="0.05" value="0" aria-label="Preview position">
          <span class="combine-time" id="combineTime">0:00 / 0:00</span></div>
        <div class="combine-timeline" id="combineTimeline">
          <div class="combine-ruler"><span>0:00</span><span id="rulerMiddle">0:00</span><span id="rulerEnd">0:00</span></div>
          <div class="combine-track"><div class="combine-track-label"><strong id="videoTrackName">Visual</strong><span>Video</span></div>
            <div class="combine-lane" id="videoLane"><div class="combine-clip combine-video-clip"></div><div class="combine-playhead"></div></div></div>
          <div class="combine-track" id="audioTrack"><div class="combine-track-label"><strong id="audioTrackName">Soundtrack</strong><span>Drag to position</span></div>
            <div class="combine-lane" id="audioLane"><div class="combine-clip combine-audio-clip" id="audioClip"></div><div class="combine-playhead"></div></div></div>
          <p class="combine-timeline-note" id="timelineNote">Drop an audio file above to place it on the timeline.</p>
        </div>
        <div class="combine-align" id="alignmentSetting"><span class="combine-align-label">Align audio</span>
          <button type="button" data-align="start" class="active">Start</button><button type="button" data-align="end">End</button>
          <div class="combine-offset"><label for="combineOffset">Start time</label><input id="combineOffset" type="number" min="0" step="0.05" value="0"><span>seconds</span></div>
        </div>
        <div class="combine-mixer">
          <div class="combine-channel" id="videoVolumeSetting"><div class="combine-channel-head"><span>🎬</span><strong>Original video sound</strong>
            <button class="combine-mute" id="videoMute" type="button">Mute</button><output id="videoVolumeValue">100%</output></div>
            <input id="videoVolume" type="range" min="0" max="100" value="100" aria-label="Original video volume"></div>
          <div class="combine-channel"><div class="combine-channel-head"><span>🎵</span><strong>Added soundtrack</strong>
            <button class="combine-mute" id="audioMute" type="button">Mute</button><output id="audioVolumeValue">100%</output></div>
            <input id="audioVolume" type="range" min="0" max="100" value="100" aria-label="Added audio volume"></div>
        </div>
      </div>`,
      resultHtml: `<section class="progress-section" id="progressSection" aria-live="polite"><div class="progress-label">
        <span id="progressLabel">Combining…</span><span id="progressPct"></span></div>
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <div class="combine-actions"><button class="combine-preview-btn" id="previewMixBtn" disabled>Preview mix</button>
          <button class="btn-primary" id="combineBtn" disabled>Export MP4</button></div>`,
      ...mediaPrivacy("Your files"),
      goodToKnow: [
        "The added audio is mixed with the video's existing sound. Set the original video volume to 0% to replace it.",
        "Start together begins both files at zero. End together delays shorter audio so both finish together.",
        "A custom start time lets you place the added audio later in the video.",
        "A still image is held for the full audio duration and exported as an MP4 video."
      ]
    });

    function resetOutput() {
      clearLastDownload(); $("progressSection").classList.remove("show");
      $("combineBtn").disabled = !(state.visual && state.audio);
      $("previewMixBtn").disabled = !(state.visual && state.audio);
      $("combineBtn").textContent = "Export MP4";
    }
    function calculatedOffset() {
      if (state.visualIsImage) return 0;
      return Math.max(0, Math.min(state.videoDuration || 0, Number($("combineOffset").value) || 0));
    }
    function outputDuration() {
      return state.visualIsImage ? state.audioDuration : state.videoDuration;
    }
    function stopPreview() {
      state.playing = false; cancelAnimationFrame(state.raf); clearTimeout(state.previewTimer);
      const video = $("combineVideoPreview"); const audio = $("combineAudioPreview");
      if (video && typeof video.pause === "function") video.pause(); if (audio) audio.pause();
      $("combinePlay").textContent = "▶"; $("combinePlay").setAttribute("aria-label", "Play preview");
      $("previewMixBtn").textContent = "Preview mix";
    }
    function setPreviewTime(time) {
      const duration = outputDuration() || 0; const next = Math.max(0, Math.min(duration, Number(time) || 0));
      const video = $("combineVideoPreview"); const audio = $("combineAudioPreview"); const offset = calculatedOffset();
      if (video && !state.visualIsImage) video.currentTime = Math.min(next, video.duration || next);
      if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || state.audioDuration, next - offset));
      $("combineSeek").value = String(next); updatePlayhead(next);
    }
    function updatePlayhead(time) {
      const duration = outputDuration() || 1; const pct = Math.max(0, Math.min(100, (time / duration) * 100));
      document.querySelectorAll(".combine-playhead").forEach(line => line.style.left = `${pct}%`);
      $("combineTime").textContent = `${formatTrimTime(time)} / ${formatTrimTime(outputDuration())}`;
    }
    function tickPreview() {
      if (!state.playing) return;
      const video = $("combineVideoPreview"); const audio = $("combineAudioPreview");
      const time = state.visualIsImage ? (audio ? calculatedOffset() + audio.currentTime : 0) : (video ? video.currentTime : 0);
      $("combineSeek").value = String(time); updatePlayhead(time);
      if (time >= outputDuration() - .03) { stopPreview(); setPreviewTime(0); return; }
      state.raf = requestAnimationFrame(tickPreview);
    }
    async function playPreview() {
      if (!(state.visual && state.audio)) return;
      if (state.playing) { stopPreview(); return; }
      let time = Number($("combineSeek").value) || 0;
      if (time >= outputDuration() - .05) { time = 0; setPreviewTime(0); }
      const video = $("combineVideoPreview"); const audio = $("combineAudioPreview"); const offset = calculatedOffset();
      const videoVolume = Number($("videoVolume").value) / 100; const audioVolume = Number($("audioVolume").value) / 100;
      if (video) video.volume = videoVolume; if (audio) audio.volume = audioVolume;
      state.playing = true; $("combinePlay").textContent = "❚❚"; $("combinePlay").setAttribute("aria-label", "Pause preview");
      $("previewMixBtn").textContent = "Pause preview";
      const audioDelay = Math.max(0, offset - time);
      const starts = [];
      if (!state.visualIsImage && video) starts.push(video.play());
      if (audioDelay > 0) state.previewTimer = setTimeout(() => { if (state.playing) audio.play().catch(() => {}); }, audioDelay * 1000);
      else if (audio && time < offset + state.audioDuration) starts.push(audio.play());
      await Promise.all(starts);
      tickPreview();
    }
    function renderTimeline() {
      const duration = outputDuration(); const offset = calculatedOffset();
      $("combineEditor").hidden = !state.visual;
      $("combineSeek").max = String(duration || 0);
      $("rulerMiddle").textContent = formatTrimTime(duration / 2);
      $("rulerEnd").textContent = formatTrimTime(duration);
      $("videoTrackName").textContent = state.visual ? state.visual.name : "Visual";
      $("audioTrackName").textContent = state.audio ? state.audio.name : "Soundtrack";
      const left = duration ? Math.min(100, offset / duration * 100) : 0;
      const fullWidth = duration ? state.audioDuration / duration * 100 : 0;
      const visibleWidth = Math.max(0, Math.min(fullWidth, 100 - left));
      $("audioClip").style.left = `${left}%`; $("audioClip").style.width = `${visibleWidth}%`;
      $("audioClip").hidden = !state.audio; $("audioClip").classList.toggle("clipped", Boolean(state.audio && offset + state.audioDuration > duration + .05));
      $("timelineNote").textContent = !state.audio ? "Drop an audio file above to place it on the timeline."
        : offset + state.audioDuration > duration + .05 ? `${formatTrimTime(offset + state.audioDuration - duration)} of the soundtrack extends past the video and will be cut.`
        : `Soundtrack starts at ${formatTrimTime(offset)} and ends at ${formatTrimTime(offset + state.audioDuration)}.`;
      $("alignmentSetting").hidden = !state.audio || state.visualIsImage;
      $("videoVolumeSetting").hidden = state.visualIsImage;
      updatePlayhead(Number($("combineSeek").value) || 0);
    }
    function updateSettings() {
      const both = state.visual && state.audio;
      const canAlign = both && !state.visualIsImage && state.videoDuration > 0 && state.audioDuration > 0;
      $("combineOffset").max = String(Math.max(0, state.videoDuration || 0));
      if (!canAlign || state.visualIsImage) $("combineOffset").value = "0";
      stopPreview(); renderTimeline();
      resetOutput();
    }
    function renderSlot(type) {
      const visual = type === "visual"; const file = state[type];
      $(`${type}Clear`).hidden = !file;
      $(`${type}Slot`).classList.toggle("loaded", Boolean(file));
      $(`${type}Name`).textContent = file ? file.name : visual ? "Choose or drop a file" : "Choose or drop an audio file";
      const duration = visual ? state.videoDuration : state.audioDuration;
      $(`${type}Meta`).textContent = file ? `${formatBytes(file.size)}${duration ? ` · ${formatTrimTime(duration)}` : ""}` : "";
      if (visual) $("visualIcon").textContent = state.visualIsImage ? "🖼" : "🎬";
      updateSettings();
    }
    function renderPreview() {
      const preview = $("combinePreview"); preview.replaceChildren();
      if (!state.visual) { preview.innerHTML = '<div class="combine-preview-empty">Add a video or image to start</div>'; return; }
      const media = document.createElement(state.visualIsImage ? "img" : "video");
      media.id = "combineVideoPreview"; media.src = state.visualUrl; media.playsInline = true; media.preload = "metadata";
      if (state.visualIsImage) media.alt = "Selected image preview";
      preview.appendChild(media);
      const badge = document.createElement("span"); badge.className = "combine-preview-badge";
      badge.textContent = state.visualIsImage ? "Still image + audio" : "Mix preview"; preview.appendChild(badge);
      if (state.audio) {
        const audio = document.createElement("audio"); audio.id = "combineAudioPreview"; audio.src = state.audioUrl; audio.preload = "auto"; preview.appendChild(audio);
      }
    }
    async function setSlot(type, file) {
      if (!file) return;
      const visual = type === "visual";
      const valid = visual ? isVideoFile(file) || isImageFile(file) : isAudioFile(file);
      if (!valid) { showNotification(`Choose ${visual ? "a video or image" : "an audio"} file.`, "error"); return; }
      state[type] = file;
      if (visual) state.visualIsImage = isImageFile(file);
      const urlKey = visual ? "visualUrl" : "audioUrl";
      if (state[urlKey]) URL.revokeObjectURL(state[urlKey]);
      state[urlKey] = URL.createObjectURL(file);
      const durationKey = visual ? "videoDuration" : "audioDuration";
      state[durationKey] = 0;
      if (!visual || !state.visualIsImage) {
        const url = URL.createObjectURL(file);
        try { state[durationKey] = await readMediaDuration(file, visual ? "video" : "audio", url); }
        catch (_) { state[durationKey] = 0; }
        finally { URL.revokeObjectURL(url); }
      }
      renderPreview(); renderSlot(type);
    }
    function wireSlot(type) {
      const slot = $(`${type}Slot`); const input = $(`${type}Input`);
      input.addEventListener("change", () => { setSlot(type, input.files[0]); input.value = ""; });
      slot.addEventListener("dragover", event => { event.preventDefault(); slot.classList.add("dragover"); });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", event => { event.preventDefault(); slot.classList.remove("dragover"); setSlot(type, event.dataTransfer.files[0]); });
      $(`${type}Clear`).addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); stopPreview(); state[type] = null;
        const urlKey = type === "visual" ? "visualUrl" : "audioUrl";
        if (state[urlKey]) URL.revokeObjectURL(state[urlKey]); state[urlKey] = "";
        if (type === "visual") { state.visualIsImage = false; state.videoDuration = 0; }
        else state.audioDuration = 0;
        renderPreview(); renderSlot(type);
      });
    }
    async function combine() {
      if (!state.visual || !state.audio) return;
      stopPreview();
      btnLoading("combineBtn", "Combining…");
      $("progressSection").classList.add("show"); $("progressFill").classList.add("indeterminate");
      $("progressLabel").textContent = "Combining video and audio…";
      try {
        const blob = await Tools.combineVideoAudio({ visual: state.visual, audio: state.audio,
          visualIsImage: state.visualIsImage, offset: calculatedOffset(),
          videoVolume: Number($("videoVolume").value) / 100, audioVolume: Number($("audioVolume").value) / 100 });
        $("progressFill").classList.remove("indeterminate"); $("progressFill").style.width = "100%";
        $("progressPct").textContent = "100%"; $("progressLabel").textContent = "Done!";
        const base = state.visual.name.replace(/\.[^.]+$/, "");
        await finishMediaDownload(blob, `${base}_with_audio.mp4`, "combineBtn");
      } catch (error) {
        $("progressSection").classList.remove("show"); showNotification(error.message || "The files could not be combined.", "error"); resetOutput();
      }
    }
    wireSlot("visual"); wireSlot("audio");
    document.querySelectorAll("[data-align]").forEach(button => button.addEventListener("click", () => {
      if (!state.videoDuration || !state.audioDuration) return;
      const offset = button.dataset.align === "end" ? Math.max(0, state.videoDuration - state.audioDuration) : 0;
      $("combineOffset").value = String(offset);
      document.querySelectorAll("[data-align]").forEach(item => item.classList.toggle("active", item === button));
      updateSettings();
    }));
    $("combineOffset").addEventListener("input", () => {
      document.querySelectorAll("[data-align]").forEach(item => item.classList.remove("active")); updateSettings();
    });
    function seekFromPointer(event) {
      if (!outputDuration()) return;
      const rect = $("videoLane").getBoundingClientRect();
      setPreviewTime((event.clientX - rect.left) / rect.width * outputDuration());
    }
    $("videoLane").addEventListener("click", seekFromPointer);
    $("audioLane").addEventListener("click", event => { if (event.target !== $("audioClip")) seekFromPointer(event); });
    let draggingAudio = false;
    function dragAudio(event) {
      if (!draggingAudio || !state.videoDuration) return;
      const point = event.touches ? event.touches[0] : event; const rect = $("audioLane").getBoundingClientRect();
      $("combineOffset").value = String(Math.max(0, Math.min(state.videoDuration, (point.clientX - rect.left) / rect.width * state.videoDuration)));
      document.querySelectorAll("[data-align]").forEach(item => item.classList.remove("active"));
      stopPreview(); renderTimeline(); resetOutput(); event.preventDefault();
    }
    $("audioClip").addEventListener("pointerdown", event => { draggingAudio = true; $("audioClip").setPointerCapture(event.pointerId); dragAudio(event); });
    $("audioClip").addEventListener("pointermove", dragAudio);
    $("audioClip").addEventListener("pointerup", () => { draggingAudio = false; });
    $("combineSeek").addEventListener("input", event => { stopPreview(); setPreviewTime(event.target.value); });
    $("combinePlay").addEventListener("click", playPreview);
    $("previewMixBtn").addEventListener("click", playPreview);
    for (const type of ["video", "audio"]) {
      $(`${type}Volume`).addEventListener("input", event => {
        $(`${type}VolumeValue`).textContent = `${event.target.value}%`;
        $(`${type}Mute`).classList.toggle("active", event.target.value === "0");
        const preview = $(type === "video" ? "combineVideoPreview" : "combineAudioPreview");
        if (preview) preview.volume = Number(event.target.value) / 100;
        resetOutput();
      });
      $(`${type}Mute`).addEventListener("click", () => {
        const slider = $(`${type}Volume`); const muting = slider.value !== "0";
        if (muting) state[`previous${type[0].toUpperCase() + type.slice(1)}Volume`] = Number(slider.value) || 100;
        slider.value = muting ? "0" : String(state[`previous${type[0].toUpperCase() + type.slice(1)}Volume`] || 100);
        slider.dispatchEvent(new Event("input"));
      });
    }
    $("combineBtn").addEventListener("click", event => { if (!event.currentTarget.classList.contains("btn-done")) combine(); });
    window.addEventListener("pagehide", () => {
      stopPreview(); if (state.visualUrl) URL.revokeObjectURL(state.visualUrl); if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    });
    renderPreview();
    updateSettings();
  }

  function startMergeAudioPage() { startMergeMediaPage("audio"); }
  function startMergeVideoPage() { startMergeMediaPage("video"); }

  window.startExtractAudioPage = startExtractAudioPage;
  window.startRemoveAudioPage = startRemoveAudioPage;
  window.startAudioConverterPage = startAudioConverterPage;
  window.startVideoConverterPage = startVideoConverterPage;
  window.startTrimAudioPage = startTrimAudioPage;
  window.startTrimVideoPage = startTrimVideoPage;
  window.startMergeAudioPage = startMergeAudioPage;
  window.startMergeVideoPage = startMergeVideoPage;
  window.startCombineMediaPage = startCombineMediaPage;
})();

/* Images to animation controls. Processing lives behind the Tools API. */
(function () {
  function startPhotosToGifPage() {
    let frames = [];
    let preview = null;
    let importing = false;
    const $ = id => document.getElementById(id);

    renderToolPage({
      title: "Photos to GIF or WebP", category: "Images",
      description: "Arrange images into a GIF or WebP animation, choose its size and speed, then download it.",
      input: { html: `
        <label for="fileInput">Your images</label>
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/*" multiple>
          <div class="drop-icon" aria-hidden="true">🖼</div>
          <div class="drop-text"><strong>Choose images</strong> or drag them here</div>
          <div class="drop-sub">JPG, PNG, GIF, WebP, AVIF, and other browser-readable images</div>
        </div>` },
      workspaceHtml: `
        <section class="gif-frames" id="framesSection" data-tool-section="frames" hidden>
          <div class="gif-frames-header"><span id="framesCount">0 frames</span>
            <label class="btn-add-more">+ Add more<input id="addFramesInput" type="file" accept="image/*" multiple></label>
          </div>
          <div class="gif-frames-grid" id="framesGrid"></div>
          <p class="format-hint">Drag frames to change their order.</p>
        </section>`,
      advancedHtml: `
        <div class="gif-settings">
          <div><label for="animationFormat">Output format</label><select id="animationFormat">
            <option value="image/gif">GIF</option><option value="image/webp">Animated WebP</option>
          </select></div>
          <div><label for="gifSize">Animation width</label><select id="gifSize">
            <option value="original">Original first-frame width</option><option value="480" selected>480 px</option>
            <option value="320">320 px</option><option value="240">240 px</option>
          </select></div>
          <div><label for="gifSpeed">Frame speed</label><select id="gifSpeed">
            <option value="100">Fast · 0.1 seconds</option><option value="200" selected>Normal · 0.2 seconds</option>
            <option value="500">Slow · 0.5 seconds</option><option value="1000">Very slow · 1 second</option>
          </select></div>
        </div>`,
      resultHtml: `
        <section class="progress-section" id="progressSection" aria-live="polite"><div class="progress-label">
          <span id="progressLabel">Building animation…</span><span id="progressPct">0%</span></div>
          <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <div id="mediaPreviewMount"></div>
        <button class="btn-primary" id="createBtn" disabled>Add images</button>`,
      privacyTitle: "Your frames never leave your device.",
      privacyNote: "Your images are decoded and combined inside your browser. EssentialBits does not upload or store them.",
      privacyPoints: ["Processed on your device", "No server upload", "No account needed"],
      goodToKnow: [
        "Drag the thumbnails to control the frame order before creating the GIF.",
        "An animated GIF, WebP, or AVIF can supply all of its frames when your browser supports decoding that format.",
        "Every frame uses the first image's aspect ratio. Images with a different shape are fitted onto a white background without cropping.",
        "GIF supports up to 256 colors per frame. Animated WebP keeps more color detail and is often smaller.",
        "Smaller dimensions usually create a much smaller GIF."
      ]
    });
    preview = createMediaPreview({ mode: "result", outputLabel: "Animation preview",
      downloadFilename: "animation.gif", downloadLabel: "Download animation" });

    function clearPreview() {
      preview.clear();
      $("progressSection").classList.remove("show");
    }

    function resetButton() {
      const button = $("createBtn");
      button.disabled = importing || frames.length < 1;
      button.textContent = importing ? "Preparing frames…" : frames.length < 1 ? "Add images" : "Create preview";
      button.classList.remove("btn-done");
    }

    function renderFrames() {
      const grid = $("framesGrid");
      grid.replaceChildren();
      frames.forEach((frame, index) => {
        const item = document.createElement("div");
        item.className = "gif-frame";
        item.dataset.index = index;
        const image = document.createElement("img");
        image.src = frame.url;
        image.alt = "";
        const number = document.createElement("span");
        number.className = "gif-frame-number";
        number.textContent = String(index + 1);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "gif-frame-remove";
        remove.setAttribute("aria-label", `Remove ${frame.name || frame.file.name || `frame ${index + 1}`}`);
        remove.textContent = "×";
        remove.addEventListener("click", event => {
          event.stopPropagation();
          URL.revokeObjectURL(frames[index].url);
          frames.splice(index, 1);
          clearPreview();
          renderFrames();
        });
        item.append(image, number, remove);
        grid.appendChild(item);
      });
      $("framesSection").hidden = frames.length === 0;
      $("framesCount").textContent = `${frames.length} frame${frames.length === 1 ? "" : "s"}`;
      makeDraggable(grid, frames, reordered => {
        frames = reordered;
        clearPreview();
        renderFrames();
      });
      resetButton();
    }

    async function setFiles(fileList, append) {
      const selected = Array.from(fileList).filter(file => !file.type || file.type.startsWith("image/"));
      if (!selected.length) return;
      if (!append) {
        frames.forEach(frame => URL.revokeObjectURL(frame.url));
        frames = [];
      }
      importing = true;
      clearPreview();
      renderFrames();
      try {
        for (const file of selected) {
          try {
            const info = await Tools.inspectImage(file);
            if (info.animated && info.frameCount > 1) {
              $("framesCount").textContent = `Splitting ${info.frameCount} frames…`;
              const split = await Tools.splitAnimation(file);
              const base = (file.name || "animation").replace(/\.[^.]+$/, "");
              const digits = String(split.frames.length).length;
              frames.push(...split.frames.map((frame, index) => ({
                file: frame.blob,
                name: `${base}-frame-${String(index + 1).padStart(digits, "0")}.png`,
                duration: frame.duration,
                url: URL.createObjectURL(frame.blob)
              })));
            } else {
              frames.push({ file, name: file.name, url: URL.createObjectURL(file) });
            }
          } catch (error) {
            showNotification(`Could not split ${file.name || "this animation"}: ${error.message}`, "error");
            frames.push({ file, name: file.name, url: URL.createObjectURL(file) });
          }
          renderFrames();
        }
      } finally {
        importing = false;
        renderFrames();
      }
    }

    async function createGif() {
      if (frames.length < 1) return;
      clearNotification();
      clearPreview();
      btnLoading("createBtn", "Building animation…");
      $("progressSection").classList.add("show");
      $("progressLabel").textContent = "Building animation…";
      $("progressFill").style.width = "0%";
      $("progressPct").textContent = "0%";
      try {
        const width = $("gifSize").value === "original" ? undefined : Number($("gifSize").value);
        const delay = Number($("gifSpeed").value);
        const format = $("animationFormat").value;
        const extension = format === "image/webp" ? "webp" : "gif";
        const blob = await Tools.imagesToAnimation(frames.map(frame => frame.file), {
          format, width, delay, onProgress: progress => {
            const percent = Math.round(progress * 100);
            $("progressFill").style.width = `${percent}%`;
            $("progressPct").textContent = `${percent}%`;
          }
        });
        $("progressFill").style.width = "100%";
        $("progressPct").textContent = "100%";
        $("progressLabel").textContent = "Done!";
        preview.show({ output: blob, filename: `animation.${extension}`,
          meta: `${frames.length} frame${frames.length === 1 ? "" : "s"}` });
        const button = $("createBtn");
        button.disabled = false;
        button.textContent = "Update preview";
        refreshAds();
        scrollToToolSection("preview");
      } catch (error) {
        showNotification(error.message || "GIF creation failed.", "error");
        resetButton();
      }
    }

    makeDropZone($("dropZone"), { accept: "image/", multiple: true, maxFree: Infinity,
      onFiles: selected => setFiles(selected, false) });
    $("addFramesInput").addEventListener("change", event => {
      setFiles(event.target.files, true);
      event.target.value = "";
    });
    $("gifSize").addEventListener("change", () => { clearPreview(); resetButton(); });
    $("gifSpeed").addEventListener("change", () => { clearPreview(); resetButton(); });
    $("animationFormat").addEventListener("change", () => { clearPreview(); resetButton(); });
    $("createBtn").addEventListener("click", createGif);
    window.addEventListener("pagehide", () => {
      frames.forEach(frame => URL.revokeObjectURL(frame.url));
    });
  }

  window.startPhotosToGifPage = startPhotosToGifPage;
})();

/* Strip Metadata controls. Inspection, rebuilding, structural cleaning, and
   verification live behind Tools.inspectImageMetadata/stripImageMetadata. */
(function () {
  function startStripMetadataPage() {
    const $ = id => document.getElementById(id);
    let items = [];
    let scanToken = 0;
    const reports = [];

    renderToolPage({
      title: "Strip metadata", category: "Images",
      description: "Remove location, device, timestamp, authorship, and optional container data before sharing an image.",
      input: { html: `
        <label for="fileInput">Your image</label>
        <div class="drop-zone" id="dropZone">
          <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp">
          <div class="drop-icon" aria-hidden="true">🛡</div>
          <div class="drop-text"><strong>Choose an image</strong> or drag it here</div>
          <div class="drop-sub">JPG, PNG, or WebP · up to 100 MB / 100 megapixels</div>
        </div>` },
      workspaceHtml: `
        <section class="files-section metadata-files" id="filesSection" data-tool-section="files">
          <div class="files-header"><span class="files-count" id="filesCount">0 images</span>
            <label class="btn-add-more" id="addMoreLabel" hidden>+ Add more<input id="addMoreInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
          </div><div class="file-list" id="fileList"></div>
        </section>
        <section class="metadata-findings" id="metadataFindings" data-tool-section="findings" hidden>
          <div class="metadata-heading">Detected metadata <span id="metadataCount">0 fields</span></div>
          <div class="metadata-table-wrap"><table class="metadata-table"><tbody id="metadataTable"></tbody></table></div>
        </section>
        <div class="metadata-message metadata-clear" id="metadataEmpty" hidden>✓ No removable metadata was detected. The image will still be rebuilt and verified.</div>
        <div class="metadata-message metadata-warning" id="scanWarning" hidden></div>
        <section class="metadata-explanation" id="metadataExplanation" data-tool-section="meaning" hidden>
          <div class="metadata-explanation-header"><span>What this image reveals</span><span>Before cleaning</span></div>
          <p class="metadata-narrative" id="metadataNarrative"></p>
          <div class="metadata-privacy-impact"><strong>Privacy impact</strong><p id="metadataPrivacyImpact"></p></div>
          <div class="metadata-removal-preview"><strong>What will be removed</strong><p id="metadataRemovalSummary"></p></div>
          <details class="metadata-certainty"><summary>Limitations and technical evidence</summary>
            <p id="metadataCertaintyNote"></p><p><strong>Fields used:</strong> <span id="metadataEvidence"></span></p></details>
        </section>`,
      resultHtml: `
        <section class="progress-section" id="progressSection" aria-live="polite"><div class="progress-label">
          <span id="progressLabel">Cleaning and verifying…</span><span id="progressPct">0%</span></div>
          <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <button class="btn-primary" id="stripBtn" disabled>Choose an image</button>
        <section class="metadata-report" id="reportSection" data-tool-section="results" hidden>
          <div class="metadata-heading">Cleaning results</div><div id="reportList"></div>
        </section>`,
      privacyTitle: "Your image stays on your device.",
      privacyNote: "Inspection and cleaning run in your browser. EssentialBits does not upload or store your image.",
      privacyPoints: ["Processed on your device", "No server upload", "Verified after cleaning"],
      goodToKnow: [
        "GPS location is highlighted because it can reveal where an image was captured.",
        "The inspector checks EXIF, GPS, IPTC, XMP, ICC profiles, comments, thumbnails, Content Credentials, optional container blocks, and trailing data.",
        "The image is decoded to visible pixels, re-encoded, structurally cleaned, and inspected again before download.",
        "PNG transparency is preserved. JPG and WebP are re-encoded at high quality, so output bytes and file size may change.",
        "Visible marks, steganography, and pixel-level watermarks are part of the image itself and are not removed."
      ]
    });

    $("addMoreLabel").hidden = !IS_PREMIUM;
    $("fileInput").multiple = IS_PREMIUM;

    function itemFor(file) {
      return { file, name: file.name || "image", inspection: null, status: "queued", error: null };
    }

    function resetResults() {
      reports.length = 0;
      $("reportSection").hidden = true;
      $("reportList").replaceChildren();
      $("progressSection").classList.remove("show");
    }

    function renderFiles() {
      $("fileList").replaceChildren();
      items.forEach((item, index) => {
        const row = document.createElement("div"); row.className = "file-item";
        const icon = document.createElement("div"); icon.className = "file-icon"; icon.textContent = "🖼";
        const info = document.createElement("div"); info.className = "file-info";
        const name = document.createElement("div"); name.className = "file-name"; name.textContent = item.name;
        const meta = document.createElement("div"); meta.className = "file-meta";
        const detail = item.status === "scanning" ? " · inspecting…" : item.error ? ` · ${item.error}`
          : item.inspection ? ` · ${item.inspection.findings.length} finding${item.inspection.findings.length === 1 ? "" : "s"}` : "";
        meta.textContent = `${formatBytes(item.file.size)}${detail}`; info.append(name, meta);
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "file-remove";
        remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${item.name}`);
        remove.addEventListener("click", () => { items.splice(index, 1); scanToken++; resetResults(); renderFiles(); renderInspection(); });
        row.append(icon, info, remove); $("fileList").appendChild(row);
      });
      $("filesSection").classList.toggle("show", items.length > 0);
      $("filesCount").textContent = `${items.length} image${items.length === 1 ? "" : "s"}`;
      const waiting = items.some(item => item.status === "queued" || item.status === "scanning");
      const errors = items.some(item => item.error);
      $("stripBtn").disabled = !items.length || waiting || errors;
      $("stripBtn").textContent = !items.length ? "Choose an image" : waiting ? "Inspecting image…"
        : errors ? "Remove unsupported files to continue" : `Strip, verify & download — 0/${items.length}`;
    }

    function renderInspection() {
      $("metadataFindings").hidden = true; $("metadataEmpty").hidden = true;
      $("scanWarning").hidden = true; $("metadataExplanation").hidden = true;
      $("metadataTable").replaceChildren();
      if (items.length !== 1 || !items[0].inspection) return;
      const inspection = items[0].inspection;
      const rows = [...inspection.findings].sort((a, b) => {
        const rank = item => item.category === "location" ? 0 : item.category === "credential" ? 1 : item.sensitive ? 2 : item.container ? 3 : 4;
        return rank(a) - rank(b) || a.key.localeCompare(b.key);
      });
      if (!rows.length) $("metadataEmpty").hidden = false;
      else {
        for (const finding of rows) {
          const tr = document.createElement("tr");
          if (finding.category === "location") tr.className = "metadata-location";
          const key = document.createElement("th"); key.scope = "row";
          key.textContent = `${finding.key}${finding.category === "location" ? " 📍" : finding.category === "credential" ? " ◈" : ""}`;
          const value = document.createElement("td"); value.textContent = `${finding.value} · ${finding.source}`;
          tr.append(key, value); $("metadataTable").appendChild(tr);
        }
        $("metadataCount").textContent = `${rows.length} field${rows.length === 1 ? "" : "s"}`;
        $("metadataFindings").hidden = false;
      }
      if (inspection.warnings.length) { $("scanWarning").textContent = inspection.warnings.join(" "); $("scanWarning").hidden = false; }
    }

    async function renderExplanation(inspection) {
      const explanation = await Tools.explainImageMetadata(inspection);
      if (items.length !== 1 || items[0].inspection !== inspection) return;
      $("metadataNarrative").textContent = explanation.narrative;
      $("metadataPrivacyImpact").textContent = explanation.privacyImpact;
      $("metadataRemovalSummary").textContent = explanation.removalSummary;
      $("metadataCertaintyNote").textContent = explanation.certaintyNote;
      $("metadataEvidence").textContent = explanation.evidence.length ? explanation.evidence.join(", ") : "No specific readable fields";
      $("metadataExplanation").hidden = false;
    }

    async function inspectItems() {
      const token = ++scanToken;
      for (const item of items) {
        if (token !== scanToken) return;
        item.status = "scanning"; renderFiles();
        try { item.inspection = await Tools.inspectImageMetadata(item.file); item.status = "ready"; }
        catch (error) { item.error = error.message || String(error); item.status = "error"; }
        renderFiles(); renderInspection();
        if (item.inspection && items.length === 1) {
          try { await renderExplanation(item.inspection); }
          catch (error) { console.warn("Metadata explanation could not be created:", error); }
        }
      }
      if (items.length === 1) scrollToToolSection("findings");
    }

    function setFiles(files, append = false) {
      const selected = Array.from(files).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
      if (!selected.length) { showNotification("Choose a genuine JPG, PNG, or WebP image.", "error"); return; }
      items = append ? [...items, ...selected.map(itemFor)] : selected.map(itemFor);
      resetResults(); renderFiles(); renderInspection(); inspectItems();
    }

    function renderReports() {
      $("reportList").replaceChildren();
      for (const { name, report } of reports) {
        const block = document.createElement("div"); block.className = "metadata-report-item";
        const title = document.createElement("strong"); title.textContent = name;
        const summary = document.createElement("p");
        summary.textContent = report.removedCount
          ? `✓ ${report.removedCount} metadata item${report.removedCount === 1 ? "" : "s"} removed · cleaned image verified`
          : "✓ No removable metadata detected · rebuilt image verified";
        block.append(title, summary);
        if (report.removedCategories?.length) {
          const categoryNames = { location: "location information", identity: "creator or owner information", device: "device details",
            time: "dates and times", software: "software history", credential: "Content Credential claims", text: "descriptions or comments",
            embedded: "embedded previews", exif: "EXIF data", xmp: "XMP data", iptc: "IPTC data", color: "color-profile data",
            container: "optional container data", trailing: "trailing data", unknown: "unknown optional data", metadata: "other metadata" };
          const removed = document.createElement("span");
          removed.textContent = `Removed and verified: ${report.removedCategories.map(category => categoryNames[category] || category).join(", ")}.`;
          block.appendChild(removed);
        }
        if (report.c2paRemoved) { const credential = document.createElement("span"); credential.textContent = "✓ Content Credential removed"; block.appendChild(credential); }
        $("reportList").appendChild(block);
      }
      $("reportSection").hidden = reports.length === 0;
    }

    async function clean() {
      if (!items.length) return;
      reports.length = 0; renderReports(); clearNotification();
      const batch = new BatchProcessor({
        items, btnId: "stripBtn", btnLabel: "Strip & verify", zipName: "clean_images.zip",
        processOne: async item => {
          const result = await Tools.stripImageMetadata(item.file, { inspection: item.inspection });
          const extension = result.before.format === "jpeg" ? "jpg" : result.before.format;
          const base = (item.name.replace(/\.[^.]+$/, "").replace(/[\\/:*?\"<>|\u0000-\u001f]/g, "_").trim() || "image").slice(0, 120);
          reports.push({ name: item.name, report: result.report }); renderReports();
          return { filename: `${base}_clean.${extension}`, data: result.blob };
        },
        onComplete: () => { renderReports(); scrollToToolSection("results"); }
      });
      await batch.run();
    }

    makeDropZone($("dropZone"), { accept: "image/", multiple: IS_PREMIUM, maxFree: 1, onFiles: files => setFiles(files) });
    $("addMoreInput").addEventListener("change", event => { setFiles(event.target.files, true); event.target.value = ""; });
    $("stripBtn").addEventListener("click", clean);
  }

  window.startStripMetadataPage = startStripMetadataPage;
})();

/* PDF conversion pages. File orchestration and selection live here; PDF and
   image transformation stays behind the Tools API. */
(function () {
  const safeBaseName = (name, fallback) => (String(name || fallback).replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || fallback).slice(0, 120);

  function parsePdfPageRange(value, pageCount) {
    if (!value.trim()) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const pages = new Set();
    for (const token of value.split(",").map(part => part.trim()).filter(Boolean)) {
      const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error(`“${token}” is not a valid page or range.`);
      const start = Number(match[1]), end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > pageCount) throw new Error(`“${token}” is outside pages 1–${pageCount}.`);
      for (let page = start; page <= end; page++) pages.add(page);
    }
    if (!pages.size) throw new Error("Select at least one page.");
    return [...pages].sort((a, b) => a - b);
  }

  function parsePdfGroups(value, pageCount) {
    const tokens = value.split(",").map(token => token.trim()).filter(Boolean);
    if (!tokens.length) throw new Error("Enter at least one page or range.");
    return tokens.map(token => {
      const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error(`“${token}” is not a valid page or range.`);
      const start = Number(match[1]), end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > pageCount) throw new Error(`“${token}” is outside pages 1–${pageCount}.`);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    });
  }

  function startPdfToImagesPage() {
    const $ = id => document.getElementById(id);
    let items = [], previewUrls = [], previewToken = 0, rangeValid = true;
    let selectedPages = new Set();
    renderToolPage({
      title: "PDF to images", category: "PDF & Documents",
      description: "Turn every page—or only the pages you choose—into a JPG, PNG, or WebP image.",
      input: { html: `<label for="fileInput">Your PDF</label><div class="drop-zone" id="dropZone">
        <input type="file" id="fileInput" accept=".pdf,application/pdf"><div class="drop-icon" aria-hidden="true">📄</div>
        <div class="drop-text"><strong>Choose a PDF</strong> or drag it here</div><div class="drop-sub">PDF files · processed locally in your browser</div></div>` },
      workspaceHtml: `<div class="pdf-file-info" id="pdfFileInfo" hidden></div>
        <section class="pdf-page-picker" id="pagePicker" data-tool-section="pages" hidden>
          <div class="pdf-picker-heading"><span id="pagePickerLabel">Page previews</span>
            <span><button type="button" id="selectAllPages">Select all</button><button type="button" id="selectNoPages">Clear</button></span></div>
          <div class="pdf-page-grid" id="pageGrid"></div>
          <label for="pageRange">Pages to export</label><input id="pageRange" type="text" placeholder="All pages, or 1-4, 6, 9-12">
          <p class="format-hint" id="pageRangeHint">Leave empty to export every page.</p>
        </section>`,
      advancedHtml: `<div class="pdf-settings"><div><label for="pdfImageFormat">Image format</label><select id="pdfImageFormat">
          <option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>
        <div><label for="pdfDpi">Resolution</label><select id="pdfDpi"><option value="150">Standard · 150 DPI</option>
          <option value="200">High · 200 DPI</option><option value="300">Print · 300 DPI</option></select></div></div>`,
      resultHtml: `<section class="progress-section" id="progressSection"><div class="progress-label"><span id="progressLabel">Rendering pages…</span><span id="progressPct">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <button class="btn-primary" id="convertBtn" disabled>Choose a PDF</button>`,
      privacyTitle: "Your PDF stays on your device.",
      privacyNote: "Pages are rendered and packaged inside your browser. The document is never uploaded to EssentialBits.",
      privacyPoints: ["Local PDF rendering", "No server upload", "One ZIP download"],
      goodToKnow: ["Each selected page becomes a separate image inside one ZIP file.",
        "JPG is usually smaller, PNG is lossless and sharp for text, and WebP balances quality and size.",
        "150 DPI is suitable for screens. Use 300 DPI when page detail or printing matters.",
        "Password-protected or damaged PDFs may need to be unlocked or repaired first."]
    });
    $("fileInput").multiple = IS_PREMIUM;

    function clearPreviews() { previewToken++; previewUrls.forEach(URL.revokeObjectURL); previewUrls = []; $("pageGrid").replaceChildren(); }
    function setButton() { $("convertBtn").disabled = !items.length; $("convertBtn").textContent = items.length ? `Convert & download — 0/${items.length}` : "Choose a PDF"; }
    function syncRangeFromSelection() {
      rangeValid = true;
      const count = items[0]?.pageCount || 0;
      if (selectedPages.size === count) $("pageRange").value = "";
      else $("pageRange").value = [...selectedPages].sort((a,b)=>a-b).join(", ");
      $("pageRangeHint").textContent = `${selectedPages.size} of ${count} pages selected.`;
    }
    function renderPageSelection() {
      $("pageGrid").querySelectorAll(".pdf-page-thumb").forEach((tile, index) => {
        tile.classList.toggle("selected", selectedPages.has(index + 1));
        tile.querySelector("input").checked = selectedPages.has(index + 1);
      });
      syncRangeFromSelection();
    }
    async function renderPagePreviews(item) {
      clearPreviews(); const token = previewToken; $("pagePicker").hidden = false;
      $("pagePickerLabel").textContent = `Page previews · ${item.pageCount} pages`;
      try {
        const rendered = await Tools.pdfToImages(item.file, { format: "image/jpeg", dpi: 24, quality: .65 });
        if (token !== previewToken) return;
        for (const page of rendered.pages) {
          const url = URL.createObjectURL(page.blob); previewUrls.push(url);
          const tile = document.createElement("label"); tile.className = "pdf-page-thumb selected";
          const image = document.createElement("img"); image.src = url; image.alt = `Page ${page.pageNumber}`;
          const footer = document.createElement("span"); footer.textContent = `Page ${page.pageNumber}`;
          const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = true;
          checkbox.addEventListener("change", () => { checkbox.checked ? selectedPages.add(page.pageNumber) : selectedPages.delete(page.pageNumber); renderPageSelection(); });
          footer.append(checkbox); tile.append(image, footer); $("pageGrid").append(tile);
        }
      } catch (error) { showNotification(`Could not render page previews: ${error.message}`, "error"); }
    }
    async function loadFiles(files) {
      clearNotification(); clearPreviews(); items = [];
      for (const file of files) {
        try { const info = await Tools.inspectPdf(file); items.push({ file, pageCount: info.pageCount }); }
        catch (error) { showNotification(`${file.name}: ${error.message}`, "error"); }
      }
      if (items.length) {
        const first = items[0]; selectedPages = new Set(Array.from({ length: first.pageCount }, (_, i) => i + 1));
        $("pdfFileInfo").textContent = `${first.file.name} · ${first.pageCount} page${first.pageCount === 1 ? "" : "s"} · ${formatBytes(first.file.size)}`;
        $("pdfFileInfo").hidden = false; setButton(); await renderPagePreviews(first); scrollToToolSection("pages");
      } else { $("pdfFileInfo").hidden = true; $("pagePicker").hidden = true; setButton(); }
    }
    async function convert() {
      if (!items.length) return;
      if (!rangeValid) { showNotification("Enter valid pages such as 1-4, 6, 9-12.", "error"); return; }
      const firstPages = [...selectedPages].sort((a, b) => a - b);
      if (!firstPages.length) { showNotification("Select at least one page to export.", "error"); return; }
      const format = $("pdfImageFormat").value, extension = format === "image/jpeg" ? "jpg" : format.slice(6);
      const dpi = Number($("pdfDpi").value);
      const batch = new BatchProcessor({ items, btnId: "convertBtn", btnLabel: "Convert", zipName: "pdf_images.zip",
        processOne: async (item, itemIndex) => {
          const pages = itemIndex === 0 ? firstPages : Array.from({ length: item.pageCount }, (_, i) => i + 1);
          const rendered = await Tools.pdfToImages(item.file, { pages, format, dpi, onProgress: (progress, detail) => {
            $("progressFill").style.width = `${Math.round(progress * 100)}%`; $("progressPct").textContent = `${Math.round(progress * 100)}%`;
            $("progressLabel").textContent = `Rendering page ${detail.completed} of ${detail.total}`;
          }});
          const base = safeBaseName(item.file.name, "document"), digits = String(item.pageCount).length;
          const zip = await Tools.createArchive(rendered.pages.map(page => ({
            filename: `${base}_page_${String(page.pageNumber).padStart(digits, "0")}.${extension}`, data: page.blob
          })));
          return { filename: `${base}_images.zip`, data: zip };
        }});
      await batch.run();
    }
    makeDropZone($("dropZone"), { accept: "application/pdf", multiple: IS_PREMIUM, maxFree: 1, onFiles: loadFiles });
    $("selectAllPages").addEventListener("click", () => { selectedPages = new Set(Array.from({length:items[0]?.pageCount||0},(_,i)=>i+1)); renderPageSelection(); });
    $("selectNoPages").addEventListener("click", () => { selectedPages.clear(); renderPageSelection(); });
    $("pageRange").addEventListener("input", () => { try { selectedPages = new Set(parsePdfPageRange($("pageRange").value, items[0].pageCount)); renderPageSelection(); }
      catch { rangeValid = false; $("pageRangeHint").textContent = "Enter valid pages such as 1-4, 6, 9-12."; } });
    $("convertBtn").addEventListener("click", convert);
    window.addEventListener("pagehide", clearPreviews);
  }

  function startImagesToPdfPage() {
    const $ = id => document.getElementById(id); let images = [], nextId = 1, lastDownload = null;
    renderToolPage({ title: "Images to PDF", category: "PDF & Documents",
      description: "Arrange images, choose how they fit each page, and combine them into one PDF.",
      input: { html: `<label for="fileInput">Your images</label><div class="drop-zone" id="dropZone"><input type="file" id="fileInput" accept="image/*" multiple>
        <div class="drop-icon" aria-hidden="true">🖼</div><div class="drop-text"><strong>Choose images</strong> or drag them here</div>
        <div class="drop-sub">JPG, PNG, WebP, and other browser-readable images</div></div>` },
      workspaceHtml: `<section class="pdf-image-list" id="imageListSection" data-tool-section="images" hidden><div class="gif-frames-header">
        <span id="imageCount">0 images</span><label class="btn-add-more">+ Add more<input id="addImagesInput" type="file" accept="image/*" multiple></label></div>
        <div class="pdf-image-grid" id="imageGrid"></div><p class="format-hint">Drag images to change the PDF page order.</p></section>`,
      advancedHtml: `<div class="pdf-settings"><div><label for="pdfPageSize">Page size</label><select id="pdfPageSize"><option value="a4">A4</option><option value="letter">Letter</option><option value="auto">Match each image</option></select></div>
        <div><label for="pdfImageFit">Image fit</label><select id="pdfImageFit"><option value="fill">Fill page · may crop</option><option value="fit">Fit whole image</option></select></div>
        <div id="pdfMarginSetting" hidden><label for="pdfMargin">Margin</label><select id="pdfMargin"><option value="0">None</option><option value="10">10 mm</option><option value="20" selected>20 mm</option><option value="30">30 mm</option></select></div>
        <div><label for="pdfQuality">Image quality</label><select id="pdfQuality"><option value="0.82">Smaller file</option><option value="0.92" selected>Balanced</option><option value="0.98">Highest</option></select></div></div>`,
      resultHtml: `<section class="progress-section" id="progressSection"><div class="progress-label"><span id="progressLabel">Building PDF…</span><span id="progressPct">0%</span></div><div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <button class="btn-primary" id="buildPdfBtn" disabled>Add images</button>`,
      privacyTitle: "Your images stay on your device.", privacyNote: "Images are normalized and assembled into a PDF inside your browser.",
      privacyPoints: ["Processed locally", "No server upload", "No account needed"],
      goodToKnow: ["Drag thumbnails to control the page order.", "Fill page removes empty space but can crop image edges. Fit whole image preserves every part of the image.",
        "Match each image creates a page with the image's own aspect ratio.", "Large images are reduced to a practical PDF resolution to control memory and file size."] });

    function resetOutput() { if (lastDownload) URL.revokeObjectURL(lastDownload.url); lastDownload = null; $("progressSection").classList.remove("show"); }
    function resetButton() { $("buildPdfBtn").disabled = !images.length; $("buildPdfBtn").textContent = images.length ? "Build & download PDF" : "Add images"; $("buildPdfBtn").classList.remove("btn-done"); }
    function renderImages() {
      $("imageGrid").replaceChildren();
      images.forEach((item, index) => {
        const tile = document.createElement("div"); tile.className = "pdf-image-thumb"; tile.dataset.index = index;
        const image = document.createElement("img"); image.src = item.url; image.alt = "";
        const footer = document.createElement("span"); footer.textContent = `Page ${index + 1}`;
        const remove = document.createElement("button"); remove.type="button"; remove.textContent="×"; remove.setAttribute("aria-label",`Remove ${item.file.name}`);
        remove.addEventListener("click", event => { event.stopPropagation(); URL.revokeObjectURL(item.url); images.splice(index,1); resetOutput(); renderImages(); });
        footer.append(remove); tile.append(image,footer); $("imageGrid").append(tile);
      });
      $("imageListSection").hidden = !images.length; $("imageCount").textContent = `${images.length} image${images.length===1?"":"s"}`;
      makeDraggable($("imageGrid"), images, reordered => { images = reordered; resetOutput(); renderImages(); }); resetButton();
    }
    function addImages(files, replace=false) {
      const selected=Array.from(files).filter(file=>!file.type||file.type.startsWith("image/")); if(!selected.length)return;
      if(replace){images.forEach(item=>URL.revokeObjectURL(item.url));images=[];}
      images.push(...selected.map(file=>({id:nextId++,file,url:URL.createObjectURL(file)}))); resetOutput(); renderImages(); scrollToToolSection("images");
    }
    async function buildPdf() {
      if(!images.length)return; clearNotification(); btnLoading("buildPdfBtn","Building PDF…"); $("progressSection").classList.add("show");
      try {
        const blob=await Tools.imagesToPdf(images.map(item=>item.file),{pageSize:$("pdfPageSize").value,fit:$("pdfImageFit").value,
          marginMm:Number($("pdfMargin").value),quality:Number($("pdfQuality").value),onProgress:(progress,detail)=>{
            const percent=Math.round(progress*100); $("progressFill").style.width=`${percent}%`; $("progressPct").textContent=`${percent}%`; $("progressLabel").textContent=`Adding page ${detail.completed} of ${detail.total}`;
          }});
        const url=URL.createObjectURL(blob); lastDownload={url,filename:"images.pdf"}; await triggerDownload(url,"images.pdf");
        $("progressLabel").textContent="Done!"; $("buildPdfBtn").disabled=false; $("buildPdfBtn").textContent="✓ Done — click to download again"; $("buildPdfBtn").classList.add("btn-done");
      } catch(error){showNotification(error.message||"Could not build the PDF.","error");resetButton();}
    }
    makeDropZone($("dropZone"),{accept:"image/",multiple:true,maxFree:Infinity,onFiles:files=>addImages(files,true)});
    $("addImagesInput").addEventListener("change",event=>{addImages(event.target.files);event.target.value="";});
    $("pdfImageFit").addEventListener("change",()=>{$("pdfMarginSetting").hidden=$("pdfImageFit").value!=="fit";resetOutput();resetButton();});
    ["pdfPageSize","pdfMargin","pdfQuality"].forEach(id=>$(id).addEventListener("change",()=>{resetOutput();resetButton();}));
    $("buildPdfBtn").addEventListener("click",()=>lastDownload?triggerDownload(lastDownload.url,lastDownload.filename):buildPdf());
    window.addEventListener("pagehide",()=>{images.forEach(item=>URL.revokeObjectURL(item.url));resetOutput();});
  }

  function startMergePdfPage() {
    const $ = id => document.getElementById(id); let files = [], lastDownload = null;
    renderToolPage({ title: "Merge PDFs", category: "PDF & Documents",
      description: "Combine complete PDF files in the exact order you choose.",
      input: { html: `<label for="fileInput">Your PDF files</label><div class="drop-zone" id="dropZone"><input type="file" id="fileInput" accept=".pdf,application/pdf" multiple>
        <div class="drop-icon" aria-hidden="true">📄</div><div class="drop-text"><strong>Choose PDFs</strong> or drag them here</div>
        <div class="drop-sub">Select two or more PDF files</div></div>` },
      workspaceHtml: `<section class="files-section" id="mergeFilesSection" data-tool-section="files"><div class="files-header"><span class="files-count" id="mergeFilesCount">0 files</span>
        <label class="btn-add-more">+ Add more<input id="addMergeFiles" type="file" accept=".pdf,application/pdf" multiple></label></div>
        <div class="file-list" id="mergeFileList"></div><p class="format-hint">Drag files to change their order.</p></section>`,
      resultHtml: `<section class="progress-section" id="progressSection"><div class="progress-label"><span id="progressLabel">Merging PDFs…</span><span id="progressPct">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section><button class="btn-primary" id="mergeBtn" disabled>Add at least two PDFs</button>`,
      privacyTitle: "Your PDFs stay on your device.", privacyNote: "The documents are read and combined inside your browser without being uploaded.",
      privacyPoints: ["Processed locally", "No server upload", "Original page quality"],
      goodToKnow: ["Drag files to set the order of the merged document.", "Pages are copied directly, so they are not turned into images or recompressed.",
        "Password-protected PDFs must be unlocked before they can be merged.", "Bookmarks and complex document-level forms may not carry across exactly."] });
    function clearOutput(){if(lastDownload)URL.revokeObjectURL(lastDownload.url);lastDownload=null;$("progressSection").classList.remove("show");}
    function render(){$("mergeFileList").replaceChildren();files.forEach((item,index)=>{const row=document.createElement("div");row.className="file-item";row.dataset.index=index;
      const handle=document.createElement("span");handle.className="file-drag-handle";handle.textContent="⠿";const icon=document.createElement("span");icon.className="file-icon";icon.textContent="📄";
      const info=document.createElement("div");info.className="file-info";const name=document.createElement("div");name.className="file-name";name.textContent=item.file.name;
      const meta=document.createElement("div");meta.className="file-meta";meta.textContent=`${item.pageCount} page${item.pageCount===1?"":"s"} · ${formatBytes(item.file.size)}`;info.append(name,meta);
      const remove=document.createElement("button");remove.type="button";remove.className="file-remove";remove.textContent="×";remove.setAttribute("aria-label",`Remove ${item.file.name}`);
      remove.addEventListener("click",()=>{files.splice(index,1);clearOutput();render();});row.append(handle,icon,info,remove);$("mergeFileList").append(row);});
      $("mergeFilesSection").classList.toggle("show",files.length>0);$("mergeFilesCount").textContent=`${files.length} file${files.length===1?"":"s"}`;
      $("mergeBtn").disabled=files.length<2;$("mergeBtn").textContent=files.length<2?"Add at least two PDFs":"Merge & download";$("mergeBtn").classList.remove("btn-done");
      makeDraggable($("mergeFileList"),files,reordered=>{files=reordered;clearOutput();render();});}
    async function addFiles(input,replace=false){const selected=Array.from(input).filter(file=>file.type==="application/pdf"||/\.pdf$/i.test(file.name));if(replace)files=[];clearOutput();
      for(const file of selected){try{const info=await Tools.inspectPdf(file);files.push({file,pageCount:info.pageCount});}catch(error){showNotification(`${file.name}: ${error.message}`,"error");}}render();if(files.length)scrollToToolSection("files");}
    async function merge(){if(files.length<2)return;if(lastDownload){await triggerDownload(lastDownload.url,lastDownload.filename);return;}clearNotification();btnLoading("mergeBtn","Merging PDFs…");$("progressSection").classList.add("show");
      try{const blob=await Tools.mergePdfs(files.map(item=>item.file),{onProgress:(progress,detail)=>{const percent=Math.round(progress*90);$("progressFill").style.width=`${percent}%`;$("progressPct").textContent=`${percent}%`;$("progressLabel").textContent=`Merging file ${detail.completed} of ${detail.total}`;}});
        $("progressFill").style.width="100%";$("progressPct").textContent="100%";$("progressLabel").textContent="Done!";lastDownload={url:URL.createObjectURL(blob),filename:"merged.pdf"};await triggerDownload(lastDownload.url,lastDownload.filename);
        $("mergeBtn").disabled=false;$("mergeBtn").textContent="✓ Done — click to download again";$("mergeBtn").classList.add("btn-done");}
      catch(error){showNotification(error.message||"Could not merge these PDFs.","error");render();}}
    makeDropZone($("dropZone"),{accept:"application/pdf",multiple:true,maxFree:Infinity,onFiles:selected=>addFiles(selected,true)});
    $("addMergeFiles").addEventListener("change",event=>{addFiles(event.target.files);event.target.value="";});$("mergeBtn").addEventListener("click",merge);
    window.addEventListener("pagehide",clearOutput);
  }

  function startSplitPdfPage() {
    const $=id=>document.getElementById(id);let files=[],mode="all";
    renderToolPage({title:"Split PDF",category:"PDF & Documents",description:"Save every page separately or create specific page groups.",
      input:{html:`<label for="fileInput">Your PDF</label><div class="drop-zone" id="dropZone"><input type="file" id="fileInput" accept=".pdf,application/pdf"><div class="drop-icon" aria-hidden="true">📄</div>
        <div class="drop-text"><strong>Choose a PDF</strong> or drag it here</div><div class="drop-sub">Split one PDF at a time</div></div>`},
      workspaceHtml:`<section class="files-section" id="splitFilesSection" data-tool-section="files"><div class="files-header"><span class="files-count" id="splitFilesCount">0 PDFs</span>
        <label class="btn-add-more" id="addSplitLabel" hidden>+ Add more<input id="addSplitFiles" type="file" accept=".pdf,application/pdf" multiple></label></div><div class="file-list" id="splitFileList"></div></section>`,
      advancedHtml:`<label>Split mode</label><div class="mode-tabs"><button type="button" class="mode-tab active" data-mode="all">Every page</button><button type="button" class="mode-tab" data-mode="ranges">Custom groups</button></div>
        <p class="format-hint" id="splitModeHint">Each page becomes its own PDF.</p>`,
      resultHtml:`<section class="progress-section" id="progressSection"><div class="progress-label"><span id="progressLabel">Splitting PDF…</span><span id="progressPct">0%</span></div><div class="progress-track"><div class="progress-fill" id="progressFill"></div></div></section>
        <div class="metadata-message metadata-clear" id="splitResult" hidden></div><button class="btn-primary" id="splitBtn" disabled>Choose a PDF</button>`,
      privacyTitle:"Your PDF stays on your device.",privacyNote:"Pages are copied into new PDF files and packaged locally in your browser.",privacyPoints:["Processed locally","No server upload","Original page quality"],
      goodToKnow:["Every page creates one PDF file when using Every page mode.","Custom groups such as 1-4, 5-6, 9 create three output PDFs and omit unlisted pages.",
        "Pages are copied directly without image conversion or quality loss.","Password-protected PDFs must be unlocked first."]});
    $("fileInput").multiple=IS_PREMIUM;$("addSplitLabel").hidden=!IS_PREMIUM;
    function clearPreviousSplit(){const button=$("splitBtn");if(button?._redownloadHandler){button.removeEventListener("click",button._redownloadHandler);button._redownloadHandler=null;}if(window._lastDownload){URL.revokeObjectURL(window._lastDownload.url);window._lastDownload=null;}$("progressSection").classList.remove("show");}
    function render(){clearPreviousSplit();$("splitFileList").replaceChildren();files.forEach((item,index)=>{const row=document.createElement("div");row.className="file-item";
      const icon=document.createElement("span");icon.className="file-icon";icon.textContent="📄";const info=document.createElement("div");info.className="file-info";
      const name=document.createElement("div");name.className="file-name";name.textContent=item.file.name;const meta=document.createElement("div");meta.className="file-meta";meta.textContent=`${item.pageCount} pages · ${formatBytes(item.file.size)}`;info.append(name,meta);
      const remove=document.createElement("button");remove.type="button";remove.className="file-remove";remove.textContent="×";remove.setAttribute("aria-label",`Remove ${item.file.name}`);remove.addEventListener("click",()=>{files.splice(index,1);render();});row.append(icon,info,remove);$("splitFileList").append(row);
      if(mode==="ranges"){const wrap=document.createElement("div");wrap.className="split-range-row";const input=document.createElement("input");input.type="text";input.placeholder=`e.g. 1-4, 5-6, ${item.pageCount}`;input.value=item.range||"";input.addEventListener("input",()=>item.range=input.value);wrap.append(input);$("splitFileList").append(wrap);}});
      $("splitFilesSection").classList.toggle("show",files.length>0);$("splitFilesCount").textContent=`${files.length} PDF${files.length===1?"":"s"}`;$("splitBtn").disabled=!files.length;$("splitBtn").textContent=files.length?`Split & download — 0/${files.length}`:"Choose a PDF";$("splitBtn").classList.remove("btn-done");$("splitResult").hidden=true;}
    async function loadFiles(input,append=false){const chosen=Array.from(input).filter(file=>file.type==="application/pdf"||/\.pdf$/i.test(file.name));if(!append)files=[];
      for(const file of chosen){try{const info=await Tools.inspectPdf(file);files.push({file,pageCount:info.pageCount,range:""});}catch(error){showNotification(`${file.name}: ${error.message}`,"error");}}render();if(files.length)scrollToToolSection("files");}
    async function split(){if(!files.length)return;clearNotification();const batch=new BatchProcessor({items:files,btnId:"splitBtn",btnLabel:"Split",zipName:"split_pdfs.zip",processOne:async(item)=>{
        let ranges;try{ranges=mode==="ranges"?parsePdfGroups(item.range,item.pageCount):undefined;}catch(error){throw new Error(`${item.file.name}: ${error.message}`);}
        const result=await Tools.splitPdf(item.file,{ranges,onProgress:(progress,detail)=>{const percent=Math.round(progress*100);$("progressFill").style.width=`${percent}%`;$("progressPct").textContent=`${percent}%`;$("progressLabel").textContent=`Creating file ${detail.completed} of ${detail.total}`;}});
        const base=safeBaseName(item.file.name,"document"),digits=String(item.pageCount).length;const archive=await Tools.createArchive(result.outputs.map(output=>{const first=output.pages[0],last=output.pages.at(-1);
          return{filename:first===last?`${base}_page_${String(first).padStart(digits,"0")}.pdf`:`${base}_pages_${first}-${last}.pdf`,data:output.blob};}));return{filename:`${base}_split.zip`,data:archive};},
        onComplete:results=>{$("splitResult").textContent=`✓ Successfully split ${results.length} PDF${results.length===1?"":"s"}.`;$("splitResult").hidden=false;}});await batch.run();}
    makeDropZone($("dropZone"),{accept:"application/pdf",multiple:IS_PREMIUM,maxFree:1,onFiles:selected=>loadFiles(selected)});$("addSplitFiles").addEventListener("change",event=>{loadFiles(event.target.files,true);event.target.value="";});
    document.querySelectorAll(".mode-tab[data-mode]").forEach(button=>button.addEventListener("click",()=>{mode=button.dataset.mode;document.querySelectorAll(".mode-tab[data-mode]").forEach(tab=>tab.classList.toggle("active",tab===button));
      $("splitModeHint").textContent=mode==="all"?"Each page becomes its own PDF.":"Each comma-separated page or range becomes one PDF; unlisted pages are omitted.";render();}));$("splitBtn").addEventListener("click",split);
  }

  window.startPdfToImagesPage = startPdfToImagesPage;
  window.startImagesToPdfPage = startImagesToPdfPage;
  window.startMergePdfPage = startMergePdfPage;
  window.startSplitPdfPage = startSplitPdfPage;
})();

/* Resize Image controls. Shared file handling and downloads live in tool-page.js. */
(function () {
  function startResizeImagePage() {
    let original = null;
    let mode = "pixels";
    let fileVersion = 0;
    const $ = id => document.getElementById(id);
    function targetDimensions(options) {
      if (options.percent == null) return options;
      return {
        width: Math.round(original.width * options.percent / 100),
        height: Math.round(original.height * options.percent / 100)
      };
    }
    function updateHints() {
      if (!original) { $("pctResult").textContent = ""; $("upscaleWarn").hidden = true; return; }
      const dims = targetDimensions(mode === "percent"
        ? { percent: Number($("pctVal").value) }
        : { width: Number($("newW").value), height: Number($("newH").value) });
      $("pctResult").textContent = mode === "percent" && Number($("pctVal").value) > 0
        ? `Result: ${dims.width} × ${dims.height} px` : "";
      $("upscaleWarn").hidden = dims.width <= original.width && dims.height <= original.height;
    }

    createFileConverterPage({
      page: {
        title: "Resize image", category: "Images",
        description: "Scale an image by exact pixels or percentage, keeping its format when possible.",
        privacyTitle: "Your image stays on your device.",
        privacyNote: "Resizing runs in your browser. Your image is never uploaded to our server.",
        privacyPoints: ["Processed on your device", "No account needed", "No server upload"],
        goodToKnow: [
          "Upscaling can make an image look blurry because it does not add new detail.",
          "Lock aspect ratio to keep the original shape when changing one dimension.",
          "JPG, PNG, and WebP keep their format. Other browser-readable images save as PNG.",
          "JPG and WebP use gentle size optimization when the first export grows. PNG tries lossless optimization. Some resized files can still be larger.",
          "PNG and WebP preserve transparency. JPG fills transparent areas with white."
        ]
      },
      input: { label: "Your image", icon: "🖼", hint: "Any image format your browser supports" },
      accept: "image/*", acceptPrefix: "image/", fileLabel: "image",
      preview: "image", previewLabel: "Resized", buttonVerb: "Resize", progressVerb: "Resizing",
      scrollAfterUpload: "settings", batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple images at once", zipName: "resized_images.zip",
      convert: Tools.resizeImage,
      resolveFormat: Tools.imageFormatForFile,
      settingsPosition: "workspace",
      settingsHtml: `
        <div class="image-original-info" id="originalInfo" hidden></div>
        <label>Resize method</label>
        <div class="mode-tabs" role="group" aria-label="Resize method">
          <button type="button" class="mode-tab active" id="pixelMode">Exact pixels</button>
          <button type="button" class="mode-tab" id="percentMode">Percentage</button>
        </div>
        <div class="resize-dimensions" id="pixelInputs">
          <div><label for="newW">Width</label><input type="number" id="newW" min="1" max="16384" placeholder="e.g. 1920"></div>
          <span aria-hidden="true">×</span>
          <div><label for="newH">Height</label><input type="number" id="newH" min="1" max="16384" placeholder="e.g. 1080"></div>
        </div>
        <label class="resize-lock" id="lockRow"><input type="checkbox" id="lockAspect" checked> Lock aspect ratio</label>
        <div id="percentInputs" hidden><label for="pctVal">Scale percentage</label>
          <div class="resize-percent"><input type="number" id="pctVal" min="1" max="1000" value="50"><span>%</span></div>
          <div class="resize-result" id="pctResult"></div>
        </div>
        <div class="resize-upscale" id="upscaleWarn" hidden>Upscaling may look blurry or pixelated.</div>`,
      readOptions: () => mode === "percent"
        ? { percent: Number($("pctVal").value) }
        : { width: Number($("newW").value), height: Number($("newH").value) },
      previewReady: options => options.percent != null
        ? options.percent > 0 && options.percent <= 1000
        : Number.isInteger(options.width) && Number.isInteger(options.height) &&
          options.width > 0 && options.height > 0 && options.width <= 16384 && options.height <= 16384,
      onFilesChanged: async file => {
        const version = ++fileVersion;
        const dimensions = file ? await Tools.imageDimensions(file) : null;
        if (version !== fileVersion) return;
        original = dimensions;
        $("originalInfo").hidden = !file;
        if (!file) return;
        const output = Tools.imageFormatForFile(file);
        const outputNote = output.mime === file.type ? "Keeps original format" : `Saves as ${output.extension.toUpperCase()}`;
        $("originalInfo").textContent = `${file.name} · ${original.width} × ${original.height} px · ${formatBytes(file.size)} · ${outputNote}`;
        $("newW").value = original.width;
        $("newH").value = original.height;
        updateHints();
      },
      onPreview: ({ options }) => {
        if (!original) return;
        const dims = targetDimensions(options);
        $("upscaleWarn").hidden = dims.width <= original.width && dims.height <= original.height;
      },
      filename: async (file, options, format) => {
        const source = await Tools.imageDimensions(file);
        const dims = options.percent == null ? options : {
          width: Math.round(source.width * options.percent / 100),
          height: Math.round(source.height * options.percent / 100)
        };
        return `${file.name.replace(/\.[^.]+$/, "")}_${dims.width}x${dims.height}.${format.extension}`;
      },
      setupSettings: ({ refreshPreview, resetConversion }) => {
        function changed() { resetConversion(); updateHints(); refreshPreview(); }
        function setMode(next) {
          mode = next;
          $("pixelMode").classList.toggle("active", mode === "pixels");
          $("percentMode").classList.toggle("active", mode === "percent");
          $("pixelInputs").hidden = $("lockRow").hidden = mode !== "pixels";
          $("percentInputs").hidden = mode !== "percent";
          changed();
        }
        $("pixelMode").addEventListener("click", () => setMode("pixels"));
        $("percentMode").addEventListener("click", () => setMode("percent"));
        $("newW").addEventListener("input", () => {
          if (original && $("lockAspect").checked) {
            $("newH").value = Math.round(Number($("newW").value) * original.height / original.width) || "";
          }
          changed();
        });
        $("newH").addEventListener("input", () => {
          if (original && $("lockAspect").checked) {
            $("newW").value = Math.round(Number($("newH").value) * original.width / original.height) || "";
          }
          changed();
        });
        $("lockAspect").addEventListener("change", () => {
          if (original && $("lockAspect").checked) {
            $("newH").value = Math.round(Number($("newW").value) * original.height / original.width);
          }
          changed();
        });
        $("pctVal").addEventListener("input", changed);
      }
    });
  }

  window.startResizeImagePage = startResizeImagePage;
})();

/* Compress Image controls. Encoding and target search live in Tools.compressImage. */
(function () {
  function startCompressImagePage() {
    const $ = id => document.getElementById(id);
    let mode = "quality";
    let currentFile = null;
    let debounce = null;

    function outputFormat(file, options) {
      const mime = options.format === "original"
        ? (["image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg")
        : options.format;
      return { mime, extension: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime] };
    }
    function updateNotice() {
      const selected = $("formatSelect").value;
      const unchangedPng = currentFile?.type === "image/png" && selected === "original";
      const png = unchangedPng || selected === "image/png";
      $("pngNotice").hidden = !png;
      if (png) $("pngNotice").textContent = unchangedPng
        ? "This PNG is already losslessly compressed. Choose JPG or WebP above to make a smaller file."
        : "PNG output is lossless, so the quality and target-size controls do not apply. Choose JPG or WebP to reduce file size.";
      $("compressionControls").hidden = png;
      $("targetResult").hidden = true;
    }

    createFileConverterPage({
      page: {
        title: "Compress image", category: "Images",
        description: "Reduce an image's file size with a quality setting or target size. Preview before downloading.",
        privacyTitle: "Your image stays on your device.",
        privacyNote: "Compression runs in your browser. Your image is never uploaded to our server.",
        privacyPoints: ["Processed on your device", "No account needed", "No server upload"],
        goodToKnow: [
          "JPG and WebP quality settings trade some image detail for a smaller file.",
          "PNG is lossless. Choose JPG or WebP output if a PNG needs to be smaller.",
          "Target size is best effort. Some images cannot reach a very small target without resizing."
        ]
      },
      input: { label: "Your image", icon: "🖼", hint: "Any image format your browser supports" },
      accept: "image/*", acceptPrefix: "image/", fileLabel: "image",
      preview: "image", previewLabel: "Compressed", buttonVerb: "Compress", progressVerb: "Compressing",
      scrollAfterUpload: "format", batchAllowed: IS_PREMIUM,
      batchHint: "Drop multiple images at once", zipName: "compressed_images.zip",
      convert: (file, options) => Tools.compressImage(file, {
        format: options.format === "original" ? undefined : options.format,
        quality: options.quality, targetBytes: options.targetBytes
      }),
      formatLabel: "Save as",
      formats: [{ label: "Output format", options: [
        { mime: "original", label: "Automatic · JPG/PNG/WebP", extension: "", hint: "Keep JPG, PNG, or WebP. Other browser-supported images save as JPG." },
        { mime: "image/jpeg", label: "JPG", extension: "jpg", hint: "Good for photos. Transparency becomes white." },
        { mime: "image/webp", label: "WebP", extension: "webp", hint: "Often smaller and keeps transparency." },
        { mime: "image/png", label: "PNG", extension: "png", hint: "Lossless output. It may be larger than JPG or WebP." }
      ] }],
      settingsHtml: `
        <div class="compress-png-notice" id="pngNotice" hidden>
          <strong>This PNG is already losslessly compressed.</strong>
          To make it smaller, choose JPG or WebP above. JPG removes transparency; WebP can keep it.
        </div>
        <div id="compressionControls">
          <label>Compression mode</label>
          <div class="mode-tabs" role="group" aria-label="Compression mode">
            <button type="button" class="mode-tab active" id="qualityMode">By quality</button>
            <button type="button" class="mode-tab" id="targetMode">By target size</button>
          </div>
          <div id="qualitySettings"><div class="quality-header">
            <label for="compressQuality" style="margin:0">Quality</label>
            <div class="quality-value" id="compressQualityVal">82%</div></div>
            <input type="range" id="compressQuality" min="10" max="95" value="82">
            <div class="slider-hints"><span>Smaller file</span><span>Better quality</span></div>
          </div>
          <div id="targetSettings" hidden><label for="targetKB">Target file size</label>
            <div class="compress-target"><input type="number" id="targetKB" min="1" value="200"><span>KB</span></div>
            <p class="format-hint">The closest result may still be larger than the target.</p>
          </div>
        </div>
        <div class="compress-target-result" id="targetResult" hidden></div>`,
      readOptions: () => ({
        quality: Number($("compressQuality").value) / 100,
        targetBytes: mode === "target" ? Math.round(Number($("targetKB").value) * 1024) : undefined
      }),
      previewReady: options => mode !== "target" || options.targetBytes > 0,
      resolveFormat: outputFormat,
      filename: (file, options) => `${file.name.replace(/\.[^.]+$/, "")}_compressed.${outputFormat(file, options).extension}`,
      onFilesChanged: file => { currentFile = file; updateNotice(); },
      onFormatChanged: () => updateNotice(),
      onPreview: ({ file, blob, options }) => {
        if (mode !== "target" || !options.targetBytes || outputFormat(file, options).mime === "image/png") {
          $("targetResult").hidden = true;
          return;
        }
        $("targetResult").hidden = blob.size <= options.targetBytes;
        $("targetResult").textContent = `Best effort: ${formatBytes(blob.size)}. This image cannot reach ${formatBytes(options.targetBytes)} at the tested quality range.`;
      },
      setupSettings: ({ refreshPreview, resetConversion }) => {
        function refresh() { resetConversion(); refreshPreview(); }
        function setMode(next) {
          mode = next;
          $("qualityMode").classList.toggle("active", mode === "quality");
          $("targetMode").classList.toggle("active", mode === "target");
          $("qualitySettings").hidden = mode !== "quality";
          $("targetSettings").hidden = mode !== "target";
          refresh();
        }
        $("qualityMode").addEventListener("click", () => setMode("quality"));
        $("targetMode").addEventListener("click", () => setMode("target"));
        $("compressQuality").addEventListener("input", () => {
          $("compressQualityVal").textContent = `${$("compressQuality").value}%`;
          clearTimeout(debounce); debounce = setTimeout(refresh, 120);
        });
        $("targetKB").addEventListener("input", () => {
          clearTimeout(debounce); debounce = setTimeout(refresh, 300);
        });
      }
    });
  }

  window.startCompressImagePage = startCompressImagePage;
})();
