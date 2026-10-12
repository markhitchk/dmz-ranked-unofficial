/**
 * A passive, bounded observer of public leaderboard DOM that the site's own
 * scripts have already populated. No fetch/XHR, no private form fields, no
 * replay of HTML into the site, and no separate service or API.
 */
export const LEADERBOARD_SNAPSHOT_SCRIPT = `
(function () {
  if (window.__dmzRnLeaderboardSnapshotInstalled) return true;
  if (!/^([a-z0-9-]+\\.)*dmzranked\\.com$/i.test(location.hostname)) return true;
  window.__dmzRnLeaderboardSnapshotInstalled = true;
  var lastPayload = '';
  var lastSentAt = 0;
  function clean(value, limit) {
    return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, limit || 220);
  }
  function getBlock(selectors, headings) {
    var node = null;
    for (var i = 0; i < selectors.length; i++) {
      try { node = document.querySelector(selectors[i]); } catch (_) {}
      if (node) return node;
    }
    var labels = document.querySelectorAll('h1,h2,h3,[role="heading"]');
    for (var j = 0; j < Math.min(labels.length, 120); j++) {
      var label = clean(labels[j].textContent, 100).toLowerCase();
      if (headings.indexOf(label) >= 0) {
        return labels[j].closest('section,article') ||
          (labels[j].parentElement && labels[j].parentElement.parentElement);
      }
    }
    return null;
  }
  function readRows(node) {
    if (!node) return [];
    var found = node.querySelectorAll(
      'tbody tr,[role="row"],.leaderboard-row,.standing-row,.leader-row,.player-row'
    );
    if (!found.length) found = node.querySelectorAll('table tr');
    var result = [];
    for (var i = 0; i < Math.min(found.length, 100); i++) {
      var row = found[i];
      if (row.closest('form,[data-private],#settings')) continue;
      var text = clean(row.textContent, 220);
      if (text && !/^(loading|connecting|syncing|operator\\s+sr)$/i.test(text)) {
        result.push(text);
      }
    }
    return result;
  }
  function collectCounters(nodes) {
    var result = {};
    var picked = 0;
    for (var n = 0; n < nodes.length && picked < 36; n++) {
      if (!nodes[n]) continue;
      var list = nodes[n].querySelectorAll(
        '.stat-card,.stat-tile,.stat,.metric,.metric-card,.kpi,.stat-pill,.count-card,[data-stat],[id*="total"],[id*="count"]'
      );
      for (var i = 0; i < Math.min(list.length, 80) && picked < 36; i++) {
        var entry = list[i];
        if (entry.closest('form,[data-private],#settings') ||
            entry.querySelector('input,textarea,select,[type="password"]')) continue;
        var text = clean(entry.textContent, 140);
        if (!text || text.length < 3 || /^(loading|connecting|syncing)/i.test(text)) continue;
        var label = clean(entry.getAttribute('data-stat') || entry.id || 'stat-' + picked, 65);
        if (label && !Object.prototype.hasOwnProperty.call(result, label)) {
          result[label] = text;
          picked++;
        }
      }
    }
    return result;
  }
  function capture() {
    if (document.visibilityState === 'hidden' || window.__dmzAppScrolling ||
        window.__dmzAppPaused || !document.body) return;
    try {
      var standings = getBlock(
        ['#standings','#standingsTable','#leaderboard','#leaderboardTable',
         '#leaderboardBody','#board','.standings','.leaderboard-table'],
        ['standings','ranked leaderboard']
      );
      var hall = getBlock(
        ['#hallOfFame','#hall-of-fame','#hof'], ['hall of fame']
      );
      var leaders = getBlock(
        ['#leaders','#leaders-board','#community-leaders'], ['leaders']
      );
      var seasonBanner = document.getElementById('seasonBanner');
      var appStats = document.getElementById('dmz-hs-active-user-stats');
      var headerStats = document.querySelector('header.top .statusbar');
      var season = clean(seasonBanner && seasonBanner.textContent, 120);
      var result = {
        sourceUrl: location.href,
        season: season,
        standings: readRows(standings),
        hallOfFame: readRows(hall),
        leaders: readRows(leaders),
        counters: collectCounters([standings, hall, leaders, appStats, seasonBanner, headerStats])
      };
      if (!result.standings.length && !result.hallOfFame.length &&
          !result.leaders.length && !Object.keys(result.counters).length) return;
      var fingerprint = JSON.stringify(result);
      if (fingerprint === lastPayload && Date.now() - lastSentAt < 5 * 60 * 1000) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'public-leaderboard-snapshot', data: result
      }));
      lastPayload = fingerprint;
      lastSentAt = Date.now();
    } catch (_) { /* Snapshot is optional and must never block the website. */ }
  }
  function start() {
    if (window.__dmzRnSnapshotTimer) clearInterval(window.__dmzRnSnapshotTimer);
    window.__dmzRnCaptureLeaderboardSnapshot = capture;
    setTimeout(capture, 400);
    setTimeout(capture, 2400);
    setTimeout(capture, 7200);
    window.__dmzRnSnapshotTimer = setInterval(capture, 30000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') setTimeout(capture, 300);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else start();
  return true;
})();
true;`;
