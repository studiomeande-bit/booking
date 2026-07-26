(() => {
  const GOOGLE_ANALYTICS_ID = "G-YHP3VVZ6GN";
  const CONSENT_KEY = "studio-mean-analytics-consent";
  const MAP_CONSENT_KEY = "studio-mean-google-map-consent";
  const VALID_ANALYTICS_ID = /^G-[A-Z0-9]+$/i.test(GOOGLE_ANALYTICS_ID) && GOOGLE_ANALYTICS_ID !== "G-XXXXXXXXXX";

  if (VALID_ANALYTICS_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("set", "linker", {
      domains: ["studio-mean.com", "booking.studio-mean.com"]
    });
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500
    });
    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_ANALYTICS_ID, {
      anonymize_ip: true,
      send_page_view: false
    });
  }

  /* Resolved on every read: pages that switch language client-side update
     <html lang> after this script has already run. */
  function currentLang() {
    return (document.documentElement.lang || "de").slice(0, 2).toLowerCase();
  }
  const CONSENT_COPY = {
    de: {
      text: "Wir verwenden Google Analytics nur mit Ihrer Zustimmung, um die Website zu verbessern.",
      accept: "Akzeptieren",
      decline: "Ablehnen",
      privacy: "Datenschutz"
    },
    en: {
      text: "We use Google Analytics only with your consent to improve the website.",
      accept: "Accept",
      decline: "Decline",
      privacy: "Privacy"
    },
    ko: {
      text: "웹사이트 개선을 위해 동의하신 경우에만 Google Analytics를 사용합니다.",
      accept: "동의",
      decline: "거부",
      privacy: "개인정보"
    }
  };

  function texts() {
    return CONSENT_COPY[currentLang()] || CONSENT_COPY.de;
  }

  function readConsent(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return "";
    }
  }

  function writeConsent(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Consent state is best-effort; analytics still only sends after a click.
    }
  }

  function injectConsentStyles() {
    if (document.getElementById("studio-mean-consent-style")) return;
    const style = document.createElement("style");
    style.id = "studio-mean-consent-style";
    style.textContent = `
      .studio-consent-banner {
        position: fixed;
        right: max(16px, env(safe-area-inset-right));
        bottom: max(16px, env(safe-area-inset-bottom));
        z-index: 9999;
        width: min(420px, calc(100vw - 32px));
        padding: 16px;
        background: rgba(17, 17, 15, 0.94);
        color: #f7f2ea;
        border: 1px solid rgba(247, 242, 234, 0.18);
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28);
        font: 500 13px/1.55 Inter, "Helvetica Neue", Arial, sans-serif;
        backdrop-filter: blur(18px);
      }
      .studio-consent-banner p { margin: 0 0 14px; color: rgba(247, 242, 234, 0.82); }
      .studio-consent-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .studio-consent-actions button,
      .studio-consent-actions a {
        border: 1px solid rgba(247, 242, 234, 0.24);
        padding: 9px 12px;
        color: inherit;
        background: transparent;
        font: 700 11px/1 Inter, "Helvetica Neue", Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0;
        text-decoration: none;
        cursor: pointer;
      }
      .studio-consent-actions [data-consent-accept] { background: #f7f2ea; color: #11110f; }
      .studio-consent-actions a { margin-left: auto; color: rgba(247, 242, 234, 0.7); }
      @media (max-width: 640px) {
        .studio-consent-banner { left: 12px; right: 12px; bottom: 12px; width: auto; }
        .studio-consent-actions a { margin-left: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function grantAnalyticsConsent() {
    if (!VALID_ANALYTICS_ID || !window.gtag) return;
    window.gtag("consent", "update", {
      analytics_storage: "granted"
    });
  }

  function sendAnalyticsPageView() {
    if (!VALID_ANALYTICS_ID || window.__studioMeanAnalyticsLoaded || !window.gtag) return;
    window.__studioMeanAnalyticsLoaded = true;
    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      send_to: GOOGLE_ANALYTICS_ID
    });
  }

  function showAnalyticsBanner() {
    if (!VALID_ANALYTICS_ID || readConsent(CONSENT_KEY)) return;
    injectConsentStyles();
    const banner = document.createElement("aside");
    banner.className = "studio-consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Google Analytics consent");
    const t = texts();
    banner.innerHTML = `
      <p>${t.text}</p>
      <div class="studio-consent-actions">
        <button type="button" data-consent-accept>${t.accept}</button>
        <button type="button" data-consent-decline>${t.decline}</button>
        <a href="/datenschutz/">${t.privacy}</a>
      </div>
    `;
    banner.querySelector("[data-consent-accept]").addEventListener("click", () => {
      writeConsent(CONSENT_KEY, "accepted");
      banner.remove();
      grantAnalyticsConsent();
      sendAnalyticsPageView();
    });
    banner.querySelector("[data-consent-decline]").addEventListener("click", () => {
      writeConsent(CONSENT_KEY, "declined");
      if (VALID_ANALYTICS_ID && window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "denied"
        });
      }
      banner.remove();
    });
    document.body.appendChild(banner);

    /* Pages that switch language client-side (booking, select) dispatch this
       so an already-visible consent prompt follows the chosen language. */
    document.addEventListener('studiomean:langchange', () => {
      if (!banner.isConnected) return;
      const next = texts();
      banner.querySelector('p').textContent = next.text;
      banner.querySelector('[data-consent-accept]').textContent = next.accept;
      banner.querySelector('[data-consent-decline]').textContent = next.decline;
      banner.querySelector('.studio-consent-actions a').textContent = next.privacy;
    });
  }

  function initMaps() {
    document.querySelectorAll("[data-google-map-src]").forEach((holder) => {
      const source = holder.getAttribute("data-google-map-src");
      const title = holder.getAttribute("data-google-map-title") || "Google Maps";
      const shouldLoad = readConsent(MAP_CONSENT_KEY) === "accepted";

      const renderMap = () => {
        if (!source || holder.querySelector("iframe")) return;
        writeConsent(MAP_CONSENT_KEY, "accepted");
        holder.innerHTML = "";
        const frame = document.createElement("iframe");
        frame.title = title;
        frame.src = source;
        frame.loading = "lazy";
        frame.referrerPolicy = "no-referrer-when-downgrade";
        frame.allowFullscreen = true;
        holder.appendChild(frame);
      };

      if (shouldLoad) {
        renderMap();
        return;
      }

      const button = holder.querySelector("[data-google-map-load]");
      if (button) button.addEventListener("click", renderMap);
    });
  }

  if (VALID_ANALYTICS_ID && readConsent(CONSENT_KEY) === "accepted") {
    grantAnalyticsConsent();
    sendAnalyticsPageView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      showAnalyticsBanner();
      initMaps();
    });
  } else {
    showAnalyticsBanner();
    initMaps();
  }
})();
