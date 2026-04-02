/* ============================================================
   EssentialBits — shared.js
   Injects common nav + footer, and provides shared utility
   functions used across all tool pages.
   ============================================================ */

/* ── PREMIUM FLAG ──
   Set to true to unlock all premium features for testing.
   When real accounts exist, replace with: checkUserSubscription()
*/
const IS_PREMIUM = false;

/* ── GOOGLE ANALYTICS ── */
(function() {
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-HCWW0GG3Q6";
  document.head.appendChild(gaScript);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HCWW0GG3Q6');
})();

/* ── NAV & FOOTER INJECTION ── */

(function () {
  // Determine the path prefix based on where the page lives.
  // Tool pages are in /tools/ so need "../" to reach root.
  // Index page is at root so needs no prefix.
  const isToolPage = window.location.pathname.includes("/tools/");
  const root = isToolPage ? "../" : "";

  // NAV
  const nav = document.getElementById("shared-nav");
  if (nav) {
    nav.innerHTML = `
      <a href="https://essentialbits.pro/" class="nav-logo">Essential<em>Bits</em></a>
      <div class="nav-center">
        ${isToolPage
          ? `<a href="https://essentialbits.pro/" class="nav-back">← All tools</a>`
          : `<ul class="nav-links"><li><a href="#video">Video</a></li><li><a href="#image">Images</a></li><li><a href="#audio">Audio</a></li><li><a href="#pdf">PDF</a></li><li><a href="#productivity">Productivity</a></li></ul>`
        }
      </div>
      <div class="nav-right">
        <a href="${root}changelog.html" class="nav-changelog">Changelog</a>
        <a href="${root}premium.html" class="nav-premium">✦ Premium</a>
        <div class="nav-badge">Zero pop-ups, ever</div>
      </div>
    `;
  }

  // FOOTER
  const footer = document.getElementById("shared-footer");
  if (footer) {
    footer.innerHTML = `
      <div>
        <div class="footer-logo">Essential<em>Bits</em></div>
        <div class="footer-tagline">Free tools. No pop-ups. Ever.</div>
        <div style="font-size:0.7rem;color:var(--faint);margin-top:4px;">© ${new Date().getFullYear()} EssentialBits. All rights reserved.</div>
      </div>
      <div class="footer-right">
        Questions, suggestions, or ideas? Contact us at:<br>
        <a href="mailto:hello@essentialbits.pro">hello@essentialbits.pro</a><br>
        <a href="${root}privacy-policy.html" style="font-size:0.72rem;color:var(--faint);">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="${root}changelog.html" style="font-size:0.72rem;color:var(--faint);">Changelog</a>
      </div>
    `;
  }
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
          <div class="info-panel-text">There are no pop-ups here — just simple banner ads. If you find this useful, please consider whitelisting us in your ad blocker. It genuinely helps.</div>
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
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
   - ZIP bundling (via JSZip — must be loaded on the page)
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
      const zip = new JSZip();
      for (const { filename, data } of results) {
        zip.file(filename, data);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
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

  // Inject premium upsell note after drop zone (only for limited free tier tools)
  let upsellNote = null;
  if (!IS_PREMIUM && maxFree !== Infinity) {
    upsellNote = document.createElement("div");
    upsellNote.style.cssText = "display:none; text-align:center; font-size:0.75rem; color:var(--faint); margin-top:8px; margin-bottom:4px;";
    upsellNote.innerHTML = `Need to process multiple files? <span style="color:var(--premium); font-weight:500;">✦ Premium</span> lets you batch process them all at once.`;
    zoneEl.insertAdjacentElement("afterend", upsellNote);
  }

  function filterFiles(fileList) {
    let files = Array.from(fileList);

    // Filter by type
    if (accept) {
      files = files.filter(f => f.type.startsWith(accept) || f.name.endsWith(`.${accept.split("/")[1]}`));
    }

    // Apply free tier limit
    if (!IS_PREMIUM && maxFree !== Infinity && files.length > maxFree) {
      const trimmed = files.length - maxFree;
      files = files.slice(0, maxFree);
      if (trimmed > 0) {
        showNotification(
          `Free tier processes ${maxFree} file${maxFree !== 1 ? "s" : ""} at a time — ${trimmed} file${trimmed !== 1 ? "s were" : " was"} skipped. ✦ Upgrade to Premium to process multiple files at once.`,
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
      if (upsellNote) upsellNote.style.display = "block";
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
        if (upsellNote) upsellNote.style.display = "block";
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
  if (!window.location.pathname.includes("/tools/")) return;

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


/* ── SHARED FFMPEG LOADER ──
   Centralised FFmpeg initialisation used by all tool pages.
   Handles iOS (single-thread core, no SharedArrayBuffer needed)
   vs everything else (multi-thread core) automatically.

   Usage in any tool page:
     - Remove the tool's own loadFFmpeg(), loadScript(), ffmpeg var, ffmpegReady var
     - Call window.loadFFmpeg() on DOMContentLoaded
     - Access window.ffmpeg and window.ffmpegReady as before

   The status banner element must exist in the page:
     <div class="ffmpeg-status" id="ffmpegStatus">
       <div class="spinner"></div>
       <span id="ffmpegStatusText">Loading FFmpeg (~20MB, once per session)...</span>
     </div>

   The progress bar elements are optional — if present they will be updated:
     id="progressFill"  (width %)
     id="progressPct"   (text)
*/

window.ffmpeg      = null;
window.ffmpegReady = false;

window.loadScript = function(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
};

window.loadFFmpeg = async function() {
  if (window.ffmpegReady) return;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // On non-iOS, SharedArrayBuffer is required — show error if missing
  if (!isIOS && typeof SharedArrayBuffer === "undefined") {
    const status = document.getElementById("ffmpegStatus");
    const text   = document.getElementById("ffmpegStatusText");
    if (status) status.classList.add("show");
    if (text)   text.textContent = "⚠️ Your browser does not support the required features. Please try Chrome or Firefox.";
    return;
  }

  const status = document.getElementById("ffmpegStatus");
  const text   = document.getElementById("ffmpegStatusText");
  if (status) status.classList.add("show");

  try {
    await window.loadScript("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js");
    const { createFFmpeg, fetchFile } = FFmpeg;
    window._fetchFile = async function(fileOrUrl) {
      // Capture the original File's extension/type before converting to Uint8Array
      if (fileOrUrl && fileOrUrl instanceof File) {
        var ext = fileOrUrl.name.split(".").pop().toLowerCase();
        if (ext) window._mbNextInputExt = ext;
      }
      return fetchFile(fileOrUrl);
    };

    const opts = {
      log: false
    };

    if (isIOS) {
      // Single-thread core — no SharedArrayBuffer needed, works on iOS Safari
      opts.corePath = "https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js";
      opts.mainName = "main";
    } else {
      opts.corePath = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js";
    }

    window.ffmpeg = createFFmpeg(opts);
    await window.ffmpeg.load();
    window.ffmpegReady = true;
    if (status) status.classList.remove("show");

    // core-st (iOS) throws "exit(0)" after each successful run — the output
    // is already written to the FS at that point. We swallow it and mark
    // ffmpeg as needing reload, which happens lazily on the next run() call.
    if (isIOS) {
      const originalRun = window.ffmpeg.run.bind(window.ffmpeg);
      window.ffmpeg.run = async (...args) => {
        // If previous run caused exit(0), reload now before proceeding
        if (!window.ffmpegReady) {
          await window.loadFFmpeg();
        }
        try {
          return await originalRun(...args);
        } catch(e) {
          if (e && e.message && e.message.includes("exit(0)")) {
            // Mark as needing reload for next call — don't reload yet
            window.ffmpegReady = false;
            return;
          }
          throw e;
        }
      };
    }
  } catch(e) {
    if (text) text.textContent = "⚠️ Failed to load FFmpeg: " + e.message + ". Please refresh and try again.";
  }
};


/* ── MEDIABUNNY ROUTER ──
   Intercepts window.ffmpeg.FS and window.ffmpeg.run after FFmpeg loads.
   Tries to handle the operation with Mediabunny (fast, hardware-accelerated).
   Falls back to real FFmpeg silently on any failure.

   Supported operations (auto-detected from FFmpeg args):
     - trim:          -ss X -to Y -c copy
     - removeAudio:   -an -c:v copy
     - extractAudio:  -vn -codec:a ...
     - convertAudio:  -codec:a libmp3lame / pcm_s16le
     - convertVideo:  -c:v libx264 / libvpx-vp9 (MP4, MOV, WebM, MKV output)

   AVI output and video-to-gif are always handled by FFmpeg.

   No tool files need to change — this hooks into the shared ffmpeg object.
*/

(function() {

  // ── CONSTANTS ──
  var MB_CDN      = "https://cdn.jsdelivr.net/npm/mediabunny@1.34.5/+esm";
  var MB_MP3_CDN  = "https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@1.35.1/+esm";

  // Formats Mediabunny can read as input (AVI not supported)
  var MB_INPUT_FORMATS = ["mp4","mov","m4v","mkv","webm","mp3","wav","aac","flac","ogg","ts"];

  // Output extension → Mediabunny output format constructor name
  var MB_OUTPUT_FORMAT = {
    "mp4":  "Mp4OutputFormat",
    "mov":  "MovOutputFormat",
    "mkv":  "MatroskaOutputFormat",
    "webm": "WebMOutputFormat",
    "mp3":  "Mp3OutputFormat",
    "wav":  "WavOutputFormat",
    "aac":  "AdtsOutputFormat",
    "flac": "FlacOutputFormat",
    "ogg":  "OggOutputFormat"
  };

  // FFmpeg codec name → Mediabunny codec string
  var MB_CODEC_MAP = {
    "libx264":    "avc",
    "libvpx-vp9": "vp9",
    "libvpx":     "vp8",
    "libmp3lame": "mp3",
    "pcm_s16le":  "pcm-s16",
    "aac":        "aac",
    "libopus":    "opus",
    "libvorbis":  "vorbis"
  };

  // Cached Mediabunny module (loaded once)
  var _mb = null;
  var _mbLoading = null;

  // Fake virtual filesystem: stores input blob and output result
  // so the tools' FS("writeFile") / FS("readFile") calls still work
  var _mbFS = {};

  // ── LOAD MEDIABUNNY ──
  async function loadMediabunny() {
    if (_mb) return _mb;
    if (_mbLoading) return _mbLoading;

    _mbLoading = (async () => {
      var mod = await import(MB_CDN);

      // Register MP3 encoder if browser doesn't support it natively
      if (!(await mod.canEncodeAudio("mp3"))) {
        try {
          var mp3mod = await import(MB_MP3_CDN);
          mp3mod.registerMp3Encoder();
        } catch(e) {
          // MP3 encoder extension failed — MP3 output will fall back to FFmpeg
        }
      }

      _mb = mod;
      return _mb;
    })();

    return _mbLoading;
  }

  // ── PARSE FFMPEG ARGS ──
  // Returns a structured descriptor or null if we can't/shouldn't handle it
  function parseFFmpegArgs(args) {
    // Mediabunny only supports single-input operations.
    // Multi-input commands (e.g. two-pass GIF with palette) must always use FFmpeg.
    var inputCount = 0;
    for (var j = 0; j < args.length; j++) {
      if (args[j] === "-i") inputCount++;
    }
    if (inputCount !== 1) return null;

    // Flatten args to a simple object for easy lookup
    var flags = {};
    var positional = [];
    for (var i = 0; i < args.length; i++) {
      if (args[i].startsWith("-")) {
        var key = args[i];
        // Flags that take a value
        var valueFlags = ["-i","-ss","-to","-t","-c","-c:v","-c:a","-codec:a",
                         "-crf","-b:v","-b:a","-cpu-used","-preset","-q:v","-vf","-y"];
        if (valueFlags.indexOf(key) !== -1 && i + 1 < args.length && !args[i+1].startsWith("-")) {
          flags[key] = args[i+1];
          i++;
        } else {
          flags[key] = true; // boolean flag e.g. -an, -vn
        }
      } else {
        positional.push(args[i]);
      }
    }

    var input  = flags["-i"]  || null;
    var output = flags["-y"]  || positional[positional.length - 1] || null;

    if (!input || !output) return null;

    // Extract output extension
    var outExt = output.split(".").pop().toLowerCase();

    // Never handle AVI output or GIF — always FFmpeg
    if (outExt === "avi" || outExt === "gif") return null;

    // Check input format is supported by Mediabunny
    // (input is always "input" in these tools — extension comes from the stored file)
    // We store the original file extension in _mbFS when writeFile is called
    var inExt = (_mbFS["_inputExt"] || "").toLowerCase();
    if (inExt && MB_INPUT_FORMATS.indexOf(inExt) === -1) return null;

    // Check output format is supported by Mediabunny
    if (!MB_OUTPUT_FORMAT[outExt]) return null;

    // ── DETECT OPERATION ──

    // TRIM: has -ss and -to/-t with -c copy
    if ((flags["-ss"] !== undefined) && (flags["-to"] || flags["-t"])) {
      return {
        op:     "trim",
        input:  input,
        output: output,
        outExt: outExt,
        start:  parseFloat(flags["-ss"]),
        end:    flags["-to"] ? parseFloat(flags["-to"]) : null,
        duration: flags["-t"] ? parseFloat(flags["-t"]) : null
      };
    }

    // REMOVE AUDIO: -an flag
    if (flags["-an"]) {
      return { op: "removeAudio", input: input, output: output, outExt: outExt };
    }

    // EXTRACT AUDIO: -vn flag (drop video, keep audio)
    if (flags["-vn"]) {
      var audioCodec = MB_CODEC_MAP[flags["-codec:a"]] || MB_CODEC_MAP[flags["-c:a"]] || null;
      return {
        op:         "extractAudio",
        input:      input,
        output:     output,
        outExt:     outExt,
        audioCodec: audioCodec,
        audioBitrate: flags["-b:a"] ? parseInt(flags["-b:a"]) * 1000 : 128000
      };
    }

    // CONVERT AUDIO: audio codec specified, no video codec
    if ((flags["-codec:a"] || flags["-c:a"]) && !flags["-c:v"]) {
      var audioCodec2 = MB_CODEC_MAP[flags["-codec:a"]] || MB_CODEC_MAP[flags["-c:a"]] || null;
      if (!audioCodec2) return null;
      return {
        op:          "convertAudio",
        input:       input,
        output:      output,
        outExt:      outExt,
        audioCodec:  audioCodec2,
        audioBitrate: flags["-b:a"] ? parseInt(flags["-b:a"]) * 1000 : 128000
      };
    }

    // CONVERT VIDEO: video codec specified
    if (flags["-c:v"]) {
      var videoCodec = MB_CODEC_MAP[flags["-c:v"]] || null;
      if (!videoCodec) return null;
      var audioCodec3 = MB_CODEC_MAP[flags["-c:a"]] || "aac";
      return {
        op:          "convertVideo",
        input:       input,
        output:      output,
        outExt:      outExt,
        videoCodec:  videoCodec,
        audioCodec:  audioCodec3,
        videoBitrate: 2000000 // 2Mbps default
      };
    }

    return null; // Unknown operation — let FFmpeg handle it
  }

  // ── RUN WITH MEDIABUNNY ──
  async function runWithMediabunny(descriptor) {
    var mb = await loadMediabunny();
    var {
      Input, Output, Conversion, BufferTarget, BlobSource, ALL_FORMATS,
      Mp4OutputFormat, MovOutputFormat, MatroskaOutputFormat, WebMOutputFormat,
      Mp3OutputFormat, WavOutputFormat, AdtsOutputFormat, FlacOutputFormat, OggOutputFormat
    } = mb;

    // Get the input blob from fake FS
    var inputBlob = _mbFS["input"];
    if (!inputBlob) throw new Error("No input file in fake FS");

    var desc = descriptor;
    var outExt = desc.outExt;

    var formatMap = {
      "mp4":  Mp4OutputFormat,
      "mov":  MovOutputFormat,
      "mkv":  MatroskaOutputFormat,
      "webm": WebMOutputFormat,
      "mp3":  Mp3OutputFormat,
      "wav":  WavOutputFormat,
      "aac":  AdtsOutputFormat,
      "flac": FlacOutputFormat,
      "ogg":  OggOutputFormat
    };

    var OutputFormatClass = formatMap[outExt];
    if (!OutputFormatClass) throw new Error("Unsupported output format: " + outExt);

    var input  = new Input({ source: new BlobSource(inputBlob), formats: ALL_FORMATS });
    var target = new BufferTarget();
    var output = new Output({ format: new OutputFormatClass(), target: target });

    // Build Conversion.init() options based on operation
    var convOpts = { input: input, output: output };

    if (desc.op === "trim") {
      var trimOpts = {};
      if (desc.start    !== null) trimOpts.start = desc.start;
      if (desc.end      !== null) trimOpts.end   = desc.end;
      // -t means duration: end = start + duration
      if (desc.duration !== null && desc.start !== null) trimOpts.end = desc.start + desc.duration;
      convOpts.trim = trimOpts;

    } else if (desc.op === "removeAudio") {
      convOpts.audio = { discard: true };

    } else if (desc.op === "extractAudio") {
      convOpts.video = { discard: true };
      if (desc.audioCodec) {
        convOpts.audio = { codec: desc.audioCodec, bitrate: desc.audioBitrate };
      }

    } else if (desc.op === "convertAudio") {
      convOpts.video = { discard: true };
      convOpts.audio = { codec: desc.audioCodec, bitrate: desc.audioBitrate };

    } else if (desc.op === "convertVideo") {
      convOpts.video = { codec: desc.videoCodec, bitrate: desc.videoBitrate };
      convOpts.audio = { codec: desc.audioCodec, bitrate: 128000 };
    }

    var conversion = await Conversion.init(convOpts);

    // If Mediabunny says this conversion is invalid, throw so we fall back to FFmpeg
    if (!conversion.isValid) {
      var reasons = conversion.discardedTracks.map(function(t) { return t.reason; }).join(", ");
      throw new Error("Mediabunny: invalid conversion (" + reasons + ")");
    }

    await conversion.execute();

    // Store result — will be read by FS("readFile", output)
    var mime = {
      "mp4": "video/mp4", "mov": "video/quicktime", "mkv": "video/x-matroska",
      "webm": "video/webm", "mp3": "audio/mpeg", "wav": "audio/wav",
      "aac": "audio/aac", "flac": "audio/flac", "ogg": "audio/ogg"
    }[outExt] || "application/octet-stream";

    // Pre-convert to ArrayBuffer so FS("readFile") can return {buffer} synchronously
    var buf = target.buffer; // BufferTarget exposes .buffer as ArrayBuffer
    var resultBlob = new Blob([buf], { type: mime });
    resultBlob._buffer = buf;
    _mbFS[desc.output] = resultBlob;
  }

  // ── INSTALL INTERCEPTORS ──
  var _originalInstall = window.loadFFmpeg;
  window.loadFFmpeg = async function() {
    console.log("[MB:DEBUG] loadFFmpeg wrapper called");
    await _originalInstall.apply(this, arguments);

    if (!window.ffmpeg) {
      console.error("[MB:DEBUG] window.ffmpeg is null after _originalInstall — aborting interceptor install");
      return;
    }
    console.log("[MB:DEBUG] Installing FS and run interceptors on window.ffmpeg");

    var realRun = window.ffmpeg.run.bind(window.ffmpeg);
    var realFS  = window.ffmpeg.FS.bind(window.ffmpeg);

    window.ffmpeg.FS = function(method, name, data) {
      console.log("[MB:FS]", method, name, data !== undefined ? "(data provided)" : "(no data)");

      if (method === "writeFile" && name === "input" && data) {
        var blob = data instanceof Blob ? data : new Blob([data]);
        _mbFS["input"] = blob;
        if (window._mbNextInputExt) {
          _mbFS["_inputExt"] = window._mbNextInputExt;
          window._mbNextInputExt = null;
        } else {
          var extFromType = {
            "video/mp4": "mp4", "video/quicktime": "mov", "video/x-msvideo": "avi",
            "video/x-matroska": "mkv", "video/webm": "webm", "video/avi": "avi",
            "audio/mpeg": "mp3", "audio/wav": "wav", "audio/aac": "aac",
            "audio/flac": "flac", "audio/ogg": "ogg", "audio/mp4": "m4a"
          };
          _mbFS["_inputExt"] = extFromType[blob.type] || "";
        }
        console.log("[MB:FS] Stored input blob, inExt='" + _mbFS["_inputExt"] + "', size=" + blob.size);
        // Fall through to real FS so FFmpeg also has the file for fallback
      }

      if (method === "readFile") {
        var inFakeFS = !!_mbFS[name];
        var hasBuffer = inFakeFS && !!_mbFS[name]._buffer;
        console.log("[MB:FS] readFile '" + name + "': inFakeFS=" + inFakeFS + ", hasBuffer=" + hasBuffer);
        if (inFakeFS) {
          if (hasBuffer) {
            console.log("[MB:FS] Serving from fakeFS, byteLength=" + _mbFS[name]._buffer.byteLength);
            return { buffer: _mbFS[name]._buffer };
          }
          console.error("[MB:FS] fakeFS entry exists but _buffer is missing! Blob:", _mbFS[name]);
          throw new Error("[MB:FS] Output '" + name + "' in fakeFS but _buffer is missing — FFmpeg never wrote it");
        }
        console.log("[MB:FS] Not in fakeFS, delegating to realFS");
      }

      if (method === "unlink") {
        var wasInFake = !!_mbFS[name];
        delete _mbFS[name];
        console.log("[MB:FS] unlink '" + name + "': wasInFakeFS=" + wasInFake);
        try { realFS(method, name); } catch(_) { console.log("[MB:FS] unlink from realFS failed (expected if MB handled it)"); }
        return;
      }

      try {
        var result = realFS(method, name, data);
        return result;
      } catch(fsErr) {
        console.error("[MB:FS] realFS(" + method + ", " + name + ") threw:", fsErr.message);
        if (method === "readFile") {
          // FFmpeg failed to write the output file — likely ran out of memory
          // or the operation failed silently. Give a user-friendly error.
          throw new Error("Processing failed — the file may be too large or complex for your browser. Try a shorter clip or smaller file.");
        }
        throw fsErr;
      }
    };

    window.ffmpeg.run = async function() {
      var args = Array.prototype.slice.call(arguments);
      console.log("[MB:run] called with args:", JSON.stringify(args));
      console.log("[MB:run] _mbFS keys:", Object.keys(_mbFS));

      var desc = parseFFmpegArgs(args);
      console.log("[MB:run] parseFFmpegArgs result:", desc ? JSON.stringify(desc) : "null (FFmpeg handles)");

      if (desc) {
        try {
          console.log("[MB:run] Attempting Mediabunny for op='" + desc.op + "' output='" + desc.output + "'");
          await runWithMediabunny(desc);

          var mbResult = _mbFS[desc.output];
          var bufferOk = mbResult && mbResult._buffer instanceof ArrayBuffer && mbResult._buffer.byteLength > 0;
          console.log("[MB:run] Mediabunny done. mbResult exists=" + !!mbResult + ", bufferOk=" + bufferOk + (mbResult && mbResult._buffer ? ", byteLength=" + mbResult._buffer.byteLength : ""));

          if (bufferOk) {
            console.log("[MB:run] SUCCESS — returning early, FS readFile will serve fakeFS");
            return;
          }

          console.warn("[MB:run] Buffer invalid after Mediabunny — falling back to FFmpeg");
          delete _mbFS[desc.output];
        } catch(e) {
          console.warn("[MB:run] Mediabunny threw:", e.message, "\nStack:", e.stack);
          delete _mbFS[desc.output];
        }
      }

      console.log("[MB:run] Running real FFmpeg with args:", JSON.stringify(args));
      try {
        return await realRun.apply(null, args);
      } catch(ffmpegErr) {
        console.error("[MB:run] Real FFmpeg also threw:", ffmpegErr.message);
        throw ffmpegErr;
      }
    };

    console.log("[MB:DEBUG] Interceptors installed successfully");
  };

})();
