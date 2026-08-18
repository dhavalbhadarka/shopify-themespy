"use strict";

const view = document.getElementById("view");

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Compare two semver-ish strings. Returns 1 if a>b, -1 if a<b, 0 if equal.
function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

const copyIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const checkIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const sunIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const moonIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const historyIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><path d="M3 5v5h5"/></svg>';
const backIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const removeIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

const historyBtn = document.getElementById("historyBtn");
if (historyBtn) {
  historyBtn.innerHTML = historyIcon;
  historyBtn.addEventListener("click", renderHistoryView);
}

/* ---------- theme toggle (light/dark, persisted) ---------- */

const THEME_KEY = "themespy_theme";

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");

  const isDark = theme ? theme === "dark" : systemPrefersDark();
  const btn = document.getElementById("themeToggle");
  if (btn) btn.innerHTML = isDark ? sunIcon : moonIcon;
}

async function initTheme() {
  let stored = null;
  try {
    const data = await chrome.storage.local.get(THEME_KEY);
    stored = data[THEME_KEY] || null;
  } catch (e) { /* ignore */ }

  applyTheme(stored);

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", async () => {
      const current = document.documentElement.getAttribute("data-theme") || (systemPrefersDark() ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try { await chrome.storage.local.set({ [THEME_KEY]: next }); } catch (e) { /* ignore */ }
    });
  }
}

initTheme();

/* ---------- recent-stores history ---------- */

const HISTORY_KEY = "themespy_history";
const HISTORY_MAX = 8;

async function loadHistory() {
  try {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  } catch (e) {
    return [];
  }
}

async function saveHistory(list) {
  try { await chrome.storage.local.set({ [HISTORY_KEY]: list }); } catch (e) { /* ignore */ }
}

async function recordHistory(info) {
  if (!info.shop) return;
  const hist = await loadHistory();
  const filtered = hist.filter((h) => h.shop !== info.shop);
  filtered.unshift({
    shop: info.shop,
    schemaName: info.schemaName || null,
    installed: info.schemaVersion || null,
  });
  await saveHistory(filtered.slice(0, HISTORY_MAX));
}

/* ---------- history view (rendered in-place inside the popup) ---------- */

let lastInfo = null;
let lastLatest = null;

function backToStore() {
  if (lastInfo) render(lastInfo, lastLatest);
  else main();
}

async function renderHistoryView() {
  const list = await loadHistory();

  const listHtml = list.length
    ? `<div class="history__list">${list.map((h) => `
        <div class="history__item">
          <button class="history__main" type="button" data-open="${esc(h.shop)}">
            <span class="history__shop">${esc(h.shop)}</span>
            ${h.schemaName ? `<span class="history__theme">${esc(h.schemaName)}</span>` : ""}
          </button>
          <button class="history__remove" type="button" data-remove="${esc(h.shop)}" title="Remove" aria-label="Remove">${removeIcon}</button>
        </div>
      `).join("")}</div>`
    : '<div class="empty"><strong>No history yet</strong><span>Inspect a Shopify storefront to start building a list.</span></div>';

  const clearHtml = list.length
    ? '<button class="history__clearall" id="historyClearAll" type="button">Clear all</button>'
    : "";

  view.innerHTML =
    `<div class="history__bar">
       <button class="history__back" id="historyBack" type="button" aria-label="Back">${backIcon}Back</button>
       ${clearHtml}
     </div>` + listHtml;

  view.querySelector("#historyBack").addEventListener("click", backToStore);

  view.querySelectorAll(".history__main").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: `https://${btn.dataset.open}` });
    });
  });

  view.querySelectorAll(".history__remove").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const remaining = (await loadHistory()).filter((h) => h.shop !== btn.dataset.remove);
      await saveHistory(remaining);
      renderHistoryView();
    });
  });

  const clearAllBtn = view.querySelector("#historyClearAll");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      await saveHistory([]);
      renderHistoryView();
    });
  }
}

/* ---------- read Shopify.theme from the page (MAIN world) ---------- */

