/* ============================================================
   EssentialBits — shared.js
   Injects site navigation and footer; holds site-wide setup.
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
  // Tool pages may be served from /Tools/ or /tools/.
  // Index page is at root so needs no prefix.
  const pathname = window.location.pathname;
  const isToolPage = pathname.toLowerCase().includes("/tools/");
  const isHomePage = /(?:^|\/)(?:index\.html)?$/i.test(pathname);
  const root = isToolPage ? "../" : "";

  // NAV
  const nav = document.getElementById("shared-nav");
  if (nav) {
    nav.innerHTML = `
      <a href="${root}index.html" class="nav-logo">Essential<em>Bits</em></a>
      <div class="nav-center">
        ${!isHomePage
          ? `<a href="${root}index.html" class="nav-back">All tools <span aria-hidden="true">↗</span></a>`
          : `<ul class="nav-links"><li><a href="#video">Video <span aria-hidden="true">↓</span></a></li><li><a href="#image">Images <span aria-hidden="true">↓</span></a></li><li><a href="#audio">Audio <span aria-hidden="true">↓</span></a></li><li><a href="#pdf">PDF <span aria-hidden="true">↓</span></a></li><li><a href="#productivity">Productivity <span aria-hidden="true">↓</span></a></li><li><a href="#creativity">Creativity <span aria-hidden="true">↓</span></a></li></ul>`
        }
      </div>
      <div class="nav-right">
        <a href="${root}about.html" class="nav-changelog nav-about">About</a>
      </div>
    `;
  }

  // FOOTER
  const footer = document.getElementById("shared-footer");
  if (footer) {
    footer.innerHTML = `
      <div>
        <div class="footer-logo">Essential<em>Bits</em></div>
        <div class="footer-tagline">Focused tools for the details that matter.</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:8px;max-width:320px;line-height:1.5;">
          This site survives thanks to you. If a tool saved you time or a headache, you can support it below.
        </div>
        <a href="https://ko-fi.com/F2A425T678" target="_blank" rel="noopener" class="kofi-btn kofi-btn-sm kofi-btn-outline">
          <span class="kofi-cup">☕</span> Support on Ko-fi
        </a>
        <div style="font-size:0.7rem;color:var(--faint);margin-top:10px;">© ${new Date().getFullYear()} EssentialBits. All rights reserved.</div>
      </div>
      <div class="footer-right">
        Questions, suggestions, or ideas? Contact us at:<br>
        <a href="mailto:hello@essentialbits.pro">hello@essentialbits.pro</a><br>
        <a href="${root}about.html" style="font-size:0.72rem;color:var(--faint);">About</a> &nbsp;·&nbsp;
        <a href="${root}privacy-policy.html" style="font-size:0.72rem;color:var(--faint);">Privacy Policy</a>
      </div>
    `;
  }
})();
