/* DMZ Ranked Remote App UI v1
   Streamed by the Android app from this repository.
   Native code supplies window.__DMZ_APP_INFO before this runs. */

(() => {
  const TAB = "unofficial-app";
  const TAB_ATTR = "data-hs-unofficial-app";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function openNativeAppSettings(target) {
    const section = clean(target).toLowerCase().replace(/[\s_]+/g, "-");
    try {
      if (
        window.HarleysStudiosApp &&
        typeof window.HarleysStudiosApp.openSettings === "function"
      ) {
        window.HarleysStudiosApp.openSettings(section);
        return true;
      }
    } catch (_) {}

    try {
      window.location.href =
        section === "all" || section === "settings"
          ? "dmzranked://settings"
          : "dmzranked://settings/" + encodeURIComponent(section);
      return true;
    } catch (_) {
      return false;
    }
  }

  function settingsShortcutMarkup(label, target, url, wide) {
    return (
      '<button type="button" class="hs-app-settings-shortcut' +
      (wide ? ' hs-app-settings-all' : '') +
      '" data-hs-open-settings="' + target + '">' +
        '<span class="hs-app-settings-shortcut-label">' + label + '</span>' +
        '<small class="hs-app-settings-shortcut-url">' + url + '</small>' +
      '</button>'
    );
  }

  function settingsAliasMarkup(url) {
    return '<code class="hs-app-settings-alias">' + url + '</code>';
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
  const APP_LOGO_FALLBACK_URL = "https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/app/src/main/logo/png/dmz_ranked_logo.png";
  const HARLEYS_STUDIOS_LOGO_URL = "data:image/png;base64,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";
  const IOS_SUPPORT_KOFI_URL = "https://ko-fi.com/harleytg_#checkoutModal";
  const IOS_SUPPORT_APP_LINK = "dmzranked-support://open?url=" + encodeURIComponent(IOS_SUPPORT_KOFI_URL);

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

    fallback.className = "hs-stat-rank-fallback " + rankTierClass(stats && stats.rankLabel);
    fallback.textContent = stats ? stats.rankLabel : "DMZ";

    function showFallback() {
      image.onload = null;
      image.onerror = null;
      image.hidden = true;
      image.removeAttribute("src");
      if (image.dataset) {
        delete image.dataset.hsRankSource;
        delete image.dataset.hsRankPending;
      }
      fallback.hidden = false;
    }

    if (!stats) {
      showFallback();
      return;
    }

    const key = badgeKey(stats.rankLabel);
    if (!key) {
      showFallback();
      return;
    }

    try {
      const badges = await loadBadgeMap();
      const source = badges && badges[key];
      if (!source) {
        showFallback();
        return;
      }
      if (!lastStats || badgeKey(lastStats.rankLabel) !== key) return;

      const href = new URL(source, "https://dmzranked.com/").href;
      let currentSource = "";
      try {
        currentSource =
          (image.dataset && image.dataset.hsRankSource) ||
          image.currentSrc ||
          image.getAttribute("src") ||
          "";
        if (currentSource) {
          currentSource = new URL(currentSource, "https://dmzranked.com/").href;
        }
      } catch (_) {
        currentSource = "";
      }

      if (currentSource === href && !image.hidden) {
        if (image.dataset) {
          image.dataset.hsRankSource = href;
          delete image.dataset.hsRankPending;
        }
        fallback.hidden = true;
        return;
      }

      const pendingSource =
        image.dataset && image.dataset.hsRankPending
          ? image.dataset.hsRankPending
          : "";
      if (pendingSource === href) {
        if (!image.hidden && currentSource) fallback.hidden = true;
        return;
      }

      if (image.dataset) image.dataset.hsRankPending = href;

      const hasVisibleBadge = !image.hidden && Boolean(currentSource);
      if (hasVisibleBadge) {
        fallback.hidden = true;
      } else {
        image.hidden = true;
        fallback.hidden = false;
      }

      const preloader = new Image();
      preloader.onload = () => {
        if (
          image.dataset &&
          image.dataset.hsRankPending &&
          image.dataset.hsRankPending !== href
        ) return;
        if (!lastStats || badgeKey(lastStats.rankLabel) !== key) return;

        image.onload = null;
        image.onerror = null;
        image.src = href;
        if (image.dataset) {
          image.dataset.hsRankSource = href;
          delete image.dataset.hsRankPending;
        }
        image.hidden = false;
        fallback.hidden = true;
      };
      preloader.onerror = () => {
        if (
          image.dataset &&
          image.dataset.hsRankPending &&
          image.dataset.hsRankPending !== href
        ) return;
        if (image.dataset) delete image.dataset.hsRankPending;
        image.hidden = true;
        fallback.hidden = false;
      };
      preloader.src = href;
    } catch (_) {
      if (image.dataset) delete image.dataset.hsRankPending;
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
    const badgeStats =
      stats ||
      (state === "loading" &&
      operator &&
      clean(operator).toLowerCase() === clean(lastStatsOperator).toLowerCase()
        ? lastStats
        : null);
    renderRankBadge(badgeStats);
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

  function enhanceWelcomeMessage() {
    const message = document.getElementById("dmz-harleys-studios-app-message");
    if (!message) return;

    const channel = appChannelLabel();
    const showBeta = channel === "BETA";
    const operator = getOperatorName();
    message.setAttribute("data-hs-operator", operator || "");
    const signature = channel + "|" + APP_LOGO_URL + "|" + operator;
    const existingWelcome = message.querySelector(".dmz-hs-welcome");
    if (
      message.dataset.hsProfessionalWelcome === signature &&
      existingWelcome &&
      clean(existingWelcome.textContent)
    ) return;

    const welcome = document.createElement("div");
    welcome.className = "dmz-hs-welcome";
    welcome.id = "dmz-hs-welcome";
    if (operator) {
      welcome.appendChild(document.createTextNode("Welcome back, "));
      const name = document.createElement("span");
      name.className = "dmz-hs-name";
      name.textContent = operator;
      welcome.appendChild(name);
      welcome.appendChild(document.createTextNode("!"));
    } else {
      welcome.textContent = "Welcome, Guest!";
    }

    const thanks = document.createElement("div");
    thanks.className = "dmz-hs-thanks";
    thanks.innerHTML = 'Thank you for using <span class="dmz-hs-name">Harley\'s Studios</span>';

    const appLine = document.createElement("div");
    appLine.className = "dmz-hs-app-line";

    const logo = document.createElement("img");
    logo.className = "dmz-hs-app-logo";
    logo.alt = "DMZ Ranked app logo";
    logo.src = APP_LOGO_URL;
    logo.onerror = function () {
      if (this.src !== APP_LOGO_FALLBACK_URL) this.src = APP_LOGO_FALLBACK_URL;
    };

    const title = document.createElement("span");
    title.className = "dmz-hs-app-title";
    title.textContent = "DMZ Ranked Unofficial App";

    appLine.appendChild(logo);
    appLine.appendChild(title);

    if (showBeta) {
      const beta = document.createElement("span");
      beta.className = "dmz-hs-app-beta";
      beta.textContent = "BETA";
      appLine.appendChild(beta);
    }

    const note = document.createElement("div");
    note.className = "dmz-hs-note";
    note.textContent = "App-only display override — this does not modify or affect the dmzranked.com website.";

    while (message.firstChild) message.removeChild(message.firstChild);
    message.appendChild(welcome);
    message.appendChild(thanks);
    message.appendChild(appLine);
    message.appendChild(note);
    message.dataset.hsProfessionalWelcome = signature;
  }

  function ensureGlobalStats() {
    enhanceWelcomeMessage();
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
    } else if (!host.parentNode) {
      const nav = findSiteNav();
      if (nav && nav.parentNode) nav.parentNode.insertBefore(host, nav);
    }

    return host;
  }

  function elementIsVisible(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        el.getClientRects().length > 0;
    } catch (_) {
      return false;
    }
  }

  // Mirror the website's own notification indicators. DMZ Ranked currently
  // exposes tab dots for Community, Updates and Watch, plus a numeric Under
  // Review badge. The app does not invent unread state; it only reflects what
  // the loaded website is already showing.
  const APP_NOTIFICATION_SEEN_KEY = "hs_dmz_app_seen_website_notifications";

  function safeWebsiteNotificationValue(name, fallback) {
    try {
      const fn = window[name];
      if (typeof fn === "function") {
        const value = fn();
        return clean(value == null ? fallback : value);
      }
    } catch (_) {}
    return clean(fallback);
  }

  function websiteNotificationState() {
    const active = [];
    const seen = new Set();

    // Use the website's own top-level dots as the source of truth, but include
    // the website's underlying version/count where available. That means a new
    // Community report or changelog version can light the App dot again even if
    // the website dot was already active before.
    [
      { id: "communityDot", value: () => safeWebsiteNotificationValue("watchTotal", "1") },
      { id: "updatesDot", value: () => safeWebsiteNotificationValue("newestChangelogV", "1") }
    ].forEach((item) => {
      const dot = document.getElementById(item.id);
      if (dot && elementIsVisible(dot)) {
        active.push(item.id + ":" + item.value());
        seen.add(dot);
      }
    });

    // Future-proof any additional top-level site notification dot.
    const nav = findSiteNav();
    if (nav) {
      nav.querySelectorAll(".tab-dot").forEach((dot) => {
        // Never count the App tab's own aggregate dot as a website notification.
        // Otherwise it changes the fingerprint when hidden, then re-triggers itself.
        if (
          seen.has(dot) ||
          !elementIsVisible(dot) ||
          dot.classList.contains("hs-unofficial-tab-notify") ||
          (dot.closest && dot.closest("[data-hs-unofficial-app]"))
        ) return;
        const owner = dot.closest("[data-tab]");
        const key = clean(dot.id || (owner && owner.getAttribute("data-tab")) || "site");
        active.push(key + ":1");
        seen.add(dot);
      });
    }

    active.sort();
    return {
      count: active.length,
      fingerprint: active.join("|")
    };
  }

  function websiteNotificationCount() {
    return websiteNotificationState().count;
  }

  function readAppNotificationSeen() {
    try {
      return clean(localStorage.getItem(APP_NOTIFICATION_SEEN_KEY));
    } catch (_) {
      return "";
    }
  }

  function markAppNotificationsSeen() {
    const state = websiteNotificationState();
    try {
      localStorage.setItem(APP_NOTIFICATION_SEEN_KEY, state.fingerprint);
    } catch (_) {}
    return state;
  }

  function renderTabNotification(button) {
    if (!button) return;
    const state = websiteNotificationState();
    const appTabActive = button.classList.contains("active") || button.getAttribute("aria-selected") === "true";

    // Match the site's tab behavior: once the App tab itself is being viewed,
    // its aggregate dot is acknowledged and stays cleared for the current state.
    if (appTabActive) {
      try {
        localStorage.setItem(APP_NOTIFICATION_SEEN_KEY, state.fingerprint);
      } catch (_) {}
    }

    const seenFingerprint = appTabActive ? state.fingerprint : readAppNotificationSeen();
    const hasUnreadForApp = !appTabActive && state.count > 0 && state.fingerprint !== seenFingerprint;
    let badge = button.querySelector(".hs-unofficial-tab-notify");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "tab-dot hs-unofficial-tab-notify";
      badge.setAttribute("aria-label", "Website notifications");
      badge.hidden = true;
      button.appendChild(badge);
    }

    if (hasUnreadForApp) {
      badge.textContent = "";
      badge.hidden = false;
      badge.title = state.count + " new website notification" + (state.count === 1 ? "" : "s");
      badge.setAttribute("aria-label", badge.title);
      button.classList.add("has-site-notifications");
      button.setAttribute("data-hs-site-notification-count", String(state.count));
    } else {
      badge.textContent = "";
      badge.hidden = true;
      badge.removeAttribute("title");
      badge.setAttribute("aria-label", "Website notifications");
      button.classList.remove("has-site-notifications");
      button.removeAttribute("data-hs-site-notification-count");
    }
  }

  function compactSeasonText(el) {
    return clean(el && (el.innerText || el.textContent));
  }

  // App-only presentation: combine DMZ Ranked's season artwork/details and its
  // live countdown into one short mobile header. The website remains the data
  // source; its original #seasonBanner/#seasonBar continue rendering underneath
  // and are hidden only after this compact mirror is ready.
  function syncCompactSeasonHeader() {
    const board = document.getElementById("board");
    if (!board) return;

    const bannerHost = document.getElementById("seasonBanner");
    const barHost = document.getElementById("seasonBar");
    const banner = bannerHost && bannerHost.querySelector(".season-banner");
    const bar = barHost && barHost.querySelector(".season-bar");
    if (!bannerHost || !barHost || !banner || !bar) {
      board.classList.remove("hs-compact-season-ready");
      return;
    }

    const heroInner = document.querySelector("header.top .hero-inner");
    let compact = document.getElementById("hs-compact-season-header");
    if (!compact) {
      compact = document.createElement("div");
      compact.id = "hs-compact-season-header";
      compact.setAttribute("aria-label", "Current DMZ Ranked season");
    }

    // Put the app-only compact season card inside dmzranked.com's real hero so
    // the title/status/countdown read as one mobile header. Fall back to the
    // board if the website changes its header markup.
    if (heroInner) {
      if (compact.parentNode !== heroInner) heroInner.appendChild(compact);
      compact.classList.add("hs-season-in-hero");
    } else {
      if (compact.parentNode !== board) board.insertBefore(compact, bannerHost);
      compact.classList.remove("hs-season-in-hero");
    }

    const kicker = compactSeasonText(banner.querySelector(".sb-kicker")) || "Current season";
    const seasonName = compactSeasonText(banner.querySelector(".sb-name")) ||
      compactSeasonText(bar.querySelector(".s-name")) || "Season";
    const dateNode = bar.querySelector(".s-dates");
    const dateRange = compactSeasonText(dateNode) ||
      compactSeasonText(banner.querySelector(".sb-sub")) || "";
    const countdown = bar.querySelector("#seasonCountdown");
    const status = bar.querySelector(".s-status");

    const countdownHtml = countdown
      ? '<div class="hs-compact-season-count">' + countdown.innerHTML + '</div>'
      : '<div class="hs-compact-season-status">' + clean(status && status.textContent) + '</div>';

    const nextHtml =
      '<div class="hs-compact-season-copy">' +
        '<div class="hs-compact-season-kicker">' + kicker + '</div>' +
        '<div class="hs-compact-season-name">' + seasonName + '</div>' +
        '<div class="hs-compact-season-range">' + dateRange + '</div>' +
      '</div>' +
      countdownHtml;

    if (compact.innerHTML !== nextHtml) compact.innerHTML = nextHtml;

    const bg = clean(banner.style && banner.style.backgroundImage);
    if (bg) compact.style.setProperty("--hs-season-bg", bg);
    else compact.style.removeProperty("--hs-season-bg");

    compact.classList.toggle("hasimg", Boolean(bg));
    board.classList.add("hs-compact-season-ready");
  }

  function decorateTabButton(button) {
    if (!button) return;
    const channel = appChannelLabel();
    button.classList.add("hs-unofficial-tab");
    button.setAttribute("aria-label", "DMZ Ranked App [Unofficial]");
    while (button.firstChild) button.removeChild(button.firstChild);

    const logo = document.createElement("img");
    logo.className = "hs-unofficial-tab-logo";
    logo.alt = "DMZ Ranked";
    logo.src = APP_LOGO_URL;
    logo.addEventListener("error", () => {
      if (logo.src !== APP_LOGO_FALLBACK_URL) {
        logo.src = APP_LOGO_FALLBACK_URL;
        return;
      }
      logo.classList.add("failed");
    });

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

    renderTabNotification(button);
  }

  function siteNavLooksRight(nav) {
    if (!nav) return false;
    const expected = [
      "LEADERBOARD", "HOW TO PLAY", "LOG A RAID", "COMMUNITY", "CHAMPIONSHIP",
      "HISTORY", "RULES", "UPDATES", "OVERLAYS", "CONTACT"
    ];
    const controls = Array.from(nav.querySelectorAll("button,[role=\"button\"],a"));
    let matches = 0;
    controls.forEach((control) => {
      const label = clean(control.textContent).toUpperCase();
      if (expected.indexOf(label) >= 0) matches += 1;
    });
    return matches >= 4;
  }

  function findSiteNav() {
    const preferred = document.querySelector(".wrap nav.tabs");
    if (siteNavLooksRight(preferred)) {
      preferred.classList.add("hs-site-tabs");
      return preferred;
    }

    const candidates = Array.from(document.querySelectorAll("nav.tabs,.tabs"));
    for (const candidate of candidates) {
      if (!siteNavLooksRight(candidate)) continue;
      candidate.classList.add("hs-site-tabs");
      return candidate;
    }

    if (preferred) {
      preferred.classList.add("hs-site-tabs");
      return preferred;
    }
    return null;
  }

  function findWrap(nav) {
    return (nav && nav.closest(".wrap")) ||
      document.querySelector(".wrap") ||
      (nav && nav.parentElement) ||
      document.querySelector("main") ||
      document.body;
  }

  function updateWelcome() {
    enhanceWelcomeMessage();
    const welcome = document.getElementById("hs-unofficial-welcome");
    if (!welcome) return;
    const operator = getOperatorName();
    const next = operator ? "Welcome back, " + operator + "." : "Welcome, Guest.";
    if (welcome.textContent !== next) welcome.textContent = next;
    if (operator !== lastStatsOperator || !lastStats) updateStats(false);
  }

  function ensureSection(nav) {
    let section = document.getElementById(TAB);
    if (section) {
      const complete = Boolean(
        section.querySelector("#hs-app-message-list") &&
        section.querySelector("#hs-unofficial-welcome") &&
        section.querySelector(".hs-app-messages")
      );
      if (complete) {
        section.setAttribute("data-hs-app-section", "true");
        return section;
      }
      section.remove();
      section = null;
    }

    const wrap = findWrap(nav);
    if (!wrap) return null;

    section = document.createElement("section");
    section.id = TAB;
    section.setAttribute("aria-label", "DMZ Ranked App [Unofficial]");
    section.setAttribute("data-hs-app-section", "true");
    section.innerHTML =
      '<div class="hs-app-page-hero">' +
        '<div class="hs-app-page-hero-top">' +
          '<div class="hs-app-page-title-wrap">' +
            '<div class="hs-app-eyebrow">Harley\'s Studios Android</div>' +
            '<h2 class="hs-app-page-title">DMZ Ranked App <span>[Unofficial]</span></h2>' +
          '</div>' +
          '<span class="hs-app-channel-badge" data-hs-channel-badge>' + appChannelLabel() + '</span>' +
        '</div>' +
        '<div class="hs-app-page-tagline">Climb the ranks · Earn SR · Prove you\'re the best</div>' +
        '<div class="hs-app-page-welcome" id="hs-unofficial-welcome">Welcome, Guest.</div>' +
        '<p class="hs-app-page-summary">App-only status, tools and mobile quality-of-life features for dmzranked.com.</p>' +
        '<div class="hs-app-meta hs-app-page-meta">' +
          '<span class="hs-app-pill">' + appBuildLabel() + '</span>' +
          '<span class="hs-app-pill">Harley\'s Studios</span>' +
        '</div>' +
      '</div>' +

      '<div class="hs-app-dashboard-grid">' +
        '<div class="card hs-app-status-card">' +
          '<div class="hs-app-heading-row">' +
            '<div><div class="hs-app-eyebrow">Connection & build</div><h2 class="section-title">App Status</h2></div>' +
          '</div>' +
          '<div class="hs-app-status-grid">' +
            '<div class="hs-app-status-tile"><span class="hs-app-label">Website</span><strong><span class="hs-app-dot"></span>dmzranked.com</strong><small>Loaded in app</small></div>' +
            '<div class="hs-app-status-tile"><span class="hs-app-label">Channel</span><strong>' + appChannelCopy() + '</strong><small>' + appChannelLabel() + '</small></div>' +
            '<div class="hs-app-status-tile"><span class="hs-app-label">Build</span><strong>' + appBuildLabel() + '</strong><small>Current install</small></div>' +
            '<div class="hs-app-status-tile"><span class="hs-app-label">Developer</span><strong>Harley\'s Studios</strong><small>Unofficial Android app</small></div>' +
          '</div>' +
        '</div>' +

        '<div class="card hs-app-messages">' +
          '<div class="hs-app-heading-row">' +
            '<div><div class="hs-app-eyebrow">App messages</div><h2 class="section-title">Messages</h2></div>' +
            '<span class="hs-exclusive-badge">APP EXCLUSIVE</span>' +
          '</div>' +
          '<div class="hs-exclusive-note"><b>App Exclusive System</b> · Android app status and QoL information. These are not official dmzranked.com announcements.</div>' +
          '<div id="hs-app-message-list" class="hs-app-message-list"></div>' +
        '</div>' +
      '</div>' +

      '<div class="card hs-app-whats-new-card">' +
        '<div class="hs-app-heading-row">' +
          '<div><div class="hs-app-eyebrow">Latest app update</div><h2 class="section-title">What\'s New</h2></div>' +
          '<span class="hs-app-update-build">' + appBuildLabel() + '</span>' +
        '</div>' +
        '<div class="hs-app-whats-new-list">' +
          '<div class="hs-app-whats-new-item"><span class="hs-app-whats-new-icon">↗</span><div><strong>Website Donate Button</strong><span>The header Support button can now open the donation URL configured by dmzranked.com in your browser.</span></div></div>' +
          '<div class="hs-app-whats-new-item"><span class="hs-app-whats-new-icon">✓</span><div><strong>Protected Autofill</strong><span>Saved operators now use a compact Harley\'s Studios protected-autofill card with device verification and PIN controls.</span></div></div>' +
          '<div class="hs-app-whats-new-item"><span class="hs-app-whats-new-icon">⚡</span><div><strong>Faster App Loading</strong><span>The app no longer waits on slow website resources before showing usable content and applying app overrides.</span></div></div>' +
          '<div class="hs-app-whats-new-item"><span class="hs-app-whats-new-icon">◈</span><div><strong>CSS Override Reliability</strong><span>App-only styling now repairs itself if the website rebuilds part of the page.</span></div></div>' +
        '</div>' +
        '<div class="hs-app-whats-new-foot">Installed build: <b>' + appBuildLabel() + '</b> · Channel: <b>' + appChannelLabel() + '</b></div>' +
      '</div>' +

      '<div class="card hs-ios-support-app-card" id="hs-ios-support-app-card">' +
        '<div class="hs-ios-support-app-head">' +
          '<div class="hs-ios-support-app-logos" aria-hidden="true">' +
            '<img class="hs-ios-support-brand-logo" src="' + APP_LOGO_URL + '" alt="">' +
            '<img class="hs-ios-support-brand-logo hs-ios-support-studio-logo" src="' + HARLEYS_STUDIOS_LOGO_URL + '" alt="">' +
          '</div>' +
          '<div><div class="hs-app-eyebrow">Harley\'s Studios · iOS expansion</div><h2 class="section-title">Help bring DMZ Ranked to iOS</h2></div>' +
        '</div>' +
        '<p class="hs-ios-support-app-copy">We want to bring the unofficial DMZ Ranked App to <b>iPhone and iPad</b>. Voluntary support helps cover Apple development, testing, and publishing costs while Android development continues.</p>' +
        '<div class="hs-ios-support-app-note"><b>Android is staying.</b> This campaign only helps expand the app to Apple devices. Donations are voluntary and do not guarantee a release date.</div>' +
        '<a class="hs-app-action-btn hs-ios-support-app-action" href="' + IOS_SUPPORT_APP_LINK + '">Support the iOS release</a>' +
      '</div>' +

      '<div class="card hs-app-settings-card">' +
        '<div class="hs-app-heading-row">' +
          '<div><div class="hs-app-eyebrow">Website → native app</div><h2 class="section-title">App Settings Shortcuts</h2></div>' +
          '<span class="hs-exclusive-badge">APP EXCLUSIVE</span>' +
        '</div>' +
        '<p class="hs-app-settings-copy">Jump directly from the App page into a native DMZ Ranked settings area. The exact app URL is shown under each shortcut.</p>' +
        '<div class="hs-app-settings-grid">' +
          settingsShortcutMarkup("All App Settings", "all", "dmzranked://settings", true) +
          settingsShortcutMarkup("About", "about", "dmzranked://settings/about") +
          settingsShortcutMarkup("Build Details", "build", "dmzranked://settings/build") +
          settingsShortcutMarkup("Credits", "credits", "dmzranked://settings/credits") +
          settingsShortcutMarkup("Appearance", "appearance", "dmzranked://settings/appearance") +
          settingsShortcutMarkup("Display", "display", "dmzranked://settings/display") +
          settingsShortcutMarkup("Compact Mode", "compact", "dmzranked://settings/compact") +
          (String(APP_INFO.channel || "").toLowerCase() === "beta"
            ? settingsShortcutMarkup("Widgets", "widgets", "dmzranked://settings/widgets")
            : '') +
          settingsShortcutMarkup("App Experience", "experience", "dmzranked://settings/experience") +
          settingsShortcutMarkup("Operators", "operators", "dmzranked://settings/operators") +
          settingsShortcutMarkup("Notifications", "notifications", "dmzranked://settings/notifications") +
          settingsShortcutMarkup("App Updates", "updates", "dmzranked://settings/updates") +
          settingsShortcutMarkup("Page Actions", "page-actions", "dmzranked://settings/page-actions") +
          (String(APP_INFO.channel || "").toLowerCase() === "beta"
            ? settingsShortcutMarkup("Beta Program", "beta", "dmzranked://settings/beta")
            : '') +
          settingsShortcutMarkup("Website Tools", "website-tools", "dmzranked://settings/website-tools") +
          settingsShortcutMarkup("Support & Help", "support", "dmzranked://settings/support") +
          settingsShortcutMarkup("App Data Transfer", "transfer", "dmzranked://settings/transfer") +
          settingsShortcutMarkup("Danger Zone", "danger", "dmzranked://settings/danger") +
        '</div>' +
        '<details class="hs-app-settings-aliases">' +
          '<summary>Supported alternate URLs</summary>' +
          '<div class="hs-app-settings-alias-list">' +
            settingsAliasMarkup("dmzranked://settings/settings") +
            settingsAliasMarkup("dmzranked://settings/operator") +
            settingsAliasMarkup("dmzranked://settings/notification") +
            settingsAliasMarkup("dmzranked://settings/update") +
            settingsAliasMarkup("dmzranked://settings/page") +
            settingsAliasMarkup("dmzranked://settings/website") +
            settingsAliasMarkup("dmzranked://settings/help") +
          '</div>' +
        '</details>' +
      '</div>' +

      '<div class="card hs-app-features-card">' +
        '<div class="hs-app-heading-row">' +
          '<div><div class="hs-app-eyebrow">Built for mobile</div><h2 class="section-title">App Features</h2></div>' +
        '</div>' +
        '<div class="hs-app-feature-grid">' +
          '<div class="hs-app-feature"><strong>Mobile Navigation</strong><span>Touch-friendly grid with no horizontal tab scrolling.</span></div>' +
          '<div class="hs-app-feature"><strong>Operator Stats</strong><span>Rank, SR, position and latest raid at a glance.</span></div>' +
          '<div class="hs-app-feature"><strong>Notifications</strong><span>Reports, reviews, approvals, raids, updates and app alerts.</span></div>' +
          '<div class="hs-app-feature"><strong>Operator Detection</strong><span>Recognizes the operator saved on this device for app-only features.</span></div>' +
        '</div>' +
      '</div>' +

      '<details class="card hs-app-about">' +
        '<summary>About this app page</summary>' +
        '<p>This tab exists only inside Harley\'s Studios DMZ Ranked Android app. It adds app-only information and tools without editing or modifying the dmzranked.com website.</p>' +
      '</details>';

    section.addEventListener("click", (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest("[data-hs-open-settings]")
        : null;
      if (!target) return;
      event.preventDefault();
      openNativeAppSettings(target.getAttribute("data-hs-open-settings") || "all");
    });

    wrap.appendChild(section);
    return section;
  }

  function activateOurTab(button, section) {
    const nav = findSiteNav();
    const wrap = findWrap(nav);

    document.querySelectorAll("[data-tab]").forEach((item) => {
      item.classList.remove("active");
      if (item.hasAttribute("aria-selected")) item.setAttribute("aria-selected", "false");
    });
    (wrap || document).querySelectorAll("section").forEach((item) => item.classList.remove("active"));

    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    section.hidden = false;
    section.removeAttribute("aria-hidden");
    section.style.removeProperty("display");
    section.style.removeProperty("visibility");
    section.classList.add("active");

    // Opening the App tab acknowledges the App tab's aggregate notification dot,
    // just like opening Community or Updates acknowledges their own indicators.
    // This does NOT clear the website's Community/Updates dots; those remain
    // independent until the user opens those website sections.
    markAppNotificationsSeen();
    renderTabNotification(button);

    updateWelcome();
    ensureGlobalStats();
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
    nav.classList.add("hs-site-tabs");

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
    syncCompactSeasonHeader();
    bindButton(button, section);
    updateWelcome();
    updateStats(false);
  }

  ensureTab();

  const observer = new MutationObserver(() => {
    if (!document.querySelector(`nav.tabs.hs-site-tabs [${TAB_ATTR}]`) || !document.getElementById(TAB) || !document.getElementById("dmz-hs-active-user-stats")) {
      ensureTab();
    } else {
      ensureGlobalStats();
      syncCompactSeasonHeader();
      const appTab = document.querySelector(`nav.tabs.hs-site-tabs [${TAB_ATTR}]`);
      renderTabNotification(appTab);
    }
  });
  // Child-list changes are enough to recover the injected App tab/page.
  // Do NOT observe style/class attributes here: syncCompactSeasonHeader() updates
  // its own style/class values, and observing those attributes can create a
  // self-triggering MutationObserver loop that starves WebView rendering.
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setInterval(() => {
    // The native top message can be injected/rebuilt independently of the App
    // page, so always repair its dynamic Welcome line first.
    enhanceWelcomeMessage();

    const appTab = document.querySelector(`nav.tabs.hs-site-tabs [${TAB_ATTR}]`);
    const appSection = document.getElementById(TAB);
    const stats = document.getElementById("dmz-hs-active-user-stats");
    if (!appTab || !appSection || !stats) {
      ensureTab();
      return;
    }
    updateWelcome();
    syncCompactSeasonHeader();
    renderTabNotification(appTab);
  }, 1500);
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
      var tabs=q('.tabs');
      if(!tabs||!visible(tabs))return;
      var active=q('.tabs .active,.tabs [aria-selected="true"],.tabs .selected,.tabs .current');
      if(!active||!visible(active))return;
      // Do not use element.scrollIntoView() here. In Android desktop mode the
      // document is intentionally wider than the phone and scrollIntoView()
      // can move the whole page horizontally back toward the active tab.
      if(tabs.scrollWidth<=tabs.clientWidth+4)return;
      var left=active.offsetLeft-((tabs.clientWidth-active.offsetWidth)/2);
      var max=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
      left=Math.max(0,Math.min(max,left));
      try{tabs.scrollTo({left:left,behavior:'smooth'});}catch(e){tabs.scrollLeft=left;}
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


/* DMZ Ranked App Account/PIN UI v1
   App-only first-run setup, dedicated operator PIN manager and Ko-fi card.
   DMZ Ranked's existing player/PIN functions remain the source of truth. */
(function(){
  try{
    if(window.__hsAppAccountUiInstalled)return;
    window.__hsAppAccountUiInstalled=true;

    var FIRST_RUN_KEY="hs_dmz_app_get_started_v1";
    var KOFI_URL="https://ko-fi.com/harleytg_#checkoutModal";
    var APP_LOGO_URL=clean(window.__DMZ_APP_INFO&&window.__DMZ_APP_INFO.logoUrl)||"https://raw.githubusercontent.com/markhitchk/dmz-ranked-unofficial/main/app/src/main/logo/png/dmz_ranked_logo.png";
    var HARLEYS_STUDIOS_LOGO_URL="data:image/png;base64,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";
    var IOS_SUPPORT_CAMPAIGN_KEY="hs_dmz_ios_release_campaign_v2";
    var firstRunQueued=false;

    function q(sel){try{return document.querySelector(sel);}catch(e){return null;}}
    function qa(sel){try{return Array.prototype.slice.call(document.querySelectorAll(sel));}catch(e){return [];}}
    function clean(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
    function setTextIfChanged(el,value){
      if(!el)return;
      value=String(value==null?"":value);
      if(el.textContent!==value)el.textContent=value;
    }
    function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
    function getStore(key){try{return localStorage.getItem(key)||"";}catch(e){return "";}}
    function setStore(key,value){try{localStorage.setItem(key,value);}catch(e){}}
    function firstRunDone(){return getStore(FIRST_RUN_KEY)==="1";}
    function markFirstRun(){setStore(FIRST_RUN_KEY,"1");}

    function popupVisible(el){
      if(!el)return false;
      try{
        var style=window.getComputedStyle?window.getComputedStyle(el):null;
        if(style&&(style.display==="none"||style.visibility==="hidden"))return false;
      }catch(e){}
      return !el.hidden;
    }

    function hasBlockingPopup(){
      if(q(".hs-app-modal"))return true;
      var ids=["wnOverlay","clOverlay","seasonPop","profileModal","resultModal"];
      for(var i=0;i<ids.length;i++){
        if(popupVisible(q("#"+ids[i])))return true;
      }
      var siteModals=qa("body > .modal");
      for(var j=0;j<siteModals.length;j++){
        if(popupVisible(siteModals[j]))return true;
      }
      return false;
    }

    function shouldShowIosSupportPopup(){
      if(getStore(IOS_SUPPORT_CAMPAIGN_KEY)==="1")return false;
      if(!/Android/i.test(String(navigator.userAgent||"")))return false;
      if(hasBlockingPopup())return false;
      return true;
    }

    function iosSupportPopupMarkup(){
      return "<div class='hs-ios-support-card' role='dialog' aria-modal='true' aria-labelledby='hs-ios-support-title'>"+
        "<button type='button' class='hs-ios-support-close' data-hs-ios-dismiss='1' aria-label='Close'>×</button>"+
        "<div class='hs-ios-support-icon hs-ios-support-brand' aria-hidden='true'>"+
          "<img class='hs-ios-support-brand-logo' src='"+APP_LOGO_URL+"' alt=''>"+
          "<img class='hs-ios-support-brand-logo hs-ios-support-studio-logo' src='"+HARLEYS_STUDIOS_LOGO_URL+"' alt=''>"+
        "</div>"+
        "<div class='hs-ios-support-kicker'>Harley's Studios · DMZ Ranked App</div>"+
        "<h2 id='hs-ios-support-title'>Help bring DMZ Ranked to iOS</h2>"+
        "<p class='hs-ios-support-lead'>We want to bring the unofficial DMZ Ranked App to <b>iPhone and iPad</b>.</p>"+
        "<p>Voluntary support helps Harley's Studios cover the costs involved with preparing, testing, and publishing an Apple release while we keep improving the Android app.</p>"+
        "<div class='hs-ios-support-note'><b>Android is staying.</b> This campaign is specifically to help expand DMZ Ranked to Apple devices. Donations are voluntary and do not guarantee a release date.</div>"+
        "<div class='hs-ios-support-actions'>"+
          "<button type='button' class='hs-ios-support-primary' id='hs-ios-support-donate'>Support the iOS release</button>"+
          "<button type='button' class='hs-ios-support-secondary' data-hs-ios-dismiss='1'>Not now</button>"+
        "</div>"+
      "</div>";
    }

    function closeIosSupportPopup(){
      var overlay=q("#hs-ios-support-overlay");
      if(overlay&&overlay.parentNode)overlay.parentNode.removeChild(overlay);
      document.documentElement.classList.remove("hs-ios-support-open");
    }

    function showIosSupportPopup(){
      if(q("#hs-ios-support-overlay"))return;
      var overlay=document.createElement("div");
      overlay.id="hs-ios-support-overlay";
      overlay.className="hs-ios-support-overlay";
      overlay.innerHTML="<div class='hs-ios-support-backdrop' data-hs-ios-dismiss='1'></div>"+iosSupportPopupMarkup();

      function dismiss(){
        setStore(IOS_SUPPORT_CAMPAIGN_KEY,"1");
        closeIosSupportPopup();
      }

      overlay.querySelectorAll("[data-hs-ios-dismiss]").forEach(function(btn){
        btn.addEventListener("click",dismiss);
      });
      var donate=overlay.querySelector("#hs-ios-support-donate");
      if(donate){
        donate.addEventListener("click",function(){
          setStore(IOS_SUPPORT_CAMPAIGN_KEY,"1");
          closeIosSupportPopup();
          try{
            window.location.href="dmzranked-support://open?url="+encodeURIComponent(KOFI_URL);
          }catch(e){}
        });
      }

      (document.body||document.documentElement).appendChild(overlay);
      document.documentElement.classList.add("hs-ios-support-open");
      setStore(IOS_SUPPORT_CAMPAIGN_KEY,"1");
    }

    function maybeIosSupportPopup(){
      if(!shouldShowIosSupportPopup())return;
      showIosSupportPopup();
    }

    function currentOperator(){
      var input=q("#playerName");
      var value=clean(input&&(input.value||input.getAttribute("value")));
      return value||clean(getStore("dmz_myname"));
    }

    function operatorOptions(){
      var out=[],seen={};
      var pick=q("#playerPick");
      if(pick&&pick.options){
        Array.prototype.forEach.call(pick.options,function(opt,index){
          if(index===0)return;
          var value=clean(opt.value||opt.textContent),key=value.toLowerCase();
          if(value&&!seen[key]){seen[key]=true;out.push(value);}
        });
      }
      qa("#playerList option").forEach(function(opt){
        var value=clean(opt.value||opt.textContent),key=value.toLowerCase();
        if(value&&!seen[key]){seen[key]=true;out.push(value);}
      });
      return out;
    }

    function setOperator(name){
      name=clean(name);
      if(!name)return false;
      var input=q("#playerName");
      if(input){
        input.value=name;
        input.dispatchEvent(new Event("input",{bubbles:true}));
        input.dispatchEvent(new Event("change",{bubbles:true}));
      }
      var pick=q("#playerPick");
      if(pick&&pick.options){
        for(var i=0;i<pick.options.length;i++){
          var value=clean(pick.options[i].value||pick.options[i].textContent);
          if(value.toLowerCase()===name.toLowerCase()){
            pick.selectedIndex=i;
            pick.dispatchEvent(new Event("change",{bubbles:true}));
            break;
          }
        }
      }
      setStore("dmz_myname",name);
      try{if(typeof window.updateNameStatus==="function")window.updateNameStatus();}catch(e){}
      return true;
    }

    function openWebsiteTab(tab){
      var control=q("nav.tabs [data-tab='"+tab+"']")||q("[data-tab='"+tab+"']");
      if(!control)return false;
      try{control.click();return true;}catch(e){return false;}
    }

    function securityState(){
      try{if(typeof window.updateNameStatus==="function")window.updateNameStatus();}catch(e){}
      var sec=q("#nameSec");
      var text=clean(sec&&(sec.innerText||sec.textContent));
      var cls=clean(sec&&sec.className);
      return {
        protected:/\bprot\b/i.test(cls)||/\bprotected\b/i.test(text),
        verified:/\bverified\b/i.test(text),
        text:text
      };
    }

    function clearSiteMessage(){
      var msg=q("#logMsg");
      if(!msg)return;
      msg.className="msg";
      msg.innerHTML="";
    }

    function siteMessage(){
      var msg=q("#logMsg");
      if(!msg)return {text:"",ok:false,error:false};
      var text=clean(msg.innerText||msg.textContent);
      var cls=" "+clean(msg.className)+" ";
      return {
        text:text,
        ok:cls.indexOf(" ok ")>=0,
        error:cls.indexOf(" err ")>=0||cls.indexOf(" warn ")>=0
      };
    }

    function closeModal(id){
      var modal=q("#"+id);
      if(modal&&modal.parentNode)modal.parentNode.removeChild(modal);
      document.documentElement.classList.remove("hs-app-modal-open");
    }

    function buildModal(id,title,subtitle,onDismiss){
      closeModal(id);
      var overlay=document.createElement("div");
      overlay.id=id;
      overlay.className="hs-app-modal";
      overlay.innerHTML=
        "<div class='hs-app-modal-backdrop' data-hs-modal-close='1'></div>"+
        "<div class='hs-app-modal-card' role='dialog' aria-modal='true'>"+
          "<div class='hs-app-modal-head'>"+
            "<div><div class='hs-app-modal-eyebrow'>Harley's Studios · DMZ Ranked App</div>"+
            "<h2 class='hs-app-modal-title'></h2><p class='hs-app-modal-subtitle'></p></div>"+
            "<button type='button' class='hs-app-modal-close' data-hs-modal-close='1' aria-label='Close'>×</button>"+
          "</div>"+
          "<div class='hs-app-modal-body'></div>"+
        "</div>";
      overlay.querySelector(".hs-app-modal-title").textContent=title;
      overlay.querySelector(".hs-app-modal-subtitle").textContent=subtitle||"";
      overlay.querySelectorAll("[data-hs-modal-close]").forEach(function(btn){
        btn.addEventListener("click",function(){
          if(typeof onDismiss==="function")onDismiss();
          closeModal(id);
        });
      });
      (document.body||document.documentElement).appendChild(overlay);
      document.documentElement.classList.add("hs-app-modal-open");
      return overlay;
    }

    function statusLine(body,text,error){
      var status=body.querySelector(".hs-app-modal-status");
      if(!status)return;
      status.textContent=text||"";
      status.className="hs-app-modal-status"+(text?" show":"")+(error?" err":"");
    }

    function pinModeForCurrent(){
      if(!currentOperator())return "set";
      var state=securityState();
      if(!state.protected)return "set";
      return state.verified?"change":"unlock";
    }

    function showPinModal(mode,name){
      name=clean(name||currentOperator());
      if(!name){showGetStarted(true);return;}
      setOperator(name);
      openWebsiteTab("log");

      var title=mode==="unlock"?"Unlock Operator":mode==="change"?"Change Operator PIN":"Set Operator PIN";
      var modal=buildModal(
        "hs-app-pin-modal",
        title,
        "PIN controls are handled by the Harley's Studios app UI while DMZ Ranked keeps the existing PIN protection underneath."
      );
      var body=modal.querySelector(".hs-app-modal-body");
      var needsCurrent=mode==="change";
      var unlockOnly=mode==="unlock";

      var intro=document.createElement("p");
      intro.className="hs-app-modal-note";
      intro.textContent="Operator: "+name;
      body.appendChild(intro);

      if(needsCurrent){
        var currentWrap=document.createElement("div");
        currentWrap.className="hs-app-modal-field";
        currentWrap.innerHTML="<label>Current PIN</label><input id='hs-app-current-pin' type='password' inputmode='numeric' maxlength='8' autocomplete='off' placeholder='Current PIN'>";
        body.appendChild(currentWrap);
      }

      if(unlockOnly){
        var unlockWrap=document.createElement("div");
        unlockWrap.className="hs-app-modal-field";
        unlockWrap.innerHTML="<label>Operator PIN</label><input id='hs-app-unlock-pin' type='password' inputmode='numeric' maxlength='8' autocomplete='off' placeholder='Enter PIN'>";
        body.appendChild(unlockWrap);
      }else{
        var newWrap=document.createElement("div");
        newWrap.className="hs-app-modal-field";
        newWrap.innerHTML="<label>New PIN</label><input id='hs-app-new-pin' type='password' inputmode='numeric' maxlength='8' autocomplete='new-password' placeholder='4–8 digits'>";
        body.appendChild(newWrap);
        var confirmWrap=document.createElement("div");
        confirmWrap.className="hs-app-modal-field";
        confirmWrap.innerHTML="<label>Confirm PIN</label><input id='hs-app-confirm-pin' type='password' inputmode='numeric' maxlength='8' autocomplete='new-password' placeholder='Re-enter PIN'>";
        body.appendChild(confirmWrap);
        var pinNote=document.createElement("p");
        pinNote.className="hs-app-modal-note";
        pinNote.textContent="New app-created PINs use 4–8 digits. Existing older PINs can still be unlocked.";
        body.appendChild(pinNote);
      }

      var status=document.createElement("div");
      status.className="hs-app-modal-status";
      body.appendChild(status);

      var actions=document.createElement("div");
      actions.className="hs-app-modal-actions";
      actions.innerHTML="<button type='button' class='hs-app-modal-btn ghost' data-hs-cancel='1'>Cancel</button>"+
        "<button type='button' class='hs-app-modal-btn' id='hs-app-pin-submit'>"+(unlockOnly?"Unlock":needsCurrent?"Update PIN":"Protect Operator")+"</button>";
      body.appendChild(actions);
      actions.querySelector("[data-hs-cancel]").addEventListener("click",function(){closeModal("hs-app-pin-modal");});

      var submit=actions.querySelector("#hs-app-pin-submit");
      submit.addEventListener("click",async function(){
        setOperator(name);
        clearSiteMessage();
        submit.disabled=true;
        statusLine(body,unlockOnly?"Verifying PIN…":"Saving PIN…",false);

        try{
          if(unlockOnly){
            var pin=clean(q("#hs-app-unlock-pin")&&q("#hs-app-unlock-pin").value);
            if(!/^\d{3,8}$/.test(pin)){
              statusLine(body,"Enter the existing 3–8 digit operator PIN.",true);
              submit.disabled=false;
              return;
            }
            var sitePin=q("#namePin");
            if(!sitePin||typeof window.unlockName!=="function")throw new Error("DMZ Ranked PIN controls are still loading. Try again in a moment.");
            sitePin.value=pin;
            await Promise.resolve(window.unlockName());
          }else{
            var currentPin=needsCurrent?clean(q("#hs-app-current-pin")&&q("#hs-app-current-pin").value):"";
            var p1=clean(q("#hs-app-new-pin")&&q("#hs-app-new-pin").value);
            var p2=clean(q("#hs-app-confirm-pin")&&q("#hs-app-confirm-pin").value);
            if(needsCurrent&&!/^\d{3,8}$/.test(currentPin)){
              statusLine(body,"Enter your current operator PIN first.",true);
              submit.disabled=false;
              return;
            }
            if(!/^\d{4,8}$/.test(p1)){
              statusLine(body,"Use a 4–8 digit new PIN.",true);
              submit.disabled=false;
              return;
            }
            if(p1!==p2){
              statusLine(body,"The new PIN and confirmation do not match.",true);
              submit.disabled=false;
              return;
            }
            if(typeof window.openSetPin!=="function"||typeof window.saveSetPin!=="function")throw new Error("DMZ Ranked PIN controls are still loading. Try again in a moment.");
            window.openSetPin(needsCurrent);
            var siteCurrent=q("#curPin"),siteNew=q("#newPin"),siteConfirm=q("#newPin2");
            if(siteCurrent)siteCurrent.value=currentPin;
            if(siteNew)siteNew.value=p1;
            if(siteConfirm)siteConfirm.value=p2;
            await Promise.resolve(window.saveSetPin());
          }

          await wait(300);
          try{if(typeof window.updateNameStatus==="function")window.updateNameStatus();}catch(e){}
          await wait(220);
          var result=siteMessage();
          var state=securityState();

          if(result.error){
            statusLine(body,result.text||"The PIN could not be updated.",true);
            submit.disabled=false;
            return;
          }
          if(unlockOnly&&!state.verified){
            statusLine(body,result.text||"PIN verification did not complete. Check the PIN and try again.",true);
            submit.disabled=false;
            return;
          }
          if(!unlockOnly&&!state.protected){
            statusLine(body,result.text||"PIN protection did not save. Try again.",true);
            submit.disabled=false;
            return;
          }

          statusLine(body,result.text||(unlockOnly?"Operator unlocked on this device.":"PIN protection updated."),false);
          await wait(500);
          closeModal("hs-app-pin-modal");
          updatePinUi();
        }catch(error){
          statusLine(body,clean(error&&error.message)||"Could not update the operator PIN.",true);
          submit.disabled=false;
        }
      });

      var focus=body.querySelector("input");
      if(focus)setTimeout(function(){try{focus.focus();}catch(e){}},120);
    }

    async function finishExisting(name,pin,body,submit){
      name=clean(name);
      pin=clean(pin);
      if(!name)return false;
      if(!/^\d{3,8}$/.test(pin)){
        if(body)statusLine(body,"Enter the existing 3–8 digit operator PIN.",true);
        return false;
      }

      setOperator(name);
      openWebsiteTab("log");
      clearSiteMessage();
      if(submit)submit.disabled=true;
      if(body)statusLine(body,"Checking operator and PIN…",false);

      try{
        await wait(220);
        var state=securityState();

        if(state.protected&&!state.verified){
          var sitePin=q("#namePin");
          if(!sitePin||typeof window.unlockName!=="function"){
            throw new Error("DMZ Ranked PIN controls are still loading. Try again in a moment.");
          }
          sitePin.value=pin;
          await Promise.resolve(window.unlockName());
          await wait(300);
          try{if(typeof window.updateNameStatus==="function")window.updateNameStatus();}catch(e){}
          await wait(180);

          var result=siteMessage();
          state=securityState();
          if(result.error||!state.verified){
            if(body)statusLine(body,result.text||"That PIN did not unlock this operator. Check the PIN and try again.",true);
            if(submit)submit.disabled=false;
            return false;
          }
        }

        markFirstRun();
        closeModal("hs-app-get-started");
        updatePinUi();

        if(!state.protected){
          setTimeout(function(){showPinModal("set",name);},120);
        }
        return true;
      }catch(error){
        if(body)statusLine(body,clean(error&&error.message)||"Could not verify this operator PIN.",true);
        if(submit)submit.disabled=false;
        return false;
      }
    }

    function showGetStarted(force){
      var modal=buildModal(
        "hs-app-get-started",
        "Get Started",
        "Set up a new operator or reconnect an existing DMZ Ranked operator on this device.",
        force?null:markFirstRun
      );
      var body=modal.querySelector(".hs-app-modal-body");
      body.innerHTML=
        "<div class='hs-app-modal-choice-grid'>"+
          "<button type='button' class='hs-app-modal-choice' id='hs-app-new-user'><strong>New User</strong><span>Create or enter your operator name, then protect it with an app-guided PIN.</span></button>"+
          "<button type='button' class='hs-app-modal-choice' id='hs-app-existing-user'><strong>Existing User</strong><span>Restore an operator already on DMZ Ranked and unlock its PIN on this device.</span></button>"+
        "</div>"+
        "<div class='hs-app-modal-status'></div>"+
        "<div class='hs-app-modal-actions'><button type='button' class='hs-app-modal-btn ghost' id='hs-app-onboarding-skip'>"+(force?"Close":"Skip for now")+"</button></div>";

      function renderNew(){
        body.innerHTML=
          "<div class='hs-app-modal-field'><label>Operator name</label><input id='hs-app-new-operator' type='text' maxlength='80' autocomplete='off' placeholder='Your operator name'></div>"+
          "<p class='hs-app-modal-note'>This uses the same operator name field as DMZ Ranked. The app will then open its dedicated PIN setup.</p>"+
          "<div class='hs-app-modal-status'></div>"+
          "<div class='hs-app-modal-actions'><button type='button' class='hs-app-modal-btn ghost' id='hs-app-onboarding-back'>Back</button><button type='button' class='hs-app-modal-btn' id='hs-app-new-continue'>Continue</button></div>";
        q("#hs-app-onboarding-back").addEventListener("click",function(){showGetStarted(force);});
        q("#hs-app-new-continue").addEventListener("click",function(){
          var name=clean(q("#hs-app-new-operator")&&q("#hs-app-new-operator").value);
          if(!name){statusLine(body,"Enter an operator name first.",true);return;}
          setOperator(name);
          markFirstRun();
          closeModal("hs-app-get-started");
          openWebsiteTab("log");
          setTimeout(function(){showPinModal("set",name);},180);
        });
        setTimeout(function(){var input=q("#hs-app-new-operator");if(input)input.focus();},80);
      }

      function renderExisting(){
        var list=operatorOptions();
        var current=currentOperator();
        body.innerHTML=
          "<div class='hs-app-modal-field'><label>Existing operator</label><select id='hs-app-existing-select'><option value=''>— select operator —</option></select></div>"+
          "<div class='hs-app-modal-field'><label>Or type the exact operator name</label><input id='hs-app-existing-name' type='text' maxlength='80' autocomplete='off' placeholder='Operator name'></div>"+
          "<div class='hs-app-modal-field'><label>Existing operator PIN</label><input id='hs-app-existing-pin' type='password' inputmode='numeric' maxlength='8' autocomplete='off' placeholder='Enter existing PIN'></div>"+
          "<p class='hs-app-modal-note'>Enter the PIN already protecting this operator. Existing DMZ Ranked PINs may be 3–8 digits.</p>"+
          "<div class='hs-app-modal-status'></div>"+
          "<div class='hs-app-modal-actions'><button type='button' class='hs-app-modal-btn ghost' id='hs-app-onboarding-back'>Back</button><button type='button' class='hs-app-modal-btn' id='hs-app-existing-continue'>Verify & Continue</button></div>";
        var select=q("#hs-app-existing-select");
        list.forEach(function(name){
          var option=document.createElement("option");
          option.value=name;
          option.textContent=name;
          if(current&&current.toLowerCase()===name.toLowerCase())option.selected=true;
          select.appendChild(option);
        });
        if(current&&!select.value)q("#hs-app-existing-name").value=current;
        q("#hs-app-onboarding-back").addEventListener("click",function(){showGetStarted(force);});
        q("#hs-app-existing-continue").addEventListener("click",async function(){
          var submit=q("#hs-app-existing-continue");
          var name=clean(select.value)||clean(q("#hs-app-existing-name")&&q("#hs-app-existing-name").value);
          var pin=clean(q("#hs-app-existing-pin")&&q("#hs-app-existing-pin").value);
          if(!name){statusLine(body,"Choose or type your existing operator name.",true);return;}
          if(!/^\d{3,8}$/.test(pin)){statusLine(body,"Enter the existing 3–8 digit operator PIN.",true);return;}
          await finishExisting(name,pin,body,submit);
        });
      }

      q("#hs-app-new-user").addEventListener("click",renderNew);
      q("#hs-app-existing-user").addEventListener("click",renderExisting);
      q("#hs-app-onboarding-skip").addEventListener("click",function(){
        if(!force)markFirstRun();
        closeModal("hs-app-get-started");
      });
    }

    function updatePinUi(){
      var cover=q("#hs-app-pin-cover");
      var name=currentOperator();
      var state=name?securityState():{protected:false,verified:false};
      var log=q("#log");
      var input=q("#playerName");
      var field=input&&input.closest?input.closest(".field"):null;
      if(log)log.classList.toggle("hs-app-has-operator",!!name);
      if(field)field.classList.toggle("hs-app-operator-covered",!!name);
      var statusText=!name
        ?"Choose a new or existing operator to manage PIN protection."
        :!state.protected
          ?name+" · not PIN protected yet."
          :state.verified
            ?name+" · Verified on this device"
            :name+" · PIN protected. Unlock this device to log raids.";

      if(cover){
        var stateEl=cover.querySelector(".hs-pin-cover-state");
        var action=cover.querySelector(".hs-pin-cover-action");
        setTextIfChanged(stateEl,statusText);
        if(action){
          setTextIfChanged(action,!name?"GET STARTED":!state.protected?"SET PIN":state.verified?"CHANGE PIN":"UNLOCK");
          action.onclick=function(){
            if(!name)showGetStarted(true);
            else showPinModal(!state.protected?"set":state.verified?"change":"unlock",name);
          };
        }
      }
      var appState=q("#hs-app-operator-state");
      setTextIfChanged(appState,statusText);
      var manage=q("#hs-app-manage-pin");
      setTextIfChanged(manage,!name?"Get Started":!state.protected?"Set PIN":state.verified?"Change PIN":"Unlock Operator");
    }

    function ensurePinCover(){
      var input=q("#playerName");
      var field=input&&input.closest?input.closest(".field"):null;
      if(!field)return;
      var cover=q("#hs-app-pin-cover");
      if(!cover){
        var info=window.__DMZ_APP_INFO||{};
        var logo=clean(info.logoUrl)||"file:///android_res/drawable/dmz_ranked_logo.png";
        cover=document.createElement("div");
        cover.id="hs-app-pin-cover";
        cover.innerHTML=
          "<div class='hs-pin-cover-brand'>"+
            "<img class='hs-pin-cover-logo' alt='DMZ Ranked app logo'>"+
            "<div class='hs-pin-cover-copy'>"+
              "<span class='hs-pin-cover-kicker'>Protected Autofill by Harley's Studios</span>"+
              "<span class='hs-pin-cover-appname'>DMZ Ranked App</span>"+
              "<span class='hs-pin-cover-state'>Checking operator protection…</span>"+
            "</div>"+
          "</div>"+
          "<button type='button' class='hs-pin-cover-action'>MANAGE PIN</button>";
        var img=cover.querySelector(".hs-pin-cover-logo");
        if(img){
          img.src=logo;
          img.onerror=function(){this.style.display="none";};
        }
        field.appendChild(cover);
      }
      updatePinUi();
    }

    function ensureAppTools(){
      var app=q("#unofficial-app");
      if(!app)return;
      if(!q("#hs-app-operator-tools")){
        var account=document.createElement("div");
        account.id="hs-app-operator-tools";
        account.className="card hs-app-account-card";
        account.innerHTML=
          "<div class='hs-app-heading-row'><div><div class='hs-app-eyebrow'>First-time setup & security</div><h2 class='section-title'>Operator & PIN</h2></div><span class='hs-exclusive-badge'>APP EXCLUSIVE</span></div>"+
          "<p class='hs-app-account-copy'>New to the app or moving an existing operator to this device? Use Get Started. The app replaces the website's inline PIN controls with a dedicated PIN flow.</p>"+
          "<div class='hs-app-account-state' id='hs-app-operator-state'>Checking operator…</div>"+
          "<div class='hs-app-actions'><button type='button' class='hs-app-action-btn' id='hs-app-get-started-btn'>Get Started</button><button type='button' class='hs-app-action-btn ghost' id='hs-app-manage-pin'>Manage PIN</button></div>";

        var support=document.createElement("div");
        support.id="hs-app-support-card";
        support.className="card hs-app-support-card";
        support.innerHTML=
          "<div class='hs-app-heading-row'><div><div class='hs-app-eyebrow'>Support the Android app</div><h2 class='section-title'>Harley's Studios</h2></div></div>"+
          "<p class='hs-app-support-copy'>Support development and maintenance of the unofficial DMZ Ranked Android app through Harley's Studios on Ko-fi.</p>"+
          "<a class='hs-kofi-btn' id='hs-app-kofi' href='"+KOFI_URL+"' target='_self' rel='noopener noreferrer'>☕ Support on Ko-fi</a>";

        var before=app.querySelector(".hs-app-about");
        if(before){
          app.insertBefore(account,before);
          app.insertBefore(support,before);
        }else{
          app.appendChild(account);
          app.appendChild(support);
        }

        q("#hs-app-get-started-btn").addEventListener("click",function(){showGetStarted(true);});
        q("#hs-app-manage-pin").addEventListener("click",function(){
          var name=currentOperator();
          if(!name)showGetStarted(true);
          else showPinModal(pinModeForCurrent(),name);
        });
      }
      updatePinUi();
    }

    function fixSupportLinks(){
      var support=q("#supportBtn");
      if(support){
        // Keep the website's configured PayPal/Ko-fi URL intact. Using the
        // normal HTTPS href lets the native WebView routing layer open it in
        // the user's browser/app. Rewriting this button to a custom scheme
        // caused older React Native builds to reject the click as blocked.
        support.setAttribute("target","_self");
        support.setAttribute("rel","noopener noreferrer");
        support.removeAttribute("data-hs-support-bridge");
      }
      qa("a[href*='ko-fi.com/harleytg_']").forEach(function(link){
        link.setAttribute("target","_self");
        link.setAttribute("rel","noopener noreferrer");
      });
    }

    /* Scope the site's SR preview so the app can fix only this one card.
       No site values or structure are changed; classes are added for styling only. */
    function markRaidSrSummary(){
      var log=q("#log");
      if(!log)return;

      var labels=[
        {key:"current",text:"current sr / rank"},
        {key:"fee",text:"deployment fee"},
        {key:"earned",text:"sr earned this raid"},
        {key:"net",text:"net change"},
        {key:"new",text:"new sr / rank"}
      ];
      var candidates=Array.prototype.slice.call(log.querySelectorAll("div,section,article,fieldset"));
      var card=null;
      var bestLength=Infinity;

      candidates.forEach(function(el){
        var txt=clean(el.textContent).toLowerCase();
        if(!labels.every(function(item){return txt.indexOf(item.text)!==-1;}))return;
        if(txt.length<bestLength){
          card=el;
          bestLength=txt.length;
        }
      });
      if(!card)return;

      /* Website preview writes "0 · <span class='badge'>…</span>" directly into
         a <b>. Wrap that loose text node so CSS can keep it separate from the
         badge on narrow screens. Re-run safely after every website refresh. */
      ["pv-cur","pv-new"].forEach(function(id){
        var value=q("#"+id);
        if(!value)return;
        var row=value.parentElement;
        if(row)row.classList.add("hs-app-rank-preview-row");

        var existing=value.querySelector(".hs-app-sr-number");
        if(existing)return;

        var textNodes=Array.prototype.slice.call(value.childNodes).filter(function(node){
          return node.nodeType===3&&clean(node.textContent);
        });
        if(!textNodes.length)return;

        var sr=document.createElement("span");
        sr.className="hs-app-sr-number";
        sr.textContent=textNodes.map(function(node){return node.textContent;}).join("").replace(/\s+/g," ").trim();
        value.insertBefore(sr,value.firstChild);
        textNodes.forEach(function(node){
          if(node.parentNode===value)value.removeChild(node);
        });
      });

      Array.prototype.slice.call(log.querySelectorAll(".hs-app-raid-sr-summary")).forEach(function(el){
        if(el!==card)el.classList.remove("hs-app-raid-sr-summary");
      });
      card.classList.add("hs-app-raid-sr-summary");

      labels.forEach(function(item){
        var match=null;
        var matchLength=Infinity;
        Array.prototype.slice.call(card.querySelectorAll("*")).forEach(function(el){
          var txt=clean(el.textContent).toLowerCase();
          if(txt.indexOf(item.text)!==0)return;
          if(txt.length<matchLength){
            match=el;
            matchLength=txt.length;
          }
        });
        if(!match)return;

        var row=match;
        while(row.parentElement&&row.parentElement!==card){
          var parent=row.parentElement;
          var parentText=clean(parent.textContent).toLowerCase();
          var includesOther=labels.some(function(other){
            return other.key!==item.key&&parentText.indexOf(other.text)!==-1;
          });
          if(includesOther)break;
          row=parent;
        }
        row.classList.add("hs-app-raid-sr-row","hs-app-raid-sr-"+item.key);
      });
    }

    function refresh(){
      fixSupportLinks();
      markRaidSrSummary();
      ensureAppTools();
      ensurePinCover();
      updatePinUi();
      if(firstRunDone())maybeIosSupportPopup();
      if(!firstRunDone()&&!firstRunQueued&&!q("#hs-app-get-started")){
        firstRunQueued=true;
        setTimeout(function(){
          if(!firstRunDone()&&!q("#hs-app-get-started"))showGetStarted(false);
        },900);
      }
    }

    document.addEventListener("input",function(ev){
      if(ev.target&&ev.target.id==="playerName")setTimeout(updatePinUi,40);
    },true);
    document.addEventListener("change",function(ev){
      if(ev.target&&(ev.target.id==="playerName"||ev.target.id==="playerPick"))setTimeout(updatePinUi,80);
    },true);

    var refreshQueued=false;
    function queueRefresh(){
      if(refreshQueued)return;
      refreshQueued=true;
      setTimeout(function(){
        refreshQueued=false;
        refresh();
      },90);
    }
    var observer=new MutationObserver(function(mutations){
      for(var i=0;i<mutations.length;i++){
        var target=mutations[i]&&mutations[i].target;
        var el=target&&target.nodeType===1?target:target&&target.parentElement;
        if(el&&el.closest&&(
          el.closest("#hs-app-pin-cover")||
          el.closest("#hs-app-operator-tools")||
          el.closest("#hs-app-support-card")||
          el.closest("#hs-ios-support-overlay")||
          el.closest(".hs-app-modal")
        ))continue;
        queueRefresh();
        break;
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(refresh,1800);
    refresh();
  }catch(e){}
})();


/* DMZ Ranked Remote CSS Guard v1
   Keep the Android app override stylesheet attached if dmzranked.com replaces
   or rebuilds its document head during navigation/render updates. */
(function(){
  try{
    if(window.__hsRemoteCssGuardV1)return;
    window.__hsRemoteCssGuardV1=true;
    var STYLE_ID="hs-remote-app-ui-style";
    var initial=document.getElementById(STYLE_ID);
    var cssText=initial&&initial.textContent?initial.textContent:"";
    if(!cssText)return;
    window.__DMZ_APP_CSS_TEXT=cssText;
    var scheduled=false;
    function ensureCss(){
      scheduled=false;
      var style=document.getElementById(STYLE_ID);
      if(!style){
        style=document.createElement("style");
        style.id=STYLE_ID;
        style.textContent=window.__DMZ_APP_CSS_TEXT||cssText;
        (document.head||document.documentElement).appendChild(style);
      }else if(!style.textContent){
        style.textContent=window.__DMZ_APP_CSS_TEXT||cssText;
      }
      document.documentElement.setAttribute("data-dmz-app-css","active");
    }
    function schedule(){
      if(scheduled)return;
      scheduled=true;
      setTimeout(ensureCss,40);
    }
    var cssObserver=new MutationObserver(schedule);
    cssObserver.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(ensureCss,2500);
    ensureCss();
  }catch(e){}
})();