async function readTheme() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { error: "notab" };

  let injection;
  try {
    injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        const S = window.Shopify;
        if (!S || typeof S !== "object") return { isShopify: false };
        const t = S.theme || {};

        // App detection: match known CDN/script domains against every
        // script/link tag on the page. Misses apps that only load
        // server-side (Liquid snippets) or lazy-load after this scan.
        const FINGERPRINTS = [
          // Email / SMS marketing
          { name: "Klaviyo", src: /klaviyo/i },
          { name: "Attentive", src: /attentivemobile/i },
          { name: "Postscript", src: /postscript\.io/i },
          { name: "Omnisend", src: /omnisend/i },
          { name: "Mailchimp", src: /mailchimp|chimpstatic/i },
          { name: "SMSBump / Yotpo SMS", src: /smsbump/i },
          { name: "Sendlane", src: /sendlane/i },
          { name: "Drip", src: /getdrip/i },

          // Reviews / UGC
          { name: "Judge.me", src: /judge\.me/i },
          { name: "Loox", src: /loox\.(io|app)/i },
          { name: "Yotpo", src: /yotpo/i },
          { name: "Okendo Reviews", src: /okendo/i },
          { name: "Stamped.io Reviews", src: /stamped\.io/i },
          { name: "Fera Reviews", src: /fera\.ai/i },
          { name: "Ali Reviews", src: /alireviews/i },
          { name: "Trustpilot", src: /trustpilot/i },
          { name: "REVIEWS.io", src: /reviews\.(io|co)/i },

          // Subscriptions / loyalty / rewards
          { name: "ReCharge", src: /rechargepayments|recharge\.com/i },
          { name: "Smile.io", src: /smile\.io/i },
          { name: "Bold Commerce", src: /boldapps|boldcommerce/i },
          { name: "Loyalty Lion", src: /loyaltylion/i },
          { name: "Yotpo Loyalty (Swell)", src: /swellrewards/i },
          { name: "Skio Subscriptions", src: /skio\.com/i },
          { name: "Appstle Subscriptions", src: /appstle/i },
          { name: "Seal Subscriptions", src: /sealsubscriptions/i },

          // Page builders / theme tools
          { name: "PageFly", src: /pagefly/i },
          { name: "Shogun Page Builder", src: /getshogun/i },
          { name: "GemPages", src: /gempages/i },
          { name: "Zipify Pages", src: /zipify/i },
          { name: "Instant Page Builder", src: /instantpagebuilder|shogun/i },

          // Popups / on-site conversion
          { name: "Privy", src: /privy\.com/i },
          { name: "Wisepops", src: /wisepops/i },
          { name: "OptinMonster", src: /optinmonster/i },
          { name: "Justuno", src: /justuno/i },
          { name: "Sumo", src: /sumo\.com/i },
          { name: "Rivo Popups", src: /rivo\.io/i },

          // Support / chat
          { name: "Gorgias", src: /gorgias/i },
          { name: "Tidio", src: /tidio/i },
          { name: "Zendesk", src: /zdassets|zendesk/i },
          { name: "Intercom", src: /intercom\.io|widget\.intercom/i },
          { name: "Crisp", src: /crisp\.chat/i },
          { name: "LiveChat", src: /livechatinc/i },
          { name: "Re:amaze", src: /reamaze/i },

          // Upsell / cross-sell / cart
          { name: "Rebuy", src: /rebuyengine/i },
          { name: "Bold Upsell", src: /boldapps/i },
          { name: "ReConvert", src: /reconvert/i },
          { name: "Honeycomb Upsell", src: /honeycombupsell/i },
          { name: "CartHook", src: /carthook/i },
          { name: "Cart Aid", src: /cartaid/i },

          // Search / merchandising / personalization
          { name: "Searchanise", src: /searchanise/i },
          { name: "Klevu", src: /klevu/i },
          { name: "Nosto", src: /nosto/i },
          { name: "Algolia", src: /algolia/i },
          { name: "Boost AI Search", src: /boostcommerce|boost\.ai/i },

          // Wishlist
          { name: "Wishlist Plus", src: /swymrelay/i },
          { name: "Wishlist King", src: /wishlistking/i },

          // Translation / currency / localization
          { name: "Langify", src: /langify/i },
          { name: "Weglot", src: /weglot/i },
          { name: "Currency Converter", src: /currencyconverter/i },

          // Print on demand / dropshipping
          { name: "Printful", src: /printful/i },
          { name: "Printify", src: /printify/i },
          { name: "Spocket", src: /spocket/i },
          { name: "DSers", src: /dsers/i },

          // Payments / BNPL
          { name: "Klarna", src: /klarna/i },
          { name: "Affirm", src: /affirm\.com/i },
          { name: "Afterpay", src: /afterpay/i },
          { name: "Sezzle", src: /sezzle/i },
          { name: "PayPal", src: /paypal\.com\/sdk|paypalobjects/i },

          // Analytics / tracking / tag management
          { name: "Google Tag Manager", src: /googletagmanager/i },
          { name: "Google Analytics", src: /google-analytics|gtag\/js/i },
          { name: "Meta Pixel", src: /connect\.facebook\.net/i },
          { name: "TikTok Pixel", src: /analytics\.tiktok\.com/i },
          { name: "Snapchat Pixel", src: /sc-static\.net|tr\.snapchat\.com/i },
          { name: "Pinterest Tag", src: /pintrk|s\.pinimg\.com\/ct/i },
          { name: "Hotjar", src: /hotjar/i },
          { name: "Microsoft Clarity", src: /clarity\.ms/i },
          { name: "Lucky Orange", src: /luckyorange/i },
          { name: "Triple Whale", src: /triplewhale/i },
        ];

        const urls = Array.from(document.querySelectorAll("script[src], link[href]"))
          .map((el) => el.src || el.href || "")
          .filter(Boolean);

        const apps = FINGERPRINTS
          .filter((fp) => urls.some((u) => fp.src.test(u)))
          .map((fp) => fp.name);

        return {
          isShopify: true,
          shop: S.shop || null,
          name: t.name || null,
          schemaName: t.schema_name || null,
          schemaVersion: t.schema_version || null,
          themeStoreId: t.theme_store_id != null ? t.theme_store_id : null,
          role: t.role || null,
          id: t.id != null ? t.id : null,
          apps,
        };
      },
    });
  } catch (e) {
    // chrome://, extension pages, PDF viewer, etc. block injection
    return { error: "restricted" };
  }

  const result = injection && injection[0] && injection[0].result;
  if (!result) return { error: "restricted" };
  return result;
}

