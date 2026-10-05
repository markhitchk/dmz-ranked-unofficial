(() => {
  const TAB = "unofficial-app";
  const TAB_ATTR = "data-hs-unofficial-app";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function validOperator(value) {
    const name = clean(value);
    return Boolean(
      name &&
      name.length <= 80 &&
      !/SELECT EXISTING OPERATOR|PICK YOUR NAME|RETURNING OPERATOR|YOUR OPERATOR NAME|CHANGE PIN|OPERATOR KILLS/i.test(name)
    );
  }

  function getOperatorName() {
    const input = document.getElementById("playerName");
    const picker = document.getElementById("playerPick");
    const typed = clean(input && (input.value || input.getAttribute("value")));
    let picked = "";

    if (picker && picker.selectedIndex > 0) {
      const option = picker.options[picker.selectedIndex];
      picked = clean(picker.value || (option && (option.value || option.textContent)));
    }

    let saved = "";
    try {
      saved = clean(localStorage.getItem("dmz_myname"));
    } catch (_) {}

    if (validOperator(picked) && (!validOperator(typed) || typed.toLowerCase() === picked.toLowerCase())) {
      return picked;
    }
    if (validOperator(typed)) return typed;
    if (validOperator(saved)) return saved;
    return "";
  }

  function findSiteNav() {
    return document.querySelector(".wrap nav.tabs");
  }

  function findWrap(nav) {
    return (nav && nav.closest(".wrap")) || document.querySelector(".wrap");
  }

  function updateWelcome() {
    const welcome = document.getElementById("hs-unofficial-welcome");
    if (!welcome) return;
    const operator = getOperatorName();
    const next = operator ? `Welcome back, ${operator}.` : "Welcome, Guest.";
    if (welcome.textContent !== next) welcome.textContent = next;
  }

  function ensureSection(nav) {
    let section = document.getElementById(TAB);
    if (section) return section;

    const wrap = findWrap(nav);
    if (!wrap) return null;

    section = document.createElement("section");
    section.id = TAB;
    section.setAttribute("aria-label", "DMZ Ranked Unofficial App");
    section.innerHTML =
      '<div class="sect-hero camp">' +
        '<h2>Unofficial App<small>Harley\'s Studios · Android Beta</small></h2>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title" id="hs-unofficial-welcome">Welcome, Guest.</h2>' +
        '<p class="hs-app-intro"><b>DMZ Ranked Unofficial App</b> is the Android app experience built around dmzranked.com. This page contains app-only information and tools while the DMZ Ranked website continues to run normally.</p>' +
        '<div class="hs-app-meta">' +
          '<span class="hs-app-pill beta">Beta</span>' +
          '<span class="hs-app-pill">1.0.52 (156)</span>' +
          '<span class="hs-app-pill">Harley\'s Studios</span>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title">App Status</h2>' +
        '<div class="hs-app-row"><div class="hs-app-label">Website</div><div class="hs-app-value"><span class="hs-app-status"><span class="hs-app-dot"></span>dmzranked.com loaded in the app</span></div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Release channel</div><div class="hs-app-value">Beta testing</div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Build</div><div class="hs-app-value">1.0.52 (156)</div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Developer</div><div class="hs-app-value">Harley\'s Studios</div></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title">Unofficial App Features</h2>' +
        '<ul class="hs-app-list">' +
          '<li><b>Android notifications</b> for reports, reviews, approvals, raids, updates, and system alerts.</li>' +
          '<li><b>Operator detection</b> so app-only features can recognize the operator saved on this device.</li>' +
          '<li><b>App settings</b> and Android-specific controls that are separate from the website.</li>' +
          '<li><b>Beta testing features</b> can be tried here before they are considered for the stable app.</li>' +
        '</ul>' +
      '</div>' +

      '<div class="card hs-app-notice">' +
        '<h2 class="section-title">About This Page</h2>' +
        '<p>This Unofficial App tab exists only inside Harley\'s Studios DMZ Ranked Unofficial App. It is injected by the Android Beta app and does not edit, upload to, or modify the dmzranked.com website.</p>' +
      '</div>';

    wrap.appendChild(section);
    return section;
  }

  function activateOurTab(button, section) {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll("section").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    section.classList.add("active");
    updateWelcome();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindButton(button, section) {
    if (!button || !section || button.dataset.hsBound === "true") return;
    button.dataset.hsBound = "true";
    button.addEventListener("click", () => activateOurTab(button, section));
  }

  function ensureTab() {
    if (location.hostname !== "dmzranked.com" && !location.hostname.endsWith(".dmzranked.com")) return;

    const nav = findSiteNav();
    if (!nav) return;

    let button = nav.querySelector(`[${TAB_ATTR}]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "hs-unofficial-tab";
      button.dataset.tab = TAB;
      button.setAttribute(TAB_ATTR, "true");
      button.textContent = "Unofficial App";
      nav.appendChild(button);
    }

    const section = ensureSection(nav);
    bindButton(button, section);
    updateWelcome();
  }

  ensureTab();

  const observer = new MutationObserver(() => {
    if (!document.querySelector(`.wrap nav.tabs [${TAB_ATTR}]`) || !document.getElementById(TAB)) {
      ensureTab();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(updateWelcome, 1500);
  window.__dmzHsBetaTabsRefresh = ensureTab;
})();
