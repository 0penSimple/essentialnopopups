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
      <a href="${root}index.html" class="nav-logo">Essential<em>Bits</em></a>
      ${isToolPage ? `<a href="${root}index.html" class="nav-back">← All tools</a>` : `<ul class="nav-links" style="display:flex;gap:1.5rem;font-size:0.85rem;color:var(--muted);list-style:none;"><li><a href="#video">Video</a></li><li><a href="#image">Images</a></li><li><a href="#audio">Audio</a></li><li><a href="#pdf">PDF</a></li></ul>`}
      <div class="nav-badge">Zero pop-ups, ever</div>
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
        <a href="${root}privacy-policy.html" style="font-size:0.72rem;color:var(--faint);">Privacy Policy</a>
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
  // Scroll button into view so user always sees the result
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
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

  _setProgress(current, total, label) {
    const fill  = document.getElementById("progressFill");
    const pct   = document.getElementById("progressPct");
    const lbl   = document.getElementById("progressLabel");
    const sec   = document.getElementById("progressSection");
    if (sec)  sec.classList.add("show");
    const p = Math.round((current / total) * 100);
    if (fill) fill.style.width = p + "%";
    if (pct)  pct.textContent  = p + "%";
    if (lbl)  lbl.textContent  = label;
  }

  async run() {
    const total   = this.items.length;
    const errors  = [];
    const results = []; // { filename, data }

    this._setBtn(`${this.btnLabel} — 0/${total}`);

    for (let i = 0; i < total; i++) {
      this._setBtn(`${this.btnLabel} — ${i}/${total}`);
      this._setProgress(i, total, `Processing ${i + 1} of ${total}...`);

      try {
        const result = await this.processOne(this.items[i], i);
        if (result) results.push(result);
      } catch(e) {
        errors.push(`${e.message}`);
      }

      // Yield to browser so UI updates
      await new Promise(r => setTimeout(r, 0));
    }

    this._setProgress(total, total, results.length > 0 ? "Done!" : "Failed");

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
    if (results.length === 1) {
      const { filename, data } = results[0];
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      for (const { filename, data } of results) {
        zip.file(filename, data);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a   = document.createElement("a");
      a.href = url; a.download = this.zipName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Show partial errors if some succeeded
    if (errors.length > 0) {
      showNotification(`Completed with ${errors.length} error(s): ${errors.join(" | ")}`, "error");
    }

    // Update button to done state
    const btn = document.getElementById(this.btnId);
    if (btn) {
      btn.disabled    = false;
      btn.textContent = `✓ Done! ${results.length}/${total}`;
      btn.classList.add("btn-done");
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      refreshAds();
      setTimeout(() => {
        btn.textContent = `${this.btnLabel} — 0/${total}`;
        btn.classList.remove("btn-done");
      }, 3000);
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
        onFiles(files);
      }
      input.value = ""; // reset so same file can be re-selected
    });
  }
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