/* ---------- latest version lookup ---------- */
// Dawn is the one Shopify reference theme with a clean public source.
async function fetchLatestDawn() {
  try {
    const res = await fetch("https://api.github.com/repos/Shopify/dawn/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.tag_name || data.name || "").replace(/^v/i, "") || null;
  } catch (e) {
    return null;
  }
}

/* ---------- store listing link ---------- */
function storeUrlFor(schemaName, themeStoreId) {
  const slug = (schemaName || "").trim().toLowerCase().replace(/\s+/g, "-");
  const known = ["dawn", "sense", "craft", "refresh", "ride", "origin",
    "publisher", "colorblock", "crave", "studio", "taste", "spotlight"];
  if (known.includes(slug)) return `https://themes.shopify.com/themes/${slug}/styles/default`;
  if (schemaName) return `https://themes.shopify.com/themes?q=${encodeURIComponent(schemaName)}`;
  return null;
}

/* ---------- render ---------- */

function renderEmpty(title, sub, showRetry) {
  view.innerHTML =
    `<div class="empty"><strong>${esc(title)}</strong><span>${esc(sub)}</span>${
      showRetry ? '<button class="retry" id="retry" type="button">Try again</button>' : ""
    }</div>`;
  if (showRetry) {
    const btn = view.querySelector("#retry");
    if (btn) btn.addEventListener("click", () => {
      view.innerHTML = '<div class="loading"><span class="spinner" aria-hidden="true"></span>Reading storefront…</div>';
      main();
    });
  }
}

function row(label, valueHtml) {
  return `<div class="row"><span class="row__label">${esc(label)}</span>${valueHtml}</div>`;
}

function copyBtn(value, title) {
  return `<button class="copy" data-copy="${esc(value)}" title="${esc(title)}" aria-label="${esc(title)}">${copyIcon}</button>`;
}

function appsSection(apps) {
  if (!apps || !apps.length) return "";
  const chips = apps.map((a) => `<span class="chip">${esc(a)}</span>`).join("");
  return `<div class="apps"><div class="apps__label">Detected apps</div><div class="apps__list">${chips}</div></div>`;
}

function render(info, latest) {
  lastInfo = info;
  lastLatest = latest;

  const installed = info.schemaVersion;
  const isFork = info.themeStoreId == null;

  // version banner
  let banner = "";
  if (installed) {
    let pill = '<span class="pill pill--unknown">version unknown</span>';
    let nums = `<span class="version__nums">${esc(installed)}</span>`;
    if (latest) {
      const c = cmpVersion(installed, latest);
      if (c < 0) {
        pill = '<span class="pill pill--update">Update available</span>';
        nums = `<span class="version__nums">${esc(installed)}<span class="arrow">&rarr;</span><span class="to">${esc(latest)}</span></span>`;
      } else {
        pill = '<span class="pill pill--ok">Up to date</span>';
        nums = `<span class="version__nums">${esc(installed)}</span>`;
      }
    }
    banner = `<div class="version">${nums}${pill}</div>`;
  }

  // rows
  const rows = [];
  if (info.schemaName) {
    const tag = isFork
      ? '<span class="tag tag--fork">fork</span>'
      : '<span class="tag">store</span>';
    rows.push(row("Base theme", `<span class="row__val"><span class="txt txt--highlight">${esc(info.schemaName)}</span>${tag}</span>`));
  }
  if (installed) {
    rows.push(row("Installed", `<span class="row__val mono"><span class="txt">${esc(installed)}</span></span>`));
  }
  rows.push(row("Latest", `<span class="row__val mono"><span class="txt">${latest ? esc(latest) : "&mdash;"}</span></span>`));
  if (info.shop) {
    rows.push(row("Store URL", `<span class="row__val mono"><span class="txt">${esc(info.shop)}</span>${copyBtn(info.shop, "Copy myshopify URL")}</span>`));
  }
  if (info.role) {
    rows.push(row("Role", `<span class="row__val mono"><span class="txt">${esc(info.role)}</span></span>`));
  }

  const storeUrl = storeUrlFor(info.schemaName, info.themeStoreId);
  const adminUrl = info.shop && info.id != null
    ? `https://${info.shop}/admin/themes/${info.id}/editor`
    : null;

  const links = [];
  if (adminUrl) links.push(`<a class="storelink" href="${esc(adminUrl)}" target="_blank" rel="noopener">Open in Admin editor &rsaquo;</a>`);
  if (storeUrl) links.push(`<a class="storelink" href="${esc(storeUrl)}" target="_blank" rel="noopener">View theme store listing &rsaquo;</a>`);

  const actions = links.length ? `<div class="actions">${links.join("")}</div>` : "";

  view.innerHTML = banner + `<div class="rows">${rows.join("")}</div>` + appsSection(info.apps) + actions;

  // wire copy buttons
  view.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const orig = btn.innerHTML;
        btn.innerHTML = checkIcon;
        btn.classList.add("copied");
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 1100);
      } catch (e) { /* ignore */ }
    });
  });
}

/* ---------- main ---------- */

async function main() {
  const info = await readTheme();

  if (info.error === "notab") {
    return renderEmpty("No active tab", "Open a Shopify storefront and try again.", true);
  }
  if (info.error === "restricted") {
    return renderEmpty("Can't inspect this page", "Chrome pages and the store don't expose theme data. Open a live storefront.", true);
  }
  if (!info.isShopify) {
    return renderEmpty("Not a Shopify storefront", "No Shopify.theme object found on this page.", true);
  }

  // Render immediately with what's on the page, then fill in "Latest".
  render(info, null);
  await recordHistory(info);
  if ((info.schemaName || "").trim().toLowerCase() === "dawn") {
    const latest = await fetchLatestDawn();
    if (latest) render(info, latest);
  }
}

main();
