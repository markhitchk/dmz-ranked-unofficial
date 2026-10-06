/* DMZ Ranked Remote App UI v1
   Streamed by the Android app from this repository.
   Native code supplies window.__DMZ_APP_INFO before this runs. */

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

  const PUBLIC_STATE_URL = "https://dmzranked.com/api/v1/data/public-state";
  const SNAPSHOT_URL = "https://dmzranked.com/leaderboard.json";
  const APP_INFO = (window.__DMZ_APP_INFO && typeof window.__DMZ_APP_INFO === "object") ? window.__DMZ_APP_INFO : {};
  const APP_LOGO_URL = clean(APP_INFO.logoUrl) || "file:///android_res/drawable/dmz_ranked_logo.png";

  // Exact rank emblems used by dmzranked.com's leaderboard/profile UI.
  // Keep these tied to the website assets so Current/My Operator matches the site,
  // rather than depending on the separate OBS/ticker badge bundle.
  const SITE_RANK_BADGES = {
    Bronze1: "/assets/legacy/leaderboard-015-2808c49bc0d5.webp",
    Bronze2: "/assets/legacy/leaderboard-016-aab15b196781.webp",
    Bronze3: "/assets/legacy/leaderboard-017-2f667e976d25.webp",
    Silver1: "/assets/legacy/leaderboard-018-3670db732b01.webp",
    Silver2: "/assets/legacy/leaderboard-019-fabeb4b98e63.webp",
    Silver3: "/assets/legacy/leaderboard-020-024fab70c140.webp",
    Gold1: "/assets/legacy/leaderboard-021-ae25abe446ef.webp",
    Gold2: "/assets/legacy/leaderboard-022-1871fb11f48a.webp",
    Gold3: "/assets/legacy/leaderboard-023-d87ab61f5656.webp",
    Platinum1: "/assets/legacy/leaderboard-024-11058ef86ddc.webp",
    Platinum2: "/assets/legacy/leaderboard-025-b6dedd8835ef.webp",
    Platinum3: "/assets/legacy/leaderboard-026-969f97d0f03d.webp",
    Diamond1: "/assets/legacy/leaderboard-027-f69ddb397114.webp",
    Diamond2: "/assets/legacy/leaderboard-028-4d6d5c4cc2b6.webp",
    Diamond3: "/assets/legacy/leaderboard-029-39c25e869058.webp",
    Crimson1: "/assets/legacy/leaderboard-030-a0647cc76270.webp",
    Crimson2: "/assets/legacy/leaderboard-031-836e8c92b2f4.webp",
    Crimson3: "/assets/legacy/leaderboard-032-1ddce018435d.webp",
    Iridescent: "/assets/legacy/leaderboard-033-c86a3f83ab50.webp"
  };
  const TIERS = [
    { name: "Iridescent", min: 6000, fee: 100 },
    { name: "Crimson", min: 5000, fee: 75 },
    { name: "Diamond", min: 4000, fee: 60 },
    { name: "Platinum", min: 3000, fee: 45 },
    { name: "Gold", min: 2000, fee: 30 },
    { name: "Silver", min: 1000, fee: 15 },
    { name: "Bronze", min: 0, fee: 0 }
  ];
  let statsRequestInFlight = false;
  let lastStatsOperator = "";
  let lastStatsFetchMs = 0;
  let lastStats = null;

  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : "—";
  }

  function signedSr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return (n > 0 ? "+" : "") + n.toLocaleString() + " SR";
  }

  function tierFor(sr) {
    for (let i = 0; i < TIERS.length; i += 1) {
      if (sr >= TIERS[i].min) return { tier: TIERS[i], index: i };
    }
    return { tier: TIERS[TIERS.length - 1], index: TIERS.length - 1 };
  }

  function rankInfo(inputSr) {
    const sr = Math.max(0, Number(inputSr) || 0);
    const found = tierFor(sr);
    const tier = found.tier;
    const index = found.index;
    if (index === 0) return { label: tier.name, fee: tier.fee };
    const upper = TIERS[index - 1].min;
    const width = (upper - tier.min) / 3;
    let div = Math.floor((sr - tier.min) / Math.max(1, width));
    div = Math.max(0, Math.min(2, div));
    const roman = ["I", "II", "III"][div];
    return { label: tier.name + " " + roman, fee: tier.fee + (div * 5) };
  }

  function appChannelLabel() {
    const configured = clean(APP_INFO.channel).toUpperCase();
    if (configured === "BETA" || configured === "STABLE") return configured;
    const ua = String(navigator.userAgent || "");
    return /com\.harleytg\.dmzranked\.beta/i.test(ua) ? "BETA" : "STABLE";
  }

  function appChannelCopy() {
    return appChannelLabel() === "BETA" ? "Beta testing" : "Stable";
  }

  function appBuildLabel() {
    const version = clean(APP_INFO.versionName);
    const build = clean(APP_INFO.versionCode);
    if (version && build) return version + " (" + build + ")";
    return version || (build ? "Build " + build : "Current app build");
  }

  function channelClass() {
    return appChannelLabel() === "STABLE" ? " stable" : " beta";
  }

  function rankTierClass(label) {
    const tier = clean(label).split(/\s+/)[0].toLowerCase();
    return /^(bronze|silver|gold|platinum|diamond|crimson|iridescent)$/.test(tier)
      ? "tier-" + tier
      : "tier-default";
  }

  function badgeKey(rankLabel) {
    const label = clean(rankLabel).toUpperCase();
    if (label.indexOf("IRIDESCENT") === 0) return "Iridescent";
    const parts = label.split(/\s+/);
    if (parts.length < 2) return "";
    const division = parts[1] === "I" ? "1" : parts[1] === "II" ? "2" : parts[1] === "III" ? "3" : "";
    if (!division) return "";
    const tier = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
    return tier + division;
  }

  function loadBadgeMap() {
    return Promise.resolve(SITE_RANK_BADGES);
  }

  async function renderRankBadge(stats) {
    const image = document.getElementById("hs-stat-rank-badge");
    const fallback = document.getElementById("hs-stat-rank-fallback");
    if (!image || !fallback) return;

    image.hidden = true;
    image.removeAttribute("src");
    fallback.hidden = false;
    fallback.className = "hs-stat-rank-fallback " + rankTierClass(stats && stats.rankLabel);
    fallback.textContent = stats ? stats.rankLabel : "DMZ";

    if (!stats) return;
    const key = badgeKey(stats.rankLabel);
    if (!key) return;

    try {
      const badges = await loadBadgeMap();
      const source = badges && badges[key];
      if (!source) return;
      if (!lastStats || lastStats.rankLabel !== stats.rankLabel || lastStats.position !== stats.position) return;
      image.onload = () => {
        image.hidden = false;
        fallback.hidden = true;
      };
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
      image.src = new URL(source, "https://dmzranked.com/").href;
    } catch (_) {
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  function grossRaid(raid, season2) {
    let earned = 0;
    if (raid.hasCarryover) earned += raid.carryover;
    earned += raid.operatorKills * 15;
    earned += Math.min(raid.squadKills, 10) * 3;
    if (raid.extracted) {
      earned += 20;
      if (raid.weaponCase) earned += 20;
      if (raid.fullSquad) earned += 10;
      if (raid.finalExfil) earned += 15;
    }
    if (raid.contract === "regular") earned += 10;
    else if (raid.contract === "hunt") earned += 20;
    if (season2) earned += Math.min(raid.bossKills, 2) * 10;
    return earned;
  }

  function awardAchievement(standing, key, value, thresholds) {
    let achieved = 0;
    thresholds.forEach((threshold) => {
      if (value >= threshold) achieved += 1;
    });
    const previous = standing.achievementLevels[key] || 0;
    if (achieved <= previous || previous >= 4) return 0;
    standing.achievementLevels[key] = previous + 1;
    return [25, 50, 100, 200][previous];
  }

  function achievementBonus(standing, season2) {
    let bonus = 0;
    bonus += awardAchievement(standing, "opk", standing.operatorKills, [40, 90, 150, 250]);
    bonus += awardAchievement(standing, "exf", standing.exfils, [8, 18, 32, 50]);
    bonus += awardAchievement(standing, "sqk", standing.squadKills, [20, 45, 90, 150]);
    bonus += awardAchievement(standing, "wc", standing.weaponCases, [4, 9, 18, 30]);
    bonus += awardAchievement(standing, "fin", standing.finalExfils, [3, 7, 14, 25]);
    bonus += awardAchievement(standing, "con", standing.contracts, [12, 28, 55, 100]);
    bonus += awardAchievement(standing, "raids", standing.raids, [10, 22, 40, 65]);
    if (season2) bonus += awardAchievement(standing, "boss", standing.bossKills, [4, 9, 18, 30]);
    if (standing.raids >= 10) {
      bonus += awardAchievement(standing, "kpr", standing.operatorKills / standing.raids, [0.5, 1.5, 4, 6]);
      bonus += awardAchievement(standing, "exfr", (standing.exfils / standing.raids) * 100, [45, 65, 82, 95]);
    }
    return bonus;
  }

  function normalizePayload(root) {
    if (root && root.data && root.data.players && root.data.raids && root.data.season) return root.data;
    if (root && root.players && root.raids && root.meta && root.meta.season) {
      return { players: root.players, raids: root.raids, season: root.meta.season };
    }
    return null;
  }

  function resolveOperatorStats(root, operatorName) {
    const data = normalizePayload(root);
    if (!data) return null;
    const season = data.season || {};
    const start = Number.isFinite(Number(season.start)) ? Number(season.start) : -Infinity;
    const end = Number.isFinite(Number(season.end)) ? Number(season.end) : Infinity;
    const season2 = Boolean(season.s2);
    const byId = new Map();

    (data.players || []).forEach((player) => {
      if (!player) return;
      const id = clean(player.id);
      if (!id) return;
      byId.set(id, {
        id,
        name: clean(player.name),
        sr: 0,
        peak: 0,
        last: 0,
        raids: 0,
        operatorKills: 0,
        squadKills: 0,
        exfils: 0,
        weaponCases: 0,
        finalExfils: 0,
        contracts: 0,
        bossKills: 0,
        achievementLevels: {}
      });
    });

    const raids = (data.raids || []).filter((raw) => {
      if (!raw || raw.pending || raw.deleted) return false;
      const ts = Number(raw.ts) || 0;
      return ts >= start && ts <= end;
    }).sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));

    raids.forEach((raw) => {
      const raid = {
        playerId: clean(raw.playerId),
        playerName: clean(raw.playerName),
        operatorKills: Number(raw.operatorKills) || 0,
        squadKills: Number(raw.squadKills) || 0,
        bossKills: Number(raw.bossKills) || 0,
        extracted: Boolean(raw.extracted),
        finalExfil: Boolean(raw.finalExfil),
        fullSquad: Boolean(raw.fullSquad),
        weaponCase: Boolean(raw.weaponCase),
        contract: clean(raw.contract || "none").toLowerCase(),
        hasCarryover: Object.prototype.hasOwnProperty.call(raw, "carryover") && raw.carryover != null,
        carryover: Number(raw.carryover) || 0
      };
      let standing = byId.get(raid.playerId);
      if (!standing) {
        standing = {
          id: raid.playerId,
          name: raid.playerName || "?",
          sr: 0,
          peak: 0,
          last: 0,
          raids: 0,
          operatorKills: 0,
          squadKills: 0,
          exfils: 0,
          weaponCases: 0,
          finalExfils: 0,
          contracts: 0,
          bossKills: 0,
          achievementLevels: {}
        };
        byId.set(raid.playerId, standing);
      }

      const before = standing.sr;
      const fee = rankInfo(before).fee;
      let earned = grossRaid(raid, season2);

      if (!raid.hasCarryover) {
        standing.raids += 1;
        standing.operatorKills += raid.operatorKills;
        standing.squadKills += raid.squadKills;
        if (raid.contract !== "none") standing.contracts += 1;
        if (raid.extracted) standing.exfils += 1;
        if (raid.finalExfil) standing.finalExfils += 1;
        if (raid.weaponCase && raid.extracted) standing.weaponCases += 1;
        if (season2) standing.bossKills += Math.min(raid.bossKills, 2);
        earned += achievementBonus(standing, season2);
      }

      const after = Math.max(0, before - fee + earned);
      standing.sr = after;
      standing.peak = Math.max(standing.peak, after);
      if (!raid.hasCarryover) standing.last = after - before;
    });

    const standings = Array.from(byId.values()).sort((a, b) => {
      if (b.sr !== a.sr) return b.sr - a.sr;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    const wanted = clean(operatorName).toLowerCase();
    const index = standings.findIndex((item) => clean(item.name).toLowerCase() === wanted);
    if (index < 0) return null;
    const mine = standings[index];
    return {
      name: mine.name,
      sr: mine.sr,
      peak: mine.peak,
      lastDelta: mine.last,
      position: index + 1,
      totalPlayers: standings.length,
      rankLabel: rankInfo(mine.sr).label,
      seasonName: clean(season.name)
    };
  }

  async function fetchStats(operatorName) {
    let primaryError = null;
    try {
      const response = await fetch(PUBLIC_STATE_URL, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const json = await response.json();
      const stats = resolveOperatorStats(json, operatorName);
      if (stats) return stats;
      primaryError = new Error("Operator not found");
    } catch (error) {
      primaryError = error;
    }

    try {
      const response = await fetch(SNAPSHOT_URL, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const stats = resolveOperatorStats(await response.json(), operatorName);
      if (stats) return stats;
      throw primaryError || new Error("Operator not found");
    } catch (error) {
      throw primaryError || error;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setStatsState(state, operator, stats) {
    const status = document.getElementById("hs-stat-state");
    if (status) {
      status.className = "hs-stat-state " + state;
      status.textContent = state === "live" ? "LIVE" : state === "loading" ? "SYNCING" : state === "empty" ? "NO OPERATOR" : "OFFLINE";
    }
    setText("hs-stat-operator", operator || "Select an operator");
    setText("hs-stat-rank", stats ? stats.rankLabel : "—");
    setText("hs-stat-sr", stats ? formatNumber(stats.sr) + " SR" : "—");
    setText("hs-stat-position", stats ? "#" + formatNumber(stats.position) + " / " + formatNumber(stats.totalPlayers) : "—");
    setText("hs-stat-last", stats ? signedSr(stats.lastDelta) : "—");
    setText("hs-stat-season", stats && stats.seasonName ? stats.seasonName : "DMZ Ranked");
    document.querySelectorAll("[data-hs-channel-badge]").forEach((el) => {
      el.textContent = appChannelLabel();
      el.classList.toggle("stable", appChannelLabel() === "STABLE");
    });
    renderRankBadge(stats);
    renderMessages(state, operator, stats);
  }

  function renderMessages(state, operator, stats) {
    const list = document.getElementById("hs-app-message-list");
    if (!list) return;
    const rows = [];
    if (!operator) {
      rows.push(["Operator", "Choose or restore an operator on this device to show live stats here."]);
    } else if (state === "loading") {
      rows.push(["Sync", "Reading the latest DMZ Ranked standings for " + operator + "…"]);
    } else if (state === "live" && stats) {
      rows.push(["Operator", operator + " is active on this device."]);
      rows.push(["Standing", stats.rankLabel + " · " + formatNumber(stats.sr) + " SR · #" + formatNumber(stats.position) + " of " + formatNumber(stats.totalPlayers) + "."]);
      rows.push(["Last raid", signedSr(stats.lastDelta) + " on the latest counted raid."]);
    } else {
      rows.push(["Connection", "Live standings are unavailable right now. The website can still be used normally."]);
    }
    rows.push(["Mobile QoL", "App navigation uses a touch-friendly grid for faster one-handed access."]);
    while (list.firstChild) list.removeChild(list.firstChild);
    rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "hs-app-message-item";
      const label = document.createElement("span");
      label.className = "hs-app-message-label";
      label.textContent = row[0];
      const copy = document.createElement("span");
      copy.className = "hs-app-message-copy";
      copy.textContent = row[1];
      item.appendChild(label);
      item.appendChild(copy);
      list.appendChild(item);
    });
  }

  async function updateStats(force) {
    const operator = getOperatorName();
    const now = Date.now();
    if (!operator) {
      lastStatsOperator = "";
      lastStats = null;
      setStatsState("empty", "", null);
      return;
    }
    if (!force && operator === lastStatsOperator && now - lastStatsFetchMs < 60000) {
      setStatsState(lastStats ? "live" : "error", operator, lastStats);
      return;
    }
    if (statsRequestInFlight) return;
    statsRequestInFlight = true;
    setStatsState("loading", operator, null);
    try {
      const stats = await fetchStats(operator);
      if (clean(getOperatorName()).toLowerCase() !== clean(operator).toLowerCase()) return;
      lastStatsOperator = operator;
      lastStats = stats;
      lastStatsFetchMs = Date.now();
      setStatsState("live", operator, stats);
    } catch (_) {
      lastStatsOperator = operator;
      lastStats = null;
      lastStatsFetchMs = Date.now();
      setStatsState("error", operator, null);
    } finally {
      statsRequestInFlight = false;
    }
  }

  function ensureGlobalStats() {
    let host = document.getElementById("dmz-hs-active-user-stats");
    if (!host) {
      host = document.createElement("div");
      host.id = "dmz-hs-active-user-stats";
      host.setAttribute("aria-label", "DMZ Ranked active user standings");
      host.innerHTML =
        '<div class="hs-global-stats-card">' +
          '<div class="hs-global-stats-heading">' +
            '<div><div class="hs-app-eyebrow">Active user standings</div><div class="hs-global-stats-title">This Device Operator</div></div>' +
            '<div class="hs-app-heading-actions">' +
              '<span class="hs-app-channel-badge" data-hs-channel-badge>' + appChannelLabel() + '</span>' +
              '<span class="hs-stat-state loading" id="hs-stat-state">SYNCING</span>' +
              '<button type="button" class="hs-stat-refresh" id="hs-stat-refresh" aria-label="Refresh active operator standings">↻</button>' +
            '</div>' +
          '</div>' +
          '<div class="hs-global-stats-body">' +
            '<div class="hs-stat-badge-shell">' +
              '<img id="hs-stat-rank-badge" class="hs-stat-rank-badge" alt="Operator rank badge" hidden>' +
              '<div id="hs-stat-rank-fallback" class="hs-stat-rank-fallback tier-default">DMZ</div>' +
            '</div>' +
            '<div class="hs-stat-grid">' +
              '<div class="hs-stat-tile wide"><span class="hs-stat-label">Operator</span><strong id="hs-stat-operator">Checking…</strong></div>' +
              '<div class="hs-stat-tile"><span class="hs-stat-label">Rank</span><strong id="hs-stat-rank">—</strong></div>' +
              '<div class="hs-stat-tile"><span class="hs-stat-label">SR</span><strong id="hs-stat-sr">—</strong></div>' +
              '<div class="hs-stat-tile"><span class="hs-stat-label">Position</span><strong id="hs-stat-position">—</strong></div>' +
              '<div class="hs-stat-tile"><span class="hs-stat-label">Last raid</span><strong id="hs-stat-last">—</strong></div>' +
            '</div>' +
          '</div>' +
          '<div class="hs-stat-footer"><span class="hs-app-dot"></span><span id="hs-stat-season">DMZ Ranked</span> · live public standings</div>' +
        '</div>';

      const refresh = host.querySelector("#hs-stat-refresh");
      if (refresh) refresh.addEventListener("click", () => updateStats(true));
    }

    const message = document.getElementById("dmz-harleys-studios-app-message");
    if (message && message.parentNode) {
      if (host.previousElementSibling !== message) message.insertAdjacentElement("afterend", host);
      const copy = message.querySelector(".dmz-hs-copy");
      if (copy && !copy.querySelector(".dmz-hs-channel-badge")) {
        const badge = document.createElement("span");
        badge.className = "dmz-hs-channel-badge";
        badge.setAttribute("data-hs-channel-badge", "true");
        badge.textContent = appChannelLabel();
        copy.appendChild(document.createTextNode(" "));
        copy.appendChild(badge);
      }
    } else if (!host.parentNode) {
      const nav = findSiteNav();
      if (nav && nav.parentNode) nav.parentNode.insertBefore(host, nav);
    }

    return host;
  }

  function decorateTabButton(button) {
    if (!button) return;
    const channel = appChannelLabel();
    button.classList.add("hs-unofficial-tab");
    button.setAttribute("aria-label", "DMZ Ranked App [Unofficial]");
    while (button.firstChild) button.removeChild(button.firstChild);

    const logo = document.createElement("img");
    logo.className = "hs-unofficial-tab-logo";
    logo.alt = "";
    logo.src = APP_LOGO_URL;
    logo.addEventListener("error", () => logo.classList.add("failed"), { once: true });

    const label = document.createElement("span");
    label.className = "hs-unofficial-tab-label";
    label.textContent = "DMZ Ranked App [Unofficial]";

    button.appendChild(logo);
    button.appendChild(label);

    // The navigation tag is intentionally Beta-only. Stable keeps the same
    // transparent logo + Unofficial label without an extra release badge.
    if (channel === "BETA") {
      const badge = document.createElement("span");
      badge.className = "hs-unofficial-tab-channel";
      badge.setAttribute("data-hs-channel-badge", "true");
      badge.textContent = "BETA";
      button.appendChild(badge);
    }
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
    const next = operator ? "Welcome back, " + operator + "." : "Welcome, Guest.";
    if (welcome.textContent !== next) welcome.textContent = next;
    if (operator !== lastStatsOperator || !lastStats) updateStats(false);
  }

  function ensureSection(nav) {
    let section = document.getElementById(TAB);
    if (section) return section;

    const wrap = findWrap(nav);
    if (!wrap) return null;

    section = document.createElement("section");
    section.id = TAB;
    section.setAttribute("aria-label", "DMZ Ranked App [Unofficial]");
    section.innerHTML =
      '<div class="card hs-app-messages">' +
        '<div class="hs-app-heading-row">' +
          '<div><div class="hs-app-eyebrow">App messages</div><h2 class="section-title">Messages</h2></div>' +
          '<span class="hs-exclusive-badge">APP EXCLUSIVE</span>' +
        '</div>' +
        '<div class="hs-exclusive-note"><b>DMZ Ranked App Exclusive System</b> — these messages are created by the Android app for app status and QoL information. They are not official dmzranked.com announcements.</div>' +
        '<div id="hs-app-message-list" class="hs-app-message-list"></div>' +
      '</div>' +

      '<div class="sect-hero camp">' +
        '<h2>DMZ Ranked App [Unofficial]<small>Harley\'s Studios · Android ' + appChannelLabel() + '</small></h2>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title" id="hs-unofficial-welcome">Welcome, Guest.</h2>' +
        '<p class="hs-app-intro"><b>DMZ Ranked App [Unofficial]</b> is Harley\'s Studios Android experience built around dmzranked.com. This page contains app-only information and tools while the DMZ Ranked website continues to run normally.</p>' +
        '<div class="hs-app-meta">' +
          '<span class="hs-app-pill' + channelClass() + '" data-hs-channel-badge>' + appChannelLabel() + '</span>' +
          '<span class="hs-app-pill">' + appBuildLabel() + '</span>' +
          '<span class="hs-app-pill">Harley\'s Studios</span>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title">App Status</h2>' +
        '<div class="hs-app-row"><div class="hs-app-label">Website</div><div class="hs-app-value"><span class="hs-app-status"><span class="hs-app-dot"></span>dmzranked.com loaded in the app</span></div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Release channel</div><div class="hs-app-value">' + appChannelCopy() + '</div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Build</div><div class="hs-app-value">' + appBuildLabel() + '</div></div>' +
        '<div class="hs-app-row"><div class="hs-app-label">Developer</div><div class="hs-app-value">Harley\'s Studios</div></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="section-title">App Features</h2>' +
        '<ul class="hs-app-list">' +
          '<li><b>Mobile grid navigation</b> makes every website section easier to reach without horizontal scrolling.</li>' +
          '<li><b>Active operator stats</b> bring rank, SR, position, and last raid change to the top of this app-only page.</li>' +
          '<li><b>Android notifications</b> surface reports, reviews, approvals, raids, updates, and system alerts.</li>' +
          '<li><b>Operator detection</b> lets app-only features recognize the operator saved on this device.</li>' +
        '</ul>' +
      '</div>' +

      '<div class="card hs-app-notice">' +
        '<h2 class="section-title">About This Page</h2>' +
        '<p>This DMZ Ranked App tab exists only inside Harley\'s Studios Android app. It is injected by the Android Beta app and does not edit, upload to, or modify the dmzranked.com website.</p>' +
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
      nav.appendChild(button);
    }

    decorateTabButton(button);
    const section = ensureSection(nav);
    ensureGlobalStats();
    bindButton(button, section);
    updateWelcome();
    updateStats(false);
  }

  ensureTab();

  const observer = new MutationObserver(() => {
    if (!document.querySelector(`.wrap nav.tabs [${TAB_ATTR}]`) || !document.getElementById(TAB) || !document.getElementById("dmz-hs-active-user-stats")) {
      ensureTab();
    } else {
      ensureGlobalStats();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(updateWelcome, 1500);
  window.__dmzHsBetaTabsRefresh = ensureTab;
})();

(function(){
  try{
    if(window.__hsAppQolInstalled){return 'already';}
    window.__hsAppQolInstalled=true;

    function q(sel){try{return document.querySelector(sel);}catch(e){return null;}}
    function qa(sel){try{return Array.prototype.slice.call(document.querySelectorAll(sel));}catch(e){return [];}}
    function visible(el){if(!el)return false;var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}

    var top=document.createElement('button');
    top.id='hs-app-back-top';
    top.type='button';
    top.setAttribute('aria-label','Back to top');
    top.setAttribute('title','Back to top');
    top.textContent='↑';
    top.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
    (document.body||document.documentElement).appendChild(top);

    function updateTop(){
      var y=window.scrollY||document.documentElement.scrollTop||0;
      if(y>700)top.classList.add('hs-show'); else top.classList.remove('hs-show');
    }
    window.addEventListener('scroll',updateTop,{passive:true});
    updateTop();

    function centerActiveTab(){
      if(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)return;
      var tabs=q('.tabs');
      if(!tabs)return;
      var active=q('.tabs .active,.tabs [aria-selected="true"],.tabs .selected,.tabs .current');
      if(active&&visible(active)){
        try{active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}catch(e){}
      }
    }
    document.addEventListener('click',function(ev){
      var t=ev.target&&ev.target.closest?ev.target.closest('.tabs button,.tabs a,.tabs [role="button"]'):null;
      if(t)setTimeout(centerActiveTab,80);
    },true);

    var observer=new MutationObserver(function(){centerActiveTab();});
    var tabs=q('.tabs');
    if(tabs)observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
    centerActiveTab();

    // Keep focused form controls visible above the keyboard and app chrome.
    document.addEventListener('focusin',function(ev){
      var el=ev.target;
      if(!el||!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;
      setTimeout(function(){try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}},180);
    });

    return 'installed';
  }catch(e){return 'error:'+String(e&&e.message||e);}
})();
