(() => {
  const PAGE_ID = "hs-unofficial-app-page";
  const TAB_ATTR = "data-hs-unofficial-app";
  const APP_HASH = "#unofficial-app";
  let previousHash = "";

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
    const direct = document.querySelector("nav.tabs, .tabs[role='tablist'], nav[role='tablist']");
    if (direct) return direct;

    const buttons = Array.from(document.querySelectorAll("button,a,[role='tab']"));
    const leader = buttons.find((el) => clean(el.textContent).toUpperCase() === "LEADERBOARD");
    if (!leader) return null;

    let node = leader.parentElement;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const text = clean(node.textContent).toUpperCase();
      if (text.includes("LEADERBOARD") && text.includes("CONTACT")) return node;
    }
    return leader.parentElement;
  }

  function updateWelcome() {
    const welcome = document.getElementById("hs-unofficial-welcome");
    if (!welcome) return;
    const operator = getOperatorName();
    welcome.textContent = operator ? `Welcome back, ${operator}!` : "Welcome, Guest!";
  }

  function ensurePage() {
    let page = document.getElementById(PAGE_ID);
    if (page) return page;

    page = document.createElement("section");
    page.id = PAGE_ID;
    page.setAttribute("role", "tabpanel");
    page.setAttribute("aria-label", "DMZ Ranked Unofficial App");
    page.innerHTML =
      '<div class="hs-unofficial-page-inner">' +
        '<div class="hs-unofficial-hero">' +
          '<div class="hs-unofficial-kicker">Harley\'s Studios • Android Beta</div>' +
          '<h1>DMZ Ranked Unofficial App</h1>' +
          '<h2 id="hs-unofficial-welcome">Welcome, Guest!</h2>' +
          '<p>A dedicated page for the Android wrapper, app features, notifications, operator tools, and Beta testing.</p>' +
          '<div class="hs-unofficial-badges">' +
            '<span class="hs-unofficial-badge beta">Beta</span>' +
            '<span class="hs-unofficial-badge">1.0.51 (155)</span>' +
            '<span class="hs-unofficial-badge">Harley\'s Studios</span>' +
          '</div>' +
        '</div>' +
        '<div class="hs-unofficial-grid">' +
          '<div class="hs-unofficial-card"><h3>Website</h3><p class="hs-unofficial-status"><span class="hs-unofficial-status-dot"></span><span>dmzranked.com runs normally inside the app.</span></p></div>' +
          '<div class="hs-unofficial-card"><h3>Notifications</h3><p>App alerts cover reports, reviews, approvals, raids, updates, and system messages.</p></div>' +
          '<div class="hs-unofficial-card"><h3>Operator</h3><p>The app can detect the operator selected on this device and use it for app-only features.</p></div>' +
          '<div class="hs-unofficial-card"><h3>Beta Testing</h3><p>This page is an experimental Beta feature and can be changed without changing the DMZ Ranked website.</p></div>' +
        '</div>' +
        '<div class="hs-unofficial-note"><strong>Unofficial app notice:</strong> This page is injected only inside Harley\'s Studios DMZ Ranked Unofficial App. It does not edit, upload to, or modify dmzranked.com.</div>' +
        '<div class="hs-unofficial-actions"><button type="button" class="hs-unofficial-back">Back to DMZ Ranked</button></div>' +
      '</div>';

    document.body.appendChild(page);
    page.querySelector(".hs-unofficial-back").addEventListener("click", () => closePage(true));
    return page;
  }

  function positionPage() {
    const nav = findSiteNav();
    const page = ensurePage();
    let top = 0;

    if (nav) {
      nav.classList.add("hs-unofficial-nav-host");
      const rect = nav.getBoundingClientRect();
      top = Math.max(0, Math.min(window.innerHeight - 80, Math.round(rect.bottom)));
    }

    page.style.setProperty("--hs-unofficial-page-top", `${top}px`);
  }

  function setCustomTabSelected(selected) {
    const nav = findSiteNav();
    if (!nav) return;

    const button = nav.querySelector(`[${TAB_ATTR}]`);
    if (button) {
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    }

    if (selected) {
      nav.querySelectorAll("[data-tab],[role='tab']").forEach((other) => {
        if (other !== button) {
          other.classList.remove("active");
          if (other.hasAttribute("aria-selected")) other.setAttribute("aria-selected", "false");
        }
      });
    }
  }

  function openPage(updateHash = true) {
    const page = ensurePage();
    if (location.hash !== APP_HASH) previousHash = location.hash;
    window.scrollTo(0, 0);
    positionPage();
    page.classList.add("active");
    page.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("hs-unofficial-app-open");
    setCustomTabSelected(true);
    updateWelcome();

    if (updateHash && location.hash !== APP_HASH) {
      history.pushState(null, "", APP_HASH);
    }
  }

  function closePage(restoreHash = false) {
    const page = document.getElementById(PAGE_ID);
    if (page) {
      page.classList.remove("active");
      page.setAttribute("aria-hidden", "true");
    }

    document.documentElement.classList.remove("hs-unofficial-app-open");
    setCustomTabSelected(false);

    if (restoreHash && location.hash === APP_HASH) {
      history.replaceState(null, "", previousHash || location.pathname + location.search);
    }
  }

  function bindCustomButton(button) {
    if (!button || button.dataset.hsBound === "true") return;
    button.dataset.hsBound = "true";

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPage(true);
      },
      true
    );
  }

  function ensureTab() {
    if (location.hostname !== "dmzranked.com" && !location.hostname.endsWith(".dmzranked.com")) return;

    const nav = findSiteNav();
    if (!nav) return;

    if (!nav.hasAttribute("role")) nav.setAttribute("role", "tablist");

    let button = nav.querySelector(`[${TAB_ATTR}]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "hs-unofficial-tab";
      button.setAttribute(TAB_ATTR, "true");
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", "false");
      button.textContent = "Unofficial App";
      nav.appendChild(button);
    }

    bindCustomButton(button);
    ensurePage();
    updateWelcome();

    if (location.hash === APP_HASH) {
      openPage(false);
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const nav = findSiteNav();
      if (!nav || !nav.contains(event.target)) return;
      const custom = event.target.closest(`[${TAB_ATTR}]`);
      if (!custom && document.getElementById(PAGE_ID)?.classList.contains("active")) {
        closePage(false);
      }
    },
    true
  );

  window.addEventListener("hashchange", () => {
    if (location.hash === APP_HASH) openPage(false);
    else closePage(false);
  });

  window.addEventListener("resize", () => {
    if (document.getElementById(PAGE_ID)?.classList.contains("active")) positionPage();
  });

  ensureTab();

  const observer = new MutationObserver(() => {
    ensureTab();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(updateWelcome, 1500);
  window.__dmzHsBetaTabsRefresh = ensureTab;
})();
