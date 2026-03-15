/* ============================================================
   EssentialNoPopups — shared.js
   Injects common nav + footer, and provides shared utility
   functions used across all tool pages.
   ============================================================ */

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
      <a href="${root}index.html" class="nav-logo">Essential<em>NoPopups</em></a>
      ${isToolPage ? `<a href="${root}index.html" class="nav-back">← All tools</a>` : `<ul class="nav-links" style="display:flex;gap:1.5rem;font-size:0.85rem;color:var(--muted);list-style:none;"><li><a href="#video">Video</a></li><li><a href="#image">Images</a></li><li><a href="#audio">Audio</a></li><li><a href="#pdf">PDF</a></li></ul>`}
      <div class="nav-badge">Zero pop-ups, ever</div>
    `;
  }

  // FOOTER
  const footer = document.getElementById("shared-footer");
  if (footer) {
    footer.innerHTML = `
      <div>
        <div class="footer-logo">Essential<em>NoPopups</em></div>
        <div class="footer-tagline">Free tools. No pop-ups. Ever.</div>
      </div>
      <div class="footer-right">
        Issues or suggestions? Always welcome.<br>
        <a href="mailto:essentialsnopopups@gmail.com">essentialsnopopups@gmail.com</a>
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
