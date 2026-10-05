(() => {
  const defaultTab = "board";
  const tabOrder = [
    "board",
    "howto",
    "log",
    "community",
    "championship",
    "history",
    "rules",
    "updates",
    "overlays",
    "contact",
    "app"
  ];
  let currentTab = defaultTab;

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

  function updateAppWelcome() {
    const welcome = document.getElementById("hs-app-welcome");
    if (!welcome) return;
    const operator = getOperatorName();
    welcome.textContent = operator ? `Welcome back, ${operator}!` : "Welcome, Guest!";
  }

  function ensureBetaAppTab() {
    if (location.hostname !== "dmzranked.com" && !location.hostname.endsWith(".dmzranked.com")) return;

    const nav = document.querySelector("nav.tabs, .tabs[role='tablist'], .tabs");
    if (!nav) return;

    if (!nav.hasAttribute("role")) nav.setAttribute("role", "tablist");

    let button = nav.querySelector('[data-tab="app"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "hs-app-tab";
      button.dataset.tab = "app";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", "false");
      button.textContent = "App";
      nav.appendChild(button);
    }

    let panel = document.getElementById("app");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "app";
      panel.className = "tab-section hs-app-panel";
      panel.setAttribute("role", "tabpanel");
      panel.innerHTML =
        '<div class="hs-app-card">' +
        '<div class="hs-app-kicker">Harley\'s Studios • Beta Test</div>' +
        '<h2 id="hs-app-welcome">Welcome, Guest!</h2>' +
        '<p>Thank you for using Harley\'s Studios DMZ Ranked Unofficial App.</p>' +
        '<p class="hs-app-note">This tab is added only by the Android Beta app. It does not modify or affect the dmzranked.com website.</p>' +
        "</div>";
      const parent = document.querySelector("main") || nav.parentElement || document.body;
      parent.appendChild(panel);
    }

    updateAppWelcome();
  }

  function setTab(tab, updateHash = true) {
    const nav = document.querySelector("nav.tabs, .tabs[role='tablist'], .tabs");
    if (!nav || !tabOrder.includes(tab)) tab = defaultTab;

    currentTab = tab;

    nav.querySelectorAll("[data-tab]").forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    tabOrder.forEach((name) => {
      const panel = document.getElementById(name);
      if (!panel) return;
      const active = name === tab;
      panel.classList.toggle("active", active);
      if (panel.classList.contains("tab-section") || name === "app") {
        panel.hidden = !active;
      }
    });

    if (updateHash && location.hash !== `#${tab}`) {
      location.hash = tab;
    }

    if (tab === "app") updateAppWelcome();
  }

  function showSub(sub) {
    const community = document.getElementById("community");
    if (!community) return;

    const buttons = Array.from(community.querySelectorAll("[data-sub]"));
    const available = buttons.map((button) => button.dataset.sub);
    const target = available.includes(sub) ? sub : available[0];
    if (!target) return;

    buttons.forEach((button) => {
      const active = button.dataset.sub === target;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    community.querySelectorAll(".subpanel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `sub-${target}`);
    });
  }

  function bind() {
    ensureBetaAppTab();
    const nav = document.querySelector("nav.tabs, .tabs[role='tablist'], .tabs");
    if (!nav || nav.dataset.hsBetaTabsBound === "true") return;

    nav.dataset.hsBetaTabsBound = "true";
    nav.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("[data-tab]");
        if (!button || !nav.contains(button)) return;

        const tab = button.dataset.tab;
        if (!tabOrder.includes(tab)) return;

        if (tab === "app") {
          event.preventDefault();
          event.stopPropagation();
        }

        setTab(tab);
      },
      true
    );

    const community = document.getElementById("community");
    if (community && community.dataset.hsSubtabsBound !== "true") {
      community.dataset.hsSubtabsBound = "true";
      community.addEventListener("click", (event) => {
        const button = event.target.closest("[data-sub]");
        if (!button || !community.contains(button)) return;
        showSub(button.dataset.sub);
      });
      const firstSub = community.querySelector("[data-sub]");
      if (firstSub) showSub(firstSub.dataset.sub);
    }

    const hashTab = clean(location.hash.replace(/^#/, ""));
    setTab(tabOrder.includes(hashTab) ? hashTab : defaultTab, false);
  }

  bind();
  window.addEventListener("hashchange", () => {
    const hashTab = clean(location.hash.replace(/^#/, ""));
    setTab(tabOrder.includes(hashTab) ? hashTab : defaultTab, false);
  });
  window.showSub = showSub;
  window.__dmzHsBetaTabsRefresh = () => {
    ensureBetaAppTab();
    updateAppWelcome();
  };

  const observer = new MutationObserver(() => {
    ensureBetaAppTab();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(updateAppWelcome, 1500);
})();
